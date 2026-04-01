"""Add container tracking and backorders

Revision ID: d4f7a9b2e5c1
Revises: f25b3ce9e866
Create Date: 2026-01-14 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4f7a9b2e5c1'
down_revision: Union[str, Sequence[str], None] = 'f25b3ce9e866'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enums using raw SQL with IF NOT EXISTS to avoid duplicates
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE container_status AS ENUM (
                'booked', 'in_transit', 'at_port', 'customs_clearance',
                'cleared', 'out_for_delivery', 'delivered', 'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE backorder_status AS ENUM (
                'pending', 'allocated', 'ready', 'fulfilled', 'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create containers table
    op.create_table('containers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('container_number', sa.String(length=50), nullable=False),
        sa.Column('purchase_order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('vessel_name', sa.String(length=255), nullable=True),
        sa.Column('voyage_number', sa.String(length=100), nullable=True),
        sa.Column('origin_port', sa.String(length=100), nullable=True),
        sa.Column('destination_port', sa.String(length=100), nullable=True),
        sa.Column('destination_warehouse', sa.String(length=50), nullable=False, server_default='brisbane'),
        sa.Column('booking_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('departure_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('estimated_arrival_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_arrival_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('customs_clearance_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.Enum('booked', 'in_transit', 'at_port', 'customs_clearance', 'cleared', 'out_for_delivery', 'delivered', 'cancelled', name='container_status', create_type=False, native_enum=False), nullable=False, server_default='booked'),
        sa.Column('tracking_number', sa.String(length=100), nullable=True),
        sa.Column('carrier', sa.String(length=100), nullable=True),
        sa.Column('tracking_url', sa.String(length=500), nullable=True),
        sa.Column('tracking_events', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('shipping_cost', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('customs_duty', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('other_charges', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id']),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_containers_container_number'), 'containers', ['container_number'], unique=True)
    op.create_index(op.f('ix_containers_purchase_order_id'), 'containers', ['purchase_order_id'], unique=False)
    op.create_index(op.f('ix_containers_supplier_id'), 'containers', ['supplier_id'], unique=False)
    op.create_index(op.f('ix_containers_destination_warehouse'), 'containers', ['destination_warehouse'], unique=False)
    op.create_index(op.f('ix_containers_estimated_arrival_date'), 'containers', ['estimated_arrival_date'], unique=False)
    op.create_index(op.f('ix_containers_status'), 'containers', ['status'], unique=False)

    # Create container_items table
    op.create_table('container_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('container_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_ordered', sa.Integer(), nullable=False),
        sa.Column('quantity_received', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quantity_damaged', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quantity_preallocated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unit_cost', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('quality_checked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quality_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['container_id'], ['containers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_container_items_container_id'), 'container_items', ['container_id'], unique=False)
    op.create_index(op.f('ix_container_items_product_id'), 'container_items', ['product_id'], unique=False)

    # Create backorders table
    op.create_table('backorders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_item_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('quantity_backordered', sa.Integer(), nullable=False),
        sa.Column('quantity_fulfilled', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fulfillment_location', sa.String(length=50), nullable=False, server_default='brisbane'),
        sa.Column('container_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expected_availability_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('original_order_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.Enum('pending', 'allocated', 'ready', 'fulfilled', 'cancelled', name='backorder_status', create_type=False, native_enum=False), nullable=False, server_default='pending'),
        sa.Column('customer_notified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_notification_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notification_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fulfilled_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['container_id'], ['containers.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_backorders_order_id'), 'backorders', ['order_id'], unique=False)
    op.create_index(op.f('ix_backorders_order_item_id'), 'backorders', ['order_item_id'], unique=False)
    op.create_index(op.f('ix_backorders_product_id'), 'backorders', ['product_id'], unique=False)
    op.create_index(op.f('ix_backorders_customer_id'), 'backorders', ['customer_id'], unique=False)
    op.create_index(op.f('ix_backorders_container_id'), 'backorders', ['container_id'], unique=False)
    op.create_index(op.f('ix_backorders_fulfillment_location'), 'backorders', ['fulfillment_location'], unique=False)
    op.create_index(op.f('ix_backorders_expected_availability_date'), 'backorders', ['expected_availability_date'], unique=False)
    op.create_index(op.f('ix_backorders_status'), 'backorders', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop backorders table
    op.drop_index(op.f('ix_backorders_status'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_expected_availability_date'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_fulfillment_location'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_container_id'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_customer_id'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_product_id'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_order_item_id'), table_name='backorders')
    op.drop_index(op.f('ix_backorders_order_id'), table_name='backorders')
    op.drop_table('backorders')

    # Drop container_items table
    op.drop_index(op.f('ix_container_items_product_id'), table_name='container_items')
    op.drop_index(op.f('ix_container_items_container_id'), table_name='container_items')
    op.drop_table('container_items')

    # Drop containers table
    op.drop_index(op.f('ix_containers_status'), table_name='containers')
    op.drop_index(op.f('ix_containers_estimated_arrival_date'), table_name='containers')
    op.drop_index(op.f('ix_containers_destination_warehouse'), table_name='containers')
    op.drop_index(op.f('ix_containers_supplier_id'), table_name='containers')
    op.drop_index(op.f('ix_containers_purchase_order_id'), table_name='containers')
    op.drop_index(op.f('ix_containers_container_number'), table_name='containers')
    op.drop_table('containers')

    # Drop enums
    backorder_status_enum = postgresql.ENUM('pending', 'allocated', 'ready', 'fulfilled', 'cancelled', name='backorder_status')
    backorder_status_enum.drop(op.get_bind(), checkfirst=True)

    container_status_enum = postgresql.ENUM('booked', 'in_transit', 'at_port', 'customs_clearance', 'cleared', 'out_for_delivery', 'delivered', 'cancelled', name='container_status')
    container_status_enum.drop(op.get_bind(), checkfirst=True)
