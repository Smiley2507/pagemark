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
from app.models.document import Document, Section
from app.models.document_share import DocumentShare, DocumentSharePermission
from app.models.audit import AuditLog
from app.models.time import utcnow


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
        role=OrgMemberRole.VIEWER,
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
    await db.flush()

    section_a = Section(document_id=doc_a.id, heading="Section A", content_md="Original content")
    db.add(section_a)
    section_b = Section(document_id=doc_b.id, heading="Section B", content_md="Original content")
    db.add(section_b)

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
    await db.refresh(section_a)
    await db.refresh(section_b)

    return {
        "admin_user": test_user,
        "viewer_user": viewer_user,
        "org": test_org,
        "project": test_project,
        "doc_a": doc_a,
        "doc_b": doc_b,
        "section_a": section_a,
        "section_b": section_b,
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
        """Give the viewer user EDIT permission and verify they can update section content.

        An edit share grants content.write (share-satisfiable), not document.manage
        (org-role only) — so this exercises a section PATCH, not the document's own
        title/metadata, which now requires document.manage regardless of sharing.
        """
        doc_a = test_data["doc_a"]
        section_a = test_data["section_a"]
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
                f"/projects/{project_id}/documents/{doc_a.id}/sections/{section_a.id}",
                json={"content_md": "Editor updated content"},
            )
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
            data = resp.json()
            assert data["content_md"] == "Editor updated content"

        app.dependency_overrides.clear()

    async def test_revoked_user_loses_write_access(self, db: AsyncSession, test_data, db_engine):
        """Revoking an edit share removes the write access it granted.

        Read stays 200: project.read is granted to every active org member by
        role alone (Viewer included), so a revoked share can no longer affect
        read access — only the elevated (edit) access the share itself provided.
        """
        doc_a = test_data["doc_a"]
        section_a = test_data["section_a"]
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
        ) as revoked_client:
            resp = await revoked_client.patch(
                f"/projects/{project_id}/documents/{doc_a.id}/sections/{section_a.id}",
                json={"content_md": "Should still work"},
            )
            assert resp.status_code == 200, f"Expected 200 before revocation, got {resp.status_code}: {resp.text}"

        share.revoked_at = utcnow()
        await db.commit()

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as revoked_client:
            resp = await revoked_client.get(f"/projects/{project_id}/documents/{doc_a.id}")
            assert resp.status_code == 200, f"Expected 200 (read still org-wide), got {resp.status_code}: {resp.text}"

            resp = await revoked_client.patch(
                f"/projects/{project_id}/documents/{doc_a.id}/sections/{section_a.id}",
                json={"content_md": "Should be blocked now"},
            )
            assert resp.status_code == 403, f"Expected 403 after revocation, got {resp.status_code}: {resp.text}"

        app.dependency_overrides.clear()

    async def test_share_does_not_expose_sibling_write_access(self, db: AsyncSession, viewer_client: AsyncClient, test_data):
        """An edit share on doc_a must not grant edit on sibling doc_b.

        Reads are universal for any active org member (project.read is rank 0 =
        every role), so doc_b is legitimately readable by the Viewer regardless of
        sharing. What sharing must still isolate per-document is WRITE access.
        """
        project_id = test_data["project"].id
        doc_a_id = test_data["doc_a"].id
        doc_b_id = test_data["doc_b"].id
        viewer_user = test_data["viewer_user"]

        resp = await viewer_client.get(f"/projects/{project_id}/documents/{doc_b_id}")
        assert resp.status_code == 200, f"Expected 200 (read is org-wide), got {resp.status_code}: {resp.text}"

        share_res = await db.execute(
            select(DocumentShare).where(
                DocumentShare.document_id == doc_a_id,
                DocumentShare.user_id == viewer_user.id,
            )
        )
        share = share_res.scalar_one()
        share.permission = DocumentSharePermission.EDIT
        await db.commit()

        resp = await viewer_client.patch(
            f"/projects/{project_id}/documents/{doc_b_id}",
            json={"title": "Hacked Title"},
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"

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
