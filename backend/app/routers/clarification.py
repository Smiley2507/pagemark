from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Section, SectionStatus
from app.models.clarification import ClarificationRequest, ClarificationStatus
from app.workers.analysis_worker import resume_generation_task

router = APIRouter(prefix="/clarifications", tags=["clarifications"])

async def verify_section_ownership(section_id: int, current_user: User, db: AsyncSession):
    res = await db.execute(
        select(Section)
        .join(Document)
        .join(Project)
        .join(OrganizationMember, OrganizationMember.org_id == Project.org_id)
        .where(
            Section.id == section_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == "active",
        )
    )
    section = res.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found or access denied")
    return section

@router.get("/{section_id}")
async def get_clarification(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_section_ownership(section_id, current_user, db)
    res = await db.execute(
        select(ClarificationRequest)
        .where(
            ClarificationRequest.section_id == section_id,
            ClarificationRequest.status == ClarificationStatus.PENDING,
        )
        .order_by(ClarificationRequest.created_at.desc())
        .limit(1)
    )
    request = res.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="No pending clarification request found")
    return request

@router.post("/{section_id}/clarify")
async def clarify_section(
    section_id: int,
    answer: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    section = await verify_section_ownership(section_id, current_user, db)

    # Find pending clarification request
    res = await db.execute(
        select(ClarificationRequest)
        .where(
            ClarificationRequest.section_id == section_id,
            ClarificationRequest.status == ClarificationStatus.PENDING,
        )
        .order_by(ClarificationRequest.created_at.desc())
        .limit(1)
    )
    request = res.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="No pending clarification request found")

    # Resolve request
    request.user_answer = answer
    request.status = ClarificationStatus.RESOLVED
    request.resolved_at = datetime.utcnow()

    # Update section status to generating
    section.status = SectionStatus.PENDING

    # Project ID needed for the worker
    doc_res = await db.execute(select(Document).where(Document.id == section.document_id))
    document = doc_res.scalar_one()
    project_id = document.project_id

    await db.commit()

    # Dispatch resume task
    resume_generation_task.delay(
        section_id=section_id,
        answer=answer,
        project_id=project_id,
        user_id=current_user.id,
    )

    return {"status": "resumed", "section_id": section_id}
