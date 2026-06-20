"""
Tests for organization join link management (Phase 6).

Covers:
  - Admin can create, list, and revoke join links.
  - Users can join via valid links.
  - Invalid, expired, revoked, and exhausted links fail safely.
  - Non-admin cannot create/revoke.
  - Audit log records join link actions.
"""
import uuid
from datetime import datetime, timedelta
from app.models.time import utcnow
from contextlib import contextmanager
import pytest
from httpx import AsyncClient, ASGITransport, AsyncBaseTransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.future import select

from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrganizationJoinLink, OrgMemberRole, OrgMemberStatus
from app.models.audit import AuditLog


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture()
async def test_data(db: AsyncSession, test_user: User, test_org: Organization):
    """Seed base data for join link tests."""
    other_user = User(
        email="other@joinlinktest.com",
        name="Other Join User",
        password_hash="hashed",
        is_verified=True,
    )
    db.add(other_user)
    await db.commit()

    return {
        "admin_user": test_user,
        "other_user": other_user,
        "org": test_org,
    }


@contextmanager
def _client_context(db_engine, user: User):
    from app.main import app
    from app.database import get_db
    from app.dependencies import get_current_user

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    async def override_get_current_user():
        return user

    saved_db = app.dependency_overrides.get(get_db)
    saved_user = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        if saved_db is not None:
            app.dependency_overrides[get_db] = saved_db
        if saved_user is not None:
            app.dependency_overrides[get_current_user] = saved_user


# ── ADMIN CAN CREATE, LIST, REVOKE ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_can_create_join_link(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        resp = await client.post(f"/organizations/{org_id}/join-links", json={
            "role": "DEVELOPER",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "DEVELOPER"
        assert data["code"]
        assert len(data["code"]) > 0
        assert data["use_count"] == 0
        assert data["org_id"] == org_id


@pytest.mark.asyncio
async def test_admin_can_create_join_link_with_max_uses_and_expiry(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        resp = await client.post(f"/organizations/{org_id}/join-links", json={
            "role": "VIEWER",
            "max_uses": 5,
            "expires_in_days": 30,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "VIEWER"
        assert data["max_uses"] == 5
        assert data["expires_at"] is not None


@pytest.mark.asyncio
async def test_admin_can_list_join_links(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        await client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        await client.post(f"/organizations/{org_id}/join-links", json={"role": "VIEWER"})

        resp = await client.get(f"/organizations/{org_id}/join-links")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2


@pytest.mark.asyncio
async def test_admin_can_revoke_join_link(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        create_resp = await client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        link_id = create_resp.json()["id"]

        resp = await client.post(f"/organizations/{org_id}/join-links/{link_id}/revoke")
        assert resp.status_code == 200

        # Verify it appears as revoked in listing
        list_resp = await client.get(f"/organizations/{org_id}/join-links")
        link = next(l for l in list_resp.json() if l["id"] == link_id)
        assert link["revoked_at"] is not None


@pytest.mark.asyncio
async def test_revoking_already_revoked_link_fails(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        create_resp = await client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        link_id = create_resp.json()["id"]

        await client.post(f"/organizations/{org_id}/join-links/{link_id}/revoke")
        resp = await client.post(f"/organizations/{org_id}/join-links/{link_id}/revoke")
        assert resp.status_code == 400


# ── ACCEPT JOIN LINK ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_can_join_via_valid_link(db_engine, test_data):
    org_id = test_data["org"].id

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={
            "role": "DEVELOPER",
        })
        code = create_resp.json()["code"]

    with _client_context(db_engine, test_data["other_user"]) as user_client:
        resp = await user_client.post(f"/organizations/join-links/{code}/accept")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Joined organization successfully"

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        list_resp = await admin_client.get(f"/organizations/{org_id}/join-links")
        link = next(l for l in list_resp.json() if l["code"] == code)
        assert link["use_count"] == 1


@pytest.mark.asyncio
async def test_accepting_revoked_link_fails(db_engine, test_data):
    org_id = test_data["org"].id

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        link_id = create_resp.json()["id"]
        code = create_resp.json()["code"]

        await admin_client.post(f"/organizations/{org_id}/join-links/{link_id}/revoke")

    with _client_context(db_engine, test_data["other_user"]) as user_client:
        resp = await user_client.post(f"/organizations/join-links/{code}/accept")
        assert resp.status_code == 400
        assert "revoked" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_accepting_invalid_link_fails(db_engine, test_data):
    with _client_context(db_engine, test_data["other_user"]) as user_client:
        resp = await user_client.post("/organizations/join-links/nonexistent-code/accept")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_accepting_expired_link_fails(db_engine, test_data):
    org_id = test_data["org"].id

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={
            "role": "DEVELOPER",
            "expires_in_days": 1,
        })
        code = create_resp.json()["code"]

    # Manually set expiry in the past
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(OrganizationJoinLink).where(OrganizationJoinLink.code == code)
        )
        link = res.scalar_one()
        link.expires_at = utcnow() - timedelta(days=1)
        await session.commit()

    with _client_context(db_engine, test_data["other_user"]) as user_client:
        resp = await user_client.post(f"/organizations/join-links/{code}/accept")
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_accepting_exhausted_link_fails(db_engine, test_data):
    org_id = test_data["org"].id

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={
            "role": "DEVELOPER",
            "max_uses": 1,
        })
        code = create_resp.json()["code"]

    with _client_context(db_engine, test_data["other_user"]) as user_client:
        resp1 = await user_client.post(f"/organizations/join-links/{code}/accept")
        assert resp1.status_code == 200

    # Create another user to try
    another_user = User(
        email="another@joinlinktest.com",
        name="Another User",
        password_hash="hashed",
        is_verified=True,
    )
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        session.add(another_user)
        await session.commit()

    with _client_context(db_engine, another_user) as another_client:
        resp2 = await another_client.post(f"/organizations/join-links/{code}/accept")
        assert resp2.status_code == 400
        assert "reached maximum" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_accepting_when_already_member_fails(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        org_id = test_data["org"].id

        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        code = create_resp.json()["code"]

        # The test user is already an admin member of the org
        admin_resp = await admin_client.post(f"/organizations/join-links/{code}/accept")
        assert admin_resp.status_code == 409


# ── NON-ADMIN CANNOT CREATE/REVOKE ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_non_admin_cannot_create_join_link(db_engine, test_data):
    with _client_context(db_engine, test_data["other_user"]) as user_client:
        org_id = test_data["org"].id

        resp = await user_client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        assert resp.status_code == 404  # IDOR protection


@pytest.mark.asyncio
async def test_non_admin_cannot_revoke_join_link(db_engine, test_data):
    org_id = test_data["org"].id

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        link_id = create_resp.json()["id"]

    with _client_context(db_engine, test_data["other_user"]) as user_client:
        resp = await user_client.post(f"/organizations/{org_id}/join-links/{link_id}/revoke")
        assert resp.status_code == 404  # IDOR protection


# ── AUDIT LOG ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_log_records_create_join_link(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        await client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "create_join_link",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_audit_log_records_revoke_join_link(db_engine, test_data):
    with _client_context(db_engine, test_data["admin_user"]) as client:
        org_id = test_data["org"].id

        create_resp = await client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        link_id = create_resp.json()["id"]

        await client.post(f"/organizations/{org_id}/join-links/{link_id}/revoke")

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "revoke_join_link",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_audit_log_records_accept_join_link(db_engine, test_data):
    org_id = test_data["org"].id

    with _client_context(db_engine, test_data["admin_user"]) as admin_client:
        create_resp = await admin_client.post(f"/organizations/{org_id}/join-links", json={"role": "DEVELOPER"})
        code = create_resp.json()["code"]

    with _client_context(db_engine, test_data["other_user"]) as user_client:
        await user_client.post(f"/organizations/join-links/{code}/accept")

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "accept_join_link",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1
