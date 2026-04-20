"""Customers API routes.

Performance optimized with Redis caching.
"""
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.cache.decorators import cached, invalidate_cache
from src.config.database import get_async_db
from src.db.crm_models import CustomerProfile
from src.db.demo_models import Customer as CustomerModel
from src.db.schemas import Customer, CustomerCreate, CustomerUpdate, PaginatedResponse
from src.services.sse_service import sse_service

router = APIRouter(prefix="/api/customers", tags=["customers"], dependencies=[Depends(get_current_user)])


# ---------------------------------------------------------------------------
# Helpers — customer profile (UNI-1821 / UNI-1831)
# ---------------------------------------------------------------------------


async def _get_profile(db: AsyncSession, customer_id: UUID) -> CustomerProfile | None:
    """Return the CustomerProfile row for a customer, or None if not yet created."""
    result = await db.execute(
        select(CustomerProfile).where(CustomerProfile.customer_id == customer_id)
    )
    return result.scalar_one_or_none()


def _merge_profile(customer: CustomerModel, profile: CustomerProfile | None) -> Customer:
    """Merge a CustomerModel ORM row with its optional profile into a Customer schema."""
    data = Customer.model_validate(customer).model_dump()
    if profile is not None:
        data["customer_type"] = profile.customer_type
        data["payment_terms_days"] = profile.payment_terms_days
    return Customer(**data)


async def _upsert_profile(
    db: AsyncSession,
    customer_id: UUID,
    customer_type: str | None,
    payment_terms_days: int | None,
) -> None:
    """Create or update the CustomerProfile for a given customer."""
    profile = await _get_profile(db, customer_id)
    if profile is None:
        profile = CustomerProfile(
            customer_id=customer_id,
            customer_type=customer_type or "B2B",
            payment_terms_days=payment_terms_days or 30,
        )
        db.add(profile)
    else:
        if customer_type is not None:
            profile.customer_type = customer_type
        if payment_terms_days is not None:
            profile.payment_terms_days = payment_terms_days


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

    # Execute query with LEFT JOIN on customer_profile for payment_terms / customer_type
    list_query = (
        select(CustomerModel, CustomerProfile)
        .outerjoin(CustomerProfile, CustomerProfile.customer_id == CustomerModel.id)
    )
    if search:
        search_filter = f"%{search}%"
        list_query = list_query.where(
            (CustomerModel.company_name.ilike(search_filter)) |
            (CustomerModel.customer_number.ilike(search_filter)) |
            (CustomerModel.contact_name.ilike(search_filter)) |
            (CustomerModel.email.ilike(search_filter))
        )
    if is_active is not None:
        list_query = list_query.where(CustomerModel.is_active == is_active)
    list_query = list_query.offset((page - 1) * page_size).limit(page_size)
    list_query = list_query.order_by(CustomerModel.created_at.desc())

    result = await db.execute(list_query)
    rows = result.all()

    return {
        "items": [_merge_profile(c, p).model_dump() for c, p in rows],
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

    profile = await _get_profile(db, customer_id)
    return _merge_profile(customer, profile)


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

    # Separate profile fields before creating the core customer record
    profile_fields = {
        "customer_type": customer_data.customer_type,
        "payment_terms_days": customer_data.payment_terms_days,
    }
    core_fields = customer_data.model_dump(exclude={"customer_type", "payment_terms_days"})

    # Create customer
    customer = CustomerModel(**core_fields)
    db.add(customer)
    await db.flush()  # assign customer.id without full commit

    # Create profile row
    await _upsert_profile(
        db,
        customer.id,
        customer_type=profile_fields["customer_type"],
        payment_terms_days=profile_fields["payment_terms_days"],
    )

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

    profile = await _get_profile(db, customer.id)
    return _merge_profile(customer, profile)


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

    # Separate profile fields from core customer fields
    update_data = customer_data.model_dump(exclude_unset=True)
    profile_keys = {"customer_type", "payment_terms_days"}
    profile_updates = {k: update_data.pop(k) for k in profile_keys if k in update_data}
    core_updates = update_data

    for field, value in core_updates.items():
        setattr(customer, field, value)

    # Upsert profile if profile fields were provided
    if profile_updates:
        await _upsert_profile(
            db,
            customer.id,
            customer_type=profile_updates.get("customer_type"),
            payment_terms_days=profile_updates.get("payment_terms_days"),
        )

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

    profile = await _get_profile(db, customer.id)
    return _merge_profile(customer, profile)


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
    customer_name = customer.company_name
    customer.is_active = False
    await db.commit()

    # Invalidate customer caches (list and dashboard)
    await invalidate_cache("customers")
    await invalidate_cache("api_customers_list")
    await invalidate_cache("dashboard_metrics")

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "total_customers",
        "change": "decrement",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "customer_deleted",
        "title": "Customer Deleted",
        "description": f"Customer {customer_name} deleted",
        "link": "/customers",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    return None
