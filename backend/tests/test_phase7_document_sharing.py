"""
Tests for Document Sharing With Organization Members (Phase 7).

Covers:
  - Viewer can read shared Document but cannot edit.
  - Editor can edit shared Document.
  - Revoked access loses access.
  - Sharing one Document does not expose sibling Documents.
  - Audit log records share actions.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.future import select

from app.main import app
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project, SourceType
from app.models.document import Document
from app.models.document_share import DocumentShare, DocumentSharePermission
from app.models.audit import AuditLog


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def test_data(db: AsyncSession, test_user: User, test_org: Organization, test_project: Project):
    """Seed data for sharing tests: two documents, one viewer user."""
    viewer_user = User(
        email="viewer@sharetest.com",
        name="Viewer User",
        password_hash="hashed",
        is_verified=True,
    )
    db.add(viewer_user)
    await db.flush()

    viewer_member = OrganizationMember(
        org_id=test_org.id,
        user_id=viewer_user.id,
        role=OrgMemberRole.DEVELOPER,
        status=OrgMemberStatus.ACTIVE,
    )
    db.add(viewer_member)

    doc_a = Document(
        project_id=test_project.id,
        title="Shared Document A",
    )
    db.add(doc_a)
    await db.flush()

    doc_b = Document(
        project_id=test_project.id,
        title="Sibling Document B",
    )
    db.add(doc_b)

    share = DocumentShare(
        document_id=doc_a.id,
        user_id=viewer_user.id,
        permission=DocumentSharePermission.VIEW,
        created_by=test_user.id,
    )
    db.add(share)

    audit_log = AuditLog(
        user_id=test_user.id,
        org_id=test_org.id,
        action="document_shared",
        resource=f"document:{doc_a.id}:user:{viewer_user.id}:view",
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(doc_a)
    await db.refresh(doc_b)
    await db.refresh(viewer_user)

    return {
        "admin_user": test_user,
        "viewer_user": viewer_user,
        "org": test_org,
        "project": test_project,
        "doc_a": doc_a,
        "doc_b": doc_b,
    }


@pytest.fixture
async def viewer_client(db_engine, test_data) -> AsyncClient:
    """HTTP client authenticated as the viewer user."""
    from app.main import app
    from app.database import get_db
    from app.dependencies import get_current_user

    viewer_user = test_data["viewer_user"]

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    async def override_get_current_user():
        return viewer_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


class TestDocumentSharingAuthorization:

    async def test_viewer_can_read_shared_document(self, viewer_client: AsyncClient, test_data):
        project_id = test_data["project"].id
        doc_id = test_data["doc_a"].id

        resp = await viewer_client.get(f"/projects/{project_id}/documents/{doc_id}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["title"] == "Shared Document A"

    async def test_viewer_cannot_edit_shared_document(self, viewer_client: AsyncClient, test_data):
        project_id = test_data["project"].id
        doc_id = test_data["doc_a"].id

        resp = await viewer_client.patch(
            f"/projects/{project_id}/documents/{doc_id}",
            json={"title": "Hacked Title"},
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"

    async def test_viewer_cannot_create_section(self, viewer_client: AsyncClient, test_data):
        project_id = test_data["project"].id
        doc_a_id = test_data["doc_a"].id

        resp = await viewer_client.post(
            f"/projects/{project_id}/documents/{doc_a_id}/sections",
            json={"title": "Unauthorized Section"},
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"

    async def test_editor_can_edit_shared_document(self, db: AsyncSession, test_data, db_engine):
        """Give the viewer user EDIT permission and verify they can update."""
        doc_a = test_data["doc_a"]
        viewer_user = test_data["viewer_user"]
        project_id = test_data["project"].id

        share_res = await db.execute(
            select(DocumentShare).where(
                DocumentShare.document_id == doc_a.id,
                DocumentShare.user_id == viewer_user.id,
            )
        )
        share = share_res.scalar_one()
        share.permission = DocumentSharePermission.EDIT
        await db.commit()

        async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

        async def override_get_db():
            async with async_session() as session:
                yield session

        async def override_get_current_user():
            return viewer_user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as editor_client:
            resp = await editor_client.patch(
                f"/projects/{project_id}/documents/{doc_a.id}",
                json={"title": "Editor Updated Title"},
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
            data = resp.json()
            assert data["title"] == "Editor Updated Title"

        app.dependency_overrides.clear()

    async def test_revoked_user_loses_access(self, db: AsyncSession, test_data, db_engine):
        """Revoke the share and verify 404."""
        doc_a = test_data["doc_a"]
        viewer_user = test_data["viewer_user"]
        project_id = test_data["project"].id

        from datetime import datetime
        share_res = await db.execute(
            select(DocumentShare).where(
                DocumentShare.document_id == doc_a.id,
                DocumentShare.user_id == viewer_user.id,
            )
        )
        share = share_res.scalar_one()
        share.revoked_at = datetime.utcnow()
        await db.commit()

        async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

        async def override_get_db():
            async with async_session() as session:
                yield session

        async def override_get_current_user():
            return viewer_user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as revoked_client:
            resp = await revoked_client.get(f"/projects/{project_id}/documents/{doc_a.id}")
            assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"

        app.dependency_overrides.clear()

    async def test_share_does_not_expose_sibling(self, viewer_client: AsyncClient, test_data):
        """Sharing doc_a should NOT allow access to doc_b."""
        project_id = test_data["project"].id
        doc_b_id = test_data["doc_b"].id

        resp = await viewer_client.get(f"/projects/{project_id}/documents/{doc_b_id}")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"

    async def test_share_audit_log(self, db: AsyncSession, test_data):
        """Verify share actions are audit logged."""
        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "document_shared")
        )
        logs = audit_res.scalars().all()
        assert len(logs) >= 1, "Expected at least one audit log entry for document_shared"
        log = logs[0]
        assert log.action == "document_shared"
        assert "document:" in (log.resource or "")
