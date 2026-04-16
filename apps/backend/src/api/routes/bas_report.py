"""BAS (Business Activity Statement) report endpoint."""
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.models.invoicing import Invoice
from src.db.pos_models import POSTransaction

router = APIRouter(prefix="/api/bas-report", tags=["BAS Report"])

# Australian quarter date ranges (month boundaries, inclusive)
QUARTER_RANGES: dict[int, tuple[tuple[int, int], tuple[int, int]]] = {
    1: ((1, 1), (3, 31)),
    2: ((4, 1), (6, 30)),
    3: ((7, 1), (9, 30)),
    4: ((10, 1), (12, 31)),
}


class BASReport(BaseModel):
    quarter: int
    year: int
    period_start: date
    period_end: date
    g1_total_sales: Decimal
    g3_gst_free_sales: Decimal
    field_1a_gst_on_sales: Decimal
    g10_capital_purchases: Decimal
    field_1b_gst_on_purchases: Decimal
    net_gst_payable: Decimal
    pos_refund_adjustments: Decimal
    pos_refund_gst: Decimal
    adjusted_gst_payable: Decimal
    invoice_count: int
    pos_refund_count: int
    generated_at: datetime


@router.get("", response_model=BASReport)
async def get_bas_report(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
    quarter: int = Query(..., ge=1, le=4, description="Quarter (1–4)"),
    year: int = Query(..., ge=2000, le=2100, description="Calendar year"),
) -> BASReport:
    """Compute Australian BAS figures for the given quarter and year."""
    if quarter not in QUARTER_RANGES:
        raise HTTPException(status_code=400, detail="Quarter must be between 1 and 4.")

    (start_month, start_day), (end_month, end_day) = QUARTER_RANGES[quarter]
    period_start = date(year, start_month, start_day)
    period_end = date(year, end_month, end_day)

    # --- Invoice aggregates ---
    invoice_result = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.total_amount), 0).label("g1"),
            func.coalesce(func.sum(Invoice.tax_amount), 0).label("field_1a"),
            func.count(Invoice.id).label("invoice_count"),
        ).where(
            Invoice.status.in_(["sent", "partial", "paid"]),
            Invoice.invoice_date >= period_start,
            Invoice.invoice_date <= period_end,
        )
    )
    inv_row = invoice_result.one()
    g1_total_sales = Decimal(str(inv_row.g1))
    field_1a_gst_on_sales = Decimal(str(inv_row.field_1a))
    invoice_count: int = inv_row.invoice_count

    # --- POS refund aggregates ---
    pos_result = await db.execute(
        select(
            func.coalesce(func.sum(POSTransaction.amount), 0).label("refund_total"),
            func.count(POSTransaction.id).label("refund_count"),
        ).where(
            POSTransaction.transaction_type == "refund",
            POSTransaction.payment_status == "refunded",
            func.date(POSTransaction.created_at) >= period_start,
            func.date(POSTransaction.created_at) <= period_end,
        )
    )
    pos_row = pos_result.one()
    pos_refund_adjustments = Decimal(str(pos_row.refund_total))
    pos_refund_count: int = pos_row.refund_count

    # GST included in refund amount (tax fraction = 10/110)
    pos_refund_gst = (pos_refund_adjustments * Decimal("10") / Decimal("110")).quantize(
        Decimal("0.01")
    )

    # Placeholder fields
    g3_gst_free_sales = Decimal("0.00")
    g10_capital_purchases = Decimal("0.00")
    field_1b_gst_on_purchases = Decimal("0.00")

    net_gst_payable = field_1a_gst_on_sales - field_1b_gst_on_purchases
    adjusted_gst_payable = net_gst_payable - pos_refund_gst

    return BASReport(
        quarter=quarter,
        year=year,
        period_start=period_start,
        period_end=period_end,
        g1_total_sales=g1_total_sales,
        g3_gst_free_sales=g3_gst_free_sales,
        field_1a_gst_on_sales=field_1a_gst_on_sales,
        g10_capital_purchases=g10_capital_purchases,
        field_1b_gst_on_purchases=field_1b_gst_on_purchases,
        net_gst_payable=net_gst_payable,
        pos_refund_adjustments=pos_refund_adjustments,
        pos_refund_gst=pos_refund_gst,
        adjusted_gst_payable=adjusted_gst_payable,
        invoice_count=invoice_count,
        pos_refund_count=pos_refund_count,
        generated_at=datetime.now(UTC),
    )
