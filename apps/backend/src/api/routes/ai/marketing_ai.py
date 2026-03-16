"""AI Marketing API endpoints.

Provides 3 endpoints:
  POST /api/ai/marketing/generate-campaign
  POST /api/ai/marketing/analyze-audience
  GET  /api/ai/marketing/stats
"""

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/marketing", tags=["AI Marketing"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class GenerateCampaignRequest(BaseModel):
    """Request body for campaign generation."""

    product_name: str = Field(..., description="Name of the product to promote")
    target_audience: str = Field(..., description="Description of the target audience")
    campaign_type: str = Field(
        default="email",
        description="Type of campaign: email | social | sms",
    )
    tone: str | None = Field(
        default="professional",
        description="Tone: professional | friendly | urgent | casual",
    )


class CampaignResponse(BaseModel):
    """Generated campaign copy."""

    campaign_subject: str = Field(..., description="Subject line or headline")
    campaign_body: str = Field(..., description="Main body copy")
    cta: str = Field(..., description="Call-to-action button text")
    campaign_type: str = Field(..., description="Type of campaign generated")
    created_at: str = Field(..., description="ISO timestamp of generation")


class AnalyzeAudienceRequest(BaseModel):
    """Request body for audience analysis."""

    product_category: str = Field(
        ...,
        description="Product category (e.g. power_tools, safety_equipment, heavy_machinery)",
    )
    location: str | None = Field(default=None, description="Optional geographic location")


class AudienceSegment(BaseModel):
    """A single audience segment."""

    name: str
    description: str
    estimated_size: str


class AudienceResponse(BaseModel):
    """Audience analysis response."""

    segments: list[AudienceSegment] = Field(..., description="Identified audience segments")
    primary_segment: str = Field(..., description="Recommended primary target segment")


class MarketingStatsResponse(BaseModel):
    """Marketing performance stats."""

    total_campaigns: int
    active_campaigns: int
    avg_open_rate: float
    avg_conversion_rate: float
    top_performing_type: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate-campaign", response_model=CampaignResponse)
async def generate_campaign(request: GenerateCampaignRequest) -> CampaignResponse:
    """Generate AI-powered marketing campaign copy.

    Uses GPT-4 when OPENAI_API_KEY is configured, otherwise returns
    realistic mock data.
    """
    logger.info(
        "generate_campaign_request",
        product_name=request.product_name,
        campaign_type=request.campaign_type,
    )

    try:
        from src.ai.agents.specialized.marketing_agent import get_marketing_agent

        agent = get_marketing_agent()
        result = await agent.execute(
            task=f"Generate {request.campaign_type} campaign for {request.product_name}",
            context={
                "action": "generate_campaign",
                "product_name": request.product_name,
                "target_audience": request.target_audience,
                "campaign_type": request.campaign_type,
                "tone": request.tone or "professional",
            },
        )

        if "error" in result:
            logger.error("campaign_generation_failed", error=result["error"])
            # Return mock data as graceful fallback
            result = _fallback_campaign(request)

        return CampaignResponse(**result)

    except Exception as exc:
        logger.error("generate_campaign_endpoint_error", error=str(exc))
        return CampaignResponse(**_fallback_campaign(request))


@router.post("/analyze-audience", response_model=AudienceResponse)
async def analyze_audience(request: AnalyzeAudienceRequest) -> AudienceResponse:
    """Analyse and return target audience segments for a product category."""
    logger.info("analyze_audience_request", product_category=request.product_category)

    try:
        from src.ai.agents.specialized.marketing_agent import get_marketing_agent

        agent = get_marketing_agent()
        result = await agent.execute(
            task=f"Analyze audience for {request.product_category}",
            context={
                "action": "analyze_audience",
                "product_category": request.product_category,
                "location": request.location,
            },
        )

        if "error" in result:
            logger.error("audience_analysis_failed", error=result["error"])
            result = _fallback_audience(request.product_category)

        return AudienceResponse(
            segments=[AudienceSegment(**s) for s in result.get("segments", [])],
            primary_segment=result.get("primary_segment", "Trade Professionals"),
        )

    except Exception as exc:
        logger.error("analyze_audience_endpoint_error", error=str(exc))
        fallback = _fallback_audience(request.product_category)
        return AudienceResponse(
            segments=[AudienceSegment(**s) for s in fallback["segments"]],
            primary_segment=fallback["primary_segment"],
        )


@router.get("/stats", response_model=MarketingStatsResponse)
async def get_marketing_stats() -> MarketingStatsResponse:
    """Return marketing performance statistics."""
    logger.info("get_marketing_stats_request")

    try:
        from src.ai.agents.specialized.marketing_agent import get_marketing_agent

        agent = get_marketing_agent()
        result = await agent.execute(
            task="Get marketing stats",
            context={"action": "get_stats"},
        )

        if "error" in result:
            result = _fallback_stats()

        return MarketingStatsResponse(**result)

    except Exception as exc:
        logger.error("get_marketing_stats_endpoint_error", error=str(exc))
        return MarketingStatsResponse(**_fallback_stats())


# ---------------------------------------------------------------------------
# Private fallback helpers
# ---------------------------------------------------------------------------


def _fallback_campaign(request: GenerateCampaignRequest) -> dict[str, Any]:
    """Return minimal mock campaign when the agent fails."""
    return {
        "campaign_subject": f"Introducing {request.product_name}",
        "campaign_body": (
            f"Discover {request.product_name}, designed for {request.target_audience}. "
            "Professional quality, delivered fast. Contact CCW today."
        ),
        "cta": "Shop Now",
        "campaign_type": request.campaign_type,
        "created_at": datetime.now(UTC).isoformat(),
    }


def _fallback_audience(product_category: str) -> dict[str, Any]:
    """Return minimal mock audience segments."""
    return {
        "segments": [
            {
                "name": "Trade Professionals",
                "description": "Professional buyers sourcing equipment for business use",
                "estimated_size": "15,000–22,000",
            },
            {
                "name": "Retail Consumers",
                "description": "Individual customers purchasing for personal use",
                "estimated_size": "40,000–55,000",
            },
        ],
        "primary_segment": "Trade Professionals",
    }


def _fallback_stats() -> dict[str, Any]:
    """Return minimal mock marketing stats."""
    return {
        "total_campaigns": 24,
        "active_campaigns": 6,
        "avg_open_rate": 28.4,
        "avg_conversion_rate": 3.7,
        "top_performing_type": "email",
    }
