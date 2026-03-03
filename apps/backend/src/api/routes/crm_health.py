"""
CRM Client Health Dashboard — UNI-1114

Computes a 0–100 health score per customer based on existing data:
- Recency      (30pts): days since last order
- Volume       (30pts): total order count
- Engagement   (20pts): quote activity
- Account      (20pts): account is_active flag

Status thresholds:
- Green  (70–100): healthy, active client
- Amber  (40–69):  at-risk, needs attention
- Red    (0–39):   churned or dormant
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import Customer, Order, Quote

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/crm", tags=["CRM Health"])


# ─── Scoring helpers ──────────────────────────────────────────────────────────

def _recency_score(last_order_days: int | None) -> int:
    """30pts — days since last order."""
    if last_order_days is None:
        return 0
    if last_order_days < 7:
        return 30
    if last_order_days < 30:
        return 22
    if last_order_days < 90:
        return 12
    return 0


def _volume_score(order_count: int) -> int:
    """30pts — total order count."""
    if order_count >= 10:
        return 30
    if order_count >= 5:
        return 20
    if order_count >= 2:
        return 12
    if order_count == 1:
        return 5
    return 0


def _engagement_score(quote_count: int) -> int:
    """20pts — quote activity."""
    if quote_count >= 5:
        return 20
    if quote_count >= 2:
        return 14
    if quote_count == 1:
        return 7
    return 0


def _account_score(is_active: bool) -> int:
    """20pts — account is_active."""
    return 20 if is_active else 0


def _compute_health(
    last_order_days: int | None,
    order_count: int,
    quote_count: int,
    is_active: bool,
) -> dict:
    score = (
        _recency_score(last_order_days)
        + _volume_score(order_count)
        + _engagement_score(quote_count)
        + _account_score(is_active)
    )
    if score >= 70:
        status = "green"
    elif score >= 40:
        status = "amber"
    else:
        status = "red"

    return {
        "score": score,
        "status": status,
        "breakdown": {
            "recency": _recency_score(last_order_days),
            "volume": _volume_score(order_count),
            "engagement": _engagement_score(quote_count),
            "account": _account_score(is_active),
        },
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/health-scores")
async def list_health_scores(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status_filter: str | None = Query(None, description="Filter by status: red, amber, green"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    """
    Return health scores for all customers.

    Score recalculates on every call (cache via daily cron job in production).
    """
    now = datetime.now(UTC)

    # Fetch all customers
    customers_result = await db.execute(select(Customer))
    customers = customers_result.scalars().all()

    # Bulk-fetch order counts + last order dates per customer
    order_stats_result = await db.execute(
        select(
            Order.customer_id,
            func.count(Order.id).label("order_count"),
            func.max(Order.created_at).label("last_order_at"),
        ).group_by(Order.customer_id)
    )
    order_stats = {
        row.customer_id: {
            "order_count": row.order_count,
            "last_order_at": row.last_order_at,
        }
        for row in order_stats_result
    }

    # Bulk-fetch quote counts per customer
    quote_stats_result = await db.execute(
        select(
            Quote.customer_id,
            func.count(Quote.id).label("quote_count"),
        ).group_by(Quote.customer_id)
    )
    quote_stats = {
        row.customer_id: row.quote_count for row in quote_stats_result
    }

    # Build scored list
    results = []
    for customer in customers:
        o = order_stats.get(customer.id, {"order_count": 0, "last_order_at": None})
        q = quote_stats.get(customer.id, 0)

        last_order_days: int | None = None
        if o["last_order_at"]:
            lo = o["last_order_at"]
            if lo.tzinfo is None:
                lo = lo.replace(tzinfo=UTC)
            last_order_days = (now - lo).days

        health = _compute_health(
            last_order_days=last_order_days,
            order_count=o["order_count"],
            quote_count=q,
            is_active=customer.is_active,
        )

        if status_filter and health["status"] != status_filter:
            continue

        results.append({
            "customer_id": str(customer.id),
            "customer_number": customer.customer_number,
            "company_name": customer.company_name,
            "contact_name": customer.contact_name,
            "email": customer.email,
            "is_active": customer.is_active,
            "order_count": o["order_count"],
            "quote_count": q,
            "last_order_days": last_order_days,
            "health_score": health["score"],
            "health_status": health["status"],
            "score_breakdown": health["breakdown"],
        })

    # Sort by score descending
    results.sort(key=lambda x: x["health_score"], reverse=True)

    # Summary counts
    summary = {
        "total": len(results),
        "green": sum(1 for r in results if r["health_status"] == "green"),
        "amber": sum(1 for r in results if r["health_status"] == "amber"),
        "red": sum(1 for r in results if r["health_status"] == "red"),
        "avg_score": round(
            sum(r["health_score"] for r in results) / len(results), 1
        ) if results else 0,
    }

    # Paginate
    total = len(results)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = results[start:end]

    logger.info("CRM health scores computed", total=total, summary=summary)

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
        "summary": summary,
        "computed_at": now.isoformat(),
    }


@router.get("/health-scores/{customer_id}")
async def get_customer_health_score(
    customer_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return health score for a single customer."""
    from uuid import UUID
    now = datetime.now(UTC)

    customer_result = await db.execute(
        select(Customer).where(Customer.id == UUID(customer_id))
    )
    customer = customer_result.scalar_one_or_none()
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")

    order_stats_result = await db.execute(
        select(
            func.count(Order.id).label("order_count"),
            func.max(Order.created_at).label("last_order_at"),
        ).where(Order.customer_id == UUID(customer_id))
    )
    o = order_stats_result.one()

    quote_count_result = await db.execute(
        select(func.count(Quote.id)).where(Quote.customer_id == UUID(customer_id))
    )
    quote_count = quote_count_result.scalar_one()

    last_order_days: int | None = None
    if o.last_order_at:
        lo = o.last_order_at
        if lo.tzinfo is None:
            lo = lo.replace(tzinfo=UTC)
        last_order_days = (now - lo).days

    health = _compute_health(
        last_order_days=last_order_days,
        order_count=o.order_count or 0,
        quote_count=quote_count or 0,
        is_active=customer.is_active,
    )

    return {
        "customer_id": customer_id,
        "customer_number": customer.customer_number,
        "company_name": customer.company_name,
        "order_count": o.order_count or 0,
        "quote_count": quote_count or 0,
        "last_order_days": last_order_days,
        "health_score": health["score"],
        "health_status": health["status"],
        "score_breakdown": health["breakdown"],
        "computed_at": now.isoformat(),
    }
