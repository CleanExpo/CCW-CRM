"""
Pytest configuration for integration tests.

Provides fixtures and utilities for API integration testing.
"""

import os
import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add src to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

# Test database configuration — default to local Docker PostgreSQL (port 5433)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://starter_user:local_dev_password@localhost:5433/starter_db",
)

# SQLite mode only when explicitly requested (JSONB/PostgreSQL types require real PG)
USE_IN_MEMORY_DB = os.getenv("USE_IN_MEMORY_DB", "false").lower() == "true"

if USE_IN_MEMORY_DB:
    TEST_DATABASE_URL = "sqlite:///:memory:"


# Create test engine
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in TEST_DATABASE_URL else {},
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment variables."""
    os.environ["ENVIRONMENT"] = "testing"
    os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-not-for-production"
    os.environ["SKIP_AUTH_ENFORCEMENT"] = "false"
    os.environ["RATE_LIMIT_ENABLED"] = "false"  # Disable rate limiting in tests
    os.environ["CACHE_ENABLED"] = "false"  # Disable Redis in tests
    yield
    # Cleanup after all tests


@pytest.fixture(scope="function")
def db_session():
    """
    Create a fresh database session for each test.

    This fixture:
    - Creates all tables before the test
    - Provides a database session
    - Rolls back changes after the test
    - Drops all tables
    """
    from src.db.models_base import Base

    # Create all tables
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
        session.rollback()  # Rollback any uncommitted changes
    finally:
        session.close()
        # Drop all tables; use CASCADE for PostgreSQL views/FK dependencies
        if "postgresql" in str(engine.url):
            from sqlalchemy import text
            with engine.connect() as conn:
                conn.execute(text("DROP SCHEMA public CASCADE"))
                conn.execute(text("CREATE SCHEMA public"))
                conn.commit()
        else:
            Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def test_app():
    """Provide the FastAPI app instance for testing."""
    from src.api.main import app

    return app


@pytest.fixture(scope="function")
def client(test_app, db_session):
    """
    Create a test client with database dependency override.

    This ensures all API calls use the test database session.
    """
    from fastapi.testclient import TestClient

    from src.config.database import get_async_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    test_app.dependency_overrides[get_async_db] = override_get_db

    with TestClient(test_app) as test_client:
        yield test_client

    test_app.dependency_overrides.clear()


# Helper utilities


def create_test_user(db_session, email: str = None, role: str = "owner", organization=None):
    """Helper to create a test user."""
    from src.auth.password import hash_password
    from src.db.models_base import Organization, User

    if organization is None:
        organization = Organization(
            id=uuid.uuid4(),
            name=f"Test Org {uuid.uuid4().hex[:8]}",
            slug=f"test-org-{uuid.uuid4().hex[:8]}",
            is_active=True,
        )
        db_session.add(organization)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email=email or f"test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("TestPassword123!"),
        full_name="Test User",
        organization_id=organization.id,
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return user, organization


def get_auth_headers(client, email: str, password: str = "TestPassword123!"):
    """Helper to get authentication headers for a user."""
    response = client.post("/api/auth/login", json={"email": email, "password": password})

    if response.status_code != 200:
        raise Exception(f"Login failed: {response.json()}")

    token = response.cookies.get("auth_token")
    if not token:
        raise Exception("No auth token in response")

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def create_user(db_session):
    """Fixture that returns the create_test_user helper."""
    return lambda **kwargs: create_test_user(db_session, **kwargs)


@pytest.fixture
def get_headers(client):
    """Fixture that returns the get_auth_headers helper."""
    return lambda email, password="TestPassword123!": get_auth_headers(client, email, password)
