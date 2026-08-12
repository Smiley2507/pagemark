"""Tests for org activity report aggregation and PDF rendering."""
from datetime import timedelta

import pytest

from app.models.activity import ActivityEvent
from app.models.audit import AuditLog
from app.models.organization import Organization
from app.models.project import Project, SourceType
from app.models.time import utcnow
from app.models.user import User
from app.services.report_service import (
    _category_bars_html,
    _mermaid_xychart,
    _sparse_labels,
    get_org_report_data,
    render_report_pdf,
)


def test_mermaid_xychart_builds_valid_syntax():
    trend = [{"label": "Aug 01", "count": 3}, {"label": "Aug 02", "count": 0}]
    code = _mermaid_xychart(trend)
    assert "xychart-beta" in code
    assert '"Aug 01", "Aug 02"' in code
    assert "line [3, 0]" in code


def test_sparse_labels_keeps_all_when_under_the_cap():
    labels = ["Aug 01", "Aug 02", "Aug 03"]
    assert _sparse_labels(labels) == labels


def test_sparse_labels_blanks_out_intermediate_labels_uniquely():
    labels = [f"Day {i}" for i in range(30)]
    sparse = _sparse_labels(labels)
    assert sparse[0] == "Day 0"
    assert sparse[-1] == "Day 29"
    assert sum(1 for label in sparse if label in labels) <= 9
    # blanked labels must stay unique so mermaid doesn't collapse points onto one band
    assert len(set(sparse)) == len(sparse)


def test_category_bars_html_handles_empty_and_populated():
    assert "bar-row" not in _category_bars_html([])
    html = _category_bars_html([{"category": "Documents", "count": 5}, {"category": "Review", "count": 0}])
    assert "Documents" in html and "Review" in html
    assert "width:100.0%" in html
    assert "width:0.0%" in html


def test_render_report_pdf_produces_pdf_bytes():
    report = {
        "days": 7,
        "range_label": "Last 7 days",
        "generated_at": utcnow(),
        "summary": {"total_actions": 2, "active_users": 1, "most_active_project": "Docs", "top_action": "Documents"},
        "trend": [{"date": "2026-08-10", "label": "Aug 10", "count": 1}, {"date": "2026-08-11", "label": "Aug 11", "count": 1}],
        "categories": [{"category": "Documents", "count": 2}],
        "contributors": [{"user_id": 1, "name": "Ada", "email": "ada@example.com", "count": 2}],
        "events": [{"action": "Document created", "resource": "project:1:Docs", "user_name": "Ada", "created_at": utcnow(), "source": "audit"}],
    }
    pdf_bytes = render_report_pdf("Acme Org", report)
    assert pdf_bytes[:5] == b"%PDF-"


def test_render_report_pdf_handles_empty_report():
    report = {
        "days": 7,
        "range_label": "Last 7 days",
        "generated_at": utcnow(),
        "summary": {"total_actions": 0, "active_users": 0, "most_active_project": None, "top_action": None},
        "trend": [{"date": "2026-08-10", "label": "Aug 10", "count": 0}],
        "categories": [],
        "contributors": [],
        "events": [],
    }
    pdf_bytes = render_report_pdf("Empty Org", report)
    assert pdf_bytes[:5] == b"%PDF-"


@pytest.mark.anyio
async def test_get_org_report_data_aggregates_audit_and_activity(db, test_user, test_org, test_project):
    db.add(AuditLog(user_id=test_user.id, org_id=test_org.id, action="invite_member", resource="member:x"))
    db.add(ActivityEvent(project_id=test_project.id, event_type="document_created", weight=2.5))
    db.add(ActivityEvent(project_id=test_project.id, event_type="document_created", weight=2.5))
    await db.commit()

    data = await get_org_report_data(db, test_org.id, days=30)

    assert data["summary"]["total_actions"] == 3
    assert data["summary"]["active_users"] == 1
    assert data["summary"]["most_active_project"] == "Test Project"
    assert {c["category"] for c in data["categories"]} == {"Account", "Documents"}
    assert data["contributors"][0]["count"] == 1
    assert sum(p["count"] for p in data["trend"]) == 3


@pytest.mark.anyio
async def test_get_org_report_data_excludes_other_orgs(db, test_user, test_org, test_project, other_user):
    other_org = Organization(name="Other Org", slug="other-org-report-test", created_by=other_user.id, personal=True)
    db.add(other_org)
    await db.flush()
    other_project = Project(org_id=other_org.id, created_by=other_user.id, name="Other Project", source_type=SourceType.SCRATCH)
    db.add(other_project)
    await db.flush()
    db.add(AuditLog(user_id=other_user.id, org_id=other_org.id, action="create_organization"))
    db.add(ActivityEvent(project_id=other_project.id, event_type="document_created", weight=2.5))
    await db.commit()

    data = await get_org_report_data(db, test_org.id, days=30)
    assert data["summary"]["total_actions"] == 0
