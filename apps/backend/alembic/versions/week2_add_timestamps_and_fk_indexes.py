"""Week 2: Add missing timestamps and FK indexes

Revision ID: w2_timestamps_fk_idx
Revises: bb5f3d8c8a16
Create Date: 2026-02-11

Changes:
1. Add updated_at columns to order_items, quote_items, submission_notes
2. Add 23 missing foreign key indexes for performance

Expected Impact:
- Schema health: +7-8 points
- Query performance: 20-50% improvement on JOINs
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'w2_timestamps_fk_idx'
down_revision = 'bb5f3d8c8a16'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add missing timestamps and FK indexes."""

    # =========================================================================
    # PART 1: Add missing updated_at columns
    # =========================================================================

    # Add updated_at to order_items
    op.add_column('order_items',
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False)
    )

    # Add updated_at to quote_items
    op.add_column('quote_items',
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False)
    )

    # Add updated_at to submission_notes
    op.add_column('submission_notes',
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False)
    )

    # Create triggers to auto-update timestamps
    op.execute("""
        CREATE OR REPLACE FUNCTION update_order_items_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS order_items_updated_at_trigger ON order_items;
        CREATE TRIGGER order_items_updated_at_trigger
            BEFORE UPDATE ON order_items
            FOR EACH ROW
            EXECUTE FUNCTION update_order_items_updated_at();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION update_quote_items_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS quote_items_updated_at_trigger ON quote_items;
        CREATE TRIGGER quote_items_updated_at_trigger
            BEFORE UPDATE ON quote_items
            FOR EACH ROW
            EXECUTE FUNCTION update_quote_items_updated_at();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION update_submission_notes_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS submission_notes_updated_at_trigger ON submission_notes;
        CREATE TRIGGER submission_notes_updated_at_trigger
            BEFORE UPDATE ON submission_notes
            FOR EACH ROW
            EXECUTE FUNCTION update_submission_notes_updated_at();
    """)

    # =========================================================================
    # PART 2: Add missing foreign key indexes (23 indexes)
    # =========================================================================

    # Organization references (7 indexes) - MEDIUM priority
    op.create_index('idx_users_organization_id', 'users', ['organization_id'])
    op.create_index('idx_products_organization_id', 'products', ['organization_id'])
    op.create_index('idx_customers_organization_id', 'customers', ['organization_id'])
    op.create_index('idx_orders_organization_id', 'orders', ['organization_id'])
    op.create_index('idx_quotes_organization_id', 'quotes', ['organization_id'])
    op.create_index('idx_ap2_connections_organization_id', 'ap2_connections', ['organization_id'])

    # User references (11 indexes) - MEDIUM/LOW priority
    op.create_index('idx_contractors_user_id', 'contractors', ['user_id'])
    op.create_index('idx_documents_user_id', 'documents', ['user_id'])
    op.create_index('idx_containers_created_by', 'containers', ['created_by'])
    op.create_index('idx_backorders_created_by', 'backorders', ['created_by'])
    op.create_index('idx_ap2_connections_user_id', 'ap2_connections', ['user_id'])
    op.create_index('idx_approvals_requested_by', 'approvals', ['requested_by'])
    op.create_index('idx_approval_steps_approver_id', 'approval_steps', ['approver_id'])
    op.create_index('idx_email_conversations_assigned_to', 'email_conversations', ['assigned_to'])
    op.create_index('idx_product_stock_by_location_last_counted_by',
                    'product_stock_by_location', ['last_counted_by'])
    op.create_index('idx_stock_transfers_initiated_by', 'stock_transfers', ['initiated_by'])
    op.create_index('idx_stock_transfers_completed_by', 'stock_transfers', ['completed_by'])

    # Customer references (2 indexes) - MEDIUM priority
    op.create_index('idx_backorders_customer_id', 'backorders', ['customer_id'])
    op.create_index('idx_email_conversations_customer_id', 'email_conversations', ['customer_id'])

    # Other references (3 indexes) - Various
    op.create_index('idx_learning_insights_agent_id', 'learning_insights', ['agent_id'])
    op.create_index('idx_prompt_variants_agent_id', 'prompt_variants', ['agent_id'])
    op.create_index('idx_approvals_entity_id', 'approvals', ['entity_id'])
    op.create_index('idx_email_messages_email_message_id', 'email_messages', ['email_message_id'])


def downgrade() -> None:
    """Remove timestamps and FK indexes."""

    # =========================================================================
    # Remove foreign key indexes
    # =========================================================================

    op.drop_index('idx_users_organization_id', 'users')
    op.drop_index('idx_products_organization_id', 'products')
    op.drop_index('idx_customers_organization_id', 'customers')
    op.drop_index('idx_orders_organization_id', 'orders')
    op.drop_index('idx_quotes_organization_id', 'quotes')
    op.drop_index('idx_ap2_connections_organization_id', 'ap2_connections')

    op.drop_index('idx_contractors_user_id', 'contractors')
    op.drop_index('idx_documents_user_id', 'documents')
    op.drop_index('idx_containers_created_by', 'containers')
    op.drop_index('idx_backorders_created_by', 'backorders')
    op.drop_index('idx_ap2_connections_user_id', 'ap2_connections')
    op.drop_index('idx_approvals_requested_by', 'approvals')
    op.drop_index('idx_approval_steps_approver_id', 'approval_steps')
    op.drop_index('idx_email_conversations_assigned_to', 'email_conversations')
    op.drop_index('idx_product_stock_by_location_last_counted_by',
                  'product_stock_by_location')
    op.drop_index('idx_stock_transfers_initiated_by', 'stock_transfers')
    op.drop_index('idx_stock_transfers_completed_by', 'stock_transfers')

    op.drop_index('idx_backorders_customer_id', 'backorders')
    op.drop_index('idx_email_conversations_customer_id', 'email_conversations')

    op.drop_index('idx_learning_insights_agent_id', 'learning_insights')
    op.drop_index('idx_prompt_variants_agent_id', 'prompt_variants')
    op.drop_index('idx_approvals_entity_id', 'approvals')
    op.drop_index('idx_email_messages_email_message_id', 'email_messages')

    # =========================================================================
    # Remove triggers and functions
    # =========================================================================

    op.execute("DROP TRIGGER IF EXISTS order_items_updated_at_trigger ON order_items")
    op.execute("DROP TRIGGER IF EXISTS quote_items_updated_at_trigger ON quote_items")
    op.execute("DROP TRIGGER IF EXISTS submission_notes_updated_at_trigger ON submission_notes")

    op.execute("DROP FUNCTION IF EXISTS update_order_items_updated_at()")
    op.execute("DROP FUNCTION IF EXISTS update_quote_items_updated_at()")
    op.execute("DROP FUNCTION IF EXISTS update_submission_notes_updated_at()")

    # =========================================================================
    # Remove updated_at columns
    # =========================================================================

    op.drop_column('submission_notes', 'updated_at')
    op.drop_column('quote_items', 'updated_at')
    op.drop_column('order_items', 'updated_at')
