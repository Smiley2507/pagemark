"""
quality.py — API router for quality scoring.

POST /projects/{project_id}/documents/{document_id}/quality/run   → dispatch Celery task (202)
GET  /projects/{project_id}/documents/{document_id}/quality/status → return Celery status
GET  /projects/{project_id}/documents/{document_id}/quality       → return QualityReport
GET  /projects/{project_id}/documents/{document_id}/quality/issues → return QualityIssues
"""
from typing import Optional

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.document import Document
from app.models.project import Project
from app.models.document import Section
from app.models.quality import (
    IssueSeverity,
    QualityFinding,
    QualityFindingCategory,
    QualityFindingStatus,
    QualityIssue,
    QualityReport,
)
from app.schemas.quality import (
    QualityAIFixRequest,
    QualityFindingOut,
    QualityFindingStatusUpdate,
    QualityGrammarRunRequest,
    QualityIssueOut,
    QualityReportOut,
    QualityRunResponse,
    QualityStatusResponse,
)
from app.schemas.ai_work import AIWorkRunResponse
from app.services import quality_findings_service
from app.services.grammar_service import check_grammar
from app.services.quality_findings_service import finding_to_response
from app.workers.celery_app import celery_app
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
    result = score_quality_task.delay(document_id)
    return QualityRunResponse(message="Quality analysis started", task_id=result.id)


@router.get(
    "/{project_id}/documents/{document_id}/quality/status",
    response_model=QualityStatusResponse,
)
async def get_quality_status(
    document_id: int,
    task_id: str = Query(..., min_length=1),
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return Celery task state plus latest report metadata for a Document."""
    document = await _get_document_or_404(project.id, document_id, db)
    task = AsyncResult(task_id, app=celery_app)

    report_result = await db.execute(
        select(QualityReport).where(QualityReport.document_id == document.id)
    )
    report = report_result.scalar_one_or_none()

    state = (task.state or "PENDING").upper()
    error: str | None = None
    status_value = "queued"
    message = "Quality analysis is queued."

    if state == "STARTED":
        status_value = "running"
        message = "Quality analysis is running."
    elif state == "SUCCESS":
        if report:
            status_value = "completed"
            message = "Quality analysis completed."
        else:
            status_value = "missing_report"
            message = "Quality analysis finished, but no report was written."
    elif state == "FAILURE":
        status_value = "failed"
        error = str(task.result) if task.result else "Quality worker failed without an error message."
        message = "Quality analysis failed."
    elif state in {"RETRY", "RECEIVED"}:
        status_value = "running"
        message = "Quality analysis is running."
    elif state in {"REVOKED", "REJECTED", "IGNORED"}:
        status_value = "failed"
        error = f"Celery task ended in state {state}."
        message = "Quality analysis did not complete."

    return QualityStatusResponse(
        status=status_value,
        task_id=task_id,
        message=message,
        report=report,
        error=error,
    )


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
    findings_result = await db.execute(
        select(QualityFinding).where(QualityFinding.document_id == document.id)
    )
    payload = QualityReportOut.model_validate(report)
    payload.findings = [
        QualityFindingOut.model_validate(finding_to_response(finding))
        for finding in findings_result.scalars().all()
    ]
    return payload


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


@router.get(
    "/{project_id}/documents/{document_id}/quality/findings",
    response_model=list[QualityFindingOut],
)
async def list_quality_findings(
    document_id: int,
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    section_id: Optional[int] = Query(None),
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    document = await _get_document_or_404(project.id, document_id, db)
    try:
        findings = await quality_findings_service.list_findings(
            db,
            document.id,
            section_id=section_id,
            category=category,
            status=status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return [QualityFindingOut.model_validate(finding_to_response(finding)) for finding in findings]


@router.patch(
    "/{project_id}/documents/{document_id}/quality/findings/{finding_id}",
    response_model=QualityFindingOut,
)
async def update_quality_finding_status(
    document_id: int,
    finding_id: int,
    body: QualityFindingStatusUpdate,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    document = await _get_document_or_404(project.id, document_id, db)
    result = await db.execute(
        select(QualityFinding).where(
            QualityFinding.id == finding_id,
            QualityFinding.document_id == document.id,
        )
    )
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="Quality finding not found")
    try:
        finding.status = QualityFindingStatus(body.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid finding status") from exc
    await db.commit()
    await db.refresh(finding)
    return QualityFindingOut.model_validate(finding_to_response(finding))


@router.post(
    "/{project_id}/documents/{document_id}/quality/grammar/run",
    response_model=list[QualityFindingOut],
)
async def run_quality_grammar(
    document_id: int,
    body: QualityGrammarRunRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    document = await _get_document_or_404(project.id, document_id, db)
    query = select(Section).where(Section.document_id == document.id)
    if body.section_id is not None:
        query = query.where(Section.id == body.section_id)
    result = await db.execute(query.order_by(Section.order_index))
    sections = list(result.scalars().all())
    if body.section_id is not None and not sections:
        raise HTTPException(status_code=404, detail="Section not found")

    payloads = []
    for section in sections:
        text = section.content_md or ""
        if not text.strip():
            continue
        grammar = await check_grammar(text, body.language)
        for match in grammar.matches:
            payloads.append(
                quality_findings_service.grammar_match_to_finding_payload(
                    document_id=document.id,
                    section=section,
                    text=text,
                    match=match,
                )
            )

    findings = await quality_findings_service.persist_findings_async(db, payloads)
    await db.commit()
    return [QualityFindingOut.model_validate(finding_to_response(finding)) for finding in findings]


@router.post(
    "/{project_id}/documents/{document_id}/quality/ai-fix",
    response_model=AIWorkRunResponse,
)
async def create_quality_ai_fix(
    document_id: int,
    body: QualityAIFixRequest,
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    document = await _get_document_or_404(project.id, document_id, db)
    try:
        work_run = await quality_findings_service.create_ai_fix_work_run(
            db,
            document,
            user_id=current_user.id,
            finding_id=body.finding_id,
            category=body.category,
            section_id=body.section_id,
            status=body.status,
            action=body.action,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if work_run is None:
        raise HTTPException(status_code=404, detail="No matching findings with section content")
    from app.services.ai_work_service import run_to_response

    return AIWorkRunResponse.model_validate(run_to_response(work_run))
