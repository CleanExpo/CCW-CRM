"""SQLAlchemy models for ERP system."""
# ruff: noqa: E501, N811
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class Organization(Base):
    """Organization model for multi-tenancy."""
    __tablename__ = "organizations"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    subdomain = Column(String(100), unique=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization")
    products = relationship("Product", back_populates="organization")
    customers = relationship("Customer", back_populates="organization")
    orders = relationship("Order", back_populates="organization")
    quotes = relationship("Quote", back_populates="organization")


class User(Base):
    """User model."""
    __tablename__ = "users"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"))
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), nullable=False, default="employee")
    is_admin = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")


class Product(Base):
    """Product model."""
    __tablename__ = "products"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), index=True)
    sku = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    cost = Column(Numeric(10, 2))
    stock = Column(Integer, nullable=False, default=0)
    warehouse_location = Column(String(100))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    quote_items = relationship("QuoteItem", back_populates="product")


class Customer(Base):
    """Customer model."""
    __tablename__ = "customers"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), index=True)
    customer_number = Column(String(50), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(50))
    postcode = Column(String(20))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="customers")
    orders = relationship("Order", back_populates="customer")
    quotes = relationship("Quote", back_populates="customer")


class Order(Base):
    """Order model."""
    __tablename__ = "orders"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), index=True)
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    customer_id = Column(PostgresUUID(as_uuid=True), ForeignKey("customers.id"), index=True)
    status = Column(String(20), nullable=False, default="draft")
    total = Column(Numeric(10, 2), nullable=False)
    order_date = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    """Order item model."""
    __tablename__ = "order_items"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id = Column(PostgresUUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(PostgresUUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class Quote(Base):
    """Quote model."""
    __tablename__ = "quotes"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(PostgresUUID(as_uuid=True), ForeignKey("organizations.id"), index=True)
    quote_number = Column(String(50), nullable=False, unique=True, index=True)
    customer_id = Column(PostgresUUID(as_uuid=True), ForeignKey("customers.id"), index=True)
    status = Column(String(20), nullable=False, default="draft")
    total = Column(Numeric(10, 2), nullable=False)
    quote_date = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    valid_until = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="quotes")
    customer = relationship("Customer", back_populates="quotes")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")


class QuoteItem(Base):
    """Quote item model."""
    __tablename__ = "quote_items"

    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    quote_id = Column(PostgresUUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(PostgresUUID(as_uuid=True), ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_total = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    quote = relationship("Quote", back_populates="items")
    product = relationship("Product", back_populates="quote_items")
