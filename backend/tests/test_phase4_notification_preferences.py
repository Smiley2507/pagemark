"""Tests for notification preferences (Phase 4)."""

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db, engine, Base
from app.models.user import User, UserRole, UserSettings, RoleEnum
from app.services import auth_service
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
import json


def _build_auth_cookie(user_id: int) -> dict:
    token = auth_service.create_access_token(user_id)
    return {"access_token": token}


async def _seed_user(db: AsyncSession) -> User:
    user = User(
        email="notif-test@example.com",
        password_hash=auth_service.hash_password("testpass123"),
        name="Notification Tester",
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    db.add(UserRole(user_id=user.id, role=RoleEnum.USER))
    db.add(UserSettings(
        user_id=user.id,
        notifications_json=json.dumps({
            "member_activity": True,
            "document_sharing": True,
            "document_notes": True,
            "generation": True,
            "quality": True,
            "stale_sections": True,
            "source_sync": True,
            "invites": True,
        }),
    ))
    await db.commit()
    return user


async def test_get_default_notification_preferences():
    """Preferences default to all enabled."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with async_sessionmaker(engine, class_=AsyncSession)() as db:
            user = await _seed_user(db)

        cookies = _build_auth_cookie(user.id)
        client.cookies.update(cookies)
        resp = await client.get("/auth/me/notification-preferences")

        assert resp.status_code == 200
        data = resp.json()
        prefs = data["preferences"]
        for key in ("member_activity", "document_sharing", "generation", "quality",
                     "stale_sections", "source_sync", "invites"):
            assert prefs.get(key) is True, f"{key} should default to True"


async def test_update_notification_preferences():
    """Updating preferences persists and returns them."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with async_sessionmaker(engine, class_=AsyncSession)() as db:
            user = await _seed_user(db)

        cookies = _build_auth_cookie(user.id)
        client.cookies.update(cookies)

        update = {
            "preferences": {
                "member_activity": False,
                "document_sharing": True,
                "document_notes": False,
                "generation": True,
                "quality": False,
                "stale_sections": True,
                "source_sync": False,
                "invites": True,
            }
        }
        resp = await client.put("/auth/me/notification-preferences", json=update)
        assert resp.status_code == 200
        saved = resp.json()["preferences"]
        assert saved["member_activity"] is False
        assert saved["document_sharing"] is True
        assert saved["document_notes"] is False
        assert saved["generation"] is True
        assert saved["quality"] is False
        assert saved["stale_sections"] is True
        assert saved["source_sync"] is False
        assert saved["invites"] is True


async def test_notification_filter_enabled():
    """get_recent_activity respects disabled notification categories."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with async_sessionmaker(engine, class_=AsyncSession)() as db:
            user = await _seed_user(db)

        cookies = _build_auth_cookie(user.id)
        client.cookies.update(cookies)

        # Disable generation notifications
        update = {
            "preferences": {
                "member_activity": True,
                "document_sharing": True,
                "document_notes": True,
                "generation": False,
                "quality": True,
                "stale_sections": True,
                "source_sync": True,
                "invites": True,
            }
        }
        await client.put("/auth/me/notification-preferences", json=update)

        # Verify the preference persisted
        resp = await client.get("/auth/me/notification-preferences")
        assert resp.status_code == 200
        assert resp.json()["preferences"]["generation"] is False


async def test_partial_update_preserves_other_prefs():
    """Updating some preferences doesn't reset others to defaults."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with async_sessionmaker(engine, class_=AsyncSession)() as db:
            user = await _seed_user(db)

        cookies = _build_auth_cookie(user.id)
        client.cookies.update(cookies)

        # First update: disable generation and source_sync
        update1 = {
            "preferences": {
                "member_activity": True,
                "document_sharing": True,
                "document_notes": True,
                "generation": False,
                "quality": True,
                "stale_sections": True,
                "source_sync": False,
                "invites": True,
            }
        }
        await client.put("/auth/me/notification-preferences", json=update1)

        # Second update: only change generation back to True
        update2 = {
            "preferences": {
                "member_activity": True,
                "document_sharing": True,
                "document_notes": True,
                "generation": True,
                "quality": True,
                "stale_sections": True,
                "source_sync": False,
                "invites": True,
            }
        }
        resp = await client.put("/auth/me/notification-preferences", json=update2)
        saved = resp.json()["preferences"]
        assert saved["generation"] is True
        assert saved["source_sync"] is False
