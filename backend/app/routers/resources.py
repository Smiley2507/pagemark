"""Resource upload and management endpoints for the AI context system."""

import io
import logging
import mimetypes
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, ConfigDict

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership, require_project
from app.models.user import User
from app.models.project import Project
from app.models.resource import Resource, ResourceType
from app.authz import CONTENT_WRITE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["resources"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_MIME_PREFIXES = {
    "image/", "text/", "application/pdf", "application/json",
    "application/x-yaml", "application/vnd.openxmlformats-officedocument",
    "application/msword",
}


# ── Pydantic schemas ─────────────────────────────────────────────

class ResourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    type: str
    original_name: str
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    file_path: Optional[str] = None
    symbol_name: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    created_by: int
    created_at: datetime
    updated_at: datetime


class ResourceListResponse(BaseModel):
    resources: List[ResourceResponse]
    total: int


# ── Helpers ──────────────────────────────────────────────────────

def _extract_pdf_text(data: bytes) -> str | None:
    try:
        import fitz
        doc = fitz.open(stream=data, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text[:100_000]  # cap extracted text
    except Exception as e:
        logger.warning("PDF text extraction failed: %s", e)
        return None


def _extract_docx_text(data: bytes) -> str | None:
    try:
        import docx
        doc = docx.Document(io.BytesIO(data))
        text = "\n".join(p.text for p in doc.paragraphs)
        return text[:100_000]
    except Exception as e:
        logger.warning("DOCX text extraction failed: %s", e)
        return None


def _generate_thumbnail(data: bytes, mime_type: str) -> bytes | None:
    if not mime_type.startswith("image/"):
        return None
    try:
        from PIL import Image, ImageOps
        img = Image.open(io.BytesIO(data))
        img.thumbnail((200, 200), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        fmt = "PNG"
        img.save(buf, format=fmt)
        return buf.getvalue()
    except Exception as e:
        logger.warning("Thumbnail generation failed: %s", e)
        return None


def _resource_to_response(r: Resource) -> ResourceResponse:
    return ResourceResponse(
        id=r.id,
        project_id=r.project_id,
        type=r.type.value if hasattr(r.type, "value") else str(r.type),
        original_name=r.original_name,
        mime_type=r.mime_type,
        size_bytes=r.size_bytes,
        file_path=r.file_path,
        symbol_name=r.symbol_name,
        reference_type=r.reference_type,
        reference_id=r.reference_id,
        created_by=r.created_by,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/{project_id}/resources/upload", response_model=ResourceResponse, status_code=201)
async def upload_resource(
    file: UploadFile = File(...),
    project: Project = Depends(require_project(CONTENT_WRITE)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file as a project resource (PDF, image, doc, text, etc.)"""
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_FILE_SIZE // 1024 // 1024} MB limit")

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    prefix = mime.split("/")[0]
    if prefix not in {p.split("/")[0] for p in ALLOWED_MIME_PREFIXES} and mime not in ALLOWED_MIME_PREFIXES:
        if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime}")

    extracted_text: str | None = None
    if mime == "application/pdf":
        extracted_text = _extract_pdf_text(contents)
    elif mime.startswith("application/vnd.openxmlformats-officedocument"):
        extracted_text = _extract_docx_text(contents)
    elif mime == "application/msword":
        extracted_text = _extract_docx_text(contents)

    thumbnail = _generate_thumbnail(contents, mime)

    resource = Resource(
        project_id=project.id,
        type=ResourceType.UPLOAD,
        original_name=file.filename or "untitled",
        mime_type=mime,
        size_bytes=len(contents),
        data=contents,
        extracted_text=extracted_text,
        thumbnail=thumbnail,
        created_by=current_user.id,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    logger.info("Resource uploaded: id=%d name=%s type=%s", resource.id, resource.original_name, mime)
    return _resource_to_response(resource)


@router.get("/{project_id}/resources", response_model=ResourceListResponse)
async def list_resources(
    type_filter: Optional[str] = Query(None, alias="type"),
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List project resources, optionally filtered by type."""
    query = select(Resource).where(Resource.project_id == project.id)
    if type_filter:
        try:
            rt = ResourceType(type_filter)
            query = query.where(Resource.type == rt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {type_filter}")

    query = query.order_by(Resource.created_at.desc())
    result = await db.execute(query)
    resources = result.scalars().all()
    return ResourceListResponse(
        resources=[_resource_to_response(r) for r in resources],
        total=len(resources),
    )


@router.get("/{project_id}/resources/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: int,
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get resource metadata."""
    result = await db.execute(
        select(Resource).where(Resource.id == resource_id, Resource.project_id == project.id)
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return _resource_to_response(resource)


@router.get("/{project_id}/resources/{resource_id}/data")
async def download_resource(
    resource_id: int,
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the raw resource file."""
    result = await db.execute(
        select(Resource).where(Resource.id == resource_id, Resource.project_id == project.id)
    )
    resource = result.scalar_one_or_none()
    if not resource or not resource.data:
        raise HTTPException(status_code=404, detail="Resource not found or has no data")

    return Response(
        content=resource.data,
        media_type=resource.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{resource.original_name}"'},
    )


@router.delete("/{project_id}/resources/{resource_id}", status_code=204)
async def delete_resource(
    resource_id: int,
    project: Project = Depends(require_project(CONTENT_WRITE)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a resource."""
    result = await db.execute(
        select(Resource).where(Resource.id == resource_id, Resource.project_id == project.id)
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    await db.delete(resource)
    await db.commit()
    logger.info("Resource deleted: id=%d", resource_id)
