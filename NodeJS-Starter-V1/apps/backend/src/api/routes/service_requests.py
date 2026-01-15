"""API routes for service request management."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.service_models import RequestType, ServiceRequest, ServiceStatus

router = APIRouter(prefix="/api/service-requests", tags=["Service Requests"])


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


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_request(
    request_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
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
