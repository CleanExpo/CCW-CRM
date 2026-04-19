"""Add approval_thresholds table and merge existing heads.

Revision ID: a1b2c3d4e5f6
Revises: 006_add_product_recommendations_score, 00g_variants_updated_at
Create Date: 2026-04-19

Adds the `approval_thresholds` table that drives threshold-based PO
approval automation (UNI-1874). Also merges the two outstanding migration
heads found by `alembic heads` so the chain is linear again.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = (
    "006_add_product_recommendations_score",
    "00g_variants_updated_at",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "approval_thresholds",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("scope", sa.String(length=100), nullable=False),
        sa.Column("amount_aud", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("scope", name="uq_approval_thresholds_scope"),
    )
    op.create_index(
        "ix_approval_thresholds_scope", "approval_thresholds", ["scope"]
    )


def downgrade() -> None:
    op.drop_index("ix_approval_thresholds_scope", table_name="approval_thresholds")
    op.drop_table("approval_thresholds")
