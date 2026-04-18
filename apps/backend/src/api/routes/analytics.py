"""Analytics metrics API endpoints.

Provides agent performance metrics, token usage, and cost tracking
for the dashboard-analytics page.

Also provides the AP Ageing report (GET /api/analytics/ap-ageing).
"""

import json
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import AIGeneratedContent
from src.db.inventory_models import PurchaseOrder, Supplier
from src.db.models import User

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Map time_range strings to timedelta
TIME_RANGE_MAP = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
}

# PO statuses that represent an outstanding financial obligation to a supplier.
# draft and cancelled are excluded — they carry no AP liability.
_AP_ACTIVE_STATUSES = frozenset(
    {"pending_approval", "approved", "ordered", "in_transit", "received"}
)


# ---------------------------------------------------------------------------
# AP Ageing — Pydantic response models
# ---------------------------------------------------------------------------


class APAgeingBuckets(BaseModel):
    """Totals per standard ageing bucket."""

    current_0_30: Decimal
    days_31_60: Decimal
    days_61_90: Decimal
    days_90_plus: Decimal


class APAgeingSupplierRow(BaseModel):
    """Per-supplier ageing breakdown."""

    supplier_id: str
    supplier_code: str
    company_name: str
    total_outstanding: Decimal
    current_0_30: Decimal
    days_31_60: Decimal
    days_61_90: Decimal
    days_90_plus: Decimal
    oldest_po_days: int
    po_count: int


class APAgeingReport(BaseModel):
    """Full AP ageing report response."""

    as_of_date: date
    total_outstanding: Decimal
    buckets: APAgeingBuckets
    suppliers: list[APAgeingSupplierRow]
    generated_at: datetime


# ---------------------------------------------------------------------------
# AP Ageing endpoint
# ---------------------------------------------------------------------------


@router.get("/ap-ageing", response_model=APAgeingReport)
async def get_ap_ageing(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
    as_of_date: date | None = Query(
        None,
        description="Ageing as-of date (YYYY-MM-DD). Defaults to today.",
    ),
) -> APAgeingReport:
    """Return AP ageing report bucketed by 0-30 / 31-60 / 61-90 / 90+ days.

    Liability is derived from PurchaseOrders whose status represents an
    outstanding commitment (pending_approval, approved, ordered, in_transit,
    received). Draft and cancelled POs are excluded.

    The PO ``order_date`` is used as the invoice reference date.  Where
    ``order_date`` is NULL the record's ``created_at`` timestamp is used as
    a fallback.
    """
    ref_date: date = as_of_date or datetime.now(UTC).date()
    ref_dt = datetime(ref_date.year, ref_date.month, ref_date.day, tzinfo=UTC)

    stmt = (
        select(PurchaseOrder, Supplier.supplier_code, Supplier.company_name)
        .join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
        .where(PurchaseOrder.status.in_(list(_AP_ACTIVE_STATUSES)))
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Accumulate per-supplier data using a nested defaultdict
    SupplierAccum = dict[str, object]
    supplier_data: dict[str, SupplierAccum] = defaultdict(
        lambda: {
            "supplier_id": "",
            "supplier_code": "",
            "company_name": "",
            "current_0_30": Decimal(0),
            "days_31_60": Decimal(0),
            "days_61_90": Decimal(0),
            "days_90_plus": Decimal(0),
            "oldest_po_days": 0,
            "po_count": 0,
        }
    )

    for po, supplier_code, company_name in rows:
        sid = str(po.supplier_id)
        acc = supplier_data[sid]
        acc["supplier_id"] = sid
        acc["supplier_code"] = supplier_code
        acc["company_name"] = company_name

        # Resolve reference timestamp (order_date > created_at fallback)
        po_ref: datetime = po.order_date or po.created_at
        if po_ref.tzinfo is None:
            po_ref = po_ref.replace(tzinfo=UTC)
        days: int = max(0, (ref_dt - po_ref).days)

        amount = Decimal(str(po.total))
        if days <= 30:
            acc["current_0_30"] = Decimal(str(acc["current_0_30"])) + amount
        elif days <= 60:
            acc["days_31_60"] = Decimal(str(acc["days_31_60"])) + amount
        elif days <= 90:
            acc["days_61_90"] = Decimal(str(acc["days_61_90"])) + amount
        else:
            acc["days_90_plus"] = Decimal(str(acc["days_90_plus"])) + amount

        oldest: int = int(str(acc["oldest_po_days"]))
        acc["oldest_po_days"] = max(oldest, days)
        acc["po_count"] = int(str(acc["po_count"])) + 1

    # Build typed rows and grand-total buckets
    grand = APAgeingBuckets(
        current_0_30=Decimal(0),
        days_31_60=Decimal(0),
        days_61_90=Decimal(0),
        days_90_plus=Decimal(0),
    )
    supplier_rows: list[APAgeingSupplierRow] = []

    for acc in supplier_data.values():
        c0 = Decimal(str(acc["current_0_30"]))
        c1 = Decimal(str(acc["days_31_60"]))
        c2 = Decimal(str(acc["days_61_90"]))
        c3 = Decimal(str(acc["days_90_plus"]))
        total = c0 + c1 + c2 + c3

        supplier_rows.append(
            APAgeingSupplierRow(
                supplier_id=str(acc["supplier_id"]),
                supplier_code=str(acc["supplier_code"]),
                company_name=str(acc["company_name"]),
                total_outstanding=total,
                current_0_30=c0,
                days_31_60=c1,
                days_61_90=c2,
                days_90_plus=c3,
                oldest_po_days=int(str(acc["oldest_po_days"])),
                po_count=int(str(acc["po_count"])),
            )
        )
        grand.current_0_30 += c0
        grand.days_31_60 += c1
        grand.days_61_90 += c2
        grand.days_90_plus += c3

    # Sort by total outstanding descending so highest-risk suppliers appear first
    supplier_rows.sort(key=lambda r: r.total_outstanding, reverse=True)

    total_outstanding = (
        grand.current_0_30 + grand.days_31_60 + grand.days_61_90 + grand.days_90_plus
    )

    logger.info(
        "ap_ageing_report_generated",
        as_of_date=str(ref_date),
        supplier_count=len(supplier_rows),
        total_outstanding=str(total_outstanding),
    )

    return APAgeingReport(
        as_of_date=ref_date,
        total_outstanding=total_outstanding,
        buckets=grand,
        suppliers=supplier_rows,
        generated_at=datetime.now(UTC),
    )


# ---------------------------------------------------------------------------
# Agent performance metrics (existing)
# ---------------------------------------------------------------------------


@router.get("/metrics/overview")
async def get_metrics_overview(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    time_range: str = Query("7d", description="Time range: 1h, 6h, 24h, 7d, 30d, 90d"),
) -> dict:
    """Return agent run metrics for the analytics dashboard.

    Aggregates from AIGeneratedContent table which tracks all AI agent executions.
    Each row represents one AI generation run (quote, email, summary, etc.).
    """
    delta = TIME_RANGE_MAP.get(time_range, timedelta(days=7))
    since = datetime.now(UTC) - delta

    # Count total AI content generated within time range
    count_stmt = (
        select(func.count(AIGeneratedContent.id))
        .where(AIGeneratedContent.created_at >= since)
    )
    total_result = await db.execute(count_stmt)
    total_runs = total_result.scalar() or 0

    # Count by content_type for breakdown
    type_stmt = (
        select(AIGeneratedContent.content_type, func.count(AIGeneratedContent.id))
        .where(AIGeneratedContent.created_at >= since)
        .group_by(AIGeneratedContent.content_type)
    )
    type_result = await db.execute(type_stmt)
    type_counts = {row[0]: row[1] for row in type_result.all()}

    # Parse content_metadata for token/cost info from recent rows
    meta_stmt = (
        select(AIGeneratedContent.content_metadata)
        .where(AIGeneratedContent.created_at >= since)
        .where(AIGeneratedContent.content_metadata.isnot(None))
    )
    meta_result = await db.execute(meta_stmt)
    meta_rows = meta_result.scalars().all()

    total_input_tokens = 0
    total_output_tokens = 0
    total_cost_usd = 0.0
    durations: list[float] = []

    for raw_meta in meta_rows:
        try:
            meta = json.loads(raw_meta) if isinstance(raw_meta, str) else {}
        except (json.JSONDecodeError, TypeError):
            meta = {}
        total_input_tokens += meta.get("input_tokens", 0)
        total_output_tokens += meta.get("output_tokens", 0)
        total_cost_usd += meta.get("cost_usd", 0.0)
        if meta.get("duration_seconds"):
            durations.append(float(meta["duration_seconds"]))

    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0.0

    # All rows in this table represent completed generations (no status field)
    # Treat all as completed since they only exist after successful generation
    completed_runs = total_runs
    failed_runs = 0
    active_runs = 0
    success_rate = 100.0 if total_runs > 0 else 0.0

    return {
        "total_runs": total_runs,
        "completed_runs": completed_runs,
        "failed_runs": failed_runs,
        "active_runs": active_runs,
        "success_rate": success_rate,
        "avg_duration_seconds": avg_duration,
        "total_cost_usd": round(total_cost_usd, 4),
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "time_range": time_range,
        "by_type": type_counts,
    }
