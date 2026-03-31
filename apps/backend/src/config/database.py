"""
Database configuration and session management.

Provides SQLAlchemy connection setup for local PostgreSQL.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from .settings import get_settings


def get_database_url(async_mode: bool = False) -> str:
    """
    Get database URL from settings.

    Args:
        async_mode: If True, returns async database URL (postgresql+asyncpg)
                   If False, returns sync database URL (postgresql+psycopg2)

    Returns:
        Database connection URL
    """
    settings = get_settings()

    # Default to local PostgreSQL if not configured (port 5434 matches docker-compose.yml)
    db_url = settings.database_url or "postgresql://starter_user:local_dev_password@localhost:5434/starter_db"

    # Convert to async URL if needed
    if async_mode and not db_url.startswith("postgresql+asyncpg"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif not async_mode and not db_url.startswith("postgresql+psycopg2"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    return db_url


# Synchronous engine (for migrations and CLI tools)
# Created lazily to avoid startup failures when DB is temporarily unreachable
_sync_engine = None
_sync_session_local = None


def _get_sync_engine():
    """Lazy-init sync engine — avoids crashes when DB is unreachable at import time."""
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(
            get_database_url(async_mode=False),
            echo=get_settings().debug,
            pool_pre_ping=True,
            pool_size=5,  # Smaller pool for sync (rarely used in prod)
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=3600,
        )
    return _sync_engine


def _get_sync_session_local():
    """Lazy-init sync session factory."""
    global _sync_session_local
    if _sync_session_local is None:
        _sync_session_local = sessionmaker(
            bind=_get_sync_engine(),
            autocommit=False,
            autoflush=False,
        )
    return _sync_session_local


# Backward-compatible module-level aliases (lazy — only connect on first use)
# These are accessed via the getter functions in get_sync_db() below


# Asynchronous engine (for FastAPI endpoints)
async_engine = create_async_engine(
    get_database_url(async_mode=True),
    echo=get_settings().debug,
    pool_pre_ping=True,
    pool_size=5,  # Smaller pool for serverless/pooler environments
    max_overflow=10,  # Burst up to 15 total connections
    pool_timeout=30,  # Wait 30s before failing connection request
    pool_recycle=3600,  # Recycle connections after 1 hour
    connect_args={
        "statement_cache_size": 0,  # Required for pgbouncer/Supabase pooler
        "prepared_statement_cache_size": 0,  # Disable prepared statement cache
    },
)

# Asynchronous session factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_sync_db() -> Session:
    """
    Get synchronous database session.

    Yields:
        Database session

    Usage:
        ```python
        with get_sync_db() as db:
            user = db.query(User).first()
        ```
    """
    session_factory = _get_sync_session_local()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get asynchronous database session (FastAPI dependency).

    Automatically rolls back the session on unhandled exceptions so that
    a failed ``await db.commit()`` in any route never leaves the connection
    in a dirty state.

    Yields:
        Async database session

    Usage:
        ```python
        @router.get("/users")
        async def get_users(db: AsyncSession = Depends(get_async_db)):
            result = await db.execute(select(User))
            return result.scalars().all()
        ```
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get async database session as context manager.

    Usage:
        ```python
        async with get_db_session() as db:
            result = await db.execute(select(User))
            users = result.scalars().all()
        ```
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


