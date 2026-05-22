import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

# Ensure `backend/` is on sys.path so `import app` works when Alembic is invoked
# from the backend directory (e.g. `alembic upgrade head`).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.ext.asyncio import AsyncEngine
from alembic import context

# Import our Base and engine
from app.database import Base, engine
from app.models.user import User, UserRole, UserSettings
from app.models.template import Template
from app.models.project import Project
from app.models.document import Document, Section
from app.models.analysis import Analysis
from app.models.oauth_token import OAuthToken
from app.models.version import SectionVersion

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata must point to your SQLAlchemy Base metadata
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Configure Alembic and run migrations on the synchronous connection handle.

    Alembic's internal migration runner is always synchronous. This function
    receives a sync connection proxy from connection.run_sync() and must NOT
    be awaited.
    """
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode using the async engine.

    We use engine.begin() (which yields an AsyncConnection) and then call
    connection.run_sync(do_run_migrations) to execute the synchronous
    Alembic runner inside the async context. Do NOT await do_run_migrations
    directly — it is a plain synchronous function.
    """
    async with engine.begin() as connection:
        await connection.run_sync(do_run_migrations)


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
