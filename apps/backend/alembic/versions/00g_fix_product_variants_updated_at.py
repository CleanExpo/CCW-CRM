"""Add missing updated_at column to product_variants table.

The 00b migration created product_variants without an updated_at column,
but the ProductVariant SQLAlchemy model declares one. This migration adds
the missing column so ORM operations don't fail with a database error.

Revision ID: 00g_fix_product_variants_updated_at
Revises: 00f_add_pricing_tier_tables
Create Date: 2026-03-25
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "00g_fix_product_variants_updated_at"
down_revision: str | None = "00f_add_pricing_tier_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add updated_at to product_variants."""
    op.execute("""
        ALTER TABLE product_variants
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    """)


def downgrade() -> None:
    """Remove updated_at from product_variants."""
    op.execute("ALTER TABLE product_variants DROP COLUMN IF EXISTS updated_at")
