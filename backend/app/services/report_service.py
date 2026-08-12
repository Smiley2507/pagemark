"""Org activity report: aggregation of AuditLog + ActivityEvent, and PDF rendering."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import timedelta
from html import escape
from typing import Any

import sqlalchemy
import weasyprint
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.time import utcnow
from app.models.activity import ActivityEvent
from app.models.audit import AuditLog
from app.models.organization import OrganizationMember, OrgMemberStatus
from app.models.project import Project
from app.models.user import User
from app.services.activity_service import EVENT_CATEGORIES, EVENT_MESSAGES
from app.services.export_service import _render_mermaid_svg

RANGE_LABELS: dict[int, str] = {7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days", 365: "Last year"}

# ActivityEvent has no user_id — the audit-logs endpoint already treats it as
# unattributed. "Contributors"/"active users" are therefore computed from
# AuditLog rows only, which do carry real user attribution.


def _bucket_key(dt, daily: bool) -> str:
    if daily:
        return dt.strftime("%Y-%m-%d")
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


async def get_org_report_data(db: AsyncSession, org_id: int, days: int) -> dict[str, Any]:
    cutoff = utcnow() - timedelta(days=days)
    daily = days <= 90

    member_ids_res = await db.execute(
        select(OrganizationMember.user_id).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    member_ids = [row[0] for row in member_ids_res.all()]

    audit_res = await db.execute(
        select(AuditLog, User)
        .join(User, User.id == AuditLog.user_id)
        .where(
            AuditLog.created_at >= cutoff,
            sqlalchemy.or_(
                AuditLog.org_id == org_id,
                sqlalchemy.and_(AuditLog.org_id.is_(None), AuditLog.user_id.in_(member_ids)),
            ),
        )
    )
    audit_rows = [
        {
            "created_at": log.created_at,
            "category": "Account",
            "label": log.action.replace("_", " ").capitalize(),
            "resource": log.resource,
            "user_id": log.user_id,
            "user_name": user.name,
            "user_email": user.email,
            "project_name": None,
            "source": "audit",
        }
        for log, user in audit_res.all()
    ]

    activity_res = await db.execute(
        select(ActivityEvent, Project)
        .join(Project, Project.id == ActivityEvent.project_id)
        .where(
            Project.org_id == org_id,
            Project.deleted_at.is_(None),
            ActivityEvent.created_at >= cutoff,
            ActivityEvent.weight >= 0.5,
        )
    )
    activity_rows = [
        {
            "created_at": event.created_at,
            "category": EVENT_CATEGORIES.get(event.event_type, "Other"),
            "label": EVENT_MESSAGES.get(event.event_type, event.event_type),
            "resource": f"project:{project.id}:{project.name}",
            "user_id": None,
            "user_name": None,
            "user_email": None,
            "project_name": project.name,
            "source": "activity",
        }
        for event, project in activity_res.all()
    ]

    rows = audit_rows + activity_rows
    rows.sort(key=lambda r: r["created_at"], reverse=True)

    # ── Trend (zero-filled buckets, matches activity_service.get_heatmap_data) ──
    bucket_counts: dict[str, int] = defaultdict(int)
    for row in rows:
        bucket_counts[_bucket_key(row["created_at"], daily)] += 1

    now = utcnow()
    trend: list[dict[str, Any]] = []
    if daily:
        for i in range(days):
            dt = now - timedelta(days=days - 1 - i)
            key = dt.strftime("%Y-%m-%d")
            trend.append({"date": key, "label": dt.strftime("%b %d"), "count": bucket_counts.get(key, 0)})
    else:
        cutoff_dt = now - timedelta(days=days - 1)
        cutoff_monday = cutoff_dt - timedelta(days=cutoff_dt.weekday())
        num_weeks = (now - cutoff_monday).days // 7 + 1
        for i in range(num_weeks):
            dt = cutoff_monday + timedelta(weeks=i)
            key = dt.strftime("%Y-%m-%d")
            trend.append({"date": key, "label": f"Week of {dt.strftime('%b %d')}", "count": bucket_counts.get(key, 0)})

    # ── Category breakdown ──
    category_counts: dict[str, int] = defaultdict(int)
    for row in rows:
        category_counts[row["category"]] += 1
    categories = [
        {"category": cat, "count": count}
        for cat, count in sorted(category_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # ── Top contributors (AuditLog only — ActivityEvent has no real user attribution) ──
    contributor_counts: dict[int, dict[str, Any]] = {}
    for row in audit_rows:
        entry = contributor_counts.setdefault(
            row["user_id"], {"user_id": row["user_id"], "name": row["user_name"], "email": row["user_email"], "count": 0}
        )
        entry["count"] += 1
    contributors = sorted(contributor_counts.values(), key=lambda c: c["count"], reverse=True)[:10]

    # ── Notable events (capped) ──
    events = [
        {
            "action": row["label"],
            "resource": row["resource"],
            "user_name": row["user_name"],
            "created_at": row["created_at"],
            "source": row["source"],
        }
        for row in rows[:20]
    ]

    # ── Summary ──
    project_counts: dict[str, int] = defaultdict(int)
    for row in activity_rows:
        project_counts[row["project_name"]] += 1
    most_active_project = max(project_counts, key=project_counts.get) if project_counts else None
    top_action = categories[0]["category"] if categories else None

    summary = {
        "total_actions": len(rows),
        "active_users": len({row["user_id"] for row in audit_rows}),
        "most_active_project": most_active_project,
        "top_action": top_action,
    }

    return {
        "days": days,
        "range_label": RANGE_LABELS.get(days, f"Last {days} days"),
        "generated_at": now,
        "summary": summary,
        "trend": trend,
        "categories": categories,
        "contributors": contributors,
        "events": events,
    }


# ── PDF rendering ────────────────────────────────────────────────

_MAX_TREND_LABELS = 8
_CHART_WIDTH = 640
_CHART_INIT = {"themeVariables": {"xyChart": {"plotColorPalette": "#4f46e5"}}}


def _sparse_labels(labels: list[str]) -> list[str]:
    """Keep ~_MAX_TREND_LABELS evenly-spaced labels; blank out the rest.

    x-axis categories must stay unique or mermaid collapses same-named
    points onto one band, so blanked entries use a unique, invisible
    zero-width-space run rather than a plain empty/repeated string.
    """
    n = len(labels)
    if n <= _MAX_TREND_LABELS:
        return labels
    # Evenly-spaced indices spanning [0, n-1] inclusive — a modulo-step
    # approach plus a forced last index can land two kept labels adjacent
    # to each other right at the tail, overlapping visually.
    keep = {round(k * (n - 1) / (_MAX_TREND_LABELS - 1)) for k in range(_MAX_TREND_LABELS)}
    return [
        label if i in keep else "​" * (i + 1)
        for i, label in enumerate(labels)
    ]


def _mermaid_xychart(trend: list[dict[str, Any]]) -> str:
    labels = _sparse_labels([p["label"] for p in trend])
    label_list = ", ".join(f'"{escape(label)}"' for label in labels)
    values = ", ".join(str(p["count"]) for p in trend)
    max_count = max((p["count"] for p in trend), default=0)
    init = {**_CHART_INIT, "xyChart": {"width": _CHART_WIDTH, "height": 260}}
    return (
        f"%%{{init: {json.dumps(init)}}}%%\n"
        "xychart-beta\n"
        f"  x-axis [{label_list}]\n"
        f"  y-axis 0 --> {max(max_count, 1)}\n"
        f"  line [{values}]"
    )


_VIEWBOX_RE = re.compile(r'viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"')
_MAX_WIDTH_RE = re.compile(r'max-width:\s*([\d.]+)px')


def _pad_svg_viewbox(svg: str, pad_x: int = 36, pad_y: int = 20) -> str:
    """Expand the SVG's viewBox so edge-anchored axis labels aren't clipped.

    Mermaid's xychart draws the axis/plot flush to the canvas edges (x=0 and
    x=width) with center/end-anchored label text, so label glyphs routinely
    overhang past the declared viewBox and get clipped by it. Since the
    overhang is outside mermaid's own layout control (not a text-metrics
    estimation issue — the anchor points themselves sit on the boundary),
    the fix is widening the viewBox after render rather than fighting
    mermaid's internal margins.
    """
    match = _VIEWBOX_RE.search(svg)
    if not match:
        return svg
    x, y, w, h = (float(v) for v in match.groups())
    padded = f'viewBox="{x - pad_x:g} {y - pad_y:g} {w + 2 * pad_x:g} {h + 2 * pad_y:g}"'
    svg = svg[:match.start()] + padded + svg[match.end():]
    return _MAX_WIDTH_RE.sub(lambda m: f"max-width: {float(m.group(1)) + 2 * pad_x:g}px", svg, count=1)


def _chart_html(mermaid_code: str) -> str:
    svg, error = _render_mermaid_svg(mermaid_code)
    if svg:
        return f'<div class="chart">{_pad_svg_viewbox(svg)}</div>'
    return f'<p class="chart-error">Chart unavailable: {escape(error or "render failed")}</p>'


def _category_bars_html(categories: list[dict[str, Any]]) -> str:
    max_count = max((c["count"] for c in categories), default=0) or 1
    rows = "".join(
        '<div class="bar-row">'
        f'<div class="bar-label">{escape(c["category"])}</div>'
        f'<div class="bar-track"><div class="bar-fill" style="width:{c["count"] / max_count * 100:.1f}%"></div></div>'
        f'<div class="bar-count">{c["count"]}</div>'
        "</div>"
        for c in categories
    )
    return f'<div class="bar-chart">{rows}</div>'


_CSS = """
@page {
  size: a4;
  margin: 20mm 18mm;
  @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #6b7280; }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  color: #374151;
  font-size: 10pt;
  line-height: 1.5;
}
h1 { font-size: 22pt; color: #111827; margin: 0 0 4px 0; }
h2 { font-size: 14pt; color: #1f2937; margin: 24px 0 10px 0; page-break-after: avoid; }
.eyebrow { color: #4f46e5; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9pt; font-weight: 700; margin: 0 0 6px 0; }
.subtitle { color: #6b7280; font-size: 10pt; margin: 4px 0 0 0; }
.stat-grid { display: flex; gap: 12px; margin: 16px 0; }
.stat-card { flex: 1; min-width: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
.stat-value { font-size: 17pt; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stat-value.stat-value--text { font-size: 11pt; }
.stat-label { font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 4px; }
.chart { margin: 8px 0; text-align: center; page-break-inside: avoid; }
.chart svg { max-width: 100%; height: auto; }
.chart-error { color: #9a3412; font-size: 9pt; }
.empty-state { color: #6b7280; font-style: italic; }
.bar-chart { margin: 10px 0; page-break-inside: avoid; }
.bar-row { display: flex; align-items: center; gap: 8px; margin: 7px 0; }
.bar-label { width: 100px; flex-shrink: 0; font-size: 9pt; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 12px; background: #4f46e5; border-radius: 4px; }
.bar-count { width: 28px; flex-shrink: 0; text-align: right; font-size: 9pt; color: #6b7280; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9.5pt; }
th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
th { background: #f9fafb; font-weight: 700; }
td { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
"""


def _display_resource(resource: str | None) -> str:
    """Strip the "project:<id>:" prefix so the report shows just the project name."""
    if not resource:
        return "—"
    parts = resource.split(":", 2)
    if len(parts) == 3 and parts[0] == "project":
        return parts[2]
    return resource


def render_report_pdf(org_name: str, report: dict[str, Any]) -> bytes:
    summary = report["summary"]
    generated_at = report["generated_at"].strftime("%B %d, %Y at %H:%M UTC")

    stat_cards = "".join(
        f'<div class="stat-card"><div class="stat-value{" stat-value--text" if is_text else ""}">{value}</div>'
        f'<div class="stat-label">{escape(label)}</div></div>'
        for value, label, is_text in [
            (summary["total_actions"], "Total actions", False),
            (summary["active_users"], "Active users", False),
            (escape(summary["most_active_project"] or "—"), "Most active project", True),
            (escape(summary["top_action"] or "—"), "Top category", True),
        ]
    )

    trend_section = _chart_html(_mermaid_xychart(report["trend"])) if any(p["count"] for p in report["trend"]) \
        else '<p class="empty-state">No activity recorded in this range.</p>'

    categories_section = _category_bars_html(report["categories"]) if report["categories"] \
        else '<p class="empty-state">No activity recorded in this range.</p>'

    if report["contributors"]:
        contributors_rows = "".join(
            f"<tr><td>{escape(c['name'] or c['email'])}</td><td>{c['count']}</td></tr>"
            for c in report["contributors"]
        )
        contributors_section = f"<table><thead><tr><th>User</th><th>Actions</th></tr></thead><tbody>{contributors_rows}</tbody></table>"
    else:
        contributors_section = '<p class="empty-state">No attributable user actions in this range.</p>'

    if report["events"]:
        event_rows = "".join(
            f"<tr><td>{e['created_at'].strftime('%b %d, %H:%M')}</td><td>{escape(e['action'])}</td>"
            f"<td>{escape(e['user_name'] or '—')}</td><td>{escape(_display_resource(e['resource']))}</td></tr>"
            for e in report["events"]
        )
        events_section = f"<table><thead><tr><th>When</th><th>Action</th><th>User</th><th>Resource</th></tr></thead><tbody>{event_rows}</tbody></table>"
    else:
        events_section = '<p class="empty-state">No activity recorded in this range.</p>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>{escape(org_name)} Activity Report</title><style>{_CSS}</style></head>
<body>
<p class="eyebrow">{escape(org_name)}</p>
<h1>Activity Report</h1>
<p class="subtitle">{escape(report["range_label"])} &middot; Generated {generated_at}</p>

<div class="stat-grid">{stat_cards}</div>

<h2>Activity trend</h2>
{trend_section}

<h2>Activity by category</h2>
{categories_section}

<h2>Top contributors</h2>
{contributors_section}

<h2>Notable events</h2>
{events_section}
</body>
</html>"""

    return weasyprint.HTML(string=html).write_pdf()
