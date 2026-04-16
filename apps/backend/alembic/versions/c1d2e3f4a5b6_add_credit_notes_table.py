"""add_credit_notes_table

Revision ID: c1d2e3f4a5b6
Revises: bb5f3d8c8a16
Create Date: 2026-04-16 00:00:00.000000

UNI-1810: Credit note workflow
UNI-1814: Xero credit note sync (xero_credit_note_id column)
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "bb5f3d8c8a16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create credit_notes table (UNI-1810, UNI-1814)."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS credit_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
            credit_note_number VARCHAR(100) UNIQUE NOT NULL,
            reason TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
            status VARCHAR(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'issued', 'applied')),
            xero_credit_note_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            issued_at TIMESTAMP WITH TIME ZONE
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_credit_notes_invoice_id ON credit_notes (invoice_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_credit_notes_status ON credit_notes (status)")


def downgrade() -> None:
    """Drop credit_notes table."""
    op.execute("DROP TABLE IF EXISTS credit_notes")
