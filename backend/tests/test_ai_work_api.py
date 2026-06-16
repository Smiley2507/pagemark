import pytest
from app.models.document import (
    Document,
    DocumentSetupStage,
    LifecycleStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)


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
