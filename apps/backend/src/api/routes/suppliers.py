"""
Supplier CRUD API endpoints.

Provides full CRUD operations for supplier management including
search, pagination, and Xero integration fields.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.inventory_models import Supplier

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"], dependencies=[Depends(get_current_user)])

AU_STATES = {"NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"}


def _validate_au_state(v: str | None) -> str | None:
    """Uppercase and validate AU state/territory code."""
    if v is None:
        return v
    upper = v.upper()
    if upper not in AU_STATES:
        raise ValueError(
            f"Invalid AU state: {v}. Must be one of: NSW, VIC, QLD, SA, WA, TAS, NT, ACT"
        )
    return upper


# Pydantic models for request/response validation
class SupplierCreate(BaseModel):
    """Schema for creating a new supplier."""

    supplier_code: str = Field(..., min_length=1, max_length=50, description="Unique supplier code")
    company_name: str = Field(..., min_length=1, max_length=255, description="Company name")
    contact_name: str | None = Field(None, max_length=255, description="Primary contact name")
    email: str | None = Field(None, max_length=255, description="Contact email")
    phone: str | None = Field(None, max_length=50, description="Phone number")
    abn: str | None = Field(None, max_length=20, description="Australian Business Number")
    address: str | None = Field(None, description="Street address")
    city: str | None = Field(None, max_length=100, description="City")
    state: str | None = Field(None, max_length=50, description="State/Territory")
    postal_code: str | None = Field(None, max_length=20, description="Postal/ZIP code")
    country: str = Field("AU", max_length=2, description="Country code (default: AU)")
    payment_terms: str | None = Field(None, max_length=100, description="Payment terms (e.g., Net 30)")  # noqa: E501
    preferred_carrier: str | None = Field(None, max_length=100, description="Preferred shipping carrier")  # noqa: E501
    notes: str | None = Field(None, description="Additional notes")

    @field_validator("state", mode="after")
    @classmethod
    def validate_au_state(cls, v: str | None) -> str | None:
        return _validate_au_state(v)


class SupplierUpdate(BaseModel):
    """Schema for updating an existing supplier."""

    company_name: str | None = Field(None, min_length=1, max_length=255)
    contact_name: str | None = Field(None, max_length=255)
    email: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=50)
    abn: str | None = Field(None, max_length=20)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=50)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=2)
    payment_terms: str | None = Field(None, max_length=100)
    preferred_carrier: str | None = Field(None, max_length=100)
    is_active: bool | None = None
    notes: str | None = None

    @field_validator("state", mode="after")
    @classmethod
    def validate_au_state(cls, v: str | None) -> str | None:
        return _validate_au_state(v)


class SupplierResponse(BaseModel):
    """Schema for supplier response."""

    id: UUID
    supplier_code: str
    company_name: str
    contact_name: str | None
    email: str | None
    phone: str | None
    abn: str | None
    address: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str
    payment_terms: str | None
    preferred_carrier: str | None
    xero_contact_id: str | None
    is_active: bool
    notes: str | None

    class Config:
        from_attributes = True


class PaginatedSupplierResponse(BaseModel):
    """Paginated response for supplier list."""

    data: list[SupplierResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=PaginatedSupplierResponse)
async def list_suppliers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search by company name or supplier code"),
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> PaginatedSupplierResponse:
    """
    List suppliers with pagination and optional filters.

    - **page**: Page number (starts at 1)
    - **page_size**: Number of items per page (max 100)
    - **search**: Search term for company name or supplier code
    - **is_active**: Filter by active/inactive status
    """
    query = select(Supplier)

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Supplier.company_name.ilike(search_pattern),
                Supplier.supplier_code.ilike(search_pattern),
            )
        )

    # Apply active status filter
    if is_active is not None:
        query = query.where(Supplier.is_active == is_active)

    # Count total results
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Supplier.company_name).limit(page_size).offset((page - 1) * page_size)

    # Execute query
    result = await db.execute(query)
    suppliers = result.scalars().all()

    return PaginatedSupplierResponse(
        data=[SupplierResponse.model_validate(s) for s in suppliers],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SupplierResponse:
    """
    Get a single supplier by ID.

    Returns 404 if supplier not found.
    """
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    return SupplierResponse.model_validate(supplier)


@router.post("", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    supplier_data: SupplierCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SupplierResponse:
    """
    Create a new supplier.

    - **supplier_code**: Must be unique
    - **company_name**: Required
    - Returns 400 if supplier_code already exists
    """
    # Check for duplicate supplier_code
    existing = await db.execute(
        select(Supplier).where(Supplier.supplier_code == supplier_data.supplier_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Supplier code '{supplier_data.supplier_code}' already exists",
        )

    # Create supplier
    supplier = Supplier(**supplier_data.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)

    return SupplierResponse.model_validate(supplier)


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    supplier_data: SupplierUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SupplierResponse:
    """
    Update an existing supplier.

    - Only provided fields will be updated
    - Returns 404 if supplier not found
    """
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Update only provided fields
    update_data = supplier_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)

    await db.commit()
    await db.refresh(supplier)

    return SupplierResponse.model_validate(supplier)


@router.delete("/{supplier_id}", status_code=204, response_model=None)
async def delete_supplier(
    supplier_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Soft delete a supplier (sets is_active = False).

    - Does not actually remove from database
    - Returns 404 if supplier not found
    """
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()

    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    supplier.is_active = False
    await db.commit()
