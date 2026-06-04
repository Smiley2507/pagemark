"""
export.py — API router for documentation export.

GET  /projects/{id}/export?format=markdown|html|pdf
POST /projects/batch-export
"""
import io
import re
import zipfile
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.document import Document, Section
from app.services.export_service import export_markdown, export_html, export_pdf

router = APIRouter(prefix="/projects", tags=["export"])


class BatchExportRequest(BaseModel):
    project_ids: List[int]


def _safe_filename(name: str) -> str:
    """Strip characters unsafe for filenames."""
    return re.sub(r"[^\w\-\. ]", "_", name).strip()


async def _get_project_or_404(project_id: int, db: AsyncSession, user) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/export")
async def export_project(
    project_id: int,
    format: str = Query("markdown", description="Export format: markdown, html, pdf"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    project = await _get_project_or_404(project_id, db, current_user)

    doc_result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="No document found for this project")

    sec_result = await db.execute(
        select(Section)
        .where(Section.document_id == doc.id)
        .order_by(Section.order_index)
    )
    sections = sec_result.scalars().all()

    export_settings = project.export_settings or {}
    doc_title = doc.title or "Documentation"
    safe_name = _safe_filename(project.name)
    fmt = format.lower().strip()

    if fmt == "markdown":
        content = export_markdown(sections, doc_title).encode("utf-8")
        return Response(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.md"',
                "Content-Length": str(len(content)),
            },
        )

    elif fmt == "html":
        content = export_html(sections, project.name, doc_title, export_settings)
        return Response(
            content=content,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.html"',
                "Content-Length": str(len(content)),
            },
        )

    elif fmt == "pdf":
        try:
            content = export_pdf(sections, project.name, doc_title, export_settings)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"PDF generation failed: {exc}",
            )
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.pdf"',
                "Content-Length": str(len(content)),
            },
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {fmt!r}. Use 'markdown', 'html', or 'pdf'.",
        )


@router.post("/batch-export")
async def batch_export(
    body: BatchExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not body.project_ids:
        raise HTTPException(status_code=400, detail="No project IDs provided")
    if len(body.project_ids) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 projects per batch export")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for pid in body.project_ids:
            try:
                project = await _get_project_or_404(pid, db, current_user)
                doc_result = await db.execute(
                    select(Document).where(Document.project_id == pid)
                )
                doc = doc_result.scalar_one_or_none()
                if not doc:
                    continue

                sec_result = await db.execute(
                    select(Section)
                    .where(Section.document_id == doc.id)
                    .order_by(Section.order_index)
                )
                sections = sec_result.scalars().all()
                export_settings = project.export_settings or {}
                pdf_bytes = export_pdf(sections, project.name, doc.title or "Documentation", export_settings)
                safe_name = _safe_filename(project.name)
                zf.writestr(f"{safe_name}.pdf", pdf_bytes)
            except Exception:
                continue

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="pagemark-export.zip"',
        },
    )
