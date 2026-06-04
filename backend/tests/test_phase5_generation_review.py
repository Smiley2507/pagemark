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
    test_db_name = f"pagemark_phase5_{uuid.uuid4().hex[:12]}"
    admin_url = base_url.set(drivername="postgresql", database="postgres")
    test_async_url = base_url.set(database=test_db_name).render_as_string(hide_password=False)

    try:
        admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable for Phase 5 tests: {exc}")

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


async def _seed_generation_workspace(session_factory):
    from app.models.ai_credential import UserAiCredential
    from app.models.analysis import Analysis, AnalysisStatus
    from app.models.document import Document, DocumentSetupStage, LifecycleStatus, Section
    from app.models.organization import (
        OrgMemberRole,
        OrgMemberStatus,
        Organization,
        OrganizationMember,
    )
    from app.models.project import Project, SourceType
    from app.models.user import User
    from app.services import crypto_service

    async with session_factory() as session:
        owner = User(
            email=f"owner-{uuid.uuid4().hex}@example.com",
            password_hash="not-used",
            name="Owner",
            is_verified=True,
        )
        session.add(owner)
        await session.flush()

        org = Organization(
            name="Owner Workspace",
            slug=f"owner-{uuid.uuid4().hex[:8]}",
            created_by=owner.id,
            personal=True,
        )
        session.add(org)
        await session.flush()
        session.add(
            OrganizationMember(
                org_id=org.id,
                user_id=owner.id,
                role=OrgMemberRole.ADMIN,
                status=OrgMemberStatus.ACTIVE,
            )
        )
        await session.flush()

        project = Project(
            org_id=org.id,
            created_by=owner.id,
            name="Pagemark",
            source_type=SourceType.GIT,
            source_provider="github",
            source_owner="acme",
            source_repository="pagemark",
            selected_branch="main",
        )
        session.add(project)
        await session.flush()

        analysis = Analysis(
            project_id=project.id,
            status=AnalysisStatus.COMPLETED,
            source_type="git",
            source_commit="abc123",
            is_current=True,
            file_tree_json={"total_files": 20},
            languages_json={"python": {"files": 12}},
            endpoints_json=[{"method": "GET", "path": "/projects"}],
            complexity_json={"summary": "moderate"},
        )
        session.add(analysis)
        await session.flush()

        document = Document(
            project_id=project.id,
            title="API Guide",
            purpose="Document the API",
            setup_stage=DocumentSetupStage.GENERATION_MODE,
        )
        session.add(document)
        await session.flush()

        overview = Section(
            document_id=document.id,
            order_index=0,
            heading="Overview",
            title="Overview",
            lifecycle_status=LifecycleStatus.ACTIVE,
            content_md="",
        )
        endpoints = Section(
            document_id=document.id,
            order_index=1,
            heading="Endpoints",
            title="Endpoints",
            lifecycle_status=LifecycleStatus.ACTIVE,
            content_md="",
            workflow_metadata={"depends_on": ["Overview"]},
        )
        appendix = Section(
            document_id=document.id,
            order_index=2,
            heading="Appendix",
            title="Appendix",
            lifecycle_status=LifecycleStatus.ACTIVE,
            content_md="",
        )
        session.add_all([overview, endpoints, appendix])
        session.add(
            UserAiCredential(
                user_id=owner.id,
                provider="anthropic",
                api_key_encrypted=crypto_service.encrypt_token("sk-test"),
                model_id="claude-sonnet-4-20250514",
                key_hint="test",
                is_active=True,
            )
        )
        await session.commit()

    return {
        "owner_id": owner.id,
        "project_id": project.id,
        "document_id": document.id,
        "overview_id": overview.id,
        "endpoints_id": endpoints.id,
        "appendix_id": appendix.id,
        "analysis_id": analysis.id,
    }


async def _client(session_factory, owner_id):
    from app.database import get_db
    from app.dependencies import get_current_user
    from app.main import app
    from app.models.user import User

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        async with session_factory() as session:
            return await session.get(User, owner_id)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    transport = httpx.ASGITransport(app=app)
    return app, httpx.AsyncClient(transport=transport, base_url="http://testserver")


@pytest.mark.anyio
async def test_generation_runs_tasks_usage_and_foundational_pause_are_durable(
    migrated_async_database_url,
    monkeypatch,
):
    from app.models.generation import GenerationRun, GenerationSectionTask
    from app.services import generation_service
    from app.services.generation_service import GeneratedSection

    engine = create_async_engine(migrated_async_database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    ids = await _seed_generation_workspace(session_factory)

    async def fake_generate(db, run, section, *, user_id, provider, model):
        if section.heading == "Overview":
            raise RuntimeError("source facts unavailable")
        return GeneratedSection(
            content_md=f"Generated {section.heading}",
            confidence_score=88,
            prompt_tokens=100,
            completion_tokens=40,
            cost=0.001,
            provider=provider,
            model=model,
        )

    monkeypatch.setattr(generation_service, "_generate_section_content", fake_generate)

    app, client = await _client(session_factory, ids["owner_id"])
    try:
        async with client:
            estimate = await client.post(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/generation-estimate",
                json={"mode": "complete_document"},
            )
            assert estimate.status_code == 200
            assert estimate.json()["relative_usage"] == "low"
            assert len(estimate.json()["section_breakdown"]) == 3

            response = await client.post(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/generation-runs",
                json={"mode": "complete_document", "execute": True},
            )
            assert response.status_code == 201
            run = response.json()
            assert run["status"] == "failed"
            assert run["failover_state"] == "not_required"
            assert run["actual_prompt_tokens"] == 100
            assert run["actual_completion_tokens"] == 40

            tasks = {task["section_id"]: task for task in run["section_tasks"]}
            assert tasks[ids["overview_id"]]["status"] == "failed"
            assert tasks[ids["endpoints_id"]]["status"] == "paused"
            assert tasks[ids["appendix_id"]]["status"] == "ready"
            assert tasks[ids["appendix_id"]]["prompt_tokens"] == 100
            assert tasks[ids["appendix_id"]]["actual_provider"] == "anthropic"

        async with session_factory() as session:
            persisted_run = (await session.execute(select(GenerationRun))).scalar_one()
            persisted_tasks = (
                await session.execute(select(GenerationSectionTask).order_by(GenerationSectionTask.id))
            ).scalars().all()
            assert persisted_run.actual_cost == 0.001
            assert len(persisted_tasks) == 3
            assert [task.status.value for task in persisted_tasks] == ["failed", "paused", "ready"]
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_provider_failover_requires_explicit_confirmation(
    migrated_async_database_url,
    monkeypatch,
):
    from app.services import generation_service
    from app.services.generation_service import GeneratedSection, ProviderGenerationError

    engine = create_async_engine(migrated_async_database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    ids = await _seed_generation_workspace(session_factory)
    calls = {"count": 0}

    async def fake_generate(db, run, section, *, user_id, provider, model):
        calls["count"] += 1
        if calls["count"] == 1:
            raise ProviderGenerationError("quota exhausted", "quota")
        return GeneratedSection(
            content_md=f"Generated after failover {section.heading}",
            confidence_score=90,
            prompt_tokens=90,
            completion_tokens=30,
            cost=0.001,
            provider=provider,
            model=model,
        )

    monkeypatch.setattr(generation_service, "_generate_section_content", fake_generate)

    app, client = await _client(session_factory, ids["owner_id"])
    try:
        async with client:
            response = await client.post(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/generation-runs",
                json={"mode": "section_on_demand", "section_ids": [ids["overview_id"]], "execute": True},
            )
            assert response.status_code == 201
            run = response.json()
            assert run["status"] == "paused"
            assert run["failover_state"] == "needs_confirmation"
            assert run["section_tasks"][0]["status"] == "paused"
            assert run["section_tasks"][0]["prompt_tokens"] is None

            fetched = await client.get(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/generation-runs/{run['id']}"
            )
            assert fetched.json()["failover_state"] == "needs_confirmation"

            confirmed = await client.post(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/generation-runs/{run['id']}/confirm-failover",
                json={"provider": "anthropic", "model": "claude-sonnet-4-20250514"},
            )
            assert confirmed.status_code == 200
            confirmed_run = confirmed.json()
            assert confirmed_run["status"] == "completed"
            assert confirmed_run["failover_state"] == "confirmed"
            assert confirmed_run["section_tasks"][0]["status"] == "ready"
            assert confirmed_run["section_tasks"][0]["prompt_tokens"] == 90
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_reviewed_state_is_explicit_and_not_triggered_by_edits(
    migrated_async_database_url,
    monkeypatch,
):
    from app.models.document import Section, SectionContentLifecycle
    from app.services import generation_service
    from app.services.generation_service import GeneratedSection

    engine = create_async_engine(migrated_async_database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    ids = await _seed_generation_workspace(session_factory)

    async def fake_generate(db, run, section, *, user_id, provider, model):
        return GeneratedSection(
            content_md="Generated draft content",
            confidence_score=91,
            prompt_tokens=80,
            completion_tokens=25,
            cost=0.001,
            provider=provider,
            model=model,
        )

    monkeypatch.setattr(generation_service, "_generate_section_content", fake_generate)

    app, client = await _client(session_factory, ids["owner_id"])
    try:
        async with client:
            generated = await client.post(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/generation-runs",
                json={"mode": "section_on_demand", "section_ids": [ids["overview_id"]], "execute": True},
            )
            assert generated.status_code == 201

            edited = await client.patch(
                f"/projects/{ids['project_id']}/documents/{ids['document_id']}/sections/{ids['overview_id']}",
                json={"content_md": "Manual edit to generated draft"},
            )
            assert edited.status_code == 200
            assert edited.json()["content_lifecycle"] == "generated_draft"
            assert edited.json()["reviewed_at"] is None

            accepted = await client.post(f"/sections/{ids['overview_id']}/accept-review")
            assert accepted.status_code == 200
            accepted_section = accepted.json()
            assert accepted_section["content_lifecycle"] == "reviewed"
            assert accepted_section["reviewed_by"] == ids["owner_id"]
            assert accepted_section["reviewed_against_analysis_id"] == ids["analysis_id"]

        async with session_factory() as session:
            section = await session.get(Section, ids["overview_id"])
            assert section.content_lifecycle == SectionContentLifecycle.REVIEWED
            assert section.workflow_metadata["review"]["analysis_snapshot"]["analysis_id"] == ids["analysis_id"]
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
