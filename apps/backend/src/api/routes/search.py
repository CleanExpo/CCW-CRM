"""
Search API Endpoints.

Semantic and hybrid search for products with multi-language support.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.specialized import SearchAgent
from src.api.deps import get_async_db, get_current_user

router = APIRouter(prefix="/api/search", tags=["AI Search"], dependencies=[Depends(get_current_user)])

# Initialize search agent
search_agent = SearchAgent()


class SearchRequest(BaseModel):
    """Search request model."""

    query: str = Field(..., min_length=1, description="Search query text")
    language: str = Field("en", description="Language code (e.g., en, zh-CN, es)")
    search_type: str = Field(
        "hybrid",
        description="Search type: semantic, hybrid, or keyword",
    )
    limit: int = Field(20, ge=1, le=100, description="Maximum results to return")
    vector_weight: float = Field(
        0.7,
        ge=0.0,
        le=1.0,
        description="Weight for vector search in hybrid mode (0.0 to 1.0)",
    )
    keyword_weight: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="Weight for keyword search in hybrid mode (0.0 to 1.0)",
    )
    customer_id: UUID | None = Field(None, description="Optional customer ID for tracking")
    session_id: str | None = Field(None, description="Optional session ID for tracking")


class SearchResponse(BaseModel):
    """Search response model."""

    success: bool
    query: str
    search_type: str
    language: str
    results: dict


@router.post("/", response_model=SearchResponse)
async def search_products(
    request: SearchRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Search for products using semantic, hybrid, or keyword search.

    - **Semantic search**: Uses vector embeddings for natural language queries
    - **Hybrid search**: Combines vector and keyword search (recommended)
    - **Keyword search**: Traditional text matching

    Example queries:
    - "drill for concrete walls"
    - "安全帽" (Chinese: safety helmet)
    - "herramientas de construcción" (Spanish: construction tools)
    """
    result = await search_agent.execute(
        task=request.query,
        context={
            "language": request.language,
            "search_type": request.search_type,
            "limit": request.limit,
            "vector_weight": request.vector_weight,
            "keyword_weight": request.keyword_weight,
            "customer_id": str(request.customer_id) if request.customer_id else None,
            "session_id": request.session_id,
        },
    )

    if "error" in result:
        return SearchResponse(
            success=False,
            query=request.query,
            search_type=request.search_type,
            language=request.language,
            results={"error": result["error"]},
        )

    return SearchResponse(
        success=result.get("success", False),
        query=result.get("query", request.query),
        search_type=result.get("search_type", request.search_type),
        language=result.get("language", request.language),
        results=result.get("results", {}),
    )


@router.get("/semantic", response_model=SearchResponse)
async def semantic_search(
    query: str = Query(..., min_length=1, description="Search query"),
    language: str = Query("en", description="Language code"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    customer_id: UUID | None = Query(None, description="Customer ID"),
    session_id: str | None = Query(None, description="Session ID"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """
    Semantic search using vector embeddings.

    Pure vector similarity search for natural language queries.
    """
    result = await search_agent.semantic_search(
        query=query,
        language=language,
        limit=limit,
        customer_id=customer_id,
        session_id=session_id,
    )

    if "error" in result:
        return SearchResponse(
            success=False,
            query=query,
            search_type="semantic",
            language=language,
            results={"error": result["error"]},
        )

    return SearchResponse(
        success=result.get("success", False),
        query=result.get("query", query),
        search_type=result.get("search_type", "semantic"),
        language=result.get("language", language),
        results=result.get("results", {}),
    )


@router.get("/hybrid", response_model=SearchResponse)
async def hybrid_search(
    query: str = Query(..., min_length=1, description="Search query"),
    language: str = Query("en", description="Language code"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    vector_weight: float = Query(0.7, ge=0.0, le=1.0, description="Vector weight"),
    keyword_weight: float = Query(0.3, ge=0.0, le=1.0, description="Keyword weight"),
    customer_id: UUID | None = Query(None, description="Customer ID"),
    session_id: str | None = Query(None, description="Session ID"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """
    Hybrid search combining vector and keyword matching.

    Recommended for best results. Balances semantic understanding with exact matches.
    """
    result = await search_agent.hybrid_search(
        query=query,
        language=language,
        limit=limit,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        customer_id=customer_id,
        session_id=session_id,
    )

    if "error" in result:
        return SearchResponse(
            success=False,
            query=query,
            search_type="hybrid",
            language=language,
            results={"error": result["error"]},
        )

    return SearchResponse(
        success=result.get("success", False),
        query=result.get("query", query),
        search_type=result.get("search_type", "hybrid"),
        language=result.get("language", language),
        results=result.get("results", {}),
    )


class SearchAnalyticsResponse(BaseModel):
    """Search analytics response model."""

    success: bool
    analytics: dict


@router.get("/analytics", response_model=SearchAnalyticsResponse)
async def get_search_analytics(
    start_date: str | None = Query(None, description="Start date (ISO format)"),
    end_date: str | None = Query(None, description="End date (ISO format)"),
):
    """
    Get search analytics and insights.

    Returns:
    - Total searches
    - Average results per search
    - Average query time
    - Zero results rate
    - Top queries
    """
    result = await search_agent.get_search_analytics(
        start_date=start_date,
        end_date=end_date,
    )

    if "error" in result:
        return SearchAnalyticsResponse(
            success=False,
            analytics={"error": result["error"]},
        )

    return SearchAnalyticsResponse(
        success=result.get("success", False),
        analytics=result.get("analytics", {}),
    )
