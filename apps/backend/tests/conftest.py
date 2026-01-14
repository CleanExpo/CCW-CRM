"""Pytest configuration and fixtures."""

import os
from typing import AsyncGenerator

# CRITICAL: Set environment variables BEFORE any imports
os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.main import app
from src.config.database import AsyncSessionLocal, get_async_db

# Import test data fixtures
pytest_plugins = ["tests.fixtures.data"]


@pytest.fixture
def anyio_backend() -> str:
    """Use asyncio backend for async tests."""
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create an async database session for testing.

    Note: For MVP, tests share the same database without rollback.
    This is acceptable since we have seed data and tests should work
    with existing data.
    """
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async test client with database session override.

    This fixture overrides the get_async_db dependency to use the test session.
    """
    # Override the database dependency to use test session
    async def override_get_async_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_async_db] = override_get_async_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        # Clean up dependency override
        app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def auth_token(client: AsyncClient) -> str:
    """Get authentication token for testing."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"},
    )
    assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
    token = response.cookies.get("auth_token")
    assert token is not None, "No auth_token cookie received"
    return token
