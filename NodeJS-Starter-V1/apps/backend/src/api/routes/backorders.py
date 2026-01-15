"""Backorder management API endpoints."""

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
from src.db.container_models import Backorder, BackorderStatus, Container
from src.db.erp_models import Customer, Order, Product
from src.db.models import User
from src.events.event_bus import get_event_bus
from src.services.alert_manager import get_alert_manager
from src.services.email_notifications import email_service
from src.websockets.events import broadcast_backorder_update

router = APIRouter(prefix="/api/backorders", tags=["Backorder Management"])


# Pydantic Models
class BackorderCreate(BaseModel):
    """Backorder creation schema."""

    order_id: UUID
    order_item_id: UUID | None = None
    product_id: UUID
    customer_id: UUID | None = None
    quantity_backordered: int = Field(gt=0)
    fulfillment_location: str = Field(default="brisbane", max_length=50)
    container_id: UUID | None = None
    expected_availability_date: datetime | None = None
    priority: int = Field(default=0, ge=0)
    notes: str | None = None
    internal_notes: str | None = None


class BackorderUpdate(BaseModel):
    """Backorder update schema."""

    quantity_backordered: int | None = Field(default=None, gt=0)
    quantity_fulfilled: int | None = Field(default=None, ge=0)
    fulfillment_location: str | None = None
    container_id: UUID | None = None
    expected_availability_date: datetime | None = None
    status: BackorderStatus | None = None
    priority: int | None = Field(default=None, ge=0)
    notes: str | None = None
    internal_notes: str | None = None


class BackorderAllocateRequest(BaseModel):
    """Request to allocate backorder to container."""

    container_id: UUID
    expected_availability_date: datetime | None = None


class BackorderFulfillRequest(BaseModel):
    """Request to fulfill a backorder."""

    quantity_fulfilled: int = Field(gt=0)
    notes: str | None = None


class BackorderNotifyRequest(BaseModel):
    """Request to send customer notification."""

    notification_type: str = Field(
        description="eta_update, in_stock, delayed, cancelled"
    )
    custom_message: str | None = None


class BackorderResponse(BaseModel):
    """Backorder response schema."""

    id: str
    order_id: str
    order_item_id: str | None
    product_id: str
    customer_id: str | None
    quantity_backordered: int
    quantity_fulfilled: int
    quantity_remaining: int
    fulfillment_location: str
    container_id: str | None
    expected_availability_date: str | None
    original_order_date: str
    status: str
    customer_notified: bool
    last_notification_date: str | None
    notification_count: int
    priority: int
    notes: str | None
    internal_notes: str | None
    is_overdue: bool
    days_until_available: int | None
    days_outstanding: int
    created_at: str
    updated_at: str
    fulfilled_at: str | None
    product: dict[str, Any] | None = None
    customer: dict[str, Any] | None = None
    container: dict[str, Any] | None = None


class BackorderListResponse(BaseModel):
    """Backorder list response with pagination."""

    items: list[BackorderResponse]
    total: int
    page: int
    page_size: int


@router.get("", response_model=BackorderListResponse)
async def list_backorders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: BackorderStatus | None = None,
    customer_id: UUID | None = None,
    product_id: UUID | None = None
,
    fulfillment_location: str | None = None,
    overdue_only: bool = False,
    search: str | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> BackorderListResponse:
    """List all backorders with filtering and pagination."""
    query = select(Backorder).options(
        selectinload(Backorder.product),
        selectinload(Backorder.customer),
        selectinload(Backorder.container),
        selectinload(Backorder.order),
    )

    # Apply filters
    filters = []

    if status:
        filters.append(Backorder.status == status)

    if customer_id:
        filters.append(Backorder.customer_id == customer_id)

    if product_id:
        filters.append(Backorder.product_id == product_id)

    if fulfillment_location:
        filters.append(Backorder.fulfillment_location == fulfillment_location)

    if overdue_only:
        # Show overdue backorders
        today = datetime.now(UTC)
        filters.append(
            and_(
                Backorder.expected_availability_date.isnot(None),
                Backorder.expected_availability_date < today,
                Backorder.status != BackorderStatus.FULFILLED,
            )
        )

    if search:
        # Search by customer name or product SKU/name (would need joins)
        # For now, just search internal notes
        filters.append(
            or_(
                Backorder.notes.ilike(f"%{search}%"),
                Backorder.internal_notes.ilike(f"%{search}%"),
            )
        )

    if filters:
        query = query.where(and_(*filters))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Apply pagination and ordering (priority desc, oldest first)
    query = (
        query.order_by(
            Backorder.priority.desc(),
            Backorder.original_order_date.asc(),
        )
        .limit(page_size)
        .offset((page - 1) * page_size)
    )

    # Execute query
    result = await db.execute(query)
    backorders = result.scalars().all()

    # Convert to response models
    items = []
    for backorder in backorders:
        backorder_dict = backorder.to_dict()
        backorder_dict["product"] = (
            {"id": str(backorder.product.id), "sku": backorder.product.sku, "name": backorder.product.name}
            if backorder.product
            else None
        )
        backorder_dict["customer"] = (
            {"id": str(backorder.customer.id), "company_name": backorder.customer.company_name}
            if backorder.customer
            else None
        )
        backorder_dict["container"] = (
            backorder.container.to_dict() if backorder.container else None
        )
        items.append(BackorderResponse(**backorder_dict))

    return BackorderListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get("/pending", response_model=list[BackorderResponse])
async def get_pending_backorders(
    fulfillment_location: str | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> list[BackorderResponse]:
    """Get pending backorders (for dashboard widget)."""
    query = (
        select(Backorder)
        .options(
            selectinload(Backorder.product),
            selectinload(Backorder.customer),
            selectinload(Backorder.container),
        )
        .where(Backorder.status == BackorderStatus.PENDING)
    )

    if fulfillment_location:
        query = query.where(Backorder.fulfillment_location == fulfillment_location)

    query = query.order_by(
        Backorder.priority.desc(), Backorder.original_order_date.asc()
    ).limit(10)

    result = await db.execute(query)
    backorders = result.scalars().all()

    items = []
    for backorder in backorders:
        backorder_dict = backorder.to_dict()
        backorder_dict["product"] = (
            {"id": str(backorder.product.id), "sku": backorder.product.sku, "name": backorder.product.name}
            if backorder.product
            else None
        )
        backorder_dict["customer"] = (
            {"id": str(backorder.customer.id), "company_name": backorder.customer.company_name}
            if backorder.customer
            else None
        )
        backorder_dict["container"] = (
            backorder.container.to_dict() if backorder.container else None
        )
        items.append(BackorderResponse(**backorder_dict))

    return items


@router.get("/{backorder_id}", response_model=BackorderResponse)
async def get_backorder(
    backorder_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> BackorderResponse:
    """Get backorder by ID with all details."""
    query = (
        select(Backorder)
        .options(
            selectinload(Backorder.product),
            selectinload(Backorder.customer),
            selectinload(Backorder.container),
            selectinload(Backorder.order),
        )
        .where(Backorder.id == backorder_id)
    )

    result = await db.execute(query)
    backorder = result.scalar_one_or_none()

    if not backorder:
        raise HTTPException(status_code=404, detail="Backorder not found")

    backorder_dict = backorder.to_dict()
    backorder_dict["product"] = (
        backorder.product.to_dict() if backorder.product else None
    )
    backorder_dict["customer"] = (
        backorder.customer.to_dict() if backorder.customer else None
    )
    backorder_dict["container"] = (
        backorder.container.to_dict() if backorder.container else None
    )

    return BackorderResponse(**backorder_dict)


@router.post("", response_model=BackorderResponse, status_code=201)
async def create_backorder(
    backorder_data: BackorderCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> BackorderResponse:
    """Create a new backorder."""
    # Verify order exists
    order_result = await db.execute(
        select(Order).where(Order.id == backorder_data.order_id)
    )
    if not order_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify product exists
    product_result = await db.execute(
        select(Product).where(Product.id == backorder_data.product_id)
    )
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    # Verify customer exists if provided
    if backorder_data.customer_id:
        customer_result = await db.execute(
            select(Customer).where(Customer.id == backorder_data.customer_id)
        )
        if not customer_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Customer not found")

    # Verify container exists if provided
    if backorder_data.container_id:
        container_result = await db.execute(
            select(Container).where(Container.id == backorder_data.container_id)
        )
        container = container_result.scalar_one_or_none()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")

        # Auto-set ETA from container if not provided
        if not backorder_data.expected_availability_date:
            backorder_data.expected_availability_date = (
                container.estimated_arrival_date
            )

    # Create backorder
    backorder = Backorder(
        **backorder_data.model_dump(),
        original_order_date=datetime.now(UTC),
        created_by=current_user.id,
    )

    db.add(backorder)
    await db.commit()
    await db.refresh(backorder)

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "backorder.created",
        payload={
            "backorder_id": str(backorder.id),
            "order_id": str(backorder.order_id),
            "product_id": str(backorder.product_id),
            "quantity": backorder.quantity_backordered,
            "expected_availability_date": (
                backorder.expected_availability_date.isoformat()
                if backorder.expected_availability_date
                else None
            ),
        },
        source="api",
    )

    # Create alert for new backorder
    alert_manager = get_alert_manager()
    await alert_manager.create_alert(
        db=db,
        alert_type="backorder_created",
        severity="medium",
        title="New Backorder Created",
        message=f"Backorder created for order {backorder.order_id}: {backorder.quantity_backordered} units",
        entity_type="backorder",
        entity_id=backorder.id,
        assign_to_role="sales_manager",
        metadata={
            "order_id": str(backorder.order_id),
            "product_id": str(backorder.product_id),
            "quantity": backorder.quantity_backordered,
        },
    )

    # Load relationships for response
    await db.refresh(backorder, ["product", "customer", "container"])

    # Broadcast WebSocket update
    await broadcast_backorder_update(
        backorder_id=str(backorder.id),
        action="created",
        data={
            "backorder_id": str(backorder.id),
            "product_name": backorder.product.name if backorder.product else None,
            "customer_name": backorder.customer.company_name if backorder.customer else None,
            "status": backorder.status.value,
            "quantity_remaining": backorder.quantity_remaining,
        },
    )

    backorder_dict = backorder.to_dict()
    backorder_dict["product"] = (
        backorder.product.to_dict() if backorder.product else None
    )
    backorder_dict["customer"] = (
        backorder.customer.to_dict() if backorder.customer else None
    )
    backorder_dict["container"] = (
        backorder.container.to_dict() if backorder.container else None
    )

    return BackorderResponse(**backorder_dict)


@router.put("/{backorder_id}", response_model=BackorderResponse)
async def update_backorder(
    backorder_id: UUID,
    backorder_data: BackorderUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> BackorderResponse:
    """Update backorder details."""
    result = await db.execute(
        select(Backorder)
        .options(
            selectinload(Backorder.product),
            selectinload(Backorder.customer),
            selectinload(Backorder.container),
        )
        .where(Backorder.id == backorder_id)
    )
    backorder = result.scalar_one_or_none()

    if not backorder:
        raise HTTPException(status_code=404, detail="Backorder not found")

    # Verify container exists if being updated
    if (
        backorder_data.container_id
        and backorder_data.container_id != backorder.container_id
    ):
        container_result = await db.execute(
            select(Container).where(Container.id == backorder_data.container_id)
        )
        container = container_result.scalar_one_or_none()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")

        # Auto-update ETA if container changed
        if container.estimated_arrival_date:
            backorder.expected_availability_date = container.estimated_arrival_date

    # Update fields
    update_data = backorder_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(backorder, field, value)

    backorder.updated_at = datetime.now(UTC)

    # Auto-update status based on quantity
    if backorder.quantity_fulfilled >= backorder.quantity_backordered:
        backorder.status = BackorderStatus.FULFILLED
        backorder.fulfilled_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(backorder)

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "backorder.updated",
        payload={
            "backorder_id": str(backorder.id),
            "status": backorder.status.value,
            "quantity_remaining": backorder.quantity_remaining,
        },
        source="api",
    )

    # Broadcast WebSocket update
    await broadcast_backorder_update(
        backorder_id=str(backorder.id),
        action="updated",
        data={
            "backorder_id": str(backorder.id),
            "product_name": backorder.product.name if backorder.product else None,
            "customer_name": backorder.customer.company_name if backorder.customer else None,
            "status": backorder.status.value,
            "quantity_remaining": backorder.quantity_remaining,
        },
    )

    backorder_dict = backorder.to_dict()
    backorder_dict["product"] = (
        backorder.product.to_dict() if backorder.product else None
    )
    backorder_dict["customer"] = (
        backorder.customer.to_dict() if backorder.customer else None
    )
    backorder_dict["container"] = (
        backorder.container.to_dict() if backorder.container else None
    )

    return BackorderResponse(**backorder_dict)


@router.post("/{backorder_id}/allocate", response_model=BackorderResponse)
async def allocate_backorder(
    backorder_id: UUID,
    allocate_data: BackorderAllocateRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> BackorderResponse:
    """Allocate backorder to an incoming container."""
    # Get backorder
    result = await db.execute(
        select(Backorder)
        .options(
            selectinload(Backorder.product),
            selectinload(Backorder.customer),
        )
        .where(Backorder.id == backorder_id)
    )
    backorder = result.scalar_one_or_none()

    if not backorder:
        raise HTTPException(status_code=404, detail="Backorder not found")

    if backorder.status == BackorderStatus.FULFILLED:
        raise HTTPException(status_code=400, detail="Backorder already fulfilled")

    # Get container
    container_result = await db.execute(
        select(Container).where(Container.id == allocate_data.container_id)
    )
    container = container_result.scalar_one_or_none()

    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    # Update backorder
    backorder.container_id = container.id
    backorder.status = BackorderStatus.ALLOCATED
    backorder.expected_availability_date = (
        allocate_data.expected_availability_date or container.estimated_arrival_date
    )
    backorder.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(backorder, ["container"])

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "backorder.allocated",
        payload={
            "backorder_id": str(backorder.id),
            "container_id": str(container.id),
            "container_number": container.container_number,
            "expected_availability_date": (
                backorder.expected_availability_date.isoformat()
                if backorder.expected_availability_date
                else None
            ),
        },
        source="api",
    )

    # Create alert
    alert_manager = get_alert_manager()
    await alert_manager.create_alert(
        db=db,
        alert_type="backorder_allocated",
        severity="low",
        title="Backorder Allocated to Container",
        message=f"Backorder allocated to container {container.container_number}. ETA: {backorder.expected_availability_date.strftime('%Y-%m-%d') if backorder.expected_availability_date else 'TBD'}",
        entity_type="backorder",
        entity_id=backorder.id,
        assign_to_role="sales_manager",
    )

    # Broadcast WebSocket update
    await broadcast_backorder_update(
        backorder_id=str(backorder.id),
        action="allocated",
        data={
            "backorder_id": str(backorder.id),
            "product_name": backorder.product.name if backorder.product else None,
            "customer_name": backorder.customer.company_name if backorder.customer else None,
            "status": backorder.status.value,
            "quantity_remaining": backorder.quantity_remaining,
        },
    )

    backorder_dict = backorder.to_dict()
    backorder_dict["product"] = (
        backorder.product.to_dict() if backorder.product else None
    )
    backorder_dict["customer"] = (
        backorder.customer.to_dict() if backorder.customer else None
    )
    backorder_dict["container"] = (
        backorder.container.to_dict() if backorder.container else None
    )

    return BackorderResponse(**backorder_dict)


@router.post("/{backorder_id}/fulfill", response_model=BackorderResponse)
async def fulfill_backorder(
    backorder_id: UUID,
    fulfill_data: BackorderFulfillRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> BackorderResponse:
    """Fulfill a backorder (partial or complete)."""
    result = await db.execute(
        select(Backorder)
        .options(
            selectinload(Backorder.product),
            selectinload(Backorder.customer),
            selectinload(Backorder.container),
        )
        .where(Backorder.id == backorder_id)
    )
    backorder = result.scalar_one_or_none()

    if not backorder:
        raise HTTPException(status_code=404, detail="Backorder not found")

    if backorder.status == BackorderStatus.FULFILLED:
        raise HTTPException(status_code=400, detail="Backorder already fulfilled")

    # Validate quantity
    new_fulfilled = backorder.quantity_fulfilled + fulfill_data.quantity_fulfilled
    if new_fulfilled > backorder.quantity_backordered:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot fulfill {fulfill_data.quantity_fulfilled} units. Only {backorder.quantity_remaining} remaining.",
        )

    # Update backorder
    backorder.quantity_fulfilled = new_fulfilled
    backorder.updated_at = datetime.now(UTC)

    if fulfill_data.notes:
        backorder.notes = (
            f"{backorder.notes}\n\n{fulfill_data.notes}"
            if backorder.notes
            else fulfill_data.notes
        )

    # Check if fully fulfilled
    if backorder.quantity_fulfilled >= backorder.quantity_backordered:
        backorder.status = BackorderStatus.FULFILLED
        backorder.fulfilled_at = datetime.now(UTC)
    elif backorder.quantity_fulfilled > 0:
        backorder.status = BackorderStatus.READY

    await db.commit()
    await db.refresh(backorder)

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "backorder.fulfilled",
        payload={
            "backorder_id": str(backorder.id),
            "order_id": str(backorder.order_id),
            "product_id": str(backorder.product_id),
            "quantity_fulfilled": fulfill_data.quantity_fulfilled,
            "quantity_remaining": backorder.quantity_remaining,
            "fully_fulfilled": backorder.status == BackorderStatus.FULFILLED,
        },
        source="api",
    )

    # Create alert
    alert_manager = get_alert_manager()
    await alert_manager.create_alert(
        db=db,
        alert_type="backorder_fulfilled",
        severity="low",
        title="Backorder Fulfilled",
        message=f"Backorder fulfilled: {fulfill_data.quantity_fulfilled} units. Remaining: {backorder.quantity_remaining}",
        entity_type="backorder",
        entity_id=backorder.id,
        assign_to_role="sales_manager",
    )

    # Broadcast WebSocket update
    await broadcast_backorder_update(
        backorder_id=str(backorder.id),
        action="fulfilled",
        data={
            "backorder_id": str(backorder.id),
            "product_name": backorder.product.name if backorder.product else None,
            "customer_name": backorder.customer.company_name if backorder.customer else None,
            "status": backorder.status.value,
            "quantity_remaining": backorder.quantity_remaining,
        },
    )

    backorder_dict = backorder.to_dict()
    backorder_dict["product"] = (
        backorder.product.to_dict() if backorder.product else None
    )
    backorder_dict["customer"] = (
        backorder.customer.to_dict() if backorder.customer else None
    )
    backorder_dict["container"] = (
        backorder.container.to_dict() if backorder.container else None
    )

    return BackorderResponse(**backorder_dict)


@router.post("/{backorder_id}/notify", status_code=204)
async def notify_customer(
    backorder_id: UUID,
    notify_data: BackorderNotifyRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> None:
    """Send customer notification about backorder status."""
    result = await db.execute(
        select(Backorder)
        .options(
            selectinload(Backorder.product),
            selectinload(Backorder.customer),
            selectinload(Backorder.order),
            selectinload(Backorder.container),
        )
        .where(Backorder.id == backorder_id)
    )
    backorder = result.scalar_one_or_none()

    if not backorder:
        raise HTTPException(status_code=404, detail="Backorder not found")

    if not backorder.customer:
        raise HTTPException(status_code=400, detail="No customer associated with backorder")

    if not backorder.customer.email:
        raise HTTPException(status_code=400, detail="Customer has no email address")

    # Send email notification
    email_sent = email_service.send_backorder_notification(
        backorder_id=str(backorder.id),
        customer_email=backorder.customer.email,
        customer_name=backorder.customer.company_name or backorder.customer.contact_name,
        product_name=backorder.product.name if backorder.product else "Unknown Product",
        product_sku=backorder.product.sku if backorder.product else "N/A",
        quantity=backorder.quantity_remaining,
        order_number=backorder.order.order_number if backorder.order else "N/A",
        expected_date=backorder.expected_availability_date,
        container_number=backorder.container.container_number if backorder.container else None,
        priority=backorder.priority,
    )

    # Update notification tracking
    backorder.customer_notified = True
    backorder.last_notification_date = datetime.now(UTC)
    backorder.notification_count += 1
    backorder.updated_at = datetime.now(UTC)

    await db.commit()

    # TODO: Publish event when event bus is initialized
    # event_bus = get_event_bus()
    # await event_bus.publish(
    #     "backorder.customer_notified",
    #     payload={
    #         "backorder_id": str(backorder.id),
    #         "customer_id": str(backorder.customer_id),
    #         "notification_type": notify_data.notification_type,
    #         "email_sent": email_sent,
    #     },
    #     source="api",
    # )


@router.delete("/{backorder_id}", status_code=204)
async def cancel_backorder(
    backorder_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User | None = Depends(get_optional_user),
) -> None:
    """Cancel a backorder (soft delete - sets status to CANCELLED)."""
    result = await db.execute(
        select(Backorder).where(Backorder.id == backorder_id)
    )
    backorder = result.scalar_one_or_none()

    if not backorder:
        raise HTTPException(status_code=404, detail="Backorder not found")

    if backorder.status == BackorderStatus.FULFILLED:
        raise HTTPException(status_code=400, detail="Cannot cancel fulfilled backorder")

    # Get product/customer info before commit (for WebSocket broadcast)
    product_stmt = select(Product).where(Product.id == backorder.product_id)
    product_result = await db.execute(product_stmt)
    product = product_result.scalar_one_or_none()

    customer_stmt = select(Customer).where(Customer.id == backorder.customer_id)
    customer_result = await db.execute(customer_stmt)
    customer = customer_result.scalar_one_or_none()

    # Soft delete - set status to CANCELLED
    backorder.status = BackorderStatus.CANCELLED
    backorder.updated_at = datetime.now(UTC)

    await db.commit()

    # Publish event
    event_bus = get_event_bus()
    await event_bus.publish(
        "backorder.cancelled",
        payload={
            "backorder_id": str(backorder_id),
            "order_id": str(backorder.order_id),
        },
        source="api",
    )

    # Broadcast WebSocket update
    await broadcast_backorder_update(
        backorder_id=str(backorder_id),
        action="cancelled",
        data={
            "backorder_id": str(backorder_id),
            "product_name": product.name if product else None,
            "customer_name": customer.company_name if customer else None,
            "status": BackorderStatus.CANCELLED.value,
        },
    )
