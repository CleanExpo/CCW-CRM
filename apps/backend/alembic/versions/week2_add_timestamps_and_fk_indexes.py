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


def _create_index_if_table_exists(index_name: str, table_name: str, columns: list[str]) -> None:
    """Create an index only if the table exists (safe for fresh-DB migrations)."""
    cols = ', '.join(columns)
    op.execute(f"""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = '{table_name}'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename = '{table_name}' AND indexname = '{index_name}'
                ) THEN
                    EXECUTE 'CREATE INDEX {index_name} ON {table_name} ({cols})';
                END IF;
            END IF;
        END $$;
    """)


def upgrade() -> None:
    """Add missing timestamps and FK indexes (all operations are idempotent)."""

    # =========================================================================
    # PART 1: Add missing updated_at columns (tables that exist in core schema)
    # =========================================================================

    # Add updated_at to order_items and quote_items (exist in create_erp_schema)
    op.execute("""
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;
    """)
    op.execute("""
        ALTER TABLE quote_items
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;
    """)

    # submission_notes may not exist in fresh CI DB — guard with IF EXISTS
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'submission_notes'
            ) THEN
                EXECUTE 'ALTER TABLE submission_notes
                    ADD COLUMN IF NOT EXISTS updated_at
                    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL';
            END IF;
        END $$;
    """)

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
    """)
    # Attach trigger only if table exists
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'submission_notes'
            ) THEN
                EXECUTE 'DROP TRIGGER IF EXISTS submission_notes_updated_at_trigger
                         ON submission_notes';
                EXECUTE 'CREATE TRIGGER submission_notes_updated_at_trigger
                         BEFORE UPDATE ON submission_notes
                         FOR EACH ROW EXECUTE FUNCTION update_submission_notes_updated_at()';
            END IF;
        END $$;
    """)

    # =========================================================================
    # PART 2: Add missing foreign key indexes (all guarded with IF EXISTS)
    # =========================================================================

    # Organization references (core tables always exist)
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders (organization_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_quotes_organization_id ON quotes (organization_id)")

    # Optional tables that may not exist in fresh DB
    _create_index_if_table_exists('idx_ap2_connections_organization_id', 'ap2_connections', ['organization_id'])
    _create_index_if_table_exists('idx_contractors_user_id', 'contractors', ['user_id'])
    _create_index_if_table_exists('idx_documents_user_id', 'documents', ['user_id'])
    _create_index_if_table_exists('idx_containers_created_by', 'containers', ['created_by'])
    _create_index_if_table_exists('idx_backorders_created_by', 'backorders', ['created_by'])
    _create_index_if_table_exists('idx_ap2_connections_user_id', 'ap2_connections', ['user_id'])
    _create_index_if_table_exists('idx_approvals_requested_by', 'approvals', ['requested_by'])
    _create_index_if_table_exists('idx_approval_steps_approver_id', 'approval_steps', ['approver_id'])
    _create_index_if_table_exists('idx_email_conversations_assigned_to', 'email_conversations', ['assigned_to'])
    _create_index_if_table_exists('idx_product_stock_by_location_last_counted_by',
                                  'product_stock_by_location', ['last_counted_by'])
    _create_index_if_table_exists('idx_stock_transfers_initiated_by', 'stock_transfers', ['initiated_by'])
    _create_index_if_table_exists('idx_stock_transfers_completed_by', 'stock_transfers', ['completed_by'])
    _create_index_if_table_exists('idx_backorders_customer_id', 'backorders', ['customer_id'])
    _create_index_if_table_exists('idx_email_conversations_customer_id', 'email_conversations', ['customer_id'])
    _create_index_if_table_exists('idx_learning_insights_agent_id', 'learning_insights', ['agent_id'])
    _create_index_if_table_exists('idx_prompt_variants_agent_id', 'prompt_variants', ['agent_id'])
    _create_index_if_table_exists('idx_approvals_entity_id', 'approvals', ['entity_id'])
    _create_index_if_table_exists('idx_email_messages_email_message_id', 'email_messages', ['email_message_id'])


def downgrade() -> None:
    """Remove timestamps and FK indexes."""

    # =========================================================================
    # Remove foreign key indexes (use IF EXISTS — tables may not exist)
    # =========================================================================

    op.execute("DROP INDEX IF EXISTS idx_users_organization_id")
    op.execute("DROP INDEX IF EXISTS idx_products_organization_id")
    op.execute("DROP INDEX IF EXISTS idx_customers_organization_id")
    op.execute("DROP INDEX IF EXISTS idx_orders_organization_id")
    op.execute("DROP INDEX IF EXISTS idx_quotes_organization_id")
    op.execute("DROP INDEX IF EXISTS idx_ap2_connections_organization_id")
    op.execute("DROP INDEX IF EXISTS idx_contractors_user_id")
    op.execute("DROP INDEX IF EXISTS idx_documents_user_id")
    op.execute("DROP INDEX IF EXISTS idx_containers_created_by")
    op.execute("DROP INDEX IF EXISTS idx_backorders_created_by")
    op.execute("DROP INDEX IF EXISTS idx_ap2_connections_user_id")
    op.execute("DROP INDEX IF EXISTS idx_approvals_requested_by")
    op.execute("DROP INDEX IF EXISTS idx_approval_steps_approver_id")
    op.execute("DROP INDEX IF EXISTS idx_email_conversations_assigned_to")
    op.execute("DROP INDEX IF EXISTS idx_product_stock_by_location_last_counted_by")
    op.execute("DROP INDEX IF EXISTS idx_stock_transfers_initiated_by")
    op.execute("DROP INDEX IF EXISTS idx_stock_transfers_completed_by")
    op.execute("DROP INDEX IF EXISTS idx_backorders_customer_id")
    op.execute("DROP INDEX IF EXISTS idx_email_conversations_customer_id")
    op.execute("DROP INDEX IF EXISTS idx_learning_insights_agent_id")
    op.execute("DROP INDEX IF EXISTS idx_prompt_variants_agent_id")
    op.execute("DROP INDEX IF EXISTS idx_approvals_entity_id")
    op.execute("DROP INDEX IF EXISTS idx_email_messages_email_message_id")

    # =========================================================================
    # Remove triggers and functions
    # =========================================================================

    op.execute("DROP TRIGGER IF EXISTS order_items_updated_at_trigger ON order_items")
    op.execute("DROP TRIGGER IF EXISTS quote_items_updated_at_trigger ON quote_items")
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'submission_notes'
            ) THEN
                EXECUTE 'DROP TRIGGER IF EXISTS submission_notes_updated_at_trigger
                         ON submission_notes';
            END IF;
        END $$;
    """)

    op.execute("DROP FUNCTION IF EXISTS update_order_items_updated_at()")
    op.execute("DROP FUNCTION IF EXISTS update_quote_items_updated_at()")
    op.execute("DROP FUNCTION IF EXISTS update_submission_notes_updated_at()")

    # =========================================================================
    # Remove updated_at columns
    # =========================================================================

    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'submission_notes'
            ) THEN
                EXECUTE 'ALTER TABLE submission_notes DROP COLUMN IF EXISTS updated_at';
            END IF;
        END $$;
    """)
    op.execute("ALTER TABLE quote_items DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS updated_at")
