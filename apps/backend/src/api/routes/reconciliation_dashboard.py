"""
Reconciliation Dashboard API endpoints (Phase 3).

Provides aggregated views and bulk operations for bank feed reconciliation.
"""

from datetime import date, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.specialized.reconciliation_agent import ReconciliationAgent
from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.pos_models import BankAccount, BankFeed
from src.monitoring import metrics
from src.services.bank_feed_service import BankFeedService

router = APIRouter(prefix="/api/reconciliation", tags=["Reconciliation Dashboard"])
logger = structlog.get_logger(__name__)


# ========== Response Models ==========


class DashboardSummary(BaseModel):
    """Dashboard summary statistics."""

    total_pending: int = Field(..., description="Total pending bank feeds")
    total_matched: int = Field(..., description="Total matched feeds")
    total_with_suggestions: int = Field(..., description="Feeds with AI suggestions")
    auto_match_rate: float = Field(..., description="Auto-match rate (0.0-1.0)")
    pending_amount: float = Field(..., description="Total pending amount (AUD)")
    matched_today: int = Field(..., description="Feeds matched today")
    last_sync_at: datetime | None = Field(None, description="Last sync timestamp")


class PendingFeedItem(BaseModel):
    """Pending bank feed with suggestions."""

    feed_id: str
    transaction_date: date
    description: str | None
    reference: str | None
    amount: float
    bank_account_name: str
    match_suggestions: list[dict] = Field(default_factory=list)
    created_at: datetime


class BulkApproveRequest(BaseModel):
    """Request to bulk approve suggested matches."""

    approvals: list[dict] = Field(
        ...,
        description="List of {feed_id, pos_transaction_id} to approve",
    )


class BulkApproveResponse(BaseModel):
    """Response from bulk approval."""

    approved: int
    failed: int
    errors: list[dict] = Field(default_factory=list)


# ========== Endpoints ==========


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    account_id: UUID | None = Query(None, description="Filter by bank account"),
) -> DashboardSummary:
    """
    Get reconciliation dashboard summary statistics.

    Returns:
    - Total pending/matched feeds
    - Auto-match rate
    - Pending amount
    - Feeds matched today
    - Last sync timestamp
    """
    # Base query filter
    base_filter = []
    if account_id:
        base_filter.append(BankFeed.bank_account_id == account_id)

    # Total pending feeds
    pending_query = select(func.count()).select_from(BankFeed).where(
        BankFeed.match_status == "pending",
        *base_filter,
    )
    pending_result = await db.execute(pending_query)
    total_pending = pending_result.scalar() or 0

    # Total matched feeds (all time)
    matched_query = select(func.count()).select_from(BankFeed).where(
        BankFeed.match_status.in_(["auto_matched", "manual_matched"]),
        *base_filter,
    )
    matched_result = await db.execute(matched_query)
    total_matched = matched_result.scalar() or 0

    # Feeds with AI suggestions
    suggestions_query = select(func.count()).select_from(BankFeed).where(
        BankFeed.match_status == "pending",
        BankFeed.match_suggestions.isnot(None),
        func.jsonb_array_length(BankFeed.match_suggestions) > 0,
        *base_filter,
    )
    suggestions_result = await db.execute(suggestions_query)
    total_with_suggestions = suggestions_result.scalar() or 0

    # Calculate auto-match rate
    if total_matched + total_pending > 0:
        auto_matched_query = select(func.count()).select_from(BankFeed).where(
            BankFeed.match_status == "auto_matched",
            *base_filter,
        )
        auto_matched_result = await db.execute(auto_matched_query)
        auto_matched = auto_matched_result.scalar() or 0
        auto_match_rate = auto_matched / (total_matched + total_pending)
    else:
        auto_match_rate = 0.0

    # Total pending amount
    pending_amount_query = select(func.sum(BankFeed.credit)).select_from(BankFeed).where(
        BankFeed.match_status == "pending",
        BankFeed.credit.isnot(None),
        *base_filter,
    )
    pending_amount_result = await db.execute(pending_amount_query)
    pending_amount = float(pending_amount_result.scalar() or 0.0)

    # Matched today
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    matched_today_query = select(func.count()).select_from(BankFeed).where(
        BankFeed.match_status.in_(["auto_matched", "manual_matched"]),
        BankFeed.matched_at >= today_start,
        *base_filter,
    )
    matched_today_result = await db.execute(matched_today_query)
    matched_today = matched_today_result.scalar() or 0

    # Last sync timestamp
    if account_id:
        account_result = await db.execute(
            select(BankAccount.last_feed_sync_at).where(BankAccount.id == account_id)
        )
        last_sync_at = account_result.scalar_one_or_none()
    else:
        # Get most recent sync across all accounts
        last_sync_query = select(func.max(BankAccount.last_feed_sync_at)).select_from(
            BankAccount
        )
        last_sync_result = await db.execute(last_sync_query)
        last_sync_at = last_sync_result.scalar()

    # Update Prometheus gauge
    metrics.bank_feed_auto_match_rate.set(auto_match_rate)
    metrics.bank_feed_pending_count.labels(
        account=str(account_id) if account_id else "all"
    ).set(total_pending)

    return DashboardSummary(
        total_pending=total_pending,
        total_matched=total_matched,
        total_with_suggestions=total_with_suggestions,
        auto_match_rate=auto_match_rate,
        pending_amount=pending_amount,
        matched_today=matched_today,
        last_sync_at=last_sync_at,
    )


@router.get("/pending", response_model=list[PendingFeedItem])
async def get_pending_feeds(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    account_id: UUID | None = Query(None, description="Filter by bank account"),
    with_suggestions_only: bool = Query(False, description="Only show feeds with AI suggestions"),
    limit: int = Query(50, ge=1, le=200, description="Max results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> list[PendingFeedItem]:
    """
    Get pending bank feeds with AI match suggestions.

    Use this to populate the reconciliation review table.
    """
    # Build query
    query = (
        select(BankFeed, BankAccount.account_name)
        .join(BankAccount, BankFeed.bank_account_id == BankAccount.id)
        .where(BankFeed.match_status == "pending")
    )

    if account_id:
        query = query.where(BankFeed.bank_account_id == account_id)

    if with_suggestions_only:
        query = query.where(
            BankFeed.match_suggestions.isnot(None),
            func.jsonb_array_length(BankFeed.match_suggestions) > 0,
        )

    # Order by date (newest first) and apply pagination
    query = query.order_by(BankFeed.transaction_date.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.all()

    # Format response
    pending_feeds = []
    for feed, account_name in rows:
        pending_feeds.append(
            PendingFeedItem(
                feed_id=str(feed.id),
                transaction_date=feed.transaction_date,
                description=feed.description,
                reference=feed.reference,
                amount=float(feed.credit) if feed.credit else 0.0,
                bank_account_name=account_name,
                match_suggestions=feed.match_suggestions or [],
                created_at=feed.created_at,
            )
        )

    return pending_feeds


@router.post("/bulk-approve", response_model=BulkApproveResponse)
async def bulk_approve_matches(
    request: BulkApproveRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BulkApproveResponse:
    """
    Bulk approve AI-suggested matches.

    Approves multiple feed-to-transaction matches in one operation.
    Useful for batch processing high-confidence suggestions.
    """
    service = BankFeedService(db)
    approved = 0
    failed = 0
    errors = []

    for approval in request.approvals:
        feed_id = UUID(approval["feed_id"])
        pos_transaction_id = UUID(approval["pos_transaction_id"])

        try:
            await service.manual_reconcile(
                feed_id=feed_id,
                pos_transaction_id=pos_transaction_id,
                user_id=current_user.id,
            )
            approved += 1

            logger.info(
                "Bulk approval success",
                feed_id=str(feed_id),
                pos_transaction_id=str(pos_transaction_id),
                user_id=str(current_user.id),
            )

        except Exception as e:
            failed += 1
            error_msg = str(e)
            errors.append({
                "feed_id": str(feed_id),
                "pos_transaction_id": str(pos_transaction_id),
                "error": error_msg,
            })

            logger.error(
                "Bulk approval failed",
                feed_id=str(feed_id),
                pos_transaction_id=str(pos_transaction_id),
                error=error_msg,
            )

    logger.info(
        "Bulk approval completed",
        total=len(request.approvals),
        approved=approved,
        failed=failed,
    )

    return BulkApproveResponse(
        approved=approved,
        failed=failed,
        errors=errors if errors else [],
    )


@router.post("/generate-suggestions/{account_id}")
async def generate_suggestions_for_account(
    account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    max_feeds: int = Query(50, ge=1, le=200, description="Max feeds to process"),
) -> dict:
    """
    Manually trigger AI suggestion generation for pending feeds.

    Useful for re-generating suggestions after adjusting matching logic
    or processing a backlog of pending feeds.
    """
    # Verify account exists
    account_result = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id)
    )
    account = account_result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # Generate suggestions
    agent = ReconciliationAgent(db)
    result = await agent.bulk_generate_suggestions(
        account_id=account_id,
        max_feeds=max_feeds,
    )

    # Track metric
    metrics.bank_feed_suggestions_generated.inc(result["with_suggestions"])

    logger.info(
        "Manual suggestion generation completed",
        account_id=str(account_id),
        processed=result["processed"],
        with_suggestions=result["with_suggestions"],
    )

    return {
        "account_id": str(account_id),
        "account_name": account.account_name,
        **result,
    }
