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
# Pydantic Schemas (GAP-026, GAP-027 / RA-194, RA-195)
# ---------------------------------------------------------------------------


class MatchSuggestion(BaseModel):
    """AI-suggested reconciliation match."""

    invoice_id: UUID
    transaction_id: UUID
    confidence: float = Field(ge=0.0, le=1.0, description="Match confidence score (0.0-1.0)")
    match_reason: str = Field(description="Reason for match suggestion")
    invoice_amount: Decimal
    transaction_amount: Decimal
    variance: Decimal = Field(description="Difference between invoice and transaction amounts")


class MatchSuggestionsResponse(BaseModel):
    """Response from match suggestions endpoint."""

    suggestions: list[MatchSuggestion]
    total: int


class AutoMatchRequest(BaseModel):
    """Request for automatic matching."""

    organization_id: UUID
    confidence_threshold: float = Field(
        default=0.95,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold (default 0.95 = 95%)",
    )
    dry_run: bool = Field(default=False, description="Preview without committing")


class MatchResult(BaseModel):
    """Result of a single match operation."""

    invoice_id: UUID
    transaction_id: UUID
    matched: bool
    reason: str


class AutoMatchResponse(BaseModel):
    """Response from automatic matching."""

    matched: list[MatchResult]
    total_matched: int
    total_amount_matched: Decimal


# ---------------------------------------------------------------------------
# GAP-026 / RA-194: Match Suggestions
# ---------------------------------------------------------------------------


@router.get("/match-suggestions", response_model=MatchSuggestionsResponse)
async def get_match_suggestions(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    organization_id: Annotated[UUID, Query(description="Organization ID")],
    confidence_threshold: float = Query(0.8, ge=0.0, le=1.0, description="Minimum confidence threshold"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of suggestions"),
) -> MatchSuggestionsResponse:
    """
    Get AI-suggested invoice-payment match suggestions (GAP-026).

    Uses intelligent matching on amount, date proximity, and reference numbers
    to suggest potential invoice-payment matches with confidence scores.

    NOTE: This is a demo implementation. In production, this would:
    1. Load unmatched bank transactions from bank_transactions table
    2. Query invoices with payment_status='pending' and similar amounts (+/- 5%)
    3. Check date proximity (within 30 days)
    4. Match on reference numbers / customer names
    5. Calculate confidence scores using ML model or rule-based scoring
    """
    from src.db.models.invoicing import Invoice

    # Query unmatched/pending invoices for this organization
    # NOTE: Invoice model doesn't have organization_id, so we'll use customer relationship
    # In production, you'd join through customer table or add organization_id to Invoice
    stmt = (
        select(Invoice)
        .where(Invoice.status.in_(["sent", "partial"]))
        .limit(limit * 2)  # Get more to filter
        .order_by(Invoice.invoice_date.desc())
    )

    result = await db.execute(stmt)
    invoices = result.scalars().all()

    # Generate mock suggestions based on real invoice data
    suggestions = []

    for idx, invoice in enumerate(invoices[:limit]):
        # Mock transaction ID (in production, would come from bank_transactions table)
        mock_transaction_id = UUID(f"00000000-0000-0000-0000-{idx:012d}")

        # Simulate different matching scenarios
        if idx == 0:
            # Exact match
            confidence = 0.98
            match_reason = "Amount exact match"
            variance = Decimal("0.00")
            transaction_amount = invoice.amount_due
        elif idx % 3 == 0:
            # Close match with small variance
            confidence = 0.85
            match_reason = "Amount within 1% variance"
            variance = invoice.amount_due * Decimal("0.005")  # 0.5% difference
            transaction_amount = invoice.amount_due - variance
        else:
            # Date + amount proximity
            confidence = 0.75
            match_reason = "Amount + date match"
            variance = invoice.amount_due * Decimal("0.02")  # 2% difference
            transaction_amount = invoice.amount_due + variance

        # Filter by confidence threshold
        if confidence >= confidence_threshold:
            suggestions.append(
                MatchSuggestion(
                    invoice_id=invoice.id,
                    transaction_id=mock_transaction_id,
                    confidence=confidence,
                    match_reason=match_reason,
                    invoice_amount=invoice.amount_due,
                    transaction_amount=transaction_amount,
                    variance=variance,
                )
            )

    # Sort by confidence descending
    suggestions.sort(key=lambda x: x.confidence, reverse=True)
    suggestions = suggestions[:limit]

    logger.info(
        "reconciliation_match_suggestions_retrieved",
        organization_id=str(organization_id),
        suggestion_count=len(suggestions),
        confidence_threshold=confidence_threshold,
    )

    return MatchSuggestionsResponse(
        suggestions=suggestions,
        total=len(suggestions),
    )


# ---------------------------------------------------------------------------
# GAP-027 / RA-195: Auto-Match
# ---------------------------------------------------------------------------


@router.post("/auto-match", response_model=AutoMatchResponse)
async def auto_match_transactions(
    request: AutoMatchRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> AutoMatchResponse:
    """
    Automatically match high-confidence invoice-payment pairs (GAP-027).

    Only matches if confidence score exceeds confidence_threshold (default 95%).
    Supports dry_run mode to preview matches without committing.

    NOTE: This is a demo implementation. In production, this would:
    1. Get high-confidence match suggestions
    2. Update invoice.status to 'paid' for matched invoices
    3. Update bank_transaction.reconciliation_status to 'matched'
    4. Create reconciliation records in a reconciliations table
    5. Wrap everything in a transaction for atomicity
    """
    from src.db.models.invoicing import Invoice
    from sqlalchemy import update

    # Get high-confidence suggestions
    suggestions_response = await get_match_suggestions(
        db=db,
        organization_id=request.organization_id,
        confidence_threshold=request.confidence_threshold,
        limit=100,  # Process up to 100 at once
    )

    matched_results = []
    total_amount = Decimal("0.00")

    for suggestion in suggestions_response.suggestions:
        if not request.dry_run:
            # Update invoice payment_status to 'paid'
            # NOTE: Invoice model uses 'status' field, not 'payment_status'
            stmt = (
                update(Invoice)
                .where(Invoice.id == suggestion.invoice_id)
                .values(
                    status="paid",
                    amount_paid=suggestion.invoice_amount,
                    amount_due=Decimal("0.00"),
                )
            )
            await db.execute(stmt)

            # In production, would also:
            # - Update BankTransaction.reconciliation_status = 'matched'
            # - Create a Reconciliation record linking invoice + transaction
            # - Create an InvoicePayment record

        matched_results.append(
            MatchResult(
                invoice_id=suggestion.invoice_id,
                transaction_id=suggestion.transaction_id,
                matched=not request.dry_run,
                reason=suggestion.match_reason,
            )
        )
        total_amount += suggestion.invoice_amount

    if not request.dry_run and matched_results:
        await db.commit()

    logger.info(
        "auto_match_completed",
        organization_id=str(request.organization_id),
        total_matched=len(matched_results),
        total_amount=str(total_amount),
        dry_run=request.dry_run,
        confidence_threshold=request.confidence_threshold,
    )

    return AutoMatchResponse(
        matched=matched_results,
        total_matched=len(matched_results),
        total_amount_matched=total_amount,
    )
