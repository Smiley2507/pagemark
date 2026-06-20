"""Freshness detection service for identifying and managing stale sections."""

from __future__ import annotations

from datetime import datetime
from app.models.time import utcnow
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.analysis import Analysis, AnalysisStatus
from app.models.document import (
    Document,
    Section,
    SectionContentLifecycle,
    SectionStatus,
    LifecycleStatus,
)
from app.models.evidence import EvidenceReference


async def detect_stale_sections(
    db: AsyncSession,
    document_id: int,
    new_analysis_id: int,
) -> list[int]:
    """
    Compare reviewed sections against new analysis facts.
    Returns list of section IDs that may be stale.
    """
    new_analysis = await db.get(Analysis, new_analysis_id)
    if not new_analysis:
        return []

    result = await db.execute(
        select(Section)
        .where(
            Section.document_id == document_id,
            Section.lifecycle_status == LifecycleStatus.ACTIVE,
            Section.content_lifecycle == SectionContentLifecycle.REVIEWED,
        )
        .options(selectinload(Section.evidence_references))
    )
    sections = list(result.scalars().all())

    stale_ids: list[int] = []
    for section in sections:
        # Generate a fingerprint of current analysis facts
        old_analysis_id = section.reviewed_against_analysis_id

        # If reviewed against an older analysis, check for changes
        if old_analysis_id and old_analysis_id != new_analysis_id:
            old_analysis = await db.get(Analysis, old_analysis_id)
            if old_analysis and _has_significant_changes(old_analysis, new_analysis):
                stale_ids.append(section.id)

        # Check evidence references still relevant
        for evidence in section.evidence_references or []:
            if not _evidence_still_valid(evidence, new_analysis):
                stale_ids.append(section.id)
                break

    return list(set(stale_ids))


async def generate_update_proposal(
    db: AsyncSession,
    section_id: int,
    new_analysis_id: int,
) -> dict[str, Any]:
    """
    Generate a source-grounded update proposal for a stale section.
    Describes what changed in the analysis that affects this section.
    """
    section = await db.get(Section, section_id)
    if not section:
        return {"error": "Section not found"}

    new_analysis = await db.get(Analysis, new_analysis_id)
    if not new_analysis:
        return {"error": "Analysis not found"}

    old_analysis_id = section.reviewed_against_analysis_id
    old_analysis = await db.get(Analysis, old_analysis_id) if old_analysis_id else None

    changes: dict[str, Any] = {
        "section_id": section_id,
        "section_heading": section.heading,
        "new_analysis_id": new_analysis_id,
        "old_analysis_id": old_analysis_id,
        "changed_domains": [],
        "summary": "",
    }

    if old_analysis and new_analysis:
        changes["changed_domains"] = _find_changed_domains(old_analysis, new_analysis)
        changes["summary"] = _build_change_summary(changes["changed_domains"], section.heading)

    return changes


async def apply_freshness_update(
    db: AsyncSession,
    section_id: int,
    accept: bool,
) -> Section | None:
    """
    Apply or reject a freshness update on a section.
    If accepted: clear the stale flag. The maintainer will regenerate content.
    If rejected: mark section as reviewed-as-is with current analysis.
    """
    section = await db.get(Section, section_id)
    if not section:
        return None

    if accept:
        section.is_potentially_stale = False
    else:
        section.is_potentially_stale = False
        section.content_lifecycle = SectionContentLifecycle.REVIEWED
        section.status = SectionStatus.FINALIZED

    section.updated_at = utcnow()
    await db.commit()
    await db.refresh(section)
    return section


async def refresh_document_freshness(
    db: AsyncSession,
    document_id: int,
    new_analysis_id: int,
) -> dict[str, Any]:
    """
    Trigger stale detection for all reviewed sections in a document.
    Returns summary of stale sections detected.
    """
    stale_ids = await detect_stale_sections(db, document_id, new_analysis_id)

    # Mark stale sections
    if stale_ids:
        for section_id in stale_ids:
            section = await db.get(Section, section_id)
            if section:
                section.is_potentially_stale = True
        await db.commit()

    proposals = []
    for section_id in stale_ids:
        proposal = await generate_update_proposal(db, section_id, new_analysis_id)
        proposals.append(proposal)

    return {
        "document_id": document_id,
        "new_analysis_id": new_analysis_id,
        "stale_section_count": len(stale_ids),
        "stale_section_ids": stale_ids,
        "proposals": proposals,
    }


def _has_significant_changes(old: Analysis, new: Analysis) -> bool:
    """Check if there are significant changes between two analyses."""
    changed_domains = _find_changed_domains(old, new)
    return len(changed_domains) > 0


def _find_changed_domains(old: Analysis, new: Analysis) -> list[dict[str, Any]]:
    """Find what domains changed between two analyses."""
    changes: list[dict[str, Any]] = []

    # Check source code changes
    if old.source_commit and new.source_commit and old.source_commit != new.source_commit:
        changes.append({
            "domain": "source_code",
            "detail": f"Source commit changed from {old.source_commit[:8]} to {new.source_commit[:8]}",
        })

    # Check file tree changes
    if _json_changed(old.file_tree_json, new.file_tree_json):
        changes.append({
            "domain": "file_tree",
            "detail": "File structure has changed",
        })

    # Check endpoint changes
    if _json_changed(old.endpoints_json, new.endpoints_json):
        changes.append({
            "domain": "endpoints",
            "detail": "API endpoints have changed",
        })

    # Check language changes
    if _json_changed(old.languages_json, new.languages_json):
        changes.append({
            "domain": "languages",
            "detail": "Language composition has changed",
        })

    return changes


def _find_changed_endpoints(
    old_endpoints: list[dict] | None,
    new_endpoints: list[dict] | None,
) -> list[dict]:
    """Compare old vs new endpoints and describe differences."""
    old_set = {ep.get("path", "") for ep in (old_endpoints or []) if isinstance(ep, dict)}
    new_set = {ep.get("path", "") for ep in (new_endpoints or []) if isinstance(ep, dict)}

    added = new_set - old_set
    removed = old_set - new_set

    changes = []
    if added:
        changes.append({"type": "added", "paths": sorted(added)})
    if removed:
        changes.append({"type": "removed", "paths": sorted(removed)})
    return changes


def _build_change_summary(changed_domains: list[dict[str, Any]], heading: str) -> str:
    """Build a human-readable summary of changes."""
    if not changed_domains:
        return f"No significant changes detected for '{heading}'."

    parts = [f"Source changes may affect '{heading}':"]
    for domain in changed_domains:
        parts.append(f"- {domain['detail']}")
    return " ".join(parts)


def _evidence_still_valid(evidence: EvidenceReference, new_analysis: Analysis) -> bool:
    """
    Check if an evidence reference is still valid in new analysis.
    Simple check: same analysis_id means valid.
    More sophisticated checks would compare specific artifacts.
    """
    return evidence.analysis_id == new_analysis.id


def _json_changed(old: Any, new: Any) -> bool:
    """Check if two JSON values are meaningfully different."""
    if old is None and new is None:
        return False
    if old is None or new is None:
        return True

    if isinstance(old, dict) and isinstance(new, dict):
        old_str = str(sorted((k, str(v)) for k, v in old.items()))
        new_str = str(sorted((k, str(v)) for k, v in new.items()))
        return old_str != new_str

    if isinstance(old, list) and isinstance(new, list):
        old_str = str(sorted(str(item) for item in old))
        new_str = str(sorted(str(item) for item in new))
        return old_str != new_str

    return str(old) != str(new)


async def get_document_freshness_status(
    db: AsyncSession,
    document_id: int,
) -> dict[str, Any]:
    """Get current freshness status for a document."""
    result = await db.execute(
        select(Section)
        .where(
            Section.document_id == document_id,
            Section.lifecycle_status == LifecycleStatus.ACTIVE,
        )
    )
    sections = list(result.scalars().all())

    stale_sections = [
        {
            "id": s.id,
            "heading": s.heading,
            "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
        }
        for s in sections
        if s.is_potentially_stale
    ]

    return {
        "document_id": document_id,
        "freshness": "potentially_stale" if stale_sections else "fresh",
        "stale_sections": stale_sections,
        "total_sections": len(sections),
        "stale_count": len(stale_sections),
    }
