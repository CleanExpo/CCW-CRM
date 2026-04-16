"""merge_multiple_heads_sprint12

Revision ID: 01766d320d15
Revises: 00h_add_integration_sync_state, add_abn_to_customers, c1d2e3f4a5b6
Create Date: 2026-04-16 17:08:56.698700

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01766d320d15'
down_revision: Union[str, Sequence[str], None] = ('00h_add_integration_sync_state', 'add_abn_to_customers', 'c1d2e3f4a5b6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
