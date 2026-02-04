"""add missing trigram indexes

Revision ID: 003_add_missing_trigram_indexes
Revises: 002
Create Date: 2026-02-02 14:55:00.000000

This migration completes ISS-006 by adding the remaining trigram indexes
that were missing from the initial performance indexes migration:
- products.sku (for fast SKU search)
- customers.contact_name (for fast contact name search)
- customers.email (trigram version for wildcard email search)

Expected Performance Impact:
- SKU search: Sub-second response for ILIKE queries
- Contact name search: 3500ms → <1000ms (as per ISS-006 requirements)
- Email search: Improved wildcard search performance

Related: ISS-006 (Add PostgreSQL Trigram Indexes)
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing trigram indexes for ISS-006."""

    # Ensure pg_trgm extension is enabled (idempotent)
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    # Products: SKU trigram index for fast wildcard search
    # Example: SELECT * FROM products WHERE sku ILIKE '%ABC%'
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_products_sku_trgm '
        'ON products USING gin(sku gin_trgm_ops)'
    )

    # Customers: Contact name trigram index
    # Example: SELECT * FROM customers WHERE contact_name ILIKE '%John%'
    # This is one of the primary search fields mentioned in ISS-006
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_customers_contact_name_trgm '
        'ON customers USING gin(contact_name gin_trgm_ops)'
    )

    # Customers: Email trigram index for wildcard email search
    # Example: SELECT * FROM customers WHERE email ILIKE '%@company.com%'
    # Complements the existing B-tree index for exact email lookups
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_customers_email_trgm '
        'ON customers USING gin(email gin_trgm_ops)'
    )


def downgrade() -> None:
    """Remove trigram indexes."""

    op.execute('DROP INDEX IF EXISTS idx_customers_email_trgm')
    op.execute('DROP INDEX IF EXISTS idx_customers_contact_name_trgm')
    op.execute('DROP INDEX IF EXISTS idx_products_sku_trgm')
