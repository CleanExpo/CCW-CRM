"""add_prd_tables

Revision ID: 00e
Revises: 009
Create Date: 2026-01-15

Adds tables for PRD generation feature:
- prds: Stores generated PRD documents
- api_usage: Tracks AI API usage and costs
- agent_runs: Tracks agent execution history
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e1f2g3h4i5j6'
down_revision: Union[str, None] = 'd4f7a9b2e5c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create prds table
    op.create_table(
        'prds',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),

        # Input
        sa.Column('requirements', sa.Text, nullable=False),
        sa.Column('context', postgresql.JSONB, nullable=True),

        # Generated content
        sa.Column('executive_summary', sa.Text, nullable=True),
        sa.Column('problem_statement', sa.Text, nullable=True),
        sa.Column('prd_analysis', postgresql.JSONB, nullable=True),
        sa.Column('feature_decomposition', postgresql.JSONB, nullable=True),
        sa.Column('technical_spec', postgresql.JSONB, nullable=True),
        sa.Column('test_plan', postgresql.JSONB, nullable=True),
        sa.Column('roadmap', postgresql.JSONB, nullable=True),

        # Documents generated
        sa.Column('documents_generated', postgresql.ARRAY(sa.String), nullable=True),

        # Summary stats
        sa.Column('total_user_stories', sa.Integer, default=0),
        sa.Column('total_api_endpoints', sa.Integer, default=0),
        sa.Column('total_test_scenarios', sa.Integer, default=0),
        sa.Column('total_sprints', sa.Integer, default=0),
        sa.Column('estimated_duration_weeks', sa.Integer, default=0),

        # Status tracking
        sa.Column('status', sa.String(50), default='generating', nullable=False),  # generating, completed, failed
        sa.Column('error_message', sa.Text, nullable=True),

        # Model info
        sa.Column('model_used', sa.String(100), default='claude-opus-4-5-20251101'),

        # Timestamps
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), onupdate=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('completed_at', sa.TIMESTAMP(timezone=True), nullable=True),

        # Indexes
        sa.Index('ix_prds_user_id', 'user_id'),
        sa.Index('ix_prds_organization_id', 'organization_id'),
        sa.Index('ix_prds_status', 'status'),
        sa.Index('ix_prds_created_at', 'created_at'),
    )

    # Create api_usage table
    op.create_table(
        'api_usage',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('agent_run_id', sa.String(255), nullable=False),
        sa.Column('prd_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('prds.id', ondelete='CASCADE'), nullable=True),

        # API details
        sa.Column('provider', sa.String(100), nullable=False),  # anthropic, openai, etc.
        sa.Column('model', sa.String(100), nullable=False),

        # Token usage
        sa.Column('input_tokens', sa.Integer, nullable=False),
        sa.Column('output_tokens', sa.Integer, nullable=False),

        # Cost calculation
        sa.Column('cost_per_input_token', sa.Numeric(20, 10), nullable=False),
        sa.Column('cost_per_output_token', sa.Numeric(20, 10), nullable=False),
        sa.Column('total_cost', sa.Numeric(20, 10),
                 sa.Computed('(input_tokens * cost_per_input_token) + (output_tokens * cost_per_output_token)')),

        # Metadata
        sa.Column('metadata', postgresql.JSONB, nullable=True),

        # Timestamp
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),

        # Indexes
        sa.Index('ix_api_usage_agent_run_id', 'agent_run_id'),
        sa.Index('ix_api_usage_prd_id', 'prd_id'),
        sa.Index('ix_api_usage_provider', 'provider'),
        sa.Index('ix_api_usage_created_at', 'created_at'),
    )

    # Create agent_runs table
    op.create_table(
        'agent_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('agent_name', sa.String(255), nullable=False),
        sa.Column('task_description', sa.Text, nullable=True),

        # Status tracking
        sa.Column('status', sa.String(50), nullable=False, default='running'),  # running, completed, failed
        sa.Column('progress', sa.Integer, default=0),  # 0-100
        sa.Column('current_step', sa.String(255), nullable=True),

        # Results
        sa.Column('outputs', postgresql.JSONB, nullable=True),
        sa.Column('error', sa.Text, nullable=True),

        # Linked resources
        sa.Column('prd_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('prds.id', ondelete='CASCADE'), nullable=True),

        # Timestamps
        sa.Column('started_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('completed_at', sa.TIMESTAMP(timezone=True), nullable=True),

        # Indexes
        sa.Index('ix_agent_runs_agent_name', 'agent_name'),
        sa.Index('ix_agent_runs_status', 'status'),
        sa.Index('ix_agent_runs_prd_id', 'prd_id'),
        sa.Index('ix_agent_runs_started_at', 'started_at'),
    )

    # Create view for cost analytics
    op.execute("""
        CREATE OR REPLACE VIEW api_usage_summary AS
        SELECT
            provider,
            model,
            DATE(created_at) as usage_date,
            COUNT(*) as total_calls,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(total_cost) as total_cost
        FROM api_usage
        GROUP BY provider, model, DATE(created_at)
        ORDER BY usage_date DESC, total_cost DESC;
    """)


def downgrade() -> None:
    # Drop view
    op.execute("DROP VIEW IF EXISTS api_usage_summary")

    # Drop tables (in reverse order of creation due to foreign keys)
    op.drop_table('agent_runs')
    op.drop_table('api_usage')
    op.drop_table('prds')
