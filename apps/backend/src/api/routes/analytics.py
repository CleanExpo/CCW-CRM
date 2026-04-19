"""Analytics metrics API endpoints.

Provides agent performance metrics, token usage, cost tracking
for the dashboard-analytics page, and financial reports such as
the AP ageing report (UNI-1834).
"""

import json
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import AIGeneratedContent
from src.db.inventory_models import PurchaseOrder, Supplier

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# AP ageing (UNI-1834) — a PO counts as "open" if it's been ordered but not
# cancelled or marked complete. Adjust as the status vocabulary evolves.
_AP_OPEN_STATUSES: frozenset[str] = frozenset(
    {"ordered", "in_transit", "received"}
)

AP_AGEING_BUCKETS: tuple[str, ...] = ("0-30", "31-60", "61-90", "90+")


def classify_ap_age_bucket(age_days: int) -> str:
    """Return the AP-ageing bucket label for a given age in days.

    Guarantees a value from :data:`AP_AGEING_BUCKETS` — negative ages
    (future-dated POs) and the 0-30 day window both map to ``"0-30"``
    so upstream callers can't surprise the UI.
    """
    if age_days <= 30:
        return "0-30"
    if age_days <= 60:
        return "31-60"
    if age_days <= 90:
        return "61-90"
    return "90+"

# Map time_range strings to timedelta
TIME_RANGE_MAP = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(days=1),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
}


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


@router.get("/ap-ageing")
async def get_ap_ageing(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    as_of: str | None = Query(
        None,
        description="Ageing reference date (ISO YYYY-MM-DD); defaults to today in UTC",
    ),
) -> dict[str, Any]:
    """AP ageing report for the CFO dashboard (UNI-1834).

    Buckets open (uncancelled, unpaid) purchase orders by age in days
    since ``order_date`` relative to ``as_of``. Returns per-bucket
    totals, per-supplier breakdown, and a grand total liability.

    Demo note: the current schema has no payment/invoice layer, so
    "open" = ``status IN {ordered, in_transit, received}`` and ``age``
    is measured from ``order_date``. When a payments table lands this
    endpoint will switch to ``status = 'billed' AND paid_amount <
    total``.
    """
    # Resolve as_of reference date
    if as_of:
        try:
            reference = datetime.fromisoformat(as_of).date()
        except ValueError:
            reference = datetime.now(UTC).date()
    else:
        reference = datetime.now(UTC).date()

    stmt = (
        select(PurchaseOrder, Supplier.company_name, Supplier.payment_terms)
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .where(PurchaseOrder.status.in_(tuple(_AP_OPEN_STATUSES)))
        .where(PurchaseOrder.order_date.isnot(None))
    )
    result = await db.execute(stmt)
    rows = result.all()

    bucket_totals: dict[str, dict[str, Any]] = {
        b: {"count": 0, "amount": Decimal("0")} for b in AP_AGEING_BUCKETS
    }
    by_supplier: dict[UUID, dict[str, Any]] = defaultdict(
        lambda: {
            "supplier_id": None,
            "company_name": "",
            "payment_terms": None,
            "0-30": Decimal("0"),
            "31-60": Decimal("0"),
            "61-90": Decimal("0"),
            "90+": Decimal("0"),
            "total": Decimal("0"),
            "open_po_count": 0,
        }
    )
    total_liability = Decimal("0")

    for po, company_name, payment_terms in rows:
        order_date: datetime | None = po.order_date
        if order_date is None:
            continue
        order_date_local: date = order_date.date() if isinstance(order_date, datetime) else order_date  # type: ignore[assignment]
        age_days = (reference - order_date_local).days
        bucket = classify_ap_age_bucket(age_days)

        amount: Decimal = Decimal(po.total or 0)

        bucket_totals[bucket]["count"] += 1
        bucket_totals[bucket]["amount"] += amount
        total_liability += amount

        supplier_row = by_supplier[po.supplier_id]
        supplier_row["supplier_id"] = str(po.supplier_id)
        supplier_row["company_name"] = company_name
        supplier_row["payment_terms"] = payment_terms
        supplier_row[bucket] += amount
        supplier_row["total"] += amount
        supplier_row["open_po_count"] += 1

    # Pydantic can't serialise Decimal directly in plain dict response
    return {
        "as_of": reference.isoformat(),
        "buckets": {
            bucket: {
                "count": bucket_totals[bucket]["count"],
                "amount": float(bucket_totals[bucket]["amount"]),
            }
            for bucket in AP_AGEING_BUCKETS
        },
        "total_liability": float(total_liability),
        "suppliers": sorted(
            (
                {
                    **row,
                    "0-30": float(row["0-30"]),
                    "31-60": float(row["31-60"]),
                    "61-90": float(row["61-90"]),
                    "90+": float(row["90+"]),
                    "total": float(row["total"]),
                }
                for row in by_supplier.values()
            ),
            key=lambda s: s["total"],
            reverse=True,
        ),
    }
