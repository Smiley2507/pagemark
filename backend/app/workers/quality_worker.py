"""
quality_worker.py — Celery task that scores a Document's documentation quality.

Scores (all 0-100):
  completeness  – fraction of sections with substantial content (>100 words)
  readability   – Flesch reading ease mapped to 0-100
  consistency   – synonym-inconsistency penalty
  accuracy      – fraction of URLs that resolve successfully

overall = 0.30*completeness + 0.25*readability + 0.25*consistency + 0.20*accuracy
"""

import asyncio
import re
from collections import Counter
from datetime import datetime

import httpx
import textstat

from app.workers.celery_app import celery_app


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
                "severity": "error",
                "section_ref": s.heading,
                "message": f'Section "{s.heading}" has no content.',
                "suggestion": "Add content to this section or remove it from the outline.",
            })
        elif wc <= 100:
            issues.append({
                "severity": "warning",
                "section_ref": s.heading,
                "message": f'Section "{s.heading}" is thin ({wc} words).',
                "suggestion": "Expand this section to at least 100 words for better documentation quality.",
            })
    return min(score, 100.0), issues


def _score_readability(combined: str) -> tuple[float, list[dict]]:
    """Readability via Flesch reading ease (0-100 already, but can go negative)."""
    if not combined.strip():
        return 50.0, []
    ease = textstat.flesch_reading_ease(combined)
    score = max(0.0, min(ease, 100.0))
    issues = []
    if score < 30:
        issues.append({
            "severity": "warning",
            "section_ref": None,
            "message": "Documentation readability is very low (Flesch score: {:.1f}).".format(ease),
            "suggestion": "Use shorter sentences and simpler vocabulary to improve readability.",
        })
    elif score < 50:
        issues.append({
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
    from app.models.document import Document, Section, SectionStatus
    from app.models.quality import QualityReport, QualityIssue, BrokenLink, IssueSeverity
    from sqlalchemy.orm import selectinload

    with sync_session_factory() as db:
        # Fetch the selected Document + sections.
        doc = (
            db.query(Document)
            .filter(Document.id == document_id)
            .first()
        )
        if not doc:
            return {"error": "Document not found"}

        sections = (
            db.query(Section)
            .filter(
                Section.document_id == doc.id,
                Section.status == SectionStatus.FINALIZED,
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

        # ── Run all scorers ──────────────────────────────────────────
        completeness, comp_issues = _score_completeness(sections)
        combined_text = " ".join((s.content_md or "") for s in sections)
        readability, read_issues = _score_readability(combined_text)
        consistency, cons_issues = _score_consistency(sections)
        accuracy, acc_issues, broken = _run_async(_score_accuracy_async(sections))

        overall = (
            0.30 * completeness
            + 0.25 * readability
            + 0.25 * consistency
            + 0.20 * accuracy
        )

        # ── Upsert QualityReport (delete old, create new) ─────────────
        existing = (
            db.query(QualityReport)
            .filter(QualityReport.document_id == doc.id)
            .first()
        )
        if existing:
            db.delete(existing)
            db.flush()

        report = QualityReport(
            document_id=doc.id,
            overall_score=round(overall, 1),
            completeness=round(completeness, 1),
            readability=round(readability, 1),
            consistency=round(consistency, 1),
            accuracy=round(accuracy, 1),
            generated_at=datetime.utcnow(),
        )
        db.add(report)
        db.flush()  # get report.id

        # ── Persist issues ────────────────────────────────────────────
        all_issues = comp_issues + read_issues + cons_issues + acc_issues
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

        # ── Persist broken links ──────────────────────────────────────
        for bl in broken:
            db.add(BrokenLink(
                report_id=report.id,
                url=bl["url"],
                status_code=bl.get("status_code"),
                section_ref=bl.get("section_ref"),
            ))

        db.commit()

    return {
        "project_id": project_id,
        "overall": round(overall, 1),
        "completeness": round(completeness, 1),
        "readability": round(readability, 1),
        "consistency": round(consistency, 1),
        "accuracy": round(accuracy, 1),
    }
