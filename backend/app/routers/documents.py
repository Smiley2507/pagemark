from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.document import (
    Document,
    DocumentSetupStage,
    DocumentStatus,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.project import Project
from app.models.template import Template
from app.models.user import User
from app.schemas.document import (
    DocumentCreateRequest,
    DocumentListResponse,
    DocumentProgressResponse,
    DocumentResponse,
    DocumentUpdateRequest,
)
from app.schemas.section import CustomSectionRequest, SectionResponse, SectionTreeResponse, SectionUpdateRequest
from app.schemas.template import TemplateResponse
from app.services import section_service

router = APIRouter(prefix="/projects", tags=["documents"])


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
        custom_outline_metadata=document.custom_outline_metadata,
        last_activity_at=_last_activity_at(document),
        reviewer_id=document.reviewer_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


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
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return await _load_document_response(db, project.id, document.id)


@router.get("/{project_id}/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
    return _document_to_response(document)


@router.patch("/{project_id}/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    body: DocumentUpdateRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)

    if body.template_id is not None:
        template = await db.get(Template, body.template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found")
        document.template_id = body.template_id
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
    if body.custom_outline_metadata is not None:
        document.custom_outline_metadata = body.custom_outline_metadata

    document.updated_at = datetime.utcnow()
    await db.commit()
    return await _load_document_response(db, project.id, document.id)


async def _load_document_response(
    db: AsyncSession,
    project_id: int,
    document_id: int,
) -> DocumentResponse:
    document = await _get_document_for_project(db, project_id, document_id)
    return _document_to_response(document)


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
    document_id: int,
    body: CustomSectionRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_for_project(db, project.id, document_id)
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
    document.updated_at = datetime.utcnow()
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
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    if body.content_md is not None:
        section.content_md = body.content_md
    if body.status is not None:
        section.status = SectionStatus(body.status.value)
    section.updated_at = datetime.utcnow()
    document.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)
