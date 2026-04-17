"""Add payment_terms_days column to customers table.

Revision ID: 00i_add_payment_terms_days_to_customers
Revises: 00h_add_stripe_fields_to_invoices
Create Date: 2026-04-17

"""

from alembic import op
import sqlalchemy as sa

revision = "00i_add_payment_terms_days_to_customers"
down_revision = "00h_add_stripe_fields_to_invoices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add payment_terms_days to customers table."""
    op.add_column(
        "customers",
        sa.Column("payment_terms_days", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Remove payment_terms_days from customers table."""
    op.drop_column("customers", "payment_terms_days")
