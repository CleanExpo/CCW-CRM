"""AI Marketing Assets Management API endpoints."""

from typing import Any
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai")


# ============================================
# Request/Response Models
# ============================================


class Asset(BaseModel):
    """AI-generated asset model."""

    id: str
    type: str = Field(description="Asset type: image, copy, video")
    title: str
    content: str = Field(description="URL for images/videos, text for copy")
    thumbnail: str | None = Field(None, description="Thumbnail URL for images")
    prompt: str = Field(description="Original prompt used to generate asset")
    createdAt: str
    tags: list[str] = Field(default_factory=list)


class AssetsResponse(BaseModel):
    """Response with list of assets."""

    assets: list[Asset]
    total: int
    page: int
    pageSize: int


class StatsResponse(BaseModel):
    """Response with marketing stats."""

    totalAssets: int
    imagesGenerated: int
    copyGenerated: int
    thisMonth: int


# ============================================
# In-Memory Storage (Replace with database in production)
# ============================================

# Mock data for development
MOCK_ASSETS: list[dict[str, Any]] = [
    {
        "id": "1",
        "type": "image",
        "title": "Product Launch Hero",
        "content": "https://placehold.co/600x400/4f46e5/ffffff?text=AI+Generated",
        "thumbnail": "https://placehold.co/300x200/4f46e5/ffffff?text=AI+Generated",
        "prompt": "Modern office workspace with natural lighting",
        "createdAt": (datetime.utcnow() - timedelta(days=2)).isoformat(),
        "tags": ["product", "hero", "workspace"],
    },
    {
        "id": "2",
        "type": "copy",
        "title": "Email Campaign Copy",
        "content": "Discover the future of productivity with our latest innovation. Transform your workflow and achieve more with cutting-edge technology designed for the modern professional.",
        "prompt": "Professional email about new product launch",
        "createdAt": (datetime.utcnow() - timedelta(days=1)).isoformat(),
        "tags": ["email", "campaign", "product"],
    },
    {
        "id": "3",
        "type": "image",
        "title": "Social Media Banner",
        "content": "https://placehold.co/1200x630/9333ea/ffffff?text=Social+Banner",
        "thumbnail": "https://placehold.co/600x315/9333ea/ffffff?text=Social+Banner",
        "prompt": "Eye-catching social media banner with gradient background",
        "createdAt": (datetime.utcnow() - timedelta(hours=3)).isoformat(),
        "tags": ["social", "banner", "gradient"],
    },
    {
        "id": "4",
        "type": "copy",
        "title": "Ad Copy Variation",
        "content": "Limited time offer! Get 30% off your first order. Join thousands of satisfied customers who have transformed their business. Act now!",
        "prompt": "Persuasive ad copy for promotional campaign",
        "createdAt": (datetime.utcnow() - timedelta(days=3)).isoformat(),
        "tags": ["ad", "promotion", "discount"],
    },
]


# ============================================
# API Endpoints
# ============================================


@router.get("/assets", response_model=AssetsResponse)
async def get_assets(
    page: int = 1,
    page_size: int = 50,
    asset_type: str | None = None,
) -> AssetsResponse:
    """Get list of AI-generated marketing assets.

    Args:
        page: Page number (default: 1)
        page_size: Items per page (default: 50)
        asset_type: Filter by type (image, copy, video)

    Returns:
        List of assets with pagination metadata
    """
    logger.info("Fetching assets", page=page, page_size=page_size, asset_type=asset_type)

    try:
        # In production, this would query the database
        # For now, return mock data
        assets = MOCK_ASSETS

        # Filter by type if specified
        if asset_type:
            assets = [a for a in assets if a["type"] == asset_type]

        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_assets = assets[start_idx:end_idx]

        return AssetsResponse(
            assets=[Asset(**asset) for asset in paginated_assets],
            total=len(assets),
            page=page,
            pageSize=page_size,
        )

    except Exception as e:
        logger.error("Error fetching assets", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch assets: {str(e)}",
        )


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str) -> dict[str, str]:
    """Delete an AI-generated asset.

    Args:
        asset_id: ID of the asset to delete

    Returns:
        Success message

    Raises:
        HTTPException: If asset not found or deletion fails
    """
    logger.info("Deleting asset", asset_id=asset_id)

    try:
        # In production, this would delete from database
        # For now, just validate the asset exists in mock data
        asset = next((a for a in MOCK_ASSETS if a["id"] == asset_id), None)

        if not asset:
            raise HTTPException(
                status_code=404,
                detail=f"Asset with ID {asset_id} not found",
            )

        # Remove from mock data
        MOCK_ASSETS[:] = [a for a in MOCK_ASSETS if a["id"] != asset_id]

        logger.info("Asset deleted successfully", asset_id=asset_id)

        return {"status": "success", "message": f"Asset {asset_id} deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting asset", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete asset: {str(e)}",
        )


@router.get("/stats", response_model=StatsResponse)
async def get_marketing_stats() -> StatsResponse:
    """Get AI marketing generation statistics.

    Returns:
        Statistics about generated assets
    """
    logger.info("Fetching marketing stats")

    try:
        # In production, this would query the database
        # For now, calculate from mock data
        total_assets = len(MOCK_ASSETS)
        images_generated = len([a for a in MOCK_ASSETS if a["type"] == "image"])
        copy_generated = len([a for a in MOCK_ASSETS if a["type"] == "copy"])

        # Count assets created this month
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        this_month = len([
            a for a in MOCK_ASSETS
            if datetime.fromisoformat(a["createdAt"]) >= month_start
        ])

        return StatsResponse(
            totalAssets=total_assets,
            imagesGenerated=images_generated,
            copyGenerated=copy_generated,
            thisMonth=this_month,
        )

    except Exception as e:
        logger.error("Error fetching marketing stats", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch stats: {str(e)}",
        )
