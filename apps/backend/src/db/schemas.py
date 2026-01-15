"""Pydantic schemas for ERP API."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr


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
    category: str
    price: Decimal
    cost: Decimal | None = None
    stock: int = 0
    warehouse_location: str | None = None
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    price: Decimal | None = None
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
    quantity: int


class OrderItem(OrderItemBase):
    id: UUID
    order_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Order schemas
class OrderBase(BaseModel):
    customer_id: UUID
    status: str = "draft"
    fulfillment_location: str | None = "brisbane"  # brisbane, sydney, or melbourne
    notes: str | None = None


class OrderCreate(OrderBase):
    items: list[OrderItemCreate]


class OrderUpdate(BaseModel):
    customer_id: UUID | None = None
    status: str | None = None
    fulfillment_location: str | None = None
    notes: str | None = None
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
    # Relationship loaded from SQLAlchemy - frontend handles both 'items' and 'order_items'
    order_items: list[OrderItem]

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
    quantity: int


class QuoteItem(QuoteItemBase):
    id: UUID
    quote_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Quote schemas
class QuoteBase(BaseModel):
    customer_id: UUID
    status: str = "draft"
    valid_until: datetime | None = None
    notes: str | None = None


class QuoteCreate(QuoteBase):
    items: list[QuoteItemCreate]


class QuoteUpdate(BaseModel):
    customer_id: UUID | None = None
    status: str | None = None
    valid_until: datetime | None = None
    notes: str | None = None
    items: list[QuoteItemCreate] | None = None


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
