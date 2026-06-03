from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.note import CollaborationNote

router = APIRouter(prefix="/documents", tags=["notes"])


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


@router.get("/{doc_id}/notes", response_model=List[NoteResponse])
async def list_notes(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc_res = await db.execute(select(Document).where(Document.id == doc_id))
    if not doc_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    res = await db.execute(
        select(CollaborationNote, User)
        .join(User, User.id == CollaborationNote.user_id)
        .where(CollaborationNote.document_id == doc_id)
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


@router.post("/{doc_id}/notes", status_code=status.HTTP_201_CREATED, response_model=NoteResponse)
async def create_note(
    doc_id: int,
    body: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc_res = await db.execute(select(Document).where(Document.id == doc_id))
    if not doc_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    note = CollaborationNote(
        document_id=doc_id,
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
