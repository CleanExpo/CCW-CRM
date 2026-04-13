"""Rename invoices.issue_date to invoice_date

Revision ID: 00a_rename_invoice_date
Revises: 009_add_pos_tables
Create Date: 2026-03-24

The Invoice SQLAlchemy model uses invoice_date but the original migration
bb5f3d8c8a16_add_invoicing_tables created the column as issue_date.
This migration aligns the DB schema with the model definition.
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '00a_rename_invoice_date'
down_revision: str | Sequence[str] | None = '009_add_pos_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Rename issue_date to invoice_date."""
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'invoices' AND column_name = 'issue_date'
            ) THEN
                ALTER TABLE invoices RENAME COLUMN issue_date TO invoice_date;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Rename invoice_date back to issue_date."""
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'invoices' AND column_name = 'invoice_date'
            ) THEN
                ALTER TABLE invoices RENAME COLUMN invoice_date TO issue_date;
            END IF;
        END $$;
    """)
