from datetime import datetime
from app.models.time import utcnow

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user, require_section
from app.models.document import Document, Section, DocumentStatus, SectionStatus, LifecycleStatus
from app.models.project import Project
from app.models.organization import OrganizationMember, OrgMemberStatus
from app.models.user import User
from app.authz import DOCUMENT_MANAGE, CONTENT_WRITE, CONTENT_REVIEW, require_capability
from app.models.version import AuthorType
from app.schemas.section import (
    SectionAutosaveRequest,
    SectionAutosaveResponse,
    SectionResponse,
    SectionStatusUpdateRequest,
    SectionStatusUpdateResponse,
    SectionUpdateRequest,
    SectionReorderRequest,
    SectionTitleRequest,
    CustomSectionRequest,
)
from app.services import generation_service
from app.services import section_service
from app.services import activity_service
from app.services.version_service import create_version_snapshot

router = APIRouter(prefix="/sections", tags=["sections"])


async def _recompute_project_for_section(db: AsyncSession, section) -> float:
    doc_result = await db.execute(
        select(Document).where(Document.id == section.document_id)
    )
    document = doc_result.scalar_one()
    return await section_service.recompute_project_completion(db, document.project_id)


@router.get("/{section_id}", response_model=SectionResponse)
async def get_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await section_service.get_section_for_user(db, section_id, current_user.id)
    return section_service.section_to_response(section)


@router.patch("/{section_id}/autosave", response_model=SectionAutosaveResponse)
async def autosave_section(
    section_id: int,
    body: SectionAutosaveRequest,
    section: Section = Depends(require_section(CONTENT_WRITE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc_res = await db.execute(select(Document).where(Document.id == section.document_id))
    document = doc_res.scalar_one()
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    current_content = section.content_md or ""

    if body.content_md == current_content:
        return SectionAutosaveResponse(saved=False, updated_at=section.updated_at)

    section.content_md = body.content_md
    section.updated_at = utcnow()
    section_service.clear_review_state_for_content_edit(section, edited_at=section.updated_at)
    await db.commit()
    await db.refresh(section)

    return SectionAutosaveResponse(saved=True, updated_at=section.updated_at)


@router.patch("/{section_id}", response_model=SectionResponse)
async def update_section(
    section_id: int,
    body: SectionUpdateRequest,
    section: Section = Depends(require_section(CONTENT_WRITE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc_res = await db.execute(select(Document).where(Document.id == section.document_id))
    document = doc_res.scalar_one()
    if document.status == DocumentStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Cannot edit an APPROVED document")

    old_content = section.content_md or ""
    old_status = section.status

    content_changed = False
    status_changed = False

    if body.content_md is not None and body.content_md != old_content:
        content_changed = True
        section.content_md = body.content_md
        section_service.clear_review_state_for_content_edit(section)

    if body.status is not None:
        new_status = SectionStatus(body.status.value)
        if new_status != old_status:
            status_changed = True
            section.status = new_status

    if content_changed or status_changed:
        section.updated_at = utcnow()
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
        await _recompute_project_for_section(db, section)

    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)


@router.patch("/{section_id}/status", response_model=SectionStatusUpdateResponse)
async def update_section_status(
    section_id: int,
    body: SectionStatusUpdateRequest,
    section: Section = Depends(require_section(CONTENT_WRITE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_content = section.content_md or ""
    new_status = SectionStatus(body.status.value)

    if new_status != section.status:
        section.status = new_status
        section.updated_at = utcnow()
        await create_version_snapshot(
            db,
            section_id=section.id,
            old_content=old_content,
            new_content=section.content_md or "",
            author_type=AuthorType.USER,
            summary=f"Status set to {body.status.value}",
        )
        completion_pct = await _recompute_project_for_section(db, section)
    else:
        completion_pct = await _recompute_project_for_section(db, section)

    await db.commit()
    await db.refresh(section)

    return SectionStatusUpdateResponse(
        status=body.status,
        completion_pct=completion_pct,
    )


@router.post("/{section_id}/accept-review", response_model=SectionResponse)
async def accept_section_review(
    section_id: int,
    section: Section = Depends(require_section(CONTENT_REVIEW)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await generation_service.accept_section_review(
        db,
        section,
        user_id=current_user.id,
    )

    await activity_service.record_event(
        db,
        project_id=section.document.project_id,
        document_id=section.document_id,
        event_type="section_reviewed",
        message=f"Reviewed section \"{section.heading}\"",
        payload={"section_id": section.id},
    )
    await db.commit()

    return section_service.section_to_response(section)


@router.put("/reorder")
async def reorder_sections(
    body: SectionReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # No section_id path param here, so each section's document.manage capability
    # is checked individually instead of via the require_section(...) dependency.
    for index, section_id in enumerate(body.section_ids):
        section = await section_service.get_section_for_user(db, section_id, current_user.id)
        doc_res = await db.execute(select(Document).where(Document.id == section.document_id))
        document = doc_res.scalar_one()
        proj_res = await db.execute(select(Project).where(Project.id == document.project_id))
        project = proj_res.scalar_one()
        member_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == project.org_id,
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.status == OrgMemberStatus.ACTIVE,
            )
        )
        require_capability(
            member_res.scalar_one_or_none(), DOCUMENT_MANAGE, project=project, user_id=current_user.id
        )
        section.order_index = index

    await db.commit()
    return {"message": "Sections reordered successfully"}


@router.put("/{section_id}/title", response_model=SectionResponse)
async def update_section_title(
    section_id: int,
    body: SectionTitleRequest,
    section: Section = Depends(require_section(DOCUMENT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section.heading = body.title
    section.title = body.title
    section.updated_at = utcnow()
    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)


@router.delete("/{section_id}")
async def delete_section(
    section_id: int,
    section: Section = Depends(require_section(DOCUMENT_MANAGE)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section.lifecycle_status = LifecycleStatus.DELETED
    await db.commit()
    return {"message": "Section deleted successfully"}
