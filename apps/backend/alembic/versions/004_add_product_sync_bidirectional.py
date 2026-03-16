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

    # Create shopify_product_mappings table if it doesn't exist
    # This table was missing from earlier migrations
    op.execute("""
        CREATE TABLE IF NOT EXISTS shopify_product_mappings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL,
            shopify_product_id INTEGER NOT NULL,
            shopify_variant_id INTEGER,
            sku VARCHAR(255),
            sync_status VARCHAR(50) DEFAULT 'pending',
            last_synced_at TIMESTAMP WITH TIME ZONE,
            shopify_data JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_shopify_product_mappings_product_id ON shopify_product_mappings(product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_shopify_product_mappings_shopify_product_id ON shopify_product_mappings(shopify_product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_shopify_product_mappings_shopify_variant_id ON shopify_product_mappings(shopify_variant_id)")

    # Add sync_direction column to shopify_product_mappings (if not exists)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'shopify_product_mappings'
                AND column_name = 'sync_direction'
            ) THEN
                ALTER TABLE shopify_product_mappings ADD COLUMN sync_direction VARCHAR(20);
            END IF;
        END $$;
    """)

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
