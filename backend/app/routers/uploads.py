import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter(prefix="/upload", tags=["uploads"])

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PNG, JPEG, WebP, SVG",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 5 MB limit")

    ext = os.path.splitext(file.filename or "logo.png")[1] or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_path = os.path.join(settings.UPLOAD_DIR, "logos")
    os.makedirs(upload_path, exist_ok=True)
    filepath = os.path.join(upload_path, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return JSONResponse(content={"url": f"/static/logos/{filename}"})
