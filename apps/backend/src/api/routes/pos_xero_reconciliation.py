"""POS-Xero reconciliation API endpoints.

Provides endpoints for automatic reconciliation between POS transactions,
bank feeds, and Xero invoices/payments.
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.config.xero_settings import XeroSettings, get_xero_settings
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.pos_reconciliation import POSXeroReconciliation

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/pos", tags=["POS Xero Reconciliation"], dependencies=[Depends(get_current_user)])


def get_xero_auth(settings: Annotated[XeroSettings, Depends(get_xero_settings)]) -> XeroAuth:
    """Dependency to get XeroAuth instance."""
    return XeroAuth(
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        redirect_uri=settings.redirect_uri,
        scopes=settings.scopes_list,
    )


def get_pos_xero_reconciliation(
    xero_auth: Annotated[XeroAuth, Depends(get_xero_auth)],
) -> POSXeroReconciliation:
    """Dependency to get POSXeroReconciliation instance."""
    return POSXeroReconciliation(xero_auth)


# ============================================
# Request/Response Models
# ============================================


class CreateInvoiceRequest(BaseModel):
    """Request to create Xero invoice from POS transaction."""

    pos_transaction_id: UUID = Field(..., description="POS transaction UUID")
    organization_id: UUID = Field(..., description="Organization UUID")


class CreateInvoiceResponse(BaseModel):
    """Response after creating Xero invoice."""

    success: bool
    pos_transaction_id: str
    transaction_number: str
    xero_invoice_id: str
    xero_invoice_number: str
    total: float
    already_exists: bool = False


class ReconcileRequest(BaseModel):
    """Request to reconcile POS transaction with bank feed."""

    pos_transaction_id: UUID = Field(..., description="POS transaction UUID")
    bank_feed_id: UUID = Field(..., description="Bank feed transaction UUID")
    organization_id: UUID = Field(..., description="Organization UUID")


class ReconcileResponse(BaseModel):
    """Response after reconciliation."""

    success: bool
    pos_transaction_id: str
    bank_feed_id: str
    xero_payment_id: str
    amount: float
    reconciliation_status: str


class AutoReconcileRequest(BaseModel):
    """Request to auto-reconcile unmatched transactions."""

    organization_id: UUID = Field(..., description="Organization UUID")
    days_back: int = Field(
        default=7,
        ge=1,
        le=30,
        description="Number of days to look back for matches",
    )


class AutoReconcileResponse(BaseModel):
    """Response after auto-reconciliation."""

    total_pos_transactions: int
    total_bank_feeds: int
    auto_matched: int
    suggested_matches: int
    errors: list[dict] | None = None


# ============================================
# API Endpoints
# ============================================


@router.post("/transactions/{transaction_id}/create-xero-invoice")
async def create_xero_invoice(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    reconciliation: Annotated[POSXeroReconciliation, Depends(get_pos_xero_reconciliation)],
    org_id: CurrentOrganization,
) -> CreateInvoiceResponse:
    """Create Xero invoice from POS transaction.

    This endpoint is called after a POS transaction is successfully captured.
    It creates a corresponding invoice in Xero and links it to the transaction.

    Args:
        transaction_id: POS transaction UUID
        db: Database session
        reconciliation: POS-Xero reconciliation service

    Returns:
        Invoice creation result

    Raises:
        HTTPException: If creation fails
    """
    try:
        organization_id = org_id

        result = await reconciliation.create_xero_invoice_from_pos_transaction(
            db=db,
            organization_id=organization_id,
            pos_transaction_id=transaction_id,
        )

        logger.info(
            "Created Xero invoice via API",
            transaction_id=str(transaction_id),
            xero_invoice_id=result.get("xero_invoice_id"),
        )

        return CreateInvoiceResponse(**result)

    except ValueError as e:
        logger.error(
            "Invalid request to create Xero invoice",
            transaction_id=str(transaction_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            "Failed to create Xero invoice",
            transaction_id=str(transaction_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Xero invoice: {str(e)}",
        )


@router.post("/reconcile")
async def reconcile_with_bank_feed(
    request: ReconcileRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    reconciliation: Annotated[POSXeroReconciliation, Depends(get_pos_xero_reconciliation)],
) -> ReconcileResponse:
    """Reconcile POS transaction with bank feed.

    Creates payment in Xero and marks both transactions as reconciled.
    This is typically called from the reconciliation dashboard when
    accounts team confirms a match.

    Args:
        request: Reconciliation request
        db: Database session
        reconciliation: POS-Xero reconciliation service

    Returns:
        Reconciliation result

    Raises:
        HTTPException: If reconciliation fails
    """
    try:
        result = await reconciliation.create_xero_payment_and_reconcile(
            db=db,
            organization_id=request.organization_id,
            pos_transaction_id=request.pos_transaction_id,
            bank_feed_id=request.bank_feed_id,
        )

        logger.info(
            "Reconciled via API",
            pos_transaction_id=str(request.pos_transaction_id),
            bank_feed_id=str(request.bank_feed_id),
            xero_payment_id=result.get("xero_payment_id"),
        )

        return ReconcileResponse(**result)

    except ValueError as e:
        logger.error(
            "Invalid reconciliation request",
            pos_transaction_id=str(request.pos_transaction_id),
            bank_feed_id=str(request.bank_feed_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            "Failed to reconcile",
            pos_transaction_id=str(request.pos_transaction_id),
            bank_feed_id=str(request.bank_feed_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reconcile: {str(e)}",
        )


@router.post("/auto-reconcile")
async def auto_reconcile(
    request: AutoReconcileRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    reconciliation: Annotated[POSXeroReconciliation, Depends(get_pos_xero_reconciliation)],
) -> AutoReconcileResponse:
    """Auto-reconcile unmatched POS transactions with bank feeds.

    Runs matching algorithm to find likely matches and creates Xero payments
    for high-confidence matches (≥80% confidence). Transactions with 60-80%
    confidence are marked as suggested matches for manual review.

    This endpoint can be:
    - Called manually by accounts team
    - Run on a schedule (e.g., daily cron job)
    - Triggered after bank feed sync

    Args:
        request: Auto-reconciliation request
        db: Database session
        reconciliation: POS-Xero reconciliation service

    Returns:
        Auto-reconciliation statistics

    Raises:
        HTTPException: If auto-reconciliation fails
    """
    try:
        result = await reconciliation.auto_reconcile_unmatched_transactions(
            db=db,
            organization_id=request.organization_id,
            days_back=request.days_back,
        )

        logger.info(
            "Auto-reconciliation completed via API",
            organization_id=str(request.organization_id),
            days_back=request.days_back,
            auto_matched=result["auto_matched"],
            suggested=result["suggested_matches"],
        )

        return AutoReconcileResponse(**result)

    except ValueError as e:
        logger.error(
            "Invalid auto-reconciliation request",
            organization_id=str(request.organization_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            "Failed to auto-reconcile",
            organization_id=str(request.organization_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to auto-reconcile: {str(e)}",
        )


@router.get("/reconciliation-stats")
async def get_reconciliation_stats(
    organization_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get reconciliation statistics for dashboard.

    Returns counts of:
    - Total POS transactions (last 30 days)
    - Reconciled transactions
    - Pending reconciliation
    - Suggested matches awaiting review

    Args:
        organization_id: Organization UUID
        db: Database session

    Returns:
        Reconciliation statistics
    """
    try:
        from datetime import datetime, timedelta

        from sqlalchemy import func, select

        from src.db.pos_models import BankFeed, POSTransaction

        cutoff_date = datetime.now() - timedelta(days=30)

        # Total POS transactions (last 30 days)
        total_stmt = select(func.count()).select_from(POSTransaction).where(
            POSTransaction.created_at >= cutoff_date,
            POSTransaction.payment_status == "captured",
        )
        total_result = await db.execute(total_stmt)
        total = total_result.scalar() or 0

        # Reconciled
        reconciled_stmt = total_stmt.where(
            POSTransaction.reconciliation_status == "matched"
        )
        reconciled_result = await db.execute(reconciled_stmt)
        reconciled = reconciled_result.scalar() or 0

        # Pending
        pending = total - reconciled

        # Suggested matches
        suggested_stmt = (
            select(func.count())
            .select_from(BankFeed)
            .where(
                BankFeed.match_status == "suggested",
                BankFeed.transaction_date >= cutoff_date.date(),
            )
        )
        suggested_result = await db.execute(suggested_stmt)
        suggested = suggested_result.scalar() or 0

        logger.info(
            "Retrieved reconciliation stats",
            organization_id=str(organization_id),
            total=total,
            reconciled=reconciled,
            pending=pending,
            suggested=suggested,
        )

        return {
            "total_pos_transactions": total,
            "reconciled": reconciled,
            "pending_reconciliation": pending,
            "suggested_matches": suggested,
            "reconciliation_rate": round((reconciled / total * 100) if total > 0 else 0, 1),
        }

    except Exception as e:
        logger.error(
            "Failed to get reconciliation stats",
            organization_id=str(organization_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get reconciliation stats: {str(e)}",
        )
