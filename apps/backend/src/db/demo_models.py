"""
Simplified SQLAlchemy models for overnight demo.

These models are optimized for quick demo setup with essential fields only.
"""

import enum
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from .models import Base  # Use existing Base class


class OrderStatus(str, enum.Enum):
    """Order status enum."""

    DRAFT = "draft"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class QuoteStatus(str, enum.Enum):
    """Quote status enum."""

    DRAFT = "draft"
    PENDING = "pending"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ProductCategory(str, enum.Enum):
    """Product category enum for equipment supplier."""

    HEAVY_MACHINERY = "heavy_machinery"
    HAND_TOOLS = "hand_tools"
    POWER_TOOLS = "power_tools"
    SAFETY_EQUIPMENT = "safety_equipment"
    BUILDING_MATERIALS = "building_materials"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    ACCESSORIES = "accessories"


class Product(Base):
    """Product model for equipment catalog."""

    __tablename__ = "products"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    sku: str = Column(String(50), unique=True, nullable=False, index=True)
    name: str = Column(String(255), nullable=False)
    description: Optional[str] = Column(Text, nullable=True)
    category: ProductCategory = Column(
        Enum(ProductCategory, name="product_category"),
        nullable=False,
        default=ProductCategory.ACCESSORIES,
        index=True,
    )
    price: Decimal = Column(Numeric(10, 2), nullable=False)
    cost: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    stock: int = Column(Integer, nullable=False, default=0)
    warehouse_location: Optional[str] = Column(String(100), nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    order_items = relationship("OrderItem", back_populates="product")
    quote_items = relationship("QuoteItem", back_populates="product")

    def __repr__(self) -> str:
        return f"<Product(sku={self.sku}, name={self.name})>"


class Customer(Base):
    """Customer model for CRM."""

    __tablename__ = "customers"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_number: str = Column(String(50), unique=True, nullable=False, index=True)
    company_name: str = Column(String(255), nullable=False)
    contact_name: str = Column(String(255), nullable=False)
    email: str = Column(String(255), nullable=False, index=True)
    phone: Optional[str] = Column(String(20), nullable=True)
    address: Optional[str] = Column(Text, nullable=True)
    city: Optional[str] = Column(String(100), nullable=True)
    state: Optional[str] = Column(String(50), nullable=True)
    postcode: Optional[str] = Column(String(10), nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    orders = relationship("Order", back_populates="customer")
    quotes = relationship("Quote", back_populates="customer")

    def __repr__(self) -> str:
        return f"<Customer(number={self.customer_number}, company={self.company_name})>"


class Order(Base):
    """Sales order model."""

    __tablename__ = "orders"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    order_number: str = Column(String(50), unique=True, nullable=False, index=True)
    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: OrderStatus = Column(
        Enum(OrderStatus, name="order_status"),
        default=OrderStatus.PENDING,
        nullable=False,
        index=True,
    )
    subtotal: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    tax: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    total: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    notes: Optional[str] = Column(Text, nullable=True)
    order_date: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    customer = relationship("Customer", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Order(number={self.order_number}, total={self.total})>"


class OrderItem(Base):
    """Order line item model."""

    __tablename__ = "order_items"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity: int = Column(Integer, nullable=False, default=1)
    unit_price: Decimal = Column(Numeric(10, 2), nullable=False)
    line_total: Decimal = Column(Numeric(10, 2), nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")

    def __repr__(self) -> str:
        return f"<OrderItem(order_id={self.order_id}, product_id={self.product_id}, quantity={self.quantity})>"


class Quote(Base):
    """Quote model for pricing estimates."""

    __tablename__ = "quotes"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    quote_number: str = Column(String(50), unique=True, nullable=False, index=True)
    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: QuoteStatus = Column(
        Enum(QuoteStatus, name="quote_status"),
        default=QuoteStatus.DRAFT,
        nullable=False,
        index=True,
    )
    subtotal: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    tax: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    total: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    notes: Optional[str] = Column(Text, nullable=True)
    valid_until: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    quote_date: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    customer = relationship("Customer", back_populates="quotes")
    quote_items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Quote(number={self.quote_number}, total={self.total})>"


class QuoteItem(Base):
    """Quote line item model."""

    __tablename__ = "quote_items"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    quote_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity: int = Column(Integer, nullable=False, default=1)
    unit_price: Decimal = Column(Numeric(10, 2), nullable=False)
    line_total: Decimal = Column(Numeric(10, 2), nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    quote = relationship("Quote", back_populates="quote_items")
    product = relationship("Product", back_populates="quote_items")

    def __repr__(self) -> str:
        return f"<QuoteItem(quote_id={self.quote_id}, product_id={self.product_id}, quantity={self.quantity})>"
