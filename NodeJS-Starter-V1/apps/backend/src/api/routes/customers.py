"""Customers API routes."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.db.demo_models import Customer as CustomerModel
from src.db.schemas import Customer, CustomerCreate, CustomerUpdate, PaginatedResponse

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=PaginatedResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List customers with pagination and filters."""
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

    return {
        "items": [Customer.model_validate(c) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single customer by ID."""
    query = select(CustomerModel).where(CustomerModel.id == customer_id)
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return Customer.model_validate(customer)


@router.post("", response_model=Customer, status_code=201)
async def create_customer(
    customer_data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new customer."""
    # Prepare customer data
    data_dict = customer_data.model_dump(exclude_unset=True)

    # Handle name/company_name aliasing
    if "name" in data_dict and not data_dict.get("company_name"):
        data_dict["company_name"] = data_dict.pop("name")
    elif "name" in data_dict:
        data_dict.pop("name")  # Remove alias if company_name exists

    # Handle postal_code/postcode aliasing
    if "postal_code" in data_dict and not data_dict.get("postcode"):
        data_dict["postcode"] = data_dict.pop("postal_code")
    elif "postal_code" in data_dict:
        data_dict.pop("postal_code")

    # Auto-generate customer number if not provided
    if not data_dict.get("customer_number"):
        # Get latest customer number
        query = select(CustomerModel.customer_number).order_by(
            CustomerModel.created_at.desc()
        ).limit(1)
        result = await db.execute(query)
        latest_number = result.scalar_one_or_none()

        if latest_number and latest_number.startswith("CUST-"):
            try:
                last_num = int(latest_number.split("-")[1])
                data_dict["customer_number"] = f"CUST-{last_num + 1:06d}"
            except (ValueError, IndexError):
                data_dict["customer_number"] = "CUST-000001"
        else:
            data_dict["customer_number"] = "CUST-000001"

    # Validate required fields
    if not data_dict.get("company_name"):
        raise HTTPException(status_code=400, detail="company_name or name is required")

    # Check if customer number already exists
    existing_query = select(CustomerModel).where(
        CustomerModel.customer_number == data_dict["customer_number"]
    )
    result = await db.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Customer number already exists")

    # Check if email already exists (if email is provided)
    if data_dict.get("email"):
        email_query = select(CustomerModel).where(
            CustomerModel.email == data_dict["email"]
        )
        result = await db.execute(email_query)
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")

    # Remove fields not in the model
    model_fields = {"customer_number", "company_name", "contact_name", "email",
                   "phone", "address", "city", "state", "postcode", "is_active",
                   "organization_id"}
    filtered_data = {k: v for k, v in data_dict.items() if k in model_fields}

    # Create customer
    customer = CustomerModel(**filtered_data)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    return Customer.model_validate(customer)


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a customer."""
    # Get existing customer
    query = select(CustomerModel).where(CustomerModel.id == customer_id)
    result = await db.execute(query)
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Update fields
    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)

    return Customer.model_validate(customer)


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
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

    return None
