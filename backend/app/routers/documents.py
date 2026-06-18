import json
import logging
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership, require_document_permission, verify_document_access
from app.models.activity import ActivityEvent
from app.models.analysis import Analysis
from app.models.audit import AuditLog
from app.models.document import (
    Document,
    DocumentSetupStage,
    DocumentStatus,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.clarification import ClarificationRequest
from app.models.document_share import DocumentShare, DocumentSharePermission
from app.models.generation import GenerationMode, GenerationRun, GenerationSectionTask
from app.models.organization import OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.outline_proposal import OutlineProposal, OutlineProposalBasis
from app.models.project import Project
from app.models.resource import Resource
from app.models.template import Template
from app.models.template_recommendation import TemplateRecommendationBasis
from app.models.user import User
from app.models.version import AuthorType
from app.schemas.document import (
    ClarificationRequestCreateRequest,
    ClarificationRequestResponse,
    DocumentCreateRequest,
    GenerationEstimateRequest,
    GenerationEstimateResponse,
    GenerationFailoverConfirmRequest,
    GenerationModeEnum,
    GenerationRunCreateRequest,
    GenerationRunListResponse,
    GenerationRunResponse,
    GenerationSectionTaskResponse,
    DocumentListResponse,
    DocumentProgressResponse,
    DocumentResponse,
    DocumentSetupStateResponse,
    DocumentUpdateRequest,
    OutlineProposalCreateRequest,
    OutlineProposalListResponse,
    OutlineProposalResponse,
    OutlineProposalUpdateRequest,
    TemplateRecommendationListResponse,
    TemplateRecommendationRequest,
    TemplateRecommendationResponse,
)
from app.schemas.ai_work import (
    AIChatActionRequest,
    AIChatActionResponse,
    AIProposedChangeCreate,
    AIProposedChangeListResponse,
    AIProposedChangePreviewResponse,
    AIProposedChangeResponse,
    AIProposedChangeTypeEnum,
    AIWorkRunCreateRequest,
    AIWorkRunListResponse,
    AIWorkRunResponse,
)
from app.schemas.section import (
    CustomSectionRequest,
    SectionAutosaveRequest,
    SectionAutosaveResponse,
    SectionReorderRequest,
    SectionResponse,
    SectionTitleRequest,
    SectionTreeResponse,
    SectionUpdateRequest,
)
from app.schemas.template import TemplateResponse
from app.services import section_service
from app.services import ai_work_service
from app.services import ai_credential_service
from app.services.ai_doc_service import ai_service
from app.services.ai_service import AiServiceError, complete_text
from app.services import generation_service
from app.services import template_recommendation_service
from app.services import freshness_service, activity_service
from app.services.version_service import create_version_snapshot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["documents"])


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


_PERMISSION_RANK = {"view": 0, "comment": 1, "edit": 2}


def _section_room_id(project_id: int, document_id: int, section_id: int) -> str:
    return f"project:{project_id}:document:{document_id}:section:{section_id}"


async def _document_permission_for_user(
    db: AsyncSession,
    project: Project,
    document_id: int,
    user_id: int,
) -> str:
    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    member = member_res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Project not found")

    if member.role == OrgMemberRole.ADMIN or project.created_by == user_id:
        return "edit"

    share_res = await db.execute(
        select(DocumentShare).where(
            DocumentShare.document_id == document_id,
            DocumentShare.user_id == user_id,
            DocumentShare.revoked_at.is_(None),
        )
    )
    share = share_res.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Document not found")

    if share.permission == DocumentSharePermission.EDIT:
        return "edit"
    if share.permission == DocumentSharePermission.COMMENT:
        return "comment"
    return "view"


def _liveblocks_permissions(permission: str, *, approved: bool) -> list[str]:
    if permission == "edit" and not approved:
        return [
            "room:presence:write",
            "room:write",
            "comments:write",
        ]
    if permission in {"edit", "comment"}:
        return ["room:read", "room:presence:write", "comments:write"]
    return ["room:read", "room:presence:write", "comments:read"]


async def _authorize_liveblocks_session(
    *,
    room_id: str,
    user: User,
    permission: str,
    project: Project,
    approved: bool,
) -> tuple[int, str]:
    if not settings.LIVEBLOCKS_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Liveblocks is not configured",
        )

    body = {
        "userId": str(user.id),
        "permissions": {
            room_id: _liveblocks_permissions(permission, approved=approved),
        },
        "userInfo": {
            "name": user.name or user.email,
            "email": user.email,
            "avatar": user.avatar_url,
            "permission": permission,
        },
        "organizationId": str(project.org_id),
    }
    url = f"{settings.LIVEBLOCKS_API_BASE_URL.rstrip('/')}/v2/authorize-user"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=body,
                headers={
                    "Authorization": f"Bearer {settings.LIVEBLOCKS_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Liveblocks authorization failed",
        ) from exc

    return response.status_code, response.text


async def _get_document_for_project(
    db: AsyncSession,
    project_id: int,
    document_id: int,
) -> Document:
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id, Document.project_id == project_id)
        .options(selectinload(Document.sections), selectinload(Document.template))
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def _active_sections(document: Document) -> list[Section]:
    return [
        section
        for section in document.sections
        if section.lifecycle_status == LifecycleStatus.ACTIVE
    ]


def _derive_document_status(document: Document) -> str:
    sections = _active_sections(document)
    if document.status == DocumentStatus.IN_REVIEW:
        return "in_review"
    if document.status == DocumentStatus.APPROVED:
        return "approved"
    if not sections:
        return "empty"
    if any(section.has_failed for section in sections):
        return "failed"
    if any(section.is_generating for section in sections):
        return "generating"
    if any(section.needs_input or section.status == SectionStatus.NEEDS_INPUT for section in sections):
        return "needs_input"
    if any(section.is_potentially_stale for section in sections):
        return "potentially_stale"
    if all(
        section.content_lifecycle == SectionContentLifecycle.REVIEWED
        or section.status == SectionStatus.FINALIZED
        for section in sections
    ):
        return "reviewed"
    if any(
        section.content_lifecycle == SectionContentLifecycle.GENERATED_DRAFT
        or section.status == SectionStatus.DRAFT
        for section in sections
    ):
        return "draft"
    return "not_started"


def _derive_freshness(document: Document) -> str:
    if document.freshness_state:
        return document.freshness_state
    if any(section.is_potentially_stale for section in _active_sections(document)):
        return "potentially_stale"
    return "fresh"


def _document_progress(document: Document) -> DocumentProgressResponse:
    sections = _active_sections(document)
    reviewed = sum(
        1
        for section in sections
        if section.content_lifecycle == SectionContentLifecycle.REVIEWED
        or section.status == SectionStatus.FINALIZED
    )
    generated = sum(
        1
        for section in sections
        if section.content_lifecycle
        in [SectionContentLifecycle.GENERATED_DRAFT, SectionContentLifecycle.REVIEWED]
        or section.status in [SectionStatus.DRAFT, SectionStatus.FINALIZED]
    )
    pct = round(reviewed / len(sections) * 100, 1) if sections else 0.0
    return DocumentProgressResponse(
        total_sections=len(sections),
        reviewed_sections=reviewed,
        generated_sections=generated,
        pct=pct,
    )


def _last_activity_at(document: Document) -> datetime:
    timestamps = [document.updated_at]
    timestamps.extend(section.updated_at for section in _active_sections(document))
    return max(ts for ts in timestamps if ts is not None)


def _template_response(template: Template | None) -> TemplateResponse | None:
    if template is None:
        return None
    return TemplateResponse.model_validate(template)


def _template_print_profile(template: Template | None) -> dict | None:
    if template is None:
        return None
    profile = template.recommended_print_profile
    return dict(profile) if isinstance(profile, dict) else None


def _recommendation_to_response(recommendation) -> TemplateRecommendationResponse:
    return TemplateRecommendationResponse(
        id=recommendation.id,
        document_id=recommendation.document_id,
        analysis_id=recommendation.analysis_id,
        template_id=recommendation.template_id,
        basis=recommendation.basis.value,
        score=recommendation.score,
        explanation=recommendation.explanation,
        supporting_facts=recommendation.supporting_facts_json or {},
        provider_usage_ref=recommendation.provider_usage_ref,
        template=_template_response(recommendation.template),
        created_at=recommendation.created_at,
    )


def _outline_proposal_to_response(proposal: OutlineProposal) -> OutlineProposalResponse:
    return OutlineProposalResponse(
        id=proposal.id,
        document_id=proposal.document_id,
        analysis_id=proposal.analysis_id,
        basis=proposal.basis.value,
        status=proposal.status.value,
        version=proposal.version,
        outline=proposal.outline_json,
        explanation=proposal.explanation_json,
        approved_by=proposal.approved_by,
        approved_at=proposal.approved_at,
        approval_metadata=proposal.approval_metadata,
        superseded_at=proposal.superseded_at,
        created_at=proposal.created_at,
    )


def _clarification_to_response(request: ClarificationRequest) -> ClarificationRequestResponse:
    return ClarificationRequestResponse(
        id=request.id,
        document_id=request.document_id,
        outline_proposal_id=request.outline_proposal_id,
        section_id=request.section_id,
        question=request.question,
        affected_sections=request.affected_sections_json or [],
        confidence_tradeoff=request.confidence_tradeoff,
        status=request.status.value,
        user_answer=request.user_answer,
        created_at=request.created_at,
        resolved_at=request.resolved_at,
        skipped_at=request.skipped_at,
    )


def _task_to_response(task: GenerationSectionTask) -> GenerationSectionTaskResponse:
    return GenerationSectionTaskResponse(
        id=task.id,
        generation_run_id=task.generation_run_id,
        section_id=task.section_id,
        status=task.status.value,
        dependency_section_ids=task.dependency_section_ids or [],
        actual_provider=task.actual_provider,
        actual_model=task.actual_model,
        prompt_tokens=task.prompt_tokens,
        completion_tokens=task.completion_tokens,
        cost=task.cost,
        error_message=task.error_message,
        task_metadata=task.task_metadata,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


def _generation_run_to_response(run: GenerationRun) -> GenerationRunResponse:
    return GenerationRunResponse(
        id=run.id,
        document_id=run.document_id,
        mode=GenerationModeEnum(run.mode.value),
        intended_provider=run.intended_provider,
        intended_model=run.intended_model,
        status=run.status.value,
        failover_state=run.failover_state.value,
        estimated_prompt_tokens=run.estimated_prompt_tokens,
        estimated_completion_tokens=run.estimated_completion_tokens,
        estimated_cost=run.estimated_cost,
        actual_prompt_tokens=run.actual_prompt_tokens,
        actual_completion_tokens=run.actual_completion_tokens,
        actual_cost=run.actual_cost,
        error_message=run.error_message,
        run_metadata=run.run_metadata,
        section_tasks=[_task_to_response(task) for task in sorted(run.section_tasks, key=lambda item: item.id)],
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _ai_work_run_to_response(run) -> AIWorkRunResponse:
    return AIWorkRunResponse.model_validate(ai_work_service.run_to_response(run))


def _ai_change_to_response(change) -> AIProposedChangeResponse:
    return AIProposedChangeResponse.model_validate(ai_work_service.change_to_response(change))


def _document_to_response(document: Document) -> DocumentResponse:
    return DocumentResponse(
        id=document.id,
        project_id=document.project_id,
        title=document.title,
        setup_stage=document.setup_stage.value,
        status=_derive_document_status(document),
        freshness=_derive_freshness(document),
        progress=_document_progress(document),
        tags=document.tags or [],
        template=_template_response(document.template),
        template_id=document.template_id,
        purpose=document.purpose,
        audience=document.audience,
        context=document.context,
        export_settings=document.export_settings,
        print_profile=document.print_profile,
        custom_outline_metadata=document.custom_outline_metadata,
        last_activity_at=_last_activity_at(document),
        reviewer_id=document.reviewer_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _active_section_for_document(document: Document, section_id: int) -> Section:
    section = next(
        (
            candidate
            for candidate in document.sections
            if candidate.id == section_id and candidate.lifecycle_status == LifecycleStatus.ACTIVE
        ),
        None,
    )
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


@router.get("/{project_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document)
        .where(Document.project_id == project.id)
        .options(selectinload(Document.sections), selectinload(Document.template))
        .order_by(Document.updated_at.desc())
    )
    documents = [_document_to_response(document) for document in result.scalars().all()]
    return DocumentListResponse(documents=documents, total=len(documents))


@router.post("/{project_id}/documents", status_code=status.HTTP_201_CREATED, response_model=DocumentResponse)
async def create_document(
    body: DocumentCreateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.template_id is not None:
        template = await db.get(Template, body.template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
    else:
        template = None

    document = Document(
        project_id=project.id,
        title=body.title,
        template_id=body.template_id,
        purpose=body.purpose,
        audience=body.audience,
        context=body.context,
        setup_stage=DocumentSetupStage(body.setup_stage.value),
        tags=body.tags,
        export_settings=body.export_settings,
        print_profile=body.print_profile or _template_print_profile(template),
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    await activity_service.record_event(
        db,
        project_id=project.id,
        document_id=document.id,
        event_type="document_created",
        message=f"Created document \"{document.title}\"",
        payload={"document_id": document.id, "setup_stage": body.setup_stage.value},
    )
    await db.commit()

    return await _load_document_response(db, project.id, document.id)


@router.get("/{project_id}/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _document_to_response(document)


@router.patch("/{project_id}/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    body: DocumentUpdateRequest,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.template_id is not None:
        template = await db.get(Template, body.template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        document.template_id = body.template_id
        if document.print_profile is None:
            document.print_profile = _template_print_profile(template)
    if body.title is not None:
        document.title = body.title
    if body.purpose is not None:
        document.purpose = body.purpose
    if body.audience is not None:
        document.audience = body.audience
    if body.context is not None:
        document.context = body.context
    if body.setup_stage is not None:
        document.setup_stage = DocumentSetupStage(body.setup_stage.value)
    if body.tags is not None:
        document.tags = body.tags
    if body.export_settings is not None:
        document.export_settings = body.export_settings
    if body.print_profile is not None:
        document.print_profile = body.print_profile
    if body.custom_outline_metadata is not None:
        document.custom_outline_metadata = body.custom_outline_metadata

    document.updated_at = _utcnow()
    await db.commit()

    project = await db.get(Project, document.project_id)
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=project.org_id if project else None,
        action="update_document",
        resource=f"document:{document.id}:project:{document.project_id}",
    ))
    await db.commit()

    return await _load_document_response(db, document.project_id, document.id)


@router.delete("/{project_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        ActivityEvent.__table__.update()
        .where(ActivityEvent.document_id == document.id)
        .values(document_id=None)
    )
    await db.delete(document)
    project = await db.get(Project, document.project_id)
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=project.org_id if project else None,
        action="delete_document",
        resource=f"document:{document.id}:project:{document.project_id}",
    ))
    await db.commit()
    return None


@router.get(
    "/{project_id}/documents/{document_id}/setup",
    response_model=DocumentSetupStateResponse,
)
async def get_document_setup_state(
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recommendations = await template_recommendation_service.list_recommendations(db, document.id)
    proposals = await template_recommendation_service.list_outline_proposals(db, document.id)
    clarification_result = await db.execute(
        select(ClarificationRequest)
        .where(ClarificationRequest.document_id == document.id)
        .order_by(ClarificationRequest.created_at.desc())
    )
    sections = [
        {
            "id": section.id,
            "heading": section.heading,
            "order_index": section.order_index,
            "content_lifecycle": section.content_lifecycle.value,
            "status": section.status.value,
        }
        for section in sorted(_active_sections(document), key=lambda section: section.order_index)
    ]
    return DocumentSetupStateResponse(
        document=_document_to_response(document),
        recommendations=[_recommendation_to_response(item) for item in recommendations],
        outline_proposals=[_outline_proposal_to_response(item) for item in proposals],
        clarification_requests=[
            _clarification_to_response(item) for item in clarification_result.scalars().all()
        ],
        sections=sections,
    )


@router.get(
    "/{project_id}/documents/{document_id}/template-recommendations",
    response_model=TemplateRecommendationListResponse,
)
async def list_template_recommendations(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    recommendations = await template_recommendation_service.list_recommendations(db, document.id)
    return TemplateRecommendationListResponse(
        recommendations=[_recommendation_to_response(item) for item in recommendations]
    )


@router.post(
    "/{project_id}/documents/{document_id}/template-recommendations",
    response_model=TemplateRecommendationListResponse,
)
async def create_template_recommendations(
    document_id: int,
    body: TemplateRecommendationRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    if body.basis.value == TemplateRecommendationBasis.RULE_BASED.value:
        recommendations = await template_recommendation_service.create_rule_based_recommendations(
            db,
            document,
            refresh=body.refresh,
        )
    elif body.basis.value == TemplateRecommendationBasis.AI_PERSONALIZED.value:
        recommendations = await template_recommendation_service.create_ai_personalized_recommendation(
            db,
            document,
            current_user.id,
            refresh=body.refresh,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Custom Outline seeded recommendations are created with an Outline Proposal.",
        )
    return TemplateRecommendationListResponse(
        recommendations=[_recommendation_to_response(item) for item in recommendations]
    )


@router.get(
    "/{project_id}/documents/{document_id}/outline-proposals",
    response_model=OutlineProposalListResponse,
)
async def list_outline_proposals(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    proposals = await template_recommendation_service.list_outline_proposals(db, document.id)
    return OutlineProposalListResponse(
        proposals=[_outline_proposal_to_response(item) for item in proposals]
    )


@router.post(
    "/{project_id}/documents/{document_id}/outline-proposals",
    status_code=status.HTTP_201_CREATED,
    response_model=OutlineProposalResponse,
)
async def create_outline_proposal(
    document_id: int,
    body: OutlineProposalCreateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    proposal = await template_recommendation_service.create_outline_proposal(
        db,
        document,
        template_id=body.template_id,
        outline=body.outline,
        basis=OutlineProposalBasis(body.basis.value),
        explanation=body.explanation,
        user_id=current_user.id,
    )
    return _outline_proposal_to_response(proposal)


async def _get_outline_proposal_for_document(
    db: AsyncSession,
    document_id: int,
    proposal_id: int,
) -> OutlineProposal:
    result = await db.execute(
        select(OutlineProposal).where(
            OutlineProposal.id == proposal_id,
            OutlineProposal.document_id == document_id,
        )
    )
    proposal = result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(status_code=404, detail="Outline Proposal not found")
    return proposal


@router.patch(
    "/{project_id}/documents/{document_id}/outline-proposals/{proposal_id}",
    response_model=OutlineProposalResponse,
)
async def update_outline_proposal(
    document_id: int,
    proposal_id: int,
    body: OutlineProposalUpdateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_document_for_project(db, project.id, document_id)
    proposal = await _get_outline_proposal_for_document(db, document_id, proposal_id)
    proposal = await template_recommendation_service.update_draft_outline_proposal(
        db,
        proposal,
        outline=body.outline,
        explanation=body.explanation,
    )
    return _outline_proposal_to_response(proposal)


@router.post(
    "/{project_id}/documents/{document_id}/outline-proposals/{proposal_id}/approve",
    response_model=OutlineProposalResponse,
)
async def approve_outline_proposal(
    document_id: int,
    proposal_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    proposal = await _get_outline_proposal_for_document(db, document.id, proposal_id)
    proposal = await template_recommendation_service.approve_outline_proposal(
        db,
        document,
        proposal,
        current_user.id,
    )

    await activity_service.record_event(
        db,
        project_id=project.id,
        document_id=document.id,
        event_type="outline_approved",
        message=f"Approved outline for \"{document.title}\"",
        payload={"proposal_id": proposal.id, "section_count": len(proposal.outline_json or [])},
    )
    await db.commit()

    return _outline_proposal_to_response(proposal)


@router.post(
    "/{project_id}/documents/{document_id}/outline-proposals/{proposal_id}/clarification-requests",
    status_code=status.HTTP_201_CREATED,
    response_model=ClarificationRequestResponse,
)
async def create_outline_clarification_request(
    document_id: int,
    proposal_id: int,
    body: ClarificationRequestCreateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    proposal = await _get_outline_proposal_for_document(db, document.id, proposal_id)
    request = await template_recommendation_service.create_clarification_request(
        db,
        document,
        proposal,
        question=body.question,
        affected_sections=body.affected_sections,
        confidence_tradeoff=body.confidence_tradeoff,
    )
    return _clarification_to_response(request)


@router.post(
    "/{project_id}/documents/{document_id}/clarification-requests/{request_id}/skip",
    response_model=ClarificationRequestResponse,
)
async def skip_outline_clarification_request(
    document_id: int,
    request_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_document_for_project(db, project.id, document_id)
    result = await db.execute(
        select(ClarificationRequest).where(
            ClarificationRequest.id == request_id,
            ClarificationRequest.document_id == document_id,
        )
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=404, detail="Clarification Request not found")
    request = await template_recommendation_service.skip_clarification_request(db, request)
    return _clarification_to_response(request)


def _extract_json_object(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned invalid editor action JSON") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="AI editor action must be a JSON object")
    return data


async def _latest_analysis_for_project(db: AsyncSession, project_id: int):
    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _project_for_editor_action(db: AsyncSession, project_id: int) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _section_for_editor_action(db: AsyncSession, document_id: int, section_id: int | None) -> Section | None:
    if section_id is None:
        return None
    result = await db.execute(
        select(Section).where(
            Section.id == section_id,
            Section.document_id == document_id,
            Section.lifecycle_status == LifecycleStatus.ACTIVE,
        )
    )
    return result.scalar_one_or_none()


def _editor_action_system_prompt(project: Project, document: Document, sections: list[Section], analysis_detail: dict) -> str:
    section_list = "\n".join(
        f"- {section.id}: {section.heading} ({len(section.content_md or '')} chars)"
        for section in sorted(sections, key=lambda item: (item.order_index, item.id))
    )
    source_files = ", ".join(analysis_detail.get("source_files", [])[:20])
    return "\n".join([
        "You are Pagemark's in-editor documentation assistant.",
        "The user is editing a structured document inside Pagemark, not asking for instructions about external files.",
        "When the user asks to insert, replace, append, rewrite, rename, or create documentation content, return a typed editor action.",
        "Never tell the user to copy and paste into README.md, docs files, or another editor when an editor action can be proposed.",
        "Return only one JSON object and no markdown fence.",
        "",
        "Allowed JSON shapes:",
        '{"action":"answer","message":"concise answer"}',
        '{"action":"ask_user","message":"one targeted clarification"}',
        '{"action":"insert_at_cursor","section_id":123,"title":"Insert paragraph","content_md":"markdown to insert","rationale":"why"}',
        '{"action":"replace_selection","section_id":123,"title":"Replace selection","content_md":"replacement markdown","rationale":"why"}',
        '{"action":"rewrite_section","section_id":123,"title":"Rewrite section","content_md":"full replacement markdown","rationale":"why"}',
        '{"action":"append_to_section","section_id":123,"title":"Append to section","content_md":"markdown to append","rationale":"why"}',
        '{"action":"rename_section","section_id":123,"title":"Rename section","heading":"New heading","rationale":"why"}',
        '{"action":"add_section","title":"Add section","heading":"New heading","content_md":"markdown content","order_index":4,"parent_id":null,"rationale":"why"}',
        "",
        f"Project: {project.name}",
        f"Document id: {document.id}",
        f"Detected languages: {analysis_detail.get('languages', '')}",
        f"File count: {analysis_detail.get('file_count', 0)}",
        f"Source files: {source_files}",
        "",
        "Sections:",
        section_list or "- No sections",
    ])


def _editor_action_user_prompt(body: AIChatActionRequest, target_section: Section | None, references: list[Section]) -> str:
    parts = [
        f"Mode: {body.mode}",
        f"User request: {body.message}",
    ]
    if target_section is not None:
        parts += [
            "",
            f"Active section id: {target_section.id}",
            f"Active section heading: {target_section.heading}",
            "Active section markdown:",
            target_section.content_md or "",
        ]
    if body.selection is not None:
        parts += [
            "",
            f"Selection section id: {body.selection.section_id}",
            f"Selection range: {body.selection.from_pos}..{body.selection.to_pos}",
            "Selected text:",
            body.selection.text,
        ]
    if references:
        parts.append("\nReferenced sections:")
        for section in references:
            parts.append(f"## {section.heading}\n{section.content_md or ''}")
    return "\n".join(parts)


def _document_context_block(document: Document, sections: list[Section]) -> str:
    lines = [
        "## Attached Document Context",
        f"Title: {document.title}",
    ]
    if document.purpose:
        lines.append(f"Purpose: {document.purpose}")
    if document.audience:
        lines.append(f"Audience: {document.audience}")
    if document.context:
        lines.append(f"Context: {document.context}")
    lines.append("Sections:")
    for section in sorted(sections, key=lambda item: (item.order_index, item.id)):
        content = (section.content_md or "").strip()
        excerpt = content[:1200] + ("..." if len(content) > 1200 else "")
        lines.append(f"### {section.heading}\n{excerpt or '(empty)'}")
    return "\n".join(lines)


def _source_context_block(analysis_detail: dict) -> str:
    parts = [
        "## Attached Source Analysis",
        f"Languages: {analysis_detail.get('languages', '')}",
        f"File count: {analysis_detail.get('file_count', 0)}",
        f"Complexity notes: {analysis_detail.get('complexity_notes', '')}",
    ]
    source_files = analysis_detail.get("source_files", [])
    if source_files:
        parts.append("Source files: " + ", ".join(str(path) for path in source_files[:30]))
    endpoints = analysis_detail.get("endpoints", [])
    if endpoints:
        parts.append("Endpoints: " + ", ".join(str(endpoint) for endpoint in endpoints[:20]))
    classes = analysis_detail.get("classes", [])
    if classes:
        parts.append("Classes: " + json.dumps(classes[:10]))
    functions = analysis_detail.get("functions", [])
    if functions:
        parts.append("Functions: " + json.dumps(functions[:10]))
    return "\n".join(parts)


def _template_context_block(template: Template | None) -> str | None:
    if template is None:
        return None
    parts = [
        "## Attached Document Template",
        f"Name: {template.name}",
    ]
    for label, value in [
        ("Purpose", template.purpose),
        ("Audience", template.intended_audience),
        ("Expected outcome", template.expected_outcome),
        ("Guidance", template.guidance),
        ("System prompt", template.system_prompt),
    ]:
        if value:
            parts.append(f"{label}: {value}")
    if template.sections_json:
        parts.append("Sections: " + json.dumps(template.sections_json)[:2000])
    return "\n".join(parts)


async def _resource_context_blocks(db: AsyncSession, project_id: int, resource_ids: list[int]) -> list[str]:
    if not resource_ids:
        return []
    result = await db.execute(
        select(Resource).where(Resource.project_id == project_id, Resource.id.in_(resource_ids))
    )
    resources = list(result.scalars().all())
    blocks: list[str] = []
    for resource in resources:
        text = (resource.extracted_text or "").strip()
        if not text:
            continue
        excerpt = text[:3000] + ("..." if len(text) > 3000 else "")
        blocks.append(f"## Attached Resource: {resource.original_name}\n{excerpt}")
    return blocks


async def _editor_reference_context_blocks(
    db: AsyncSession,
    document: Document,
    body: AIChatActionRequest,
    analysis_detail: dict,
) -> list[str]:
    sections = list(document.sections or [])
    blocks: list[str] = []
    ref_types = {ref.type for ref in body.references}
    ref_labels = {str(ref.label or ref.id or "") for ref in body.references}

    if "document" in ref_types or "current-document" in ref_labels:
        blocks.append(_document_context_block(document, sections))
    if "source" in ref_types or "repository-source" in ref_labels:
        blocks.append(_source_context_block(analysis_detail))
    if "template" in ref_types or "document-template" in ref_labels:
        template = await db.get(Template, document.template_id) if document.template_id else None
        template_block = _template_context_block(template)
        if template_block:
            blocks.append(template_block)
    blocks.extend(await _resource_context_blocks(db, document.project_id, body.resource_ids))
    return blocks


def _change_from_editor_action(data: dict, document: Document, target_section: Section | None) -> AIProposedChangeCreate | None:
    action = str(data.get("action") or "").strip()
    title = str(data.get("title") or action.replace("_", " ").title() or "AI editor action")
    rationale = data.get("rationale")
    if action in {"rewrite_section", "append_to_section"}:
        section_id = int(data.get("section_id") or (target_section.id if target_section else 0))
        section = next((item for item in document.sections if item.id == section_id), None)
        if section is None:
            raise HTTPException(status_code=400, detail="AI action targeted an unknown section")
        content = str(data.get("content_md") or data.get("content") or "")
        if action == "append_to_section":
            content = f"{(section.content_md or '').rstrip()}\n\n{content.strip()}".strip()
        return AIProposedChangeCreate(
            change_type=AIProposedChangeTypeEnum.REWRITE_SELECTION,
            title=title,
            section_id=section.id,
            rationale=rationale,
            before={"content_md": section.content_md or ""},
            after={"content_md": content},
            preview_markdown=content,
        )
    if action == "rename_section":
        section_id = int(data.get("section_id") or (target_section.id if target_section else 0))
        section = next((item for item in document.sections if item.id == section_id), None)
        if section is None:
            raise HTTPException(status_code=400, detail="AI action targeted an unknown section")
        heading = str(data.get("heading") or data.get("new_heading") or "").strip()
        if not heading:
            raise HTTPException(status_code=400, detail="AI rename action did not include a heading")
        return AIProposedChangeCreate(
            change_type=AIProposedChangeTypeEnum.RENAME_SECTION,
            title=title,
            section_id=section.id,
            rationale=rationale,
            before={"heading": section.heading, "title": section.title},
            after={"heading": heading},
            preview_markdown=f"# {heading}",
        )
    if action in {"add_section", "add_section_with_content"}:
        heading = str(data.get("heading") or data.get("new_heading") or data.get("title") or "").strip()
        if not heading:
            raise HTTPException(status_code=400, detail="AI add-section action did not include a heading")
        content = str(data.get("content_md") or data.get("content") or "")
        return AIProposedChangeCreate(
            change_type=AIProposedChangeTypeEnum.ADD_SECTION,
            title=title,
            section_id=None,
            rationale=rationale,
            before=None,
            after={
                "heading": heading,
                "content_md": content,
                "order_index": int(data.get("order_index") or len(document.sections or [])),
                "parent_id": data.get("parent_id"),
            },
            preview_markdown=content or f"# {heading}",
        )
    return None


@router.post(
    "/{project_id}/documents/{document_id}/ai/chat-actions",
    response_model=AIChatActionResponse,
)
async def create_ai_chat_action(
    body: AIChatActionRequest,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await _project_for_editor_action(db, document.project_id)
    credential = await ai_credential_service.get_active_credential(db, current_user.id)
    if credential is None:
        raise HTTPException(status_code=400, detail="No active AI credential. Add an AI provider in Settings.")

    await db.refresh(document, attribute_names=["sections"])
    target_section = await _section_for_editor_action(db, document.id, body.target_section_id)
    if target_section is None and body.selection is not None:
        target_section = await _section_for_editor_action(db, document.id, body.selection.section_id)

    referenced_sections: list[Section] = []
    section_ref_ids = [ref.id for ref in body.references if ref.type == "section" and ref.id is not None]
    if section_ref_ids:
        result = await db.execute(
            select(Section).where(
                Section.document_id == document.id,
                Section.id.in_(section_ref_ids),
                Section.lifecycle_status == LifecycleStatus.ACTIVE,
            )
        )
        referenced_sections = list(result.scalars().all())

    analysis = await _latest_analysis_for_project(db, document.project_id)
    analysis_detail = ai_service._analysis_detail(analysis)
    system_prompt = _editor_action_system_prompt(project, document, list(document.sections or []), analysis_detail)
    user_prompt = _editor_action_user_prompt(body, target_section, referenced_sections)
    context_blocks = await _editor_reference_context_blocks(db, document, body, analysis_detail)
    if context_blocks:
        user_prompt = f"{user_prompt}\n\n" + "\n\n".join(context_blocks)

    try:
        raw = complete_text(
            system_prompt,
            user_prompt,
            credential.provider,
            credential.api_key,
            body.model_name or credential.model_id,
            max_tokens=2400,
        )
    except AiServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    data = _extract_json_object(raw)
    action = str(data.get("action") or "answer")
    message = str(data.get("message") or data.get("rationale") or "")
    if action in {"answer", "ask_user", "insufficient_context"}:
        return AIChatActionResponse(message=message, action=action, work_run=None)
    if action in {"insert_at_cursor", "replace_selection"}:
        section_id = data.get("section_id") or (target_section.id if target_section else None)
        content = str(data.get("content_md") or data.get("content") or "")
        if not section_id:
            raise HTTPException(status_code=400, detail="AI editor action requires a section_id")
        if not content.strip():
            raise HTTPException(status_code=400, detail="AI editor action requires content_md")
        return AIChatActionResponse(
            message=message or data.get("rationale") or str(data.get("title") or "AI prepared an editor action."),
            action=action,
            action_payload={
                "title": str(data.get("title") or action.replace("_", " ").title()),
                "section_id": int(section_id),
                "content_md": content,
                "rationale": data.get("rationale"),
            },
            work_run=None,
        )

    change = _change_from_editor_action(data, document, target_section)
    if change is None:
        return AIChatActionResponse(message=message or raw, action="answer", work_run=None)

    work_run = await ai_work_service.create_work_run(
        db,
        document,
        AIWorkRunCreateRequest(
            provider=credential.provider,
            model=body.model_name or credential.model_id,
            prompt_context={
                "source": "editor_chat_action",
                "message": body.message,
                "mode": body.mode,
                "target_section_id": body.target_section_id,
                "selection": body.selection.model_dump(by_alias=True) if body.selection else None,
                "references": [ref.model_dump() for ref in body.references],
                "analysis_id": getattr(analysis, "id", None),
            },
            changes=[change],
        ),
        current_user.id,
    )
    return AIChatActionResponse(
        message=message or change.rationale or change.title,
        action=action,
        work_run=_ai_work_run_to_response(work_run),
    )


@router.post(
    "/{project_id}/documents/{document_id}/ai/work-runs",
    status_code=status.HTTP_201_CREATED,
    response_model=AIWorkRunResponse,
)
async def create_ai_work_run(
    body: AIWorkRunCreateRequest,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = await ai_work_service.create_work_run(db, document, body, current_user.id)
    return _ai_work_run_to_response(run)


@router.get(
    "/{project_id}/documents/{document_id}/ai/work-runs",
    response_model=AIWorkRunListResponse,
)
async def list_ai_work_runs(
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    runs = await ai_work_service.list_work_runs(db, document.id)
    return AIWorkRunListResponse(work_runs=[_ai_work_run_to_response(run) for run in runs])


@router.get(
    "/{project_id}/documents/{document_id}/ai/proposed-changes",
    response_model=AIProposedChangeListResponse,
)
async def list_ai_proposed_changes(
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    changes = await ai_work_service.list_changes(db, document.id)
    return AIProposedChangeListResponse(
        proposed_changes=[_ai_change_to_response(change) for change in changes]
    )


@router.get(
    "/{project_id}/documents/{document_id}/ai/proposed-changes/{change_id}/preview",
    response_model=AIProposedChangePreviewResponse,
)
async def preview_ai_proposed_change(
    change_id: int,
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    change = await ai_work_service.get_change(db, document.id, change_id)
    return AIProposedChangePreviewResponse(
        change=_ai_change_to_response(change),
        preview=ai_work_service.preview_change(change),
    )


@router.post(
    "/{project_id}/documents/{document_id}/ai/proposed-changes/{change_id}/accept",
    response_model=AIProposedChangeResponse,
)
async def accept_ai_proposed_change(
    change_id: int,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    change = await ai_work_service.get_change(db, document.id, change_id)
    accepted = await ai_work_service.accept_change(db, document, change, current_user.id)
    return _ai_change_to_response(accepted)


@router.post(
    "/{project_id}/documents/{document_id}/ai/proposed-changes/{change_id}/reject",
    response_model=AIProposedChangeResponse,
)
async def reject_ai_proposed_change(
    change_id: int,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    change = await ai_work_service.get_change(db, document.id, change_id)
    rejected = await ai_work_service.reject_change(db, document, change, current_user.id)
    return _ai_change_to_response(rejected)


@router.post(
    "/{project_id}/documents/{document_id}/ai/work-runs/{run_id}/undo",
    response_model=AIWorkRunResponse,
)
async def undo_ai_work_run(
    run_id: int,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = await ai_work_service.undo_work_run(db, document, run_id)
    return _ai_work_run_to_response(run)


async def _load_document_response(
    db: AsyncSession,
    project_id: int,
    document_id: int,
) -> DocumentResponse:
    document = await _get_document_for_project(db, project_id, document_id)
    return _document_to_response(document)


@router.post(
    "/{project_id}/documents/{document_id}/generation-estimate",
    response_model=GenerationEstimateResponse,
)
async def estimate_document_generation(
    document_id: int,
    body: GenerationEstimateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    active = await ai_credential_service.get_active_credential(db, current_user.id)
    if active is None:
        raise HTTPException(status_code=400, detail="Active provider credential required for generation estimates.")
    estimate = await generation_service.estimate_usage(
        db,
        document,
        mode=GenerationMode(body.mode.value),
        section_ids=body.section_ids,
        provider=active.provider,
        model=active.model_id,
    )
    return GenerationEstimateResponse(**estimate)


@router.get(
    "/{project_id}/documents/{document_id}/generation-runs",
    response_model=GenerationRunListResponse,
)
async def list_document_generation_runs(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_document_for_project(db, project.id, document_id)
    runs = await generation_service.list_generation_runs(db, document_id)
    return GenerationRunListResponse(
        generation_runs=[_generation_run_to_response(run) for run in runs]
    )


@router.post(
    "/{project_id}/documents/{document_id}/generation-runs",
    status_code=status.HTTP_201_CREATED,
    response_model=GenerationRunResponse,
)
async def create_document_generation_run(
    document_id: int,
    body: GenerationRunCreateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    run = await generation_service.create_generation_run(
        db,
        document,
        user_id=current_user.id,
        mode=GenerationMode(body.mode.value),
        section_ids=body.section_ids,
    )

    await activity_service.record_event(
        db,
        project_id=project.id,
        document_id=document.id,
        event_type="generation_run_started",
        message=f"Generation started for \"{document.title}\"",
        payload={"run_id": run.id, "mode": body.mode.value},
    )
    await db.commit()

    if body.execute:
        run = await generation_service.execute_generation_run(db, run, user_id=current_user.id)
    return _generation_run_to_response(run)


@router.get(
    "/{project_id}/documents/{document_id}/generation-runs/{run_id}",
    response_model=GenerationRunResponse,
)
async def get_document_generation_run(
    document_id: int,
    run_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_document_for_project(db, project.id, document_id)
    run = await generation_service.get_generation_run(db, document_id, run_id)
    return _generation_run_to_response(run)


@router.post(
    "/{project_id}/documents/{document_id}/generation-runs/{run_id}/confirm-failover",
    response_model=GenerationRunResponse,
)
async def confirm_document_generation_failover(
    document_id: int,
    run_id: int,
    body: GenerationFailoverConfirmRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_document_for_project(db, project.id, document_id)
    run = await generation_service.get_generation_run(db, document_id, run_id)
    run = await generation_service.confirm_failover(
        db,
        run,
        user_id=current_user.id,
        provider=body.provider,
        model=body.model,
    )
    return _generation_run_to_response(run)


@router.get("/{project_id}/documents/{document_id}/sections", response_model=SectionTreeResponse)
async def get_document_sections(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    sections = sorted(_active_sections(document), key=lambda section: section.order_index)
    tree = section_service.build_section_tree(sections)
    return SectionTreeResponse(
        document_id=document.id,
        sections=tree,
        status=_derive_document_status(document),
        reviewer_id=document.reviewer_id,
    )


@router.post(
    "/{project_id}/documents/{document_id}/sections",
    status_code=status.HTTP_201_CREATED,
    response_model=SectionResponse,
)
async def create_document_section(
    body: CustomSectionRequest,
    document: Document = Depends(require_document_permission("edit")),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    max_index_res = await db.execute(
        select(func.max(Section.order_index)).where(Section.document_id == document.id)
    )
    max_index = max_index_res.scalar()
    section = Section(
        document_id=document.id,
        order_index=(max_index + 1) if max_index is not None else 0,
        heading=body.title or "Untitled Section",
        title=body.title,
        is_custom=True,
        lifecycle_status=LifecycleStatus.ACTIVE,
        content_md="",
        status=SectionStatus.PENDING,
    )
    db.add(section)
    document.updated_at = _utcnow()
    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)


@router.patch(
    "/{project_id}/documents/{document_id}/sections/{section_id}",
    response_model=SectionResponse,
)
async def update_document_section(
    document_id: int,
    section_id: int,
    body: SectionUpdateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = _active_section_for_document(document, section_id)
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    old_content = section.content_md or ""
    old_status = section.status
    content_changed = False
    status_changed = False

    if body.content_md is not None and body.content_md != (section.content_md or ""):
        content_changed = True
        section.content_md = body.content_md
        section_service.clear_review_state_for_content_edit(section)
    if body.status is not None:
        new_status = SectionStatus(body.status.value)
        if new_status != old_status:
            status_changed = True
            section.status = new_status

    if content_changed or status_changed:
        section.updated_at = _utcnow()
        document.updated_at = _utcnow()
        summary_parts = []
        if content_changed:
            summary_parts.append("Content updated")
        if status_changed:
            summary_parts.append("Status updated")
        await create_version_snapshot(
            db,
            section_id=section.id,
            old_content=old_content,
            new_content=section.content_md or "",
            author_type=AuthorType.USER,
            summary="; ".join(summary_parts) if summary_parts else None,
        )

    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)


@router.patch(
    "/{project_id}/documents/{document_id}/sections/{section_id}/autosave",
    response_model=SectionAutosaveResponse,
)
async def autosave_document_section(
    document_id: int,
    section_id: int,
    body: SectionAutosaveRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = _active_section_for_document(document, section_id)
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    if body.content_md == (section.content_md or ""):
        return SectionAutosaveResponse(saved=False, updated_at=section.updated_at)

    old_content = section.content_md or ""
    section.content_md = body.content_md
    section.updated_at = _utcnow()
    document.updated_at = section.updated_at
    section_service.clear_review_state_for_content_edit(section, edited_at=section.updated_at)
    await create_version_snapshot(
        db,
        section_id=section.id,
        old_content=old_content,
        new_content=section.content_md or "",
        author_type=AuthorType.USER,
        summary="Autosaved content",
    )
    await db.commit()
    await db.refresh(section)

    return SectionAutosaveResponse(saved=True, updated_at=section.updated_at)


@router.post("/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/auth")
async def authorize_section_collaboration(
    document_id: int,
    section_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    _active_section_for_document(document, section_id)
    permission = await _document_permission_for_user(db, project, document.id, current_user.id)
    room_id = _section_room_id(project.id, document.id, section_id)
    liveblocks_status, liveblocks_body = await _authorize_liveblocks_session(
        room_id=room_id,
        user=current_user,
        permission=permission,
        project=project,
        approved=document.status == DocumentStatus.APPROVED,
    )
    if liveblocks_status >= 400:
        logger.error(
            "Liveblocks authorization failed for room %s with status %s: %s",
            room_id,
            liveblocks_status,
            liveblocks_body,
        )
    return Response(
        content=liveblocks_body,
        status_code=liveblocks_status,
        media_type="application/json",
    )


@router.patch(
    "/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/snapshot",
    response_model=SectionAutosaveResponse,
)
async def snapshot_section_collaboration(
    document_id: int,
    section_id: int,
    body: SectionAutosaveRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = _active_section_for_document(document, section_id)
    permission = await _document_permission_for_user(db, project, document.id, current_user.id)
    if _PERMISSION_RANK[permission] < _PERMISSION_RANK["edit"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Edit permission required")
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    if body.content_md == (section.content_md or ""):
        return SectionAutosaveResponse(saved=False, updated_at=section.updated_at)

    old_content = section.content_md or ""
    section.content_md = body.content_md
    section.updated_at = _utcnow()
    document.updated_at = section.updated_at
    section_service.clear_review_state_for_content_edit(section, edited_at=section.updated_at)
    await create_version_snapshot(
        db,
        section_id=section.id,
        old_content=old_content,
        new_content=section.content_md or "",
        author_type=AuthorType.USER,
        summary="Collaborative snapshot",
    )
    await db.commit()
    await db.refresh(section)

    return SectionAutosaveResponse(saved=True, updated_at=section.updated_at)


@router.put(
    "/{project_id}/documents/{document_id}/sections/{section_id}/title",
    response_model=SectionResponse,
)
async def update_document_section_title(
    document_id: int,
    section_id: int,
    body: SectionTitleRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = _active_section_for_document(document, section_id)
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    section.heading = body.title
    section.title = body.title
    section.updated_at = _utcnow()
    document.updated_at = section.updated_at
    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)


@router.put("/{project_id}/documents/{document_id}/sections/reorder")
async def reorder_document_sections(
    document_id: int,
    body: SectionReorderRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    active_by_id = {section.id: section for section in _active_sections(document)}
    requested_ids = list(body.section_ids)
    if len(requested_ids) != len(set(requested_ids)):
        raise HTTPException(status_code=400, detail="Section IDs must be unique")
    missing_ids = [section_id for section_id in requested_ids if section_id not in active_by_id]
    if missing_ids:
        raise HTTPException(status_code=404, detail="Section not found")

    for index, section_id in enumerate(requested_ids):
        active_by_id[section_id].order_index = index
        active_by_id[section_id].updated_at = _utcnow()
    document.updated_at = _utcnow()

    await db.commit()
    return {"message": "Sections reordered successfully"}


@router.delete("/{project_id}/documents/{document_id}/sections/{section_id}")
async def delete_document_section(
    document_id: int,
    section_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = _active_section_for_document(document, section_id)
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    section.lifecycle_status = LifecycleStatus.DELETED
    section.updated_at = _utcnow()
    document.updated_at = section.updated_at
    await db.commit()
    return {"message": "Section deleted successfully"}


# ── Freshness Endpoints ──────────────────────────────────────────────


@router.get(
    "/{project_id}/documents/{document_id}/freshness",
)
async def get_document_freshness(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    status = await freshness_service.get_document_freshness_status(db, document.id)
    return status


@router.post(
    "/{project_id}/documents/{document_id}/sections/{section_id}/freshness/accept",
)
async def accept_freshness_update(
    document_id: int,
    section_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = await freshness_service.apply_freshness_update(db, section_id, accept=True)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    await activity_service.record_event(
        db,
        project_id=project.id,
        document_id=document.id,
        event_type="freshness_accepted",
        message=f"Accepted freshness update for \"{document.title}\"",
        payload={"section_id": section_id},
    )
    await db.commit()
    return {"message": "Freshness update accepted", "section_id": section_id}


@router.post(
    "/{project_id}/documents/{document_id}/sections/{section_id}/freshness/reject",
)
async def reject_freshness_update(
    document_id: int,
    section_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    section = await freshness_service.apply_freshness_update(db, section_id, accept=False)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    await activity_service.record_event(
        db,
        project_id=project.id,
        document_id=document.id,
        event_type="freshness_rejected",
        message=f"Rejected freshness update for \"{document.title}\"",
        payload={"section_id": section_id},
    )
    await db.commit()
    return {"message": "Freshness update rejected", "section_id": section_id}
