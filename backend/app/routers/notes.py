from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.user import User
from app.models.document import Document
from app.models.note import CollaborationNote
from app.models.project import Project

router = APIRouter(prefix="/projects", tags=["notes"])


class NoteCreate(BaseModel):
    content: str


class NoteResponse(BaseModel):
    id: int
    document_id: int
    user_id: int
    content: str
    created_at: datetime
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None

    class Config:
        from_attributes = True


async def _get_document_for_project(
    db: AsyncSession,
    project_id: int,
    document_id: int,
) -> Document:
    doc_res = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.project_id == project_id,
        )
    )
    document = doc_res.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/{project_id}/documents/{document_id}/notes", response_model=List[NoteResponse])
async def list_notes(
    document_id: int,
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_for_project(db, project.id, document_id)

    res = await db.execute(
        select(CollaborationNote, User)
        .join(User, User.id == CollaborationNote.user_id)
        .where(CollaborationNote.document_id == document.id)
        .order_by(CollaborationNote.created_at.asc())
    )
    rows = res.all()
    return [
        NoteResponse(
            id=note.id,
            document_id=note.document_id,
            user_id=note.user_id,
            content=note.content,
            created_at=note.created_at,
            user_name=user.name,
            user_avatar=user.avatar_url,
        )
        for note, user in rows
    ]


@router.post(
    "/{project_id}/documents/{document_id}/notes",
    status_code=status.HTTP_201_CREATED,
    response_model=NoteResponse,
)
async def create_note(
    document_id: int,
    body: NoteCreate,
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_for_project(db, project.id, document_id)

    note = CollaborationNote(
        document_id=document.id,
        user_id=current_user.id,
        content=body.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return NoteResponse(
        id=note.id,
        document_id=note.document_id,
        user_id=note.user_id,
        content=note.content,
        created_at=note.created_at,
        user_name=current_user.name,
        user_avatar=current_user.avatar_url,
    )
