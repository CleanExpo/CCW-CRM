"""Bank Feed API endpoints for reconciliation."""

from datetime import date, timedelta
from typing import Annotated
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
from src.services.reconciliation_alerts import ReconciliationAlertsService

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
    account_id: UUID | None = Query(None, description="Filter by account"),
    start_date: date | None = Query(None, description="Start date"),
    end_date: date | None = Query(None, description="End date"),
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


class BankAccountCreate(BaseModel):
    """Create a new bank account."""

    account_name: str
    account_number: str
    bsb: str = Field(..., pattern=r"^\d{3}-\d{3}$", description="BSB format: XXX-XXX")
    bank_name: str
    account_type: str = Field(default="checking", pattern="^(checking|savings|credit)$")
    feed_provider: str = Field(default="manual", pattern="^(xero|yodlee|basiq|manual)$")
    location_code: str | None = None


class BankAccountUpdate(BaseModel):
    """Update a bank account."""

    account_name: str | None = None
    account_number: str | None = None
    bsb: str | None = Field(None, pattern=r"^\d{3}-\d{3}$", description="BSB format: XXX-XXX")
    bank_name: str | None = None
    account_type: str | None = Field(None, pattern="^(checking|savings|credit)$")
    feed_provider: str | None = Field(None, pattern="^(xero|yodlee|basiq|manual)$")
    location_code: str | None = None
    is_active: bool | None = None


@router.post("/accounts", response_model=dict, status_code=201)
async def create_bank_account(
    data: BankAccountCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Create a new bank account."""
    account = BankAccount(
        account_name=data.account_name,
        account_number=data.account_number,
        bsb=data.bsb,
        bank_name=data.bank_name,
        account_type=data.account_type,
        feed_provider=data.feed_provider,
        location_code=data.location_code,
        is_active=True,
    )

    db.add(account)
    await db.commit()
    await db.refresh(account)

    return {
        "id": account.id,
        "account_name": account.account_name,
        "account_number": account.account_number[-4:],
        "bsb": account.bsb,
        "bank_name": account.bank_name,
        "account_type": account.account_type,
        "feed_provider": account.feed_provider,
        "location_code": account.location_code,
        "is_active": account.is_active,
    }


@router.put("/accounts/{account_id}", response_model=dict)
async def update_bank_account(
    account_id: UUID,
    data: BankAccountUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Update a bank account."""
    result = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if data.account_name is not None:
        account.account_name = data.account_name
    if data.account_number is not None:
        account.account_number = data.account_number
    if data.bsb is not None:
        account.bsb = data.bsb
    if data.bank_name is not None:
        account.bank_name = data.bank_name
    if data.account_type is not None:
        account.account_type = data.account_type
    if data.feed_provider is not None:
        account.feed_provider = data.feed_provider
    if data.location_code is not None:
        account.location_code = data.location_code
    if data.is_active is not None:
        account.is_active = data.is_active

    await db.commit()
    await db.refresh(account)

    return {
        "id": account.id,
        "account_name": account.account_name,
        "account_number": account.account_number[-4:],
        "bsb": account.bsb,
        "bank_name": account.bank_name,
        "account_type": account.account_type,
        "feed_provider": account.feed_provider,
        "location_code": account.location_code,
        "is_active": account.is_active,
    }


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_bank_account(
    account_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a bank account (soft delete by setting is_active=False)."""
    result = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # Soft delete
    account.is_active = False
    await db.commit()


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


@router.get("/alerts")
async def get_reconciliation_alerts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    account_id: UUID | None = Query(None, description="Filter by bank account"),
) -> list[dict]:
    """
    Get active reconciliation alerts.

    Checks for:
    - High count of unmatched transactions
    - Large unmatched amounts (>$1000)
    - Old unmatched transactions (>7 days)
    - Total unmatched exceeding threshold (>$5000)
    - POS transactions missing Xero invoices

    Returns list of alerts with severity (info, warning, critical).
    """
    try:
        alerts_service = ReconciliationAlertsService(db)
        alerts = await alerts_service.check_reconciliation_alerts(account_id=account_id)

        return [
            {
                "type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "description": alert.description,
                "affected_count": alert.affected_count,
                "total_amount": float(alert.total_amount),
                "details": alert.details,
                "created_at": alert.created_at.isoformat(),
            }
            for alert in alerts
        ]

    except Exception as e:
        logger.error("Failed to get reconciliation alerts", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve alerts")


@router.get("/daily-summary")
async def get_daily_reconciliation_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    report_date: date | None = Query(None, description="Date for report (defaults to today)"),
) -> dict:
    """
    Get daily reconciliation summary report.

    Includes:
    - POS transaction statistics
    - Bank feed match statistics
    - Active alerts
    - Overall health status

    Perfect for daily email reports to accounting team.
    """
    try:
        alerts_service = ReconciliationAlertsService(db)
        summary = await alerts_service.get_daily_reconciliation_summary(report_date=report_date)

        return summary

    except Exception as e:
        logger.error("Failed to get daily summary", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve daily summary")


class BulkReconcileRequest(BaseModel):
    """Request to bulk reconcile multiple transactions."""

    matches: list[dict] = Field(
        ..., description="List of {bank_feed_id, pos_transaction_id} pairs"
    )


@router.post("/bulk-reconcile")
async def bulk_reconcile_transactions(
    request: BulkReconcileRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """
    Bulk reconcile multiple bank feed transactions with POS transactions.

    Processes multiple reconciliations in a single request.
    Returns count of successful and failed reconciliations.
    """
    service = BankFeedService(db)
    success_count = 0
    failed_count = 0
    errors = []

    for match in request.matches:
        try:
            bank_feed_id = UUID(match["bank_feed_id"])
            pos_transaction_id = UUID(match["pos_transaction_id"])

            await service.manual_reconcile(
                feed_id=bank_feed_id,
                pos_transaction_id=pos_transaction_id,
                user_id=current_user.id,
            )
            success_count += 1

        except Exception as e:
            failed_count += 1
            errors.append(
                {
                    "bank_feed_id": match.get("bank_feed_id"),
                    "pos_transaction_id": match.get("pos_transaction_id"),
                    "error": str(e),
                }
            )

    return {
        "success": True,
        "matched_count": success_count,
        "failed_count": failed_count,
        "errors": errors if errors else [],
    }


@router.get("/export")
async def export_reconciliation_data(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    account_id: UUID | None = Query(None, description="Filter by account"),
    start_date: date | None = Query(None, description="Start date"),
    end_date: date | None = Query(None, description="End date"),
    status: str | None = Query(None, description="matched, unmatched, all"),
) -> dict:
    """
    Export reconciliation data as CSV.

    Returns CSV data with columns:
    - Date, Bank Transaction ID, POS Transaction ID, Amount, Status, Discrepancy, Notes
    """
    import csv
    import io

    from src.db.pos_models import POSTransaction

    # Build query for bank feeds
    query = select(BankFeed)

    if account_id:
        query = query.where(BankFeed.bank_account_id == account_id)
    if start_date:
        query = query.where(BankFeed.transaction_date >= start_date)
    if end_date:
        query = query.where(BankFeed.transaction_date <= end_date)
    if status == "matched":
        query = query.where(BankFeed.match_status.in_(["auto_matched", "manual_matched"]))
    elif status == "unmatched":
        query = query.where(BankFeed.match_status == "pending")

    query = query.order_by(BankFeed.transaction_date.desc())

    result = await db.execute(query)
    feeds = result.scalars().all()

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Date",
        "Bank Transaction ID",
        "Description",
        "Amount",
        "POS Transaction ID",
        "Match Status",
        "Discrepancy",
        "Notes",
    ])

    # Rows
    for feed in feeds:
        amount = float(feed.credit) if feed.credit else float(-feed.debit) if feed.debit else 0
        discrepancy = ""

        if feed.pos_transaction_id:
            # Get POS transaction to calculate discrepancy
            pos_result = await db.execute(
                select(POSTransaction).where(POSTransaction.id == feed.pos_transaction_id)
            )
            pos_trans = pos_result.scalar_one_or_none()
            if pos_trans:
                discrepancy = f"{abs(float(pos_trans.amount) - abs(amount)):.2f}"

        writer.writerow([
            feed.transaction_date.isoformat(),
            str(feed.id),
            feed.description,
            f"{amount:.2f}",
            str(feed.pos_transaction_id) if feed.pos_transaction_id else "",
            feed.match_status,
            discrepancy,
            feed.reference or "",
        ])

    csv_data = output.getvalue()

    # Return as plain text (frontend will handle download)
    from fastapi.responses import Response

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=reconciliation-{date.today()}.csv"},
    )


# ========== Phase 1: Webhook Support ==========


class WebhookPayload(BaseModel):
    """Webhook payload from bank feed provider."""

    account_id: str = Field(..., description="Provider's account ID")
    event_type: str = Field(..., description="Event type (e.g., 'transaction.created')")
    data: dict = Field(..., description="Event data from provider")
    signature: str | None = Field(None, description="HMAC signature for verification")


@router.post("/webhook/{provider}")
async def bank_feed_webhook(
    provider: str,
    payload: WebhookPayload,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Webhook endpoint for real-time bank feed notifications (Phase 1).

    Supported providers:
    - xero
    - yodlee
    - basiq

    Security:
    - Verifies HMAC signature
    - Requires webhook_enabled = TRUE on account
    - Rate limited (TODO: implement rate limiting)
    """
    logger.info(
        "Received bank feed webhook",
        provider=provider,
        event_type=payload.event_type,
        account_id=payload.account_id,
    )

    # Find bank account by provider and feed_account_id
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.feed_provider == provider,
            BankAccount.feed_account_id == payload.account_id,
            BankAccount.webhook_enabled == True,  # noqa: E712
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        logger.warning(
            "Bank account not found or webhooks disabled",
            provider=provider,
            account_id=payload.account_id,
        )
        raise HTTPException(
            status_code=404,
            detail="Bank account not found or webhooks not enabled",
        )

    # Verify HMAC signature
    if account.webhook_secret:
        if not payload.signature:
            logger.warning("Webhook signature missing")
            raise HTTPException(status_code=401, detail="Signature required")

        if not _verify_webhook_signature(
            payload.data, payload.signature, account.webhook_secret
        ):
            logger.warning("Invalid webhook signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Trigger immediate sync for this account
    try:
        service = BankFeedService(db)

        # Sync last 7 days (webhook triggers catch-up)
        end_date = date.today()
        start_date = end_date - timedelta(days=7)

        sync_result = await service.sync_bank_feeds(
            account_id=account.id,
            start_date=start_date,
            end_date=end_date,
        )

        logger.info(
            "Webhook triggered sync completed",
            account_id=str(account.id),
            transactions_synced=sync_result["transactions_synced"],
        )

        # Track webhook success metric
        metrics.bank_feed_webhook_received.labels(provider=provider).inc()

        return {
            "status": "success",
            "account_id": str(account.id),
            "transactions_synced": sync_result["transactions_synced"],
            "event_type": payload.event_type,
        }

    except Exception as e:
        logger.error(
            "Webhook sync failed",
            account_id=str(account.id),
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


def _verify_webhook_signature(data: dict, signature: str, secret: str) -> bool:
    """
    Verify HMAC-SHA256 signature for webhook.

    Args:
        data: Webhook payload data
        signature: Provided signature (hex-encoded)
        secret: Webhook secret

    Returns:
        True if signature is valid
    """
    import hashlib
    import hmac
    import json

    # Serialize data to consistent JSON string
    payload_str = json.dumps(data, sort_keys=True, separators=(",", ":"))

    # Calculate expected signature
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        payload_str.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison
    return hmac.compare_digest(expected_signature, signature)
