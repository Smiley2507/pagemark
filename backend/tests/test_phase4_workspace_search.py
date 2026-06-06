from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, Section, SectionStatus
from app.models.organization import Organization
from app.models.project import Project


@pytest.mark.asyncio
async def test_global_search_filters_types_tags_status_and_sorts(
    client: AsyncClient,
    test_project: Project,
    test_org: Organization,
    db: AsyncSession,
):
    base = datetime(2026, 1, 1, 12, 0, 0)
    test_project.name = "Alpha Workspace"
    test_project.description = "Payments source workspace"
    test_project.tags = ["payments", "api"]
    test_project.created_at = base
    test_project.updated_at = base + timedelta(days=2)

    guide = Document(
        project_id=test_project.id,
        title="Integration Guide",
        purpose="Teach integrators how to retry payment calls",
        tags=["integrations"],
        created_at=base + timedelta(hours=1),
        updated_at=base + timedelta(days=3),
    )
    reference = Document(
        project_id=test_project.id,
        title="API Reference",
        purpose="Endpoint details",
        tags=["api"],
        created_at=base + timedelta(hours=2),
        updated_at=base + timedelta(days=1),
    )
    db.add_all([guide, reference])
    await db.flush()

    db.add_all([
        Section(
            document_id=guide.id,
            heading="Retry Behavior",
            content_md="Retry failed payment captures with backoff.",
            status=SectionStatus.DRAFT,
            created_at=base + timedelta(hours=3),
            updated_at=base + timedelta(days=4),
        ),
        Section(
            document_id=reference.id,
            heading="Authentication",
            content_md="Use a provider token.",
            status=SectionStatus.PENDING,
            created_at=base + timedelta(hours=4),
            updated_at=base + timedelta(days=1),
        ),
    ])
    await db.commit()

    doc_response = await client.get(
        "/projects/search",
        params={"q": "guide", "type": "document", "sort": "name"},
        headers={"X-Organization-ID": str(test_org.id)},
    )
    assert doc_response.status_code == 200
    doc_results = doc_response.json()["results"]
    assert [item["type"] for item in doc_results] == ["document"]
    assert doc_results[0]["title"] == "Integration Guide"

    section_response = await client.get(
        "/projects/search",
        params={"q": "retry", "type": "section", "status": "draft", "tag": "payments"},
        headers={"X-Organization-ID": str(test_org.id)},
    )
    assert section_response.status_code == 200
    section_results = section_response.json()["results"]
    assert len(section_results) == 1
    assert section_results[0]["type"] == "section"
    assert section_results[0]["section_heading"] == "Retry Behavior"
    assert "payments" in section_results[0]["tags"]

    added_response = await client.get(
        "/projects/search",
        params={"type": "document", "sort": "last_added"},
        headers={"X-Organization-ID": str(test_org.id)},
    )
    assert added_response.status_code == 200
    added_titles = [item["title"] for item in added_response.json()["results"]]
    assert added_titles[:2] == ["API Reference", "Integration Guide"]


@pytest.mark.asyncio
async def test_project_name_and_description_edits_persist(
    client: AsyncClient,
    test_project: Project,
):
    response = await client.patch(
        f"/projects/{test_project.id}",
        json={
            "name": "Renamed Workspace",
            "description": "Edited description",
        },
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed Workspace"
    assert response.json()["description"] == "Edited description"

    get_response = await client.get(f"/projects/{test_project.id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "Renamed Workspace"
    assert get_response.json()["description"] == "Edited description"
