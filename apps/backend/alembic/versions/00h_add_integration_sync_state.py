"""Add integration_sync_state table for persistent poll watermarks.

Revision ID: 00h_add_integration_sync_state
Revises: 00g_variants_updated_at
Create Date: 2026-04-16

Fixes UNI-1838: Cin7 poll watermarks were stored only in memory.
After a server restart, all data since the last watermark would be
re-processed (duplicates) or lost.  This table persists the watermark
so the ChangeDetector can seed its in-memory state on startup.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "00h_add_integration_sync_state"
down_revision: str | None = "00g_variants_updated_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create integration_sync_state table."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS integration_sync_state (
            integration  VARCHAR(100) NOT NULL,
            entity_type  VARCHAR(100) NOT NULL,
            last_synced  TIMESTAMPTZ,
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (integration, entity_type)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_integration_sync_state_integration
            ON integration_sync_state (integration)
    """)


def downgrade() -> None:
    """Drop integration_sync_state table."""
    op.execute("DROP TABLE IF EXISTS integration_sync_state")
