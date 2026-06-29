from __future__ import annotations

import hashlib
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, selectinload

from app.models.document import Document, Section
from app.models.quality import (
    IssueSeverity,
    QualityFinding,
    QualityFindingCategory,
    QualityFindingStatus,
    QualityReport,
)
from app.models.time import utcnow
from app.schemas.ai_work import AIProposedChangeCreate, AIProposedChangeTypeEnum, AIWorkRunCreateRequest
from app.services import ai_work_service


TERMINAL_FINDING_STATUSES = {
    QualityFindingStatus.DISMISSED,
    QualityFindingStatus.RESOLVED,
    QualityFindingStatus.PROPOSED,
}


def content_fingerprint(*parts: Any) -> str:
    normalized = "\n".join("" if part is None else str(part).strip().lower() for part in parts)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def finding_to_response(finding: QualityFinding) -> dict[str, Any]:
    return {
        "id": finding.id,
        "document_id": finding.document_id,
        "report_id": finding.report_id,
        "category": finding.category.value,
        "status": finding.status.value,
        "severity": finding.severity.value,
        "section_id": finding.section_id,
        "section_ref": finding.section_ref,
        "message": finding.message,
        "suggestion": finding.suggestion,
        "quote": finding.quote,
        "offset": finding.offset,
        "length": finding.length,
        "replacements": finding.replacements or [],
        "rule_id": finding.rule_id,
        "content_fingerprint": finding.content_fingerprint,
        "provider": finding.provider,
        "provider_metadata": finding.provider_metadata,
        "stale_location": bool(finding.stale_location),
        "first_seen_at": finding.first_seen_at,
        "last_seen_at": finding.last_seen_at,
    }


def _category(value: str | QualityFindingCategory) -> QualityFindingCategory:
    if isinstance(value, QualityFindingCategory):
        return value
    return QualityFindingCategory(value)


def _severity(value: str | IssueSeverity | None) -> IssueSeverity:
    if isinstance(value, IssueSeverity):
        return value
    return IssueSeverity((value or "info").lower())


def _status(value: str | QualityFindingStatus) -> QualityFindingStatus:
    if isinstance(value, QualityFindingStatus):
        return value
    return QualityFindingStatus(value)


def _section_map(sections: Iterable[Section]) -> dict[str, Section]:
    return {
        (section.heading or section.title or "").strip().lower(): section
        for section in sections
        if (section.heading or section.title or "").strip()
    }


def _finding_payload(
    *,
    document_id: int,
    report_id: int | None,
    category: str | QualityFindingCategory,
    severity: str | IssueSeverity | None = None,
    section_id: int | None = None,
    section_ref: str | None = None,
    message: str,
    suggestion: str | None = None,
    quote: str | None = None,
    offset: int | None = None,
    length: int | None = None,
    replacements: list[str] | None = None,
    rule_id: str | None = None,
    fingerprint: str | None = None,
    provider: str | None = None,
    provider_metadata: dict[str, Any] | None = None,
    stale_location: bool = False,
) -> dict[str, Any]:
    cat = _category(category)
    return {
        "document_id": document_id,
        "report_id": report_id,
        "category": cat,
        "severity": _severity(severity),
        "section_id": section_id,
        "section_ref": section_ref,
        "message": message,
        "suggestion": suggestion,
        "quote": quote,
        "offset": offset,
        "length": length,
        "replacements": replacements or [],
        "rule_id": rule_id,
        "content_fingerprint": fingerprint
        or content_fingerprint(cat.value, section_id, section_ref, quote, rule_id, message),
        "provider": provider,
        "provider_metadata": provider_metadata,
        "stale_location": stale_location,
    }


def quality_issue_to_finding_payload(
    *,
    document_id: int,
    report_id: int,
    issue: dict[str, Any],
    sections: Iterable[Section],
) -> dict[str, Any]:
    section_ref = issue.get("section_ref")
    section = _section_map(sections).get(str(section_ref or "").strip().lower())
    message = str(issue["message"])
    category = issue.get("category")
    if not category:
        lowered = message.lower()
        if "acceptance criterion" in lowered:
            category = QualityFindingCategory.ACCEPTANCE
        elif "readability" in lowered or "flesch" in lowered:
            category = QualityFindingCategory.READABILITY
        elif "terminology" in lowered or "inconsistent" in lowered:
            category = QualityFindingCategory.TERMINOLOGY
        elif "broken link" in lowered:
            category = QualityFindingCategory.LINKS
        else:
            category = QualityFindingCategory.COMPLETENESS
    return _finding_payload(
        document_id=document_id,
        report_id=report_id,
        category=category,
        severity=issue.get("severity"),
        section_id=section.id if section else None,
        section_ref=section_ref,
        message=message,
        suggestion=issue.get("suggestion"),
        fingerprint=content_fingerprint(category, section.id if section else None, section_ref, message),
    )


def persist_findings_sync(db: Session, payloads: Iterable[dict[str, Any]]) -> list[QualityFinding]:
    persisted: list[QualityFinding] = []
    now = utcnow()
    for payload in payloads:
        existing = (
            db.query(QualityFinding)
            .filter(
                QualityFinding.document_id == payload["document_id"],
                QualityFinding.category == payload["category"],
                QualityFinding.content_fingerprint == payload["content_fingerprint"],
            )
            .first()
        )
        if existing:
            existing.report_id = payload.get("report_id")
            existing.severity = payload["severity"]
            existing.section_id = payload.get("section_id")
            existing.section_ref = payload.get("section_ref")
            existing.message = payload["message"]
            existing.suggestion = payload.get("suggestion")
            existing.quote = payload.get("quote")
            existing.offset = payload.get("offset")
            existing.length = payload.get("length")
            existing.replacements = payload.get("replacements") or []
            existing.rule_id = payload.get("rule_id")
            existing.provider = payload.get("provider")
            existing.provider_metadata = payload.get("provider_metadata")
            existing.stale_location = bool(payload.get("stale_location"))
            existing.last_seen_at = now
            persisted.append(existing)
            continue
        finding = QualityFinding(status=QualityFindingStatus.OPEN, first_seen_at=now, last_seen_at=now, **payload)
        db.add(finding)
        persisted.append(finding)
    return persisted


async def persist_findings_async(db: AsyncSession, payloads: Iterable[dict[str, Any]]) -> list[QualityFinding]:
    persisted: list[QualityFinding] = []
    now = utcnow()
    for payload in payloads:
        result = await db.execute(
            select(QualityFinding).where(
                QualityFinding.document_id == payload["document_id"],
                QualityFinding.category == payload["category"],
                QualityFinding.content_fingerprint == payload["content_fingerprint"],
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.report_id = payload.get("report_id")
            existing.severity = payload["severity"]
            existing.section_id = payload.get("section_id")
            existing.section_ref = payload.get("section_ref")
            existing.message = payload["message"]
            existing.suggestion = payload.get("suggestion")
            existing.quote = payload.get("quote")
            existing.offset = payload.get("offset")
            existing.length = payload.get("length")
            existing.replacements = payload.get("replacements") or []
            existing.rule_id = payload.get("rule_id")
            existing.provider = payload.get("provider")
            existing.provider_metadata = payload.get("provider_metadata")
            existing.stale_location = bool(payload.get("stale_location"))
            existing.last_seen_at = now
            persisted.append(existing)
            continue
        finding = QualityFinding(status=QualityFindingStatus.OPEN, first_seen_at=now, last_seen_at=now, **payload)
        db.add(finding)
        persisted.append(finding)
    await db.flush()
    return persisted


def grammar_match_to_finding_payload(
    *,
    document_id: int,
    section: Section,
    text: str,
    match: Any,
    provider: str = "languagetool",
) -> dict[str, Any]:
    start = max(0, int(match.offset))
    end = max(start, start + int(match.length))
    quote = text[start:end]
    replacements = [item.value for item in match.replacements]
    current_section_fingerprint = content_fingerprint(section.id, section.content_md or "")
    stale_location = current_section_fingerprint != content_fingerprint(section.id, text)
    return _finding_payload(
        document_id=document_id,
        report_id=None,
        category=QualityFindingCategory.GRAMMAR,
        severity="warning",
        section_id=section.id,
        section_ref=section.heading,
        message=match.message,
        suggestion=replacements[0] if replacements else match.short_message or None,
        quote=quote,
        offset=start,
        length=int(match.length),
        replacements=replacements,
        rule_id=match.rule_id,
        fingerprint=content_fingerprint(
            QualityFindingCategory.GRAMMAR.value,
            section.id,
            quote,
            match.rule_id,
            match.message,
        ),
        provider=provider,
        provider_metadata={"rule_issue_type": match.rule_issue_type, "short_message": match.short_message},
        stale_location=stale_location,
    )


async def list_findings(
    db: AsyncSession,
    document_id: int,
    *,
    section_id: int | None = None,
    category: str | None = None,
    status: str | None = None,
) -> list[QualityFinding]:
    query = select(QualityFinding).where(QualityFinding.document_id == document_id)
    if section_id is not None:
        query = query.where(QualityFinding.section_id == section_id)
    if category:
        query = query.where(QualityFinding.category == _category(category))
    if status:
        query = query.where(QualityFinding.status == _status(status))
    query = query.order_by(QualityFinding.status, QualityFinding.category, QualityFinding.last_seen_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def quality_context(db: AsyncSession, document_id: int, section_id: int | None = None) -> dict[str, Any]:
    report_result = await db.execute(
        select(QualityReport)
        .where(QualityReport.document_id == document_id)
        .order_by(QualityReport.generated_at.desc(), QualityReport.id.desc())
        .limit(1)
    )
    report = report_result.scalar_one_or_none()

    findings_query = select(QualityFinding).where(
        QualityFinding.document_id == document_id,
        QualityFinding.status.in_([QualityFindingStatus.OPEN, QualityFindingStatus.PROPOSED]),
    )
    if section_id is not None:
        section_findings_result = await db.execute(
            findings_query.where(QualityFinding.section_id == section_id).order_by(QualityFinding.category)
        )
        section_findings = list(section_findings_result.scalars().all())
    else:
        section_findings = []

    summary_result = await db.execute(findings_query.order_by(QualityFinding.category, QualityFinding.last_seen_at.desc()))
    all_findings = list(summary_result.scalars().all())
    counts: dict[str, int] = {}
    for finding in all_findings:
        counts[finding.category.value] = counts.get(finding.category.value, 0) + 1

    return {
        "summary": {
            "overall_score": report.overall_score if report else None,
            "completeness": report.completeness if report else None,
            "acceptance_coverage": report.acceptance_coverage if report else None,
            "readability": report.readability if report else None,
            "consistency": report.consistency if report else None,
            "accuracy": report.accuracy if report else None,
            "unresolved_counts": counts,
        },
        "active_section_findings": [
            {
                "id": finding.id,
                "category": finding.category.value,
                "status": finding.status.value,
                "severity": finding.severity.value,
                "message": finding.message,
                "suggestion": finding.suggestion,
                "quote": finding.quote,
                "replacements": finding.replacements or [],
                "rule_id": finding.rule_id,
            }
            for finding in section_findings[:20]
        ],
    }


async def _findings_for_fix(
    db: AsyncSession,
    document_id: int,
    *,
    finding_id: int | None = None,
    category: str | None = None,
    section_id: int | None = None,
    status: str | None = "open",
) -> list[QualityFinding]:
    query = (
        select(QualityFinding)
        .where(QualityFinding.document_id == document_id)
        .options(selectinload(QualityFinding.section))
    )
    if finding_id is not None:
        query = query.where(QualityFinding.id == finding_id)
    if category:
        query = query.where(QualityFinding.category == _category(category))
    if section_id is not None:
        query = query.where(QualityFinding.section_id == section_id)
    if status:
        query = query.where(QualityFinding.status == _status(status))
    result = await db.execute(query.order_by(QualityFinding.category, QualityFinding.id))
    return list(result.scalars().all())


def _apply_grammar_replacements(content: str, findings: list[QualityFinding]) -> str:
    result = content
    for finding in sorted(findings, key=lambda item: item.offset or 0, reverse=True):
        replacement = (finding.replacements or [finding.suggestion or ""])[0]
        if not replacement:
            continue
        offset = finding.offset
        length = finding.length or 0
        quote = finding.quote or ""
        if offset is not None and result[offset:offset + length] == quote:
            result = result[:offset] + replacement + result[offset + length:]
            continue
        if quote and quote in result:
            result = result.replace(quote, replacement, 1)
    return result


def _fallback_rewrite(content: str, findings: list[QualityFinding]) -> str:
    notes = "\n".join(
        f"- {finding.category.value}: {finding.message}"
        + (f" Suggestion: {finding.suggestion}" if finding.suggestion else "")
        for finding in findings
    )
    return f"{content.rstrip()}\n\n<!-- AI quality repair requested:\n{notes}\n-->"


async def create_ai_fix_work_run(
    db: AsyncSession,
    document: Document,
    *,
    user_id: int,
    finding_id: int | None = None,
    category: str | None = None,
    section_id: int | None = None,
    status: str | None = "open",
    action: str = "fix_findings",
) -> Any:
    findings = await _findings_for_fix(
        db,
        document.id,
        finding_id=finding_id,
        category=category,
        section_id=section_id,
        status=status,
    )
    if not findings:
        return None

    by_section: dict[int, list[QualityFinding]] = {}
    for finding in findings:
        if finding.section_id is None or finding.section is None:
            continue
        by_section.setdefault(finding.section_id, []).append(finding)

    changes: list[AIProposedChangeCreate] = []
    for target_section_id, section_findings in by_section.items():
        section = section_findings[0].section
        before = section.content_md or ""
        if all(finding.category == QualityFindingCategory.GRAMMAR for finding in section_findings):
            after = _apply_grammar_replacements(before, section_findings)
        else:
            after = _fallback_rewrite(before, section_findings)
        if after == before:
            after = _fallback_rewrite(before, section_findings)
        changes.append(
            AIProposedChangeCreate(
                change_type=AIProposedChangeTypeEnum.REWRITE_SELECTION,
                title=f"Address {len(section_findings)} quality finding{'s' if len(section_findings) != 1 else ''}",
                section_id=target_section_id,
                rationale=f"User-triggered quality repair: {action}",
                before={"content_md": before},
                after={"content_md": after},
                preview_markdown=after,
            )
        )

    if not changes:
        return None

    context = await quality_context(db, document.id, section_id=section_id)
    for finding in findings:
        finding.status = QualityFindingStatus.PROPOSED
    work_run = await ai_work_service.create_work_run(
        db,
        document,
        AIWorkRunCreateRequest(
            provider="quality-findings",
            model="review-proposal",
            prompt_context={
                "source": "quality_finding_fix",
                "action": action,
                "finding_ids": [finding.id for finding in findings],
                "quality_context": context,
            },
            changes=changes,
        ),
        user_id,
    )
    return work_run
