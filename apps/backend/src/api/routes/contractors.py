"""
Contractor Availability API Routes (SQLAlchemy implementation)

Australian-first API for managing contractor schedules with:
- ABN validation
- Australian mobile number format
- Brisbane location focus
- AEST timezone handling
- SQLAlchemy ORM with async support
"""

import re
from datetime import date as DateType
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models_base import (
    AustralianState,
    AvailabilityStatus,
)
from src.db.models_base import (
    AvailabilitySlot as AvailabilitySlotModel,
)
from src.db.models_base import (
    Contractor as ContractorModel,
)

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================


class Location(BaseModel):
    """Location model for Australian addresses."""

    suburb: str = Field(..., min_length=1, max_length=100)
    state: AustralianState
    postcode: str | None = Field(None, pattern=r"^\d{4}$")


class AvailabilitySlotBase(BaseModel):
    """Base availability slot model."""

    date: DateType
    start_time: str = Field(..., description="Time in HH:MM format")
    end_time: str = Field(..., description="Time in HH:MM format")
    location: Location
    status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    notes: str | None = None


class AvailabilitySlotCreate(AvailabilitySlotBase):
    """Create availability slot request."""

    pass


class AvailabilitySlot(AvailabilitySlotBase):
    """Availability slot response."""

    id: UUID

    model_config = {"from_attributes": True}


class ContractorBase(BaseModel):
    """Base contractor model."""

    name: str = Field(..., min_length=1, max_length=100)
    mobile: str = Field(..., pattern=r"^04\d{2}\s?\d{3}\s?\d{3}$")
    abn: str | None = Field(None, pattern=r"^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$")
    email: str | None = Field(None, max_length=255)
    specialisation: str | None = Field(None, max_length=100)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        """Validate Australian mobile format (04XX XXX XXX)."""
        cleaned = re.sub(r"\s", "", v)
        if not re.match(r"^04\d{8}$", cleaned):
            raise ValueError("Invalid Australian mobile number format (must be 04XX XXX XXX)")
        return cleaned

    @field_validator("abn")
    @classmethod
    def validate_abn(cls, v: str | None) -> str | None:
        """Validate ABN format (XX XXX XXX XXX)."""
        if v is None:
            return v
        cleaned = re.sub(r"\s", "", v)
        if not re.match(r"^\d{11}$", cleaned):
            raise ValueError("Invalid ABN format (must be XX XXX XXX XXX)")
        return cleaned


class ContractorCreate(ContractorBase):
    """Create contractor request."""

    pass


class ContractorUpdate(BaseModel):
    """Update contractor request (partial update)."""

    name: str | None = None
    mobile: str | None = None
    abn: str | None = None
    email: str | None = None
    specialisation: str | None = None


class Contractor(ContractorBase):
    """Contractor response."""

    id: UUID
    created_at: str
    updated_at: str
    availability_slots: list[AvailabilitySlot] = []

    model_config = {"from_attributes": True}


class ContractorList(BaseModel):
    """Paginated contractor list response."""

    contractors: list[Contractor]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    """Error response model."""

    detail: str


# ============================================================================
# API ROUTES
# ============================================================================

router = APIRouter(
    prefix="/api/contractors",
    tags=["contractors"],
    dependencies=[Depends(get_current_user)],
    responses={
        404: {"model": ErrorResponse, "description": "Contractor not found"},
        422: {"model": ErrorResponse, "description": "Validation error (invalid ABN, mobile, etc.)"},
    },
)


@router.get(
    "/",
    response_model=ContractorList,
    summary="List all contractors",
    description="Get paginated list of contractors with Australian formatting",
)
async def list_contractors(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    state: AustralianState | None = Query(None, description="Filter by Australian state (e.g., QLD, NSW)"),
    specialisation: str | None = Query(None, description="Filter by specialisation"),
    db: AsyncSession = Depends(get_async_db),
) -> ContractorList:
    """
    List contractors with optional filtering.

    **Australian Context:**
    - Phone numbers formatted as 04XX XXX XXX
    - ABN formatted as XX XXX XXX XXX
    - Timestamps in AEST/AEDT timezone
    - Locations include Australian state (QLD, NSW, etc.)
    """
    # Build query
    query = select(ContractorModel).options(selectinload(ContractorModel.availability_slots))

    # Apply specialisation filter
    if specialisation:
        query = query.where(ContractorModel.specialisation.ilike(f"%{specialisation}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(ContractorModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    contractors = result.scalars().all()

    # Filter by state if provided (post-query filter on availability slots)
    if state:
        contractors = [
            c for c in contractors
            if any(slot.state == state for slot in c.availability_slots)
        ]

    return ContractorList(
        contractors=[Contractor.model_validate(c).model_dump() for c in contractors],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{contractor_id}",
    response_model=Contractor,
    summary="Get contractor by ID",
    description="Retrieve contractor details with availability slots",
)
async def get_contractor(
    contractor_id: UUID,
    db: AsyncSession = Depends(get_async_db),
) -> Contractor:
    """Get contractor by ID."""
    query = (
        select(ContractorModel)
        .options(selectinload(ContractorModel.availability_slots))
        .where(ContractorModel.id == contractor_id)
    )
    result = await db.execute(query)
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found",
        )

    return Contractor.model_validate(contractor)


@router.post(
    "/",
    response_model=Contractor,
    status_code=status.HTTP_201_CREATED,
    summary="Create new contractor",
    description="Register a new contractor with Australian validation",
)
async def create_contractor(
    contractor: ContractorCreate,
    db: AsyncSession = Depends(get_async_db),
) -> Contractor:
    """Create new contractor."""
    new_contractor = ContractorModel(
        id=uuid4(),
        name=contractor.name,
        mobile=contractor.mobile,
        abn=contractor.abn,
        email=contractor.email,
        specialisation=contractor.specialisation,
    )

    db.add(new_contractor)
    await db.commit()
    await db.refresh(new_contractor)

    return Contractor.model_validate(new_contractor)


@router.patch(
    "/{contractor_id}",
    response_model=Contractor,
    summary="Update contractor",
    description="Update contractor details (partial update)",
)
async def update_contractor(
    contractor_id: UUID,
    updates: ContractorUpdate,
    db: AsyncSession = Depends(get_async_db),
) -> Contractor:
    """Update contractor."""
    # Get existing contractor
    query = select(ContractorModel).where(ContractorModel.id == contractor_id)
    result = await db.execute(query)
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found",
        )

    # Update fields
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contractor, field, value)

    await db.commit()
    await db.refresh(contractor)

    return await get_contractor(contractor_id, db)


@router.delete(
    "/{contractor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete contractor",
    description="Remove contractor from system",
)
async def delete_contractor(
    contractor_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Delete contractor (cascades to availability slots)."""
    query = select(ContractorModel).where(ContractorModel.id == contractor_id)
    result = await db.execute(query)
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found",
        )

    await db.delete(contractor)
    await db.commit()

    return None


@router.post(
    "/{contractor_id}/availability",
    response_model=AvailabilitySlot,
    status_code=status.HTTP_201_CREATED,
    summary="Add availability slot",
    description="Add availability slot for contractor (Brisbane focus)",
)
async def add_availability_slot(
    contractor_id: UUID,
    slot: AvailabilitySlotCreate,
    db: AsyncSession = Depends(get_async_db),
) -> AvailabilitySlot:
    """Add availability slot."""
    # Check if contractor exists
    query = select(ContractorModel).where(ContractorModel.id == contractor_id)
    result = await db.execute(query)
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found",
        )

    # Create availability slot
    new_slot = AvailabilitySlotModel(
        id=uuid4(),
        contractor_id=contractor_id,
        date=slot.date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        suburb=slot.location.suburb,
        state=slot.location.state,
        postcode=slot.location.postcode,
        status=slot.status,
        notes=slot.notes,
    )

    db.add(new_slot)
    await db.commit()
    await db.refresh(new_slot)

    return AvailabilitySlot.model_validate(new_slot)


@router.get(
    "/{contractor_id}/availability",
    response_model=list[AvailabilitySlot],
    summary="Get contractor availability",
    description="List all availability slots for contractor",
)
async def get_contractor_availability(
    contractor_id: UUID,
    status_filter: AvailabilityStatus | None = Query(None, alias="status", description="Filter by status"),
    db: AsyncSession = Depends(get_async_db),
) -> list[AvailabilitySlot]:
    """Get contractor availability."""
    # Check if contractor exists
    query = select(ContractorModel).where(ContractorModel.id == contractor_id)
    result = await db.execute(query)
    contractor = result.scalar_one_or_none()

    if not contractor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contractor with ID {contractor_id} not found",
        )

    # Query availability slots
    query = select(AvailabilitySlotModel).where(AvailabilitySlotModel.contractor_id == contractor_id)

    if status_filter:
        query = query.where(AvailabilitySlotModel.status == status_filter)

    query = query.order_by(AvailabilitySlotModel.date)

    result = await db.execute(query)
    slots = result.scalars().all()

    return [AvailabilitySlot.model_validate(s).model_dump() for s in slots]


@router.get(
    "/search/by-location",
    response_model=ContractorList,
    summary="Search contractors by location",
    description="Find contractors available in specific Brisbane suburbs",
)
async def search_by_location(
    suburb: Annotated[str, Query(description="Brisbane suburb (e.g., Indooroopilly)")],
    state: AustralianState = Query(AustralianState.QLD, description="Australian state (default: QLD)"),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_async_db),
) -> ContractorList:
    """Search contractors by location."""
    # Query contractors with matching availability slots
    subquery = (
        select(AvailabilitySlotModel.contractor_id)
        .where(
            AvailabilitySlotModel.suburb.ilike(f"%{suburb}%"),
            AvailabilitySlotModel.state == state,
        )
        .distinct()
    )

    query = (
        select(ContractorModel)
        .options(selectinload(ContractorModel.availability_slots))
        .where(ContractorModel.id.in_(subquery))
    )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    contractors = result.scalars().all()

    return ContractorList(
        contractors=[Contractor.model_validate(c).model_dump() for c in contractors],
        total=total,
        page=page,
        page_size=page_size,
    )
