"""
Tests for product recommendation endpoints.

Uses a local no_db_client fixture (mocked DB session) so these tests
run without a live Postgres connection. RecommendationAgent is also
mocked — no DB queries or model inference in CI.
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
async def rc():
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

PRODUCT_A = str(uuid4())
CUSTOMER_ID = str(uuid4())

SIMILAR_SUCCESS = {
    "success": True,
    "recommendation_type": "similar",
    "recommendations": [
        {"id": str(uuid4()), "name": "Similar Drill", "score": 0.91},
        {"id": str(uuid4()), "name": "Power Bit Set", "score": 0.85},
    ],
    "total": 2,
}

FBT_SUCCESS = {
    "success": True,
    "recommendation_type": "frequently_bought_together",
    "recommendations": [{"id": str(uuid4()), "name": "Safety Goggles", "score": 0.78}],
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
async def test_similar_products(rc: AsyncClient):
    """Similar products endpoint returns recommendation list."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_similar_products",
        new_callable=AsyncMock,
        return_value=SIMILAR_SUCCESS,
    ):
        response = await rc.get(f"/api/recommendations/similar/{PRODUCT_A}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["recommendation_type"] == "similar"
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_similar_products_agent_error(rc: AsyncClient):
    """When agent returns error, response has success=False with empty list."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_similar_products",
        new_callable=AsyncMock,
        return_value=AGENT_ERROR,
    ):
        response = await rc.get(f"/api/recommendations/similar/{PRODUCT_A}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["recommendations"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_similar_products_invalid_uuid(rc: AsyncClient):
    """Invalid product UUID returns 422."""
    response = await rc.get("/api/recommendations/similar/not-a-uuid")
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/recommendations/frequently-bought-together/{product_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_frequently_bought_together(rc: AsyncClient):
    """FBT endpoint returns co-occurrence recommendations."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_frequently_bought_together",
        new_callable=AsyncMock,
        return_value=FBT_SUCCESS,
    ):
        response = await rc.get(f"/api/recommendations/frequently-bought-together/{PRODUCT_A}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["recommendation_type"] == "frequently_bought_together"
    assert data["total"] == 1


# ---------------------------------------------------------------------------
# GET /api/recommendations/personalized/{customer_id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_personalized_recommendations(rc: AsyncClient):
    """Personalized recommendations returns customer-specific results."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.get_personalized_recommendations",
        new_callable=AsyncMock,
        return_value=PERSONALIZED_SUCCESS,
    ):
        response = await rc.get(f"/api/recommendations/personalized/{CUSTOMER_ID}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["recommendations"]) == 2


# ---------------------------------------------------------------------------
# POST /api/recommendations/track-interaction
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_track_interaction(rc: AsyncClient):
    """Track interaction records customer-product event."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.track_interaction",
        new_callable=AsyncMock,
        return_value={"success": True, "message": "Interaction recorded"},
    ):
        response = await rc.post(
            "/api/recommendations/track-interaction",
            json={
                "customer_id": CUSTOMER_ID,
                "product_id": PRODUCT_A,
                "interaction_type": "view",
                "source": "web",
            },
        )
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.asyncio
async def test_track_interaction_invalid_uuid(rc: AsyncClient):
    """Invalid UUID in track-interaction returns 422."""
    response = await rc.post(
        "/api/recommendations/track-interaction",
        json={
            "customer_id": "not-a-uuid",
            "product_id": PRODUCT_A,
            "interaction_type": "view",
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/recommendations/update-co-occurrences
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_co_occurrences(rc: AsyncClient):
    """Update co-occurrences from a completed order."""
    with patch(
        "src.api.routes.recommendations.recommendation_agent.update_co_occurrences",
        new_callable=AsyncMock,
        return_value={"success": True, "message": "Co-occurrences updated"},
    ):
        response = await rc.post(
            "/api/recommendations/update-co-occurrences",
            json={"order_id": str(uuid4())},
        )
    assert response.status_code == 200
    assert response.json()["success"] is True
