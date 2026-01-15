"""
Container Tracking and Backorder Management Models.

These models replace CIN7's container tracking functionality with internal control.
Enables:
- Track incoming shipments from suppliers
- Calculate backorder ETAs from container arrival dates
- Pre-allocate stock to backorders
- Auto-fulfill backorders when containers arrive
"""

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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

# Import related models for SQLAlchemy relationship resolution
# These need to be imported so string-based relationships can be resolved
from .erp_models import Customer, Order, Product  # noqa: F401
from .inventory_models import PurchaseOrder, Supplier  # noqa: F401
from .models import Base


class ContainerStatus(str, enum.Enum):
    """Container shipment status."""

    BOOKED = "booked"  # Container booked with shipping line
    IN_TRANSIT = "in_transit"  # Currently being shipped
    AT_PORT = "at_port"  # Arrived at destination port
    CUSTOMS_CLEARANCE = "customs_clearance"  # Clearing customs
    CLEARED = "cleared"  # Cleared customs, ready for delivery
    OUT_FOR_DELIVERY = "out_for_delivery"  # On truck for delivery
    DELIVERED = "delivered"  # Received at warehouse
    CANCELLED = "cancelled"  # Shipment cancelled


class BackorderStatus(str, enum.Enum):
    """Backorder status."""

    PENDING = "pending"  # Awaiting stock
    ALLOCATED = "allocated"  # Stock allocated from incoming container
    READY = "ready"  # Stock available, ready to fulfill
    FULFILLED = "fulfilled"  # Order fulfilled
    CANCELLED = "cancelled"  # Backorder cancelled


class Container(Base):
    """
    Track shipping containers from suppliers.

    Replaces CIN7's container tracking with full internal control.
    Provides visibility into incoming stock and enables backorder pre-allocation.
    """

    __tablename__ = "containers"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    container_number: str = Column(String(50), nullable=False, unique=True, index=True)
    purchase_order_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=True, index=True
    )
    supplier_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True, index=True
    )

    # Shipment Details
    vessel_name: str | None = Column(String(255), nullable=True)
    voyage_number: str | None = Column(String(100), nullable=True)
    origin_port: str | None = Column(String(100), nullable=True)
    destination_port: str | None = Column(String(100), nullable=True)
    destination_warehouse: str = Column(
        String(50), nullable=False, default="brisbane", index=True
    )  # brisbane, sydney, melbourne

    # Dates
    booking_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    departure_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    estimated_arrival_date: datetime | None = Column(
        DateTime(timezone=True), nullable=True, index=True
    )
    actual_arrival_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    customs_clearance_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    delivered_date: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Status
    status: ContainerStatus = Column(
        Enum(ContainerStatus, name="container_status", values_callable=lambda x: [e.value for e in x]),  # noqa: E501
        nullable=False,
        default=ContainerStatus.BOOKED,
        index=True,
    )

    # Tracking
    tracking_number: str | None = Column(String(100), nullable=True)
    carrier: str | None = Column(String(100), nullable=True)
    tracking_url: str | None = Column(String(500), nullable=True)
    tracking_events: dict = Column(JSONB, default=dict, nullable=False)

    # Financial
    shipping_cost: Decimal | None = Column(Numeric(10, 2), nullable=True)
    customs_duty: Decimal | None = Column(Numeric(10, 2), nullable=True)
    other_charges: Decimal | None = Column(Numeric(10, 2), nullable=True)

    # Notes
    notes: str | None = Column(Text, nullable=True)
    internal_notes: str | None = Column(Text, nullable=True)

    # Metadata
    created_by: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
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
    items = relationship("ContainerItem", back_populates="container", cascade="all, delete-orphan")
    purchase_order = relationship("PurchaseOrder", foreign_keys=[purchase_order_id])
    backorders = relationship("Backorder", back_populates="container")

    def __repr__(self) -> str:
        return f"<Container(number={self.container_number}, status={self.status}, eta={self.estimated_arrival_date})>"  # noqa: E501

    @property
    def total_cost(self) -> Decimal:
        """Calculate total container cost."""
        total = Decimal("0.00")
        if self.shipping_cost:
            total += self.shipping_cost
        if self.customs_duty:
            total += self.customs_duty
        if self.other_charges:
            total += self.other_charges
        return total

    @property
    def is_overdue(self) -> bool:
        """Check if container is overdue."""
        if not self.estimated_arrival_date or self.status == ContainerStatus.DELIVERED:
            return False
        return datetime.now(UTC) > self.estimated_arrival_date.replace(tzinfo=UTC)

    @property
    def days_until_arrival(self) -> int | None:
        """Calculate days until estimated arrival."""
        if not self.estimated_arrival_date or self.status == ContainerStatus.DELIVERED:
            return None
        delta = self.estimated_arrival_date.replace(tzinfo=UTC) - datetime.now(UTC)
        return delta.days

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "container_number": self.container_number,
            "purchase_order_id": str(self.purchase_order_id) if self.purchase_order_id else None,
            "supplier_id": str(self.supplier_id) if self.supplier_id else None,
            "vessel_name": self.vessel_name,
            "voyage_number": self.voyage_number,
            "origin_port": self.origin_port,
            "destination_port": self.destination_port,
            "destination_warehouse": self.destination_warehouse,
            "booking_date": self.booking_date.isoformat() if self.booking_date else None,
            "departure_date": self.departure_date.isoformat() if self.departure_date else None,
            "estimated_arrival_date": self.estimated_arrival_date.isoformat() if self.estimated_arrival_date else None,  # noqa: E501
            "actual_arrival_date": self.actual_arrival_date.isoformat() if self.actual_arrival_date else None,  # noqa: E501
            "customs_clearance_date": self.customs_clearance_date.isoformat() if self.customs_clearance_date else None,  # noqa: E501
            "delivered_date": self.delivered_date.isoformat() if self.delivered_date else None,
            "status": self.status.value,
            "tracking_number": self.tracking_number,
            "carrier": self.carrier,
            "tracking_url": self.tracking_url,
            "tracking_events": self.tracking_events,
            "shipping_cost": str(self.shipping_cost) if self.shipping_cost else None,
            "customs_duty": str(self.customs_duty) if self.customs_duty else None,
            "other_charges": str(self.other_charges) if self.other_charges else None,
            "total_cost": str(self.total_cost),
            "is_overdue": self.is_overdue,
            "days_until_arrival": self.days_until_arrival,
            "notes": self.notes,
            "internal_notes": self.internal_notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ContainerItem(Base):
    """
    Items within a container.

    Links products to containers and enables pre-allocation to backorders.
    """

    __tablename__ = "container_items"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    container_id: UUID = Column(
        PGUUID(as_uuid=True), ForeignKey("containers.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    product_id: UUID = Column(
        PGUUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )

    # Quantities
    quantity_ordered: int = Column(Integer, nullable=False)
    quantity_received: int = Column(Integer, default=0, nullable=False)
    quantity_damaged: int = Column(Integer, default=0, nullable=False)

    # Pre-allocation to backorders
    quantity_preallocated: int = Column(
        Integer, default=0, nullable=False,
        comment="Quantity pre-allocated to specific backorders"
    )

    # Financial
    unit_cost: Decimal | None = Column(Numeric(10, 2), nullable=True)

    # Quality Control
    quality_checked: bool = Column(Boolean, default=False, nullable=False)
    quality_notes: str | None = Column(Text, nullable=True)

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

    # Relationships
    container = relationship("Container", back_populates="items")
    product = relationship("Product")

    def __repr__(self) -> str:
        return f"<ContainerItem(container={self.container_id}, product={self.product_id}, qty={self.quantity_ordered})>"  # noqa: E501

    @property
    def quantity_available(self) -> int:
        """Calculate quantity available (not pre-allocated)."""
        return max(0, self.quantity_ordered - self.quantity_preallocated)

    @property
    def total_cost(self) -> Decimal | None:
        """Calculate total cost for this line item."""
        if self.unit_cost is None:
            return None
        return self.unit_cost * Decimal(str(self.quantity_ordered))

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "container_id": str(self.container_id),
            "product_id": str(self.product_id),
            "quantity_ordered": self.quantity_ordered,
            "quantity_received": self.quantity_received,
            "quantity_damaged": self.quantity_damaged,
            "quantity_preallocated": self.quantity_preallocated,
            "quantity_available": self.quantity_available,
            "unit_cost": str(self.unit_cost) if self.unit_cost else None,
            "total_cost": str(self.total_cost) if self.total_cost else None,
            "quality_checked": self.quality_checked,
            "quality_notes": self.quality_notes,
        }


class Backorder(Base):
    """
    Track unfulfilled order items (backorders).

    Automatically calculates ETA from incoming containers and triggers
    fulfillment when stock arrives.
    """

    __tablename__ = "backorders"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    order_id: UUID = Column(
        PGUUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True
    )
    order_item_id: UUID | None = Column(
        PGUUID(as_uuid=True), nullable=True, index=True,
        comment="Reference to specific order item if applicable"
    )
    product_id: UUID = Column(
        PGUUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    customer_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True
    )

    # Quantities
    quantity_backordered: int = Column(Integer, nullable=False)
    quantity_fulfilled: int = Column(Integer, default=0, nullable=False)

    # Fulfillment Location
    fulfillment_location: str = Column(
        String(50), nullable=False, default="brisbane", index=True
    )  # brisbane, sydney, melbourne

    # Container Allocation
    container_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("containers.id"), nullable=True, index=True,
        comment="Container from which stock will be allocated"
    )

    # ETA Tracking
    expected_availability_date: datetime | None = Column(
        DateTime(timezone=True), nullable=True, index=True,
        comment="Calculated from container ETA or manual estimate"
    )
    original_order_date: datetime = Column(DateTime(timezone=True), nullable=False)

    # Status
    status: BackorderStatus = Column(
        Enum(BackorderStatus, name="backorder_status", values_callable=lambda x: [e.value for e in x]),  # noqa: E501
        nullable=False,
        default=BackorderStatus.PENDING,
        index=True,
    )

    # Customer Communication
    customer_notified: bool = Column(Boolean, default=False, nullable=False)
    last_notification_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    notification_count: int = Column(Integer, default=0, nullable=False)

    # Priority (for allocation when multiple backorders exist)
    priority: int = Column(
        Integer, default=0, nullable=False,
        comment="Higher number = higher priority. Based on order date, customer tier, etc."
    )

    # Notes
    notes: str | None = Column(Text, nullable=True)
    internal_notes: str | None = Column(Text, nullable=True)

    # Metadata
    created_by: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    fulfilled_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    order = relationship("Order", foreign_keys=[order_id])
    product = relationship("Product")
    customer = relationship("Customer", foreign_keys=[customer_id])
    container = relationship("Container", back_populates="backorders")

    def __repr__(self) -> str:
        return f"<Backorder(order={self.order_id}, product={self.product_id}, qty={self.quantity_backordered}, status={self.status})>"  # noqa: E501

    @property
    def quantity_remaining(self) -> int:
        """Calculate quantity still outstanding."""
        return max(0, self.quantity_backordered - self.quantity_fulfilled)

    @property
    def is_overdue(self) -> bool:
        """Check if backorder is overdue."""
        if not self.expected_availability_date or self.status == BackorderStatus.FULFILLED:
            return False
        return datetime.now(UTC) > self.expected_availability_date.replace(tzinfo=UTC)

    @property
    def days_until_available(self) -> int | None:
        """Calculate days until expected availability."""
        if not self.expected_availability_date or self.status == BackorderStatus.FULFILLED:
            return None
        delta = self.expected_availability_date.replace(tzinfo=UTC) - datetime.now(UTC)
        return delta.days

    @property
    def days_outstanding(self) -> int:
        """Calculate days since original order."""
        delta = datetime.now(UTC) - self.original_order_date.replace(tzinfo=UTC)
        return delta.days

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "order_id": str(self.order_id),
            "order_item_id": str(self.order_item_id) if self.order_item_id else None,
            "product_id": str(self.product_id),
            "customer_id": str(self.customer_id) if self.customer_id else None,
            "quantity_backordered": self.quantity_backordered,
            "quantity_fulfilled": self.quantity_fulfilled,
            "quantity_remaining": self.quantity_remaining,
            "fulfillment_location": self.fulfillment_location,
            "container_id": str(self.container_id) if self.container_id else None,
            "expected_availability_date": self.expected_availability_date.isoformat() if self.expected_availability_date else None,  # noqa: E501
            "original_order_date": self.original_order_date.isoformat(),
            "status": self.status.value,
            "customer_notified": self.customer_notified,
            "last_notification_date": self.last_notification_date.isoformat() if self.last_notification_date else None,  # noqa: E501
            "notification_count": self.notification_count,
            "priority": self.priority,
            "is_overdue": self.is_overdue,
            "days_until_available": self.days_until_available,
            "days_outstanding": self.days_outstanding,
            "notes": self.notes,
            "internal_notes": self.internal_notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "fulfilled_at": self.fulfilled_at.isoformat() if self.fulfilled_at else None,
        }
