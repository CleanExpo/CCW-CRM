"""Bank Feed API endpoints for reconciliation."""

from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.pos_models import BankAccount, BankFeed
from src.services.bank_feed_service import BankFeedService

router = APIRouter(prefix="/api/bank-feeds", tags=["Bank Feeds"])


class BankFeedSyncRequest(BaseModel):
    """Request to sync bank feeds."""

    account_id: UUID
    start_date: date
    end_date: date


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
    Sync bank feed data for a specific account and date range.

    Supports:
    - Xero bank feeds
    - Yodlee aggregation
    - Basiq open banking

    After syncing, automatically attempts to match transactions.
    """
    service = BankFeedService(db)

    try:
        result = await service.sync_bank_feeds(
            account_id=request.account_id,
            start_date=request.start_date,
            end_date=request.end_date,
        )

        return BankFeedSyncResponse(**result)

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
