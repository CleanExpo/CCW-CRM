"""Basic health check tests for the API."""

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_health_endpoint():
    """Test that the health endpoint returns 200 OK."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ("healthy", "degraded")


def test_root_endpoint():
    """Test that the root endpoint returns 200 OK."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_security_headers():
    """Test that security headers are present in responses."""
    response = client.get("/health")
    assert response.status_code == 200

    # Check for X-Content-Type-Options header
    assert "x-content-type-options" in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"
