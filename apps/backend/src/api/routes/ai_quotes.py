"""
AI Quote Generation API Endpoints.

Endpoints for AI-powered quote generation from natural language.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.services.ai_quote_service import AIQuoteService, QuoteGenerationResult


router = APIRouter(prefix="/api/ai/quotes", tags=["AI Quotes"])


# Request/Response Models


class GenerateQuoteRequest(BaseModel):
    """Request to generate quote from natural language."""

    prompt: str = Field(..., min_length=10, description="Natural language quote description")
    user_context: dict[str, Any] | None = Field(
        default=None,
        description="Optional context (user_id, organization_id, etc.)",
    )


class GenerateQuoteResponse(BaseModel):
    """Response with generated quote data."""

    success: bool
    data: QuoteGenerationResult | None = None
    error: str | None = None


class ParsePromptRequest(BaseModel):
    """Request to parse prompt without saving."""

    prompt: str = Field(..., min_length=10, description="Natural language to parse")


class ParsePromptResponse(BaseModel):
    """Response with parsed prompt preview."""

    success: bool
    data: dict[str, Any] | None = None
    error: str | None = None


class SuggestRequest(BaseModel):
    """Request for product/customer suggestions."""

    query: str = Field(..., min_length=2, description="Partial query string")
    limit: int = Field(default=5, ge=1, le=20, description="Maximum results")


class SuggestResponse(BaseModel):
    """Response with suggestions."""

    success: bool
    data: list[dict[str, Any]] = Field(default_factory=list)


# Endpoints


@router.post("/generate", response_model=GenerateQuoteResponse)
async def generate_quote(
    request: GenerateQuoteRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> GenerateQuoteResponse:
    """
    Generate quote from natural language prompt.

    This endpoint uses Claude Sonnet 4.5 to parse natural language descriptions
    into structured quote data with product matching, customer matching, and
    pricing calculations.

    **Examples:**
    - "Create a quote for John Smith with 5 power drills and 10 safety helmets"
    - "Quote for ABC Corp: 50 hard hats @ $25 each"
    - "Emergency shipment of 100 steel beams to Sydney for Smith Construction"

    **Features:**
    - Semantic product matching with confidence scores
    - Fuzzy customer matching (name, company, email)
    - Automatic pricing and discount suggestions
    - Stock availability warnings
    - Alternative product suggestions

    **Returns:**
    - Structured quote data with line items, customer, pricing
    - Confidence scores for all matches (0.0-1.0)
    - Warnings (stock issues, pricing alerts)
    - Suggestions (bulk discounts, bundles)

    **Response Time:** Typically 3-5 seconds

    **Cost:** ~$0.10-0.30 per generation (with caching optimization)
    """
    try:
        service = AIQuoteService(db)
        result = await service.generate_quote(request.prompt, request.user_context)

        return GenerateQuoteResponse(success=True, data=result)

    except ValueError as e:
        # Validation errors (bad prompt, missing API key)
        raise HTTPException(status_code=400, detail=str(e))

    except RuntimeError as e:
        # AI generation errors
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        # Unexpected errors
        raise HTTPException(
            status_code=500,
            detail=f"Quote generation failed: {str(e)}",
        )


@router.post("/parse-prompt", response_model=ParsePromptResponse)
async def parse_prompt(
    request: ParsePromptRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ParsePromptResponse:
    """
    Parse natural language prompt without saving (preview mode).

    Use this endpoint for real-time preview/validation as the user types.
    Returns simplified structure with confidence scores and warnings.

    **Use Case:** Show live preview of what the AI understood from the prompt
    before the user commits to generating the full quote.

    **Response Time:** Typically 2-4 seconds

    **Cost:** ~$0.05-0.15 per parse (with caching optimization)
    """
    try:
        service = AIQuoteService(db)
        result = await service.parse_prompt_preview(request.prompt)

        return ParsePromptResponse(success=True, data=result)

    except Exception as e:
        return ParsePromptResponse(
            success=False,
            error=str(e),
        )


@router.post("/suggest-products", response_model=SuggestResponse)
async def suggest_products(
    request: SuggestRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SuggestResponse:
    """
    Get product suggestions based on partial query.

    Use this for autocomplete/typeahead in the AI quote builder UI.

    **Examples:**
    - Query: "drill" → Returns all drill products
    - Query: "SKU-123" → Returns products matching SKU
    - Query: "safety" → Returns safety equipment

    **Response Time:** <100ms (database query, no AI)
    """
    try:
        service = AIQuoteService(db)
        products = await service.suggest_products(request.query, request.limit)

        return SuggestResponse(success=True, data=products)

    except Exception as e:
        return SuggestResponse(success=False, data=[])


@router.post("/suggest-customers", response_model=SuggestResponse)
async def suggest_customers(
    request: SuggestRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SuggestResponse:
    """
    Get customer suggestions based on partial query.

    Use this for autocomplete/typeahead in the AI quote builder UI.

    **Examples:**
    - Query: "Smith" → Returns all customers with "Smith" in name
    - Query: "ABC" → Returns ABC Corp and related customers
    - Query: "john@" → Returns customers with matching email

    **Response Time:** <100ms (database query, no AI)
    """
    try:
        service = AIQuoteService(db)
        customers = await service.suggest_customers(request.query, request.limit)

        return SuggestResponse(success=True, data=customers)

    except Exception as e:
        return SuggestResponse(success=False, data=[])


@router.get("/health")
async def health_check() -> dict:
    """
    Health check endpoint for AI quote service.

    Returns API key status and service availability.
    """
    from src.config.settings import get_settings

    settings = get_settings()

    return {
        "status": "healthy",
        "service": "ai-quotes",
        "model": "claude-sonnet-4-5-20250929",
        "api_key_configured": bool(settings.anthropic_api_key),
        "caching_enabled": True,
    }
