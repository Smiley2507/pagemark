from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import ActivityEvent
from app.models.document import (
    Document,
    DocumentStatus,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.generation import GenerationRun, GenerationRunStatus
from app.models.project import Project


@dataclass
class ProjectSummary:
    completion_pct: float
    documents_count: int
    sections_count: int
    active_generation: bool
    sections_needing_input: int
    review_state: str
    freshness_state: str
    recent_activity_at: datetime | None


def _active_sections(document: Document) -> list[Section]:
    return [
        section
        for section in document.sections
        if section.lifecycle_status == LifecycleStatus.ACTIVE
    ]


def _completion_pct(sections: list[Section]) -> float:
    if not sections:
        return 0.0
    reviewed = sum(
        1
        for section in sections
        if section.content_lifecycle == SectionContentLifecycle.REVIEWED
        or section.status == SectionStatus.FINALIZED
    )
    return round(reviewed / len(sections) * 100, 1)


def _review_state(documents: list[Document], sections: list[Section]) -> str:
    if not documents or not sections:
        return "not_started"
    if any(document.status == DocumentStatus.APPROVED for document in documents):
        return "approved"
    if any(document.status == DocumentStatus.IN_REVIEW for document in documents):
        return "in_review"
    if any(
        section.content_lifecycle == SectionContentLifecycle.GENERATED_DRAFT
        or section.status == SectionStatus.DRAFT
        for section in sections
    ):
        return "draft"
    if all(
        section.content_lifecycle == SectionContentLifecycle.REVIEWED
        or section.status == SectionStatus.FINALIZED
        for section in sections
    ):
        return "reviewed"
    return "not_started"


def _freshness_state(documents: list[Document], sections: list[Section]) -> str:
    if any(document.freshness_state == "potentially_stale" for document in documents):
        return "potentially_stale"
    if any(section.is_potentially_stale for section in sections):
        return "potentially_stale"
    return "fresh"


async def summarize_project(db: AsyncSession, project: Project) -> ProjectSummary:
    documents_result = await db.execute(
        select(Document)
        .where(Document.project_id == project.id)
        .options(selectinload(Document.sections))
        .order_by(Document.updated_at.desc(), Document.id.desc())
    )
    documents = list(documents_result.scalars().all())
    sections = [section for document in documents for section in _active_sections(document)]

    generation_count_result = await db.execute(
        select(func.count(GenerationRun.id)).join(Document).where(
            Document.project_id == project.id,
            GenerationRun.status.in_(
                [
                    GenerationRunStatus.PENDING,
                    GenerationRunStatus.RUNNING,
                    GenerationRunStatus.PAUSED,
                ]
            ),
        )
    )
    recent_activity_result = await db.execute(
        select(func.max(ActivityEvent.created_at)).where(ActivityEvent.project_id == project.id)
    )

    sections_needing_input = sum(
        1
        for section in sections
        if section.needs_input or section.status == SectionStatus.NEEDS_INPUT
    )

    return ProjectSummary(
        completion_pct=_completion_pct(sections),
        documents_count=len(documents),
        sections_count=len(sections),
        active_generation=(generation_count_result.scalar_one() or 0) > 0,
        sections_needing_input=sections_needing_input,
        review_state=_review_state(documents, sections),
        freshness_state=_freshness_state(documents, sections),
        recent_activity_at=recent_activity_result.scalar_one_or_none() or project.updated_at,
    )
