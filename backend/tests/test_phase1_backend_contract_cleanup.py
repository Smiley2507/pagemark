from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent
from app.models.analysis import Analysis, AnalysisStatus
from app.models.document import (
    Document,
    DocumentSetupStage,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.generation import FailoverState, GenerationMode, GenerationRun, GenerationRunStatus
from app.models.project import Project
from app.models.template import Template
from app.models.user import User
from app.services import analysis_service
from app.services.ai_doc_service import ai_service


@pytest.mark.asyncio
async def test_project_summary_is_derived_from_documents_and_sections(
    client,
    db: AsyncSession,
    test_project: Project,
):
    document = Document(
        project_id=test_project.id,
        title="API Guide",
        setup_stage=DocumentSetupStage.EDITOR_READY,
    )
    db.add(document)
    await db.flush()

    db.add_all(
        [
            Section(
                document_id=document.id,
                heading="Overview",
                order_index=0,
                lifecycle_status=LifecycleStatus.ACTIVE,
                content_md="Reviewed",
                content_lifecycle=SectionContentLifecycle.REVIEWED,
                status=SectionStatus.FINALIZED,
            ),
            Section(
                document_id=document.id,
                heading="Endpoints",
                order_index=1,
                lifecycle_status=LifecycleStatus.ACTIVE,
                content_md="Draft",
                content_lifecycle=SectionContentLifecycle.GENERATED_DRAFT,
                status=SectionStatus.DRAFT,
            ),
            Section(
                document_id=document.id,
                heading="Deployment",
                order_index=2,
                lifecycle_status=LifecycleStatus.ACTIVE,
                needs_input=True,
                is_potentially_stale=True,
                status=SectionStatus.PENDING,
            ),
        ]
    )
    db.add(
        GenerationRun(
            document_id=document.id,
            mode=GenerationMode.COMPLETE_DOCUMENT,
            status=GenerationRunStatus.RUNNING,
            failover_state=FailoverState.NOT_REQUIRED,
        )
    )
    db.add(
        ActivityEvent(
            project_id=test_project.id,
            document_id=document.id,
            event_type="generation_run_started",
            weight=1.5,
            created_at=datetime.utcnow() - timedelta(minutes=5),
        )
    )
    await db.commit()

    first_response = await client.get(f"/projects/{test_project.id}")
    assert first_response.status_code == 200
    first_payload = first_response.json()
    assert first_payload["documents_count"] == 1
    assert first_payload["sections_count"] == 3
    assert first_payload["completion_pct"] == 33.3
    assert first_payload["active_generation"] is True
    assert first_payload["sections_needing_input"] == 1
    assert first_payload["review_state"] == "draft"
    assert first_payload["freshness_state"] == "potentially_stale"
    assert first_payload["recent_activity_at"] is not None

    sections = list((await db.execute(select(Section).where(Section.document_id == document.id))).scalars().all())
    for section in sections:
        section.content_md = section.content_md or "Reviewed now"
        section.content_lifecycle = SectionContentLifecycle.REVIEWED
        section.status = SectionStatus.FINALIZED
        section.needs_input = False
        section.is_potentially_stale = False

    run = (await db.execute(select(GenerationRun).where(GenerationRun.document_id == document.id))).scalar_one()
    run.status = GenerationRunStatus.COMPLETED
    document.freshness_state = "fresh"
    await db.commit()

    second_response = await client.get(f"/projects/{test_project.id}")
    assert second_response.status_code == 200
    second_payload = second_response.json()
    assert second_payload["completion_pct"] == 100.0
    assert second_payload["active_generation"] is False
    assert second_payload["sections_needing_input"] == 0
    assert second_payload["review_state"] == "reviewed"
    assert second_payload["freshness_state"] == "fresh"


@pytest.mark.asyncio
async def test_analysis_and_generation_paths_use_document_template(
    db: AsyncSession,
    test_project: Project,
    test_user: User,
    monkeypatch,
):
    template = Template(
        name="API Reference",
        description="Docs",
        category="Technical",
        purpose="Document endpoints",
        intended_audience="Developers",
        expected_outcome="Clear API docs",
        sections_json=[
            {"heading": "Overview", "description": "Summary"},
            {"heading": "Endpoints", "description": "Details"},
        ],
        system_prompt="Use API reference style.",
        is_builtin=True,
    )
    db.add(template)
    await db.flush()

    document = Document(
        project_id=test_project.id,
        template_id=template.id,
        title="API Guide",
        setup_stage=DocumentSetupStage.EDITOR_READY,
    )
    db.add(document)
    await db.flush()

    section = Section(
        document_id=document.id,
        heading="Overview",
        order_index=0,
        lifecycle_status=LifecycleStatus.ACTIVE,
        status=SectionStatus.PENDING,
    )
    analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=True,
        languages_json={"python": {"files": 12}},
        endpoints_json=[{"method": "GET", "path": "/projects"}],
        complexity_json={"summary": "moderate"},
    )
    db.add_all([section, analysis])
    await db.commit()

    template_sections = await analysis_service.get_template_sections_for_project(test_project.id, db)
    assert [item["heading"] for item in template_sections] == ["Overview", "Endpoints"]

    class _FakeMessages:
        async def create(self, **kwargs):
            class _Text:
                text = '{"content":"Generated section","confidence_score":87}'

            class _Response:
                content = [_Text()]

            return _Response()

    class _FakeClient:
        messages = _FakeMessages()

    async def fake_get_client(_db, _user_id, model_name=None):
        return _FakeClient(), "fake-model"

    monkeypatch.setattr(ai_service, "_get_anthropic_client", fake_get_client)

    content, confidence = await ai_service.generate_section(
        test_project.id,
        section.id,
        db,
        test_user.id,
    )
    assert content == "Generated section"
    assert confidence == 87


@pytest.mark.asyncio
async def test_nested_document_routes_reject_guessed_ids_from_non_members(
    other_user_client,
    db: AsyncSession,
    test_project: Project,
):
    document = Document(
        project_id=test_project.id,
        title="Private Doc",
        setup_stage=DocumentSetupStage.PURPOSE,
    )
    db.add(document)
    await db.flush()
    db.add(
        Section(
            document_id=document.id,
            heading="Private Section",
            order_index=0,
            lifecycle_status=LifecycleStatus.ACTIVE,
            status=SectionStatus.PENDING,
        )
    )
    await db.commit()

    document_response = await other_user_client.get(
        f"/projects/{test_project.id}/documents/{document.id}"
    )
    assert document_response.status_code == 404

    sections_response = await other_user_client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert sections_response.status_code == 404
