"""Customers API routes.

Performance optimized with Redis caching.
"""
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.cache.decorators import cached, invalidate_cache
from src.config.database import get_async_db
from src.db.customer_credit_models import CustomerCreditProfile
from src.db.demo_models import Customer as CustomerModel
from src.db.schemas import Customer, CustomerCreate, CustomerUpdate, PaginatedResponse
from src.services.sse_service import sse_service

router = APIRouter(prefix="/api/customers", tags=["customers"], dependencies=[Depends(get_current_user)])

# Fields that live in customer_credit_profiles, not the customers table
_CREDIT_FIELDS = {"credit_limit", "credit_hold"}


def _build_customer_response(customer: CustomerModel, credit: CustomerCreditProfile | None) -> dict:
    """Merge customer + credit profile into a single response dict."""
    data = Customer.model_validate(customer).model_dump()
    data["credit_limit"] = float(credit.credit_limit) if credit and credit.credit_limit is not None else None
    data["credit_hold"] = credit.credit_hold if credit else False
    return data


@router.get("", response_model=PaginatedResponse)
@cached(ttl=300, key_prefix="api_customers_list")  # 5 minute cache
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_async_db),
):
    """List customers with pagination and filters. Cached for 5 minutes."""
    # Build query
    query = select(CustomerModel)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (CustomerModel.company_name.ilike(search_filter)) |
            (CustomerModel.customer_number.ilike(search_filter)) |
            (CustomerModel.contact_name.ilike(search_filter)) |
            (CustomerModel.email.ilike(search_filter))
        )

    if is_active is not None:
        query = query.where(CustomerModel.is_active == is_active)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(CustomerModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    customers = result.scalars().all()

    customer_ids = [c.id for c in customers]
    credit_profiles: dict[UUID, CustomerCreditProfile] = {}
    if customer_ids:
        credit_result = await db.execute(
            select(CustomerCreditProfile).where(CustomerCreditProfile.customer_id.in_(customer_ids))
        )
        for cp in credit_result.scalars().all():
            credit_profiles[cp.customer_id] = cp

    return {
        "items": [_build_customer_response(c, credit_profiles.get(c.id)) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Get a single customer by ID."""
    query = select(CustomerModel).where(CustomerModel.id == customer_id)
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    credit_result = await db.execute(
        select(CustomerCreditProfile).where(CustomerCreditProfile.customer_id == customer_id)
    )
    credit = credit_result.scalar_one_or_none()
    return _build_customer_response(customer, credit)


@router.post("", response_model=Customer, status_code=201)
async def create_customer(
    customer_data: CustomerCreate,
    db: AsyncSession = Depends(get_async_db),
):
    """Create a new customer."""
    # Check if customer number already exists
    existing_query = select(CustomerModel).where(
        CustomerModel.customer_number == customer_data.customer_number
    )
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Customer number already exists")

    # Separate credit fields from core customer fields
    raw = customer_data.model_dump()
    credit_limit: Decimal | None = raw.pop("credit_limit", None)
    credit_hold: bool = raw.pop("credit_hold", False)

    # Create customer (core fields only — credit_* live in companion table)
    customer = CustomerModel(**raw)
    db.add(customer)
    await db.flush()

    # Create credit profile if credit data was provided
    credit: CustomerCreditProfile | None = None
    if credit_limit is not None or credit_hold:
        credit = CustomerCreditProfile(
            customer_id=customer.id,
            credit_limit=credit_limit,
            credit_hold=credit_hold,
        )
        db.add(credit)

    await db.commit()
    await db.refresh(customer)

    # Invalidate customer caches (list and dashboard metrics)
    await invalidate_cache("customers")
    await invalidate_cache("api_customers_list")
    await invalidate_cache("dashboard_metrics")
    await invalidate_cache("dashboard_activity")

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "total_customers",
        "change": "increment",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "customer_created",
        "title": "New Customer",
        "description": f"Customer {customer.company_name} created",
        "link": f"/customers/{customer.id}",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    return _build_customer_response(customer, credit)


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    db: AsyncSession = Depends(get_async_db),
):
    """Update a customer."""
    # Get existing customer
    query = select(CustomerModel).where(CustomerModel.id == customer_id)
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Separate credit fields from core customer fields
    update_data = customer_data.model_dump(exclude_unset=True)
    credit_updates = {k: update_data.pop(k) for k in list(update_data) if k in _CREDIT_FIELDS}

    # Update core customer fields
    for field, value in update_data.items():
        setattr(customer, field, value)

    # Update credit profile if credit fields were provided
    credit: CustomerCreditProfile | None = None
    if credit_updates:
        cp_result = await db.execute(
            select(CustomerCreditProfile).where(CustomerCreditProfile.customer_id == customer_id)
        )
        credit = cp_result.scalar_one_or_none()
        if credit is None:
            credit = CustomerCreditProfile(customer_id=customer_id)
            db.add(credit)
        for field, value in credit_updates.items():
            setattr(credit, field, value)
    else:
        cp_result = await db.execute(
            select(CustomerCreditProfile).where(CustomerCreditProfile.customer_id == customer_id)
        )
        credit = cp_result.scalar_one_or_none()

    await db.commit()
    await db.refresh(customer)

    # Invalidate customer caches (list and dashboard)
    await invalidate_cache("customers")
    await invalidate_cache("api_customers_list")
    await invalidate_cache("dashboard_metrics")

    # Publish real-time update
    await sse_service.publish("dashboard-activity", {
        "activity_type": "customer_updated",
        "title": "Customer Updated",
        "description": f"Customer {customer.company_name} updated",
        "link": f"/customers/{customer.id}",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    return _build_customer_response(customer, credit)


@router.delete("/{customer_id}", status_code=204, response_model=None)
async def delete_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Soft delete a customer (set is_active to False)."""
    # Get existing customer
    query = select(CustomerModel).where(CustomerModel.id == customer_id)
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Soft delete
    customer.is_active = False
    await db.commit()

    # Invalidate customer caches
    await invalidate_cache("customers")
    await invalidate_cache("api_customers_list")
    await invalidate_cache("dashboard_metrics")
