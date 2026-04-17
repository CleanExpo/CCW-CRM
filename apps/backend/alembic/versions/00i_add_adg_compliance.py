"""Add ADG Code compliance schema (merge 00g + 00h heads).

Merges the two parallel migration heads (00g_variants_updated_at and
00h_add_stripe_fields_to_invoices) and adds Australian Dangerous Goods
Code compliance tables/columns required by the new DG API endpoints.

Schema changes:
  1. product_dangerous_goods — new side-table for DG classification
  2. outbound_shipments.adg_declaration_url — URL to the ADG declaration PDF

Without this migration the DG API endpoints in products.py and the ADG
validation in shipments.py fail at runtime with a ProgrammingError because
the underlying database objects do not exist.

Revision ID: 00i_add_adg_compliance
Revises: 00g_variants_updated_at, 00h_add_stripe_fields_to_invoices
Create Date: 2026-04-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "00i_add_adg_compliance"
down_revision: Union[str, Sequence[str], None] = (
    "00g_variants_updated_at",
    "00h_add_stripe_fields_to_invoices",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create product_dangerous_goods table and add adg_declaration_url column."""

    # 1. product_dangerous_goods — side-table (one row per product)
    #    Presence of a row means the product IS a dangerous good.
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_dangerous_goods (
            id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id    UUID          NOT NULL
                              REFERENCES products(id) ON DELETE CASCADE,
            adg_class     VARCHAR(50)   NOT NULL,
            un_number     VARCHAR(20)   NOT NULL,
            proper_shipping_name VARCHAR(255) NOT NULL,
            packing_group VARCHAR(10),
            created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_product_dangerous_goods_product UNIQUE (product_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_dangerous_goods_product"
        " ON product_dangerous_goods(product_id)"
    )

    # 2. Add adg_declaration_url to outbound_shipments
    #    Column is nullable — only required when the order contains DG products.
    op.execute("""
        ALTER TABLE outbound_shipments
            ADD COLUMN IF NOT EXISTS adg_declaration_url VARCHAR(1000)
    """)


def downgrade() -> None:
    """Remove product_dangerous_goods table and adg_declaration_url column."""
    op.execute(
        "ALTER TABLE outbound_shipments"
        " DROP COLUMN IF EXISTS adg_declaration_url"
    )
    op.execute("DROP TABLE IF EXISTS product_dangerous_goods CASCADE")
