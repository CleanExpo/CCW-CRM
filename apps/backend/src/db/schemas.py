"""Pydantic schemas for ERP API."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# Organization schemas
class OrganizationBase(BaseModel):
    name: str
    subdomain: Optional[str] = None
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
    full_name: Optional[str] = None
    role: str = "employee"
    is_admin: bool = False
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: UUID
    organization_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Product schemas
class ProductBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    price: Decimal
    cost: Optional[Decimal] = None
    stock: int = 0
    warehouse_location: Optional[str] = None
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[Decimal] = None
    cost: Optional[Decimal] = None
    stock: Optional[int] = None
    warehouse_location: Optional[str] = None
    is_active: Optional[bool] = None


class Product(ProductBase):
    id: UUID
    organization_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Customer schemas
class CustomerBase(BaseModel):
    customer_number: str
    company_name: str
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    is_active: Optional[bool] = None


class Customer(CustomerBase):
    id: UUID
    organization_id: Optional[UUID] = None
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
    notes: Optional[str] = None


class OrderCreate(OrderBase):
    items: list[OrderItemCreate]


class OrderUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list[OrderItemCreate]] = None
    subtotal: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    total: Optional[Decimal] = None


class Order(OrderBase):
    id: UUID
    organization_id: Optional[UUID] = None
    order_number: str
    total: Decimal
    order_date: datetime
    created_at: datetime
    updated_at: datetime
    items: list[OrderItem] = []

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
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None


class QuoteCreate(QuoteBase):
    items: list[QuoteItemCreate]


class QuoteUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    status: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None


class Quote(QuoteBase):
    id: UUID
    organization_id: Optional[UUID] = None
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
