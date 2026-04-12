"""Equipment serial number and warranty tracking models.

Tracks individual equipment units by serial number, links them to customers
and orders, and monitors warranty expiry dates for proactive alerting.
"""
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .models_base import Base


class EquipmentUnit(Base):
    """
    Serialized equipment unit sold to a customer.

    Links a product serial number to a specific customer and order,
    enabling warranty tracking and service history.
    """

    __tablename__ = "equipment_units"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    serial_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    product_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    order_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    purchase_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    warranty_expiry: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    warranty_months: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    warranty_alerts: Mapped[list["WarrantyAlert"]] = relationship(
        "WarrantyAlert", back_populates="unit", cascade="all, delete-orphan"
    )


class WarrantyAlert(Base):
    """
    Warranty expiry alert for a serialized equipment unit.

    Generated automatically when warranty_expiry falls within
    30, 60, or 90 days from today.
    """

    __tablename__ = "warranty_alerts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    unit_id: Mapped[UUID] = mapped_column(
        ForeignKey("equipment_units.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    alert_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # expiring_30, expiring_60, expiring_90, expired
    alert_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    unit: Mapped["EquipmentUnit"] = relationship(
        "EquipmentUnit", back_populates="warranty_alerts"
    )
