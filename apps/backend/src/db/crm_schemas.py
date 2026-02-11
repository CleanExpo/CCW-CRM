"""Pydantic schemas for CRM API (Contacts & Activities)."""

from datetime import datetime
import enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class ActivityType(str, enum.Enum):
    """Activity type enum for API."""

    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    NOTE = "note"
    TASK = "task"


# Contact Schemas
class ContactBase(BaseModel):
    """Base schema for Contact."""

    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    mobile: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    is_primary: bool = False
    is_active: bool = True
    notes: str | None = None


class ContactCreate(ContactBase):
    """Schema for creating a Contact."""

    customer_id: UUID | None = None


class ContactUpdate(BaseModel):
    """Schema for updating a Contact (all fields optional)."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    mobile: str | None = Field(default=None, max_length=30)
    job_title: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    customer_id: UUID | None = None
    is_primary: bool | None = None
    is_active: bool | None = None
    notes: str | None = None


class Contact(ContactBase):
    """Schema for Contact response."""

    id: UUID
    customer_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContactWithCustomer(Contact):
    """Contact response with customer details."""

    customer_name: str | None = None


# Activity Schemas
class ActivityBase(BaseModel):
    """Base schema for Activity."""

    activity_type: ActivityType = ActivityType.NOTE
    subject: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    due_date: datetime | None = None
    created_by: str | None = None


class ActivityCreate(ActivityBase):
    """Schema for creating an Activity."""

    customer_id: UUID | None = None
    contact_id: UUID | None = None
    order_id: UUID | None = None
    quote_id: UUID | None = None


class ActivityUpdate(BaseModel):
    """Schema for updating an Activity (all fields optional)."""

    activity_type: ActivityType | None = None
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    customer_id: UUID | None = None
    contact_id: UUID | None = None
    order_id: UUID | None = None
    quote_id: UUID | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None


class Activity(ActivityBase):
    """Schema for Activity response."""

    id: UUID
    customer_id: UUID | None = None
    contact_id: UUID | None = None
    order_id: UUID | None = None
    quote_id: UUID | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActivityWithRelations(Activity):
    """Activity response with related entity names."""

    customer_name: str | None = None
    contact_name: str | None = None
    order_number: str | None = None
    quote_number: str | None = None


class ActivityComplete(BaseModel):
    """Schema for marking an activity as complete."""

    completed_at: datetime | None = None  # If None, uses current time


# Pagination Response
class PaginatedContacts(BaseModel):
    """Paginated response for contacts."""

    data: list[Contact]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedActivities(BaseModel):
    """Paginated response for activities."""

    data: list[Activity]
    total: int
    page: int
    page_size: int
    total_pages: int


# Summary/Stats schemas
class ContactStats(BaseModel):
    """Contact statistics."""

    total_contacts: int
    active_contacts: int
    contacts_with_email: int
    contacts_by_customer: int


class ActivityStats(BaseModel):
    """Activity statistics."""

    total_activities: int
    by_type: dict[str, int]
    pending_tasks: int
    overdue_tasks: int
    completed_this_week: int
