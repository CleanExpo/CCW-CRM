"""AI Insights API endpoints for business intelligence."""

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.insights_agent import InsightsAgent, get_insights_agent
from src.config.database import get_async_db
from src.db.demo_models import AIGeneratedContent
from src.utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai/insights")


# Request/Response Models


class DateRange(BaseModel):
    """Date range for insights generation."""

    start_date: str | None = Field(None, description="Start date in ISO format (YYYY-MM-DD)")
    end_date: str | None = Field(None, description="End date in ISO format (YYYY-MM-DD)")


class GenerateInsightsRequest(BaseModel):
    """Request to generate insights."""

    category: str = Field(
        default="sales",
        description="Insight category: sales, inventory, customers, orders, or all",
    )
    date_range: DateRange | None = Field(None, description="Date range for analysis")
    filters: dict[str, Any] = Field(default_factory=dict, description="Additional filters")
    user_id: str | None = Field(None, description="User ID")


class Insight(BaseModel):
    """Individual insight."""

    id: str
    title: str
    finding: str
    impact: str
    recommendation: str
    priority: str  # high, medium, low
    category: str
    generated_at: str


class GenerateInsightsResponse(BaseModel):
    """Response with generated insights."""

    category: str
    insights: list[dict[str, Any]]
    priority_insights: list[dict[str, Any]]
    total_insights: int
    tools_used: list[str]
    summary: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DashboardInsightsResponse(BaseModel):
    """Response with dashboard insights."""

    insights: list[dict[str, Any]]
    total: int
    categories: list[str]


class InsightHistoryResponse(BaseModel):
    """Response with insight history."""

    insights: list[dict[str, Any]]
    total: int
    page: int
    page_size: int


# Endpoints


@router.post("/generate", response_model=GenerateInsightsResponse)
async def generate_insights(
    request: GenerateInsightsRequest,
    agent: Annotated[InsightsAgent, Depends(get_insights_agent)],
) -> GenerateInsightsResponse:
    """Generate AI-powered business insights.

    Args:
        request: Insight generation parameters
        agent: InsightsAgent instance

    Returns:
        Generated insights with recommendations
    """
    logger.info(f"Generating insights", category=request.category)

    try:
        # Prepare context
        context = {
            "category": request.category,
            "date_range": request.date_range.model_dump() if request.date_range else None,
            "filters": request.filters,
            "user_id": request.user_id,
        }

        # Execute agent
        result = await agent.execute(
            task=f"Generate {request.category} insights",
            context=context,
        )

        if "error" in result:
            return GenerateInsightsResponse(
                category=request.category,
                insights=[],
                priority_insights=[],
                total_insights=0,
                tools_used=[],
                summary={"error": result["error"]},
            )

        return GenerateInsightsResponse(**result)

    except Exception as e:
        logger.error(f"Error generating insights", error=str(e))
        return GenerateInsightsResponse(
            category=request.category,
            insights=[],
            priority_insights=[],
            total_insights=0,
            tools_used=[],
            summary={"error": f"Failed to generate insights: {str(e)}"},
        )


@router.get("/dashboard", response_model=DashboardInsightsResponse)
async def get_dashboard_insights(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = Query(10, ge=1, le=50, description="Number of insights to return"),
) -> DashboardInsightsResponse:
    """Get recent insights for dashboard display.

    Args:
        db: Database session
        limit: Maximum number of insights to return

    Returns:
        Recent insights across all categories
    """
    try:
        # Query recent insights
        query = (
            select(AIGeneratedContent)
            .where(AIGeneratedContent.content_type == "insight")
            .order_by(desc(AIGeneratedContent.created_at))
            .limit(limit)
        )

        result = await db.execute(query)
        records = result.scalars().all()

        # Parse insights
        insights = []
        categories = set()

        for record in records:
            try:
                insight_data = json.loads(record.content)
                metadata = json.loads(record.content_metadata) if record.content_metadata else {}

                insight = {
                    "id": str(record.id),
                    "title": record.title,
                    "category": metadata.get("category", "unknown"),
                    "priority": metadata.get("priority", "medium"),
                    "created_at": record.created_at.isoformat(),
                    **insight_data,
                }

                insights.append(insight)
                categories.add(insight["category"])

            except Exception as e:
                logger.error(f"Error parsing insight", record_id=record.id, error=str(e))
                continue

        return DashboardInsightsResponse(
            insights=insights,
            total=len(insights),
            categories=list(categories),
        )

    except Exception as e:
        logger.error(f"Error fetching dashboard insights", error=str(e))
        return DashboardInsightsResponse(
            insights=[],
            total=0,
            categories=[],
        )


@router.get("/history", response_model=InsightHistoryResponse)
async def get_insight_history(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    category: str | None = Query(None, description="Filter by category"),
    priority: str | None = Query(None, description="Filter by priority"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> InsightHistoryResponse:
    """Get historical insights with filtering.

    Args:
        db: Database session
        category: Optional category filter
        priority: Optional priority filter
        page: Page number
        page_size: Items per page

    Returns:
        Paginated insight history
    """
    try:
        # Build query
        query = select(AIGeneratedContent).where(AIGeneratedContent.content_type == "insight")

        # Apply filters
        if category:
            # Filter by metadata JSON field
            query = query.where(
                AIGeneratedContent.content_metadata.like(f'%"category": "{category}"%')
            )

        if priority:
            # Filter by metadata JSON field
            query = query.where(
                AIGeneratedContent.content_metadata.like(f'%"priority": "{priority}"%')
            )

        # Order and paginate
        query = (
            query.order_by(desc(AIGeneratedContent.created_at))
            .limit(page_size)
            .offset((page - 1) * page_size)
        )

        result = await db.execute(query)
        records = result.scalars().all()

        # Parse insights
        insights = []

        for record in records:
            try:
                insight_data = json.loads(record.content)
                metadata = json.loads(record.content_metadata) if record.content_metadata else {}

                insight = {
                    "id": str(record.id),
                    "title": record.title,
                    "category": metadata.get("category", "unknown"),
                    "priority": metadata.get("priority", "medium"),
                    "created_at": record.created_at.isoformat(),
                    **insight_data,
                }

                insights.append(insight)

            except Exception as e:
                logger.error(f"Error parsing insight", record_id=record.id, error=str(e))
                continue

        return InsightHistoryResponse(
            insights=insights,
            total=len(insights),
            page=page,
            page_size=page_size,
        )

    except Exception as e:
        logger.error(f"Error fetching insight history", error=str(e))
        return InsightHistoryResponse(
            insights=[],
            total=0,
            page=page,
            page_size=page_size,
        )
