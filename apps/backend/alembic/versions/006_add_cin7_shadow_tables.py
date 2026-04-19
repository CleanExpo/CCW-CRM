"""Add cin7_shadow_syncs and cin7_sync_gaps tables.

Revision ID: 006_add_cin7_shadow_tables
Revises: 005_add_shopify_extended_tables
Create Date: 2026-04-20

UNI-1260: Shadow Transition System — tracks gaps between Cin7 and ERP.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "006_add_cin7_shadow_tables"
down_revision = "005_add_shopify_extended_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cin7_shadow_syncs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False, index=True),
        sa.Column("cin7_id", sa.String(255), nullable=False, index=True),
        sa.Column("erp_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("sync_status", sa.String(20), nullable=False, default="unknown", index=True),
        sa.Column("cin7_hash", sa.String(64), nullable=True),
        sa.Column("erp_hash", sa.String(64), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("gap_detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_type", "cin7_id", name="uq_cin7_shadow_entity_cin7id"),
    )

    op.create_table(
        "cin7_sync_gaps",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shadow_sync_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cin7_shadow_syncs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("gap_type", sa.String(30), nullable=False, index=True),
        sa.Column("entity_type", sa.String(50), nullable=False, index=True),
        sa.Column("cin7_id", sa.String(255), nullable=False, index=True),
        sa.Column("erp_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("cin7_value", sa.Text, nullable=True),
        sa.Column("erp_value", sa.Text, nullable=True),
        sa.Column("severity", sa.String(10), nullable=False, default="medium", index=True),
        sa.Column("status", sa.String(20), nullable=False, default="open", index=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("cin7_sync_gaps")
    op.drop_table("cin7_shadow_syncs")
