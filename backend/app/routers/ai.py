"""AI generation, refinement, and chat endpoints."""

import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.analysis import Analysis, AnalysisStatus
from app.models.chat import ChatMessage, ChatThread, MessageRole
from app.models.document import Document, SectionStatus
from app.models.project import Project
from app.models.user import User
from app.models.version import AuthorType
from app.prompts.outline import build_outline_prompt
from app.schemas.chat import (
    ChatMessageResponse,
    ChatThreadResponse,
    CreateThreadRequest,
    MessageRoleEnum,
    SendMessageRequest,
)
from app.schemas.section import SectionResponse
from app.services import ai_credential_service, section_service
from app.services.ai_doc_service import ai_service
from app.services.version_service import create_version_snapshot

router = APIRouter(tags=["ai"])


# ── Helper ──────────────────────────────────────────────────────

async def _require_project(db: AsyncSession, project_id: int, user_id: int) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _require_analysis_complete(db: AsyncSession, project_id: int) -> Analysis:
    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this project")
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Analysis is not complete (status: {analysis.status.value}). "
                   "Please wait for the analysis to finish.",
        )
    return analysis


# ── POST /projects/{id}/ai/generate-outline ──────────────────────

@router.post("/projects/{project_id}/ai/generate-outline")
async def generate_outline(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a documentation outline using Claude, requires completed analysis."""
    project = await _require_project(db, project_id, current_user.id)
    analysis = await _require_analysis_complete(db, project_id)

    cred = await ai_credential_service.get_active_credential(db, current_user.id)
    if not cred:
        raise HTTPException(
            status_code=400,
            detail="No active AI credential. Add an Anthropic API key in Settings.",
        )

    # Extract codebase facts from analysis
    classes: list = []
    functions: list = []
    endpoints: list = []
    dependencies: list = []
    language = ""
    framework = ""

    if analysis.complexity_json and isinstance(analysis.complexity_json, dict):
        classes = analysis.complexity_json.get("classes", [])
        functions = analysis.complexity_json.get("functions", [])

    if analysis.endpoints_json and isinstance(analysis.endpoints_json, list):
        endpoints = [
            ep.get("path", str(ep)) if isinstance(ep, dict) else str(ep)
            for ep in analysis.endpoints_json[:30]
        ]

    if analysis.languages_json:
        lang_data = analysis.languages_json
        if isinstance(lang_data, dict):
            lang_keys = list(lang_data.keys())
            language = lang_keys[0] if lang_keys else ""
            dependencies = list(lang_data.get("dependencies", {}).keys())[:30]
        elif isinstance(lang_data, list):
            language = lang_keys[0] if lang_data else ""

    import anthropic as _anthropic
    from app.services.crypto_service import decrypt_token
    from app.models.ai_credential import UserAiCredential

    cred_result = await db.execute(
        select(UserAiCredential).where(
            UserAiCredential.user_id == current_user.id,
            UserAiCredential.is_active == True,  # noqa: E712
        )
    )
    cred_row = cred_result.scalar_one_or_none()
    if not cred_row or cred_row.provider != "anthropic":
        raise HTTPException(
            status_code=400,
            detail="An active Anthropic credential is required to generate an outline.",
        )

    api_key = decrypt_token(cred_row.api_key_encrypted)
    client = _anthropic.AsyncAnthropic(api_key=api_key)

    prompt = build_outline_prompt(
        project_name=project.name,
        language=language,
        framework=framework,
        classes=classes,
        functions=functions,
        endpoints=endpoints,
        dependencies=dependencies,
    )

    response = await client.messages.create(
        model=cred_row.model_id,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    try:
        parsed = json.loads(raw)
        sections = parsed.get("sections", parsed) if isinstance(parsed, dict) else parsed
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="AI returned invalid JSON for outline. Please try again.",
        )

    return {"sections": sections}


# ── POST /sections/{id}/ai/generate ─────────────────────────────

@router.post("/sections/{section_id}/ai/generate", response_model=SectionResponse)
async def generate_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate content for a section using Claude, save it, create a version snapshot."""
    section = await section_service.get_section_for_user(db, section_id, current_user.id)

    # Resolve project_id through the document
    doc_result = await db.execute(
        select(Document).where(Document.id == section.document_id)
    )
    document = doc_result.scalar_one()
    project_id = document.project_id

    old_content = section.content_md or ""

    generated = await ai_service.generate_section(
        project_id=project_id,
        section_id=section_id,
        db=db,
        user_id=current_user.id,
    )

    # Auto-save content
    section.content_md = generated
    section.status = SectionStatus.DRAFT
    section.updated_at = datetime.utcnow()

    # Version snapshot
    await create_version_snapshot(
        db,
        section_id=section.id,
        old_content=old_content,
        new_content=generated,
        author_type=AuthorType.AI,
        summary="AI-generated content",
    )

    await db.commit()
    await db.refresh(section)

    return section_service.section_to_response(section)


# ── POST /sections/{id}/ai/refine ───────────────────────────────

class RefineRequest(SendMessageRequest):
    instruction: str

    class Config:
        # allow `instruction` as alias for `message`
        pass


@router.post("/sections/{section_id}/ai/refine")
async def refine_section(
    section_id: int,
    body: RefineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Refine section content per instruction. Returns diff — does NOT save."""
    # Verify user owns the section
    await section_service.get_section_for_user(db, section_id, current_user.id)

    result = await ai_service.refine_section(
        section_id=section_id,
        instruction=body.instruction,
        db=db,
        user_id=current_user.id,
    )
    return result


# ── POST /sections/{id}/ai/accept ───────────────────────────────

class AcceptRefineRequest(SendMessageRequest):
    refined_content: str
    instruction: str = ""


@router.post("/sections/{section_id}/ai/accept", response_model=SectionResponse)
async def accept_refined_section(
    section_id: int,
    body: AcceptRefineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept refined content: save to section and create an AI version snapshot."""
    section = await section_service.get_section_for_user(db, section_id, current_user.id)
    old_content = section.content_md or ""

    section.content_md = body.refined_content
    section.updated_at = datetime.utcnow()

    await create_version_snapshot(
        db,
        section_id=section.id,
        old_content=old_content,
        new_content=body.refined_content,
        author_type=AuthorType.AI,
        summary=body.instruction or "AI refinement accepted",
    )

    await db.commit()
    await db.refresh(section)

    return section_service.section_to_response(section)


# ── POST /projects/{id}/chat/threads ────────────────────────────

@router.post(
    "/projects/{project_id}/chat/threads",
    response_model=ChatThreadResponse,
    status_code=201,
)
async def create_chat_thread(
    project_id: int,
    body: CreateThreadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new chat thread for a project."""
    await _require_project(db, project_id, current_user.id)

    # Auto-title from first message if no title provided
    title = body.title
    if not title and body.first_message:
        title = body.first_message[:60] + ("…" if len(body.first_message) > 60 else "")
    if not title:
        title = "New Chat"

    thread = ChatThread(project_id=project_id, title=title)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)

    return ChatThreadResponse(
        id=thread.id,
        project_id=thread.project_id,
        title=thread.title,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


# ── GET /projects/{id}/chat/threads ─────────────────────────────

@router.get(
    "/projects/{project_id}/chat/threads",
    response_model=List[ChatThreadResponse],
)
async def list_chat_threads(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all chat threads for a project."""
    await _require_project(db, project_id, current_user.id)

    result = await db.execute(
        select(ChatThread)
        .where(ChatThread.project_id == project_id)
        .order_by(ChatThread.updated_at.desc())
    )
    threads = result.scalars().all()

    return [
        ChatThreadResponse(
            id=t.id,
            project_id=t.project_id,
            title=t.title,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in threads
    ]


# ── POST /chat/threads/{id}/messages/stream ──────────────────────

@router.post("/chat/threads/{thread_id}/messages/stream")
async def stream_chat_message(
    thread_id: int,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream an AI chat response as Server-Sent Events."""
    # Verify thread belongs to a project owned by current user
    thread_result = await db.execute(
        select(ChatThread).where(ChatThread.id == thread_id)
    )
    thread = thread_result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    await _require_project(db, thread.project_id, current_user.id)

    async def event_generator():
        stream_gen = await ai_service.stream_chat(
            thread_id=thread_id,
            user_message=body.message,
            db=db,
            user_id=current_user.id,
        )
        async for chunk in stream_gen:
            if chunk:
                yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── GET /chat/threads/{id}/messages ─────────────────────────────

@router.get(
    "/chat/threads/{thread_id}/messages",
    response_model=List[ChatMessageResponse],
)
async def get_chat_messages(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all messages for a chat thread."""
    thread_result = await db.execute(
        select(ChatThread).where(ChatThread.id == thread_id)
    )
    thread = thread_result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    await _require_project(db, thread.project_id, current_user.id)

    msgs_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at)
    )
    messages = msgs_result.scalars().all()

    return [
        ChatMessageResponse(
            id=m.id,
            thread_id=m.thread_id,
            role=MessageRoleEnum(m.role.value),
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]
