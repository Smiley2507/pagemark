"""
grammar.py — API router for grammar/spelling checking.

POST /projects/{id}/grammar/check  → check text grammar via LanguageTool
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user, require_project
from app.models.document import Document, Section
from app.models.project import Project
from app.authz import CONTENT_WRITE
from app.schemas.grammar import GrammarCheckRequest, GrammarCheckResponse
from app.services.grammar_service import check_grammar
from app.services import quality_findings_service

router = APIRouter(prefix="/projects", tags=["grammar"])


@router.post("/{project_id}/grammar/check", response_model=GrammarCheckResponse)
async def grammar_check(
    body: GrammarCheckRequest,
    project: Project = Depends(require_project(CONTENT_WRITE)),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Check grammar/spelling for the given text."""
    result = await check_grammar(body.text, body.language)
    if body.document_id is not None and body.section_id is not None:
        section_result = await db.execute(
            select(Section)
            .join(Document, Document.id == Section.document_id)
            .where(
                Document.id == body.document_id,
                Document.project_id == project.id,
                Section.id == body.section_id,
            )
        )
        section = section_result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        payloads = [
            quality_findings_service.grammar_match_to_finding_payload(
                document_id=body.document_id,
                section=section,
                text=body.text,
                match=match,
            )
            for match in result.matches
        ]
        await quality_findings_service.persist_findings_async(db, payloads)
        await db.commit()
    return result
