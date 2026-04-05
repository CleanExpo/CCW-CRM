"""Shadow Session database models.

Tracks the state of a 1-month shadow/observation period where the ERP runs
parallel to the client's existing system (Cin7 + Xero), syncing nightly and
observing workflows for transition readiness analysis.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class ShadowSession(Base):
    """One row per shadow observation period.

    Created when the client activates shadow mode.  Updated nightly as cron
    jobs sync data and update the running readiness score.
    """

    __tablename__ = "shadow_sessions"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Client identification
    client_name: Mapped[str] = mapped_column(
        String(255),
        default="CCW Client",
        doc="Name of the client in shadow observation",
    )

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        index=True,
        doc="active | paused | complete | cancelled",
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        doc="When shadow mode was activated",
    )

    target_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Planned end date (default: start_date + 30 days)",
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When shadow mode ended",
    )

    # Readiness tracking
    readiness_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Current transition readiness score (0-100)",
    )

    # Sync statistics (updated by nightly cron)
    total_syncs_run: Mapped[int] = mapped_column(
        Integer,
        default=0,
        doc="Total nightly sync runs completed",
    )

    successful_syncs: Mapped[int] = mapped_column(
        Integer,
        default=0,
        doc="Sync runs with zero errors",
    )

    products_observed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        doc="Number of Cin7 product records observed",
    )

    orders_observed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        doc="Number of Cin7 order records observed",
    )

    customers_observed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        doc="Number of Cin7 customer records observed",
    )

    invoices_observed: Mapped[int] = mapped_column(
        Integer,
        default=0,
        doc="Number of Xero invoice records observed",
    )

    # Freeform notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Row timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<ShadowSession("
            f"client={self.client_name}, "
            f"status={self.status}, "
            f"score={self.readiness_score}"
            f")>"
        )
