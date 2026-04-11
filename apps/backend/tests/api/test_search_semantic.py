"""
Tests for semantic and hybrid search endpoints.

Uses a local no_db_client fixture (mocked DB session) so these tests
run without a live Postgres connection. SearchAgent is also mocked —
no OpenAI API calls in CI.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.api.deps import get_async_db, get_current_user
from src.api.main import app
from tests.conftest import _make_fake_test_user


# ---------------------------------------------------------------------------
# Local fixture — no live DB required
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def sc():
    """Test client with mocked DB session and auth — no Postgres needed."""
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    async def _db():
        yield mock_session

    async def _user():
        return _make_fake_test_user()

    app.dependency_overrides[get_async_db] = _db
    app.dependency_overrides[get_current_user] = _user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fixture data
# ---------------------------------------------------------------------------

PRODUCTS = [
    {"id": str(uuid4()), "name": "Concrete Drill Bit", "sku": "DRILL-001", "score": 0.95},
    {"id": str(uuid4()), "name": "Safety Helmet", "sku": "SAFE-001", "score": 0.87},
]

SEARCH_SUCCESS = {
    "success": True,
    "query": "drill for concrete",
    "search_type": "hybrid",
    "language": "en",
    "results": {"products": PRODUCTS, "total": 2},
}

SEARCH_EMPTY = {
    "success": True,
    "query": "zzz_no_match",
    "search_type": "hybrid",
    "language": "en",
    "results": {"products": [], "total": 0},
}

SEARCH_ERROR = {"error": "Embedding service unavailable"}


# ---------------------------------------------------------------------------
# POST /api/search/
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_returns_results(sc: AsyncClient):
    """Hybrid search returns a structured response with results."""
    with patch(
        "src.api.routes.search.search_agent.execute",
        new_callable=AsyncMock,
        return_value=SEARCH_SUCCESS,
    ):
        response = await sc.post(
            "/api/search/",
            json={"query": "drill for concrete", "search_type": "hybrid"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["search_type"] == "hybrid"
    assert "results" in data


@pytest.mark.asyncio
async def test_search_empty_results(sc: AsyncClient):
    """Search with no matches returns success=True with empty list."""
    with patch(
        "src.api.routes.search.search_agent.execute",
        new_callable=AsyncMock,
        return_value=SEARCH_EMPTY,
    ):
        response = await sc.post("/api/search/", json={"query": "zzz_no_match"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["results"]["products"] == []


@pytest.mark.asyncio
async def test_search_agent_error_returns_success_false(sc: AsyncClient):
    """When SearchAgent returns an error key, response has success=False."""
    with patch(
        "src.api.routes.search.search_agent.execute",
        new_callable=AsyncMock,
        return_value=SEARCH_ERROR,
    ):
        response = await sc.post("/api/search/", json={"query": "drill"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "error" in data["results"]


@pytest.mark.asyncio
async def test_search_rejects_empty_query(sc: AsyncClient):
    """Empty query string is rejected with 422."""
    response = await sc.post("/api/search/", json={"query": ""})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/search/semantic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_semantic_search_get(sc: AsyncClient):
    """GET semantic search endpoint returns results."""
    with patch(
        "src.api.routes.search.search_agent.semantic_search",
        new_callable=AsyncMock,
        return_value=SEARCH_SUCCESS,
    ):
        response = await sc.get(
            "/api/search/semantic",
            params={"query": "drill for concrete"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


# ---------------------------------------------------------------------------
# GET /api/search/hybrid
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hybrid_search_get(sc: AsyncClient):
    """GET hybrid search accepts vector/keyword weights."""
    with patch(
        "src.api.routes.search.search_agent.hybrid_search",
        new_callable=AsyncMock,
        return_value=SEARCH_SUCCESS,
    ):
        response = await sc.get(
            "/api/search/hybrid",
            params={"query": "safety gear", "vector_weight": 0.6, "keyword_weight": 0.4},
        )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/search/analytics
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_analytics(sc: AsyncClient):
    """Analytics endpoint returns analytics dict."""
    with patch(
        "src.api.routes.search.search_agent.get_search_analytics",
        new_callable=AsyncMock,
        return_value={"success": True, "analytics": {"total_searches": 42}},
    ):
        response = await sc.get("/api/search/analytics")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "analytics" in data
