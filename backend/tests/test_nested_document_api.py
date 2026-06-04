import os
import subprocess
import uuid
from pathlib import Path

import httpx
import psycopg2
import pytest
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.future import select


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://pagemark:pagemark_dev@localhost:5433/pagemark",
    )


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture()
def migrated_async_database_url():
    base_url = make_url(_database_url())
    test_db_name = f"pagemark_api_{uuid.uuid4().hex[:12]}"
    admin_url = base_url.set(drivername="postgresql", database="postgres")
    test_async_url = base_url.set(database=test_db_name).render_as_string(hide_password=False)

    try:
        admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable for API tests: {exc}")

    admin_conn.autocommit = True
    with admin_conn.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{test_db_name}"')
    admin_conn.close()

    env = os.environ.copy()
    env["DATABASE_URL"] = test_async_url
    result = subprocess.run(
        ["venv/bin/alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        _drop_database(admin_url, test_db_name)
        pytest.fail(
            "Alembic upgrade head failed on an empty database.\n"
            f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )

    try:
        yield test_async_url
    finally:
        _drop_database(admin_url, test_db_name)


def _drop_database(admin_url, database_name: str) -> None:
    admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    admin_conn.autocommit = True
    with admin_conn.cursor() as cursor:
        cursor.execute(
            "SELECT pg_terminate_backend(pid) "
            "FROM pg_stat_activity "
            "WHERE datname = %s AND pid <> pg_backend_pid()",
            (database_name,),
        )
        cursor.execute(f'DROP DATABASE IF EXISTS "{database_name}"')
    admin_conn.close()


@pytest.mark.anyio
async def test_project_and_nested_document_api_behaviour(migrated_async_database_url):
    from app.database import get_db
    from app.dependencies import get_current_user
    from app.main import app
    from app.models.document import Document
    from app.models.organization import (
        OrgMemberRole,
        OrgMemberStatus,
        Organization,
        OrganizationMember,
    )
    from app.models.user import User

    engine = create_async_engine(migrated_async_database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        owner = User(
            email=f"owner-{uuid.uuid4().hex}@example.com",
            password_hash="not-used",
            name="Owner",
            is_verified=True,
        )
        outsider = User(
            email=f"outsider-{uuid.uuid4().hex}@example.com",
            password_hash="not-used",
            name="Outsider",
            is_verified=True,
        )
        session.add_all([owner, outsider])
        await session.flush()

        owner_org = Organization(
            name="Owner Workspace",
            slug=f"owner-{uuid.uuid4().hex[:8]}",
            created_by=owner.id,
            personal=True,
        )
        outsider_org = Organization(
            name="Outsider Workspace",
            slug=f"outsider-{uuid.uuid4().hex[:8]}",
            created_by=outsider.id,
            personal=True,
        )
        session.add_all([owner_org, outsider_org])
        await session.flush()
        session.add_all(
            [
                OrganizationMember(
                    org_id=owner_org.id,
                    user_id=owner.id,
                    role=OrgMemberRole.ADMIN,
                    status=OrgMemberStatus.ACTIVE,
                ),
                OrganizationMember(
                    org_id=outsider_org.id,
                    user_id=outsider.id,
                    role=OrgMemberRole.ADMIN,
                    status=OrgMemberStatus.ACTIVE,
                ),
            ]
        )
        await session.commit()

    current_user_id = owner.id

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        async with session_factory() as session:
            return await session.get(User, current_user_id)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        project_response = await client.post(
            "/projects",
            json={
                "name": "Pagemark",
                "description": "Container only",
                "source_type": "scratch",
            },
        )
        assert project_response.status_code == 201
        project = project_response.json()
        assert project["documents_count"] == 0
        assert project["sections_count"] == 0

        async with session_factory() as session:
            docs = (
                await session.execute(
                    select(Document).where(Document.project_id == project["id"])
                )
            ).scalars().all()
            assert docs == []

        first_response = await client.post(
            f"/projects/{project['id']}/documents",
            json={
                "title": "Contributor Guide",
                "purpose": "Help contributors onboard",
                "tags": ["contributors"],
            },
        )
        second_response = await client.post(
            f"/projects/{project['id']}/documents",
            json={
                "title": "API Reference",
                "purpose": "Document API endpoints",
                "tags": ["api"],
            },
        )
        assert first_response.status_code == 201
        assert second_response.status_code == 201
        first_doc = first_response.json()
        second_doc = second_response.json()
        assert first_doc["project_id"] == project["id"]
        assert second_doc["project_id"] == project["id"]
        assert first_doc["status"] == "empty"
        assert second_doc["setup_stage"] == "purpose"

        list_response = await client.get(f"/projects/{project['id']}/documents")
        assert list_response.status_code == 200
        listed = list_response.json()
        assert listed["total"] == 2
        assert {doc["title"] for doc in listed["documents"]} == {
            "Contributor Guide",
            "API Reference",
        }

        section_response = await client.post(
            f"/projects/{project['id']}/documents/{first_doc['id']}/sections",
            json={"title": "Setup"},
        )
        assert section_response.status_code == 201
        sections_response = await client.get(
            f"/projects/{project['id']}/documents/{first_doc['id']}/sections"
        )
        assert sections_response.status_code == 200
        assert sections_response.json()["sections"][0]["heading"] == "Setup"

        legacy_response = await client.get(f"/projects/{project['id']}/document")
        assert legacy_response.status_code == 404

        current_user_id = outsider.id
        blocked_response = await client.get(
            f"/projects/{project['id']}/documents/{first_doc['id']}/sections"
        )
        assert blocked_response.status_code == 404

    app.dependency_overrides.clear()
    await engine.dispose()
