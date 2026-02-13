"""Multi-store inventory models.

Database models for tracking stock across multiple locations.
"""

from datetime import UTC, datetime
from decimal import Decimal
import enum
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID  # noqa: N811
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .models_base import Base


class StoreLocation(str, enum.Enum):
    """Store location enum."""

    BRISBANE = "brisbane"
    SYDNEY = "sydney"
    MELBOURNE = "melbourne"


class ProductStockByLocation(Base):
    """Product stock tracking by store location.

    Tracks inventory independently for each store, with support for
    stock reservation and transfers.
    """

    __tablename__ = "product_stock_by_location"

    # Add unique constraint on product_id + location
    __table_args__ = (
        UniqueConstraint("product_id", "location", name="uq_product_location"),
        CheckConstraint("stock >= 0", name="ck_stock_non_negative"),
        CheckConstraint("reserved >= 0", name="ck_reserved_non_negative"),
    )

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Foreign key to products table
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Store location
    location: str = Column(String(50), nullable=False, index=True)

    # Stock levels
    stock: int = Column(Integer, default=0, nullable=False)
    reserved: int = Column(Integer, default=0, nullable=False)
    # available is computed as (stock - reserved)

    # Stock counting
    last_counted_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    last_counted_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)

    # Reorder settings
    reorder_point: int | None = Column(Integer, nullable=True)
    reorder_quantity: int | None = Column(Integer, nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    @property
    def available(self) -> int:
        """Calculate available stock (stock - reserved)."""
        return max(0, self.stock - self.reserved)

    def __repr__(self) -> str:
        return f"<ProductStockByLocation(product_id={self.product_id}, location={self.location}, stock={self.stock})>"  # noqa: E501


class StockTransfer(Base):
    """Stock transfer between locations.

    Tracks movement of inventory between stores.
    """

    __tablename__ = "stock_transfers"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Product being transferred
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Transfer details
    from_location: str = Column(String(50), nullable=False, index=True)
    to_location: str = Column(String(50), nullable=False, index=True)
    quantity: int = Column(Integer, nullable=False)

    # Status tracking
    status: str = Column(
        String(50), default="pending", nullable=False
    )  # pending, in_transit, completed, cancelled

    # Transfer metadata
    reason: str | None = Column(String(500), nullable=True)
    notes: str | None = Column(String(1000), nullable=True)

    # User tracking
    initiated_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)
    completed_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)

    # Timestamps
    initiated_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
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
        return f"<StockTransfer(product_id={self.product_id}, {self.from_location}→{self.to_location}, qty={self.quantity})>"  # noqa: E501


class StockReservation(Base):
    """Stock reservation for pending orders.

    Reserves stock at a location for orders that are being processed.
    """

    __tablename__ = "stock_reservations"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # References
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Reservation details
    location: str = Column(String(50), nullable=False, index=True)
    quantity: int = Column(Integer, nullable=False)

    # Status
    status: str = Column(
        String(50), default="active", nullable=False
    )  # active, fulfilled, cancelled, expired

    # Expiration (auto-release after X hours if not fulfilled)
    expires_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    reserved_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    fulfilled_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    cancelled_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

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
        return f"<StockReservation(product_id={self.product_id}, order_id={self.order_id}, qty={self.quantity})>"  # noqa: E501


class StockAdjustment(Base):
    """Stock adjustment log for auditing.

    Records all stock level changes for audit trail.
    """

    __tablename__ = "stock_adjustments"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # References
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Adjustment details
    location: str = Column(String(50), nullable=False, index=True)
    quantity_change: int = Column(Integer, nullable=False)  # Can be positive or negative
    previous_quantity: int = Column(Integer, nullable=False)
    new_quantity: int = Column(Integer, nullable=False)

    # Reason and context
    adjustment_type: str = Column(
        String(50), nullable=False
    )  # stock_count, damage, theft, correction, transfer, sale, return
    reason: str | None = Column(String(500), nullable=True)
    reference_id: UUID | None = Column(
        PostgresUUID(as_uuid=True), nullable=True
    )  # Related order, transfer, etc.

    # User tracking
    adjusted_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)

    # Timestamp
    adjusted_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<StockAdjustment(product_id={self.product_id}, location={self.location}, change={self.quantity_change})>"  # noqa: E501


class Supplier(Base):
    """Supplier/Vendor for purchasing inventory."""

    __tablename__ = "suppliers"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    supplier_code: str = Column(String(50), unique=True, nullable=False, index=True)
    company_name: str = Column(String(255), nullable=False, index=True)
    contact_name: str | None = Column(String(255), nullable=True)
    email: str | None = Column(String(255), nullable=True, index=True)
    phone: str | None = Column(String(50), nullable=True)
    abn: str | None = Column(String(20), nullable=True)  # Australian Business Number
    address: str | None = Column(Text, nullable=True)
    city: str | None = Column(String(100), nullable=True)
    state: str | None = Column(String(50), nullable=True)
    postal_code: str | None = Column(String(20), nullable=True)
    country: str = Column(String(2), default="AU", nullable=False)
    payment_terms: str | None = Column(String(100), nullable=True)  # e.g., "Net 30"
    preferred_carrier: str | None = Column(String(100), nullable=True)
    xero_contact_id: str | None = Column(String(255), nullable=True)
    xero_synced_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False, index=True)
    notes: str | None = Column(Text, nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier(code={self.supplier_code}, company={self.company_name})>"


class PurchaseOrder(Base):
    """Purchase order for ordering stock from suppliers."""

    __tablename__ = "purchase_orders"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    po_number: str = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id: UUID = Column(
        PostgresUUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False, index=True
    )
    delivery_location: str = Column(String(50), nullable=False, index=True)  # brisbane, sydney, melbourne  # noqa: E501
    status: str = Column(String(50), default="draft", nullable=False, index=True)
    # Status: draft, pending_approval, approved, ordered, in_transit, received, cancelled

    order_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    expected_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)

    subtotal: Decimal = Column(Numeric(10, 2), default=0, nullable=False)
    tax: Decimal = Column(Numeric(10, 2), default=0, nullable=False)
    shipping_cost: Decimal | None = Column(Numeric(10, 2), nullable=True)
    total: Decimal = Column(Numeric(10, 2), default=0, nullable=False)

    notes: str | None = Column(Text, nullable=True)
    xero_purchase_order_id: str | None = Column(String(255), nullable=True)
    xero_synced_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    created_by_id: UUID | None = Column(
        PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")  # noqa: E501
    inbound_shipments = relationship("InboundShipment", back_populates="purchase_order")

    def __repr__(self) -> str:
        return f"<PurchaseOrder(po_number={self.po_number}, supplier_id={self.supplier_id}, total={self.total})>"  # noqa: E501


class PurchaseOrderItem(Base):
    """Line items for purchase orders."""

    __tablename__ = "purchase_order_items"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    purchase_order_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )

    quantity: int = Column(Integer, nullable=False)
    quantity_received: int = Column(Integer, default=0, nullable=False)
    unit_cost: Decimal = Column(Numeric(10, 2), nullable=False)
    subtotal: Decimal = Column(Numeric(10, 2), nullable=False)  # quantity × unit_cost

    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")

    def __repr__(self) -> str:
        return f"<PurchaseOrderItem(po_id={self.purchase_order_id}, product_id={self.product_id}, qty={self.quantity})>"  # noqa: E501


class InboundShipment(Base):
    """Inbound shipments from suppliers to warehouses."""

    __tablename__ = "inbound_shipments"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    shipment_number: str = Column(String(50), unique=True, nullable=False, index=True)
    purchase_order_id: UUID | None = Column(
        PostgresUUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=True, index=True
    )
    supplier_id: UUID = Column(
        PostgresUUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False, index=True
    )

    carrier_name: str | None = Column(String(100), nullable=True)
    carrier_service: str | None = Column(String(100), nullable=True)  # e.g., "Express", "Standard"
    tracking_number: str | None = Column(String(100), nullable=True, index=True)

    origin_address: str | None = Column(Text, nullable=True)
    destination_location: str = Column(String(50), nullable=False, index=True)  # brisbane, sydney, melbourne  # noqa: E501

    status: str = Column(String(50), default="pending", nullable=False, index=True)
    # Status: pending, in_transit, out_for_delivery, delivered, exception, cancelled

    shipped_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    expected_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)

    tracking_events: dict | None = Column(JSON, nullable=True)  # Carrier tracking history
    last_tracking_update: datetime | None = Column(DateTime(timezone=True), nullable=True)

    notes: str | None = Column(Text, nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="inbound_shipments")
    supplier = relationship("Supplier")

    def __repr__(self) -> str:
        return f"<InboundShipment(number={self.shipment_number}, tracking={self.tracking_number}, status={self.status})>"  # noqa: E501


class OutboundShipment(Base):
    """Outbound shipments from warehouses to customers."""

    __tablename__ = "outbound_shipments"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    shipment_number: str = Column(String(50), unique=True, nullable=False, index=True)
    order_id: UUID = Column(
        PostgresUUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True
    )

    carrier_name: str | None = Column(String(100), nullable=True)
    carrier_service: str | None = Column(String(100), nullable=True)
    tracking_number: str | None = Column(String(100), nullable=True, index=True)

    origin_location: str = Column(String(50), nullable=False, index=True)  # brisbane, sydney, melbourne  # noqa: E501
    destination_address: str | None = Column(Text, nullable=True)

    status: str = Column(String(50), default="pending", nullable=False, index=True)
    # Status: pending, in_transit, out_for_delivery, delivered, exception, returned

    shipped_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    expected_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date: datetime | None = Column(DateTime(timezone=True), nullable=True)

    tracking_events: dict | None = Column(JSON, nullable=True)
    last_tracking_update: datetime | None = Column(DateTime(timezone=True), nullable=True)

    notes: str | None = Column(Text, nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    order = relationship("Order", back_populates="shipments")

    def __repr__(self) -> str:
        return f"<OutboundShipment(number={self.shipment_number}, order_id={self.order_id}, status={self.status})>"  # noqa: E501


class CarrierConfiguration(Base):
    """Configuration for carrier API integrations."""

    __tablename__ = "carrier_configurations"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    carrier_name: str = Column(String(100), unique=True, nullable=False, index=True)
    api_key_encrypted: str | None = Column(Text, nullable=True)
    api_endpoint: str | None = Column(String(255), nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False)
    supported_services: dict | None = Column(JSON, nullable=True)  # List of service types
    webhook_secret: str | None = Column(String(255), nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    def __repr__(self) -> str:
        return f"<CarrierConfiguration(name={self.carrier_name}, active={self.is_active})>"
