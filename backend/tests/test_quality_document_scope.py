import pytest


@pytest.mark.anyio
async def test_quality_run_dispatches_selected_document_id(client, test_project, monkeypatch):
    dispatched: list[int] = []

    def fake_delay(document_id: int):
        dispatched.append(document_id)

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
