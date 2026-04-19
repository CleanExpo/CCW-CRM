"""Multi-store inventory models.

Database models for tracking stock across multiple locations.
"""

import enum
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
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

    # Weighted average landed cost per unit (updated on GRN receipt)
    average_cost: Decimal | None = Column(Numeric(12, 4), nullable=True)

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
        PostgresUUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
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
        PostgresUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")  # noqa: E501
    inbound_shipments = relationship("InboundShipment", back_populates="purchase_order")
    goods_received_notes = relationship("GoodsReceivedNote", back_populates="purchase_order")

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
        PostgresUUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
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
    grn_lines = relationship("GoodsReceivedNoteLine", back_populates="po_item")

    def __repr__(self) -> str:
        return f"<PurchaseOrderItem(po_id={self.purchase_order_id}, product_id={self.product_id}, qty={self.quantity})>"  # noqa: E501


class InboundShipment(Base):
    """Inbound shipments from suppliers to warehouses."""

    __tablename__ = "inbound_shipments"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    shipment_number: str = Column(String(50), unique=True, nullable=False, index=True)
    purchase_order_id: UUID | None = Column(
        PostgresUUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    supplier_id: UUID = Column(
        PostgresUUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True
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

    tracking_events: dict | None = Column(JSONB, nullable=True)  # Carrier tracking history
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
        PostgresUUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, index=True
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

    tracking_events: dict | None = Column(JSONB, nullable=True)
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
    supported_services: dict | None = Column(JSONB, nullable=True)  # List of service types
    webhook_secret: str | None = Column(String(255), nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    def __repr__(self) -> str:
        return f"<CarrierConfiguration(name={self.carrier_name}, active={self.is_active})>"


class ProductBarcode(Base):
    """Barcode records for products.

    Side-table approach — keeps demo_models.py (Product) locked while
    allowing multiple barcode formats per product.
    """

    __tablename__ = "product_barcodes"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Foreign key to products table (defined in demo_models.py)
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Barcode value — unique across all products
    barcode: str = Column(String(100), unique=True, nullable=False, index=True)

    # Barcode format: EAN13 | UPC | QR | CODE128
    barcode_type: str = Column(String(50), default="EAN13", nullable=False)

    # Timestamp
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProductBarcode(product_id={self.product_id}, barcode={self.barcode}, type={self.barcode_type})>"


class StockTake(Base):
    """Cycle-count / stock-take session.

    A stock-take records the physical count of all products at a location.
    Submitting it applies variances as StockAdjustment records and stamps
    last_counted_at on each ProductStockByLocation row.
    """

    __tablename__ = "stock_takes"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    location: str = Column(String(50), nullable=False, index=True)
    status: str = Column(
        String(50), default="draft", nullable=False, index=True
    )  # draft | submitted

    created_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)
    submitted_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    submitted_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    items = relationship("StockTakeItem", back_populates="stock_take", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<StockTake(location={self.location}, status={self.status})>"


class StockTakeItem(Base):
    """One line in a stock-take session — per product."""

    __tablename__ = "stock_take_items"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    stock_take_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("stock_takes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    system_qty: int = Column(Integer, nullable=False)   # qty at time of count
    counted_qty: int = Column(Integer, nullable=False)  # physically counted
    variance: int = Column(Integer, nullable=False)      # counted - system

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    stock_take = relationship("StockTake", back_populates="items")
    product = relationship("Product")

    def __repr__(self) -> str:
        return f"<StockTakeItem(stock_take_id={self.stock_take_id}, product_id={self.product_id}, variance={self.variance})>"


class ReorderRule(Base):
    """Reorder automation rule — links a product+location to a preferred supplier.

    When auto-reorder is triggered for a product at a location this rule
    determines which supplier to create the draft PO against.
    """

    __tablename__ = "reorder_rules"

    __table_args__ = (
        UniqueConstraint("product_id", "location", name="uq_reorder_rule_product_location"),
    )

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location: str = Column(String(50), nullable=False)
    supplier_id: UUID | None = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Auto-approve a PO if quantity below this threshold (0 = always manual)
    auto_approve_under_qty: int = Column(Integer, default=0, nullable=False)
    lead_time_days: int = Column(Integer, default=7, nullable=False)
    is_enabled: bool = Column(Boolean, default=True, nullable=False)

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
    supplier = relationship("Supplier")

    def __repr__(self) -> str:
        return f"<ReorderRule(product_id={self.product_id}, location={self.location}, supplier_id={self.supplier_id})>"


class ProductAttribute(Base):
    """Key-value attributes for a product (e.g., Colour=Red, Weight=5kg)."""

    __tablename__ = "product_attributes"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key: str = Column(String(100), nullable=False)
    value: str = Column(String(500), nullable=False)
    unit: str | None = Column(String(50), nullable=True)  # e.g., "kg", "cm"

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<ProductAttribute(product_id={self.product_id}, key={self.key}, value={self.value})>"


class ProductVariant(Base):
    """Product variant — e.g., size/colour combination with its own SKU."""

    __tablename__ = "product_variants"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_sku: str = Column(String(100), unique=True, nullable=False, index=True)
    name: str = Column(String(255), nullable=False)
    attributes: dict | None = Column(JSONB, nullable=True)  # {"Colour": "Red", "Size": "L"}
    price_override: Decimal | None = Column(Numeric(10, 2), nullable=True)
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
        return f"<ProductVariant(product_id={self.product_id}, sku={self.variant_sku}, name={self.name})>"


class GoodsReceivedNote(Base):
    """Goods Received Note (GRN) — records physical receipt of goods against a PO.

    Sits between PO-approved and PO-invoiced. AP must have at least one GRN
    before an invoice can be posted. Phase 1 of three-way match (UNI-1833).

    Status workflow: draft → received → approved | rejected
    """

    __tablename__ = "grn"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    grn_number: str = Column(String(50), unique=True, nullable=False, index=True)
    po_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("purchase_orders.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    supplier_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    delivery_location: str = Column(String(50), nullable=False, index=True)
    status: str = Column(
        String(50), default="draft", nullable=False, index=True
    )  # draft | received | approved | rejected

    received_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    received_by: UUID | None = Column(PostgresUUID(as_uuid=True), nullable=True)
    notes: str | None = Column(Text, nullable=True)

    # Landed cost components (allocated at receipt; apportioned to lines by PO-value proportion)
    freight_cost: Decimal = Column(Numeric(12, 4), default=Decimal("0"), nullable=False)
    customs_duty: Decimal = Column(Numeric(12, 4), default=Decimal("0"), nullable=False)
    handling_cost: Decimal = Column(Numeric(12, 4), default=Decimal("0"), nullable=False)

    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    @property
    def total_landed_cost(self) -> Decimal:
        """Total landed cost = freight + customs duty + handling."""
        return (self.freight_cost or Decimal("0")) + (self.customs_duty or Decimal("0")) + (self.handling_cost or Decimal("0"))

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="goods_received_notes")
    lines = relationship(
        "GoodsReceivedNoteLine", back_populates="grn", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<GoodsReceivedNote(grn_number={self.grn_number}, po_id={self.po_id}, status={self.status})>"


class GoodsReceivedNoteLine(Base):
    """Line item in a Goods Received Note.

    Records expected vs received vs rejected quantity per PO item.
    Variance (quantity_expected - quantity_received - quantity_rejected) feeds
    Phase 2 three-way match logic.
    """

    __tablename__ = "grn_line"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    grn_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("grn.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    po_item_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("purchase_order_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    quantity_expected: int = Column(Integer, nullable=False)
    quantity_received: int = Column(Integer, default=0, nullable=False)
    quantity_rejected: int = Column(Integer, default=0, nullable=False)

    # Per-unit landed cost apportioned from GRN header (by PO-value proportion)
    landed_cost_per_unit: Decimal = Column(Numeric(12, 4), default=Decimal("0"), nullable=False)
    # Full cost per unit = po_unit_cost + landed_cost_per_unit (written at GRN receipt)
    cost_per_unit: Decimal = Column(Numeric(12, 4), default=Decimal("0"), nullable=False)

    created_at: datetime = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    grn = relationship("GoodsReceivedNote", back_populates="lines")
    po_item = relationship("PurchaseOrderItem", back_populates="grn_lines")

    def __repr__(self) -> str:
        return f"<GoodsReceivedNoteLine(grn_id={self.grn_id}, product_id={self.product_id}, received={self.quantity_received}/{self.quantity_expected})>"  # noqa: E501


# ----------------------------------------------------------------------------
# RMA (Return Merchandise Authorisation) — UNI-1835
# ----------------------------------------------------------------------------


class RMAStatus(str, enum.Enum):
    """RMA lifecycle status."""

    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    RECEIVED = "RECEIVED"
    CREDITED = "CREDITED"
    CLOSED = "CLOSED"


# Valid forward-only transitions
_RMA_TRANSITIONS: dict[str, set[str]] = {
    "REQUESTED": {"APPROVED"},
    "APPROVED": {"RECEIVED"},
    "RECEIVED": {"CREDITED"},
    "CREDITED": {"CLOSED"},
    "CLOSED": set(),
}


def rma_status_can_advance(current: str, next_status: str) -> bool:
    """Return True when *next_status* is a valid forward transition from *current*."""
    return next_status in _RMA_TRANSITIONS.get(current, set())


class RMA(Base):
    """Return Merchandise Authorisation — top-level return record."""

    __tablename__ = "rma"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: str = Column(
        Enum(RMAStatus, name="rma_status", create_constraint=False),
        default=RMAStatus.REQUESTED.value,
        nullable=False,
        index=True,
    )
    reason: str = Column(Text, nullable=False)
    notes: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    lines = relationship("RMALine", back_populates="rma", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<RMA(id={self.id}, order_id={self.order_id}, status={self.status})>"


class RMALine(Base):
    """Single line item within an RMA."""

    __tablename__ = "rma_line"

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_rma_line_qty_positive"),
    )

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    rma_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("rma.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_item_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quantity: int = Column(Integer, nullable=False)

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    rma = relationship("RMA", back_populates="lines")

    def __repr__(self) -> str:
        return f"<RMALine(rma_id={self.rma_id}, order_item_id={self.order_item_id}, qty={self.quantity})>"


# ----------------------------------------------------------------------------
# Pydantic schemas for RMA API layer
# ----------------------------------------------------------------------------


class RMALineCreate(BaseModel):
    """Request body for a single line when creating an RMA."""

    order_item_id: UUID
    quantity: int


class RMALineRead(BaseModel):
    """Response schema for an RMA line."""

    id: UUID
    rma_id: UUID
    order_item_id: UUID
    quantity: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RMACreate(BaseModel):
    """Request body for creating a new RMA."""

    reason: str
    notes: str | None = None
    lines: list[RMALineCreate]


class RMARead(BaseModel):
    """Response schema for an RMA record."""

    id: UUID
    order_id: UUID
    status: str
    reason: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    lines: list[RMALineRead] = []

    model_config = {"from_attributes": True}


class RMAStatusUpdate(BaseModel):
    """Request body for advancing RMA status."""

    status: str
