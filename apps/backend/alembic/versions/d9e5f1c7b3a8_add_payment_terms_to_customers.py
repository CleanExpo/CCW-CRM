"""add_payment_terms_to_customers

Revision ID: d9e5f1c7b3a8
Revises: c5d3e4f9b2a4
Create Date: 2026-04-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd9e5f1c7b3a8'
down_revision: Union[str, Sequence[str], None] = 'c5d3e4f9b2a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add payment_terms column to customers table.

    Stores the per-customer AR payment terms (e.g. COD, NET7, NET14, NET30, NET60, EOM).
    This value is synced to the matching Xero contact's Sales PaymentTerms.
    """
    op.add_column(
        'customers',
        sa.Column('payment_terms', sa.String(50), nullable=True),
    )
    op.create_index('ix_customers_payment_terms', 'customers', ['payment_terms'])


def downgrade() -> None:
    """Remove payment_terms column from customers table."""
    op.drop_index('ix_customers_payment_terms', table_name='customers')
    op.drop_column('customers', 'payment_terms')
