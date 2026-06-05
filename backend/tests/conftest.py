"""
Pytest configuration and shared fixtures for all tests.
"""
import os
import uuid
from pathlib import Path

import pytest
import psycopg2
import subprocess
from httpx import AsyncClient, ASGITransport
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberStatus
from app.models.project import Project


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://pagemark:pagemark_dev@localhost:5433/pagemark",
    )


@pytest.fixture
def anyio_backend():
    """Configure anyio to use asyncio backend."""
    return "asyncio"


@pytest.fixture
def test_database_url():
    """Create a temporary test database and run migrations."""
    base_url = make_url(_database_url())
    test_db_name = f"pagemark_test_{uuid.uuid4().hex[:12]}"
    admin_url = base_url.set(drivername="postgresql", database="postgres")
    test_async_url = base_url.set(database=test_db_name).render_as_string(hide_password=False)
    
    try:
        admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    except psycopg2.OperationalError as exc:
        pytest.skip(f"PostgreSQL is not reachable: {exc}")
    
    admin_conn.autocommit = True
    with admin_conn.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE "{test_db_name}"')
    admin_conn.close()
    
    # Run migrations
    env = os.environ.copy()
    env["DATABASE_URL"] = test_async_url
    result = subprocess.run(
        ["venv/bin/alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
    )
    
    if result.returncode != 0:
        pytest.fail(f"Migration failed: {result.stderr.decode()}")
    
    yield test_async_url
    
    # Cleanup
    admin_conn = psycopg2.connect(admin_url.render_as_string(hide_password=False))
    admin_conn.autocommit = True
    with admin_conn.cursor() as cursor:
        cursor.execute(f'DROP DATABASE IF EXISTS "{test_db_name}"')
    admin_conn.close()


@pytest.fixture
async def db_engine(test_database_url):
    """Create async database engine."""
    engine = create_async_engine(test_database_url, echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(db_engine) -> AsyncSession:
    """Create async database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with async_session() as session:
        yield session


@pytest.fixture
async def test_user(db: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password="hashed_password_here",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_org(db: AsyncSession, test_user: User) -> Organization:
    """Create a test organization with test user as owner."""
    org = Organization(
        name="Test Organization",
        personal=True,
    )
    db.add(org)
    await db.flush()
    
    member = OrganizationMember(
        org_id=org.id,
        user_id=test_user.id,
        role="owner",
        status=OrgMemberStatus.ACTIVE,
    )
    db.add(member)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.fixture
async def test_project(db: AsyncSession, test_user: User, test_org: Organization) -> Project:
    """Create a test project."""
    project = Project(
        org_id=test_org.id,
        created_by=test_user.id,
        name="Test Project",
        description="A test project",
        source_type="scratch",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@pytest.fixture
async def other_project(db: AsyncSession, test_user: User, test_org: Organization) -> Project:
    """Create another test project."""
    project = Project(
        org_id=test_org.id,
        created_by=test_user.id,
        name="Other Project",
        description="Another test project",
        source_type="scratch",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@pytest.fixture
async def other_user(db: AsyncSession) -> User:
    """Create another test user (not in test_org)."""
    user = User(
        email="other@example.com",
        username="otheruser",
        hashed_password="hashed_password_here",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def client(test_database_url, test_user: User) -> AsyncClient:
    """Create async HTTP client for API testing."""
    from app.main import app
    from app.database import get_db
    from app.dependencies import get_current_user
    
    # Create engine for the app
    engine = create_async_engine(test_database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async def override_get_db():
        async with async_session() as session:
            yield session
    
    async def override_get_current_user():
        return test_user
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
    
    await engine.dispose()
    app.dependency_overrides.clear()


@pytest.fixture
async def other_user_client(test_database_url, other_user: User) -> AsyncClient:
    """Create async HTTP client authenticated as other_user."""
    from app.main import app
    from app.database import get_db
    from app.dependencies import get_current_user
    
    engine = create_async_engine(test_database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async def override_get_db():
        async with async_session() as session:
            yield session
    
    async def override_get_current_user():
        return other_user
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
    
    await engine.dispose()
    app.dependency_overrides.clear()
