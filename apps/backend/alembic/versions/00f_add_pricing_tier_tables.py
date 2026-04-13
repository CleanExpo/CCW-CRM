"""Add pricing_tiers and customer_pricing_assignments tables for trade pricing.

Revision ID: 00f_add_pricing_tier_tables
Revises: 00d_add_certification_tables
Create Date: 2026-03-25
"""
from collections.abc import Sequence

from alembic import op

revision: str = "00f_add_pricing_tier_tables"
down_revision: str | Sequence[str] | None = "00d_add_certification_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create pricing_tiers and customer_pricing_assignments tables.
    Seeds default Bronze/Silver/Gold/Platinum tiers.
    """
    op.execute("""
        CREATE TABLE IF NOT EXISTS pricing_tiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) UNIQUE NOT NULL,
            discount_pct NUMERIC(5, 2) NOT NULL,
            min_annual_spend NUMERIC(12, 2),
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_pricing_tiers_name ON pricing_tiers(name)")

    # Seed default CCW tiers
    op.execute("""
        INSERT INTO pricing_tiers (name, discount_pct, min_annual_spend, description)
        VALUES
            ('Bronze',   5.00,   5000.00,  'Entry-level trade account — 5%% off list price'),
            ('Silver',  10.00,  20000.00,  'Established trade account — 10%% off list price'),
            ('Gold',    15.00,  50000.00,  'Premium trade account — 15%% off list price'),
            ('Platinum', 20.00, 100000.00, 'Elite trade account — 20%% off list price')
        ON CONFLICT (name) DO NOTHING
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_pricing_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            tier_id UUID NOT NULL REFERENCES pricing_tiers(id) ON DELETE CASCADE,
            effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_cust_pricing_customer ON customer_pricing_assignments(customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cust_pricing_tier ON customer_pricing_assignments(tier_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS customer_pricing_assignments")
    op.execute("DROP TABLE IF EXISTS pricing_tiers")
