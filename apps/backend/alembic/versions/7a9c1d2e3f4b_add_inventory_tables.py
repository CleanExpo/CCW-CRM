"""add_inventory_tables

Revision ID: 7a9c1d2e3f4b
Revises: 4b2f1c8d9a01
Create Date: 2026-01-17 07:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "7a9c1d2e3f4b"
down_revision: Union[str, Sequence[str], None] = "4b2f1c8d9a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add multi-store inventory tables if missing."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "product_stock_by_location" not in existing_tables:
        op.create_table(
            "product_stock_by_location",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "product_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("products.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("location", sa.String(length=50), nullable=False),
            sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reserved", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("last_counted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_counted_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("reorder_point", sa.Integer(), nullable=True),
            sa.Column("reorder_quantity", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.UniqueConstraint("product_id", "location", name="uq_product_location"),
            sa.CheckConstraint("stock >= 0", name="ck_stock_non_negative"),
            sa.CheckConstraint("reserved >= 0", name="ck_reserved_non_negative"),
        )
        op.create_index(
            "ix_product_stock_by_location_product_id",
            "product_stock_by_location",
            ["product_id"],
        )
        op.create_index(
            "ix_product_stock_by_location_location",
            "product_stock_by_location",
            ["location"],
        )

    if "stock_transfers" not in existing_tables:
        op.create_table(
            "stock_transfers",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "product_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("products.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("from_location", sa.String(length=50), nullable=False),
            sa.Column("to_location", sa.String(length=50), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("reason", sa.String(length=500), nullable=True),
            sa.Column("notes", sa.String(length=1000), nullable=True),
            sa.Column("initiated_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("completed_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column(
                "initiated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index(
            "ix_stock_transfers_product_id",
            "stock_transfers",
            ["product_id"],
        )
        op.create_index(
            "ix_stock_transfers_from_location",
            "stock_transfers",
            ["from_location"],
        )
        op.create_index(
            "ix_stock_transfers_to_location",
            "stock_transfers",
            ["to_location"],
        )

    if "stock_reservations" not in existing_tables:
        op.create_table(
            "stock_reservations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "product_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("products.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "order_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("orders.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("location", sa.String(length=50), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "reserved_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index(
            "ix_stock_reservations_product_id",
            "stock_reservations",
            ["product_id"],
        )
        op.create_index(
            "ix_stock_reservations_order_id",
            "stock_reservations",
            ["order_id"],
        )
        op.create_index(
            "ix_stock_reservations_location",
            "stock_reservations",
            ["location"],
        )

    if "stock_adjustments" not in existing_tables:
        op.create_table(
            "stock_adjustments",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "product_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("products.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("location", sa.String(length=50), nullable=False),
            sa.Column("quantity_change", sa.Integer(), nullable=False),
            sa.Column("previous_quantity", sa.Integer(), nullable=False),
            sa.Column("new_quantity", sa.Integer(), nullable=False),
            sa.Column("adjustment_type", sa.String(length=50), nullable=False),
            sa.Column("reason", sa.String(length=500), nullable=True),
            sa.Column("reference_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("adjusted_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column(
                "adjusted_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index(
            "ix_stock_adjustments_product_id",
            "stock_adjustments",
            ["product_id"],
        )
        op.create_index(
            "ix_stock_adjustments_location",
            "stock_adjustments",
            ["location"],
        )


def downgrade() -> None:
    """Drop multi-store inventory tables if they exist."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "stock_adjustments" in existing_tables:
        op.drop_index("ix_stock_adjustments_location", table_name="stock_adjustments")
        op.drop_index("ix_stock_adjustments_product_id", table_name="stock_adjustments")
        op.drop_table("stock_adjustments")

    if "stock_reservations" in existing_tables:
        op.drop_index("ix_stock_reservations_location", table_name="stock_reservations")
        op.drop_index("ix_stock_reservations_order_id", table_name="stock_reservations")
        op.drop_index("ix_stock_reservations_product_id", table_name="stock_reservations")
        op.drop_table("stock_reservations")

    if "stock_transfers" in existing_tables:
        op.drop_index("ix_stock_transfers_to_location", table_name="stock_transfers")
        op.drop_index("ix_stock_transfers_from_location", table_name="stock_transfers")
        op.drop_index("ix_stock_transfers_product_id", table_name="stock_transfers")
        op.drop_table("stock_transfers")

    if "product_stock_by_location" in existing_tables:
        op.drop_index(
            "ix_product_stock_by_location_location",
            table_name="product_stock_by_location",
        )
        op.drop_index(
            "ix_product_stock_by_location_product_id",
            table_name="product_stock_by_location",
        )
        op.drop_table("product_stock_by_location")
