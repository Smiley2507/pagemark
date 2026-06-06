import io
import re
import zipfile
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.project import Project
from app.models.document import Document, Section, LifecycleStatus
from app.services.export_service import export_markdown, export_html, export_pdf

router = APIRouter(prefix="/projects", tags=["export"])


class BatchExportRequest(BaseModel):
    project_ids: List[int]


def _safe_filename(name: str) -> str:
    return re.sub(r"[^\w\-\. ]", "_", name).strip()


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


@router.get("/{project_id}/documents/{document_id}/export")
async def export_document(
    document_id: int,
    format: str = Query("markdown", description="Export format: markdown, html, pdf"),
    h1_color: Optional[str] = Query(None),
    h2_color: Optional[str] = Query(None),
    primary_color: Optional[str] = Query(None),
    font_family: Optional[str] = Query(None),
    logo_url: Optional[str] = Query(None),
    logo_position: Optional[str] = Query(None),
    header_left: Optional[str] = Query(None),
    header_center: Optional[str] = Query(None),
    header_right: Optional[str] = Query(None),
    page_numbers: Optional[bool] = Query(None),
    paper_size: Optional[str] = Query(None),
    margins: Optional[str] = Query(None),
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    document = await _get_document_or_404(project.id, document_id, db)

    sec_result = await db.execute(
        select(Section)
        .where(Section.document_id == document.id, Section.lifecycle_status == LifecycleStatus.ACTIVE)
        .order_by(Section.order_index)
    )
    sections = sec_result.scalars().all()

    export_settings = dict(document.export_settings or {})

    overrides = {
        "h1_color": h1_color,
        "h2_color": h2_color,
        "primary_color": primary_color,
        "font_family": font_family,
        "logo_url": logo_url,
        "logo_position": logo_position,
        "header_left": header_left,
        "header_center": header_center,
        "header_right": header_right,
        "page_numbers": page_numbers,
        "paper_size": paper_size,
        "margins": margins,
    }
    for key, val in overrides.items():
        if val is not None:
            export_settings[key] = val

    doc_title = document.title or "Documentation"
    safe_name = _safe_filename(f"{project.name}-{document.title}")
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
                project = await verify_project_ownership(pid, current_user, db)
                doc_result = await db.execute(
                    select(Document).where(Document.project_id == pid)
                )
                doc = doc_result.scalar_one_or_none()
                if not doc:
                    continue

                sec_result = await db.execute(
                    select(Section)
                    .where(Section.document_id == doc.id, Section.lifecycle_status == LifecycleStatus.ACTIVE)
                    .order_by(Section.order_index)
                )
                sections = sec_result.scalars().all()
                export_settings = doc.export_settings or {}
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
