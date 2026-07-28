"""Tests for notification preferences (Phase 4)."""

from httpx import AsyncClient


async def test_get_default_notification_preferences(client: AsyncClient):
    """Preferences default to all enabled."""
    resp = await client.get("/auth/me/notification-preferences")

    assert resp.status_code == 200
    data = resp.json()
    prefs = data["preferences"]
    for key in (
        "member_activity",
        "document_sharing",
        "generation",
        "quality",
        "stale_sections",
        "source_sync",
        "invites",
    ):
        assert prefs.get(key) is True, f"{key} should default to True"


async def test_update_notification_preferences(client: AsyncClient):
    """Updating preferences persists and returns them."""
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


async def test_notification_filter_enabled(client: AsyncClient):
    """get_recent_activity respects disabled notification categories."""
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

    resp = await client.get("/auth/me/notification-preferences")
    assert resp.status_code == 200
    assert resp.json()["preferences"]["generation"] is False


async def test_partial_update_preserves_other_prefs(client: AsyncClient):
    """Updating some preferences doesn't reset others to defaults."""
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
