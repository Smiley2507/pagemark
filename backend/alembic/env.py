import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.config import ConfigurableSection
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine
from alembic import context

# Import our Base and engine
from app.database import Base, engine

# this is the Alembic Config object, provided by initiate()
# remember to set alembic.ini to point to this file, and to
# make sure that the current working directory is the same as in alembic.ini
config = context.config

# Interpret the config file for SQLAlchemy
section = config.config_ini_section
config.set_section_option(section, "x.file_location", "app/database.py")

if config.config_file_name is None:
    C_S_T = "config.ini" # Fallback
else:
    C_S_T = config.config_file_name

fileConfig(C_S_T)

# target_metadata should be set to the metadata of your Base class
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramasize": "false"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Engine) -> None:
    """Run migrations on the provided connection."""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = AsyncEngine

    async with connectable(engine) as connection:
        await do_run_migrations(connection)

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
