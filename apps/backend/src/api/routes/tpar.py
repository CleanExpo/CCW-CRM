"""TPAR — Taxable Payments Annual Report (ATO requirement).

Covers businesses paying contractors in Australia.
FY2026: 1 Jul 2025 – 30 Jun 2026.

NOTE: The Supplier model has no `supplier_type` or `is_contractor` column.
All suppliers are returned; callers should filter by their own tagging
convention until a `supplier_type` column is added to the suppliers table.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.inventory_models import PurchaseOrder, Supplier

router = APIRouter(
    prefix="/api/tpar",
    tags=["TPAR"],
    dependencies=[Depends(get_current_user)],
)


def _fy_bounds(financial_year: int) -> tuple[datetime, datetime]:
    """Return (start, end) for an Australian financial year (Jul 1 – Jun 30)."""
    start = datetime(financial_year - 1, 7, 1, tzinfo=timezone.utc)
    end = datetime(financial_year, 6, 30, 23, 59, 59, tzinfo=timezone.utc)
    return start, end


def _supplier_to_dict(supplier: Supplier, total_paid: Decimal, gst: Decimal) -> dict:
    address_parts = filter(None, [supplier.address, supplier.city, supplier.state, supplier.postal_code])
    return {
        "name": supplier.company_name,
        "abn": supplier.abn,
        "total_paid_fy": float(total_paid),
        "gst_withheld": float(gst),
        "address": ", ".join(address_parts),
    }


# ─── GET /api/tpar/contractors ───────────────────────────────────────────────

@router.get("/contractors")
async def list_tpar_contractors(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    financial_year: int = Query(2026, ge=2020, le=2100),
) -> dict:
    """All suppliers with purchase-order payment totals for the financial year.

    No supplier_type column exists yet — all active suppliers are returned.
    Filter by ABN presence to approximate contractor status.
    """
    fy_start, fy_end = _fy_bounds(financial_year)

    result = await db.execute(
        select(
            Supplier,
            func.coalesce(func.sum(PurchaseOrder.subtotal), Decimal("0")).label("total_paid"),
            func.coalesce(func.sum(PurchaseOrder.tax), Decimal("0")).label("gst_total"),
        )
        .outerjoin(
            PurchaseOrder,
            (PurchaseOrder.supplier_id == Supplier.id)
            & (PurchaseOrder.order_date >= fy_start)
            & (PurchaseOrder.order_date <= fy_end)
            & (PurchaseOrder.status.in_(["received", "approved", "ordered"])),
        )
        .where(Supplier.is_active == True)  # noqa: E712
        .group_by(Supplier.id)
        .order_by(Supplier.company_name)
    )

    rows = result.all()
    return {
        "financial_year": financial_year,
        "suppliers": [_supplier_to_dict(row[0], row[1], row[2]) for row in rows],
    }


# ─── GET /api/tpar/report ────────────────────────────────────────────────────

@router.get("/report")
async def tpar_report(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    financial_year: int = Query(2026, ge=2020, le=2100),
) -> dict:
    """TPAR summary grouped by supplier for the given financial year."""
    fy_start, fy_end = _fy_bounds(financial_year)
    fy_label = f"FY{financial_year} ({fy_start.strftime('%d %b %Y')} – {fy_end.strftime('%d %b %Y')})"

    result = await db.execute(
        select(
            Supplier,
            func.coalesce(func.sum(PurchaseOrder.subtotal), Decimal("0")).label("total_paid"),
            func.coalesce(func.sum(PurchaseOrder.tax), Decimal("0")).label("gst_total"),
            func.count(PurchaseOrder.id).label("invoice_count"),
        )
        .outerjoin(
            PurchaseOrder,
            (PurchaseOrder.supplier_id == Supplier.id)
            & (PurchaseOrder.order_date >= fy_start)
            & (PurchaseOrder.order_date <= fy_end)
            & (PurchaseOrder.status.in_(["received", "approved", "ordered"])),
        )
        .where(Supplier.is_active == True)  # noqa: E712
        .group_by(Supplier.id)
        .having(func.coalesce(func.sum(PurchaseOrder.subtotal), Decimal("0")) > 0)
        .order_by(func.sum(PurchaseOrder.subtotal).desc())
    )

    rows = result.all()
    entries = [
        {**_supplier_to_dict(row[0], row[1], row[2]), "invoice_count": row[3]}
        for row in rows
    ]
    grand_total = sum(e["total_paid_fy"] for e in entries)
    grand_gst = sum(e["gst_withheld"] for e in entries)

    return {
        "financial_year": financial_year,
        "period": fy_label,
        "supplier_count": len(entries),
        "grand_total_paid": round(grand_total, 2),
        "grand_total_gst": round(grand_gst, 2),
        "entries": entries,
    }


# ─── POST /api/tpar/export ───────────────────────────────────────────────────

@router.post("/export")
async def tpar_export(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    financial_year: int = Query(2026, ge=2020, le=2100),
) -> dict:
    """Return a JSON payload structured for ATO TPAR lodgement.

    The ATO TPAR schema requires payee records with ABN, name, address,
    total gross payments, and total tax withheld for the financial year.
    """
    report = await tpar_report(db, financial_year)

    payees = []
    for e in report["entries"]:
        payees.append({
            "payeeAbn": (e["abn"] or "").replace(" ", ""),
            "payeeName": e["name"],
            "payeeAddress": e["address"],
            "grossPayments": e["total_paid_fy"],
            "taxWithheld": e["gst_withheld"],
        })

    return {
        "reportType": "TPAR",
        "financialYear": financial_year,
        "payerAbn": None,  # populate from org settings
        "payerName": None,  # populate from org settings
        "payees": payees,
        "totals": {
            "grossPayments": report["grand_total_paid"],
            "taxWithheld": report["grand_total_gst"],
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
