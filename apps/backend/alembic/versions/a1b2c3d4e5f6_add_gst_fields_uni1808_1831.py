"""Add GST compliance fields: product is_gst_applicable and customer customer_type

UNI-1808: Add is_gst_applicable boolean to products table.
           True (default) → 10% AU GST applies (Xero TaxType = OUTPUT2).
           False → GST-exempt supply (Xero TaxType = EXEMPTOUTPUT).

UNI-1831: Add customer_type VARCHAR(3) to customers table.
           'B2B' (default) → business customer; receives tax invoices and
                              can claim GST input credits.
           'B2C'           → consumer customer; TaxType omitted from Xero
                              line items (consumers do not claim GST credits).

Revision ID: a1b2c3d4e5f6
Revises: 00g_variants_updated_at
Create Date: 2026-04-16
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "00g_variants_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add GST compliance columns."""
    # UNI-1808: GST applicability flag on products.
    # DEFAULT TRUE ensures all existing products remain taxable (no data loss).
    op.add_column(
        "products",
        sa.Column(
            "is_gst_applicable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("TRUE"),
            comment="UNI-1808: True = 10% AU GST (OUTPUT2), False = GST-exempt (EXEMPTOUTPUT)",
        ),
    )

    # UNI-1831: Customer type for B2B / B2C GST handling.
    # DEFAULT 'B2B' ensures all existing customers remain taxable (no data loss).
    op.add_column(
        "customers",
        sa.Column(
            "customer_type",
            sa.String(length=3),
            nullable=False,
            server_default=sa.text("'B2B'"),
            comment="UNI-1831: B2B = tax invoice with GST, B2C = consumer pricing (no TaxType)",
        ),
    )


def downgrade() -> None:
    """Remove GST compliance columns."""
    op.drop_column("customers", "customer_type")
    op.drop_column("products", "is_gst_applicable")
