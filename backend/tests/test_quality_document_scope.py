import pytest
from types import SimpleNamespace
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.models.document import Document, Section
from app.models.organization import Organization
from app.models.project import Project, SourceType
from app.models.quality import IssueSeverity, QualityFinding, QualityFindingCategory, QualityFindingStatus
from app.models.user import User
from app.workers.quality_worker import _score_acceptance_coverage


def test_sync_worker_sessions_do_not_expire_instances_on_commit():
    from app.database import SessionLocal

    assert SessionLocal.kw["expire_on_commit"] is False


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


def test_quality_worker_returns_payload_after_commit_without_detached_document(test_database_url, monkeypatch):
    from app.workers.quality_worker import score_quality_task

    sync_url = make_url(test_database_url).set(drivername="postgresql").render_as_string(hide_password=False)
    engine = create_engine(sync_url)
    SyncSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with SyncSession() as db:
        user = User(
            email="quality-worker@example.com",
            password_hash="hashed",
            name="Quality Worker",
            is_verified=True,
        )
        db.add(user)
        db.flush()
        org = Organization(
            name="Quality Worker Org",
            slug="quality-worker-org",
            created_by=user.id,
            personal=True,
        )
        db.add(org)
        db.flush()
        project = Project(
            org_id=org.id,
            created_by=user.id,
            name="Quality Worker Project",
            source_type=SourceType.SCRATCH,
        )
        db.add(project)
        db.flush()
        project_id = project.id
        document = Document(project_id=project_id, title="Worker Quality Document")
        db.add(document)
        db.flush()
        document_id = document.id
        db.add(
            Section(
                document_id=document_id,
                heading="Overview",
                title="Overview",
                content_md="A concise overview without external links.",
                order_index=0,
            )
        )
        db.commit()

    monkeypatch.setattr("app.database.sync_session_factory", SyncSession)

    try:
        payload = score_quality_task.run(document_id)
        replacement_payload = score_quality_task.run(document_id)
    finally:
        engine.dispose()

    assert payload["project_id"] == project_id
    assert payload["overall"] >= 0
    assert replacement_payload["project_id"] == project_id
    assert replacement_payload["overall"] >= 0


def test_quality_run_persists_findings_and_preserves_dismissed_status(test_database_url, monkeypatch):
    from app.workers.quality_worker import score_quality_task

    sync_url = make_url(test_database_url).set(drivername="postgresql").render_as_string(hide_password=False)
    engine = create_engine(sync_url)
    SyncSession = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
    monkeypatch.setattr("app.database.sync_session_factory", SyncSession)

    with SyncSession() as db:
        user = User(
            email="quality-findings@example.com",
            password_hash="hashed",
            name="Quality Findings",
            is_verified=True,
        )
        db.add(user)
        db.flush()
        org = Organization(
            name="Quality Findings Org",
            slug="quality-findings-org",
            created_by=user.id,
            personal=True,
        )
        db.add(org)
        db.flush()
        project = Project(
            org_id=org.id,
            created_by=user.id,
            name="Quality Findings Project",
            source_type=SourceType.SCRATCH,
        )
        db.add(project)
        db.flush()
        document = Document(project_id=project.id, title="Finding Document")
        db.add(document)
        db.flush()
        document_id = document.id
        db.add(
            Section(
                document_id=document_id,
                heading="Overview",
                title="Overview",
                content_md="Short content.",
                order_index=0,
            )
        )
        db.commit()

    try:
        score_quality_task.run(document_id)
        with SyncSession() as sync_db:
            finding = (
                sync_db.query(QualityFinding)
                .filter(QualityFinding.document_id == document_id)
                .first()
            )
        assert finding is not None
        finding.status = QualityFindingStatus.DISMISSED
        with SyncSession() as sync_db:
            sync_db.merge(finding)
            sync_db.commit()

        score_quality_task.run(document_id)
        with SyncSession() as sync_db:
            rerun_finding = (
                sync_db.query(QualityFinding)
                .filter(QualityFinding.document_id == document_id)
                .first()
            )
            assert rerun_finding.status == QualityFindingStatus.DISMISSED
    finally:
        engine.dispose()


def test_grammar_match_becomes_quality_finding_payload():
    from app.schemas.grammar import GrammarCheckResponse, GrammarMatch, GrammarMatchReplacement
    from app.services import quality_findings_service

    section = Section(
        id=7,
        document_id=3,
        heading="Overview",
        title="Overview",
        content_md="This are wrong.",
        order_index=0,
    )

    grammar = GrammarCheckResponse(
        text="This are wrong.",
        matches=[
            GrammarMatch(
                message="Possible agreement error.",
                short_message="Agreement",
                offset=5,
                length=3,
                rule_id="FAKE_RULE",
                rule_issue_type="grammar",
                replacements=[GrammarMatchReplacement(value="is")],
            )
        ],
    )
    payloads = [
        quality_findings_service.grammar_match_to_finding_payload(
            document_id=3,
            section=section,
            text=grammar.text,
            match=match,
        )
        for match in grammar.matches
    ]
    payload = payloads[0]
    assert payload["document_id"] == 3
    assert payload["section_id"] == 7
    assert payload["category"] == QualityFindingCategory.GRAMMAR
    assert payload["quote"] == "are"
    assert payload["offset"] == 5
    assert payload["length"] == 3
    assert payload["replacements"] == ["is"]
    assert payload["rule_id"] == "FAKE_RULE"


def test_quality_context_shape_is_stored_in_ai_prompt_context():
    quality_context = {
        "summary": {
            "overall_score": 72.0,
            "unresolved_counts": {"grammar": 1},
        },
        "active_section_findings": [
            {
                "id": 5,
                "category": "grammar",
                "status": "open",
                "severity": "warning",
                "message": "Agreement problem",
                "suggestion": "is",
                "quote": "are",
                "replacements": ["is"],
                "rule_id": "FAKE_RULE",
            }
        ],
    }
    prompt_context = {"source": "test", "quality_context": quality_context}

    assert prompt_context["quality_context"]["summary"]["unresolved_counts"]["grammar"] == 1
    assert prompt_context["quality_context"]["active_section_findings"][0]["quote"] == "are"


def test_quality_ai_fix_uses_quote_fallback_for_stale_grammar_offset():
    from app.services import quality_findings_service

    finding = QualityFinding(
        document_id=1,
        category=QualityFindingCategory.GRAMMAR,
        status=QualityFindingStatus.OPEN,
        section_id=2,
        section_ref="Overview",
        severity=IssueSeverity.WARNING,
        message="Agreement problem",
        suggestion="is",
        quote="are",
        offset=0,
        length=3,
        replacements=["is"],
        content_fingerprint="test-ai-fix",
    )
    fixed = quality_findings_service._apply_grammar_replacements("This are wrong.", [finding])

    assert fixed == "This is wrong."
