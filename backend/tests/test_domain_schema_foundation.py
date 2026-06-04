import os
import subprocess
import uuid
from pathlib import Path

import psycopg2
import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://pagemark:pagemark_dev@localhost:5433/pagemark",
    )


@pytest.fixture()
def migrated_database_url():
    base_url = make_url(_database_url())
    test_db_name = f"pagemark_schema_{uuid.uuid4().hex[:12]}"
    admin_url = base_url.set(drivername="postgresql", database="postgres")
    test_async_url = base_url.set(database=test_db_name).render_as_string(hide_password=False)

    try:
        admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable for schema smoke tests: {exc}")

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
        yield base_url.set(
            drivername="postgresql+psycopg2",
            database=test_db_name,
        ).render_as_string(hide_password=False)
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


def test_model_imports_do_not_create_circular_dependency_errors():
    import app.models as models

    expected = [
        "Project",
        "Document",
        "Analysis",
        "OutlineProposal",
        "TemplateRecommendation",
        "GenerationRun",
        "GenerationSectionTask",
        "EvidenceReference",
        "ActivityEvent",
        "WorkspacePreference",
    ]
    for name in expected:
        assert hasattr(models, name)


def test_migrations_apply_and_documents_share_project_analysis(migrated_database_url):
    import app.models as models

    engine = create_engine(migrated_database_url)
    with Session(engine) as session:
        user = models.User(
            email="owner@example.com",
            password_hash="not-used",
            name="Owner",
            is_verified=True,
        )
        session.add(user)
        session.flush()

        org = models.Organization(
            name="Owner Workspace",
            slug=f"owner-{uuid.uuid4().hex[:8]}",
            created_by=user.id,
            personal=True,
        )
        session.add(org)
        session.flush()

        project = models.Project(
            org_id=org.id,
            created_by=user.id,
            name="Pagemark",
            source_type=models.SourceType.GIT,
            source_provider="github",
            source_owner="acme",
            source_repository="pagemark",
            selected_branch="main",
            default_branch="main",
            last_synced_commit="abc123",
        )
        session.add(project)
        session.flush()

        analysis = models.Analysis(
            project_id=project.id,
            status=models.AnalysisStatus.COMPLETED,
            source_type="git",
            source_commit="abc123",
            is_current=True,
            effective_exclusions_json=[{"pattern": "node_modules/**"}],
        )
        session.add(analysis)
        session.flush()

        first_doc = models.Document(
            project_id=project.id,
            title="Contributor Guide",
            purpose="Help contributors get started",
        )
        second_doc = models.Document(
            project_id=project.id,
            title="API Reference",
            purpose="Explain public API endpoints",
        )
        session.add_all([first_doc, second_doc])
        session.flush()

        first_proposal = models.OutlineProposal(
            document_id=first_doc.id,
            analysis_id=analysis.id,
            basis=models.OutlineProposalBasis.ANALYSIS_ADAPTED,
            outline_json=[{"heading": "Setup"}],
        )
        second_proposal = models.OutlineProposal(
            document_id=second_doc.id,
            analysis_id=analysis.id,
            basis=models.OutlineProposalBasis.ANALYSIS_ADAPTED,
            outline_json=[{"heading": "Endpoints"}],
        )
        session.add_all([first_proposal, second_proposal])
        session.commit()

        stored_project = session.get(models.Project, project.id)
        assert len(stored_project.documents) == 2
        assert {doc.title for doc in stored_project.documents} == {
            "Contributor Guide",
            "API Reference",
        }
        assert first_proposal.analysis_id == analysis.id
        assert second_proposal.analysis_id == analysis.id
        assert first_proposal.analysis.project_id == project.id
        assert second_proposal.analysis.project_id == project.id


def test_project_analysis_snapshots_are_immutable_and_single_current(migrated_database_url):
    import app.models as models
    from app.services.analysis_service import mark_analysis_current_sync

    engine = create_engine(migrated_database_url)
    with Session(engine) as session:
        user = models.User(
            email=f"owner-{uuid.uuid4().hex}@example.com",
            password_hash="not-used",
            name="Owner",
            is_verified=True,
        )
        session.add(user)
        session.flush()

        org = models.Organization(
            name="Owner Workspace",
            slug=f"owner-{uuid.uuid4().hex[:8]}",
            created_by=user.id,
            personal=True,
        )
        session.add(org)
        session.flush()

        project = models.Project(
            org_id=org.id,
            created_by=user.id,
            name="Pagemark",
            source_type=models.SourceType.GIT,
            source_provider="github",
            source_owner="acme",
            source_repository="pagemark",
            selected_branch="main",
        )
        session.add(project)
        session.flush()

        first_exclusions = [{"pattern": "node_modules/**", "reason": "dependencies"}]
        second_exclusions = [
            {"pattern": "node_modules/**", "reason": "dependencies"},
            {"pattern": "dist/**", "reason": "generated"},
        ]
        first = models.Analysis(
            project_id=project.id,
            status=models.AnalysisStatus.COMPLETED,
            source_type="git",
            source_commit="abc123",
            is_current=True,
            effective_exclusions_json=first_exclusions,
        )
        second = models.Analysis(
            project_id=project.id,
            status=models.AnalysisStatus.COMPLETED,
            source_type="git",
            source_commit="def456",
            is_current=False,
            effective_exclusions_json=second_exclusions,
        )
        session.add_all([first, second])
        session.commit()

        mark_analysis_current_sync(session, second)
        session.commit()
        session.refresh(first)
        session.refresh(second)

        snapshots = (
            session.query(models.Analysis)
            .filter(models.Analysis.project_id == project.id)
            .order_by(models.Analysis.created_at.asc(), models.Analysis.id.asc())
            .all()
        )
        assert len(snapshots) == 2
        assert sum(1 for snapshot in snapshots if snapshot.is_current) == 1
        assert first.is_current is False
        assert second.is_current is True
        assert first.effective_exclusions_json == first_exclusions
        assert second.effective_exclusions_json == second_exclusions
