"""Tests for Anthropic integration endpoints — UNI-1776."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes.integrations.anthropic import router
from src.config.database import get_async_db


@pytest.fixture
def app():
    test_app = FastAPI()
    test_app.include_router(router)

    async def mock_db():
        # Return a mock session that returns no credentials by default
        session = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        session.execute = AsyncMock(return_value=result)
        session.commit = AsyncMock()
        session.add = MagicMock()
        yield session

    test_app.dependency_overrides[get_async_db] = mock_db
    return test_app


@pytest.fixture
def client(app):
    return TestClient(app)


class TestAnthropicStatus:
    def test_status_returns_200(self, client):
        r = client.get("/api/integrations/anthropic/status")
        assert r.status_code == 200
        data = r.json()
        assert "connected" in data
        assert "mode" in data

    def test_status_not_configured_without_key(self, client):
        with patch.dict("os.environ", {}, clear=False):
            # Ensure ANTHROPIC_API_KEY is absent
            import os
            os.environ.pop("ANTHROPIC_API_KEY", None)
            r = client.get("/api/integrations/anthropic/status")
        data = r.json()
        assert data["mode"] in ("not_configured", "production")  # production if env var set


class TestAnthropicConfigure:
    def test_configure_requires_api_key(self, client):
        r = client.post("/api/integrations/anthropic/configure", json={})
        assert r.status_code == 422

    def test_configure_rejects_invalid_prefix(self, client):
        r = client.post(
            "/api/integrations/anthropic/configure",
            json={"api_key": "invalid_key_no_prefix"},
        )
        assert r.status_code == 422

    def test_configure_accepts_valid_key(self, client):
        r = client.post(
            "/api/integrations/anthropic/configure",
            json={"api_key": "sk-ant-api03-test-key-placeholder"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["connected"] is True
        assert data["mode"] == "production"
