"""
Recommendation API Endpoints.

Product recommendations using collaborative filtering and content-based algorithms.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_async_db
from src.ai.agents.specialized import RecommendationAgent

router = APIRouter(prefix="/api/recommendations", tags=["AI Recommendations"])

# Initialize recommendation agent
recommendation_agent = RecommendationAgent()


class RecommendationResponse(BaseModel):
    """Recommendation response model."""

    success: bool
    recommendation_type: str
    recommendations: list[dict]
    total: int


@router.get("/similar/{product_id}", response_model=RecommendationResponse)
async def get_similar_products(
    product_id: UUID,
    language: str = Query("en", description="Language code"),
    limit: int = Query(10, ge=1, le=50, description="Maximum recommendations"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """
    Get similar products using vector similarity.

    Finds products with similar attributes, descriptions, and categories
    using semantic embeddings.
    """
    result = await recommendation_agent.get_similar_products(
        product_id=product_id,
        language=language,
        limit=limit,
    )

    if "error" in result:
        return RecommendationResponse(
            success=False,
            recommendation_type="similar",
            recommendations=[],
            total=0,
        )

    return RecommendationResponse(
        success=result.get("success", False),
        recommendation_type=result.get("recommendation_type", "similar"),
        recommendations=result.get("recommendations", []),
        total=result.get("total", 0),
    )


@router.get("/frequently-bought-together/{product_id}", response_model=RecommendationResponse)
async def get_frequently_bought_together(
    product_id: UUID,
    limit: int = Query(10, ge=1, le=50, description="Maximum recommendations"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """
    Get products frequently bought together.

    Uses market basket analysis and co-occurrence data from completed orders.
    """
    result = await recommendation_agent.get_frequently_bought_together(
        product_id=product_id,
        limit=limit,
    )

    if "error" in result:
        return RecommendationResponse(
            success=False,
            recommendation_type="frequently_bought_together",
            recommendations=[],
            total=0,
        )

    return RecommendationResponse(
        success=result.get("success", False),
        recommendation_type=result.get("recommendation_type", "frequently_bought_together"),
        recommendations=result.get("recommendations", []),
        total=result.get("total", 0),
    )


@router.get("/personalized/{customer_id}", response_model=RecommendationResponse)
async def get_personalized_recommendations(
    customer_id: UUID,
    limit: int = Query(10, ge=1, le=50, description="Maximum recommendations"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """
    Get personalized recommendations for a customer.

    Analyzes customer interaction history (views, purchases, searches)
    to suggest relevant products.
    """
    result = await recommendation_agent.get_personalized_recommendations(
        customer_id=customer_id,
        limit=limit,
    )

    if "error" in result:
        return RecommendationResponse(
            success=False,
            recommendation_type="personalized",
            recommendations=[],
            total=0,
        )

    return RecommendationResponse(
        success=result.get("success", False),
        recommendation_type=result.get("recommendation_type", "personalized"),
        recommendations=result.get("recommendations", []),
        total=result.get("total", 0),
    )


class TrackInteractionRequest(BaseModel):
    """Track interaction request model."""

    customer_id: UUID = Field(..., description="Customer UUID")
    product_id: UUID = Field(..., description="Product UUID")
    interaction_type: str = Field(
        ...,
        description="Interaction type: view, add_to_cart, purchase, search, wishlist",
    )
    session_id: str | None = Field(None, description="Session ID")
    source: str = Field("web", description="Source: web, mobile, voice, api")


class TrackInteractionResponse(BaseModel):
    """Track interaction response model."""

    success: bool
    message: str | None = None
    error: str | None = None


@router.post("/track-interaction", response_model=TrackInteractionResponse)
async def track_interaction(
    request: TrackInteractionRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Track customer-product interaction for learning.

    Interactions are used to improve personalized recommendations.

    Supported interaction types:
    - **view**: Customer viewed product
    - **add_to_cart**: Customer added product to cart
    - **purchase**: Customer purchased product
    - **search**: Customer searched for product
    - **wishlist**: Customer added product to wishlist
    """
    result = await recommendation_agent.track_interaction(
        customer_id=request.customer_id,
        product_id=request.product_id,
        interaction_type=request.interaction_type,
        session_id=request.session_id,
        source=request.source,
    )

    if "error" in result:
        return TrackInteractionResponse(
            success=False,
            error=result["error"],
        )

    return TrackInteractionResponse(
        success=result.get("success", False),
        message=result.get("message"),
    )


class PrecomputeRequest(BaseModel):
    """Precompute recommendations request model."""

    product_ids: list[UUID] | None = Field(
        None,
        description="Product UUIDs (None = all products)",
    )
    recommendation_type: str | None = Field(
        None,
        description="Recommendation type: similar, frequently_bought_together (None = all)",
    )


class PrecomputeResponse(BaseModel):
    """Precompute response model."""

    success: bool
    results: dict | None = None
    error: str | None = None


@router.post("/precompute", response_model=PrecomputeResponse)
async def precompute_recommendations(
    request: PrecomputeRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Precompute recommendations for faster retrieval.

    Generates and stores recommendations in the database for quick access.

    This is a background operation that can take several minutes for large catalogs.
    Run periodically (e.g., nightly) to keep recommendations fresh.
    """
    result = await recommendation_agent.precompute_recommendations(
        product_ids=request.product_ids,
        recommendation_type=request.recommendation_type,
    )

    if "error" in result:
        return PrecomputeResponse(
            success=False,
            error=result["error"],
        )

    return PrecomputeResponse(
        success=result.get("success", False),
        results=result.get("results"),
    )


class UpdateCoOccurrencesRequest(BaseModel):
    """Update co-occurrences request model."""

    order_id: UUID = Field(..., description="Completed order UUID")


class UpdateCoOccurrencesResponse(BaseModel):
    """Update co-occurrences response model."""

    success: bool
    message: str | None = None
    error: str | None = None


@router.post("/update-co-occurrences", response_model=UpdateCoOccurrencesResponse)
async def update_co_occurrences(
    request: UpdateCoOccurrencesRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Update product co-occurrence data from a completed order.

    Analyzes order items to update "frequently bought together" data.

    This should be called automatically when an order is completed.
    """
    result = await recommendation_agent.update_co_occurrences(
        order_id=request.order_id,
    )

    if "error" in result:
        return UpdateCoOccurrencesResponse(
            success=False,
            error=result["error"],
        )

    return UpdateCoOccurrencesResponse(
        success=result.get("success", False),
        message=result.get("message"),
    )
