"""Activities API routes for CRM.

Provides full CRUD operations for managing activities/interactions tracking.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.cache.decorators import cached, invalidate_cache
from src.config.database import get_db
from src.db.crm_models import Activity as ActivityModel
from src.db.crm_models import Contact as ContactModel
from src.db.crm_schemas import (
    Activity,
    ActivityComplete,
    ActivityCreate,
    ActivityType,
    ActivityUpdate,
    ActivityWithRelations,
    PaginatedActivities,
)
from src.db.demo_models import Customer as CustomerModel
from src.db.demo_models import Order as OrderModel
from src.db.demo_models import Quote as QuoteModel
from src.services.sse_service import sse_service

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("", response_model=PaginatedActivities)
@cached(ttl=60, key_prefix="api_activities_list")  # 1 minute cache
async def list_activities(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    activity_type: ActivityType | None = None,
    customer_id: UUID | None = None,
    contact_id: UUID | None = None,
    order_id: UUID | None = None,
    quote_id: UUID | None = None,
    include_completed: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List activities with pagination and filters."""
    query = select(ActivityModel)

    # Apply filters
    if activity_type:
        query = query.where(ActivityModel.activity_type == activity_type.value)

    if customer_id:
        query = query.where(ActivityModel.customer_id == customer_id)

    if contact_id:
        query = query.where(ActivityModel.contact_id == contact_id)

    if order_id:
        query = query.where(ActivityModel.order_id == order_id)

    if quote_id:
        query = query.where(ActivityModel.quote_id == quote_id)

    if not include_completed:
        query = query.where(ActivityModel.completed_at.is_(None))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination and ordering (newest first)
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(ActivityModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    activities = result.scalars().all()

    return PaginatedActivities(
        data=[Activity.model_validate(a).model_dump() for a in activities],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{activity_id}", response_model=ActivityWithRelations)
async def get_activity(
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single activity by ID with related entity names (single query with joins)."""
    query = (
        select(ActivityModel)
        .where(ActivityModel.id == activity_id)
        .options(
            joinedload(ActivityModel.customer),
            joinedload(ActivityModel.contact),
            joinedload(ActivityModel.order),
            joinedload(ActivityModel.quote),
        )
    )
    result = await db.execute(query)
    activity = result.unique().scalar_one_or_none()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Build response from eagerly loaded relationships (single query, no N+1)
    activity_data = Activity.model_validate(activity).model_dump()
    activity_data["customer_name"] = activity.customer.company_name if activity.customer else None
    activity_data["contact_name"] = (
        f"{activity.contact.first_name} {activity.contact.last_name}" if activity.contact else None
    )
    activity_data["order_number"] = activity.order.order_number if activity.order else None
    activity_data["quote_number"] = activity.quote.quote_number if activity.quote else None

    return ActivityWithRelations(**activity_data)


@router.post("", response_model=Activity, status_code=201)
async def create_activity(
    activity_data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
):
    """Log a new activity."""
    # Validate related entities if provided
    if activity_data.customer_id:
        customer_query = select(CustomerModel).where(CustomerModel.id == activity_data.customer_id)
        result = await db.execute(customer_query)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Customer not found")

    if activity_data.contact_id:
        contact_query = select(ContactModel).where(ContactModel.id == activity_data.contact_id)
        result = await db.execute(contact_query)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Contact not found")

    if activity_data.order_id:
        order_query = select(OrderModel).where(OrderModel.id == activity_data.order_id)
        result = await db.execute(order_query)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Order not found")

    if activity_data.quote_id:
        quote_query = select(QuoteModel).where(QuoteModel.id == activity_data.quote_id)
        result = await db.execute(quote_query)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Quote not found")

    # Create activity
    activity = ActivityModel(**activity_data.model_dump())
    db.add(activity)
    await db.commit()
    await db.refresh(activity)

    # Invalidate caches
    await invalidate_cache("api_activities_list")
    await invalidate_cache("activities")

    # Publish real-time events
    await sse_service.publish("dashboard-activity", {
        "activity_type": "crm_activity_logged",
        "title": f"New {activity.activity_type.title()}",
        "description": activity.subject,
        "link": f"/activities/{activity.id}",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    return Activity.model_validate(activity)


@router.put("/{activity_id}", response_model=Activity)
async def update_activity(
    activity_id: UUID,
    activity_data: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an activity."""
    query = select(ActivityModel).where(ActivityModel.id == activity_id)
    result = await db.execute(query)
    activity = result.scalar_one_or_none()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Update fields
    update_data = activity_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "activity_type" and value:
            value = value.value  # Convert enum to string
        setattr(activity, field, value)

    await db.commit()
    await db.refresh(activity)

    # Invalidate caches
    await invalidate_cache("api_activities_list")
    await invalidate_cache("activities")

    return Activity.model_validate(activity)


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete an activity."""
    query = select(ActivityModel).where(ActivityModel.id == activity_id)
    result = await db.execute(query)
    activity = result.scalar_one_or_none()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    await db.delete(activity)
    await db.commit()

    # Invalidate caches
    await invalidate_cache("api_activities_list")
    await invalidate_cache("activities")

    return None


@router.post("/{activity_id}/complete", response_model=Activity)
async def complete_activity(
    activity_id: UUID,
    complete_data: ActivityComplete | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Mark an activity as complete."""
    query = select(ActivityModel).where(ActivityModel.id == activity_id)
    result = await db.execute(query)
    activity = result.scalar_one_or_none()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Set completion time
    if complete_data and complete_data.completed_at:
        activity.completed_at = complete_data.completed_at
    else:
        activity.completed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(activity)

    # Invalidate caches
    await invalidate_cache("api_activities_list")
    await invalidate_cache("activities")

    # Publish real-time event
    await sse_service.publish("dashboard-activity", {
        "activity_type": "activity_completed",
        "title": "Activity Completed",
        "description": activity.subject,
        "timestamp": datetime.now(UTC).isoformat(),
    })

    return Activity.model_validate(activity)


# Entity-specific activity endpoints
@router.get("/customer/{customer_id}", response_model=list[Activity])
async def get_customer_activities(
    customer_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    activity_type: ActivityType | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get activities for a specific customer (timeline view)."""
    query = select(ActivityModel).where(ActivityModel.customer_id == customer_id)

    if activity_type:
        query = query.where(ActivityModel.activity_type == activity_type.value)

    query = query.order_by(ActivityModel.created_at.desc()).limit(limit)

    result = await db.execute(query)
    activities = result.scalars().all()

    return [Activity.model_validate(a).model_dump() for a in activities]


@router.get("/contact/{contact_id}", response_model=list[Activity])
async def get_contact_activities(
    contact_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get activities for a specific contact (timeline view)."""
    query = (
        select(ActivityModel)
        .where(ActivityModel.contact_id == contact_id)
        .order_by(ActivityModel.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    activities = result.scalars().all()

    return [Activity.model_validate(a).model_dump() for a in activities]


@router.get("/pending-tasks", response_model=list[Activity])
async def get_pending_tasks(
    limit: int = Query(10, ge=1, le=50),
    include_overdue: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Get pending tasks (activities with due dates that are not completed)."""
    query = (
        select(ActivityModel)
        .where(ActivityModel.activity_type == ActivityType.TASK.value)
        .where(ActivityModel.completed_at.is_(None))
        .where(ActivityModel.due_date.isnot(None))
    )

    if not include_overdue:
        query = query.where(ActivityModel.due_date >= datetime.now(UTC))

    query = query.order_by(ActivityModel.due_date.asc()).limit(limit)

    result = await db.execute(query)
    activities = result.scalars().all()

    return [Activity.model_validate(a).model_dump() for a in activities]
