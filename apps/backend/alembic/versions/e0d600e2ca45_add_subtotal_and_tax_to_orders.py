"""add_subtotal_and_tax_to_orders

Revision ID: e0d600e2ca45
Revises: e6f8a2b3c7d9
Create Date: 2026-01-16 03:48:42.034970

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e0d600e2ca45'
down_revision: str | Sequence[str] | None = 'e6f8a2b3c7d9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add subtotal and tax columns to orders table."""
    # Add subtotal column
    op.add_column('orders', sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))

    # Add tax column
    op.add_column('orders', sa.Column('tax', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'))


def downgrade() -> None:
    """Remove subtotal and tax columns from orders table."""
    op.drop_column('orders', 'tax')
    op.drop_column('orders', 'subtotal')
