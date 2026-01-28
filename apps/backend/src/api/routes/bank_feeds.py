"""Bank Feed API endpoints for reconciliation."""

from datetime import date, timedelta
from typing import Annotated, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.pos_models import BankAccount, BankFeed
from src.monitoring import metrics
from src.services.bank_feed_service import BankFeedService

router = APIRouter(prefix="/api/bank-feeds", tags=["Bank Feeds"])
logger = structlog.get_logger(__name__)


class BankFeedSyncRequest(BaseModel):
    """Request to sync bank feeds."""

    account_id: UUID | None = Field(None, description="Specific account to sync, or None for all")
    start_date: date | None = Field(None, description="Start date (defaults to 7 days ago)")
    end_date: date | None = Field(None, description="End date (defaults to today)")


class BankFeedSyncResponse(BaseModel):
    """Response from bank feed sync."""

    transactions_synced: int
    provider: str
    start_date: str
    end_date: str


class ReconciliationRequest(BaseModel):
    """Request to manually reconcile a bank feed."""

    feed_id: UUID
    pos_transaction_id: UUID


class ReconciliationResponse(BaseModel):
    """Response from reconciliation."""

    feed_id: UUID
    pos_transaction_id: UUID
    status: str


@router.post("/sync", response_model=BankFeedSyncResponse)
async def sync_bank_feeds(
    request: BankFeedSyncRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BankFeedSyncResponse:
    """
    Sync bank feed data for a specific account or all accounts.

    Supports:
    - Xero bank feeds
    - Yodlee aggregation
    - Basiq open banking

    After syncing, automatically attempts to match transactions.
    """
    service = BankFeedService(db)

    # Default date range: last 7 days
    end_date = request.end_date or date.today()
    start_date = request.start_date or (end_date - timedelta(days=7))

    try:
        if request.account_id:
            # Sync specific account
            result = await service.sync_bank_feeds(
                account_id=request.account_id,
                start_date=start_date,
                end_date=end_date,
            )

            # Track successful sync
            metrics.bank_feed_sync_success.labels(provider=result.get("provider", "xero")).inc()

            return BankFeedSyncResponse(**result)
        else:
            # Sync all active accounts
            result = await db.execute(
                select(BankAccount).where(
                    BankAccount.is_active == True,  # noqa: E712
                    BankAccount.feed_provider.isnot(None),
                    BankAccount.feed_provider != "manual",
                )
            )
            accounts = result.scalars().all()

            total_transactions = 0
            successful_syncs = 0
            failed_syncs = 0
            for account in accounts:
                try:
                    sync_result = await service.sync_bank_feeds(
                        account_id=account.id,
                        start_date=start_date,
                        end_date=end_date,
                    )
                    total_transactions += sync_result["transactions_synced"]
                    successful_syncs += 1
                    # Track successful sync per provider
                    metrics.bank_feed_sync_success.labels(
                        provider=account.feed_provider or "xero"
                    ).inc()
                except Exception as e:
                    failed_syncs += 1
                    # Track failed sync
                    metrics.bank_feed_sync_failures.labels(
                        provider=account.feed_provider or "xero"
                    ).inc()
                    logger.error(
                        "Failed to sync account",
                        account_id=str(account.id),
                        error=str(e),
                    )

            return BankFeedSyncResponse(
                transactions_synced=total_transactions,
                provider="multiple",
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
            )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.post("/reconcile", response_model=ReconciliationResponse)
async def reconcile_bank_feed(
    request: ReconciliationRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReconciliationResponse:
    """
    Manually reconcile a bank feed transaction with a POS transaction.

    Validates:
    - Amounts match (within tolerance)
    - Both records exist
    - Not already reconciled
    """
    service = BankFeedService(db)

    try:
        result = await service.manual_reconcile(
            feed_id=request.feed_id,
            pos_transaction_id=request.pos_transaction_id,
            user_id=current_user.id,
        )

        return ReconciliationResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation failed: {str(e)}")


@router.get("/unreconciled")
async def list_unreconciled_feeds(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    account_id: Optional[UUID] = Query(None, description="Filter by account"),
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
) -> list[dict]:
    """
    List unreconciled bank feed transactions.

    Used by accounts team to identify transactions needing manual review.
    """
    query = select(BankFeed).where(BankFeed.match_status == "pending")

    if account_id:
        query = query.where(BankFeed.bank_account_id == account_id)

    if start_date:
        query = query.where(BankFeed.transaction_date >= start_date)

    if end_date:
        query = query.where(BankFeed.transaction_date <= end_date)

    query = query.order_by(BankFeed.transaction_date.desc()).limit(100)

    result = await db.execute(query)
    feeds = result.scalars().all()

    return [
        {
            "id": feed.id,
            "bank_account_id": feed.bank_account_id,
            "transaction_date": feed.transaction_date.isoformat(),
            "description": feed.description,
            "reference": feed.reference,
            "credit": float(feed.credit) if feed.credit else None,
            "debit": float(feed.debit) if feed.debit else None,
            "balance": float(feed.balance) if feed.balance else None,
        }
        for feed in feeds
    ]


@router.get("/accounts")
async def list_bank_accounts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    """List all active bank accounts."""
    result = await db.execute(select(BankAccount).where(BankAccount.is_active == True))
    accounts = result.scalars().all()

    return [
        {
            "id": account.id,
            "account_name": account.account_name,
            "account_number": account.account_number[-4:],  # Last 4 digits only
            "bank_name": account.bank_name,
            "location_code": account.location_code,
            "feed_provider": account.feed_provider,
            "last_feed_sync_at": (
                account.last_feed_sync_at.isoformat() if account.last_feed_sync_at else None
            ),
        }
        for account in accounts
    ]


@router.get("/stats")
async def get_reconciliation_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    account_id: UUID | None = Query(None, description="Filter by bank account"),
    start_date: date | None = Query(None, description="Start date"),
    end_date: date | None = Query(None, description="End date"),
) -> dict:
    """
    Get reconciliation statistics.

    Returns:
    - Total transactions
    - Auto-matched count
    - Manually matched count
    - Unmatched count
    - Reconciliation rate
    """
    try:
        # Default date range: last 30 days
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Build query
        query = select(
            func.count(BankFeed.id).label("total"),
            func.count(BankFeed.id).filter(BankFeed.match_status == "auto_matched").label("auto_matched"),
            func.count(BankFeed.id).filter(BankFeed.match_status == "manual_matched").label("manual_matched"),
            func.count(BankFeed.id).filter(BankFeed.match_status == "pending").label("unmatched"),
        ).where(
            and_(
                BankFeed.transaction_date >= start_date,
                BankFeed.transaction_date <= end_date,
            )
        )

        if account_id:
            query = query.where(BankFeed.bank_account_id == account_id)

        result = await db.execute(query)
        row = result.one()

        total = row.total or 0
        auto_matched = row.auto_matched or 0
        manual_matched = row.manual_matched or 0
        unmatched = row.unmatched or 0

        matched = auto_matched + manual_matched
        reconciliation_rate = (matched / total * 100) if total > 0 else 0

        return {
            "total_transactions": total,
            "auto_matched": auto_matched,
            "manual_matched": manual_matched,
            "unmatched": unmatched,
            "reconciliation_rate": round(reconciliation_rate, 1),
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        }

    except Exception as e:
        logger.error("Failed to get reconciliation stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")
