"""Container tracking API endpoints."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_optional_user
from src.config.database import get_async_db
from src.db.container_models import (
    Backorder,
    Container,
    ContainerItem,
    ContainerStatus,
)
from src.db.erp_models import Product
from src.db.inventory_models import PurchaseOrder, Supplier
from src.db.models import User
from src.events.event_bus import get_event_bus
from src.services.alert_manager import get_alert_manager
from src.websockets.events import broadcast_container_update

router = APIRouter(prefix="/api/containers", tags=["Container Tracking"])


# Pydantic Models
class ContainerItemCreate(BaseModel):
    """Container item creation schema."""

    product_id: UUID
    quantity_ordered: int = Field(gt=0)
    unit_cost: float | None = None


class ContainerItemUpdate(BaseModel):
    """Container item update schema."""

    quantity_received: int | None = Field(default=None, ge=0)
    quantity_damaged: int | None = Field(default=None, ge=0)
    quantity_preallocated: int | None = Field(default=None, ge=0)
    quality_checked: bool | None = None
    quality_notes: str | None = None


class ContainerCreate(BaseModel):
    """Container creation schema."""

    container_number: str = Field(min_length=1, max_length=50)
    purchase_order_id: UUID | None = None
    supplier_id: UUID | None = None
    vessel_name: str | None = Field(default=None, max_length=255)
    voyage_number: str | None = Field(default=None, max_length=100)
    origin_port: str | None = Field(default=None, max_length=100)
    destination_port: str | None = Field(default=None, max_length=100)
    destination_warehouse: str = Field(default="brisbane", max_length=50)
    booking_date: datetime | None = None
    departure_date: datetime | None = None
    estimated_arrival_date: datetime | None = None
    status: ContainerStatus = ContainerStatus.BOOKED
    tracking_number: str | None = Field(default=None, max_length=100)
    carrier: str | None = Field(default=None, max_length=100)
    tracking_url: str | None = Field(default=None, max_length=500)
    shipping_cost: float | None = None
    customs_duty: float | None = None
    other_charges: float | None = None
    notes: str | None = None
    internal_notes: str | None = None
    items: list[ContainerItemCreate] = Field(default_factory=list)


class ContainerUpdate(BaseModel):
    """Container update schema."""

    vessel_name: str | None = None
    voyage_number: str | None = None
    origin_port: str | None = None
    destination_port: str | None = None
    destination_warehouse: str | None = None
    booking_date: datetime | None = None
    departure_date: datetime | None = None
    estimated_arrival_date: datetime | None = None
    actual_arrival_date: datetime | None = None
    customs_clearance_date: datetime | None = None
    delivered_date: datetime | None = None
    status: ContainerStatus | None = None
    tracking_number: str | None = None
    carrier: str | None = None
    tracking_url: str | None = None
    shipping_cost: float | None = None
    customs_duty: float | None = None
    other_charges: float | None = None
    notes: str | None = None
    internal_notes: str | None = None


class ContainerReceiveRequest(BaseModel):
    """Request to mark container as received."""

    actual_arrival_date: datetime | None = None
    items: list[ContainerItemUpdate] = Field(default_factory=list)
    notes: str | None = None


class ContainerResponse(BaseModel):
    """Container response schema."""

    id: str
    container_number: str
    purchase_order_id: str | None
    supplier_id: str | None
    vessel_name: str | None
    voyage_number: str | None
    origin_port: str | None
    destination_port: str | None
    destination_warehouse: str
    booking_date: str | None
    departure_date: str | None
    estimated_arrival_date: str | None
    actual_arrival_date: str | None
    customs_clearance_date: str | None
    delivered_date: str | None
    status: str
    tracking_number: str | None
    carrier: str | None
    tracking_url: str | None
    tracking_events: dict[str, Any]
    shipping_cost: str | None
    customs_duty: str | None
    other_charges: str | None
    total_cost: str
    notes: str | None
    internal_notes: str | None
    is_overdue: bool
    days_until_arrival: int | None
    created_at: str
    updated_at: str
    items: list[dict[str, Any]] = Field(default_factory=list)
    backorders: list[dict[str, Any]] = Field(default_factory=list)


class ContainerListResponse(BaseModel):
    """Container list response with pagination."""

    items: list[ContainerResponse]
    total: int
    page: int
    page_size: int


@router.get("", response_model=ContainerListResponse)
async def list_containers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: ContainerStatus | None = None,
    warehouse: str | None = None,
    search: str | None = None,
    arriving_soon: bool = False,
    overdue_only: bool = False,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> ContainerListResponse:
    """List all containers with filtering and pagination."""
    query = select(Container).options(
        selectinload(Container.items).selectinload(ContainerItem.product),
        selectinload(Container.backorders),
        selectinload(Container.purchase_order),
    )

    # Apply filters
    filters = []

    if status:
        filters.append(Container.status == status)

    if warehouse:
        filters.append(Container.destination_warehouse == warehouse)

    if search:
        filters.append(
            or_(
                Container.container_number.ilike(f"%{search}%"),
                Container.vessel_name.ilike(f"%{search}%"),
                Container.tracking_number.ilike(f"%{search}%"),
            )
        )

    if arriving_soon:
        # Show containers arriving in next 14 days
        today = datetime.now(UTC)
        in_14_days = today.replace(day=today.day + 14)
        filters.append(
            and_(
                Container.estimated_arrival_date.isnot(None),
                Container.estimated_arrival_date >= today,
                Container.estimated_arrival_date <= in_14_days,
                Container.status.in_(
                    [
                        ContainerStatus.BOOKED,
                        ContainerStatus.IN_TRANSIT,
                        ContainerStatus.AT_PORT,
                        ContainerStatus.CUSTOMS_CLEARANCE,
                    ]
                ),
            )
        )

    if overdue_only:
        # Show overdue containers
        today = datetime.now(UTC)
        filters.append(
            and_(
                Container.estimated_arrival_date.isnot(None),
                Container.estimated_arrival_date < today,
                Container.status != ContainerStatus.DELIVERED,
            )
        )

    if filters:
        query = query.where(and_(*filters))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Apply pagination and ordering
    query = (
        query.order_by(Container.estimated_arrival_date.asc().nullslast())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )

    # Execute query
    result = await db.execute(query)
    containers = result.scalars().all()

    # Convert to response models
    items = []
    for container in containers:
        container_dict = container.to_dict()
        container_dict["items"] = [item.to_dict() for item in container.items]
        container_dict["backorders"] = [
            backorder.to_dict() for backorder in container.backorders
        ]
        items.append(ContainerResponse(**container_dict))

    return ContainerListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/arriving-soon", response_model=list[ContainerResponse])
async def get_arriving_soon(
    days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> list[ContainerResponse]:
    """Get containers arriving within specified days (for dashboard widget)."""
    today = datetime.now(UTC)
    target_date = today.replace(day=today.day + days)

    query = (
        select(Container)
        .options(
            selectinload(Container.items).selectinload(ContainerItem.product),
            selectinload(Container.backorders),
        )
        .where(
            and_(
                Container.estimated_arrival_date.isnot(None),
                Container.estimated_arrival_date >= today,
                Container.estimated_arrival_date <= target_date,
                Container.status.in_(
                    [
                        ContainerStatus.BOOKED,
                        ContainerStatus.IN_TRANSIT,
                        ContainerStatus.AT_PORT,
                        ContainerStatus.CUSTOMS_CLEARANCE,
                    ]
                ),
            )
        )
        .order_by(Container.estimated_arrival_date.asc())
    )

    result = await db.execute(query)
    containers = result.scalars().all()

    items = []
    for container in containers:
        container_dict = container.to_dict()
        container_dict["items"] = [item.to_dict() for item in container.items]
        container_dict["backorders"] = [
            backorder.to_dict() for backorder in container.backorders
        ]
        items.append(ContainerResponse(**container_dict))

    return items


@router.get("/{container_id}", response_model=ContainerResponse)
async def get_container(
    container_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> ContainerResponse:
    """Get container by ID with all details."""
    query = (
        select(Container)
        .options(
            selectinload(Container.items).selectinload(ContainerItem.product),
            selectinload(Container.backorders),
            selectinload(Container.purchase_order),
        )
        .where(Container.id == container_id)
    )

    result = await db.execute(query)
    container = result.scalar_one_or_none()

    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    container_dict = container.to_dict()
    container_dict["items"] = [item.to_dict() for item in container.items]
    container_dict["backorders"] = [
        backorder.to_dict() for backorder in container.backorders
    ]

    return ContainerResponse(**container_dict)


@router.post("", response_model=ContainerResponse, status_code=201)
async def create_container(
    container_data: ContainerCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> ContainerResponse:
    """Create a new container."""
    # Check for duplicate container number
    existing = await db.execute(
        select(Container).where(
            Container.container_number == container_data.container_number
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Container number '{container_data.container_number}' already exists",
        )

    # Verify purchase order exists if provided
    if container_data.purchase_order_id:
        po_result = await db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.id == container_data.purchase_order_id
            )
        )
        if not po_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Purchase order not found")

    # Verify supplier exists if provided
    if container_data.supplier_id:
        supplier_result = await db.execute(
            select(Supplier).where(Supplier.id == container_data.supplier_id)
        )
        if not supplier_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Supplier not found")

    # Create container
    container_dict = container_data.model_dump(exclude={"items"})
    container = Container(**container_dict, created_by=current_user.id)

    db.add(container)
    await db.flush()  # Get container.id

    # Create container items
    for item_data in container_data.items:
        # Verify product exists
        product_result = await db.execute(
            select(Product).where(Product.id == item_data.product_id)
        )
        if not product_result.scalar_one_or_none():
            raise HTTPException(
                status_code=404, detail=f"Product {item_data.product_id} not found"
            )

        item = ContainerItem(
            container_id=container.id,
            product_id=item_data.product_id,
            quantity_ordered=item_data.quantity_ordered,
            unit_cost=item_data.unit_cost,
        )
        db.add(item)

    await db.commit()
    await db.refresh(container)

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "container.created",
        payload={
            "container_id": str(container.id),
            "container_number": container.container_number,
            "estimated_arrival_date": (
                container.estimated_arrival_date.isoformat()
                if container.estimated_arrival_date
                else None
            ),
            "status": container.status.value,
        },
        source="api",
    )

    # Load relationships for response
    await db.refresh(container, ["items", "backorders"])

    # Broadcast WebSocket update
    await broadcast_container_update(
        container_id=str(container.id),
        action="created",
        data={
            "container_id": str(container.id),
            "container_number": container.container_number,
            "status": container.status.value,
            "estimated_arrival_date": (
                container.estimated_arrival_date.isoformat()
                if container.estimated_arrival_date
                else None
            ),
            "days_until_arrival": container.days_until_arrival,
        },
    )

    container_dict = container.to_dict()
    container_dict["items"] = [item.to_dict() for item in container.items]
    container_dict["backorders"] = []

    return ContainerResponse(**container_dict)


@router.put("/{container_id}", response_model=ContainerResponse)
async def update_container(
    container_id: UUID,
    container_data: ContainerUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> ContainerResponse:
    """Update container details."""
    result = await db.execute(
        select(Container)
        .options(selectinload(Container.items), selectinload(Container.backorders))
        .where(Container.id == container_id)
    )
    container = result.scalar_one_or_none()

    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    # Track if ETA changed (for backorder updates)
    eta_changed = False
    old_eta = container.estimated_arrival_date

    # Update fields
    update_data = container_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(container, field, value)
        if field == "estimated_arrival_date" and value != old_eta:
            eta_changed = True

    container.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(container)

    # If ETA changed, update all linked backorders
    if eta_changed and container.estimated_arrival_date:
        backorder_query = select(Backorder).where(
            Backorder.container_id == container.id
        )
        backorder_result = await db.execute(backorder_query)
        backorders = backorder_result.scalars().all()

        for backorder in backorders:
            backorder.expected_availability_date = container.estimated_arrival_date
            backorder.updated_at = datetime.now(UTC)

        await db.commit()

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "container.updated",
        payload={
            "container_id": str(container.id),
            "container_number": container.container_number,
            "status": container.status.value,
            "eta_changed": eta_changed,
        },
        source="api",
    )

    # Broadcast WebSocket update
    action = "eta_updated" if eta_changed else "updated"
    await broadcast_container_update(
        container_id=str(container.id),
        action=action,
        data={
            "container_id": str(container.id),
            "container_number": container.container_number,
            "status": container.status.value,
            "estimated_arrival_date": (
                container.estimated_arrival_date.isoformat()
                if container.estimated_arrival_date
                else None
            ),
            "days_until_arrival": container.days_until_arrival,
        },
    )

    container_dict = container.to_dict()
    container_dict["items"] = [item.to_dict() for item in container.items]
    container_dict["backorders"] = [
        backorder.to_dict() for backorder in container.backorders
    ]

    return ContainerResponse(**container_dict)


@router.post("/{container_id}/receive", response_model=ContainerResponse)
async def receive_container(
    container_id: UUID,
    receive_data: ContainerReceiveRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> ContainerResponse:
    """
    Mark container as received and update stock levels.

    This will:
    1. Update container status to DELIVERED
    2. Update item quantities received
    3. Add stock to warehouse inventory
    4. Trigger backorder fulfillment for pre-allocated items
    5. Send notifications
    """
    result = await db.execute(
        select(Container)
        .options(
            selectinload(Container.items).selectinload(ContainerItem.product),
            selectinload(Container.backorders),
        )
        .where(Container.id == container_id)
    )
    container = result.scalar_one_or_none()

    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    if container.status == ContainerStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Container already received")

    # Update container
    container.status = ContainerStatus.DELIVERED
    container.actual_arrival_date = (
        receive_data.actual_arrival_date or datetime.now(UTC)
    )
    container.delivered_date = datetime.now(UTC)
    if receive_data.notes:
        container.notes = (
            f"{container.notes}\n\n{receive_data.notes}"
            if container.notes
            else receive_data.notes
        )
    container.updated_at = datetime.now(UTC)

    # Update container items
    item_updates_by_id = {
        str(item.product_id): item for item in receive_data.items
    }

    for container_item in container.items:
        if str(container_item.product_id) in item_updates_by_id:
            update = item_updates_by_id[str(container_item.product_id)]
            if update.quantity_received is not None:
                container_item.quantity_received = update.quantity_received
            if update.quantity_damaged is not None:
                container_item.quantity_damaged = update.quantity_damaged
            if update.quality_checked is not None:
                container_item.quality_checked = update.quality_checked
            if update.quality_notes is not None:
                container_item.quality_notes = update.quality_notes
            container_item.updated_at = datetime.now(UTC)

    await db.commit()

    # TODO: Add stock to warehouse inventory
    # This will be implemented when we add ProductStockByLocation updates

    # Publish event to trigger backorder fulfillment
    event_bus = get_event_bus()
    await event_bus.publish(
        "container.received",
        payload={
            "container_id": str(container.id),
            "container_number": container.container_number,
            "warehouse": container.destination_warehouse,
            "items": [
                {
                    "product_id": str(item.product_id),
                    "quantity_received": item.quantity_received,
                    "quantity_available": item.quantity_available,
                }
                for item in container.items
            ],
        },
        source="api",
    )

    # Create alert for successful receipt
    alert_manager = get_alert_manager()
    await alert_manager.create_alert(
        db=db,
        alert_type="container_arrival",
        severity="low",
        title=f"Container {container.container_number} Received",
        message=f"Container {container.container_number} has been received at {container.destination_warehouse} warehouse.",
        entity_type="container",
        entity_id=container.id,
        assign_to_role="warehouse_manager",
        metadata={
            "container_number": container.container_number,
            "warehouse": container.destination_warehouse,
            "item_count": len(container.items),
        },
    )

    await db.refresh(container)

    # Broadcast WebSocket update
    await broadcast_container_update(
        container_id=str(container.id),
        action="received",
        data={
            "container_id": str(container.id),
            "container_number": container.container_number,
            "status": container.status.value,
            "actual_arrival_date": (
                container.actual_arrival_date.isoformat()
                if container.actual_arrival_date
                else None
            ),
        },
    )

    container_dict = container.to_dict()
    container_dict["items"] = [item.to_dict() for item in container.items]
    container_dict["backorders"] = [
        backorder.to_dict() for backorder in container.backorders
    ]

    return ContainerResponse(**container_dict)


@router.delete("/{container_id}", status_code=204)
async def delete_container(
    container_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> None:
    """Delete a container (only if not yet received)."""
    result = await db.execute(
        select(Container)
        .options(selectinload(Container.backorders))
        .where(Container.id == container_id)
    )
    container = result.scalar_one_or_none()

    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    # Prevent deletion if container already received
    if container.status == ContainerStatus.DELIVERED:
        raise HTTPException(
            status_code=400, detail="Cannot delete received containers"
        )

    # Prevent deletion if there are allocated backorders
    if container.backorders:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete container with {len(container.backorders)} allocated backorders",
        )

    # Store container number before deletion for broadcasting
    container_number = container.container_number

    await db.delete(container)
    await db.commit()

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "container.deleted",
        payload={
            "container_id": str(container_id),
            "container_number": container_number,
        },
        source="api",
    )

    # Broadcast WebSocket update
    await broadcast_container_update(
        container_id=str(container_id),
        action="deleted",
        data={
            "container_id": str(container_id),
            "container_number": container_number,
        },
    )
