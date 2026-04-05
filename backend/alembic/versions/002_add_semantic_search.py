"""Add pgvector for semantic search

Revision ID: 002_add_semantic_search
Revises: 001_add_approvals
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_semantic_search'
down_revision = '001_add_approvals'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Add embedding column to products table
    # Using raw SQL to avoid SQLAlchemy type issues with pgvector
    op.execute("""
        ALTER TABLE products
        ADD COLUMN embedding vector(1536)
    """)

    # Add comment for documentation
    op.execute("""
        COMMENT ON COLUMN products.embedding IS
        'Vector embedding for semantic search (1536 dimensions, OpenAI ada-002 compatible)'
    """)

    # Create index for vector similarity search (using cosine distance)
    # Note: For production, use CREATE INDEX CONCURRENTLY to avoid table locks
    op.execute("""
        CREATE INDEX ix_products_embedding
        ON products
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade() -> None:
    # Drop index
    op.execute('DROP INDEX IF EXISTS ix_products_embedding')

    # Drop column
    op.execute('ALTER TABLE products DROP COLUMN IF EXISTS embedding')

    # Note: We don't drop the extension as other tables might use it
    # If needed, manually run: DROP EXTENSION IF EXISTS vector;
