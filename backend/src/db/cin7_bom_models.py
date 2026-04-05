"""Cin7 BOM (Bill of Materials) and Production Run database models.

Separate from cin7_models.py to avoid parallel write conflicts.
Supports BOM masters, BOM components, and production run tracking.
"""

import enum
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .models_base import Base


class BomStatus(str, enum.Enum):
    """Status of a Bill of Materials master record."""

    ACTIVE = "active"
    DRAFT = "draft"
    ARCHIVED = "archived"


class ProductionRunStatus(str, enum.Enum):
    """Status of a production run."""

    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Cin7BomMaster(Base):
    """Bill of Materials master record.

    Represents a Cin7 BOM definition — the finished good and its recipe.
    Supports both Cin7 BOM v1 (BomMasters) and v2 (FinishedGoods) shapes.
    """

    __tablename__ = "cin7_bom_masters"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Cin7 identifier
    cin7_bom_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    # BOM metadata
    name: Mapped[str] = mapped_column(String(255))
    sku: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[str] = mapped_column(String(20), default="1")
    status: Mapped[str] = mapped_column(String(20), default=BomStatus.ACTIVE.value)

    # Finished good details
    finished_good_sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    finished_good_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Production output
    quantity_produced: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=1)
    uom: Mapped[str] = mapped_column(String(50), default="EA")

    # Optional notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    components: Mapped[list["Cin7BomComponent"]] = relationship(
        "Cin7BomComponent",
        back_populates="bom_master",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    production_runs: Mapped[list["Cin7ProductionRun"]] = relationship(
        "Cin7ProductionRun",
        back_populates="bom_master",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Cin7BomMaster(cin7_id={self.cin7_bom_id}, name={self.name}, status={self.status})>"


class Cin7BomComponent(Base):
    """A single component (ingredient/raw material) within a BOM.

    Each row is one line in the Cin7 BOM component list.
    """

    __tablename__ = "cin7_bom_components"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    bom_master_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_bom_masters.id", ondelete="CASCADE"),
        index=True,
    )

    # Component product details
    component_sku: Mapped[str] = mapped_column(String(100), index=True)
    component_name: Mapped[str] = mapped_column(String(255))

    # Quantity and unit of measure
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    uom: Mapped[str] = mapped_column(String(50), default="EA")

    # Wastage allowance (e.g. 5.00 = 5% waste)
    wastage_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)

    # Optional notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    bom_master: Mapped["Cin7BomMaster"] = relationship(
        "Cin7BomMaster", back_populates="components"
    )

    def __repr__(self) -> str:
        return f"<Cin7BomComponent(bom={self.bom_master_id}, sku={self.component_sku}, qty={self.quantity})>"


class Cin7ProductionRun(Base):
    """A production run executed against a BOM master.

    Tracks planned vs completed quantities and workflow status.
    """

    __tablename__ = "cin7_production_runs"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    bom_master_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_bom_masters.id", ondelete="RESTRICT"),
        index=True,
    )

    # Optional link to Cin7 production order
    cin7_production_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Quantities
    quantity_planned: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    quantity_completed: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=0)

    # Status workflow: planned -> in_progress -> completed | cancelled
    status: Mapped[str] = mapped_column(
        String(20), default=ProductionRunStatus.PLANNED.value
    )

    # Schedule
    planned_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    completed_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)

    # Location where production takes place
    location_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cin7 sync flag
    cin7_synced: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    bom_master: Mapped["Cin7BomMaster"] = relationship(
        "Cin7BomMaster", back_populates="production_runs"
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7ProductionRun(bom={self.bom_master_id}, "
            f"planned={self.quantity_planned}, status={self.status})>"
        )
