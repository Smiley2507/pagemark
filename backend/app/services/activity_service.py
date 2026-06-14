"""Activity event recording and timeline generation."""

from __future__ import annotations
import logging

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import ActivityEvent
from app.models.project import Project


EVENT_WEIGHTS: dict[str, float] = {
    "source_webhook_received": 2.0,
    "source_sync": 2.0,
    "analysis_complete": 3.0,
    "analysis_started": 3.0,
    "analysis_failed": 2.0,
    "document_created": 2.5,
    "outline_approved": 2.0,
    "generation_run_started": 1.5,
    "generation_run_completed": 2.5,
    "generation_run_failed": 1.5,
    "ai_chat_completed": 0.75,
    "section_generated": 1.0,
    "section_reviewed": 2.0,
    "section_updated": 0.5,
    "freshness_detected": 1.0,
    "freshness_accepted": 1.5,
    "freshness_rejected": 1.0,
    "project_created": 3.0,
    "project_updated": 0.5,
    "document_shared": 2.0,
    "share_updated": 1.5,
    "share_revoked": 1.5,
}

EVENT_MESSAGES: dict[str, str] = {
    "source_webhook_received": "Webhook push received",
    "source_sync": "Source code synced",
    "analysis_complete": "Analysis completed",
    "analysis_started": "Analysis started",
    "analysis_failed": "Analysis failed",
    "document_created": "Document created",
    "outline_approved": "Outline approved",
    "generation_run_started": "Generation started",
    "generation_run_completed": "Generation completed",
    "generation_run_failed": "Generation failed",
    "ai_chat_completed": "AI response completed",
    "section_generated": "Section generated",
    "section_reviewed": "Section reviewed",
    "section_updated": "Section updated",
    "freshness_detected": "Stale sections detected",
    "freshness_accepted": "Freshness update accepted",
    "freshness_rejected": "Freshness update rejected",
    "project_created": "Project created",
    "project_updated": "Project updated",
    "document_shared": "Document shared",
    "share_updated": "Share updated",
    "share_revoked": "Share revoked",
}


EVENT_CATEGORIES: dict[str, str] = {
    "source_webhook_received": "Source",
    "source_sync": "Source",
    "analysis_complete": "Source",
    "analysis_started": "Source",
    "analysis_failed": "Source",
    "document_created": "Documents",
    "outline_approved": "Documents",
    "generation_run_started": "Generation",
    "generation_run_completed": "Generation",
    "generation_run_failed": "Generation",
    "ai_chat_completed": "Generation",
    "section_generated": "Generation",
    "section_reviewed": "Review",
    "section_updated": "Review",
    "freshness_detected": "Review",
    "freshness_accepted": "Review",
    "freshness_rejected": "Review",
    "project_created": "Project",
    "project_updated": "Project",
    "document_shared": "Sharing",
    "share_updated": "Sharing",
    "share_revoked": "Sharing",
}


def _activity_event_to_dict(event: ActivityEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "project_id": event.project_id,
        "project_name": event.project.name if event.project else None,
        "event_type": event.event_type,
        "weight": event.weight,
        "message": (event.payload or {}).get("message") or EVENT_MESSAGES.get(event.event_type, event.event_type),
        "document_title": event.document.title if event.document else None,
        "section_heading": event.section.heading if event.section else None,
        "analysis_status": event.analysis.status.value if event.analysis else None,
        "payload": event.payload,
        "created_at": event.created_at.isoformat() if event.created_at else None,
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
    message: str | None = None,
    payload: dict[str, Any] | None = None,
) -> ActivityEvent:
    """
    Record an activity event with appropriate weight.
    Only records events that have a defined weight.
    """
    if event_type not in EVENT_WEIGHTS:
        logger.warning("Unknown event_type '%s' — skipping", event_type)
        return None

    merged_payload = dict(payload or {})
    if message:
        merged_payload["message"] = message

    event = ActivityEvent(
        project_id=project_id,
        event_type=event_type,
        weight=EVENT_WEIGHTS[event_type],
        analysis_id=analysis_id,
        document_id=document_id,
        section_id=section_id,
        generation_run_id=generation_run_id,
        payload=merged_payload if merged_payload else None,
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

    return [_activity_event_to_dict(event) for event in events]


async def get_recent_for_org(
    db: AsyncSession,
    org_id: int,
    *,
    limit: int = 20,
    days: int | None = 30,
) -> list[dict[str, Any]]:
    """
    Get recent meaningful activity across an organization for notification delivery.
    """
    query = (
        select(ActivityEvent)
        .join(Project, Project.id == ActivityEvent.project_id)
        .where(
            Project.org_id == org_id,
            Project.deleted_at.is_(None),
            ActivityEvent.weight >= 1.0,
        )
    )

    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.where(ActivityEvent.created_at >= cutoff)

    query = query.order_by(ActivityEvent.created_at.desc()).limit(limit)

    result = await db.execute(
        query.options(
            selectinload(ActivityEvent.project),
            selectinload(ActivityEvent.document),
            selectinload(ActivityEvent.section),
            selectinload(ActivityEvent.analysis),
        )
    )
    return [_activity_event_to_dict(event) for event in result.scalars().all()]


async def get_heatmap_data(
    db: AsyncSession,
    project_id: int,
    *,
    days: int = 365,
) -> list[dict[str, Any]]:
    """
    Return daily/weekly activity data broken down by event category.
    For days <= 90 uses daily aggregation; for > 90 uses weekly aggregation.

    Returns a list of::
        {"date": "2026-06-10", "total": 5.0, "categories": {"Source": 2.0, "Review": 1.5}}
    """
    daily = days <= 90
    trunc = func.date_trunc("day" if daily else "week", ActivityEvent.created_at)
    cutoff = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            trunc.label("bucket"),
            ActivityEvent.event_type,
            func.sum(ActivityEvent.weight).label("total_weight"),
        )
        .where(
            ActivityEvent.project_id == project_id,
            ActivityEvent.created_at >= cutoff,
            ActivityEvent.weight >= 0.5,
        )
        .group_by("bucket", ActivityEvent.event_type)
        .order_by("bucket")
    )

    buckets: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for row in result.all():
        key = row.bucket.strftime("%Y-%m-%d")
        cat = EVENT_CATEGORIES.get(row.event_type, "Other")
        buckets[key][cat] += float(row.total_weight)

    now = datetime.utcnow()
    rows: list[dict[str, Any]] = []
    if daily:
        for i in range(days):
            dt = now - timedelta(days=days - 1 - i)
            key = dt.strftime("%Y-%m-%d")
            cats = dict(buckets.get(key, {}))
            rows.append({
                "date": key,
                "label": dt.strftime("%b %d"),
                "total": sum(cats.values()),
                "categories": cats,
            })
    else:
        cutoff_dt = now - timedelta(days=days - 1)
        cutoff_monday = cutoff_dt - timedelta(days=cutoff_dt.weekday())
        num_weeks = (now - cutoff_monday).days // 7 + 1
        for i in range(num_weeks):
            dt = cutoff_monday + timedelta(weeks=i)
            key = dt.strftime("%Y-%m-%d")
            cats = dict(buckets.get(key, {}))
            rows.append({
                "date": key,
                "label": f"Week of {dt.strftime('%b %d')}",
                "total": sum(cats.values()),
                "categories": cats,
            })

    return rows


async def get_event_types(db: AsyncSession) -> list[str]:
    """Get list of event types that have been recorded."""
    result = await db.execute(
        select(ActivityEvent.event_type)
        .distinct()
        .order_by(ActivityEvent.event_type)
    )
    return [row[0] for row in result.all()]
