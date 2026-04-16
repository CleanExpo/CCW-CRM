"""Pydantic schemas for ERP API."""
import html
from datetime import UTC, date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_serializer, field_validator, model_validator

from src.db.demo_models import OrderStatus, ProductCategory, QuoteStatus


# Organization schemas
class OrganizationBase(BaseModel):
    name: str
    subdomain: str | None = None
    is_active: bool = True


class OrganizationCreate(OrganizationBase):
    pass


class Organization(OrganizationBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# User schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role: str = "employee"
    is_admin: bool = False
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: UUID
    organization_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Product schemas
class ProductBase(BaseModel):
    sku: str
    name: str
    description: str | None = None
    category: ProductCategory | str  # Accept both enum and string for flexibility
    price: Decimal = Field(ge=0)
    cost: Decimal | None = None
    stock: int = 0
    warehouse_location: str | None = None
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: ProductCategory | str | None = None  # Accept both enum and string for flexibility
    price: Decimal | None = Field(default=None, ge=0)
    cost: Decimal | None = None
    stock: int | None = None
    warehouse_location: str | None = None
    is_active: bool | None = None


class Product(ProductBase):
    id: UUID
    organization_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# PHASE 4: Enhanced Product with Stock by Location
class StockByLocation(BaseModel):
    """Stock information for a single location."""

    location: str
    stock: int
    reserved: int
    available: int
    reorder_point: int | None = None
    last_counted_at: str | None = None


class ProductWithStock(Product):
    """Product with multi-location stock data.

    PHASE 4 OPTIMIZATION: Includes stock_by_location to eliminate N+1 queries.
    """

    stock_by_location: list[StockByLocation] = []


# Customer schemas
class CustomerBase(BaseModel):
    customer_number: str
    company_name: str
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    postcode: str | None = None
    abn: str | None = None  # Australian Business Number (11 digits, no spaces)
    # UNI-1821: Per-customer payment terms used for invoice due_date and Xero sync
    payment_terms_days: int = 30
    xero_contact_id: str | None = None
    xero_synced_at: datetime | None = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    @field_validator(
        "customer_number",
        "company_name",
        "contact_name",
        "phone",
        "address",
        "city",
        "state",
        "postcode",
        mode="before",
    )
    @classmethod
    def sanitise_string_fields(cls, v: str | None) -> str | None:
        """Escape HTML/XSS payloads and strip whitespace on input."""
        if v is None or not isinstance(v, str):
            return v
        return html.escape(v.strip())


class CustomerUpdate(BaseModel):
    company_name: str | None = None
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    postcode: str | None = None
    abn: str | None = None  # Australian Business Number (11 digits, no spaces)
    # UNI-1821: Per-customer payment terms
    payment_terms_days: int | None = None
    xero_contact_id: str | None = None
    xero_synced_at: datetime | None = None
    is_active: bool | None = None

    @field_validator(
        "company_name",
        "contact_name",
        "phone",
        "address",
        "city",
        "state",
        "postcode",
        mode="before",
    )
    @classmethod
    def sanitise_string_fields(cls, v: str | None) -> str | None:
        """Escape HTML/XSS payloads and strip whitespace."""
        if v is None or not isinstance(v, str):
            return v
        return html.escape(v.strip())


class Customer(CustomerBase):
    id: UUID
    organization_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Order Item schemas
class OrderItemBase(BaseModel):
    product_id: UUID
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, description="Quantity must be at least 1")


# PHASE 4 OPTIMIZATION: OrderItemUpdate with optional id for diff-based updates
class OrderItemUpdate(BaseModel):
    """Order item for updates - includes optional id to enable diff-based updates."""
    id: UUID | None = None  # If provided, update existing item; if None, create new item
    product_id: UUID
    quantity: int = Field(ge=1, description="Quantity must be at least 1")


class OrderItem(OrderItemBase):
    id: UUID
    order_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Order schemas
class OrderBase(BaseModel):
    customer_id: UUID
    status: OrderStatus = OrderStatus.DRAFT
    fulfillment_location: str | None = "brisbane"  # brisbane, sydney, or melbourne
    notes: str | None = None
    tracking_number: str | None = None
    carrier_name: str | None = None
    shipped_date: datetime | None = None
    estimated_delivery_date: datetime | None = None


class OrderCreate(OrderBase):
    items: list[OrderItemCreate] = Field(min_length=1, description="Order must have at least one item")


class OrderUpdate(BaseModel):
    customer_id: UUID | None = None
    status: OrderStatus | None = None
    fulfillment_location: str | None = None
    notes: str | None = None
    tracking_number: str | None = None
    carrier_name: str | None = None
    shipped_date: datetime | None = None
    estimated_delivery_date: datetime | None = None
    items: list[OrderItemUpdate] | None = None  # PHASE 4: Use OrderItemUpdate for diff-based updates
    subtotal: Decimal | None = None
    tax: Decimal | None = None
    total: Decimal | None = None


class Order(OrderBase):
    id: UUID
    organization_id: UUID | None = None
    order_number: str
    total: Decimal
    order_date: datetime
    created_at: datetime
    updated_at: datetime
    items: list[OrderItem] = []
    # Relationship loaded from SQLAlchemy - frontend handles both 'items' and 'order_items'
    order_items: list[OrderItem]

    class Config:
        from_attributes = True


class OrderActivityBase(BaseModel):
    order_id: UUID
    event_type: str
    message: str
    created_by: str | None = None
    meta_data: dict | None = None


class OrderActivityCreate(BaseModel):
    event_type: str
    message: str
    created_by: str | None = None
    meta_data: dict | None = None


class OrderActivity(OrderActivityBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Quote Item schemas
class QuoteItemBase(BaseModel):
    product_id: UUID
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class QuoteItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, description="Quantity must be at least 1")


class QuoteItem(QuoteItemBase):
    id: UUID
    quote_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Quote schemas
class QuoteBase(BaseModel):
    customer_id: UUID
    status: QuoteStatus = QuoteStatus.DRAFT
    valid_until: datetime | None = None  # Match database type
    notes: str | None = None

    @field_validator("valid_until", mode="before")
    @classmethod
    def normalize_valid_until(cls, value):
        """Convert date or string to datetime with UTC timezone."""
        if value is None:
            return value
        if isinstance(value, datetime):
            # Ensure timezone aware
            if value.tzinfo is None:
                return value.replace(tzinfo=UTC)
            return value
        if isinstance(value, date):
            # Convert date to datetime at midnight UTC
            return datetime.combine(value, time.min, tzinfo=UTC)
        if isinstance(value, str):
            # Try parsing ISO format
            try:
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=UTC)
                return dt
            except (ValueError, AttributeError):
                pass
        return value

    @field_serializer('valid_until')
    def serialize_valid_until(self, value: datetime | None) -> str | None:
        """Serialize datetime as ISO date string for API responses."""
        if value is None:
            return None
        return value.date().isoformat()

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value):
        """Accept both enum and string, validate against allowed values."""
        if isinstance(value, QuoteStatus):
            return value
        if isinstance(value, str):
            # Validate string is a valid enum value
            try:
                return QuoteStatus(value)
            except ValueError:
                # Provide helpful error message with valid options
                valid = [s.value for s in QuoteStatus]
                raise ValueError(f"Invalid status '{value}'. Must be one of: {', '.join(valid)}")
        return value


class QuoteCreate(QuoteBase):
    valid_until: datetime | None = None  # Made optional to match backend logic
    items: list[QuoteItemCreate] = Field(min_length=1, description="Quote must have at least one item")


class QuoteUpdate(BaseModel):
    customer_id: UUID | None = None
    status: QuoteStatus | None = None
    valid_until: datetime | None = None
    notes: str | None = None
    items: list[QuoteItemCreate] | None = Field(None, description="If provided, quote must have at least one item")

    @model_validator(mode="after")
    def validate_items(self):
        """Ensure quotes have at least one item if items are being updated."""
        if self.items is not None and len(self.items) == 0:
            raise ValueError("Quote must have at least one item. Cannot update to zero items.")
        return self

    @field_validator("valid_until", mode="before")
    @classmethod
    def normalize_valid_until(cls, value):
        """Convert date or string to datetime with UTC timezone."""
        if value is None:
            return value
        if isinstance(value, datetime):
            # Ensure timezone aware
            if value.tzinfo is None:
                return value.replace(tzinfo=UTC)
            return value
        if isinstance(value, date):
            # Convert date to datetime at midnight UTC
            return datetime.combine(value, time.min, tzinfo=UTC)
        if isinstance(value, str):
            # Try parsing ISO format
            try:
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=UTC)
                return dt
            except (ValueError, AttributeError):
                pass
        return value

    @field_serializer('valid_until')
    def serialize_valid_until(self, value: datetime | None) -> str | None:
        """Serialize datetime as ISO date string for API responses."""
        if value is None:
            return None
        return value.date().isoformat()

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, value):
        """Accept both enum and string, validate against allowed values."""
        if value is None:
            return value
        if isinstance(value, QuoteStatus):
            return value
        if isinstance(value, str):
            # Validate string is a valid enum value
            try:
                return QuoteStatus(value)
            except ValueError:
                # Provide helpful error message with valid options
                valid = [s.value for s in QuoteStatus]
                raise ValueError(f"Invalid status '{value}'. Must be one of: {', '.join(valid)}")
        return value


class Quote(QuoteBase):
    id: UUID
    organization_id: UUID | None = None
    quote_number: str
    total: Decimal
    quote_date: datetime
    created_at: datetime
    updated_at: datetime
    items: list[QuoteItem] = []

    class Config:
        from_attributes = True


# Dashboard schemas
class DashboardMetrics(BaseModel):
    total_revenue: Decimal
    active_orders: int
    total_products: int
    total_customers: int
    low_stock_alerts: int
    pending_quotes: int


class RevenueDataPoint(BaseModel):
    month: str
    revenue: Decimal


class CategorySales(BaseModel):
    category: str
    total: Decimal


class TopProduct(BaseModel):
    name: str
    quantity_sold: int
    revenue: Decimal


# List response schemas
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


# Error response schemas
class ErrorDetail(BaseModel):
    """Detailed error information for validation errors."""
    field: str | None = None
    message: str
    type: str | None = None


class ErrorResponse(BaseModel):
    """Standardized error response format."""
    error: str  # Human-readable error message
    detail: str | None = None
    status_code: int
    errors: list[ErrorDetail] | None = None


# Background Job schemas
class JobCreate(BaseModel):
    """Schema for creating a new background job."""
    job_type: str
    input_data: dict | None = None


class Job(BaseModel):
    """Schema for background job response."""
    id: UUID
    job_type: str
    status: str  # pending, processing, completed, failed, cancelled
    input_data: dict | None = None
    output_data: dict | None = None
    progress: int  # 0-100
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True
