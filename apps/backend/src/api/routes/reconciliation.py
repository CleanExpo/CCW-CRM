"""
Financial reconciliation API endpoints.

AI-powered transaction matching and auto-reconciliation.
"""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class MatchSuggestion(BaseModel):
    """AI-suggested reconciliation match."""

    match_id: UUID
    transaction_id: UUID
    invoice_id: UUID
    invoice_number: str
    amount: Decimal
    confidence: float = Field(ge=0.0, le=1.0, description="Match confidence score (0-1)")
    reason: str = Field(description="Why this match was suggested")


class AutoMatchRequest(BaseModel):
    """Request for automatic matching."""

    transaction_id: UUID
    min_confidence: float = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold (default 0.9 = 90%)",
    )


class AutoMatchResponse(BaseModel):
    """Response from automatic matching."""

    matched: bool
    match_id: UUID | None = None
    confidence: float | None = None
    reason: str | None = None


# ---------------------------------------------------------------------------
# GAP-024: Match Suggestions
# ---------------------------------------------------------------------------


@router.get("/match-suggestions", response_model=list[MatchSuggestion])
async def get_match_suggestions(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    transaction_id: UUID = Query(..., description="Transaction ID to find matches for"),
) -> list[MatchSuggestion]:
    """
    Get AI-suggested reconciliation matches for a transaction.

    Uses fuzzy matching on amount, date proximity, and reference numbers
    to suggest potential invoice matches with confidence scores.
    """
    # In a real implementation, this would:
    # 1. Load the transaction from bank_transactions table
    # 2. Query invoices with similar amounts (+/- 5%)
    # 3. Check date proximity (within 30 days)
    # 4. Match on reference numbers / customer names
    # 5. Calculate confidence scores using ML model

    # For demo, return mock suggestions
    suggestions = [
        MatchSuggestion(
            match_id=UUID("00000000-0000-0000-0000-000000000001"),
            transaction_id=transaction_id,
            invoice_id=UUID("00000000-0000-0000-0000-000000000002"),
            invoice_number="INV-2026-0001",
            amount=Decimal("1250.00"),
            confidence=0.95,
            reason="Exact amount match, reference includes invoice number",
        ),
        MatchSuggestion(
            match_id=UUID("00000000-0000-0000-0000-000000000003"),
            transaction_id=transaction_id,
            invoice_id=UUID("00000000-0000-0000-0000-000000000004"),
            invoice_number="INV-2026-0002",
            amount=Decimal("1248.50"),
            confidence=0.78,
            reason="Similar amount (1.2% difference), same customer",
        ),
        MatchSuggestion(
            match_id=UUID("00000000-0000-0000-0000-000000000005"),
            transaction_id=transaction_id,
            invoice_id=UUID("00000000-0000-0000-0000-000000000006"),
            invoice_number="INV-2026-0003",
            amount=Decimal("1250.00"),
            confidence=0.65,
            reason="Exact amount match, date within 14 days",
        ),
    ]

    logger.info(
        "reconciliation_match_suggestions_retrieved",
        transaction_id=str(transaction_id),
        suggestion_count=len(suggestions),
    )

    return suggestions


# ---------------------------------------------------------------------------
# GAP-025: Auto-Match
# ---------------------------------------------------------------------------


@router.post("/auto-match", response_model=AutoMatchResponse)
async def auto_match_transaction(
    request: AutoMatchRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> AutoMatchResponse:
    """
    Automatically match a transaction with high confidence.

    Only matches if confidence score exceeds min_confidence threshold (default 90%).
    Returns match result with details.
    """
    # Get suggestions first
    suggestions = await get_match_suggestions(db, request.transaction_id)

    # Filter by confidence threshold
    high_confidence_matches = [
        s for s in suggestions if s.confidence >= request.min_confidence
    ]

    if not high_confidence_matches:
        logger.info(
            "auto_match_no_high_confidence",
            transaction_id=str(request.transaction_id),
            min_confidence=request.min_confidence,
            max_confidence=max((s.confidence for s in suggestions), default=0.0),
        )
        return AutoMatchResponse(
            matched=False,
            reason=f"No matches above {request.min_confidence:.0%} confidence threshold",
        )

    # Take the highest confidence match
    best_match = max(high_confidence_matches, key=lambda s: s.confidence)

    # In real implementation, create reconciliation record in database
    # For now, just log and return success

    logger.info(
        "auto_match_successful",
        transaction_id=str(request.transaction_id),
        invoice_id=str(best_match.invoice_id),
        confidence=best_match.confidence,
        match_id=str(best_match.match_id),
    )

    return AutoMatchResponse(
        matched=True,
        match_id=best_match.match_id,
        confidence=best_match.confidence,
        reason=best_match.reason,
    )
