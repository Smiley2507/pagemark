from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from app.config import settings

# Async engine and session for FastAPI
engine = create_async_engine(settings.DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# Sync engine and session for Celery workers
# Convert postgresql+asyncpg:// to postgresql+psycopg2://
sync_database_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
sync_engine = create_engine(sync_database_url, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine, class_=Session)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with async_session() as session:
        yield session
