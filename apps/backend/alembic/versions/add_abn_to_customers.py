"""Add ABN field to customers table

Revision ID: add_abn_to_customers
Revises: w2_timestamps_fk_idx
Create Date: 2026-04-16

Changes:
1. Add abn column (VARCHAR 11, nullable) to customers table
   - Required for Australian B2B tax invoices
   - Synced to Xero contact TaxNumber field

Linear: UNI-1807
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_abn_to_customers'
down_revision = 'w2_timestamps_fk_idx'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'customers',
        sa.Column('abn', sa.String(length=11), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('customers', 'abn')
