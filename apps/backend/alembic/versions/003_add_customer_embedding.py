"""Add embedding column to customers table for semantic search

Revision ID: f9a8c7d6e5b4
Revises: 002_add_semantic_search
Create Date: 2026-03-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f9a8c7d6e5b4'
down_revision = '002_add_semantic_search'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add embedding column to customers table
    # Using raw SQL to avoid SQLAlchemy type issues with pgvector
    op.execute("""
        ALTER TABLE customers
        ADD COLUMN embedding vector(1536)
    """)

    # Add comment for documentation
    op.execute("""
        COMMENT ON COLUMN customers.embedding IS
        'Vector embedding for semantic search (1536 dimensions, OpenAI text-embedding-3-small compatible)'
    """)

    # Create index for vector similarity search (using cosine distance)
    # Note: For production, use CREATE INDEX CONCURRENTLY to avoid table locks
    op.execute("""
        CREATE INDEX ix_customers_embedding
        ON customers
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade() -> None:
    # Drop index
    op.execute('DROP INDEX IF EXISTS ix_customers_embedding')

    # Drop column
    op.execute('ALTER TABLE customers DROP COLUMN IF EXISTS embedding')
