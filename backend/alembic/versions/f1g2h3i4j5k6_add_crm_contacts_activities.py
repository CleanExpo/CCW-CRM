"""add_crm_contacts_activities

Revision ID: f1g2h3i4j5k6
Revises: 005
Create Date: 2026-02-06

Adds tables for CRM module (UNI-171):
- contacts: Contact management with multiple contacts per customer
- activities: General-purpose activity/interaction tracking
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1g2h3i4j5k6"
down_revision: str | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create contacts and activities tables for CRM."""

    # Create contacts table
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("mobile", sa.String(length=30), nullable=True),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, default=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes for contacts
    op.create_index("ix_contacts_customer_id", "contacts", ["customer_id"])
    op.create_index("ix_contacts_email", "contacts", ["email"])
    op.create_index("ix_contacts_customer_primary", "contacts", ["customer_id", "is_primary"])
    op.create_index("ix_contacts_name", "contacts", ["first_name", "last_name"])

    # Create activities table
    op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("activity_type", sa.String(length=20), nullable=False, default="note"),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "quote_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quotes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Create indexes for activities
    op.create_index("ix_activities_activity_type", "activities", ["activity_type"])
    op.create_index("ix_activities_customer_id", "activities", ["customer_id"])
    op.create_index("ix_activities_contact_id", "activities", ["contact_id"])
    op.create_index("ix_activities_order_id", "activities", ["order_id"])
    op.create_index("ix_activities_quote_id", "activities", ["quote_id"])
    op.create_index("ix_activities_created_at", "activities", ["created_at"])
    op.create_index("ix_activities_customer_created", "activities", ["customer_id", "created_at"])
    op.create_index("ix_activities_type_created", "activities", ["activity_type", "created_at"])


def downgrade() -> None:
    """Drop contacts and activities tables."""

    # Drop activities indexes and table
    op.drop_index("ix_activities_type_created", table_name="activities")
    op.drop_index("ix_activities_customer_created", table_name="activities")
    op.drop_index("ix_activities_created_at", table_name="activities")
    op.drop_index("ix_activities_quote_id", table_name="activities")
    op.drop_index("ix_activities_order_id", table_name="activities")
    op.drop_index("ix_activities_contact_id", table_name="activities")
    op.drop_index("ix_activities_customer_id", table_name="activities")
    op.drop_index("ix_activities_activity_type", table_name="activities")
    op.drop_table("activities")

    # Drop contacts indexes and table
    op.drop_index("ix_contacts_name", table_name="contacts")
    op.drop_index("ix_contacts_customer_primary", table_name="contacts")
    op.drop_index("ix_contacts_email", table_name="contacts")
    op.drop_index("ix_contacts_customer_id", table_name="contacts")
    op.drop_table("contacts")
