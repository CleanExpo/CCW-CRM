"""add_payment_terms_days

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-16 00:00:00.000000

UNI-1821: Per-customer payment terms (days) for invoice due_date and Xero sync
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add payment_terms_days column to customers (UNI-1821)."""
    op.execute("""
        ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30
    """)


def downgrade() -> None:
    """Remove payment_terms_days column from customers."""
    op.execute("ALTER TABLE customers DROP COLUMN IF EXISTS payment_terms_days")
