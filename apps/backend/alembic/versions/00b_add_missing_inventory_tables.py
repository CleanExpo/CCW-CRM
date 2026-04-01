"""Add missing inventory tables (barcodes, stock_takes, reorder_rules, attributes, variants)

Revision ID: 00b_add_missing_inventory_tables
Revises: 00a_rename_invoice_date
Create Date: 2026-03-24

These models exist in inventory_models.py but were never included in any Alembic
migration. The existing 7a9c1d2e3f4b_add_inventory_tables only created
product_stock_by_location, stock_transfers, stock_reservations, stock_adjustments.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '00b_add_missing_inventory_tables'
down_revision: Union[str, Sequence[str], None] = '00a_rename_invoice_date'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create missing inventory tables."""

    # 1. product_barcodes — FK → products
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_barcodes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            barcode VARCHAR(100) UNIQUE NOT NULL,
            barcode_type VARCHAR(50) NOT NULL DEFAULT 'EAN13',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode)")

    # 2. stock_takes — no FK deps beyond products
    op.execute("""
        CREATE TABLE IF NOT EXISTS stock_takes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            location VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'draft',
            created_by UUID,
            submitted_by UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            submitted_at TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_takes_location ON stock_takes(location)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_takes_status ON stock_takes(status)")

    # 3. stock_take_items — FK → stock_takes, products
    op.execute("""
        CREATE TABLE IF NOT EXISTS stock_take_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            system_qty INTEGER NOT NULL,
            counted_qty INTEGER NOT NULL,
            variance INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_take_items_take ON stock_take_items(stock_take_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stock_take_items_product ON stock_take_items(product_id)")

    # 4. reorder_rules — FK → products, suppliers (suppliers table may exist)
    op.execute("""
        CREATE TABLE IF NOT EXISTS reorder_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            location VARCHAR(50) NOT NULL,
            supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
            auto_approve_under_qty INTEGER NOT NULL DEFAULT 0,
            lead_time_days INTEGER NOT NULL DEFAULT 7,
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_reorder_rule_product_location UNIQUE (product_id, location)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_reorder_rules_product ON reorder_rules(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_reorder_rules_supplier ON reorder_rules(supplier_id)")

    # 5. product_attributes — FK → products
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_attributes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            key VARCHAR(100) NOT NULL,
            value VARCHAR(500) NOT NULL,
            unit VARCHAR(50),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_attributes_product ON product_attributes(product_id)")

    # 6. product_variants — FK → products
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_variants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            variant_sku VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            attributes JSONB,
            price_override NUMERIC(10, 2),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(variant_sku)")


def downgrade() -> None:
    """Drop missing inventory tables."""
    op.execute("DROP TABLE IF EXISTS product_variants CASCADE")
    op.execute("DROP TABLE IF EXISTS product_attributes CASCADE")
    op.execute("DROP TABLE IF EXISTS reorder_rules CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_take_items CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_takes CASCADE")
    op.execute("DROP TABLE IF EXISTS product_barcodes CASCADE")
