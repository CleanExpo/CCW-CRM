"""add_xero_integration_tables

Revision ID: c5d3e4f9b2a4
Revises: b8c4e2f9a1d3
Create Date: 2026-01-09 17:50:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c5d3e4f9b2a4'
down_revision: str | Sequence[str] | None = 'b8c4e2f9a1d3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - Add Xero integration tables."""

    # Create xero_connections table
    op.create_table(
        'xero_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('tenant_id', sa.String(255), nullable=False),
        sa.Column('tenant_name', sa.String(255), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('scopes', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_synced_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for xero_connections
    op.create_index('ix_xero_connections_tenant_id', 'xero_connections', ['tenant_id'])
    op.create_index('ix_xero_connections_organization_id', 'xero_connections', ['organization_id'])
    op.create_index('ix_xero_connections_is_active', 'xero_connections', ['is_active'])

    # Create payments table
    op.create_table(
        'payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('xero_payment_id', sa.String(255), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=False, server_default='other'),
        sa.Column('reference', sa.String(255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('xero_payment_id')
    )

    # Create indexes for payments
    op.create_index('ix_payments_order_id', 'payments', ['order_id'])
    op.create_index('ix_payments_xero_payment_id', 'payments', ['xero_payment_id'])

    # Add Xero sync columns to orders table
    op.add_column('orders', sa.Column('xero_invoice_id', sa.String(255), nullable=True))
    op.add_column('orders', sa.Column('xero_synced_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('orders', sa.Column('xero_sync_status', sa.String(50), nullable=True))

    # Create indexes for orders Xero columns
    op.create_index('ix_orders_xero_invoice_id', 'orders', ['xero_invoice_id'])
    op.create_index('ix_orders_xero_sync_status', 'orders', ['xero_sync_status'])

    # Add Xero sync columns to customers table
    op.add_column('customers', sa.Column('xero_contact_id', sa.String(255), nullable=True))
    op.add_column('customers', sa.Column('xero_synced_at', sa.TIMESTAMP(timezone=True), nullable=True))

    # Create index for customers Xero column
    op.create_index('ix_customers_xero_contact_id', 'customers', ['xero_contact_id'])


def downgrade() -> None:
    """Downgrade schema - Remove Xero integration tables."""

    # Remove indexes from customers
    op.drop_index('ix_customers_xero_contact_id', table_name='customers')

    # Remove columns from customers
    op.drop_column('customers', 'xero_synced_at')
    op.drop_column('customers', 'xero_contact_id')

    # Remove indexes from orders
    op.drop_index('ix_orders_xero_sync_status', table_name='orders')
    op.drop_index('ix_orders_xero_invoice_id', table_name='orders')

    # Remove columns from orders
    op.drop_column('orders', 'xero_sync_status')
    op.drop_column('orders', 'xero_synced_at')
    op.drop_column('orders', 'xero_invoice_id')

    # Drop payments table
    op.drop_index('ix_payments_xero_payment_id', table_name='payments')
    op.drop_index('ix_payments_order_id', table_name='payments')
    op.drop_table('payments')

    # Drop xero_connections table
    op.drop_index('ix_xero_connections_is_active', table_name='xero_connections')
    op.drop_index('ix_xero_connections_organization_id', table_name='xero_connections')
    op.drop_index('ix_xero_connections_tenant_id', table_name='xero_connections')
    op.drop_table('xero_connections')
