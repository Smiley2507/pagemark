import pytest
from types import SimpleNamespace

from app.workers.quality_worker import _score_acceptance_coverage


@pytest.mark.anyio
async def test_quality_run_dispatches_selected_document_id(client, test_project, monkeypatch):
    dispatched: list[int] = []

    def fake_delay(document_id: int):
        dispatched.append(document_id)
        return SimpleNamespace(id="quality-task-1")

    monkeypatch.setattr("app.routers.quality.score_quality_task.delay", fake_delay)

    first_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "First Document", "purpose": "First purpose"},
    )
    second_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "Second Document", "purpose": "Second purpose"},
    )
    assert first_response.status_code == 201
    assert second_response.status_code == 201

    second_document = second_response.json()
    run_response = await client.post(
        f"/projects/{test_project.id}/documents/{second_document['id']}/quality/run"
    )

    assert run_response.status_code == 202
    assert dispatched == [second_document["id"]]
    assert run_response.json()["task_id"] == "quality-task-1"


@pytest.mark.anyio
async def test_quality_status_reports_missing_report_after_success(client, test_project, monkeypatch):
    monkeypatch.setattr(
        "app.routers.quality.AsyncResult",
        lambda task_id, app: SimpleNamespace(state="SUCCESS", result={"overall": 90}),
    )

    response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "Quality Status Document", "purpose": "Status purpose"},
    )
    assert response.status_code == 201
    document = response.json()

    status_response = await client.get(
        f"/projects/{test_project.id}/documents/{document['id']}/quality/status",
        params={"task_id": "quality-task-1"},
    )

    assert status_response.status_code == 200
    payload = status_response.json()
    assert payload["status"] == "missing_report"
    assert payload["task_id"] == "quality-task-1"


def test_acceptance_coverage_flags_generic_sections():
    sections = [
        SimpleNamespace(
            heading="Endpoints",
            content_md="This API has endpoints for users.",
            workflow_metadata={
                "acceptance_criteria": [
                    "Uses concrete source evidence when available, including file paths, commands, APIs, configuration keys, schemas, or UI labels as appropriate.",
                    "Covers the fields, examples, caveats, and unknowns requested by the section guidance instead of stopping at a summary paragraph.",
                ]
            },
        )
    ]

    score, issues = _score_acceptance_coverage(sections)

    assert score == 0.0
    assert len(issues) == 2
    assert all(issue["severity"] == "warning" for issue in issues)


def test_acceptance_coverage_accepts_source_grounded_sections():
    sections = [
        SimpleNamespace(
            heading="Endpoints",
            content_md=(
                "app/main.py defines the documented API surface for this service.\n\n"
                "| Method | Path | Request | Response |\n"
                "| --- | --- | --- | --- |\n"
                "| GET | /health | No body or path parameters are shown in source. | JSON health payload. |\n\n"
                "Example request: `curl /health`. The source excerpt does not show authentication middleware, "
                "so authentication requirements remain an unknown until route tests confirm them. "
                "The endpoint belongs to operational readiness rather than user-facing project workflows. "
                "If this endpoint fails, clients should treat the API process as unavailable and avoid "
                "retrying higher-cost operations. The implementation should be cross-checked against route "
                "tests before review, especially for status codes, headers, and exact response fields. "
                "Document the route handler path, the observed method and path, the lack of request body, "
                "the expected JSON response shape, and the fact that exact status codes are not confirmed "
                "by the provided source excerpt. Keep the caveat visible so a maintainer can resolve it "
                "with additional test or schema evidence before marking the section reviewed."
            ),
            workflow_metadata={
                "acceptance_criteria": [
                    "Uses concrete source evidence when available, including file paths, commands, APIs, configuration keys, schemas, or UI labels as appropriate.",
                    "Covers the fields, examples, caveats, and unknowns requested by the section guidance instead of stopping at a summary paragraph.",
                ]
            },
        )
    ]

    score, issues = _score_acceptance_coverage(sections)

    assert score == 100.0
    assert issues == []


def test_quality_report_schema_includes_acceptance_coverage():
    from app.schemas.quality import QualityReportOut

    report = SimpleNamespace(
        id=1,
        document_id=2,
        overall_score=88.0,
        completeness=90.0,
        acceptance_coverage=75.0,
        readability=85.0,
        consistency=95.0,
        accuracy=100.0,
        generated_at="2026-06-21T00:00:00",
        issues=[],
        broken_links=[],
    )

    payload = QualityReportOut.model_validate(report)

    assert payload.acceptance_coverage == 75.0
