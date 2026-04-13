"""add score column to product_recommendations

Revision ID: 006_add_product_recommendations_score
Revises:
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "006_add_product_recommendations_score"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The product_recommendations table was created without the `score` column.
    # Add it with a default so existing rows (if any) are not rejected.
    op.execute("""
        ALTER TABLE product_recommendations
        ADD COLUMN IF NOT EXISTS score NUMERIC(5, 4) NOT NULL DEFAULT 0.5
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE product_recommendations
        DROP COLUMN IF EXISTS score
    """)
