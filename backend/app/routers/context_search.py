"""Unified context search — repo files, symbols, docs, sections, notes, uploads."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership
from app.models.user import User
from app.models.project import Project
from app.models.document import Document, Section
from app.models.note import CollaborationNote
from app.models.resource import Resource
from app.models.analysis import Analysis
from app.services.symbol_service import search_symbols

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["context_search"])

MAX_RESULTS = 50
DEFAULT_LIMIT = 20


class ContextSearchItem:
    def __init__(
        self,
        *,
        type: str,
        id: str,
        label: str,
        subtitle: str = "",
        score: float = 0.0,
        reference_type: str | None = None,
        reference_id: int | None = None,
    ):
        self.type = type
        self.id = id
        self.label = label
        self.subtitle = subtitle
        self.score = score
        self.reference_type = reference_type
        self.reference_id = reference_id


class ContextSearchResult:
    def __init__(self, results: list[ContextSearchItem], total: int):
        self.results = results
        self.total = total


SCORES = {
    "section": 1.0,
    "document": 0.8,
    "repo_file": 0.7,
    "symbol": 0.6,
    "note": 0.5,
    "upload": 0.4,
}


def _partial_match(haystack: str | None, needle: str) -> bool:
    if not haystack:
        return False
    return needle in haystack.lower()


@router.get("/{project_id}/context/search")
async def context_search(
    q: str = Query(""),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_RESULTS),
    project: Project = Depends(verify_project_ownership),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified search across repo files, symbols, documents, sections, notes, and uploads."""
    query = q.strip().lower()
    results: list[ContextSearchItem] = []

    if not query:
        return {"results": [], "total": 0}

    # ── 1. Get current analysis ──────────────────────────────────
    analysis_result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project.id, Analysis.is_current == True)  # noqa: E712
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    analysis: Analysis | None = analysis_result.scalar_one_or_none()
    file_contents: dict[str, str] = {}
    if analysis and analysis.file_contents_json:
        file_contents = analysis.file_contents_json

    # ── 2. Repo file search ──────────────────────────────────────
    for file_path in file_contents:
        if _partial_match(file_path, query):
            results.append(ContextSearchItem(
                type="repo_file",
                id=f"file:{file_path}",
                label=file_path,
                subtitle=f"{analysis.languages_json.get('primary', [''])[0] if analysis and analysis.languages_json else ''}",
                score=SCORES["repo_file"],
                reference_type="repo_file",
            ))

    # ── 3. Symbol search ─────────────────────────────────────────
    if analysis:
        symbols = search_symbols(analysis.id, file_contents, query)
        for sym in symbols:
            suffix = f" ({sym.kind})"
            results.append(ContextSearchItem(
                type="symbol",
                id=f"symbol:{sym.name}",
                label=sym.name,
                subtitle=f"{sym.kind} · {sym.file_path}:{sym.line}",
                score=SCORES["symbol"],
                reference_type="symbol",
                reference_id=None,
            ))

    # ── 4. Document search ───────────────────────────────────────
    doc_result = await db.execute(
        select(Document).where(
            Document.project_id == project.id,
        )
    )
    for doc in doc_result.scalars().all():
        if _partial_match(doc.title, query) or _partial_match(doc.purpose, query):
            results.append(ContextSearchItem(
                type="document",
                id=f"document:{doc.id}",
                label=doc.title,
                subtitle=doc.purpose or "",
                score=SCORES["document"],
                reference_type="document",
                reference_id=doc.id,
            ))

    # ── 5. Section search ────────────────────────────────────────
    sec_result = await db.execute(
        select(Section)
        .join(Document, Document.id == Section.document_id)
        .where(
            Document.project_id == project.id,
            Section.lifecycle_status != "DELETED",
        )
    )
    for sec in sec_result.scalars().all():
        if _partial_match(sec.heading, query) or _partial_match(sec.content_md, query):
            doc_title = ""
            doc_res = await db.execute(select(Document.title).where(Document.id == sec.document_id))
            doc_row = doc_res.first()
            if doc_row:
                doc_title = doc_row[0]
            results.append(ContextSearchItem(
                type="section",
                id=f"section:{sec.id}",
                label=sec.heading,
                subtitle=f"{doc_title}",
                score=SCORES["section"],
                reference_type="section",
                reference_id=sec.id,
            ))

    # ── 6. Note search ───────────────────────────────────────────
    note_result = await db.execute(
        select(CollaborationNote)
        .join(Document, Document.id == CollaborationNote.document_id)
        .where(Document.project_id == project.id)
    )
    for note in note_result.scalars().all():
        if _partial_match(note.content, query):
            doc_title = ""
            doc_res = await db.execute(select(Document.title).where(Document.id == note.document_id))
            doc_row = doc_res.first()
            if doc_row:
                doc_title = doc_row[0]
            results.append(ContextSearchItem(
                type="note",
                id=f"note:{note.id}",
                label=f"Note in {doc_title}".strip(),
                subtitle=note.content[:120],
                score=SCORES["note"],
                reference_type="note",
                reference_id=note.id,
            ))

    # ── 7. Uploaded resource search ──────────────────────────────
    upload_result = await db.execute(
        select(Resource).where(
            Resource.project_id == project.id,
            Resource.type == "upload",
        )
    )
    for res in upload_result.scalars().all():
        if _partial_match(res.original_name, query) or _partial_match(res.extracted_text, query):
            mime_label = res.mime_type or "unknown"
            size_label = f"{res.size_bytes // 1024} KB" if res.size_bytes else ""
            results.append(ContextSearchItem(
                type="upload",
                id=f"upload:{res.id}",
                label=res.original_name,
                subtitle=f"{mime_label} · {size_label}".strip(" ·"),
                score=SCORES["upload"],
                reference_type="upload",
                reference_id=res.id,
            ))

    # ── Sort: score desc, then label asc ─────────────────────────
    results.sort(key=lambda r: (-r.score, r.label))

    # Deduplicate by id — keep highest score
    seen: dict[str, ContextSearchItem] = {}
    for r in results:
        if r.id not in seen or r.score > seen[r.id].score:
            seen[r.id] = r
    deduped = list(seen.values())
    deduped.sort(key=lambda r: (-r.score, r.label))

    top = deduped[:limit]
    return {
        "results": [
            {
                "type": r.type,
                "id": r.id,
                "label": r.label,
                "subtitle": r.subtitle,
                "score": r.score,
                "reference_type": r.reference_type,
                "reference_id": r.reference_id,
            }
            for r in top
        ],
        "total": len(deduped),
    }
