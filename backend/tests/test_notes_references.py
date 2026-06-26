import pytest


@pytest.mark.anyio
async def test_create_note_with_section_reference(client, test_project):
    document_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "Notes Document", "purpose": "Notes purpose"},
    )
    assert document_response.status_code == 201
    document = document_response.json()

    section_response = await client.post(
        f"/projects/{test_project.id}/documents/{document['id']}/sections",
        json={"title": "API"},
    )
    assert section_response.status_code == 201
    section = section_response.json()

    response = await client.post(
        f"/projects/{test_project.id}/documents/{document['id']}/notes",
        json={
            "content": "Check this section.",
            "section_id": section["id"],
            "references": [
                {"type": "section", "id": section["id"], "label": "API"},
            ],
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["references"] == [
        {"type": "section", "id": section["id"], "label": "API", "metadata": None},
    ]


@pytest.mark.anyio
async def test_create_note_rejects_section_reference_outside_document(client, test_project):
    first_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "First", "purpose": "First purpose"},
    )
    second_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "Second", "purpose": "Second purpose"},
    )
    assert first_response.status_code == 201
    assert second_response.status_code == 201
    first_document = first_response.json()
    second_document = second_response.json()

    section_response = await client.post(
        f"/projects/{test_project.id}/documents/{second_document['id']}/sections",
        json={"title": "Other"},
    )
    assert section_response.status_code == 201
    other_section = section_response.json()

    response = await client.post(
        f"/projects/{test_project.id}/documents/{first_document['id']}/notes",
        json={
            "content": "Invalid citation.",
            "references": [
                {"type": "section", "id": other_section["id"], "label": "Other"},
            ],
        },
    )

    assert response.status_code == 400
    assert "Section references are outside this document" in response.json()["detail"]
