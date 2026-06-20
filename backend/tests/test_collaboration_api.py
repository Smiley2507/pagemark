import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.document import Document, DocumentStatus, Section, SectionContentLifecycle, SectionStatus
from app.models.version import AuthorType, SectionVersion
from app.routers.documents import _liveblocks_auth_body, _liveblocks_permissions


def feature_name(scope: str) -> str:
    if scope.startswith("room:presence:"):
        return "presence"
    return scope.split(":", 1)[0]


def assert_at_most_one_scope_per_feature(permissions: list[str]) -> None:
    features = [feature_name(scope) for scope in permissions]
    assert len(features) == len(set(features))


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def collaboration_section(db: AsyncSession, test_project):
    document = Document(project_id=test_project.id, title="Collaborative Document")
    db.add(document)
    await db.flush()

    section = Section(
        document_id=document.id,
        order_index=0,
        heading="Overview",
        title="Overview",
        content_md="Initial content",
        content_lifecycle=SectionContentLifecycle.REVIEWED,
        status=SectionStatus.FINALIZED,
    )
    db.add(section)
    await db.commit()
    await db.refresh(document)
    await db.refresh(section)
    return document, section


async def test_collaboration_auth_uses_section_room_and_edit_permission(
    client: AsyncClient,
    collaboration_section,
    test_project,
    monkeypatch,
):
    document, section = collaboration_section
    captured = {}

    async def fake_authorize_liveblocks_session(**kwargs):
        captured.update(kwargs)
        return 200, '{"token":"test-token"}'

    monkeypatch.setattr(
        "app.routers.documents._authorize_liveblocks_session",
        fake_authorize_liveblocks_session,
    )

    response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}/collaboration/auth"
    )

    assert response.status_code == 200
    assert response.json() == {"token": "test-token", "userInfo": {"permission": "edit"}}
    assert captured["room_id"] == f"project:{test_project.id}:document:{document.id}:section:{section.id}"
    assert captured["permission"] == "edit"
    assert captured["approved"] is False


def test_liveblocks_edit_permissions_use_single_room_access_level():
    permissions = _liveblocks_permissions("edit", approved=False)

    assert "room:write" in permissions
    assert "room:read" not in permissions
    assert "room:presence:write" in permissions
    assert "comments:write" in permissions
    assert "comments:read" not in permissions
    assert_at_most_one_scope_per_feature(permissions)


def test_liveblocks_auth_body_matches_authorize_user_contract():
    room_id = "project:1:document:2:section:3"

    body = _liveblocks_auth_body(
        room_id=room_id,
        user_id=7,
        user_name="Demo User",
        user_email="demo@example.com",
        user_avatar_url=None,
        permission="edit",
        org_id=11,
        approved=False,
    )

    assert body == {
        "userId": "7",
        "permissions": {
            room_id: ["room:presence:write", "room:write", "comments:write"],
        },
        "userInfo": {
            "name": "Demo User",
            "email": "demo@example.com",
            "avatar": None,
            "permission": "edit",
        },
        "organizationId": "11",
    }
    assert_at_most_one_scope_per_feature(body["permissions"][room_id])


def test_liveblocks_read_only_permissions_use_single_room_access_level():
    approved_edit_permissions = _liveblocks_permissions("edit", approved=True)
    view_permissions = _liveblocks_permissions("view", approved=False)

    assert approved_edit_permissions == [
        "room:read",
        "room:presence:write",
        "comments:write",
    ]
    assert view_permissions == [
        "room:read",
        "room:presence:write",
        "comments:read",
    ]
    assert_at_most_one_scope_per_feature(approved_edit_permissions)
    assert_at_most_one_scope_per_feature(view_permissions)


def test_liveblocks_comment_permissions_use_single_comments_scope():
    permissions = _liveblocks_permissions("comment", approved=False)

    assert permissions == ["room:read", "room:presence:write", "comments:write"]
    assert_at_most_one_scope_per_feature(permissions)


async def test_collaboration_auth_marks_approved_document_as_read_only(
    client: AsyncClient,
    db: AsyncSession,
    collaboration_section,
    test_project,
    monkeypatch,
):
    document, section = collaboration_section
    document.status = DocumentStatus.APPROVED
    await db.commit()
    captured = {}

    async def fake_authorize_liveblocks_session(**kwargs):
        captured.update(kwargs)
        return 200, '{"token":"test-token"}'

    monkeypatch.setattr(
        "app.routers.documents._authorize_liveblocks_session",
        fake_authorize_liveblocks_session,
    )

    response = await client.post(
        f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}/collaboration/auth"
    )

    assert response.status_code == 200
    assert captured["approved"] is True


async def test_collaboration_auth_surfaces_liveblocks_error_body(
    client: AsyncClient,
    collaboration_section,
    test_project,
    monkeypatch,
    caplog,
):
    document, section = collaboration_section

    async def fake_authorize_liveblocks_session(**_kwargs):
        return 422, '{"error":"bad Liveblocks payload"}'

    monkeypatch.setattr(
        "app.routers.documents._authorize_liveblocks_session",
        fake_authorize_liveblocks_session,
    )

    with caplog.at_level("ERROR", logger="app.routers.documents"):
        response = await client.post(
            f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}/collaboration/auth"
        )

    assert response.status_code == 422
    assert response.json() == {"error": "bad Liveblocks payload"}
    assert "bad Liveblocks payload" in caplog.text


async def test_collaboration_snapshot_updates_content_and_clears_review_state(
    client: AsyncClient,
    db: AsyncSession,
    collaboration_section,
    test_project,
):
    document, section = collaboration_section

    response = await client.patch(
        f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}/collaboration/snapshot",
        json={"content_md": "Collaborative update"},
    )

    assert response.status_code == 200
    assert response.json()["saved"] is True

    await db.refresh(section)
    assert section.content_md == "Collaborative update"
    assert section.content_lifecycle == SectionContentLifecycle.EMPTY
    assert section.status == SectionStatus.PENDING
    assert section.reviewed_at is None

    versions = (
        await db.execute(
            select(SectionVersion).where(SectionVersion.section_id == section.id)
        )
    ).scalars().all()
    assert len(versions) == 1
    assert versions[0].content_md == "Collaborative update"
    assert versions[0].author_type == AuthorType.USER
    assert versions[0].summary == "Collaborative snapshot"


async def test_document_section_autosave_creates_version_snapshot(
    client: AsyncClient,
    db: AsyncSession,
    collaboration_section,
    test_project,
):
    document, section = collaboration_section

    response = await client.patch(
        f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}/autosave",
        json={"content_md": "Autosaved update"},
    )

    assert response.status_code == 200
    assert response.json()["saved"] is True

    version = (
        await db.execute(
            select(SectionVersion).where(SectionVersion.section_id == section.id)
        )
    ).scalar_one()
    assert version.content_md == "Autosaved update"
    assert version.author_type == AuthorType.USER
    assert version.summary == "Autosaved content"


async def test_document_section_update_creates_version_snapshot(
    client: AsyncClient,
    db: AsyncSession,
    collaboration_section,
    test_project,
):
    document, section = collaboration_section

    response = await client.patch(
        f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}",
        json={"content_md": "Manual update"},
    )

    assert response.status_code == 200

    version = (
        await db.execute(
            select(SectionVersion).where(SectionVersion.section_id == section.id)
        )
    ).scalar_one()
    assert version.content_md == "Manual update"
    assert version.author_type == AuthorType.USER
    assert version.summary == "Content updated"


async def test_approved_document_rejects_collaboration_snapshot(
    client: AsyncClient,
    db: AsyncSession,
    collaboration_section,
    test_project,
):
    document, section = collaboration_section
    document.status = DocumentStatus.APPROVED
    await db.commit()

    response = await client.patch(
        f"/projects/{test_project.id}/documents/{document.id}/sections/{section.id}/collaboration/snapshot",
        json={"content_md": "Blocked update"},
    )

    assert response.status_code == 403
