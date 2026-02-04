"""add product sync bidirectional support

Revision ID: 004
Revises: 003
Create Date: 2026-02-02 16:00:00.000000

Adds support for bidirectional product sync (ISS-009):
- Add sync_direction column to shopify_product_mappings table
- Create shopify_product_sync_logs table for audit trail
- Track sync operations in both directions (ERP → Shopify, Shopify → ERP)

Related: ISS-009 (Implement Bidirectional Product Sync)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add bidirectional sync support."""

    # Add sync_direction column to shopify_product_mappings
    op.add_column(
        'shopify_product_mappings',
        sa.Column('sync_direction', sa.String(20), nullable=True)
    )

    # Create shopify_product_sync_logs table
    op.create_table(
        'shopify_product_sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('shopify_product_id', sa.Integer(), nullable=True, index=True),
        sa.Column('sync_direction', sa.String(20), nullable=False, index=True),
        sa.Column('sync_action', sa.String(50), nullable=False),
        sa.Column('sync_status', sa.String(50), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column(
            'synced_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
            index=True
        ),
    )

    # Create indexes for common queries
    op.create_index(
        'idx_sync_logs_product_direction',
        'shopify_product_sync_logs',
        ['product_id', 'sync_direction']
    )

    op.create_index(
        'idx_sync_logs_status_synced_at',
        'shopify_product_sync_logs',
        ['sync_status', 'synced_at']
    )


def downgrade() -> None:
    """Remove bidirectional sync support."""

    # Drop indexes
    op.drop_index('idx_sync_logs_status_synced_at', table_name='shopify_product_sync_logs')
    op.drop_index('idx_sync_logs_product_direction', table_name='shopify_product_sync_logs')

    # Drop table
    op.drop_table('shopify_product_sync_logs')

    # Drop column
    op.drop_column('shopify_product_mappings', 'sync_direction')
