"""
CRM Persona Tagging — UNI-1112

Auto-classify customers by business type and behaviour using existing order data.
No new paid APIs — purely derived from Orders + Quotes.

Personas:
  high_value       — lifetime spend >= $10,000
  equipment_buyer  — orders contain high-unit-price items (>= $1,000/item)
  consumables      — frequent orders (>=5) with low avg order value
  contractor       — 2-4 orders, moderate value
  new_account      — customer created in last 30 days
  dormant          — no order in 90+ days AND has prior orders
  unclassified     — fallback
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.customer_health_models import CustomerPersona, PersonaType
from src.db.demo_models import Customer, Order, OrderItem

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/crm/personas", tags=["CRM Personas"])


# ─── Classification logic ─────────────────────────────────────────────────────

def _classify(
    customer_age_days: int,
    order_count: int,
    last_order_days: int | None,
    lifetime_spend: float,
    avg_item_price: float,
) -> tuple[PersonaType, str, str]:
    """
    Returns (persona, confidence, reason).
    """
    if customer_age_days <= 30 and order_count == 0:
        return PersonaType.NEW_ACCOUNT, "high", "Account created within last 30 days, no orders yet"

    if order_count >= 1 and last_order_days is not None and last_order_days >= 90:
        return PersonaType.DORMANT, "high", f"No order in {last_order_days} days"

    if lifetime_spend >= 10_000:
        return PersonaType.HIGH_VALUE, "high", f"Lifetime spend AUD {lifetime_spend:,.0f}"

    if avg_item_price >= 1_000:
        return PersonaType.EQUIPMENT_BUYER, "high", f"Average item price AUD {avg_item_price:,.0f} — heavy equipment buyer"

    if order_count >= 5 and lifetime_spend < 5_000:
        return PersonaType.CONSUMABLES, "medium", f"{order_count} orders, avg low value — likely consumables buyer"

    if 2 <= order_count <= 4:
        return PersonaType.CONTRACTOR, "medium", f"{order_count} orders — project-based contractor pattern"

    if order_count == 0:
        return PersonaType.NEW_ACCOUNT, "low", "No orders placed yet"

    return PersonaType.UNCLASSIFIED, "low", "Insufficient data for classification"


async def _classify_customer(customer: Customer, db: AsyncSession) -> dict:
    """Compute and persist persona for a single customer."""
    now = datetime.now(UTC)

    created = customer.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    age_days = (now - created).days

    # Order stats
    order_stats = await db.execute(
        select(
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.total), 0).label("lifetime_spend"),
            func.max(Order.created_at).label("last_order_at"),
        ).where(Order.customer_id == customer.id)
    )
    o = order_stats.one()

    last_order_days: int | None = None
    if o.last_order_at:
        lo = o.last_order_at
        if lo.tzinfo is None:
            lo = lo.replace(tzinfo=UTC)
        last_order_days = (now - lo).days

    # Average item price across all order items
    item_price_result = await db.execute(
        select(func.avg(OrderItem.unit_price))
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.customer_id == customer.id)
    )
    avg_item_price = float(item_price_result.scalar() or 0)

    persona, confidence, reason = _classify(
        customer_age_days=age_days,
        order_count=int(o.order_count or 0),
        last_order_days=last_order_days,
        lifetime_spend=float(o.lifetime_spend or 0),
        avg_item_price=avg_item_price,
    )

    # Upsert persona record
    existing = await db.execute(
        select(CustomerPersona).where(CustomerPersona.customer_id == customer.id)
    )
    cp = existing.scalar_one_or_none()

    if cp:
        cp.persona = persona.value
        cp.confidence = confidence
        cp.reason = reason
        cp.classified_at = now
    else:
        cp = CustomerPersona(
            customer_id=customer.id,
            persona=persona.value,
            confidence=confidence,
            reason=reason,
            classified_at=now,
        )
        db.add(cp)

    await db.commit()

    return {
        "customer_id": str(customer.id),
        "customer_number": customer.customer_number,
        "company_name": customer.company_name,
        "persona": persona.value,
        "confidence": confidence,
        "reason": reason,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def list_personas(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    persona_filter: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    """Return all customers with their stored persona tags."""
    stmt = select(CustomerPersona)
    if persona_filter:
        stmt = stmt.where(CustomerPersona.persona == persona_filter)
    result = await db.execute(stmt)
    records = result.scalars().all()

    customer_ids = [r.customer_id for r in records]
    if customer_ids:
        cust_result = await db.execute(
            select(Customer).where(Customer.id.in_(customer_ids))
        )
        customers = {c.id: c for c in cust_result.scalars().all()}
    else:
        customers = {}

    items = [
        {
            "customer_id": str(r.customer_id),
            "company_name": customers.get(r.customer_id, Customer()).company_name if r.customer_id in customers else "Unknown",
            "persona": r.persona,
            "confidence": r.confidence,
            "reason": r.reason,
            "classified_at": r.classified_at.isoformat() if r.classified_at else None,
        }
        for r in records
    ]

    # Summary
    from collections import Counter
    summary = dict(Counter(i["persona"] for i in items))

    total = len(items)
    start = (page - 1) * page_size
    paginated = items[start: start + page_size]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
        "summary": summary,
    }


@router.post("/classify-all")
async def classify_all_customers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Re-classify ALL customers and persist persona tags.
    Called by daily cron job or manually.
    """
    customers_result = await db.execute(select(Customer))
    customers = customers_result.scalars().all()

    results = []
    for customer in customers:
        try:
            result = await _classify_customer(customer, db)
            results.append(result)
        except Exception as e:
            logger.error("Failed to classify customer", customer_id=str(customer.id), error=str(e))

    from collections import Counter
    summary = dict(Counter(r["persona"] for r in results))

    logger.info("Persona classification complete", total=len(results), summary=summary)
    return {
        "classified": len(results),
        "summary": summary,
        "customers": results,
    }


@router.get("/{customer_id}")
async def get_customer_persona(
    customer_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get or compute persona for a single customer."""
    cust_result = await db.execute(
        select(Customer).where(Customer.id == UUID(customer_id))
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")

    return await _classify_customer(customer, db)
