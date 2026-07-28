"""
End-to-end role/capability enforcement tests.

Fixture: one organization, one user per OrgMemberRole (5), one non-member user,
and one project created by the Developer with one document and one section.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project, SourceType
from app.models.document import Document, Section
from app.models.document_share import DocumentShare, DocumentSharePermission


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def role_org(db: AsyncSession):
    """One org, one active user per role, one non-member, one project/document/section
    created by the Developer."""
    users = {}
    for role in OrgMemberRole:
        user = User(
            email=f"{role.value}@roletest.com",
            name=f"{role.value.title()} User",
            password_hash="hashed",
            is_verified=True,
        )
        db.add(user)
        users[role] = user
    non_member = User(email="outsider@roletest.com", name="Outsider", password_hash="hashed", is_verified=True)
    db.add(non_member)
    await db.flush()

    org = Organization(name="Role Test Org", slug="role-test-org", created_by=users[OrgMemberRole.ADMIN].id, personal=False)
    db.add(org)
    await db.flush()

    for role, user in users.items():
        db.add(OrganizationMember(org_id=org.id, user_id=user.id, role=role, status=OrgMemberStatus.ACTIVE))
    await db.flush()

    project = Project(
        org_id=org.id,
        created_by=users[OrgMemberRole.DEVELOPER].id,
        name="Role Test Project",
        source_type=SourceType.SCRATCH,
    )
    db.add(project)
    await db.flush()

    document = Document(project_id=project.id, title="Role Test Document")
    db.add(document)
    await db.flush()

    section = Section(document_id=document.id, heading="Section 1", content_md="Original")
    db.add(section)
    await db.commit()
    await db.refresh(project)
    await db.refresh(document)
    await db.refresh(section)

    return {
        "org": org,
        "users": users,
        "non_member": non_member,
        "project": project,
        "document": document,
        "section": section,
    }


@pytest.fixture
def client_as(db_engine):
    """Factory: build an AsyncClient authenticated as the given user."""
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    def _make(user: User) -> AsyncClient:
        async def override_get_db():
            async with async_session() as session:
                yield session

        async def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    yield _make
    app.dependency_overrides.clear()


class TestNonMember:
    async def test_non_member_gets_404_on_read(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["non_member"]) as client:
            resp = await client.get(f"/projects/{project.id}")
            assert resp.status_code == 404

    async def test_non_member_gets_404_on_write(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["non_member"]) as client:
            resp = await client.patch(f"/projects/{project.id}", json={"name": "Hacked"})
            assert resp.status_code == 404


class TestViewer:
    async def test_viewer_can_read(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["users"][OrgMemberRole.VIEWER]) as client:
            resp = await client.get(f"/projects/{project.id}")
            assert resp.status_code == 200

    async def test_viewer_forbidden_on_project_manage(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["users"][OrgMemberRole.VIEWER]) as client:
            resp = await client.patch(f"/projects/{project.id}", json={"name": "Hacked"})
            assert resp.status_code == 403

    async def test_viewer_forbidden_on_content_write(self, client_as, role_org):
        project, document, section = role_org["project"], role_org["document"], role_org["section"]
        async with client_as(role_org["users"][OrgMemberRole.VIEWER]) as client:
            resp = await client.patch(
                f"/projects/{project.id}/documents/{document.id}/sections/{section.id}",
                json={"content_md": "Hacked"},
            )
            assert resp.status_code == 403

    async def test_viewer_forbidden_on_document_manage(self, client_as, role_org):
        project, document = role_org["project"], role_org["document"]
        async with client_as(role_org["users"][OrgMemberRole.VIEWER]) as client:
            resp = await client.post(
                f"/projects/{project.id}/documents/{document.id}/sections",
                json={"title": "New Section"},
            )
            assert resp.status_code == 403

    async def test_viewer_forbidden_on_content_comment(self, client_as, role_org):
        project, document = role_org["project"], role_org["document"]
        async with client_as(role_org["users"][OrgMemberRole.VIEWER]) as client:
            resp = await client.post(
                f"/projects/{project.id}/documents/{document.id}/notes",
                json={"content": "A note"},
            )
            assert resp.status_code == 403

    async def test_viewer_forbidden_on_content_review(self, client_as, role_org):
        section = role_org["section"]
        async with client_as(role_org["users"][OrgMemberRole.VIEWER]) as client:
            resp = await client.post(f"/sections/{section.id}/accept-review")
            assert resp.status_code == 403

    async def test_viewer_with_edit_share_can_write_that_document_only(self, db: AsyncSession, client_as, role_org):
        project, document, section = role_org["project"], role_org["document"], role_org["section"]
        viewer = role_org["users"][OrgMemberRole.VIEWER]

        other_document = Document(project_id=project.id, title="Other Document")
        db.add(other_document)
        await db.flush()
        other_section = Section(document_id=other_document.id, heading="Other Section", content_md="x")
        db.add(other_section)
        db.add(DocumentShare(
            document_id=document.id,
            user_id=viewer.id,
            permission=DocumentSharePermission.EDIT,
            created_by=role_org["users"][OrgMemberRole.ADMIN].id,
        ))
        await db.commit()
        await db.refresh(other_document)
        await db.refresh(other_section)

        async with client_as(viewer) as client:
            resp = await client.patch(
                f"/projects/{project.id}/documents/{document.id}/sections/{section.id}",
                json={"content_md": "Viewer edit via share"},
            )
            assert resp.status_code == 200, resp.text

            resp = await client.patch(
                f"/projects/{project.id}/documents/{other_document.id}/sections/{other_section.id}",
                json={"content_md": "Should not be allowed"},
            )
            assert resp.status_code == 403


class TestTechnicalWriter:
    async def test_forbidden_on_project_manage(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["users"][OrgMemberRole.TECHNICAL_WRITER]) as client:
            resp = await client.patch(f"/projects/{project.id}", json={"name": "Hacked"})
            assert resp.status_code == 403

    async def test_allowed_on_content_write(self, client_as, role_org):
        project, document, section = role_org["project"], role_org["document"], role_org["section"]
        async with client_as(role_org["users"][OrgMemberRole.TECHNICAL_WRITER]) as client:
            resp = await client.patch(
                f"/projects/{project.id}/documents/{document.id}/sections/{section.id}",
                json={"content_md": "TW content"},
            )
            assert resp.status_code == 200

    async def test_allowed_on_document_manage(self, client_as, role_org):
        project, document = role_org["project"], role_org["document"]
        async with client_as(role_org["users"][OrgMemberRole.TECHNICAL_WRITER]) as client:
            resp = await client.post(
                f"/projects/{project.id}/documents/{document.id}/sections",
                json={"title": "TW Section"},
            )
            assert resp.status_code == 201

    async def test_allowed_on_content_comment(self, client_as, role_org):
        project, document = role_org["project"], role_org["document"]
        async with client_as(role_org["users"][OrgMemberRole.TECHNICAL_WRITER]) as client:
            resp = await client.post(
                f"/projects/{project.id}/documents/{document.id}/notes",
                json={"content": "TW note"},
            )
            assert resp.status_code == 201

    async def test_allowed_on_content_review(self, client_as, role_org):
        section = role_org["section"]
        async with client_as(role_org["users"][OrgMemberRole.TECHNICAL_WRITER]) as client:
            resp = await client.post(f"/sections/{section.id}/accept-review")
            assert resp.status_code == 200


class TestDeveloper:
    async def test_allowed_on_project_manage(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["users"][OrgMemberRole.DEVELOPER]) as client:
            resp = await client.patch(f"/projects/{project.id}", json={"name": "Dev Renamed"})
            assert resp.status_code == 200

    async def test_forbidden_on_org_audit(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["users"][OrgMemberRole.DEVELOPER]) as client:
            resp = await client.get(f"/projects/{project.id}/activity")
            assert resp.status_code == 403


class TestProjectManager:
    async def test_allowed_on_org_audit(self, client_as, role_org):
        project = role_org["project"]
        async with client_as(role_org["users"][OrgMemberRole.PROJECT_MANAGER]) as client:
            resp = await client.get(f"/projects/{project.id}/activity")
            assert resp.status_code == 200

    async def test_forbidden_on_org_manage(self, client_as, role_org):
        # organizations.py predates the capability layer and, by design (left
        # untouched per the plan), uses 404 rather than 403 for insufficient
        # role — it never distinguishes "not a member" from "wrong role".
        org = role_org["org"]
        async with client_as(role_org["users"][OrgMemberRole.PROJECT_MANAGER]) as client:
            resp = await client.patch(f"/organizations/{org.id}", json={"name": "PM Renamed"})
            assert resp.status_code == 404


class TestAdmin:
    async def test_allowed_on_org_manage(self, client_as, role_org):
        org = role_org["org"]
        async with client_as(role_org["users"][OrgMemberRole.ADMIN]) as client:
            resp = await client.patch(f"/organizations/{org.id}", json={"name": "Admin Renamed"})
            assert resp.status_code == 200


class TestProjectCreatorOverride:
    async def test_creator_keeps_project_manage_despite_lowered_role(self, db: AsyncSession, client_as, role_org):
        """A project's creator retains project.manage on THEIR OWN project even
        if their org role alone would not grant it."""
        viewer = role_org["users"][OrgMemberRole.VIEWER]
        own_project = Project(
            org_id=role_org["org"].id,
            created_by=viewer.id,
            name="Viewer-created project",
            source_type=SourceType.SCRATCH,
        )
        db.add(own_project)
        await db.commit()
        await db.refresh(own_project)

        async with client_as(viewer) as client:
            resp = await client.patch(f"/projects/{own_project.id}", json={"name": "Still mine"})
            assert resp.status_code == 200, resp.text

            # But the creator override doesn't extend to a project they didn't create
            resp = await client.patch(f"/projects/{role_org['project'].id}", json={"name": "Not mine"})
            assert resp.status_code == 403
