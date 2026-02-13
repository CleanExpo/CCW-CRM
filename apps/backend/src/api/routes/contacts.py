"""Contacts API routes for CRM.

Provides full CRUD operations for managing contacts associated with customers.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.cache.decorators import cached, invalidate_cache
from src.config.database import get_db
from src.db.crm_models import Contact as ContactModel
from src.db.crm_schemas import (
    Contact,
    ContactCreate,
    ContactUpdate,
    ContactWithCustomer,
    PaginatedContacts,
)
from src.db.demo_models import Customer as CustomerModel
from src.services.sse_service import sse_service

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=PaginatedContacts)
@cached(ttl=300, key_prefix="api_contacts_list")
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    customer_id: UUID | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List contacts with pagination and filters."""
    query = select(ContactModel)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                ContactModel.first_name.ilike(search_filter),
                ContactModel.last_name.ilike(search_filter),
                ContactModel.email.ilike(search_filter),
                ContactModel.job_title.ilike(search_filter),
            )
        )

    if customer_id:
        query = query.where(ContactModel.customer_id == customer_id)

    if is_active is not None:
        query = query.where(ContactModel.is_active == is_active)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination and ordering
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(ContactModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    contacts = result.scalars().all()

    return PaginatedContacts(
        data=[Contact.model_validate(c).model_dump() for c in contacts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{contact_id}", response_model=ContactWithCustomer)
async def get_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single contact by ID with customer details."""
    query = select(ContactModel).where(ContactModel.id == contact_id)
    result = await db.execute(query)
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Get customer name if linked
    customer_name = None
    if contact.customer_id:
        customer_query = select(CustomerModel).where(CustomerModel.id == contact.customer_id)
        customer_result = await db.execute(customer_query)
        customer = customer_result.scalar_one_or_none()
        if customer:
            customer_name = customer.company_name

    contact_data = Contact.model_validate(contact).model_dump()
    contact_data["customer_name"] = customer_name

    return ContactWithCustomer(**contact_data)


@router.post("", response_model=Contact, status_code=201)
async def create_contact(
    contact_data: ContactCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new contact."""
    # Validate customer_id if provided
    if contact_data.customer_id:
        customer_query = select(CustomerModel).where(CustomerModel.id == contact_data.customer_id)
        result = await db.execute(customer_query)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer not found")

    # Create contact
    contact = ContactModel(**contact_data.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    # Invalidate caches
    await invalidate_cache("api_contacts_list")
    await invalidate_cache("contacts")

    # Publish real-time events
    await sse_service.publish("dashboard-activity", {
        "activity_type": "contact_created",
        "title": "New Contact",
        "description": f"Contact {contact.first_name} {contact.last_name} created",
        "link": f"/contacts/{contact.id}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return Contact.model_validate(contact)


@router.put("/{contact_id}", response_model=Contact)
async def update_contact(
    contact_id: UUID,
    contact_data: ContactUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a contact."""
    query = select(ContactModel).where(ContactModel.id == contact_id)
    result = await db.execute(query)
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Validate new customer_id if provided
    update_data = contact_data.model_dump(exclude_unset=True)
    if "customer_id" in update_data and update_data["customer_id"]:
        customer_query = select(CustomerModel).where(CustomerModel.id == update_data["customer_id"])
        result = await db.execute(customer_query)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer not found")

    # Update fields
    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.commit()
    await db.refresh(contact)

    # Invalidate caches
    await invalidate_cache("api_contacts_list")
    await invalidate_cache("contacts")

    # Publish real-time update
    await sse_service.publish("dashboard-activity", {
        "activity_type": "contact_updated",
        "title": "Contact Updated",
        "description": f"Contact {contact.first_name} {contact.last_name} updated",
        "link": f"/contacts/{contact.id}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return Contact.model_validate(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a contact (set is_active to False)."""
    query = select(ContactModel).where(ContactModel.id == contact_id)
    result = await db.execute(query)
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Soft delete
    contact_name = f"{contact.first_name} {contact.last_name}"
    contact.is_active = False
    await db.commit()

    # Invalidate caches
    await invalidate_cache("api_contacts_list")
    await invalidate_cache("contacts")

    # Publish real-time events
    await sse_service.publish("dashboard-activity", {
        "activity_type": "contact_deleted",
        "title": "Contact Deleted",
        "description": f"Contact {contact_name} deleted",
        "link": "/contacts",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return None


# Customer-specific contact endpoints
@router.get("/customer/{customer_id}", response_model=list[Contact])
async def get_customer_contacts(
    customer_id: UUID,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get all contacts for a specific customer."""
    query = select(ContactModel).where(ContactModel.customer_id == customer_id)

    if not include_inactive:
        query = query.where(ContactModel.is_active == True)

    query = query.order_by(ContactModel.is_primary.desc(), ContactModel.created_at.desc())

    result = await db.execute(query)
    contacts = result.scalars().all()

    return [Contact.model_validate(c).model_dump() for c in contacts]


@router.post("/{contact_id}/set-primary", response_model=Contact)
async def set_primary_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Set a contact as the primary contact for their customer."""
    query = select(ContactModel).where(ContactModel.id == contact_id)
    result = await db.execute(query)
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if not contact.customer_id:
        raise HTTPException(status_code=400, detail="Contact is not linked to a customer")

    # Unset any existing primary contact for this customer
    unset_query = (
        select(ContactModel)
        .where(ContactModel.customer_id == contact.customer_id)
        .where(ContactModel.is_primary == True)
    )
    result = await db.execute(unset_query)
    existing_primary = result.scalars().all()

    for c in existing_primary:
        c.is_primary = False

    # Set this contact as primary
    contact.is_primary = True
    await db.commit()
    await db.refresh(contact)

    # Invalidate caches
    await invalidate_cache("api_contacts_list")
    await invalidate_cache("contacts")

    return Contact.model_validate(contact)
