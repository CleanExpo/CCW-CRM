"""Pytest configuration and fixtures."""

import asyncio
import os
import sys
from typing import AsyncGenerator

# CRITICAL: Set environment variables BEFORE any imports
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["SKIP_AUTH_ENFORCEMENT"] = "true"  # Bypass auth middleware for tests

# Windows asyncpg compatibility: ensure selector event loop in tests.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.main import app
from src.config.database import AsyncSessionLocal, get_async_db

# Import test data fixtures
pytest_plugins = ["tests.fixtures.data", "tests.fixtures.pos_data", "tests.fixtures.shopify_fixtures"]


@pytest.fixture
def anyio_backend() -> str:
    """Use asyncio backend for async tests."""
    return "asyncio"


@pytest.fixture(scope="session")
def event_loop() -> asyncio.AbstractEventLoop:
    """Create a single event loop for async tests to avoid cross-loop DB errors."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


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
    # Get token from response body (also available in cookies)
    data = response.json()
    token = data.get("access_token")
    assert token is not None, "No access_token in response"
    return token


@pytest_asyncio.fixture(scope="function")
async def auth_headers(auth_token: str) -> dict:
    """Get Authorization headers with Bearer token for testing."""
    return {"Authorization": f"Bearer {auth_token}"}
