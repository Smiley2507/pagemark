from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document, DocumentStatus
from app.models.project import Project
from app.models.organization import OrganizationMember, OrgMemberStatus, OrgMemberRole
from app.schemas.section import SectionTreeResponse
from app.services import section_service

router = APIRouter(prefix="/projects", tags=["documents"])


@router.get("/{project_id}/document", response_model=SectionTreeResponse)
async def get_project_document_tree(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await section_service.get_document_for_project(
        db, project_id, current_user.id
    )
    sections = await section_service.list_sections_for_project(
        db, project_id, current_user.id
    )
    tree = section_service.build_section_tree(sections)
    return SectionTreeResponse(document_id=document.id, sections=tree, status=document.status.value)


async def _get_document_and_check_approval(
    db: AsyncSession, project_id: int, user_id: int
) -> Document:
    document = await section_service.get_document_for_project(db, project_id, user_id)
    return document


async def _is_admin_or_pm(db: AsyncSession, org_id: int, user_id: int) -> bool:
    res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
            OrganizationMember.role.in_([OrgMemberRole.ADMIN, OrgMemberRole.PROJECT_MANAGER]),
        )
    )
    return res.scalar_one_or_none() is not None


class SubmitReviewRequest(BaseModel):
    reviewer_id: int


@router.post("/{project_id}/document/submit-review")
async def submit_for_review(
    project_id: int,
    body: SubmitReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_and_check_approval(db, project_id, current_user.id)
    if document.status != DocumentStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT documents can be submitted for review")
    document.status = DocumentStatus.IN_REVIEW
    document.reviewer_id = body.reviewer_id
    await db.commit()
    return {"status": "IN_REVIEW", "reviewer_id": body.reviewer_id}


@router.post("/{project_id}/document/approve")
async def approve_document(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_and_check_approval(db, project_id, current_user.id)
    if document.status != DocumentStatus.IN_REVIEW:
        raise HTTPException(status_code=400, detail="Document is not in review")

    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    is_admin_pm = await _is_admin_or_pm(db, project.org_id, current_user.id) if project else False
    is_reviewer = document.reviewer_id == current_user.id

    if not is_reviewer and not is_admin_pm:
        raise HTTPException(status_code=403, detail="Only the assigned reviewer or an Admin/PM can approve")

    document.status = DocumentStatus.APPROVED
    document.approved_at = datetime.utcnow()
    await db.commit()
    return {"status": "APPROVED", "approved_at": document.approved_at.isoformat() if document.approved_at else None}


@router.post("/{project_id}/document/request-changes")
async def request_changes(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await _get_document_and_check_approval(db, project_id, current_user.id)
    if document.status != DocumentStatus.IN_REVIEW:
        raise HTTPException(status_code=400, detail="Document is not in review")

    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    is_admin_pm = await _is_admin_or_pm(db, project.org_id, current_user.id) if project else False
    is_reviewer = document.reviewer_id == current_user.id

    if not is_reviewer and not is_admin_pm:
        raise HTTPException(status_code=403, detail="Only the assigned reviewer or an Admin/PM can request changes")

    document.status = DocumentStatus.DRAFT
    document.reviewer_id = None
    await db.commit()
    return {"status": "DRAFT"}
