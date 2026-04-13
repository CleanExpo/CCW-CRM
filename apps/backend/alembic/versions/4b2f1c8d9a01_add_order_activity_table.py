"""add_order_activity_table

Revision ID: 4b2f1c8d9a01
Revises: 28a0fb9f5a0a
Create Date: 2026-01-16 10:12:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4b2f1c8d9a01"
down_revision: str | Sequence[str] | None = "28a0fb9f5a0a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add order activity audit table."""
    op.create_table(
        "order_activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("meta_data", postgresql.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_order_activity_order_id", "order_activity", ["order_id"])
    op.create_index("ix_order_activity_event_type", "order_activity", ["event_type"])
    op.create_index("ix_order_activity_created_at", "order_activity", ["created_at"])


def downgrade() -> None:
    """Drop order activity audit table."""
    op.drop_index("ix_order_activity_created_at", table_name="order_activity")
    op.drop_index("ix_order_activity_event_type", table_name="order_activity")
    op.drop_index("ix_order_activity_order_id", table_name="order_activity")
    op.drop_table("order_activity")
