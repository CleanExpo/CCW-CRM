"""Add Stripe payment_intent_id and payment_link to invoices (UNI-1813, UNI-1818).

Revision ID: 00h_add_stripe_fields_to_invoices
Revises: bb5f3d8c8a16
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa

revision = "00h_add_stripe_fields_to_invoices"
down_revision = "bb5f3d8c8a16"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("stripe_payment_intent_id", sa.String(100), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("stripe_payment_link", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_invoices_stripe_payment_intent_id",
        "invoices",
        ["stripe_payment_intent_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_invoices_stripe_payment_intent_id", table_name="invoices")
    op.drop_column("invoices", "stripe_payment_link")
    op.drop_column("invoices", "stripe_payment_intent_id")
