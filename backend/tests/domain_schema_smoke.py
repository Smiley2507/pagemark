"""Standalone Phase 1 schema smoke checks.

This intentionally avoids pytest so the checks can run in the current backend
virtualenv, where pytest is not installed.
"""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


def database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://pagemark:pagemark_dev@localhost:5433/pagemark",
    )


def drop_database(admin_url, database_name: str) -> None:
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


def main() -> int:
    base_url = make_url(database_url())
    test_db_name = f"pagemark_schema_{uuid.uuid4().hex[:12]}"
    admin_url = base_url.set(drivername="postgresql", database="postgres")
    test_async_url = base_url.set(database=test_db_name).render_as_string(hide_password=False)
    test_sync_url = base_url.set(
        drivername="postgresql+psycopg2",
        database=test_db_name,
    ).render_as_string(hide_password=False)

    print("checking model imports")
    import app.models as models

    for name in (
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
    ):
        assert hasattr(models, name), name
    print("model imports passed")

    try:
        admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    except psycopg2.OperationalError as exc:
        print(f"PostgreSQL unavailable: {exc}", file=sys.stderr)
        return 2

    admin_conn.autocommit = True
    with admin_conn.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{test_db_name}"')
    admin_conn.close()

    try:
        print("running alembic upgrade head on empty database")
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
            print(result.stdout)
            print(result.stderr, file=sys.stderr)
            return result.returncode
        print("migrations passed")

        print("checking Project with two Documents sharing one Analysis")
        engine = create_engine(test_sync_url)
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
            assert first_proposal.analysis_id == analysis.id
            assert second_proposal.analysis_id == analysis.id
            assert first_proposal.analysis.project_id == project.id
            assert second_proposal.analysis.project_id == project.id
        print("multi-document shared-analysis smoke passed")
    finally:
        drop_database(admin_url, test_db_name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
