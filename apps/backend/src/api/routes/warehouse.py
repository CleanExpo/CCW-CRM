"""Warehouse operations API.

Provides the /api/warehouse/ops payload for the Warehouse Operations page,
aggregating data from orders, inventory, and containers into a single feed.
Also provides pick list and packing slip generation.
"""

import time
import uuid as _uuid
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import Customer, Order, OrderItem, Product
from src.db.inventory_models import RMA, RMARead, RMAStatus, RMAStatusUpdate, rma_status_can_advance

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/warehouse", tags=["Warehouse"])

# ------------------------------------------------------------------------------
# In-process pick-list store (demo; no extra migration required)
# ------------------------------------------------------------------------------
_pick_lists: dict[str, dict] = {}


def _generate_pick_list_number() -> str:
    date_str = datetime.now(UTC).strftime("%Y%m%d")
    seq = int(time.time() % 100000)
    return f"PL-{date_str}-{seq:05d}"


# ------------------------------------------------------------------------------
# Pydantic models
# ------------------------------------------------------------------------------


class PickListCreate(BaseModel):
    """Request body for creating a pick list."""

    order_ids: list[UUID]


class PickListLineItem(BaseModel):
    """A single line on a pick list."""

    order_id: str
    order_number: str
    product_id: str
    sku: str
    description: str
    bin_location: str | None
    qty_ordered: int
    qty_picked: int


class PickListResponse(BaseModel):
    """Pick list response shape."""

    id: str
    pick_list_number: str
    created_at: str
    order_ids: list[str]
    customer_names: list[str]
    line_items: list[PickListLineItem]
    total_lines: int


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


# ------------------------------------------------------------------------------
# Pick List endpoints
# ------------------------------------------------------------------------------


@router.post(
    "/pick-lists",
    response_model=PickListResponse,
    status_code=201,
    dependencies=[Depends(get_current_user)],
)
async def create_pick_list(
    body: PickListCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PickListResponse:
    """Generate a pick list for the given order IDs.

    Queries orders, their line items, and product SKU/bin data to
    produce a structured pick list ready for warehouse staff.
    """
    if not body.order_ids:
        raise HTTPException(status_code=400, detail="At least one order_id is required")

    str_ids = [str(oid) for oid in body.order_ids]

    # Load orders
    orders_result = await db.execute(
        select(Order).where(Order.id.in_(body.order_ids))
    )
    orders = {str(o.id): o for o in orders_result.scalars().all()}

    missing = [oid for oid in str_ids if oid not in orders]
    if missing:
        raise HTTPException(status_code=400, detail=f"Orders not found: {missing}")

    # Load customer names
    customer_ids = list({o.customer_id for o in orders.values()})
    customers_result = await db.execute(
        select(Customer).where(Customer.id.in_(customer_ids))
    )
    customers = {str(c.id): c for c in customers_result.scalars().all()}

    # Load order items
    items_result = await db.execute(
        select(OrderItem).where(OrderItem.order_id.in_(body.order_ids))
    )
    order_items = items_result.scalars().all()

    if not order_items:
        raise HTTPException(
            status_code=400,
            detail="No line items found for the selected orders",
        )

    # Load products
    product_ids = list({item.product_id for item in order_items})
    products_result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = {str(p.id): p for p in products_result.scalars().all()}

    # Build line items
    line_items: list[PickListLineItem] = []
    for item in order_items:
        order = orders.get(str(item.order_id))
        product = products.get(str(item.product_id))
        if not order or not product:
            continue
        line_items.append(
            PickListLineItem(
                order_id=str(item.order_id),
                order_number=order.order_number,
                product_id=str(item.product_id),
                sku=product.sku,
                description=product.name,
                bin_location=product.warehouse_location,
                qty_ordered=item.quantity,
                qty_picked=0,
            )
        )

    # Sort by bin location then SKU for efficient picking
    line_items.sort(key=lambda li: (li.bin_location or "", li.sku))

    customer_names = sorted(
        {
            (customers[str(o.customer_id)].company_name if str(o.customer_id) in customers else "Unknown")
            for o in orders.values()
        }
    )

    pick_list_id = str(_uuid.uuid4())
    pick_list_number = _generate_pick_list_number()
    created_at = datetime.now(UTC).isoformat()

    pick_list: dict = {
        "id": pick_list_id,
        "pick_list_number": pick_list_number,
        "created_at": created_at,
        "order_ids": str_ids,
        "customer_names": customer_names,
        "line_items": [li.model_dump() for li in line_items],
        "total_lines": len(line_items),
    }
    _pick_lists[pick_list_id] = pick_list

    logger.info(
        "Pick list created",
        pick_list_id=pick_list_id,
        pick_list_number=pick_list_number,
        order_count=len(str_ids),
        line_count=len(line_items),
    )

    return PickListResponse(**pick_list)


@router.get(
    "/pick-lists/{pick_list_id}",
    response_model=PickListResponse,
    dependencies=[Depends(get_current_user)],
)
async def get_pick_list(pick_list_id: str) -> PickListResponse:
    """Retrieve a previously generated pick list by ID."""
    pick_list = _pick_lists.get(pick_list_id)
    if not pick_list:
        raise HTTPException(status_code=404, detail="Pick list not found")
    return PickListResponse(**pick_list)


# ------------------------------------------------------------------------------
# RMA endpoints — UNI-1835
# ------------------------------------------------------------------------------


@router.get(
    "/returns",
    response_model=list[RMARead],
    dependencies=[Depends(get_current_user)],
)
async def list_returns(
    status: str | None = Query(None, description="Filter by RMA status"),
    db: AsyncSession = Depends(get_async_db),
) -> list[RMARead]:
    """List all RMAs, optionally filtered by status."""
    if status is not None:
        valid_statuses = [s.value for s in RMAStatus]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{status}'. Must be one of: {valid_statuses}",
            )

    stmt = select(RMA).options(selectinload(RMA.lines)).order_by(RMA.created_at.desc())
    if status is not None:
        stmt = stmt.where(RMA.status == status)

    result = await db.execute(stmt)
    rmas = result.scalars().all()

    logger.info("list_returns", count=len(rmas), status_filter=status)
    return [RMARead.model_validate(r) for r in rmas]


@router.patch(
    "/returns/{rma_id}/status",
    response_model=RMARead,
    dependencies=[Depends(get_current_user)],
)
async def advance_rma_status(
    rma_id: UUID,
    body: RMAStatusUpdate,
    db: AsyncSession = Depends(get_async_db),
) -> RMARead:
    """Advance an RMA to the next status (forward-only transitions)."""
    stmt = select(RMA).options(selectinload(RMA.lines)).where(RMA.id == rma_id)
    result = await db.execute(stmt)
    rma = result.scalar_one_or_none()

    if rma is None:
        raise HTTPException(status_code=404, detail="RMA not found")

    valid_statuses = [s.value for s in RMAStatus]
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {valid_statuses}",
        )

    current = rma.status if isinstance(rma.status, str) else rma.status.value
    if not rma_status_can_advance(current, body.status):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition RMA from '{current}' to '{body.status}'. "
            f"Only forward transitions are allowed.",
        )

    rma.status = body.status
    await db.commit()

    # Re-query with lines eager-loaded — db.refresh() only reloads scalar columns,
    # not relationships. Accessing rma.lines after a bare refresh raises
    # MissingGreenlet in async SQLAlchemy.
    reload_stmt = select(RMA).options(selectinload(RMA.lines)).where(RMA.id == rma_id)
    reload_result = await db.execute(reload_stmt)
    rma = reload_result.scalar_one()

    logger.info("advance_rma_status", rma_id=str(rma_id), from_status=current, to_status=body.status)
    return RMARead.model_validate(rma)
