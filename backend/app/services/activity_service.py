"""Activity event recording and timeline generation."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import ActivityEvent


EVENT_WEIGHTS: dict[str, float] = {
    "source_sync": 2.0,
    "analysis_complete": 3.0,
    "analysis_failed": 2.0,
    "document_created": 2.5,
    "outline_approved": 2.0,
    "generation_run_started": 1.5,
    "generation_run_completed": 2.5,
    "generation_run_failed": 1.5,
    "section_generated": 1.0,
    "section_reviewed": 2.0,
    "section_updated": 0.5,
    "freshness_detected": 1.0,
    "freshness_accepted": 1.5,
    "freshness_rejected": 1.0,
    "project_created": 3.0,
    "project_updated": 0.5,
}

EVENT_MESSAGES: dict[str, str] = {
    "source_sync": "Source code synced",
    "analysis_complete": "Analysis completed",
    "analysis_failed": "Analysis failed",
    "document_created": "Document created",
    "outline_approved": "Outline approved",
    "generation_run_started": "Generation started",
    "generation_run_completed": "Generation completed",
    "generation_run_failed": "Generation failed",
    "section_generated": "Section generated",
    "section_reviewed": "Section reviewed",
    "section_updated": "Section updated",
    "freshness_detected": "Stale sections detected",
    "freshness_accepted": "Freshness update accepted",
    "freshness_rejected": "Freshness update rejected",
    "project_created": "Project created",
    "project_updated": "Project updated",
}


async def record_event(
    db: AsyncSession,
    project_id: int,
    event_type: str,
    *,
    analysis_id: int | None = None,
    document_id: int | None = None,
    section_id: int | None = None,
    generation_run_id: int | None = None,
    payload: dict[str, Any] | None = None,
) -> ActivityEvent:
    """
    Record an activity event with appropriate weight.
    Only records events that have a defined weight.
    """
    if event_type not in EVENT_WEIGHTS:
        return None

    event = ActivityEvent(
        project_id=project_id,
        event_type=event_type,
        weight=EVENT_WEIGHTS[event_type],
        analysis_id=analysis_id,
        document_id=document_id,
        section_id=section_id,
        generation_run_id=generation_run_id,
        payload=payload,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_timeline(
    db: AsyncSession,
    project_id: int,
    *,
    limit: int = 50,
    offset: int = 0,
    event_type: str | None = None,
    days: int | None = None,
) -> list[dict[str, Any]]:
    """
    Get activity timeline for a project.
    Excludes events with weight < 0.5 (noise).
    """
    query = select(ActivityEvent).where(
        ActivityEvent.project_id == project_id,
        ActivityEvent.weight >= 0.5,
    )

    if event_type:
        query = query.where(ActivityEvent.event_type == event_type)

    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(ActivityEvent.created_at >= cutoff)

    query = query.order_by(ActivityEvent.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(
        query.options(
            selectinload(ActivityEvent.document),
            selectinload(ActivityEvent.section),
            selectinload(ActivityEvent.analysis),
        )
    )
    events = list(result.scalars().all())

    return [
        {
            "id": event.id,
            "event_type": event.event_type,
            "weight": event.weight,
            "message": EVENT_MESSAGES.get(event.event_type, event.event_type),
            "document_title": event.document.title if event.document else None,
            "section_heading": event.section.heading if event.section else None,
            "analysis_status": event.analysis.status.value if event.analysis else None,
            "payload": event.payload,
            "created_at": event.created_at.isoformat() if event.created_at else None,
        }
        for event in events
    ]


async def get_heatmap_data(
    db: AsyncSession,
    project_id: int,
    *,
    days: int = 365,
) -> dict[str, float]:
    """
    Generate GitHub-style heatmap data.
    Returns {date_string: weighted_event_count} for the last N days.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            func.date_trunc("day", ActivityEvent.created_at).label("day"),
            func.sum(ActivityEvent.weight).label("total_weight"),
        )
        .where(
            ActivityEvent.project_id == project_id,
            ActivityEvent.created_at >= cutoff,
            ActivityEvent.weight >= 0.5,
        )
        .group_by(func.date_trunc("day", ActivityEvent.created_at))
        .order_by(func.date_trunc("day", ActivityEvent.created_at))
    )

    heatmap: dict[str, float] = {}
    for row in result.all():
        day_str = row.day.strftime("%Y-%m-%d") if row.day else None
        if day_str:
            heatmap[day_str] = float(row.total_weight)

    return heatmap


async def get_event_types(db: AsyncSession) -> list[str]:
    """Get list of event types that have been recorded."""
    result = await db.execute(
        select(ActivityEvent.event_type)
        .distinct()
        .order_by(ActivityEvent.event_type)
    )
    return [row[0] for row in result.all()]
