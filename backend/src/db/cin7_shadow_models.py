"""Cin7 Shadow Sync database models.

Models for the Shadow Transition System (Phase A) — tracking gaps between
the CCW ERP and Cin7 by polling Cin7 and comparing against the ERP state.

UNI-1260: Shadow Transition System Phase A
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class Cin7ShadowSync(Base):
    """Shadow sync record tracking an individual Cin7 entity vs ERP state.

    One row per (entity_type, cin7_id) pair.  The poller creates or updates
    these records on every poll run.
    """

    __tablename__ = "cin7_shadow_syncs"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Entity classification
    entity_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
        doc="product | customer | order | quote | supplier | purchase_order",
    )

    # Cin7-side identity
    cin7_id: Mapped[str] = mapped_column(
        String(255),
        index=True,
        doc="Cin7 entity ID (string for cross-API compatibility)",
    )

    # ERP-side identity (null when entity is absent from ERP)
    erp_id: Mapped[str | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Sync status
    sync_status: Mapped[str] = mapped_column(
        String(20),
        default="unknown",
        index=True,
        doc="synced | gap | conflict | unknown",
    )

    # Change detection hashes (MD5/SHA256 of key fields, nullable until first poll)
    cin7_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        doc="Hash of Cin7 record key fields for change detection",
    )
    erp_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        doc="Hash of ERP record key fields for change detection",
    )

    # Polling timestamps
    last_checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        doc="Timestamp of the last poll that touched this record",
    )
    gap_detected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When a gap was first detected for this entity",
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When this shadow sync record was resolved (gap closed)",
    )

    # Row creation
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7ShadowSync("
            f"entity={self.entity_type}/{self.cin7_id}, "
            f"status={self.sync_status}"
            f")>"
        )


class Cin7SyncGap(Base):
    """Detailed gap record linking a shadow sync to a specific data discrepancy.

    Multiple gaps can exist for the same shadow sync record (e.g. a customer
    can have a missing_in_erp gap AND a stale_data gap simultaneously).
    """

    __tablename__ = "cin7_sync_gaps"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Parent shadow sync record
    shadow_sync_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_shadow_syncs.id", ondelete="CASCADE"),
        index=True,
    )

    # Gap classification
    gap_type: Mapped[str] = mapped_column(
        String(30),
        index=True,
        doc="missing_in_erp | missing_in_cin7 | data_mismatch | stale_data",
    )

    # Convenience denormalisations (avoids joins on list queries)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    cin7_id: Mapped[str] = mapped_column(String(255), index=True)
    erp_id: Mapped[str | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
    )

    # Field-level mismatch detail (only set for data_mismatch gap_type)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cin7_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    erp_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Triage
    severity: Mapped[str] = mapped_column(
        String(10),
        default="medium",
        index=True,
        doc="low | medium | high | critical",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="open",
        index=True,
        doc="open | investigating | resolved | ignored",
    )

    # Lifecycle
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Row creation
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7SyncGap("
            f"type={self.gap_type}, "
            f"entity={self.entity_type}/{self.cin7_id}, "
            f"severity={self.severity}, "
            f"status={self.status}"
            f")>"
        )
