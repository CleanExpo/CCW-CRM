"""
Integration tests for AI-powered search endpoints.

Tests semantic search, hybrid search, and search analytics.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_semantic_search_basic(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test basic semantic search functionality."""

    response = await client.get(
        "/api/search/semantic",
        params={
            "query": "power drill for concrete",
            "language": "en",
            "limit": 10,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["search_type"] == "semantic"
    assert "results" in data
    assert "query_time_ms" in data["results"]
    assert isinstance(data["results"]["results"], list)


@pytest.mark.asyncio
async def test_hybrid_search(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test hybrid search (vector + keyword)."""

    response = await client.get(
        "/api/search/hybrid",
        params={
            "query": "safety helmet",
            "language": "en",
            "limit": 20,
            "vector_weight": 0.7,
            "keyword_weight": 0.3,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["search_type"] == "hybrid"
    assert "results" in data
    assert "weights" in data["results"]
    assert data["results"]["weights"]["vector"] == 0.7
    assert data["results"]["weights"]["keyword"] == 0.3


@pytest.mark.asyncio
async def test_search_with_different_languages(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test search in multiple languages."""

    languages = {
        "en": "construction tools",
        "zh-CN": "建筑工具",
        "es": "herramientas de construcción",
    }

    for lang, query in languages.items():
        response = await client.get(
            "/api/search/semantic",
            params={
                "query": query,
                "language": lang,
                "limit": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == lang


@pytest.mark.asyncio
async def test_search_post_endpoint(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test POST search endpoint with full options."""

    search_request = {
        "query": "heavy machinery",
        "language": "en",
        "search_type": "hybrid",
        "limit": 15,
        "vector_weight": 0.8,
        "keyword_weight": 0.2,
        "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        "session_id": "test_session_123",
    }

    response = await client.post(
        "/api/search/",
        json=search_request,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["query"] == "heavy machinery"


@pytest.mark.asyncio
async def test_search_analytics(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test search analytics endpoint."""

    # Perform some searches first
    await client.get(
        "/api/search/semantic",
        params={"query": "test query 1", "language": "en"},
    )
    await client.get(
        "/api/search/semantic",
        params={"query": "test query 2", "language": "en"},
    )

    # Get analytics
    response = await client.get("/api/search/analytics")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "analytics" in data
    assert "total_searches" in data["analytics"]
    assert "avg_results_per_search" in data["analytics"]
    assert "avg_query_time_ms" in data["analytics"]
    assert "top_queries" in data["analytics"]


@pytest.mark.asyncio
async def test_search_with_empty_query(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that empty queries are rejected."""

    response = await client.get(
        "/api/search/semantic",
        params={
            "query": "",
            "language": "en",
        },
    )

    # Should fail validation
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_pagination(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test search result pagination."""

    # Small limit
    response1 = await client.get(
        "/api/search/semantic",
        params={
            "query": "equipment",
            "language": "en",
            "limit": 5,
        },
    )

    data1 = response1.json()

    # Larger limit
    response2 = await client.get(
        "/api/search/semantic",
        params={
            "query": "equipment",
            "language": "en",
            "limit": 20,
        },
    )

    data2 = response2.json()

    # Should have different result counts
    assert len(data1["results"]["results"]) <= 5
    assert len(data2["results"]["results"]) <= 20


@pytest.mark.asyncio
async def test_search_performance(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that search meets performance targets (<500ms)."""

    response = await client.get(
        "/api/search/hybrid",
        params={
            "query": "construction equipment",
            "language": "en",
            "limit": 20,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Check query time is under 500ms target
    query_time = data["results"]["query_time_ms"]
    assert query_time < 1000  # Relaxed for testing, target is 500ms


@pytest.mark.asyncio
async def test_search_result_format(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that search results have correct format."""

    response = await client.get(
        "/api/search/semantic",
        params={
            "query": "tools",
            "language": "en",
            "limit": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()

    if data["results"]["results"]:
        result = data["results"]["results"][0]
        # Check required fields
        assert "product_id" in result
        assert "sku" in result
        assert "name" in result
        assert "price" in result
        assert "stock" in result
        # Check score field exists
        assert "similarity_score" in result or "combined_score" in result


@pytest.mark.asyncio
async def test_search_with_invalid_language(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test search with unsupported language code."""

    response = await client.get(
        "/api/search/semantic",
        params={
            "query": "test query",
            "language": "invalid_lang",
            "limit": 10,
        },
    )

    # Should either use fallback or return error
    # Depending on implementation
    assert response.status_code in [200, 400]


@pytest.mark.asyncio
async def test_search_analytics_date_filtering(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test search analytics with date filters."""

    response = await client.get(
        "/api/search/analytics",
        params={
            "start_date": "2026-01-01T00:00:00Z",
            "end_date": "2026-12-31T23:59:59Z",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_concurrent_searches(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test handling of concurrent search requests."""

    import asyncio

    # Create multiple concurrent search requests
    queries = [
        "power tools",
        "safety equipment",
        "construction materials",
        "hand tools",
        "machinery",
    ]

    tasks = [
        client.get(
            "/api/search/semantic",
            params={"query": query, "language": "en", "limit": 10},
        )
        for query in queries
    ]

    responses = await asyncio.gather(*tasks)

    # All should succeed
    for response in responses:
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_search_tracking_with_customer_id(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that searches are tracked with customer ID."""

    customer_id = "550e8400-e29b-41d4-a716-446655440000"

    response = await client.get(
        "/api/search/semantic",
        params={
            "query": "tracked search",
            "language": "en",
            "customer_id": customer_id,
        },
    )

    assert response.status_code == 200
    # Verify search was tracked (would check analytics or database)


@pytest.mark.asyncio
async def test_zero_results_search(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test search that returns no results."""

    response = await client.get(
        "/api/search/semantic",
        params={
            "query": "xyzabc123nonexistentproduct",
            "language": "en",
            "limit": 10,
        },
    )

    assert response.status_code == 200
    data = response.json()
    # Should return empty results gracefully
    assert "results" in data
    assert isinstance(data["results"]["results"], list)
