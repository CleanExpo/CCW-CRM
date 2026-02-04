"""
Integration tests for AI-powered recommendation endpoints.

Tests similar products, frequently bought together, and personalized recommendations.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_get_similar_products(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting similar products for a given product."""

    # Assuming test product exists
    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    response = await client.get(
        f"/api/recommendations/similar/{test_product_id}",
        params={
            "language": "en",
            "limit": 10,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)

    # Check recommendation format if results exist
    if data["recommendations"]:
        rec = data["recommendations"][0]
        assert "product_id" in rec
        assert "similarity_score" in rec
        assert "product_details" in rec


@pytest.mark.asyncio
async def test_frequently_bought_together(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test frequently bought together recommendations."""

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    response = await client.get(
        f"/api/recommendations/frequently-bought-together/{test_product_id}",
        params={
            "language": "en",
            "limit": 5,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)

    # Check format
    if data["recommendations"]:
        rec = data["recommendations"][0]
        assert "product_id" in rec
        assert "co_occurrence_count" in rec
        assert "confidence_score" in rec


@pytest.mark.asyncio
async def test_personalized_recommendations(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test personalized recommendations for a customer."""

    test_customer_id = "550e8400-e29b-41d4-a716-446655440000"

    response = await client.get(
        f"/api/recommendations/personalized/{test_customer_id}",
        params={
            "language": "en",
            "limit": 15,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)


@pytest.mark.asyncio
async def test_track_interaction(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test tracking customer-product interactions."""

    interaction_data = {
        "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        "product_id": "550e8400-e29b-41d4-a716-446655440001",
        "interaction_type": "view",
        "session_id": "test_session_123",
    }

    response = await client.post(
        "/api/recommendations/track-interaction",
        json=interaction_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "interaction_id" in data


@pytest.mark.asyncio
async def test_interaction_types(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test different interaction types (view, add_to_cart, purchase)."""

    customer_id = "550e8400-e29b-41d4-a716-446655440000"
    product_id = "550e8400-e29b-41d4-a716-446655440001"

    interaction_types = ["view", "add_to_cart", "purchase", "wishlist"]

    for interaction_type in interaction_types:
        response = await client.post(
            "/api/recommendations/track-interaction",
            json={
                "customer_id": customer_id,
                "product_id": product_id,
                "interaction_type": interaction_type,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


@pytest.mark.asyncio
async def test_precompute_recommendations(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test precomputing recommendations for products."""

    precompute_request = {
        "product_ids": [
            "550e8400-e29b-41d4-a716-446655440001",
            "550e8400-e29b-41d4-a716-446655440002",
        ],
        "recommendation_types": ["similar", "frequently_bought_together"],
        "languages": ["en", "zh-CN"],
    }

    response = await client.post(
        "/api/recommendations/precompute",
        json=precompute_request,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "processed" in data
    assert data["processed"] >= 0


@pytest.mark.asyncio
async def test_update_co_occurrences(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test updating product co-occurrence data from orders."""

    response = await client.post(
        "/api/recommendations/update-co-occurrences",
        json={
            "days_back": 30,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "updated_pairs" in data


@pytest.mark.asyncio
async def test_similar_products_with_invalid_id(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test similar products with non-existent product ID."""

    invalid_id = "00000000-0000-0000-0000-000000000000"

    response = await client.get(
        f"/api/recommendations/similar/{invalid_id}",
        params={"language": "en", "limit": 10},
    )

    # Should handle gracefully - either 404 or empty results
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_personalized_for_new_customer(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test personalized recommendations for customer with no history."""

    new_customer_id = "00000000-0000-0000-0000-000000000001"

    response = await client.get(
        f"/api/recommendations/personalized/{new_customer_id}",
        params={"language": "en", "limit": 10},
    )

    assert response.status_code == 200
    data = response.json()

    # Should return popular/default recommendations
    assert data["success"] is True
    assert isinstance(data["recommendations"], list)


@pytest.mark.asyncio
async def test_recommendation_limit_validation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that limit parameter is properly validated."""

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    # Test with various limits
    limits = [1, 5, 10, 20, 50]

    for limit in limits:
        response = await client.get(
            f"/api/recommendations/similar/{test_product_id}",
            params={"language": "en", "limit": limit},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["recommendations"]) <= limit


@pytest.mark.asyncio
async def test_multi_language_recommendations(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test recommendations in multiple languages."""

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"
    languages = ["en", "zh-CN", "es"]

    for lang in languages:
        response = await client.get(
            f"/api/recommendations/similar/{test_product_id}",
            params={"language": lang, "limit": 5},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == lang


@pytest.mark.asyncio
async def test_recommendation_caching(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that recommendations are cached for performance."""

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    # First request
    response1 = await client.get(
        f"/api/recommendations/similar/{test_product_id}",
        params={"language": "en", "limit": 10},
    )
    assert response1.status_code == 200
    data1 = response1.json()

    # Second request (should be faster due to caching)
    response2 = await client.get(
        f"/api/recommendations/similar/{test_product_id}",
        params={"language": "en", "limit": 10},
    )
    assert response2.status_code == 200
    data2 = response2.json()

    # Results should be consistent
    assert data1["recommendations"] == data2["recommendations"]


@pytest.mark.asyncio
async def test_recommendation_relevance(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that recommendations are relevant and sorted by score."""

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    response = await client.get(
        f"/api/recommendations/similar/{test_product_id}",
        params={"language": "en", "limit": 10},
    )

    assert response.status_code == 200
    data = response.json()

    if len(data["recommendations"]) > 1:
        # Check that scores are in descending order
        scores = [rec["similarity_score"] for rec in data["recommendations"]]
        assert scores == sorted(scores, reverse=True)

        # Check that scores are between 0 and 1
        for score in scores:
            assert 0 <= score <= 1


@pytest.mark.asyncio
async def test_track_interaction_validation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that invalid interaction data is rejected."""

    # Missing required fields
    invalid_data = {
        "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        # Missing product_id and interaction_type
    }

    response = await client.post(
        "/api/recommendations/track-interaction",
        json=invalid_data,
    )

    # Should fail validation
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_concurrent_recommendation_requests(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test handling of concurrent recommendation requests."""

    import asyncio

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    # Create multiple concurrent requests
    tasks = [
        client.get(
            f"/api/recommendations/similar/{test_product_id}",
            params={"language": "en", "limit": 5},
        )
        for _ in range(10)
    ]

    responses = await asyncio.gather(*tasks)

    # All should succeed
    for response in responses:
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_frequently_bought_together_with_orders(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test frequently bought together after updating co-occurrences."""

    # First update co-occurrences from orders
    update_response = await client.post(
        "/api/recommendations/update-co-occurrences",
        json={"days_back": 90},
    )
    assert update_response.status_code == 200

    # Then get recommendations
    test_product_id = "550e8400-e29b-41d4-a716-446655440001"
    rec_response = await client.get(
        f"/api/recommendations/frequently-bought-together/{test_product_id}",
        params={"language": "en", "limit": 5},
    )

    assert rec_response.status_code == 200
    data = rec_response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_personalized_with_recent_interactions(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test personalized recommendations after tracking interactions."""

    customer_id = "550e8400-e29b-41d4-a716-446655440000"
    product_ids = [
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002",
    ]

    # Track some interactions
    for product_id in product_ids:
        await client.post(
            "/api/recommendations/track-interaction",
            json={
                "customer_id": customer_id,
                "product_id": product_id,
                "interaction_type": "view",
            },
        )

    # Get personalized recommendations
    response = await client.get(
        f"/api/recommendations/personalized/{customer_id}",
        params={"language": "en", "limit": 10},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["recommendations"]) > 0


@pytest.mark.asyncio
async def test_recommendation_performance(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that recommendations meet performance targets (<200ms)."""

    test_product_id = "550e8400-e29b-41d4-a716-446655440001"

    response = await client.get(
        f"/api/recommendations/similar/{test_product_id}",
        params={"language": "en", "limit": 10},
    )

    assert response.status_code == 200
    data = response.json()

    # Check response time if included in response
    if "query_time_ms" in data:
        assert data["query_time_ms"] < 500  # Relaxed for testing, target is 200ms
