"""Pytest configuration and fixtures."""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.main import app
from src.config.database import get_async_db


@pytest.fixture
def anyio_backend() -> str:
    """Use asyncio backend for async tests."""
    return "asyncio"


@pytest.fixture
async def client() -> AsyncClient:
    """Create an async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncSession:
    """Create an async database session for testing."""
    # Use the actual database connection (or configure a test database if needed)
    async_gen = get_async_db()
    session = await async_gen.__anext__()
    try:
        yield session
    finally:
        # Properly close the session
        await session.close()
        try:
            await async_gen.aclose()
        except StopAsyncIteration:
            pass
