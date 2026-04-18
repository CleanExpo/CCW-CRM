"""Organisation bank / payment details model.

Stores per-organisation bank account details used on tax invoices.
These are deliberately separated from the locked demo_models.py so they
can be evolved without touching the locked schema.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class OrganisationBankDetails(Base):
    """Bank / EFT payment details for an organisation.

    One row per organisation (unique on organization_id).  GET returns
    the row if it exists; PUT upserts it.  All detail fields are nullable
    so the row can exist with partial configuration.
    """

    __tablename__ = "organisation_bank_details"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    # FK string reference avoids importing the locked Organization model.
    organization_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        unique=True,
        index=True,
        nullable=False,
    )

    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bsb: Mapped[str | None] = mapped_column(String(10), nullable=True)
    account_number: Mapped[str | None] = mapped_column(String(30), nullable=True)

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

    def __repr__(self) -> str:
        return (
            f"<OrganisationBankDetails(org={self.organization_id}, "
            f"bsb={self.bsb}, acct={self.account_number})>"
        )
