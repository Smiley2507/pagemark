from datetime import datetime
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, ConfigDict, Field

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.user import User
from app.models.document import Document, Section
from app.models.note import CollaborationNote
from app.models.project import Project
from app.models.resource import Resource

router = APIRouter(prefix="/projects", tags=["notes"])


class NoteReference(BaseModel):
    type: Literal["section", "document", "resource", "source", "note"]
    id: Optional[int] = None
    label: str = Field(min_length=1, max_length=200)
    metadata: Optional[dict[str, Any]] = None


class NoteCreate(BaseModel):
    content: str
    section_id: Optional[int] = None
    references: List[NoteReference] = Field(default_factory=list)


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    section_id: Optional[int] = None
    user_id: int
    content: str
    created_at: datetime
    references: List[NoteReference] = Field(default_factory=list)
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None


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


async def _get_section_for_document(
    db: AsyncSession,
    document_id: int,
    section_id: int,
) -> Section:
    section_res = await db.execute(
        select(Section).where(
            Section.id == section_id,
            Section.document_id == document_id,
        )
    )
    section = section_res.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=400, detail="Section does not belong to this document")
    return section


async def _validate_note_references(
    db: AsyncSession,
    project_id: int,
    document_id: int,
    references: list[NoteReference],
) -> list[dict[str, Any]]:
    section_ids = [ref.id for ref in references if ref.type == "section" and ref.id is not None]
    document_ids = [ref.id for ref in references if ref.type == "document" and ref.id is not None]
    resource_ids = [ref.id for ref in references if ref.type == "resource" and ref.id is not None]
    note_ids = [ref.id for ref in references if ref.type == "note" and ref.id is not None]

    if section_ids:
        section_res = await db.execute(
            select(Section.id).where(
                Section.id.in_(section_ids),
                Section.document_id == document_id,
            )
        )
        found = {row[0] for row in section_res.all()}
        missing = sorted(set(section_ids) - found)
        if missing:
            raise HTTPException(status_code=400, detail=f"Section references are outside this document: {missing}")

    if document_ids:
        doc_res = await db.execute(
            select(Document.id).where(
                Document.id.in_(document_ids),
                Document.project_id == project_id,
            )
        )
        found = {row[0] for row in doc_res.all()}
        missing = sorted(set(document_ids) - found)
        if missing:
            raise HTTPException(status_code=400, detail=f"Document references are outside this project: {missing}")

    if resource_ids:
        resource_res = await db.execute(
            select(Resource.id).where(
                Resource.id.in_(resource_ids),
                Resource.project_id == project_id,
            )
        )
        found = {row[0] for row in resource_res.all()}
        missing = sorted(set(resource_ids) - found)
        if missing:
            raise HTTPException(status_code=400, detail=f"Resource references are outside this project: {missing}")

    if note_ids:
        note_res = await db.execute(
            select(CollaborationNote.id)
            .join(Document, Document.id == CollaborationNote.document_id)
            .where(
                CollaborationNote.id.in_(note_ids),
                Document.project_id == project_id,
            )
        )
        found = {row[0] for row in note_res.all()}
        missing = sorted(set(note_ids) - found)
        if missing:
            raise HTTPException(status_code=400, detail=f"Note references are outside this project: {missing}")

    return [ref.model_dump(exclude_none=True) for ref in references]


def _note_references(note: CollaborationNote) -> list[NoteReference]:
    if not isinstance(note.references_json, list):
        return []
    refs: list[NoteReference] = []
    for item in note.references_json:
        if not isinstance(item, dict):
            continue
        try:
            refs.append(NoteReference.model_validate(item))
        except Exception:
            continue
    return refs


@router.get("/{project_id}/documents/{document_id}/notes", response_model=List[NoteResponse])
async def list_notes(
    document_id: int,
    section_id: Optional[int] = Query(None),
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_for_project(db, project.id, document_id)
    if section_id is not None:
        await _get_section_for_document(db, document.id, section_id)

    query = (
        select(CollaborationNote, User)
        .join(User, User.id == CollaborationNote.user_id)
        .where(CollaborationNote.document_id == document.id)
    )
    if section_id is not None:
        query = query.where(CollaborationNote.section_id == section_id)

    query = query.order_by(CollaborationNote.created_at.asc())
    res = await db.execute(query)
    rows = res.all()
    return [
        NoteResponse(
            id=note.id,
            document_id=note.document_id,
            section_id=note.section_id,
            user_id=note.user_id,
            content=note.content,
            created_at=note.created_at,
            references=_note_references(note),
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
    if body.section_id is not None:
        await _get_section_for_document(db, document.id, body.section_id)
    references = await _validate_note_references(db, project.id, document.id, body.references)

    note = CollaborationNote(
        document_id=document.id,
        section_id=body.section_id,
        user_id=current_user.id,
        content=body.content,
        references_json=references or None,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return NoteResponse(
        id=note.id,
        document_id=note.document_id,
        section_id=note.section_id,
        user_id=note.user_id,
        content=note.content,
        created_at=note.created_at,
        references=_note_references(note),
        user_name=current_user.name,
        user_avatar=current_user.avatar_url,
    )
