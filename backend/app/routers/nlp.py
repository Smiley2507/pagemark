from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.nlp import NLPReport
from app.models.organization import OrgMemberRole
from app.schemas.nlp import NLPReportResponse
from app.routers.organizations import _get_membership

router = APIRouter(prefix="/projects", tags=["nlp"])


@router.get("/{project_id}/nlp-report", response_model=NLPReportResponse)
async def get_nlp_report(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await _get_membership(db, project.org_id, current_user.id)

    result = await db.execute(
        select(NLPReport)
        .where(NLPReport.project_id == project_id)
        .order_by(NLPReport.created_at.desc())
        .limit(1)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="No NLP report found for this project")
    return report
