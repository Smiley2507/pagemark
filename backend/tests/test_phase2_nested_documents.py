"""
Phase 2: Nested Document APIs Tests

Tests for nested document routes:
- GET /projects/{project_id}/documents
- POST /projects/{project_id}/documents
- GET /projects/{project_id}/documents/{document_id}
- PATCH /projects/{project_id}/documents/{document_id}
- GET /projects/{project_id}/documents/{document_id}/sections

Verifies:
- Project creation doesn't auto-create document
- Multiple documents can be created in one project
- Authorization prevents access to non-member projects
- Document CRUD operations work correctly
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import Project
from app.models.document import Document
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberStatus


@pytest.mark.asyncio
async def test_project_creation_no_auto_document(
    client: AsyncClient,
    test_user: User,
    test_org: Organization,
    db: AsyncSession,
):
    """Test that creating a project does NOT auto-create a document."""
    response = await client.post(
        "/projects",
        json={
            "name": "Test Project",
            "description": "A test project",
            "source_type": "scratch",
        },
        headers={"X-Organization-ID": str(test_org.id)},
    )
    
    assert response.status_code == 201
    data = response.json()
    
    # Verify no documents were created
    assert data["documents_count"] == 0
    assert data["sections_count"] == 0
    
    # Verify in database
    result = await db.execute(
        select(Document).where(Document.project_id == data["id"])
    )
    documents = list(result.scalars().all())
    assert len(documents) == 0, "Project should not have auto-created document"


@pytest.mark.asyncio
async def test_create_multiple_documents_in_project(
    client: AsyncClient,
    test_project: Project,
):
    """Test creating multiple documents in one project."""
    # Create first document
    response1 = await client.post(
        f"/projects/{test_project.id}/documents",
        json={
            "title": "API Reference",
            "purpose": "Document the API endpoints",
            "setup_stage": "purpose",
        },
    )
    assert response1.status_code == 201
    doc1 = response1.json()
    
    # Create second document
    response2 = await client.post(
        f"/projects/{test_project.id}/documents",
        json={
            "title": "User Guide",
            "purpose": "Teach users how to use the system",
            "setup_stage": "purpose",
        },
    )
    assert response2.status_code == 201
    doc2 = response2.json()
    
    # Verify both documents exist
    assert doc1["id"] != doc2["id"]
    assert doc1["title"] == "API Reference"
    assert doc2["title"] == "User Guide"
    
    # List documents
    response3 = await client.get(f"/projects/{test_project.id}/documents")
    assert response3.status_code == 200
    list_data = response3.json()
    
    assert list_data["total"] == 2
    assert len(list_data["documents"]) == 2


@pytest.mark.asyncio
async def test_document_authorization(
    client: AsyncClient,
    test_project: Project,
    other_user: User,
    other_user_client: AsyncClient,
):
    """Test that non-members cannot access project documents."""
    # Create document as authorized user
    response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={
            "title": "Private Document",
            "setup_stage": "purpose",
        },
    )
    assert response.status_code == 201
    doc_id = response.json()["id"]
    
    # Try to access as unauthorized user
    unauth_response = await other_user_client.get(
        f"/projects/{test_project.id}/documents"
    )
    assert unauth_response.status_code == 403
    
    # Try to get specific document as unauthorized user
    unauth_doc_response = await other_user_client.get(
        f"/projects/{test_project.id}/documents/{doc_id}"
    )
    assert unauth_doc_response.status_code == 403


@pytest.mark.asyncio
async def test_get_document_details(
    client: AsyncClient,
    test_project: Project,
):
    """Test getting specific document details."""
    # Create document
    create_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={
            "title": "Test Document",
            "purpose": "Testing purposes",
            "audience": "Developers",
            "context": "Integration testing",
            "setup_stage": "purpose",
            "tags": ["test", "integration"],
        },
    )
    assert create_response.status_code == 201
    doc_id = create_response.json()["id"]
    
    # Get document details
    response = await client.get(
        f"/projects/{test_project.id}/documents/{doc_id}"
    )
    assert response.status_code == 200
    doc = response.json()
    
    assert doc["id"] == doc_id
    assert doc["title"] == "Test Document"
    assert doc["purpose"] == "Testing purposes"
    assert doc["audience"] == "Developers"
    assert doc["context"] == "Integration testing"
    assert doc["tags"] == ["test", "integration"]
    assert doc["setup_stage"] == "purpose"


@pytest.mark.asyncio
async def test_update_document(
    client: AsyncClient,
    test_project: Project,
):
    """Test updating document fields."""
    # Create document
    create_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={
            "title": "Original Title",
            "setup_stage": "purpose",
        },
    )
    doc_id = create_response.json()["id"]
    
    # Update document
    update_response = await client.patch(
        f"/projects/{test_project.id}/documents/{doc_id}",
        json={
            "title": "Updated Title",
            "purpose": "New purpose",
            "setup_stage": "template_selection",
            "tags": ["updated"],
        },
    )
    assert update_response.status_code == 200
    doc = update_response.json()
    
    assert doc["title"] == "Updated Title"
    assert doc["purpose"] == "New purpose"
    assert doc["setup_stage"] == "template_selection"
    assert doc["tags"] == ["updated"]


@pytest.mark.asyncio
async def test_get_document_sections_empty(
    client: AsyncClient,
    test_project: Project,
):
    """Test getting sections for a new document (should be empty)."""
    # Create document
    create_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "Test Document", "setup_stage": "purpose"},
    )
    doc_id = create_response.json()["id"]
    
    # Get sections (should be empty)
    response = await client.get(
        f"/projects/{test_project.id}/documents/{doc_id}/sections"
    )
    assert response.status_code == 200
    data = response.json()
    
    assert data["sections"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_document_not_found(
    client: AsyncClient,
    test_project: Project,
):
    """Test getting non-existent document returns 404."""
    response = await client.get(
        f"/projects/{test_project.id}/documents/99999"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_document_belongs_to_project(
    client: AsyncClient,
    test_project: Project,
    other_project: Project,
):
    """Test that document must belong to the specified project."""
    # Create document in project 1
    create_response = await client.post(
        f"/projects/{test_project.id}/documents",
        json={"title": "Project 1 Doc", "setup_stage": "purpose"},
    )
    doc_id = create_response.json()["id"]
    
    # Try to access via project 2 (should fail)
    response = await client.get(
        f"/projects/{other_project.id}/documents/{doc_id}"
    )
    assert response.status_code == 404


# ── Test Fixtures ────────────────────────────────────────────────────


@pytest.fixture
async def test_org(db: AsyncSession, test_user: User) -> Organization:
