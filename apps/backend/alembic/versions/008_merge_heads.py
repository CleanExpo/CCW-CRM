"""Merge parallel migration branches into single head

Revision ID: 008_merge_heads
Revises: 007_add_workflow_notification_indexes, w2_timestamps_fk_idx
Create Date: 2026-03-24

Merges the two parallel revision branches that existed in the migration
history:
  - 007_add_workflow_notification_indexes (numbered 001-007 chain)
  - w2_timestamps_fk_idx (hash-based chain ending at week2 timestamps)

This is a no-op merge migration with no schema changes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '008_merge_heads'
down_revision: Union[str, Sequence[str], None] = (
    '007_add_workflow_notification_indexes',
    'w2_timestamps_fk_idx',
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
