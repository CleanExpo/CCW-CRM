"""add workflow, notification, and products.name indexes

Revision ID: 007
Revises: 006_add_mobile_order_tables
Create Date: 2026-03-24 00:00:00.000000

Adds composite indexes for hot query paths identified in the 2026-03-24
health scan (P2-4) and the missing products.name trigram from migration 003.

Index rationale:
- workflow_instances(status, template_id): filter-by-status + join-to-template
  is the primary list-instances query pattern
- in_app_notifications(user_id, is_read): unread-count-per-user is called on
  every page load via NotificationBell; composite avoids double bitmap scan
- products.name trigram: ILIKE search on product name was missing from 003
  (sku/contact_name/email were added, name was omitted)
"""
from typing import Sequence, Union

from alembic import op


revision: str = '007'
down_revision: Union[str, None] = '006_add_mobile_order_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # workflow_instances: composite index for status + template filtering
    # Table may not exist on fresh CI DB (no dedicated CREATE TABLE migration)
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'workflow_instances'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename = 'workflow_instances'
                      AND indexname = 'idx_workflow_instances_status_template'
                ) THEN
                    EXECUTE 'CREATE INDEX idx_workflow_instances_status_template '
                            'ON workflow_instances (status, template_id)';
                END IF;
            END IF;
        END $$;
    """)

    # in_app_notifications: composite index for unread-per-user query
    # Table may not exist on fresh CI DB
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'in_app_notifications'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE tablename = 'in_app_notifications'
                      AND indexname = 'idx_notifications_user_read'
                ) THEN
                    EXECUTE 'CREATE INDEX idx_notifications_user_read '
                            'ON in_app_notifications (user_id, is_read)';
                END IF;
            END IF;
        END $$;
    """)

    # products.name trigram: omitted from migration 003 (products table always exists)
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    op.execute(
        'CREATE INDEX IF NOT EXISTS idx_products_name_trgm '
        'ON products USING gin(name gin_trgm_ops)'
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS idx_products_name_trgm')
    op.execute('DROP INDEX IF EXISTS idx_notifications_user_read')
    op.execute('DROP INDEX IF EXISTS idx_workflow_instances_status_template')
