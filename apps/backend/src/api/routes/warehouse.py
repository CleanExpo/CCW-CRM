"""Warehouse operations API.

Provides the /api/warehouse/ops payload for the Warehouse Operations page,
aggregating data from orders, inventory, and containers into a single feed.
Also hosts the pick-list and packing-slip endpoints (UNI-1828) that drive
the warehouse fulfilment workflow.
"""

from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_async_db
from src.db.demo_models import Customer, Order, OrderItem, Product

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/warehouse", tags=["Warehouse"])


# ── Pick list + packing slip helpers (UNI-1828) ─────────────────────────────

PickableOrderLine = dict[str, Any]


def aggregate_pick_list_lines(
    order_lines: Iterable[PickableOrderLine],
) -> list[dict[str, Any]]:
    """Aggregate order-line tuples into a wave-pick list.

    Group by (location, product_id) so a picker walking a zone only visits
    each SKU once — then unpacks who ordered what at the pack bench.

    Each input line is a dict with keys:
        location, product_id, sku, name, quantity, order_id,
        order_number, customer_name.

    The returned shape (one entry per distinct SKU+location):

        {
            "location": "brisbane",
            "product_id": "...",
            "sku": "TM-PRO-570",
            "name": "TruckMount Pro 570",
            "total_quantity": 5,
            "contributing_orders": [
                {"order_id": "...", "order_number": "ORD-2026-0291",
                 "customer_name": "CleanServ", "quantity": 3},
                {"order_id": "...", "order_number": "ORD-2026-0288",
                 "customer_name": "BrightFloor", "quantity": 2},
            ],
        }

    Pure function — no DB access. Sorted by ``(location, sku)`` for stable
    output (printable pick lists need predictable order).
    """
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for line in order_lines:
        key = (line["location"] or "unassigned", str(line["product_id"]))
        row = grouped.get(key)
        if row is None:
            row = {
                "location": line["location"] or "unassigned",
                "product_id": str(line["product_id"]),
                "sku": line["sku"],
                "name": line["name"],
                "total_quantity": 0,
                "contributing_orders": [],
            }
            grouped[key] = row
        row["total_quantity"] += int(line["quantity"])
        row["contributing_orders"].append(
            {
                "order_id": str(line["order_id"]),
                "order_number": line["order_number"],
                "customer_name": line["customer_name"],
                "quantity": int(line["quantity"]),
            }
        )

    # Stable sort: by location then SKU for predictable printable output.
    return sorted(
        grouped.values(), key=lambda r: (r["location"], r["sku"] or "")
    )


class PickListRequest(BaseModel):
    """Body for POST /api/warehouse/pick-lists."""

    order_ids: list[UUID] = Field(
        ..., min_length=1, description="Orders to include in the pick wave"
    )


@router.post("/pick-lists")
async def generate_pick_list(
    payload: PickListRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Create a consolidated pick list for one or more orders (UNI-1828).

    Read-only — does not mutate order / shipment state. The pack bench
    uses the ``contributing_orders`` breakdown to split a wave pick into
    per-order packing slips afterwards (see GET /packing-slips/{order_id}).
    """
    stmt = (
        select(Order)
        .options(selectinload(Order.order_items).selectinload(OrderItem.product))
        .options(selectinload(Order.customer))
        .where(Order.id.in_(payload.order_ids))
    )
    result = await db.execute(stmt)
    orders = result.scalars().unique().all()

    if not orders:
        raise HTTPException(status_code=404, detail="No orders found for the given ids")

    flat_lines: list[PickableOrderLine] = []
    for order in orders:
        customer_name = order.customer.company_name if order.customer else "Unknown"
        for item in order.order_items:
            flat_lines.append(
                {
                    "location": order.fulfillment_location,
                    "product_id": item.product_id,
                    "sku": getattr(item.product, "sku", None) or "—",
                    "name": getattr(item.product, "name", None) or "Unknown product",
                    "quantity": item.quantity,
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "customer_name": customer_name,
                }
            )

    pick_lines = aggregate_pick_list_lines(flat_lines)
    total_units = sum(row["total_quantity"] for row in pick_lines)
    by_location: dict[str, int] = defaultdict(int)
    for row in pick_lines:
        by_location[row["location"]] += row["total_quantity"]

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "order_count": len(orders),
        "sku_count": len(pick_lines),
        "total_units": total_units,
        "units_by_location": dict(by_location),
        "lines": pick_lines,
        "orders": [
            {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "customer_name": order.customer.company_name if order.customer else None,
                "status": order.status,
                "fulfillment_location": order.fulfillment_location,
            }
            for order in orders
        ],
    }


@router.get("/packing-slips/{order_id}")
async def generate_packing_slip(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Packing slip payload for a single order (UNI-1828)."""
    stmt = (
        select(Order)
        .options(selectinload(Order.order_items).selectinload(OrderItem.product))
        .options(selectinload(Order.customer))
        .where(Order.id == order_id)
    )
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    customer: Customer | None = order.customer
    total_units = sum(item.quantity for item in order.order_items)

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "fulfillment_location": order.fulfillment_location,
        "customer": {
            "id": str(customer.id) if customer else None,
            "name": customer.company_name if customer else None,
            "email": customer.email if customer else None,
            "phone": customer.phone if customer else None,
        },
        "total_units": total_units,
        "line_items": [
            {
                "sku": getattr(item.product, "sku", None) or "—",
                "name": getattr(item.product, "name", None) or "Unknown product",
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": float(item.line_total),
            }
            for item in order.order_items
        ],
        "carrier_name": order.carrier_name,
        "tracking_number": order.tracking_number,
        "notes": order.notes,
    }


@router.get("/ops")
async def get_warehouse_ops() -> dict:
    """Warehouse operations payload — metrics, queues, and AI guidance.

    Aggregates receiving, pick/pack, returns, and AI insights into one feed
    for the warehouse dashboard. Demo data until full WMS integration.
    """
    now = datetime.now(UTC).isoformat()

    return {
        "updatedAt": now,
        "metrics": {
            "inboundToday": 8,
            "inboundDocked": 3,
            "inboundScheduled": 5,
            "picksDueToday": 24,
            "rushPicks": 4,
            "returnsOpen": 6,
            "returnSlaRisk": 2,
            "onTimeRate": 94,
        },
        "receivingQueue": [
            {
                "id": "PO-2026-0041",
                "supplier": "Kärcher Australia",
                "container": "MSCU1234567",
                "eta": "08:30 AM",
                "dock": "Dock A",
                "items": 48,
                "status": "in_progress",
                "priority": "high",
            },
            {
                "id": "PO-2026-0038",
                "supplier": "Tennant Company",
                "container": "CMAU9876543",
                "eta": "10:00 AM",
                "dock": "Dock B",
                "items": 32,
                "status": "scheduled",
                "priority": "normal",
            },
            {
                "id": "PO-2026-0035",
                "supplier": "Nilfisk Direct",
                "container": "TCNU5551234",
                "eta": "02:00 PM",
                "dock": "Dock C",
                "items": 16,
                "status": "scheduled",
                "priority": "normal",
            },
        ],
        "pickQueue": [
            {
                "id": "ORD-2026-0291",
                "customer": "CleanServ Pty Ltd",
                "zone": "Zone B3",
                "lines": 5,
                "promised": "Today 4 PM",
                "status": "picking",
                "priority": "rush",
            },
            {
                "id": "ORD-2026-0288",
                "customer": "BrightFloor Solutions",
                "zone": "Zone A1",
                "lines": 3,
                "promised": "Today 5 PM",
                "status": "pending",
                "priority": "high",
            },
            {
                "id": "ORD-2026-0285",
                "customer": "Hygiene Plus QLD",
                "zone": "Zone C2",
                "lines": 8,
                "promised": "Tomorrow AM",
                "status": "pending",
                "priority": "normal",
            },
            {
                "id": "ORD-2026-0282",
                "customer": "Metro Cleaning Co",
                "zone": "Zone A3",
                "lines": 2,
                "promised": "Tomorrow AM",
                "status": "pending",
                "priority": "normal",
            },
        ],
        "returnsQueue": [
            {
                "id": "RMA-2026-0019",
                "customer": "Floormaster VIC",
                "reason": "Faulty pump assembly",
                "items": 1,
                "sla": "4h remaining",
                "status": "inspection",
            },
            {
                "id": "RMA-2026-0017",
                "customer": "SparkleClean NSW",
                "reason": "Wrong item shipped",
                "items": 2,
                "sla": "24h remaining",
                "status": "pending",
            },
            {
                "id": "RMA-2026-0015",
                "customer": "Pro Hygiene WA",
                "reason": "Damaged in transit",
                "items": 3,
                "sla": "48h remaining",
                "status": "in_progress",
            },
        ],
        "aiGuidance": [
            {
                "title": "Prioritise ORD-2026-0291 pick",
                "detail": "CleanServ SLA expires at 4 PM. Assign 2 pickers to Zone B3 immediately.",
                "impact": "Prevents SLA breach — $1,800 order at risk",
            },
            {
                "title": "Dock A inspection almost done",
                "detail": "Kärcher shipment is 80% inspected. 6 items flagged for QA hold.",
                "impact": "Frees Dock A for PO-2026-0038 by 10 AM",
            },
            {
                "title": "RMA-0019 needs same-day resolution",
                "detail": "Faulty pump — customer expects replacement dispatch today.",
                "impact": "Maintains 5-star post-purchase rating",
            },
        ],
    }
