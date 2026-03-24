"""IICRC and industry certification tracking models.

Tracks cleaning industry certifications (IICRC, ISSA, ARCR) held by
customer technicians, enabling CCW to verify qualified buyers and
generate expiry alerts before certifications lapse.
"""
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .models_base import Base

# Common IICRC certification types for reference
IICRC_CERT_TYPES = [
    "WRT",   # Water Damage Restoration Technician
    "FSRT",  # Fire and Smoke Restoration Technician
    "ASD",   # Applied Structural Drying
    "CCT",   # Carpet Cleaning Technician
    "CMT",   # Commercial Carpet Maintenance Technician
    "OCT",   # Odour Control Technician
    "UFT",   # Upholstery and Fabric Cleaning Technician
    "MRS",   # Mould Remediation Specialist
    "RRT",   # Rug Restoration Technician
    "HST",   # Health and Safety Technician
]

CERT_BODIES = ["IICRC", "ISSA", "ARCR"]


class TechnicianCertification(Base):
    """
    Industry certification held by a customer's technician.

    Links a certification number, type and expiry to a customer record.
    One customer may have multiple certifications across different types.
    """

    __tablename__ = "technician_certifications"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Certification body: IICRC, ISSA, ARCR
    cert_body: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # Specific cert type: WRT, FSRT, CCT, etc.
    cert_type: Mapped[str] = mapped_column(String(100), nullable=False)
    cert_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    technician_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expiry_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    # Status: active, expired, pending_renewal, suspended
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    alerts: Mapped[list["CertificationAlert"]] = relationship(
        "CertificationAlert", back_populates="certification", cascade="all, delete-orphan"
    )


class CertificationAlert(Base):
    """
    Expiry alert for a technician certification.

    Generated when expiry_date is within 30, 60 or 90 days.
    """

    __tablename__ = "certification_alerts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    cert_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_certifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    days_until_expiry: Mapped[int] = mapped_column(Integer, nullable=False)
    notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    certification: Mapped["TechnicianCertification"] = relationship(
        "TechnicianCertification", back_populates="alerts"
    )
