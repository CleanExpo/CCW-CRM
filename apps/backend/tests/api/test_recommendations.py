"""
Tests for product recommendation endpoints.

Uses mocked RecommendationAgent — no database queries or model inference in CI.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

PRODUCT_A = str(uuid4())
PRODUCT_B = str(uuid4())
CUSTOMER_ID = str(uuid4())

SIMILAR_SUCCESS = {
    "success": True,
    "recommendation_type": "similar",
    "recommendations": [
        {"id": PRODUCT_B, "name": "Similar Drill", "score": 0.91},
        {"id": str(uuid4()), "name": "Power Bit Set", "score": 0.85},
    ],
    "total": 2,
}

FBT_SUCCESS = {
    "success": True,
    "recommendation_type": "frequently_bought_together",
    "recommendations": [
        {"id": str(uuid4()), "name": "Safety Goggles", "score": 0.78},
    ],
    "total": 1,
}

PERSONALIZED_SUCCESS = {
    "success": True,
    "recommendation_type": "personalized",
    "recommendations": [
        {"id": str(uuid4()), "name": "Power Sander", "score": 0.88},
        {"id": str(uuid4()), "name": "Work Gloves", "score": 0.76},
    ],
    "total": 2,
}

AGENT_ERROR = {"error": "Product not found"}


# ---------------------------------------------------------------------------
# GET /api/recommendations/similar/{product_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_similar_products(client: AsyncClient, auth_headers: dict):
    """Similar products endpoint returns list of recommendations."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_similar_products",
        new_callable=AsyncMock,
        return_value=SIMILAR_SUCCESS,
    ):
        response = await client.get(
            f"/api/recommendations/similar/{PRODUCT_A}",
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["recommendation_type"] == "similar"
    assert isinstance(data["recommendations"], list)
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_similar_products_agent_error(client: AsyncClient, auth_headers: dict):
    """When agent returns error, response has success=False with empty list."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_similar_products",
        new_callable=AsyncMock,
        return_value=AGENT_ERROR,
    ):
        response = await client.get(
            f"/api/recommendations/similar/{PRODUCT_A}",
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["recommendations"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_similar_products_requires_auth(client: AsyncClient):
    """Similar products endpoint requires authentication."""
    response = await client.get(f"/api/recommendations/similar/{PRODUCT_A}")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_similar_products_invalid_uuid(client: AsyncClient, auth_headers: dict):
    """Invalid product UUID returns 422."""
    response = await client.get(
        "/api/recommendations/similar/not-a-uuid",
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/recommendations/frequently-bought-together/{product_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_frequently_bought_together(client: AsyncClient, auth_headers: dict):
    """Frequently bought together endpoint returns co-occurrence recommendations."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_frequently_bought_together",
        new_callable=AsyncMock,
        return_value=FBT_SUCCESS,
    ):
        response = await client.get(
            f"/api/recommendations/frequently-bought-together/{PRODUCT_A}",
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["recommendation_type"] == "frequently_bought_together"
    assert data["total"] == 1


# ---------------------------------------------------------------------------
# GET /api/recommendations/personalized/{customer_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_personalized_recommendations(client: AsyncClient, auth_headers: dict):
    """Personalized recommendations endpoint returns customer-specific results."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_personalized_recommendations",
        new_callable=AsyncMock,
        return_value=PERSONALIZED_SUCCESS,
    ):
        response = await client.get(
            f"/api/recommendations/personalized/{CUSTOMER_ID}",
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["recommendation_type"] == "personalized"
    assert len(data["recommendations"]) == 2


# ---------------------------------------------------------------------------
# POST /api/recommendations/track-interaction
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_track_interaction(client: AsyncClient, auth_headers: dict):
    """Track interaction records customer-product event."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.track_interaction",
        new_callable=AsyncMock,
        return_value={"success": True, "message": "Interaction recorded"},
    ):
        response = await client.post(
            "/api/recommendations/track-interaction",
            json={
                "customer_id": CUSTOMER_ID,
                "product_id": PRODUCT_A,
                "interaction_type": "view",
                "source": "web",
            },
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_track_interaction_invalid_type(client: AsyncClient, auth_headers: dict):
    """Track interaction requires valid UUID fields."""
    response = await client.post(
        "/api/recommendations/track-interaction",
        json={
            "customer_id": "not-a-uuid",
            "product_id": PRODUCT_A,
            "interaction_type": "view",
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/recommendations/update-co-occurrences
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_co_occurrences(client: AsyncClient, auth_headers: dict):
    """Update co-occurrences from a completed order."""
    order_id = str(uuid4())
    with patch(
        "src.api.routes.recommendations.recommendation_agent.update_co_occurrences",
        new_callable=AsyncMock,
        return_value={"success": True, "message": "Co-occurrences updated"},
    ):
        response = await client.post(
            "/api/recommendations/update-co-occurrences",
            json={"order_id": order_id},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
