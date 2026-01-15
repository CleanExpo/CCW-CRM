"""
Simplified SQLAlchemy models for overnight demo.

These models are optimized for quick demo setup with essential fields only.
"""
# ruff: noqa: E501

import enum
from datetime import UTC, datetime
from decimal import Decimal
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
from sqlalchemy.dialects.postgresql import JSON, UUID as PGUUID
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

    HEAVY_MACHINERY = "HEAVY_MACHINERY"
    HAND_TOOLS = "HAND_TOOLS"
    POWER_TOOLS = "POWER_TOOLS"
    SAFETY_EQUIPMENT = "SAFETY_EQUIPMENT"
    BUILDING_MATERIALS = "BUILDING_MATERIALS"
    ELECTRICAL = "ELECTRICAL"
    PLUMBING = "PLUMBING"
    ACCESSORIES = "ACCESSORIES"


class JobStatus(str, enum.Enum):
    """Background job status enum."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Organization(Base):
    """Organization model for multi-tenant support."""

    __tablename__ = "organizations"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: str = Column(String(255), nullable=False, unique=True, index=True)
    slug: str = Column(String(100), nullable=False, unique=True, index=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Organization(name={self.name}, slug={self.slug})>"


class Product(Base):
    """Product model for equipment catalog."""

    __tablename__ = "products"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    sku: str = Column(String(50), unique=True, nullable=False, index=True)
    name: str = Column(String(255), nullable=False)
    description: str | None = Column(Text, nullable=True)
    category: ProductCategory = Column(
        Enum(ProductCategory, name="product_category", native_enum=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ProductCategory.ACCESSORIES,
        index=True,
    )
    price: Decimal = Column(Numeric(10, 2), nullable=False)
    cost: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    stock: int = Column(Integer, nullable=False, default=0)
    warehouse_location: str | None = Column(String(100), nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
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
    organization_id: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    customer_number: str = Column(String(50), unique=True, nullable=False, index=True)
    company_name: str = Column(String(255), nullable=False)
    contact_name: str = Column(String(255), nullable=False)
    email: str = Column(String(255), nullable=False, index=True)
    phone: str | None = Column(String(20), nullable=True)
    address: str | None = Column(Text, nullable=True)
    city: str | None = Column(String(100), nullable=True)
    state: str | None = Column(String(50), nullable=True)
    postcode: str | None = Column(String(10), nullable=True)

    # Xero integration fields
    xero_contact_id: str | None = Column(String(255), nullable=True)
    xero_synced_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    is_active: bool = Column(Boolean, default=True, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
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
    organization_id: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    order_number: str = Column(String(50), unique=True, nullable=False, index=True)
    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: OrderStatus = Column(
        Enum(OrderStatus, name="order_status", native_enum=True, values_callable=lambda x: [e.value for e in x]),
        default=OrderStatus.PENDING,
        nullable=False,
        index=True,
    )
    subtotal: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    tax: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    total: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    notes: str | None = Column(Text, nullable=True)

    # Xero integration fields
    xero_invoice_id: str | None = Column(String(255), nullable=True)
    xero_synced_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    xero_sync_status: str | None = Column(String(50), nullable=True)

    order_date: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Fulfillment and tracking fields
    fulfillment_location: str | None = Column(String(50), nullable=True, index=True)
    tracking_number: str | None = Column(String(100), nullable=True, index=True)
    carrier_name: str | None = Column(String(100), nullable=True)
    shipped_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    estimated_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    shipments = relationship("OutboundShipment", back_populates="order")

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
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
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
    organization_id: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    quote_number: str = Column(String(50), unique=True, nullable=False, index=True)
    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: QuoteStatus = Column(
        Enum(QuoteStatus, name="quote_status", native_enum=True, values_callable=lambda x: [e.value for e in x]),
        default=QuoteStatus.DRAFT,
        nullable=False,
        index=True,
    )
    subtotal: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    tax: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    total: Decimal = Column(Numeric(10, 2), nullable=False, default=0)
    notes: str | None = Column(Text, nullable=True)
    valid_until: datetime | None = Column(DateTime(timezone=True), nullable=True)
    quote_date: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
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
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    quote = relationship("Quote", back_populates="quote_items")
    product = relationship("Product", back_populates="quote_items")

    def __repr__(self) -> str:
        return f"<QuoteItem(quote_id={self.quote_id}, product_id={self.product_id}, quantity={self.quantity})>"


# AI-Related Models


class ConversationHistory(Base):
    """Conversation history for AI chat assistant."""

    __tablename__ = "conversation_history"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    role: str = Column(String(50), nullable=False)  # 'user' or 'assistant'
    content: str = Column(Text, nullable=False)
    user_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<ConversationHistory(id={self.id}, role={self.role})>"


class AgentExecution(Base):
    """Audit trail for AI agent executions."""

    __tablename__ = "agent_executions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id: str = Column(String(100), nullable=False, index=True)
    agent_name: str = Column(String(255), nullable=False)
    task: str = Column(Text, nullable=False)
    context_snapshot: str | None = Column(Text, nullable=True)  # JSON string for execution context
    status: str = Column(String(50), nullable=False)  # 'completed', 'failed', 'timeout'
    result: str | None = Column(Text, nullable=True)  # JSON string for result data
    error: str | None = Column(Text, nullable=True)
    execution_time_ms: int | None = Column(Integer, nullable=True)
    tokens_used: int | None = Column(Integer, nullable=True)  # LLM tokens consumed
    estimated_cost_usd: Decimal | None = Column(Numeric(10, 6), nullable=True)  # Estimated cost
    initiated_by: str = Column(String(50), nullable=False, default="api")  # workflow, api, supervisor
    parent_execution_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True, index=True)  # For chaining
    user_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AgentExecution(id={self.id}, agent={self.agent_name}, status={self.status})>"


class AIGeneratedContent(Base):
    """Storage for AI-generated content."""

    __tablename__ = "ai_generated_content"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    content_type: str = Column(String(50), nullable=False, index=True)  # 'quote', 'email', 'summary', 'report'
    title: str | None = Column(String(255), nullable=True)
    content: str = Column(Text, nullable=False)
    content_metadata: str | None = Column(Text, nullable=True)  # JSON string for additional data
    entity_type: str | None = Column(String(50), nullable=True)  # 'customer', 'order', 'quote', etc.
    entity_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    user_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AIGeneratedContent(id={self.id}, type={self.content_type})>"


class BackgroundJob(Base):
    """Background job for async processing (AI generation, long-running tasks)."""

    __tablename__ = "background_jobs"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    job_type: str = Column(String(100), nullable=False, index=True)  # 'ai_quote_generation', 'ai_order_insights', etc.
    status: JobStatus = Column(
        Enum(JobStatus, name="job_status", native_enum=False, values_callable=lambda x: [e.value for e in x]),
        default=JobStatus.PENDING,
        nullable=False,
        index=True,
    )
    input_data: dict | None = Column(JSON, nullable=True)  # JSON data for input parameters
    output_data: dict | None = Column(JSON, nullable=True)  # JSON data for results
    progress: int = Column(Integer, nullable=False, default=0)  # 0-100 percentage
    error_message: str | None = Column(Text, nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    started_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<BackgroundJob(id={self.id}, type={self.job_type}, status={self.status})>"
