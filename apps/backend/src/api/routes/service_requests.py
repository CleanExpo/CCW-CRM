"""API routes for service request management."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.service_models import RequestType, ServiceRequest, ServiceStatus
from src.db.workflow_models import SLAInstance, SLARule
from src.db.workshop_models import JobPartStatus, WorkshopJobPart
from src.db.inventory_models import ProductStockByLocation
from src.db.demo_models import Product

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/service-requests", tags=["Service Requests"], dependencies=[Depends(get_current_user)])


# Pydantic models for request/response
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
    """Update a service request."""

    query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    result = await db.execute(query)
    service_request = result.scalar_one_or_none()

    if not service_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request {request_id} not found",
        )

    # Update fields
    if updates.status is not None:
        service_request.status = updates.status

    if updates.assigned_technician is not None:
        service_request.assigned_technician = updates.assigned_technician

    if updates.scheduled_date is not None:
        from datetime import datetime

        service_request.scheduled_date = datetime.fromisoformat(
            updates.scheduled_date
        )

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
# Parts usage ↔ inventory  — UNI-1827
# ---------------------------------------------------------------------------


class JobPartCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(..., ge=1)
    location: str = Field("brisbane", pattern="^(brisbane|sydney|melbourne)$")
    notes: str | None = None


class JobPartResponse(BaseModel):
    id: UUID
    booking_id: UUID
    product_id: UUID
    product_name: str | None = None
    product_sku: str | None = None
    quantity: int
    location: str
    status: str
    notes: str | None
    created_at: datetime


async def _adjust_location_stock(
    db: AsyncSession,
    product_id: UUID,
    location: str,
    delta: int,
) -> None:
    """Apply a stock delta (negative = deduct) to ProductStockByLocation."""
    result = await db.execute(
        select(ProductStockByLocation).where(
            and_(
                ProductStockByLocation.product_id == product_id,
                ProductStockByLocation.location == location,
            )
        )
    )
    stock = result.scalar_one_or_none()
    if stock is None:
        if delta > 0:
            stock = ProductStockByLocation(
                product_id=product_id, location=location, stock=delta, reserved=0
            )
            db.add(stock)
        # If delta is negative and no record exists, nothing to deduct
        return
    stock.stock = max(0, stock.stock + delta)


@router.get("/bookings/{booking_id}/parts", response_model=list[JobPartResponse])
async def list_booking_parts(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[JobPartResponse]:
    """Return all parts for a workshop booking."""
    result = await db.execute(
        select(WorkshopJobPart, Product)
        .join(Product, WorkshopJobPart.product_id == Product.id)
        .where(WorkshopJobPart.booking_id == booking_id)
        .order_by(WorkshopJobPart.created_at)
    )
    rows = result.all()
    return [
        JobPartResponse(
            id=part.id,
            booking_id=part.booking_id,
            product_id=part.product_id,
            product_name=product.name,
            product_sku=product.sku,
            quantity=part.quantity,
            location=part.location,
            status=part.status.value,
            notes=part.notes,
            created_at=part.created_at,
        )
        for part, product in rows
    ]


@router.post("/bookings/{booking_id}/parts", response_model=JobPartResponse, status_code=201)
async def add_booking_part(
    booking_id: UUID,
    payload: JobPartCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JobPartResponse:
    """Add a part to a workshop booking and immediately deduct stock."""
    product_result = await db.execute(select(Product).where(Product.id == payload.product_id))
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=400, detail="Product not found")

    part = WorkshopJobPart(
        booking_id=booking_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        location=payload.location,
        status=JobPartStatus.reserved,
        notes=payload.notes,
    )
    db.add(part)

    # Immediately deduct from inventory
    await _adjust_location_stock(db, payload.product_id, payload.location, -payload.quantity)

    await db.commit()
    await db.refresh(part)

    logger.info(
        "Workshop part added — stock deducted",
        booking_id=str(booking_id),
        product_sku=product.sku,
        qty=payload.quantity,
        location=payload.location,
    )

    return JobPartResponse(
        id=part.id,
        booking_id=part.booking_id,
        product_id=part.product_id,
        product_name=product.name,
        product_sku=product.sku,
        quantity=part.quantity,
        location=part.location,
        status=part.status.value,
        notes=part.notes,
        created_at=part.created_at,
    )


@router.delete("/bookings/{booking_id}/parts/{part_id}", status_code=204)
async def remove_booking_part(
    booking_id: UUID,
    part_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Remove a reserved part from a booking and restore its stock."""
    result = await db.execute(
        select(WorkshopJobPart).where(
            and_(WorkshopJobPart.id == part_id, WorkshopJobPart.booking_id == booking_id)
        )
    )
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found on this booking")

    if part.status == JobPartStatus.reserved:
        # Restore stock only if not yet consumed
        await _adjust_location_stock(db, part.product_id, part.location, part.quantity)

    part.status = JobPartStatus.returned
    await db.commit()
    logger.info(
        "Workshop part removed — stock restored",
        booking_id=str(booking_id),
        part_id=str(part_id),
    )


@router.post("/bookings/{booking_id}/complete-parts", response_model=dict)
async def complete_booking_parts(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Mark all reserved parts as consumed when a job is completed.

    Stock has already been deducted on add; this just finalises status.
    """
    result = await db.execute(
        select(WorkshopJobPart).where(
            and_(
                WorkshopJobPart.booking_id == booking_id,
                WorkshopJobPart.status == JobPartStatus.reserved,
            )
        )
    )
    parts = result.scalars().all()
    for part in parts:
        part.status = JobPartStatus.consumed
    await db.commit()

    logger.info("Workshop parts finalised as consumed", booking_id=str(booking_id), count=len(parts))
    return {"booking_id": str(booking_id), "parts_consumed": len(parts)}


@router.post("/bookings/{booking_id}/reopen-parts", response_model=dict)
async def reopen_booking_parts(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Restore stock for consumed parts when a completed job is re-opened."""
    result = await db.execute(
        select(WorkshopJobPart).where(
            and_(
                WorkshopJobPart.booking_id == booking_id,
                WorkshopJobPart.status == JobPartStatus.consumed,
            )
        )
    )
    parts = result.scalars().all()
    for part in parts:
        await _adjust_location_stock(db, part.product_id, part.location, part.quantity)
        part.status = JobPartStatus.reserved
    await db.commit()

    logger.info("Workshop parts restored on reopen", booking_id=str(booking_id), count=len(parts))
    return {"booking_id": str(booking_id), "parts_restored": len(parts)}
