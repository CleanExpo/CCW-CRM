"""add shopify extended tables

Revision ID: 005
Revises: 004
Create Date: 2026-02-02 17:00:00.000000

Adds support for Shopify extended features (ISS-010):
- shopify_inventory_syncs - Inventory sync audit trail
- shopify_metafields - Custom metafields tracking
- shopify_theme_endpoints - Theme API endpoint tracking
- shopify_product_translations - Multi-language product sync tracking

Related: ISS-010 (Implement Real-Time Inventory Sync)
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: str | None = '004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add Shopify extended tables."""

    # Create shopify_inventory_syncs table
    op.create_table(
        'shopify_inventory_syncs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('shopify_product_id', sa.String(255), nullable=True, index=True),
        sa.Column('shopify_variant_id', sa.String(255), nullable=True),
        sa.Column('shopify_inventory_item_id', sa.String(255), nullable=True),
        sa.Column('direction', sa.String(20), nullable=False, index=True),  # erp_to_shopify, shopify_to_erp
        sa.Column('sync_type', sa.String(50), nullable=False),  # stock_level, location_move
        sa.Column('old_quantity', sa.Integer(), nullable=True),
        sa.Column('new_quantity', sa.Integer(), nullable=True),
        sa.Column('quantity_delta', sa.Integer(), nullable=True),
        sa.Column('old_location', sa.String(100), nullable=True),
        sa.Column('new_location', sa.String(100), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),  # pending, completed, failed
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('triggered_by', sa.String(100), nullable=True),  # webhook, manual, scheduled
        sa.Column('sync_metadata', postgresql.JSONB(), nullable=True),
        sa.Column(
            'synced_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
            index=True
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    )

    # Create indexes for shopify_inventory_syncs
    op.create_index(
        'idx_inventory_syncs_product_direction',
        'shopify_inventory_syncs',
        ['product_id', 'direction']
    )

    op.create_index(
        'idx_inventory_syncs_status_synced_at',
        'shopify_inventory_syncs',
        ['status', 'synced_at']
    )

    # Create shopify_metafields table
    op.create_table(
        'shopify_metafields',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('shopify_product_id', sa.String(255), nullable=True, index=True),
        sa.Column('shopify_metafield_id', sa.String(255), nullable=True, unique=True, index=True),
        sa.Column('namespace', sa.String(100), nullable=False, server_default='ccw_custom'),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('value_type', sa.String(50), nullable=False, server_default='string'),
        sa.Column('is_synced', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_error', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    )

    # Create shopify_theme_endpoints table
    op.create_table(
        'shopify_theme_endpoints',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('endpoint_path', sa.String(255), nullable=False, unique=True),
        sa.Column('endpoint_type', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('shopify_theme_id', sa.String(255), nullable=True),
        sa.Column('shopify_store_domain', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rate_limit_per_hour', sa.Integer(), nullable=True, server_default='1000'),
        sa.Column('cache_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('cache_ttl_seconds', sa.Integer(), nullable=True, server_default='60'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
    )

    # Create shopify_product_translations table
    op.create_table(
        'shopify_product_translations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('language_code', sa.String(10), nullable=False, index=True),
        sa.Column('shopify_product_id', sa.String(255), nullable=True, index=True),
        sa.Column('shopify_translation_id', sa.String(255), nullable=True, unique=True),
        sa.Column('is_synced', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_error', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    )


def downgrade() -> None:
    """Remove Shopify extended tables."""

    # Drop tables in reverse order
    op.drop_table('shopify_product_translations')
    op.drop_table('shopify_theme_endpoints')
    op.drop_table('shopify_metafields')

    # Drop indexes for shopify_inventory_syncs
    op.drop_index('idx_inventory_syncs_status_synced_at', table_name='shopify_inventory_syncs')
    op.drop_index('idx_inventory_syncs_product_direction', table_name='shopify_inventory_syncs')

    # Drop shopify_inventory_syncs table
    op.drop_table('shopify_inventory_syncs')
