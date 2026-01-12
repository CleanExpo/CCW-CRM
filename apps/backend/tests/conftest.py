"""Pytest configuration and fixtures."""

import os

# CRITICAL: Set environment variables BEFORE any imports
os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
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


@pytest.fixture
async def db_session() -> AsyncSession:
    """
    Create an async database session with transaction rollback for test isolation.

    Each test runs in a transaction that is rolled back after the test completes,
    ensuring tests don't interfere with each other.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Begin a nested transaction
            nested = await session.begin_nested()

            yield session

            # Rollback the nested transaction after test
            await nested.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    """
    Create an async test client with database session override.

    This fixture overrides the get_async_db dependency to use the test session.
    """
    # Override the database dependency to use test session
    async def override_get_async_db():
        yield db_session

    app.dependency_overrides[get_async_db] = override_get_async_db

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        # Clean up only our specific dependency override
        if get_async_db in app.dependency_overrides:
            del app.dependency_overrides[get_async_db]


@pytest.fixture
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
