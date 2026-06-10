from __future__ import annotations

import io
import re
import zipfile
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.document import Document, Section, LifecycleStatus
from app.models.project import Project
from app.services.export_service import (
    export_markdown,
    export_html,
    export_pdf,
    debug_save_html,
    normalize_settings,
)

router = APIRouter(prefix="/projects", tags=["export"])


class BatchExportRequest(BaseModel):
    project_ids: list[int]


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


async def _get_sections(document: Document, db: AsyncSession) -> list[Section]:
    result = await db.execute(
        select(Section)
        .where(Section.document_id == document.id, Section.lifecycle_status == LifecycleStatus.ACTIVE)
        .order_by(Section.order_index)
    )
    return list(result.scalars().all())


ALL_OVERRIDE_KEYS = [
    "organization_name", "title", "subtitle",
    "include_toc", "include_cover_page", "include_page_numbers",
    "paper_size", "orientation", "margins",
    "margin_top", "margin_bottom", "margin_left", "margin_right",
    "primary_color", "h1_color", "h2_color", "text_color",
    "muted_color", "border_color", "table_header_bg",
    "code_bg", "code_color", "font_family",
    "body_font_size", "h1_font_size", "h2_font_size", "h3_font_size", "code_font_size",
    "header_left", "header_center", "header_right",
    "footer_left", "footer_center", "footer_right",
    "page_number_position", "page_number_format",
    "logo_url", "logo_position", "logo_height",
    "table_style", "code_theme",
    "watermark_text",
]


def _gather_export_settings(
    document: Document,
    query_params: dict[str, Any],
    project: Project | None = None,
) -> dict:
    settings: dict[str, Any] = {}
    # Project-level defaults (lowest priority)
    if project and project.export_settings:
        settings.update(project.export_settings)
    # Document-level overrides
    if document.export_settings:
        settings.update(document.export_settings)
    # Query param overrides (highest priority)
    for key in ALL_OVERRIDE_KEYS:
        val = query_params.get(key)
        if val is not None and val != "":
            settings[key] = val
    # Apply boolean coercion for string query params
    for bool_key in ("include_toc", "include_cover_page", "include_page_numbers"):
        if bool_key in settings and isinstance(settings[bool_key], str):
            settings[bool_key] = settings[bool_key].lower() in ("true", "1", "yes")
    return normalize_settings(settings)


@router.get("/{project_id}/documents/{document_id}/export")
async def export_document(
    project_id: int,
    document_id: int,
    format: str = Query("markdown", description="Export format: markdown, html, pdf"),
    # All override params
    organization_name: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    subtitle: Optional[str] = Query(None),
    include_toc: Optional[str] = Query(None),
    include_cover_page: Optional[str] = Query(None),
    include_page_numbers: Optional[str] = Query(None),
    paper_size: Optional[str] = Query(None),
    orientation: Optional[str] = Query(None),
    margins: Optional[str] = Query(None),
    margin_top: Optional[str] = Query(None),
    margin_bottom: Optional[str] = Query(None),
    margin_left: Optional[str] = Query(None),
    margin_right: Optional[str] = Query(None),
    primary_color: Optional[str] = Query(None),
    h1_color: Optional[str] = Query(None),
    h2_color: Optional[str] = Query(None),
    text_color: Optional[str] = Query(None),
    muted_color: Optional[str] = Query(None),
    border_color: Optional[str] = Query(None),
    table_header_bg: Optional[str] = Query(None),
    code_bg: Optional[str] = Query(None),
    code_color: Optional[str] = Query(None),
    font_family: Optional[str] = Query(None),
    body_font_size: Optional[str] = Query(None),
    h1_font_size: Optional[str] = Query(None),
    h2_font_size: Optional[str] = Query(None),
    h3_font_size: Optional[str] = Query(None),
    code_font_size: Optional[str] = Query(None),
    header_left: Optional[str] = Query(None),
    header_center: Optional[str] = Query(None),
    header_right: Optional[str] = Query(None),
    footer_left: Optional[str] = Query(None),
    footer_center: Optional[str] = Query(None),
    footer_right: Optional[str] = Query(None),
    page_number_position: Optional[str] = Query(None),
    page_number_format: Optional[str] = Query(None),
    logo_url: Optional[str] = Query(None),
    logo_position: Optional[str] = Query(None),
    logo_height: Optional[str] = Query(None),
    table_style: Optional[str] = Query(None),
    code_theme: Optional[str] = Query(None),
    watermark_text: Optional[str] = Query(None),
    debug: Optional[bool] = Query(False, description="Save generated HTML to disk for debugging"),
    # Dependencies
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    document = await _get_document_or_404(project.id, document_id, db)
    sections = await _get_sections(document, db)

    query_params = {k: v for k, v in locals().items() if k in ALL_OVERRIDE_KEYS or k in (
        "organization_name", "title", "subtitle", "include_toc", "include_cover_page",
        "include_page_numbers", "paper_size", "orientation", "margins",
        "margin_top", "margin_bottom", "margin_left", "margin_right",
        "primary_color", "h1_color", "h2_color", "text_color",
        "muted_color", "border_color", "table_header_bg",
        "code_bg", "code_color", "font_family",
        "body_font_size", "h1_font_size", "h2_font_size", "h3_font_size", "code_font_size",
        "header_left", "header_center", "header_right",
        "footer_left", "footer_center", "footer_right",
        "page_number_position", "page_number_format",
        "logo_url", "logo_position", "logo_height",
        "table_style", "code_theme", "watermark_text",
    )}
    settings = _gather_export_settings(document, query_params, project)
    doc_title = document.title or "Documentation"
    safe_name = _safe_filename(f"{project.name}-{document.title}")
    fmt = format.lower().strip()

    if debug:
        preview_html = export_html(sections, project.name, doc_title, settings)
        saved = debug_save_html(preview_html, safe_name)
        print(f"[export] DEBUG: saved HTML to {saved}")

    if fmt == "markdown":
        content = export_markdown(sections, project.name, doc_title, settings).encode("utf-8")
        return Response(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.md"',
            },
        )

    elif fmt == "html":
        content = export_html(sections, project.name, doc_title, settings)
        return Response(
            content=content,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.html"',
            },
        )

    elif fmt == "pdf":
        try:
            content = export_pdf(sections, project.name, doc_title, settings)
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
            },
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {fmt!r}. Use 'markdown', 'html', or 'pdf'.",
        )


@router.get("/{project_id}/export")
async def export_project_document(
    project_id: int,
    format: str = Query("pdf", description="Export format: markdown, html, pdf"),
    organization_name: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    subtitle: Optional[str] = Query(None),
    include_toc: Optional[str] = Query(None),
    include_cover_page: Optional[str] = Query(None),
    include_page_numbers: Optional[str] = Query(None),
    paper_size: Optional[str] = Query(None),
    orientation: Optional[str] = Query(None),
    margins: Optional[str] = Query(None),
    margin_top: Optional[str] = Query(None),
    margin_bottom: Optional[str] = Query(None),
    margin_left: Optional[str] = Query(None),
    margin_right: Optional[str] = Query(None),
    primary_color: Optional[str] = Query(None),
    h1_color: Optional[str] = Query(None),
    h2_color: Optional[str] = Query(None),
    text_color: Optional[str] = Query(None),
    muted_color: Optional[str] = Query(None),
    border_color: Optional[str] = Query(None),
    table_header_bg: Optional[str] = Query(None),
    code_bg: Optional[str] = Query(None),
    code_color: Optional[str] = Query(None),
    font_family: Optional[str] = Query(None),
    body_font_size: Optional[str] = Query(None),
    h1_font_size: Optional[str] = Query(None),
    h2_font_size: Optional[str] = Query(None),
    h3_font_size: Optional[str] = Query(None),
    code_font_size: Optional[str] = Query(None),
    header_left: Optional[str] = Query(None),
    header_center: Optional[str] = Query(None),
    header_right: Optional[str] = Query(None),
    footer_left: Optional[str] = Query(None),
    footer_center: Optional[str] = Query(None),
    footer_right: Optional[str] = Query(None),
    page_number_position: Optional[str] = Query(None),
    page_number_format: Optional[str] = Query(None),
    logo_url: Optional[str] = Query(None),
    logo_position: Optional[str] = Query(None),
    logo_height: Optional[str] = Query(None),
    table_style: Optional[str] = Query(None),
    code_theme: Optional[str] = Query(None),
    watermark_text: Optional[str] = Query(None),
    # Dependencies
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Export the first document in a project (legacy project-level endpoint)."""
    result = await db.execute(
        select(Document).where(Document.project_id == project.id).order_by(Document.created_at.asc())
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="No documents found in this project")

    # Forward to document export
    sections = await _get_sections(document, db)
    query_params = {k: v for k, v in locals().items() if k in ALL_OVERRIDE_KEYS}
    settings = _gather_export_settings(document, query_params, project)
    doc_title = document.title or "Documentation"
    safe_name = _safe_filename(f"{project.name}-{document.title}")
    fmt = format.lower().strip()

    if fmt == "markdown":
        content = export_markdown(sections, project.name, doc_title, settings).encode("utf-8")
        return Response(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.md"'},
        )
    elif fmt == "html":
        content = export_html(sections, project.name, doc_title, settings)
        return Response(
            content=content,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.html"'},
        )
    elif fmt == "pdf":
        try:
            content = export_pdf(sections, project.name, doc_title, settings)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt!r}.")


@router.get("/{project_id}/documents/{document_id}/export-preview")
async def export_preview_html(
    project_id: int,
    document_id: int,
    # Same override params as export
    organization_name: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    subtitle: Optional[str] = Query(None),
    include_toc: Optional[str] = Query(None),
    include_cover_page: Optional[str] = Query(None),
    include_page_numbers: Optional[str] = Query(None),
    paper_size: Optional[str] = Query(None),
    orientation: Optional[str] = Query(None),
    margins: Optional[str] = Query(None),
    margin_top: Optional[str] = Query(None),
    margin_bottom: Optional[str] = Query(None),
    margin_left: Optional[str] = Query(None),
    margin_right: Optional[str] = Query(None),
    primary_color: Optional[str] = Query(None),
    h1_color: Optional[str] = Query(None),
    h2_color: Optional[str] = Query(None),
    text_color: Optional[str] = Query(None),
    muted_color: Optional[str] = Query(None),
    border_color: Optional[str] = Query(None),
    table_header_bg: Optional[str] = Query(None),
    code_bg: Optional[str] = Query(None),
    code_color: Optional[str] = Query(None),
    font_family: Optional[str] = Query(None),
    body_font_size: Optional[str] = Query(None),
    h1_font_size: Optional[str] = Query(None),
    h2_font_size: Optional[str] = Query(None),
    h3_font_size: Optional[str] = Query(None),
    code_font_size: Optional[str] = Query(None),
    header_left: Optional[str] = Query(None),
    header_center: Optional[str] = Query(None),
    header_right: Optional[str] = Query(None),
    footer_left: Optional[str] = Query(None),
    footer_center: Optional[str] = Query(None),
    footer_right: Optional[str] = Query(None),
    page_number_position: Optional[str] = Query(None),
    page_number_format: Optional[str] = Query(None),
    logo_url: Optional[str] = Query(None),
    logo_position: Optional[str] = Query(None),
    logo_height: Optional[str] = Query(None),
    table_style: Optional[str] = Query(None),
    code_theme: Optional[str] = Query(None),
    watermark_text: Optional[str] = Query(None),
    # Dependencies
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the generated HTML for preview purposes (no attachment header)."""
    document = await _get_document_or_404(project.id, document_id, db)
    sections = await _get_sections(document, db)

    query_params = {k: v for k, v in locals().items() if k in ALL_OVERRIDE_KEYS or k in (
        "organization_name", "title", "subtitle", "include_toc", "include_cover_page",
        "include_page_numbers", "paper_size", "orientation", "margins",
        "margin_top", "margin_bottom", "margin_left", "margin_right",
        "primary_color", "h1_color", "h2_color", "text_color",
        "muted_color", "border_color", "table_header_bg",
        "code_bg", "code_color", "font_family",
        "body_font_size", "h1_font_size", "h2_font_size", "h3_font_size", "code_font_size",
        "header_left", "header_center", "header_right",
        "footer_left", "footer_center", "footer_right",
        "page_number_position", "page_number_format",
        "logo_url", "logo_position", "logo_height",
        "table_style", "code_theme", "watermark_text",
    )}
    settings = _gather_export_settings(document, query_params, project)
    doc_title = document.title or "Documentation"

    html = export_html(sections, project.name, doc_title, settings)
    return HTMLResponse(content=html, status_code=200)


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

                sections = await _get_sections(doc, db)
                settings = normalize_settings(doc.export_settings)
                pdf_bytes = export_pdf(sections, project.name, doc.title or "Documentation", settings)
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
