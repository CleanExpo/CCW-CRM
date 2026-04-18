"""API routes for service request management."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.inventory_models import ProductStockByLocation, StockAdjustment
from src.db.service_models import RequestType, ServiceRequest, ServiceRequestPart, ServiceStatus
from src.db.workflow_models import SLAInstance, SLARule

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/service-requests", tags=["Service Requests"], dependencies=[Depends(get_current_user)])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ServiceRequestCreate(BaseModel):
    """Create service request schema."""

    customer_id: UUID
    request_type: RequestType
    equipment_description: str = Field(min_length=1, max_length=5000)
    issue_description: str = Field(min_length=1, max_length=5000)
    photos: list[str] | None = None


class ServiceRequestUpdate(BaseModel):
    """Update service request schema."""

    status: ServiceStatus | None = None
    assigned_technician: str | None = None
    scheduled_date: str | None = None  # ISO format datetime string
    quote_amount: float | None = None
    approved_amount: float | None = None
    order_id: UUID | None = None


class ServiceRequestResponse(BaseModel):
    """Service request response schema."""

    id: UUID
    customer_id: UUID
    order_id: UUID | None
    request_type: str
    status: str
    equipment_description: str
    issue_description: str
    photos: list[str] | None
    assigned_technician: str | None
    scheduled_date: str | None
    quote_amount: float | None
    approved_amount: float | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PaginatedServiceRequestsResponse(BaseModel):
    """Paginated service requests response."""

    items: list[ServiceRequestResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ServiceRequestPartCreate(BaseModel):
    """Add a part to a service request."""

    product_id: UUID
    quantity: int = Field(ge=1)
    location: str = Field(default="brisbane", description="Warehouse location the part is taken from")


class ServiceRequestPartResponse(BaseModel):
    """Service request part response."""

    id: UUID
    service_request_id: UUID
    product_id: UUID
    location: str
    quantity: int
    is_finalized: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Internal stock helpers
# ---------------------------------------------------------------------------

async def _deduct_stock(
    db: AsyncSession,
    product_id: UUID,
    location: str,
    qty: int,
    service_request_id: UUID,
) -> ProductStockByLocation:
    """Deduct qty from ProductStockByLocation and log a StockAdjustment.

    Raises HTTPException(409) if available stock is insufficient.
    """
    stock_result = await db.execute(
        select(ProductStockByLocation).where(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == location,
        )
    )
    stock_row = stock_result.scalar_one_or_none()

    if not stock_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No stock record for product {product_id} at location {location}",
        )

    available = stock_row.stock - stock_row.reserved
    if available < qty:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Insufficient stock at {location}: "
                f"requested {qty}, available {available}"
            ),
        )

    prev_qty = stock_row.stock
    stock_row.stock -= qty

    adjustment = StockAdjustment(
        product_id=product_id,
        location=location,
        quantity_change=-qty,
        previous_quantity=prev_qty,
        new_quantity=stock_row.stock,
        adjustment_type="workshop_part",
        reason=f"Parts used in service request {service_request_id}",
        reference_id=service_request_id,
    )
    db.add(adjustment)

    logger.info(
        "workshop_part_stock_deducted",
        product_id=str(product_id),
        location=location,
        qty=qty,
        prev_stock=prev_qty,
        new_stock=stock_row.stock,
        service_request_id=str(service_request_id),
    )
    return stock_row


async def _restore_stock(
    db: AsyncSession,
    product_id: UUID,
    location: str,
    qty: int,
    service_request_id: UUID,
) -> None:
    """Restore qty to ProductStockByLocation and log a reversal StockAdjustment."""
    stock_result = await db.execute(
        select(ProductStockByLocation).where(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == location,
        )
    )
    stock_row = stock_result.scalar_one_or_none()

    if not stock_row:
        logger.warning(
            "workshop_part_restore_stock_not_found",
            product_id=str(product_id),
            location=location,
        )
        return

    prev_qty = stock_row.stock
    stock_row.stock += qty

    adjustment = StockAdjustment(
        product_id=product_id,
        location=location,
        quantity_change=qty,
        previous_quantity=prev_qty,
        new_quantity=stock_row.stock,
        adjustment_type="workshop_part_reversal",
        reason=f"Parts restored from service request {service_request_id}",
        reference_id=service_request_id,
    )
    db.add(adjustment)

    logger.info(
        "workshop_part_stock_restored",
        product_id=str(product_id),
        location=location,
        qty=qty,
        prev_stock=prev_qty,
        new_stock=stock_row.stock,
        service_request_id=str(service_request_id),
    )


# ---------------------------------------------------------------------------
# Service request CRUD
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service_request(
    request: ServiceRequestCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ServiceRequestResponse:
    """Create a new service request."""

    service_request = ServiceRequest(
        customer_id=request.customer_id,
        request_type=request.request_type,
        equipment_description=request.equipment_description,
        issue_description=request.issue_description,
        photos=request.photos,
        status=ServiceStatus.submitted,
    )

    db.add(service_request)
    await db.commit()
    await db.refresh(service_request)

    # Auto-create SLA instance if a matching rule exists for service_request entity type
    try:
        sla_rule_result = await db.execute(
            select(SLARule).where(
                SLARule.entity_type == "service_request",
                SLARule.is_active == True,  # noqa: E712
            ).limit(1)
        )
        sla_rule = sla_rule_result.scalar_one_or_none()
        if sla_rule:
            from datetime import timedelta
            sla_instance = SLAInstance(
                sla_rule_id=sla_rule.id,
                entity_id=service_request.id,
                entity_type="service_request",
                deadline=datetime.now(UTC) + timedelta(hours=sla_rule.sla_hours),
            )
            db.add(sla_instance)
            await db.commit()
            logger.info(
                "service_request_sla_created",
                request_id=str(service_request.id),
                sla_rule_id=str(sla_rule.id),
                sla_hours=sla_rule.sla_hours,
            )
    except Exception as e:
        # SLA creation is non-critical — log and continue
        logger.warning("service_request_sla_creation_failed", error=str(e))

    return ServiceRequestResponse.model_validate(service_request)


@router.get("")
async def list_service_requests(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    customer_id: UUID | None = None,
    status: ServiceStatus | None = None,
    search: str | None = None,
) -> PaginatedServiceRequestsResponse:
    """List service requests with pagination and filters."""

    query = select(ServiceRequest)

    # Apply filters
    if customer_id:
        query = query.where(ServiceRequest.customer_id == customer_id)

    if status:
        query = query.where(ServiceRequest.status == status)

    if search:
        query = query.where(
            or_(
                ServiceRequest.equipment_description.ilike(f"%{search}%"),
                ServiceRequest.issue_description.ilike(f"%{search}%"),
                ServiceRequest.assigned_technician.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = (
        query.order_by(ServiceRequest.created_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )

    # Execute query
    result = await db.execute(query)
    requests = result.scalars().all()

    return PaginatedServiceRequestsResponse(
        items=[ServiceRequestResponse.model_validate(req) for req in requests],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{request_id}")
async def get_service_request(
    request_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ServiceRequestResponse:
    """Get a single service request by ID."""

    query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    result = await db.execute(query)
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )

    return ServiceRequestResponse.model_validate(service_request)


@router.patch("/{request_id}")
async def update_service_request(
    request_id: UUID,
    updates: ServiceRequestUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ServiceRequestResponse:
    """Update a service request.

    Status transitions that affect inventory:
    - → completed: finalises all parts (locked, cannot be removed).
    - completed → any other status (reopen): restores stock for all
      finalised parts and un-finalises them.
    - → cancelled: restores stock for non-finalised parts and deletes
      them (job abandoned, parts return to shelf).
    """

    query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    result = await db.execute(query)
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )

    # Handle status transitions that affect inventory
    if updates.status is not None and updates.status != service_request.status:
        old_status = service_request.status
        new_status = updates.status

        if new_status == ServiceStatus.completed:
            # Finalise all active parts — deduction is now permanent
            parts_result = await db.execute(
                select(ServiceRequestPart).where(
                    ServiceRequestPart.service_request_id == request_id,
                    ServiceRequestPart.is_finalized == False,  # noqa: E712
                )
            )
            for part in parts_result.scalars().all():
                part.is_finalized = True
            logger.info("service_request_parts_finalised", request_id=str(request_id))

        elif old_status == ServiceStatus.completed and new_status not in (
            ServiceStatus.completed,
            ServiceStatus.cancelled,
        ):
            # Reopen from completed → restore stock for all finalised parts
            parts_result = await db.execute(
                select(ServiceRequestPart).where(
                    ServiceRequestPart.service_request_id == request_id,
                    ServiceRequestPart.is_finalized == True,  # noqa: E712
                )
            )
            for part in parts_result.scalars().all():
                await _restore_stock(
                    db, part.product_id, part.location, part.quantity, request_id
                )
                part.is_finalized = False
            logger.info(
                "service_request_parts_unfinalized_on_reopen",
                request_id=str(request_id),
            )

        elif new_status == ServiceStatus.cancelled:
            # Cancellation: restore stock for non-finalised parts and delete them
            parts_result = await db.execute(
                select(ServiceRequestPart).where(
                    ServiceRequestPart.service_request_id == request_id,
                    ServiceRequestPart.is_finalized == False,  # noqa: E712
                )
            )
            for part in parts_result.scalars().all():
                await _restore_stock(
                    db, part.product_id, part.location, part.quantity, request_id
                )
                await db.delete(part)
            logger.info(
                "service_request_parts_restored_on_cancel",
                request_id=str(request_id),
            )

    # Apply scalar field updates
    if updates.status is not None:
        service_request.status = updates.status

    if updates.assigned_technician is not None:
        service_request.assigned_technician = updates.assigned_technician

    if updates.scheduled_date is not None:
        service_request.scheduled_date = datetime.fromisoformat(updates.scheduled_date)

    if updates.quote_amount is not None:
        service_request.quote_amount = updates.quote_amount

    if updates.approved_amount is not None:
        service_request.approved_amount = updates.approved_amount

    if updates.order_id is not None:
        service_request.order_id = updates.order_id

    await db.commit()
    await db.refresh(service_request)

    return ServiceRequestResponse.model_validate(service_request)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_service_request(
    request_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Delete a service request."""

    query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    result = await db.execute(query)
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )

    await db.delete(service_request)
    await db.commit()


@router.get("/{request_id}/sla")
async def get_service_request_sla(
    request_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get SLA status for a service request.

    Returns active and breached SLA deadlines linked to this service request.
    Useful for the service requests table and detail page to show time remaining.
    """
    query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    result = await db.execute(query)
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )

    sla_result = await db.execute(
        select(SLAInstance, SLARule)
        .join(SLARule, SLAInstance.sla_rule_id == SLARule.id)
        .where(SLAInstance.entity_id == request_id)
        .order_by(SLAInstance.deadline.asc())
    )
    rows = sla_result.all()

    now = datetime.now(UTC)
    sla_items = []
    for instance, rule in rows:
        deadline_aware = instance.deadline
        if deadline_aware.tzinfo is None:
            deadline_aware = deadline_aware.replace(tzinfo=UTC)
        minutes_remaining = int((deadline_aware - now).total_seconds() / 60)
        sla_items.append({
            "instance_id": str(instance.id),
            "rule_name": rule.name,
            "sla_hours": rule.sla_hours,
            "deadline": instance.deadline.isoformat(),
            "breached": instance.breached,
            "breach_notified": instance.breach_notified,
            "minutes_remaining": minutes_remaining,
            "status": "breached" if instance.breached else (
                "warning" if minutes_remaining < 60 else "on_track"
            ),
        })

    return {
        "service_request_id": str(request_id),
        "sla_count": len(sla_items),
        "has_breach": any(s["breached"] for s in sla_items),
        "slas": sla_items,
    }


# ---------------------------------------------------------------------------
# Parts endpoints — inventory integration
# ---------------------------------------------------------------------------

@router.post("/{request_id}/parts", status_code=status.HTTP_201_CREATED)
async def add_part_to_service_request(
    request_id: UUID,
    part_in: ServiceRequestPartCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ServiceRequestPartResponse:
    """Add a part to a workshop service request.

    Immediately decrements ProductStockByLocation.stock by qty.
    Logs a StockAdjustment audit record.
    Triggers auto-reorder check (non-critical, best-effort).
    """
    # Verify service request exists and is not completed/cancelled
    sr_result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    )
    service_request = sr_result.scalar_one_or_none()
    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )
    if service_request.status in (ServiceStatus.completed, ServiceStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot add parts to a {service_request.status} service request",
        )

    # Deduct stock — raises 404/409 on failure
    await _deduct_stock(
        db, part_in.product_id, part_in.location, part_in.quantity, request_id
    )

    # Create the part record
    part = ServiceRequestPart(
        service_request_id=request_id,
        product_id=part_in.product_id,
        location=part_in.location,
        quantity=part_in.quantity,
        is_finalized=False,
    )
    db.add(part)
    await db.commit()
    await db.refresh(part)

    # Trigger auto-reorder check (best-effort, non-critical)
    try:
        from src.services.auto_reorder import process_auto_reorder
        await process_auto_reorder(db, part_in.product_id, part_in.location)
    except Exception as exc:
        logger.warning(
            "auto_reorder_check_failed",
            product_id=str(part_in.product_id),
            location=part_in.location,
            error=str(exc),
        )

    return ServiceRequestPartResponse(
        id=part.id,
        service_request_id=part.service_request_id,
        product_id=part.product_id,
        location=part.location,
        quantity=part.quantity,
        is_finalized=part.is_finalized,
        created_at=part.created_at.isoformat(),
        updated_at=part.updated_at.isoformat(),
    )


@router.get("/{request_id}/parts")
async def list_parts_for_service_request(
    request_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[ServiceRequestPartResponse]:
    """List all parts assigned to a service request."""
    sr_result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    )
    if not sr_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )

    parts_result = await db.execute(
        select(ServiceRequestPart)
        .where(ServiceRequestPart.service_request_id == request_id)
        .order_by(ServiceRequestPart.created_at.asc())
    )
    parts = parts_result.scalars().all()

    return [
        ServiceRequestPartResponse(
            id=p.id,
            service_request_id=p.service_request_id,
            product_id=p.product_id,
            location=p.location,
            quantity=p.quantity,
            is_finalized=p.is_finalized,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
        )
        for p in parts
    ]


@router.delete(
    "/{request_id}/parts/{part_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def remove_part_from_service_request(
    request_id: UUID,
    part_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Remove a part from a service request and restore its stock.

    Blocked if the part has been finalised (job is completed).
    """
    part_result = await db.execute(
        select(ServiceRequestPart).where(
            ServiceRequestPart.id == part_id,
            ServiceRequestPart.service_request_id == request_id,
        )
    )
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Part {part_id} not found on service request {request_id}",
        )
    if part.is_finalized:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove a finalised part (job is completed). Reopen the job first.",
        )

    # Restore stock
    await _restore_stock(db, part.product_id, part.location, part.quantity, request_id)
    await db.delete(part)
    await db.commit()
