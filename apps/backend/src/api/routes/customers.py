"""Customers API routes.

Performance optimized with Redis caching.

Note: `payment_terms` is stored in the DB but is not yet mapped in the locked
`demo_models.py` ORM class. Until that model is updated (see NEW TICKET below),
all payment_terms reads/writes use SQLAlchemy Core text() statements alongside
the standard ORM operations. All other behaviour is unchanged.

NEW TICKET: Add `payment_terms` column to Customer ORM model in demo_models.py
  so the raw-SQL workaround here can be removed.
"""
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.cache.decorators import cached, invalidate_cache
from src.config.database import get_async_db
from src.db.demo_models import Customer as CustomerModel
from src.db.schemas import Customer, CustomerCreate, CustomerUpdate, PaginatedResponse
from src.services.sse_service import sse_service


# ---------------------------------------------------------------------------
# Helpers for payment_terms — persisted via raw SQL until ORM model is updated
# ---------------------------------------------------------------------------

async def _get_payment_terms(db: AsyncSession, customer_id: UUID) -> str | None:
    """Fetch payment_terms for a single customer via raw SQL."""
    result = await db.execute(
        text("SELECT payment_terms FROM customers WHERE id = :id"),
        {"id": str(customer_id)},
    )
    row = result.fetchone()
    return row[0] if row else None


async def _set_payment_terms(
    db: AsyncSession, customer_id: UUID, payment_terms: str | None
) -> None:
    """Persist payment_terms for a customer via raw SQL."""
    await db.execute(
        text("UPDATE customers SET payment_terms = :pt WHERE id = :id"),
        {"pt": payment_terms, "id": str(customer_id)},
    )
    await db.commit()


def _customer_response(customer: CustomerModel, payment_terms: str | None) -> dict:
    """Build a Customer schema dict with the payment_terms field merged in."""
    data = Customer.model_validate(customer).model_dump()
    data["payment_terms"] = payment_terms
    return data

router = APIRouter(prefix="/api/customers", tags=["customers"], dependencies=[Depends(get_current_user)])


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
    # Build query — include payment_terms alongside ORM columns (raw SQL column)
    query = select(CustomerModel, text("customers.payment_terms"))

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

    # Get total count (exclude the extra payment_terms column from count)
    orm_only_query = select(CustomerModel)
    if search:
        search_filter = f"%{search}%"
        orm_only_query = orm_only_query.where(
            (CustomerModel.company_name.ilike(search_filter)) |
            (CustomerModel.customer_number.ilike(search_filter)) |
            (CustomerModel.contact_name.ilike(search_filter)) |
            (CustomerModel.email.ilike(search_filter))
        )
    if is_active is not None:
        orm_only_query = orm_only_query.where(CustomerModel.is_active == is_active)
    count_query = select(func.count()).select_from(orm_only_query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(CustomerModel.created_at.desc())

    # Execute query — rows are (CustomerModel, payment_terms_str) tuples
    result = await db.execute(query)
    rows = result.all()

    return {
        "items": [_customer_response(row[0], row[1]) for row in rows],
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
    result = await db.execute(
        select(CustomerModel, text("customers.payment_terms"))
        .where(CustomerModel.id == customer_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer, payment_terms = row
    return _customer_response(customer, payment_terms)


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

    # Extract payment_terms before building ORM object (not yet in locked model)
    payment_terms = customer_data.payment_terms
    orm_data = customer_data.model_dump(exclude={"payment_terms"})

    # Create customer via ORM (excludes payment_terms)
    customer = CustomerModel(**orm_data)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    # Persist payment_terms via raw SQL if supplied
    if payment_terms is not None:
        await _set_payment_terms(db, customer.id, payment_terms)

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

    return _customer_response(customer, payment_terms)


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

    # Split payment_terms from the rest (not in locked ORM model)
    update_data = customer_data.model_dump(exclude_unset=True)
    payment_terms_updated = "payment_terms" in update_data
    payment_terms = update_data.pop("payment_terms", None)

    # Update ORM-mapped fields
    for field, value in update_data.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)

    # Persist payment_terms via raw SQL if it was explicitly included in the request
    if payment_terms_updated:
        await _set_payment_terms(db, customer.id, payment_terms)
    else:
        # Read current value to include in response
        payment_terms = await _get_payment_terms(db, customer.id)

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

    return _customer_response(customer, payment_terms)


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
