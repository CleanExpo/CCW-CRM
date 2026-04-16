"""End-of-day cash reconciliation endpoints (UNI-1849)."""
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.pos_models import POSTransaction

router = APIRouter(prefix="/api/pos", tags=["POS EOD Reconciliation"])

_CASH_STATUSES = ("captured", "completed")


class EODReconciliationRequest(BaseModel):
    location_code: str
    date: date
    counted_cash: Decimal


class EODReconciliationResponse(BaseModel):
    date: date
    location_code: str
    system_cash_total: Decimal
    counted_cash: Decimal
    variance: Decimal
    transaction_count: int
    status: str  # "balanced" | "discrepancy"


class EODSummaryRow(BaseModel):
    date: date
    location_code: str
    system_cash_total: Decimal
    transaction_count: int


@router.post("/eod-reconciliation", response_model=EODReconciliationResponse)
async def eod_reconciliation(
    payload: EODReconciliationRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> EODReconciliationResponse:
    """Compare system cash totals against counted cash for a location and date."""
    result = await db.execute(
        select(
            func.coalesce(func.sum(POSTransaction.amount), Decimal("0")).label("total"),
            func.count(POSTransaction.id).label("count"),
        ).where(
            POSTransaction.location_code == payload.location_code,
            func.date(POSTransaction.created_at) == payload.date,
            POSTransaction.payment_method == "cash",
            POSTransaction.payment_status.in_(_CASH_STATUSES),
        )
    )
    row = result.one()
    system_total = Decimal(str(row.total)).quantize(Decimal("0.01"))
    variance = (payload.counted_cash - system_total).quantize(Decimal("0.01"))
    return EODReconciliationResponse(
        date=payload.date,
        location_code=payload.location_code,
        system_cash_total=system_total,
        counted_cash=payload.counted_cash.quantize(Decimal("0.01")),
        variance=variance,
        transaction_count=int(row.count),
        status="balanced" if abs(variance) < Decimal("0.01") else "discrepancy",
    )


@router.get("/eod-reconciliation/summary", response_model=list[EODSummaryRow])
async def eod_reconciliation_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    location_code: str = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
) -> list[EODSummaryRow]:
    """Aggregate daily cash totals for a location over a date range."""
    tx_date = func.date(POSTransaction.created_at).label("tx_date")
    result = await db.execute(
        select(
            tx_date,
            func.coalesce(func.sum(POSTransaction.amount), Decimal("0")).label("total"),
            func.count(POSTransaction.id).label("count"),
        )
        .where(
            POSTransaction.location_code == location_code,
            func.date(POSTransaction.created_at) >= date_from,
            func.date(POSTransaction.created_at) <= date_to,
            POSTransaction.payment_method == "cash",
            POSTransaction.payment_status.in_(_CASH_STATUSES),
        )
        .group_by(tx_date)
        .order_by(tx_date)
    )
    return [
        EODSummaryRow(
            date=r.tx_date,
            location_code=location_code,
            system_cash_total=Decimal(str(r.total)).quantize(Decimal("0.01")),
            transaction_count=int(r.count),
        )
        for r in result.all()
    ]
