"""
quality_worker.py — Celery task that scores a Document's documentation quality.

Scores (all 0-100):
  completeness  – fraction of sections with substantial content (>100 words)
  acceptance_coverage – fraction of Template acceptance criteria with evidence of coverage
  readability   – Flesch reading ease mapped to 0-100
  consistency   – synonym-inconsistency penalty
  accuracy      – fraction of URLs that resolve successfully

overall = 0.25*completeness + 0.25*acceptance_coverage + 0.20*readability + 0.15*consistency + 0.15*accuracy
"""

import asyncio
import logging
import re
from collections import Counter
from datetime import datetime
from app.models.time import utcnow

import httpx
import textstat

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


# ── Synonym groups to detect inconsistencies ─────────────────────────────────
SYNONYM_GROUPS: list[list[str]] = [
    ["endpoint", "route", "path", "url"],
    ["user", "customer", "client", "member"],
    ["token", "credential", "key", "secret"],
    ["request", "payload", "body", "data"],
    ["response", "result", "output", "return"],
    ["error", "exception", "fault", "failure"],
    ["database", "db", "datastore", "store"],
    ["function", "method", "procedure", "handler"],
    ["parameter", "param", "argument", "arg"],
    ["configuration", "config", "settings", "options"],
]


def _word_count(text: str) -> int:
    return len(text.split())


def _score_completeness(sections: list) -> tuple[float, list[dict]]:
    """Completeness: fraction of sections with >100 words."""
    expected = max(len(sections), 6)
    filled = sum(1 for s in sections if _word_count(s.content_md or "") > 100)
    score = (filled / expected) * 100
    issues = []
    for s in sections:
        wc = _word_count(s.content_md or "")
        if wc == 0:
            issues.append({
                "category": "completeness",
                "severity": "error",
                "section_ref": s.heading,
                "message": f'Section "{s.heading}" has no content.',
                "suggestion": "Add content to this section or remove it from the outline.",
            })
        elif wc <= 100:
            issues.append({
                "category": "completeness",
                "severity": "warning",
                "section_ref": s.heading,
                "message": f'Section "{s.heading}" is thin ({wc} words).',
                "suggestion": "Expand this section to at least 100 words for better documentation quality.",
            })
    return min(score, 100.0), issues


def _criteria_for_section(section) -> list[str]:
    metadata = section.workflow_metadata or {}
    if not isinstance(metadata, dict):
        return []
    criteria = metadata.get("acceptance_criteria") or []
    if not isinstance(criteria, list):
        return []
    return [str(item).strip() for item in criteria if str(item).strip()]


def _has_source_reference(text: str) -> bool:
    return bool(
        re.search(r"\b[\w.-]+/[\w./-]+\b", text)
        or re.search(r"\b[\w.-]+\.(py|ts|tsx|js|jsx|json|toml|ya?ml|md|go|rs|java)\b", text)
        or re.search(r"\b(GET|POST|PUT|PATCH|DELETE)\s+/\S+", text)
        or re.search(r"\b[A-Z][A-Z0-9_]{2,}\b", text)
    )


def _has_structured_detail(text: str) -> bool:
    return bool(
        "```" in text
        or re.search(r"^\s*[-*]\s+\S+", text, re.MULTILINE)
        or re.search(r"^\s*\d+\.\s+\S+", text, re.MULTILINE)
        or "|" in text
        or re.search(r"\bexample\b|\brequest\b|\bresponse\b|\bdefault\b|\bfield\b|\bparameter\b", text, re.IGNORECASE)
    )


def _has_unknown_or_caveat(text: str) -> bool:
    return bool(re.search(r"\bunknown\b|\bmissing\b|\bnot shown\b|\bnot available\b|\bcaveat\b|\bassumption\b|\bunsupported\b", text, re.IGNORECASE))


def _criterion_is_covered(criterion: str, content: str) -> bool:
    words = _word_count(content)
    if words < 120:
        return False

    criterion_lower = criterion.lower()
    source_requested = any(
        term in criterion_lower
        for term in ("source", "evidence", "file path", "command", "api", "configuration", "schema", "ui label")
    )
    detail_requested = any(
        term in criterion_lower
        for term in ("field", "example", "caveat", "unknown", "summary paragraph", "default", "parameter")
    )
    unknown_requested = any(term in criterion_lower for term in ("unknown", "unsupported", "missing", "invent"))

    if source_requested and not _has_source_reference(content):
        return False
    if detail_requested and not _has_structured_detail(content):
        return False
    if unknown_requested and not (_has_unknown_or_caveat(content) or _has_source_reference(content)):
        return False
    return True


def _score_acceptance_coverage(sections: list) -> tuple[float, list[dict]]:
    total = 0
    covered = 0
    issues = []

    for section in sections:
        criteria = _criteria_for_section(section)
        if not criteria:
            continue
        content = section.content_md or ""
        for criterion in criteria:
            total += 1
            if _criterion_is_covered(criterion, content):
                covered += 1
            else:
                issues.append({
                    "category": "acceptance",
                    "severity": "warning",
                    "section_ref": section.heading,
                    "message": f'Acceptance criterion unmet for "{section.heading}": {criterion}',
                    "suggestion": "Revise this section with concrete source-grounded detail, examples, caveats, or unknowns before accepting review.",
                })

    if total == 0:
        return 100.0, []
    return round((covered / total) * 100, 1), issues


def _score_readability(combined: str) -> tuple[float, list[dict]]:
    """Readability via Flesch reading ease (0-100 already, but can go negative)."""
    if not combined.strip():
        return 50.0, []
    ease = textstat.flesch_reading_ease(combined)
    score = max(0.0, min(ease, 100.0))
    issues = []
    if score < 30:
        issues.append({
            "category": "readability",
            "severity": "warning",
            "section_ref": None,
            "message": "Documentation readability is very low (Flesch score: {:.1f}).".format(ease),
            "suggestion": "Use shorter sentences and simpler vocabulary to improve readability.",
        })
    elif score < 50:
        issues.append({
            "category": "readability",
            "severity": "info",
            "section_ref": None,
            "message": "Documentation readability is below average (Flesch score: {:.1f}).".format(ease),
            "suggestion": "Consider simplifying technical jargon where possible.",
        })
    return score, issues


def _score_consistency(sections: list) -> tuple[float, list[dict]]:
    """Detect synonym groups used inconsistently across sections."""
    all_text = " ".join((s.content_md or "") for s in sections).lower()
    words = re.findall(r"\b\w+\b", all_text)
    freq = Counter(words)

    inconsistencies = 0
    issues = []
    for group in SYNONYM_GROUPS:
        present = [w for w in group if freq[w] > 0]
        if len(present) >= 2:
            # Sort by frequency descending; the most common is "canonical"
            present_sorted = sorted(present, key=lambda w: freq[w], reverse=True)
            canonical = present_sorted[0]
            alternates = present_sorted[1:]
            inconsistencies += len(alternates)
            issues.append({
                "category": "terminology",
                "severity": "warning",
                "section_ref": None,
                "message": (
                    f'Inconsistent terminology: "{canonical}" ({freq[canonical]}×) '
                    f'and {", ".join(f"{w!r} ({freq[w]}×)" for w in alternates)} are used interchangeably.'
                ),
                "suggestion": f'Choose one term (e.g. "{canonical}") and use it consistently throughout.',
            })

    score = max(0.0, 100.0 - inconsistencies * 10)
    return score, issues


async def _check_url(client: httpx.AsyncClient, url: str) -> tuple[bool, int | None]:
    try:
        r = await client.head(url, timeout=5.0, follow_redirects=True)
        ok = r.status_code < 400
        return ok, r.status_code
    except Exception:
        return False, None


async def _score_accuracy_async(sections: list) -> tuple[float, list[dict], list[dict]]:
    """Check all URLs in content; return score, issues, broken_links."""
    url_pattern = re.compile(r"https?://[^\s\)\]\>\"\']+")
    url_to_sections: dict[str, list[str]] = {}
    for s in sections:
        for url in url_pattern.findall(s.content_md or ""):
            url_to_sections.setdefault(url, []).append(s.heading)

    if not url_to_sections:
        return 100.0, [], []

    broken_links = []
    issues = []
    ok_count = 0

    async with httpx.AsyncClient(verify=False) as client:
        tasks = {url: _check_url(client, url) for url in url_to_sections}
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    for url, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            ok, code = False, None
        else:
            ok, code = result

        if ok:
            ok_count += 1
        else:
            section_ref = url_to_sections[url][0]
            broken_links.append({
                "url": url,
                "status_code": code,
                "section_ref": section_ref,
            })
            issues.append({
                "category": "links",
                "severity": "error" if code is None else "warning",
                "section_ref": section_ref,
                "message": f"Broken link in section \"{section_ref}\": {url} "
                           + (f"(HTTP {code})" if code else "(connection error)"),
                "suggestion": "Update or remove this link.",
            })

    total = len(url_to_sections)
    score = (ok_count / total) * 100 if total else 100.0
    return score, issues, broken_links


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
    except RuntimeError:
        pass
    return asyncio.run(coro)


@celery_app.task(bind=True, max_retries=2)
def score_quality_task(self, document_id: int):
    """Main quality scoring Celery task."""
    from app.database import sync_session_factory
    from app.models.document import Document, Section, SectionStatus, SectionContentLifecycle
    from app.models.quality import QualityReport, QualityIssue, BrokenLink, IssueSeverity
    from app.services.quality_findings_service import (
        persist_findings_sync,
        quality_issue_to_finding_payload,
    )
    from sqlalchemy import or_

    logger.info("Quality scoring task %s started for document %s", self.request.id, document_id)
    try:
        with sync_session_factory() as db:
            # Fetch the selected Document + sections.
            doc = (
                db.query(Document)
                .filter(Document.id == document_id)
                .first()
            )
            if not doc:
                logger.warning("Quality scoring task %s could not find document %s", self.request.id, document_id)
                return {"error": "Document not found"}
            project_id = doc.project_id

            sections = (
                db.query(Section)
                .filter(
                    Section.document_id == doc.id,
                    or_(
                        Section.status == SectionStatus.FINALIZED,
                        Section.content_lifecycle == SectionContentLifecycle.REVIEWED,
                    ),
                )
                .order_by(Section.order_index)
                .all()
            )

            # If no finalized sections, use all sections (fallback for scoring purposes)
            if not sections:
                sections = (
                    db.query(Section)
                    .filter(Section.document_id == doc.id)
                    .order_by(Section.order_index)
                    .all()
                )

            logger.info(
                "Quality scoring task %s scoring document %s with %d sections",
                self.request.id,
                doc.id,
                len(sections),
            )

            # ── Run all scorers ──────────────────────────────────────────
            completeness, comp_issues = _score_completeness(sections)
            acceptance_coverage, acceptance_issues = _score_acceptance_coverage(sections)
            combined_text = " ".join((s.content_md or "") for s in sections)
            readability, read_issues = _score_readability(combined_text)
            consistency, cons_issues = _score_consistency(sections)
            accuracy, acc_issues, broken = _run_async(_score_accuracy_async(sections))

            overall = (
                0.25 * completeness
                + 0.25 * acceptance_coverage
                + 0.20 * readability
                + 0.15 * consistency
                + 0.15 * accuracy
            )

            # ── Upsert QualityReport without deleting durable findings ─────
            existing = (
                db.query(QualityReport)
                .filter(QualityReport.document_id == doc.id)
                .first()
            )
            if existing:
                db.query(QualityIssue).filter(QualityIssue.report_id == existing.id).delete()
                db.query(BrokenLink).filter(BrokenLink.report_id == existing.id).delete()
                report = existing
                report.overall_score = round(overall, 1)
                report.completeness = round(completeness, 1)
                report.acceptance_coverage = round(acceptance_coverage, 1)
                report.readability = round(readability, 1)
                report.consistency = round(consistency, 1)
                report.accuracy = round(accuracy, 1)
                report.generated_at = utcnow()
            else:
                report = QualityReport(
                    document_id=doc.id,
                    overall_score=round(overall, 1),
                    completeness=round(completeness, 1),
                    acceptance_coverage=round(acceptance_coverage, 1),
                    readability=round(readability, 1),
                    consistency=round(consistency, 1),
                    accuracy=round(accuracy, 1),
                    generated_at=utcnow(),
                )
                db.add(report)
            db.flush()  # get report.id
            report_id = report.id

            # ── Persist issues ────────────────────────────────────────────
            all_issues = comp_issues + acceptance_issues + read_issues + cons_issues + acc_issues
            finding_payloads = []
            for issue_data in all_issues:
                sev_str = issue_data.get("severity", "info")
                sev = IssueSeverity[sev_str.upper()]
                db.add(QualityIssue(
                    report_id=report.id,
                    severity=sev,
                    section_ref=issue_data.get("section_ref"),
                    message=issue_data["message"],
                    suggestion=issue_data.get("suggestion"),
                ))
                finding_payloads.append(
                    quality_issue_to_finding_payload(
                        document_id=doc.id,
                        report_id=report.id,
                        issue=issue_data,
                        sections=sections,
                    )
                )

            persist_findings_sync(db, finding_payloads)

            # ── Persist broken links ──────────────────────────────────────
            for bl in broken:
                db.add(BrokenLink(
                    report_id=report.id,
                    url=bl["url"],
                    status_code=bl.get("status_code"),
                    section_ref=bl.get("section_ref"),
                ))

            db.commit()
            logger.info(
                "Quality scoring task %s wrote report %s for document %s",
                self.request.id,
                report_id,
                document_id,
            )
            result_payload = {
                "project_id": project_id,
                "overall": round(overall, 1),
                "completeness": round(completeness, 1),
                "acceptance_coverage": round(acceptance_coverage, 1),
                "readability": round(readability, 1),
                "consistency": round(consistency, 1),
                "accuracy": round(accuracy, 1),
            }

        return result_payload
    except Exception:
        logger.exception("Quality scoring task %s failed for document %s", self.request.id, document_id)
        raise
