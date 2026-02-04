"""Pydantic schemas for ERP API."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from src.db.demo_models import OrderStatus, QuoteStatus
from src.db.erp_models import ProductCategory


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
    xero_contact_id: str | None = None
    xero_synced_at: datetime | None = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_name: str | None = None
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    postcode: str | None = None
    xero_contact_id: str | None = None
    xero_synced_at: datetime | None = None
    is_active: bool | None = None


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
    items: list[OrderItemCreate] | None = None
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
    valid_until: date | None = None
    notes: str | None = None

    @field_validator("valid_until", mode="before")
    @classmethod
    def normalize_valid_until(cls, value):
        """Normalize valid_until to date type, accepting datetime or ISO date strings."""
        if value is None:
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            # Try parsing ISO format (YYYY-MM-DD)
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
            except (ValueError, AttributeError):
                # If that fails, let Pydantic handle it (will raise validation error)
                pass
        return value


class QuoteCreate(QuoteBase):
    valid_until: date
    items: list[QuoteItemCreate] = Field(min_length=1, description="Quote must have at least one item")


class QuoteUpdate(BaseModel):
    customer_id: UUID | None = None
    status: QuoteStatus | None = None
    valid_until: date | None = None
    notes: str | None = None
    items: list[QuoteItemCreate] | None = Field(None, min_length=1, description="If provided, quote must have at least one item")


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
