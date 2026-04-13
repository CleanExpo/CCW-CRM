"""add_background_jobs_table

Revision ID: 28a0fb9f5a0a
Revises: e0d600e2ca45
Create Date: 2026-01-16 03:57:18.717926

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '28a0fb9f5a0a'
down_revision: str | Sequence[str] | None = 'e0d600e2ca45'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create background_jobs table for async job processing."""

    # Create job_status enum (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create background_jobs table
    op.execute("""
        CREATE TABLE background_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_type VARCHAR(100) NOT NULL,
            status job_status NOT NULL DEFAULT 'pending',
            input_data JSON,
            output_data JSON,
            progress INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE
        )
    """)

    # Create indexes for performance
    op.create_index('idx_background_jobs_status', 'background_jobs', ['status'])
    op.create_index('idx_background_jobs_job_type', 'background_jobs', ['job_type'])
    op.create_index('idx_background_jobs_created_at', 'background_jobs', ['created_at'])


def downgrade() -> None:
    """Drop background_jobs table and enum."""
    op.drop_index('idx_background_jobs_created_at', table_name='background_jobs')
    op.drop_index('idx_background_jobs_job_type', table_name='background_jobs')
    op.drop_index('idx_background_jobs_status', table_name='background_jobs')
    op.drop_table('background_jobs')
    op.execute("DROP TYPE job_status")
