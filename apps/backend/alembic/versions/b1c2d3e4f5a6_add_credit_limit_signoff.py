"""add_credit_limit_signoff

Revision ID: b1c2d3e4f5a6
Revises: 01766d320d15
Create Date: 2026-04-16 00:00:00.000000

UNI-1829: customer_credit_profiles table (credit limit + hold)
UNI-1836: workshop_bookings sign-off columns
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "01766d320d15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create customer_credit_profiles and extend workshop_bookings (UNI-1829, UNI-1836)."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_credit_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
            credit_limit NUMERIC(12, 2) DEFAULT NULL,
            credit_hold BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_customer_credit_profiles_customer_id
            ON customer_credit_profiles (customer_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_customer_credit_profiles_hold
            ON customer_credit_profiles (credit_hold)
            WHERE credit_hold = TRUE
    """)

    op.execute("""
        ALTER TABLE workshop_bookings
            ADD COLUMN IF NOT EXISTS customer_signed_off BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS sign_off_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS sign_off_method VARCHAR(20) DEFAULT NULL
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_workshop_bookings_pending_signoff
            ON workshop_bookings (status, customer_signed_off)
            WHERE status = 'completed' AND customer_signed_off = FALSE
    """)


def downgrade() -> None:
    """Drop credit limit / sign-off additions."""
    op.execute("DROP INDEX IF EXISTS idx_workshop_bookings_pending_signoff")
    op.execute("ALTER TABLE workshop_bookings DROP COLUMN IF EXISTS sign_off_method")
    op.execute("ALTER TABLE workshop_bookings DROP COLUMN IF EXISTS sign_off_at")
    op.execute("ALTER TABLE workshop_bookings DROP COLUMN IF EXISTS customer_signed_off")
    op.execute("DROP TABLE IF EXISTS customer_credit_profiles")
