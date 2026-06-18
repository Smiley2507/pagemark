import pytest
from dataclasses import dataclass

from app.models.document import (
    Document,
    DocumentSetupStage,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)


@dataclass
class StubCredential:
    id: int = 1
    provider: str = "openai"
    model_id: str = "gpt-4o-mini"
    api_key: str = "test-api-key"


@pytest.fixture
async def ai_work_document(db, test_project):
    document = Document(
        project_id=test_project.id,
        title="Operator Guide",
        setup_stage=DocumentSetupStage.EDITOR_READY,
    )
    db.add(document)
    await db.flush()

    section = Section(
        document_id=document.id,
        order_index=0,
        heading="Overview",
        title="Overview",
        content_md="Old overview",
        content_lifecycle=SectionContentLifecycle.REVIEWED,
        status=SectionStatus.FINALIZED,
        lifecycle_status=LifecycleStatus.ACTIVE,
    )
    db.add(section)
    await db.commit()
    await db.refresh(document)
    await db.refresh(section)
    return document, section


@pytest.mark.anyio
async def test_ai_work_run_accepts_multiple_changes_and_undoes_group(
    client,
    db,
    test_project,
    test_user,
    ai_work_document,
):
    document, section = ai_work_document

    create_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs",
        json={
            "provider": "rule-based",
            "model": "none",
            "prompt_context": {"source": "test"},
            "changes": [
                {
                    "change_type": "rewrite_selection",
                    "title": "Rewrite overview",
                    "section_id": section.id,
                    "before": {"content_md": "Old overview"},
                    "after": {"content_md": "New overview"},
                    "preview_markdown": "New overview",
                },
                {
                    "change_type": "rename_section",
                    "title": "Rename overview",
                    "section_id": section.id,
                    "before": {"heading": "Overview", "title": "Overview"},
                    "after": {"heading": "Operations Overview"},
                    "preview_markdown": "# Operations Overview",
                },
            ],
        },
    )
    assert create_response.status_code == 201
    run = create_response.json()
    assert run["status"] == "proposed"
    assert len(run["proposed_changes"]) == 2
    rewrite_id = run["proposed_changes"][0]["id"]
    rename_id = run["proposed_changes"][1]["id"]

    preview_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{rewrite_id}/preview"
    )
    assert preview_response.status_code == 200
    assert preview_response.json()["preview"]["after"]["content_md"] == "New overview"

    first_accept = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{rewrite_id}/accept"
    )
    assert first_accept.status_code == 200
    assert first_accept.json()["status"] == "accepted"

    listed_after_first = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs"
    )
    assert listed_after_first.status_code == 200
    assert listed_after_first.json()["work_runs"][0]["status"] == "partially_accepted"

    second_accept = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{rename_id}/accept"
    )
    assert second_accept.status_code == 200
    assert second_accept.json()["accepted_by"] == test_user.id

    listed_after_second = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs"
    )
    assert listed_after_second.status_code == 200
    accepted_run = listed_after_second.json()["work_runs"][0]
    assert accepted_run["status"] == "accepted"
    assert len(accepted_run["undo_group"]["changes"]) == 2

    sections_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert sections_response.status_code == 200
    updated_section = sections_response.json()["sections"][0]
    assert updated_section["content_md"] == "New overview"
    assert updated_section["heading"] == "Operations Overview"
    assert updated_section["content_lifecycle"] == "generated_draft"
    assert updated_section["status"] == "draft"

    versions_response = await client.get(f"/sections/{section.id}/versions")
    assert versions_response.status_code == 200
    versions = versions_response.json()
    assert len(versions) == 1
    assert versions[0]["author_type"] == "ai"
    assert versions[0]["summary"] == "Rewrite overview"

    undo_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs/{run['id']}/undo"
    )
    assert undo_response.status_code == 200
    undone_run = undo_response.json()
    assert undone_run["status"] == "undone"
    assert {change["status"] for change in undone_run["proposed_changes"]} == {"undone"}

    sections_after_undo = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert sections_after_undo.status_code == 200
    restored_section = sections_after_undo.json()["sections"][0]
    assert restored_section["content_md"] == "Old overview"
    assert restored_section["heading"] == "Overview"


@pytest.mark.anyio
async def test_ai_proposed_change_reject_marks_run_rejected_and_blocks_late_accept(
    client,
    db,
    test_project,
    ai_work_document,
):
    document, section = ai_work_document

    create_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs",
        json={
            "prompt_context": {"source": "test"},
            "changes": [
                {
                    "change_type": "rename_section",
                    "title": "Rename overview",
                    "section_id": section.id,
                    "after": {"heading": "Rejected Overview"},
                }
            ],
        },
    )
    assert create_response.status_code == 201
    run = create_response.json()
    change_id = run["proposed_changes"][0]["id"]

    reject_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{change_id}/reject"
    )
    assert reject_response.status_code == 200
    assert reject_response.json()["status"] == "rejected"

    late_accept = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{change_id}/accept"
    )
    assert late_accept.status_code == 409

    runs_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs"
    )
    assert runs_response.status_code == 200
    assert runs_response.json()["work_runs"][0]["status"] == "rejected"

    sections_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert sections_response.status_code == 200
    assert sections_response.json()["sections"][0]["heading"] == "Overview"


@pytest.mark.anyio
async def test_add_section_change_accept_creates_draft_section_with_content(
    client,
    test_project,
    ai_work_document,
):
    document, _section = ai_work_document

    create_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs",
        json={
            "provider": "rule-based",
            "model": "none",
            "prompt_context": {"source": "add-section-test"},
            "changes": [
                {
                    "change_type": "add_section",
                    "title": "Add troubleshooting section",
                    "after": {
                        "heading": "Troubleshooting",
                        "order_index": 1,
                        "content_md": "Known issues and recovery steps.",
                    },
                    "preview_markdown": "Known issues and recovery steps.",
                }
            ],
        },
    )
    assert create_response.status_code == 201
    run = create_response.json()
    change_id = run["proposed_changes"][0]["id"]

    accept_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{change_id}/accept"
    )
    assert accept_response.status_code == 200
    accepted = accept_response.json()
    assert accepted["status"] == "accepted"
    assert accepted["after"]["created_section_id"] is not None

    sections_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert sections_response.status_code == 200
    created = [
        section
        for section in sections_response.json()["sections"]
        if section["heading"] == "Troubleshooting"
    ][0]
    assert created["content_md"] == "Known issues and recovery steps."
    assert created["content_lifecycle"] == "generated_draft"
    assert created["status"] == "draft"


@pytest.mark.anyio
async def test_apply_outline_diff_accepts_and_undoes_section_structure(
    client,
    test_project,
    ai_work_document,
):
    document, overview = ai_work_document
    endpoint_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/sections",
        json={"title": "Endpoints"},
    )
    assert endpoint_response.status_code == 201
    endpoint = endpoint_response.json()

    create_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs",
        json={
            "provider": "rule-based",
            "model": "none",
            "prompt_context": {"source": "outline-diff-test"},
            "changes": [
                {
                    "change_type": "apply_outline_diff",
                    "title": "Apply proposed outline",
                    "after": {
                        "added_sections": [
                            {
                                "heading": "Troubleshooting",
                                "order_index": 1,
                                "content_md": "Known issues and recovery steps.",
                            }
                        ],
                        "renamed_sections": [
                            {
                                "section_id": overview.id,
                                "after_heading": "System Overview",
                            }
                        ],
                        "removed_section_ids": [endpoint["id"]],
                        "order": [
                            {"section_id": overview.id, "order_index": 0}
                        ],
                    },
                }
            ],
        },
    )
    assert create_response.status_code == 201
    run = create_response.json()
    change_id = run["proposed_changes"][0]["id"]

    accept_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/proposed-changes/{change_id}/accept"
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "accepted"

    sections_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert sections_response.status_code == 200
    accepted_headings = [section["heading"] for section in sections_response.json()["sections"]]
    assert accepted_headings == ["System Overview", "Troubleshooting"]
    assert "Endpoints" not in accepted_headings

    runs_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs"
    )
    assert runs_response.status_code == 200
    undo_group = runs_response.json()["work_runs"][0]["undo_group"]
    assert undo_group["changes"][0]["before"]["created_section_ids"]
    assert any(
        item["section_id"] == endpoint["id"] and item["lifecycle_status"] == "active"
        for item in undo_group["changes"][0]["before"]["sections"]
    )

    undo_response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/work-runs/{run['id']}/undo"
    )
    assert undo_response.status_code == 200
    assert undo_response.json()["status"] == "undone"

    restored_response = await client.get(
        f"/projects/{test_project.id}/documents/{document.id}/sections"
    )
    assert restored_response.status_code == 200
    restored_headings = [section["heading"] for section in restored_response.json()["sections"]]
    assert restored_headings == ["Overview", "Endpoints"]


@pytest.mark.anyio
async def test_editor_chat_action_queues_add_section_with_content(
    client,
    monkeypatch,
    test_project,
    ai_work_document,
):
    document, section = ai_work_document

    async def fake_active_credential(_db, _user_id):
        return StubCredential()

    def fake_complete_text(system, user, provider, api_key, model_id, *, max_tokens):
        assert "Pagemark's in-editor documentation assistant" in system
        assert "Never tell the user to copy and paste into README.md" in system
        assert f"Active section id: {section.id}" in user
        return (
            '{"action":"add_section","title":"Add installation section",'
            '"heading":"Installation","content_md":"Install with `npm install`.",'
            '"order_index":1,"rationale":"The document needs setup instructions."}'
        )

    monkeypatch.setattr(
        "app.routers.documents.ai_credential_service.get_active_credential",
        fake_active_credential,
    )
    monkeypatch.setattr("app.routers.documents.complete_text", fake_complete_text)

    response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/chat-actions",
        json={
            "message": "Add an installation section from the latest analysis",
            "mode": "generate",
            "target_section_id": section.id,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["action"] == "add_section"
    assert payload["work_run"]["status"] == "proposed"
    change = payload["work_run"]["proposed_changes"][0]
    assert change["change_type"] == "add_section"
    assert change["after"]["heading"] == "Installation"
    assert change["after"]["content_md"] == "Install with `npm install`."


@pytest.mark.anyio
async def test_editor_chat_action_returns_clarification_without_work_run(
    client,
    monkeypatch,
    test_project,
    ai_work_document,
):
    document, section = ai_work_document

    async def fake_active_credential(_db, _user_id):
        return StubCredential()

    def fake_complete_text(system, user, provider, api_key, model_id, *, max_tokens):
        return '{"action":"ask_user","message":"Which deployment target should this guide cover?"}'

    monkeypatch.setattr(
        "app.routers.documents.ai_credential_service.get_active_credential",
        fake_active_credential,
    )
    monkeypatch.setattr("app.routers.documents.complete_text", fake_complete_text)

    response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/ai/chat-actions",
        json={
            "message": "Insert deployment instructions",
            "target_section_id": section.id,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["action"] == "ask_user"
    assert payload["message"] == "Which deployment target should this guide cover?"
    assert payload["work_run"] is None
