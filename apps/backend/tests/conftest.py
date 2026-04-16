"""Pytest configuration and fixtures."""

import asyncio
import os
import sys
from typing import AsyncGenerator

# CRITICAL: Set environment variables BEFORE any imports
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["SKIP_AUTH_ENFORCEMENT"] = "true"  # Bypass auth middleware for tests
os.environ["PORTAL_DEMO_MODE"] = "true"  # Return fixture data in portal tests (UNI-1869)

# Windows asyncpg compatibility: ensure selector event loop in tests.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.api.main import app
from src.config.database import AsyncSessionLocal, get_async_db
from src.db.models import User

# Import test data fixtures
pytest_plugins = ["tests.fixtures.data", "tests.fixtures.pos_data", "tests.fixtures.shopify_fixtures", "tests.fixtures.xero_fixtures"]


def _make_fake_test_user() -> User:
    """Construct an in-memory User instance that satisfies the auth dependency.

    Tests inside this suite run with auth bypassed via the client fixture's
    dependency override — the fake user is never persisted to the DB. It
    exists only so that endpoints which type-hint `current_user: User` get
    a valid object.
    """
    from datetime import UTC, datetime
    from uuid import uuid4

    user = User()
    user.id = uuid4()
    user.email = "test-auth-bypass@demo.com"
    user.hashed_password = "not-a-real-hash"
    user.full_name = "Test Auth Bypass User"
    user.is_active = True
    user.is_admin = True
    user.created_at = datetime.now(UTC)
    user.updated_at = datetime.now(UTC)
    return user


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

    # Override the auth dependency so route-level Depends(get_current_user)
    # is bypassed in the same way that the AuthMiddleware is bypassed via
    # SKIP_AUTH_ENFORCEMENT. Without this override, every test that hits an
    # authenticated route (i.e. almost all of them post-UNI-1770) would 401.
    async def override_get_current_user() -> User:
        return _make_fake_test_user()

    app.dependency_overrides[get_async_db] = override_get_async_db
    app.dependency_overrides[get_current_user] = override_get_current_user

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
