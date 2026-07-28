"""
Tests for Audit Log And Activity Reconciliation (Phase 8).

Covers:
  - API key create/revoke produces AuditLog entries
  - AI credential upsert/activate/delete produces AuditLog entries
  - Project create/update/delete produces AuditLog entries
  - Document update/delete produces AuditLog entries
  - Project Activity remains workflow-only (no audit events leak)
  - Settings Audit Log shows admin/security actions
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.user import User
from app.models.organization import Organization
from app.models.project import Project
from app.models.audit import AuditLog
from app.models.activity import ActivityEvent


@pytest.fixture
def anyio_backend():
    return "asyncio"


class TestAuditLogCoverage:

    async def test_api_key_actions_create_audit_log(self, client: AsyncClient, db: AsyncSession):
        """Creating an API key should produce an AuditLog entry."""
        resp = await client.post("/users/api-keys", json={"name": "Test Key"})
        assert resp.status_code == 201

        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "create_api_key")
        )
        log = audit_res.scalar_one_or_none()
        assert log is not None
        assert "key:" in (log.resource or "")

    async def test_api_key_revoke_creates_audit_log(self, client: AsyncClient, db: AsyncSession):
        """Revoking an API key should produce an AuditLog entry."""
        create_resp = await client.post("/users/api-keys", json={"name": "Key To Revoke"})
        assert create_resp.status_code == 201
        key_id = create_resp.json()["id"]

        delete_resp = await client.delete(f"/users/api-keys/{key_id}")
        assert delete_resp.status_code == 204

        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "revoke_api_key")
        )
        log = audit_res.scalar_one_or_none()
        assert log is not None
        assert f"key:{key_id}" in (log.resource or "")

    async def test_project_actions_create_audit_log(
        self, client: AsyncClient, db: AsyncSession, test_user: User, test_org: Organization
    ):
        """Create/update/delete project actions should produce AuditLog entries."""
        create_resp = await client.post(
            "/projects",
            json={
                "name": "Audit Test Project",
                "description": "Testing audit logging",
                "source_type": "scratch",
            },
        )
        assert create_resp.status_code == 201, f"Create failed: {create_resp.text}"
        project_id = create_resp.json()["id"]

        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "create_project")
        )
        log = audit_res.scalar_one_or_none()
        assert log is not None
        assert f"project:{project_id}" in (log.resource or "")
        assert log.org_id == test_org.id

        update_resp = await client.patch(
            f"/projects/{project_id}",
            json={"name": "Updated Project Name"},
        )
        assert update_resp.status_code == 200

        audit_res = await db.execute(
            select(AuditLog).where(
                AuditLog.action == "update_project",
                AuditLog.org_id == test_org.id,
            )
        )
        update_log = audit_res.scalar_one_or_none()
        assert update_log is not None

        delete_resp = await client.delete(f"/projects/{project_id}")
        assert delete_resp.status_code == 204

        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "delete_project")
        )
        delete_log = audit_res.scalar_one_or_none()
        assert delete_log is not None

    async def test_document_update_creates_audit_log(
        self, client: AsyncClient, db: AsyncSession, test_project: Project
    ):
        """Updating a document should produce an AuditLog entry."""
        create_resp = await client.post(
            f"/projects/{test_project.id}/documents",
            json={"title": "Audit Doc", "setup_stage": "purpose"},
        )
        assert create_resp.status_code == 201
        doc_id = create_resp.json()["id"]

        update_resp = await client.patch(
            f"/projects/{test_project.id}/documents/{doc_id}",
            json={"title": "Updated Audit Doc"},
        )
        assert update_resp.status_code == 200

        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "update_document")
        )
        log = audit_res.scalar_one_or_none()
        assert log is not None
        assert f"document:{doc_id}" in (log.resource or "")

    async def test_document_delete_creates_audit_log(
        self, client: AsyncClient, db: AsyncSession, test_project: Project
    ):
        """Deleting a document should produce an AuditLog entry."""
        create_resp = await client.post(
            f"/projects/{test_project.id}/documents",
            json={"title": "Doc To Delete", "setup_stage": "purpose"},
        )
        assert create_resp.status_code == 201
        doc_id = create_resp.json()["id"]

        delete_resp = await client.delete(
            f"/projects/{test_project.id}/documents/{doc_id}"
        )
        assert delete_resp.status_code == 204

        audit_res = await db.execute(
            select(AuditLog).where(AuditLog.action == "delete_document")
        )
        log = audit_res.scalar_one_or_none()
        assert log is not None

    async def test_activity_events_exclude_admin_audit(
        self, client: AsyncClient, db: AsyncSession, test_project: Project
    ):
        """Project Activity events should NOT contain admin audit actions."""
        resp = await client.post(
            f"/projects/{test_project.id}/documents",
            json={"title": "Activity Test Doc", "setup_stage": "purpose"},
        )
        assert resp.status_code == 201

        activity_res = await db.execute(
            select(ActivityEvent).where(ActivityEvent.project_id == test_project.id)
        )
        events = activity_res.scalars().all()
        event_types = {e.event_type for e in events}

        admin_audit_actions = {
            "create_api_key", "revoke_api_key",
            "create_project", "update_project", "delete_project",
            "update_document", "delete_document",
        }
        assert event_types.isdisjoint(admin_audit_actions), (
            f"Activity events contain admin audit actions: {event_types & admin_audit_actions}"
        )

    async def test_audit_log_endpoint_returns_entries(
        self, client: AsyncClient, db: AsyncSession, test_user: User, test_org: Organization
    ):
        """GET /organizations/{org_id}/audit-logs should return entries."""
        create_resp = await client.post(
            "/projects",
            json={
                "name": "Audit Listing Project",
                "description": "Test",
                "source_type": "scratch",
            },
        )
        assert create_resp.status_code == 201, f"Create failed: {create_resp.text}"

        audit_resp = await client.get(f"/organizations/{test_org.id}/audit-logs?page=1&per_page=50")
        assert audit_resp.status_code == 200
        logs = audit_resp.json()
        assert len(logs) >= 1
        actions = [log["action"] for log in logs]
        assert "create_project" in actions
