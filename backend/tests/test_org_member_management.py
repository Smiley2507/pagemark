"""
Tests for organization member management (Phase 5).

Covers:
  - Admin can search, invite, resend pending invite, update role, remove member.
  - Non-admin cannot mutate members.
  - Audit log records member actions.
"""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.future import select

from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.audit import AuditLog
from app.models.project import Project, SourceType


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture()
async def test_data(db: AsyncSession, test_user: User, test_org: Organization):
    """Seed members for testing."""
    member_user = User(
        email="member@example.com",
        name="Member User",
        password_hash="hashed",
        is_verified=True,
    )
    db.add(member_user)
    await db.flush()

    db.add(OrganizationMember(
        org_id=test_org.id,
        user_id=member_user.id,
        role=OrgMemberRole.DEVELOPER,
        status=OrgMemberStatus.ACTIVE,
    ))

    invited_user = User(
        email="invited@example.com",
        name="Invited User",
        password_hash="hashed",
        is_verified=True,
    )
    db.add(invited_user)
    await db.flush()

    db.add(OrganizationMember(
        org_id=test_org.id,
        user_id=invited_user.id,
        role=OrgMemberRole.DEVELOPER,
        status=OrgMemberStatus.INVITED,
        invite_token=uuid.uuid4().hex,
    ))

    await db.commit()

    return {
        "admin_user": test_user,
        "member_user": member_user,
        "invited_user": invited_user,
        "org": test_org,
    }


@pytest.fixture()
async def pm_user(db: AsyncSession, test_org: Organization) -> User:
    """A Project Manager member."""
    user = User(
        email="pm@example.com",
        name="PM User",
        password_hash="hashed",
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    db.add(OrganizationMember(
        org_id=test_org.id,
        user_id=user.id,
        role=OrgMemberRole.PROJECT_MANAGER,
        status=OrgMemberStatus.ACTIVE,
    ))
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture()
async def viewer_user(db: AsyncSession, test_org: Organization) -> User:
    """A Viewer member."""
    user = User(
        email="viewer@example.com",
        name="Viewer User",
        password_hash="hashed",
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    db.add(OrganizationMember(
        org_id=test_org.id,
        user_id=user.id,
        role=OrgMemberRole.VIEWER,
        status=OrgMemberStatus.ACTIVE,
    ))
    await db.commit()
    await db.refresh(user)
    return user


def _make_client(db_engine, user: User) -> AsyncClient:
    """Create a test client authenticated as the given user."""
    from app.main import app
    from app.database import get_db
    from app.dependencies import get_current_user

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            yield session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    client = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )
    return client


# ── ADMIN CAN MANAGE MEMBERS ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_can_search_members(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.get(f"/organizations/{org_id}/members?search=member")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert any(m["user_email"] == "member@example.com" for m in data)


@pytest.mark.asyncio
async def test_admin_can_filter_by_role(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.get(f"/organizations/{org_id}/members?role=DEVELOPER")
    assert resp.status_code == 200
    data = resp.json()
    assert all(m["role"] == "DEVELOPER" for m in data)


@pytest.mark.asyncio
async def test_admin_can_filter_by_status(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.get(f"/organizations/{org_id}/members?status=INVITED")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert all(m["status"] == "INVITED" for m in data)


@pytest.mark.asyncio
async def test_admin_can_invite_member(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    new_user = User(
        email="newuser@example.com",
        name="New User",
        password_hash="hashed",
        is_verified=True,
    )
    # Need a session to add the user first
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        session.add(new_user)
        await session.commit()

    resp = await client.post(f"/organizations/{org_id}/invites", json={
        "email": "newuser@example.com",
        "role": "developer",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "member_id" in data


@pytest.mark.asyncio
async def test_admin_can_resend_invite(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.post(f"/organizations/{org_id}/invites/{test_data['invited_user'].id}/resend")
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Invitation resent"


@pytest.mark.asyncio
async def test_admin_can_update_role(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.put(
        f"/organizations/{org_id}/members/{test_data['member_user'].id}",
        json={"role": "project_manager"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "PROJECT_MANAGER"


@pytest.mark.asyncio
async def test_admin_can_remove_member(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.delete(f"/organizations/{org_id}/members/{test_data['member_user'].id}")
    assert resp.status_code == 204


# ── NON-ADMIN CANNOT MUTATE MEMBERS ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_non_admin_cannot_invite(db_engine, test_data, viewer_user):
    client = _make_client(db_engine, viewer_user)
    org_id = test_data["org"].id

    resp = await client.post(f"/organizations/{org_id}/invites", json={
        "email": "anyone@example.com",
        "role": "developer",
    })
    assert resp.status_code == 404  # IDOR protection


@pytest.mark.asyncio
async def test_non_admin_cannot_update_role(db_engine, test_data, viewer_user):
    client = _make_client(db_engine, viewer_user)
    org_id = test_data["org"].id

    resp = await client.put(
        f"/organizations/{org_id}/members/{test_data['member_user'].id}",
        json={"role": "admin"},
    )
    assert resp.status_code == 404  # IDOR protection


@pytest.mark.asyncio
async def test_non_admin_cannot_remove_member(db_engine, test_data, viewer_user):
    client = _make_client(db_engine, viewer_user)
    org_id = test_data["org"].id

    resp = await client.delete(f"/organizations/{org_id}/members/{test_data['member_user'].id}")
    assert resp.status_code == 404  # IDOR protection


@pytest.mark.asyncio
async def test_non_admin_cannot_resend_invite(db_engine, test_data, viewer_user):
    client = _make_client(db_engine, viewer_user)
    org_id = test_data["org"].id

    resp = await client.post(f"/organizations/{org_id}/invites/{test_data['invited_user'].id}/resend")
    assert resp.status_code == 404  # IDOR protection


# ── PROJECT MANAGER CAN VIEW BUT NOT MUTATE ─────────────────────────────────────


@pytest.mark.asyncio
async def test_pm_can_list_members(db_engine, test_data, pm_user):
    client = _make_client(db_engine, pm_user)
    org_id = test_data["org"].id

    resp = await client.get(f"/organizations/{org_id}/members")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_pm_cannot_invite(db_engine, test_data, pm_user):
    client = _make_client(db_engine, pm_user)
    org_id = test_data["org"].id

    resp = await client.post(f"/organizations/{org_id}/invites", json={
        "email": "anyone@example.com",
        "role": "developer",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pm_cannot_update_role(db_engine, test_data, pm_user):
    client = _make_client(db_engine, pm_user)
    org_id = test_data["org"].id

    resp = await client.put(
        f"/organizations/{org_id}/members/{test_data['member_user'].id}",
        json={"role": "admin"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_pm_cannot_remove_member(db_engine, test_data, pm_user):
    client = _make_client(db_engine, pm_user)
    org_id = test_data["org"].id

    resp = await client.delete(f"/organizations/{org_id}/members/{test_data['member_user'].id}")
    assert resp.status_code == 404


# ── AUDIT LOG RECORDS MEMBER ACTIONS ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_log_records_invite(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        new_user = User(
            email="audittest@example.com",
            name="Audit Test",
            password_hash="hashed",
            is_verified=True,
        )
        session.add(new_user)
        await session.commit()

    await client.post(f"/organizations/{org_id}/invites", json={
        "email": "audittest@example.com",
        "role": "developer",
    })

    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "invite_member",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_audit_log_records_role_update(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    await client.put(
        f"/organizations/{org_id}/members/{test_data['member_user'].id}",
        json={"role": "technical_writer"},
    )

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "update_member_role",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_audit_log_records_remove(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    await client.delete(f"/organizations/{org_id}/members/{test_data['member_user'].id}")

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "revoke_membership",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1


@pytest.mark.asyncio
async def test_audit_log_records_resend_invite(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    await client.post(f"/organizations/{org_id}/invites/{test_data['invited_user'].id}/resend")

    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        res = await session.execute(
            select(AuditLog).where(
                AuditLog.org_id == org_id,
                AuditLog.action == "resend_invite",
            )
        )
        logs = res.scalars().all()
    assert len(logs) >= 1


# ── RESEND INVITE VALIDATION ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resend_invite_fails_for_active_member(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.post(f"/organizations/{org_id}/invites/{test_data['member_user'].id}/resend")
    assert resp.status_code == 400
    assert "pending" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_resend_invite_fails_for_nonexistent_user(db_engine, test_data):
    client = _make_client(db_engine, test_data["admin_user"])
    org_id = test_data["org"].id

    resp = await client.post(f"/organizations/{org_id}/invites/99999/resend")
    assert resp.status_code == 404
