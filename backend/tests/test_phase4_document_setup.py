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
    test_db_name = f"pagemark_phase4_{uuid.uuid4().hex[:12]}"
    admin_url = base_url.set(drivername="postgresql", database="postgres")
    test_async_url = base_url.set(database=test_db_name).render_as_string(hide_password=False)

    try:
        admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable for Phase 4 tests: {exc}")

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


async def _seed_workspace(session_factory):
    from app.models.analysis import Analysis, AnalysisStatus
    from app.models.document import Document, DocumentSetupStage
    from app.models.organization import (
        OrgMemberRole,
        OrgMemberStatus,
        Organization,
        OrganizationMember,
    )
    from app.models.project import Project, SourceType
    from app.models.template import Template
    from app.models.user import User

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
            is_current=True,
            file_tree_json={"total_files": 42},
            languages_json={"python": {"files": 12}, "typescript": {"files": 8}},
            endpoints_json=[
                {"method": "GET", "path": "/projects"},
                {"method": "POST", "path": "/projects"},
            ],
            complexity_json={"summary": "moderate"},
            analysis_data={"partial_failure": False},
        )
        session.add(analysis)

        api_template = Template(
            name="API Reference",
            description="API docs",
            category="Technical",
            purpose="Document API endpoints",
            intended_audience="Developers",
            expected_outcome="Developers can call the API",
            compatible_repository_traits={"requires_endpoints": True, "languages": ["python"]},
            estimated_generation_scope={"sections": 2, "relative_usage": "low"},
            outline_preview=[
                {"heading": "Overview", "description": "API overview"},
                {"heading": "Endpoints", "description": "Endpoint reference"},
            ],
            sections_json=[
                {"heading": "Overview", "description": "API overview"},
                {"heading": "Endpoints", "description": "Endpoint reference"},
            ],
            guidance="Stay endpoint-focused.",
            system_prompt="Outline APIs from source facts.",
            is_builtin=True,
        )
        architecture_template = Template(
            name="Architecture Doc",
            description="Architecture docs",
            category="Technical",
            purpose="Explain system architecture",
            intended_audience="Maintainers",
            expected_outcome="Maintainers understand structure",
            compatible_repository_traits={"min_files": 8, "languages": ["python"]},
            estimated_generation_scope={"sections": 2, "relative_usage": "low"},
            outline_preview=[
                {"heading": "System Overview"},
                {"heading": "Data Flow"},
            ],
            sections_json=[
                {"heading": "System Overview"},
                {"heading": "Data Flow"},
            ],
            guidance="Tie components to source paths.",
            system_prompt="Outline architecture from repository facts.",
            is_builtin=True,
        )
        session.add_all([api_template, architecture_template])
        await session.flush()

        document = Document(
            project_id=project.id,
            title="API Guide",
            purpose="Document the API for integrators",
            audience="Developers",
            setup_stage=DocumentSetupStage.PURPOSE,
        )
        session.add(document)
        await session.commit()

    return owner.id, project.id, document.id, api_template.id


@pytest.mark.anyio
async def test_template_recommendations_and_setup_resume(migrated_async_database_url):
    from app.database import get_db
    from app.dependencies import get_current_user
    from app.main import app
    from app.models.user import User

    engine = create_async_engine(migrated_async_database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    owner_id, project_id, document_id, api_template_id = await _seed_workspace(session_factory)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        async with session_factory() as session:
            return await session.get(User, owner_id)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            rule_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/template-recommendations",
                json={"basis": "rule_based"},
            )
            assert rule_response.status_code == 200
            recommendations = rule_response.json()["recommendations"]
            assert recommendations[0]["basis"] == "rule_based"
            assert recommendations[0]["template_id"] == api_template_id
            assert recommendations[0]["provider_usage_ref"] is None
            assert recommendations[0]["supporting_facts"]["endpoint_count"] == 2

            ai_without_provider = await client.post(
                f"/projects/{project_id}/documents/{document_id}/template-recommendations",
                json={"basis": "ai_personalized"},
            )
            assert ai_without_provider.status_code == 400

            setup_at_template = await client.get(
                f"/projects/{project_id}/documents/{document_id}/setup"
            )
            assert setup_at_template.status_code == 200
            assert setup_at_template.json()["document"]["setup_stage"] == "template_selection"
            assert setup_at_template.json()["recommendations"][0]["basis"] == "rule_based"

            proposal_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/outline-proposals",
                json={"template_id": api_template_id, "basis": "template"},
            )
            assert proposal_response.status_code == 201
            proposal = proposal_response.json()
            assert proposal["status"] == "draft"
            assert proposal["outline"][0]["heading"] == "Overview"

            clarification_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/outline-proposals/{proposal['id']}/clarification-requests",
                json={
                    "question": "Which auth scheme should be documented?",
                    "affected_sections": ["Authentication", "Endpoints"],
                    "confidence_tradeoff": "Skipping keeps endpoint coverage but lowers auth confidence.",
                },
            )
            assert clarification_response.status_code == 201
            clarification = clarification_response.json()
            assert clarification["affected_sections"] == ["Authentication", "Endpoints"]

            skip_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/clarification-requests/{clarification['id']}/skip"
            )
            assert skip_response.status_code == 200
            assert skip_response.json()["status"] == "skipped"
            assert "lowers auth confidence" in skip_response.json()["confidence_tradeoff"]

            setup_at_outline = await client.get(
                f"/projects/{project_id}/documents/{document_id}/setup"
            )
            assert setup_at_outline.status_code == 200
            assert setup_at_outline.json()["document"]["setup_stage"] == "outline_review"
            assert setup_at_outline.json()["outline_proposals"][0]["status"] == "draft"
            assert setup_at_outline.json()["clarification_requests"][0]["status"] == "skipped"
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.anyio
async def test_ai_provider_gate_custom_outline_and_outline_approval(migrated_async_database_url):
    from app.database import get_db
    from app.dependencies import get_current_user
    from app.main import app
    from app.models.ai_credential import UserAiCredential
    from app.models.document import Section
    from app.models.outline_proposal import OutlineProposal
    from app.models.user import User
    from app.services import crypto_service

    engine = create_async_engine(migrated_async_database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    owner_id, project_id, document_id, _api_template_id = await _seed_workspace(session_factory)

    async with session_factory() as session:
        session.add(
            UserAiCredential(
                user_id=owner_id,
                provider="anthropic",
                api_key_encrypted=crypto_service.encrypt_token("test-key"),
                model_id="claude-sonnet-4-20250514",
                is_active=True,
                key_hint="-key",
            )
        )
        await session.commit()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        async with session_factory() as session:
            return await session.get(User, owner_id)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            ai_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/template-recommendations",
                json={"basis": "ai_personalized"},
            )
            assert ai_response.status_code == 200
            ai_recommendations = [
                item
                for item in ai_response.json()["recommendations"]
                if item["basis"] == "ai_personalized"
            ]
            assert ai_recommendations
            assert ai_recommendations[0]["provider_usage_ref"]["provider"] == "anthropic"

            custom_outline = [
                {"heading": "Operating Model", "description": "How the service runs"},
                {"heading": "Support Playbook", "description": "How maintainers respond"},
            ]
            custom_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/outline-proposals",
                json={
                    "basis": "custom_outline",
                    "outline": custom_outline,
                    "explanation": {"reason": "Built-in Templates do not fit support operations."},
                },
            )
            assert custom_response.status_code == 201
            proposal = custom_response.json()
            assert proposal["basis"] == "custom_outline"

            approve_response = await client.post(
                f"/projects/{project_id}/documents/{document_id}/outline-proposals/{proposal['id']}/approve"
            )
            assert approve_response.status_code == 200
            approved = approve_response.json()
            assert approved["status"] == "approved"
            assert approved["outline"] == custom_outline

            edit_approved = await client.patch(
                f"/projects/{project_id}/documents/{document_id}/outline-proposals/{proposal['id']}",
                json={"outline": [{"heading": "Changed"}]},
            )
            assert edit_approved.status_code == 409

            setup_at_generation = await client.get(
                f"/projects/{project_id}/documents/{document_id}/setup"
            )
            assert setup_at_generation.status_code == 200
            setup = setup_at_generation.json()
            assert setup["document"]["setup_stage"] == "generation_mode"
            assert [section["heading"] for section in setup["sections"]] == [
                "Operating Model",
                "Support Playbook",
            ]

        async with session_factory() as session:
            sections = (
                await session.execute(
                    select(Section)
                    .where(Section.document_id == document_id)
                    .order_by(Section.order_index.asc())
                )
            ).scalars().all()
            assert [section.heading for section in sections] == [
                "Operating Model",
                "Support Playbook",
            ]
            stored_proposal = await session.get(OutlineProposal, proposal["id"])
            assert stored_proposal.outline_json == custom_outline
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
