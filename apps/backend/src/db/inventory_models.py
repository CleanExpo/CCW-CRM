"""Multi-store inventory models.

Database models for tracking stock across multiple locations.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    UniqueConstraint,
    CheckConstraint,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship

from .models import Base


class StoreLocation(str, Enum):
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
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
        nullable=False,
    )

    @property
    def available(self) -> int:
        """Calculate available stock (stock - reserved)."""
        return max(0, self.stock - self.reserved)

    def __repr__(self) -> str:
        return f"<ProductStockByLocation(product_id={self.product_id}, location={self.location}, stock={self.stock})>"


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
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<StockTransfer(product_id={self.product_id}, {self.from_location}→{self.to_location}, qty={self.quantity})>"


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
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )
    fulfilled_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    cancelled_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(),
        onupdate=lambda: datetime.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<StockReservation(product_id={self.product_id}, order_id={self.order_id}, qty={self.quantity})>"


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
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<StockAdjustment(product_id={self.product_id}, location={self.location}, change={self.quantity_change})>"
