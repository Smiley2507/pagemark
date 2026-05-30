"""
quality.py — API router for quality scoring.

POST /projects/{id}/quality/run   → dispatch Celery task (202)
GET  /projects/{id}/quality       → return latest QualityReport (with issues/links)
GET  /projects/{id}/quality/issues → return QualityIssues filtered by severity
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.quality import QualityReport, QualityIssue, IssueSeverity
from app.schemas.quality import QualityReportOut, QualityIssueOut, QualityRunResponse
from app.workers.quality_worker import score_quality_task

router = APIRouter(prefix="/projects", tags=["quality"])


async def _get_project_or_404(project_id: int, db: AsyncSession, user) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user.id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/{project_id}/quality/run", response_model=QualityRunResponse, status_code=202)
async def run_quality_analysis(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Dispatch the quality scoring Celery task for the project."""
    await _get_project_or_404(project_id, db, current_user)
    score_quality_task.delay(project_id)
    return QualityRunResponse(message="Quality analysis started")


@router.get("/{project_id}/quality", response_model=QualityReportOut)
async def get_quality_report(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the latest QualityReport for a project, including issues and broken links."""
    await _get_project_or_404(project_id, db, current_user)

    result = await db.execute(
        select(QualityReport)
        .options(
            selectinload(QualityReport.issues),
            selectinload(QualityReport.broken_links),
        )
        .where(QualityReport.project_id == project_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=404,
            detail="No quality report found. Run POST /quality/run to generate one.",
        )
    return report


@router.get("/{project_id}/quality/issues", response_model=list[QualityIssueOut])
async def get_quality_issues(
    project_id: int,
    severity: Optional[str] = Query(None, description="Filter by severity: error, warning, info"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return quality issues for the latest report, optionally filtered by severity."""
    await _get_project_or_404(project_id, db, current_user)

    report_result = await db.execute(
        select(QualityReport).where(QualityReport.project_id == project_id)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=404,
            detail="No quality report found. Run POST /quality/run first.",
        )

    query = select(QualityIssue).where(QualityIssue.report_id == report.id)
    if severity:
        try:
            sev_enum = IssueSeverity[severity.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid severity: {severity}. Use error/warning/info")
        query = query.where(QualityIssue.severity == sev_enum)

    result = await db.execute(query.order_by(QualityIssue.severity))
    issues = result.scalars().all()
    return issues
