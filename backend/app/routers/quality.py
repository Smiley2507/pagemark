"""
quality.py — API router for quality scoring.

POST /projects/{project_id}/documents/{document_id}/quality/run   → dispatch Celery task (202)
GET  /projects/{project_id}/documents/{document_id}/quality       → return QualityReport
GET  /projects/{project_id}/documents/{document_id}/quality/issues → return QualityIssues
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.document import Document
from app.models.project import Project
from app.models.quality import QualityReport, QualityIssue, IssueSeverity
from app.schemas.quality import QualityReportOut, QualityIssueOut, QualityRunResponse
from app.workers.quality_worker import score_quality_task

router = APIRouter(prefix="/projects", tags=["quality"])


async def _get_document_or_404(
    project_id: int,
    document_id: int,
    db: AsyncSession,
) -> Document:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.project_id == project_id,
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post(
    "/{project_id}/documents/{document_id}/quality/run",
    response_model=QualityRunResponse,
    status_code=202,
)
async def run_quality_analysis(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Dispatch quality scoring for a Document under an authorized Project."""
    await _get_document_or_404(project.id, document_id, db)
    score_quality_task.delay(project.id)
    return QualityRunResponse(message="Quality analysis started")


@router.get("/{project_id}/documents/{document_id}/quality", response_model=QualityReportOut)
async def get_quality_report(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the QualityReport for a Document, including issues and broken links."""
    document = await _get_document_or_404(project.id, document_id, db)

    result = await db.execute(
        select(QualityReport)
        .options(
            selectinload(QualityReport.issues),
            selectinload(QualityReport.broken_links),
        )
        .where(QualityReport.document_id == document.id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=404,
            detail="No quality report found. Run POST /quality/run to generate one.",
        )
    return report


@router.get("/{project_id}/documents/{document_id}/quality/issues", response_model=list[QualityIssueOut])
async def get_quality_issues(
    document_id: int,
    severity: Optional[str] = Query(None, description="Filter by severity: error, warning, info"),
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return quality issues for the latest report, optionally filtered by severity."""
    document = await _get_document_or_404(project.id, document_id, db)

    report_result = await db.execute(
        select(QualityReport).where(QualityReport.document_id == document.id)
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
