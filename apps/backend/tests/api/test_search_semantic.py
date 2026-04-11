"""
Tests for semantic and hybrid search endpoints.

Uses mocked SearchAgent — no OpenAI API calls or model loading in CI.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

PRODUCT_FIXTURE = [
    {"id": str(uuid4()), "name": "Concrete Drill Bit", "sku": "DRILL-001", "score": 0.95},
    {"id": str(uuid4()), "name": "Safety Helmet", "sku": "SAFE-001", "score": 0.87},
    {"id": str(uuid4()), "name": "Power Wrench", "sku": "TOOL-003", "score": 0.82},
]

SEARCH_SUCCESS = {
    "success": True,
    "query": "drill for concrete",
    "search_type": "hybrid",
    "language": "en",
    "results": {"products": PRODUCT_FIXTURE, "total": 3},
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
async def test_search_returns_results(client: AsyncClient, auth_headers: dict):
    """Hybrid search returns a structured response with results."""
    with patch(
        "src.api.routes.search.search_agent.execute",
        new_callable=AsyncMock,
        return_value=SEARCH_SUCCESS,
    ):
        response = await client.post(
            "/api/search/",
            json={"query": "drill for concrete", "search_type": "hybrid"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["search_type"] == "hybrid"
    assert "results" in data


@pytest.mark.asyncio
async def test_search_empty_results(client: AsyncClient, auth_headers: dict):
    """Search with no matches returns success=True with empty results."""
    with patch(
        "src.api.routes.search.search_agent.execute",
        new_callable=AsyncMock,
        return_value=SEARCH_EMPTY,
    ):
        response = await client.post(
            "/api/search/",
            json={"query": "zzz_no_match"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["results"]["products"] == []


@pytest.mark.asyncio
async def test_search_agent_error_returns_success_false(client: AsyncClient, auth_headers: dict):
    """When SearchAgent returns an error key, response has success=False."""
    with patch(
        "src.api.routes.search.search_agent.execute",
        new_callable=AsyncMock,
        return_value=SEARCH_ERROR,
    ):
        response = await client.post(
            "/api/search/",
            json={"query": "drill"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "error" in data["results"]


@pytest.mark.asyncio
async def test_search_requires_auth(client: AsyncClient):
    """Search endpoint requires authentication."""
    response = await client.post("/api/search/", json={"query": "drill"})
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_search_rejects_empty_query(client: AsyncClient, auth_headers: dict):
    """Empty query string is rejected with 422."""
    response = await client.post(
        "/api/search/",
        json={"query": ""},
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/search/semantic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_semantic_search_get(client: AsyncClient, auth_headers: dict):
    """GET semantic search endpoint returns results."""
    with patch(
        "src.api.routes.search.search_agent.semantic_search",
        new_callable=AsyncMock,
        return_value=SEARCH_SUCCESS,
    ):
        response = await client.get(
            "/api/search/semantic",
            params={"query": "drill for concrete"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


# ---------------------------------------------------------------------------
# GET /api/search/hybrid
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hybrid_search_get(client: AsyncClient, auth_headers: dict):
    """GET hybrid search endpoint accepts vector/keyword weights."""
    with patch(
        "src.api.routes.search.search_agent.hybrid_search",
        new_callable=AsyncMock,
        return_value=SEARCH_SUCCESS,
    ):
        response = await client.get(
            "/api/search/hybrid",
            params={"query": "safety gear", "vector_weight": 0.6, "keyword_weight": 0.4},
            headers=auth_headers,
        )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/search/analytics
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_analytics(client: AsyncClient, auth_headers: dict):
    """Analytics endpoint returns analytics dict."""
    with patch(
        "src.api.routes.search.search_agent.get_search_analytics",
        new_callable=AsyncMock,
        return_value={"success": True, "analytics": {"total_searches": 42, "zero_result_rate": 0.05}},
    ):
        response = await client.get("/api/search/analytics", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "analytics" in data
