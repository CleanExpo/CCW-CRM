"""Add landed-cost fields to purchase_orders and purchase_order_items.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-19

UNI-1832 — enable landed-cost capture at goods-received-note time and
apportioned per-unit cost on line items. Fixes understated COGS for
imported goods where freight + customs duty + handling can be
10-20% of true inventory cost.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # purchase_orders — three landed-cost buckets default to zero so
    # the `total` calculation is unaffected for existing rows.
    op.add_column(
        "purchase_orders",
        sa.Column("freight_cost", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "purchase_orders",
        sa.Column("duty_cost", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "purchase_orders",
        sa.Column("handling_cost", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )

    # purchase_order_items — per-unit apportioned landed cost, nullable
    # until a GRN apportionment runs. Numeric(12, 4) keeps enough precision
    # for small-unit-cost consumables without compounding rounding error.
    op.add_column(
        "purchase_order_items",
        sa.Column("landed_cost_per_unit", sa.Numeric(12, 4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_order_items", "landed_cost_per_unit")
    op.drop_column("purchase_orders", "handling_cost")
    op.drop_column("purchase_orders", "duty_cost")
    op.drop_column("purchase_orders", "freight_cost")
