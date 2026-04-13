"""add_learning_engine_tables

Revision ID: b8c4e2f9a1d3
Revises: a3f92b1e4d8c
Create Date: 2026-01-09 03:20:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b8c4e2f9a1d3'
down_revision: str | Sequence[str] | None = 'a3f92b1e4d8c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - Add learning engine tables."""

    # Create learning_patterns table
    op.create_table(
        'learning_patterns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('pattern_id', sa.String(100), nullable=False),
        sa.Column('agent_id', sa.String(100), nullable=False),
        sa.Column('pattern_type', sa.String(20), nullable=False),
        sa.Column('task_category', sa.String(200), nullable=False),
        sa.Column('observed_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('success_rate', sa.Float(), nullable=False),
        sa.Column('avg_duration_ms', sa.Float(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('conditions', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('actions', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('outcomes', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('pattern_metadata', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('first_observed', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('last_observed', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('pattern_id')
    )

    # Create learning_insights table
    op.create_table(
        'learning_insights',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('insight_id', sa.String(100), nullable=False),
        sa.Column('insight_type', sa.String(30), nullable=False),
        sa.Column('agent_id', sa.String(100), nullable=False),
        sa.Column('priority', sa.String(10), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('recommended_action', sa.Text(), nullable=False),
        sa.Column('expected_improvement', sa.Float(), nullable=False),
        sa.Column('supporting_patterns', postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('is_implemented', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('implemented_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('insight_id')
    )

    # Create prompt_variants table
    op.create_table(
        'prompt_variants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('variant_id', sa.String(100), nullable=False),
        sa.Column('agent_id', sa.String(100), nullable=False),
        sa.Column('prompt_template', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('executions', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('success_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failure_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg_duration_ms', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('last_used', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('variant_id')
    )

    # Create indexes for better query performance
    op.create_index('ix_learning_patterns_pattern_id', 'learning_patterns', ['pattern_id'])
    op.create_index('ix_learning_patterns_agent_id', 'learning_patterns', ['agent_id'])
    op.create_index('ix_learning_patterns_pattern_type', 'learning_patterns', ['pattern_type'])

    op.create_index('ix_learning_insights_insight_id', 'learning_insights', ['insight_id'])
    op.create_index('ix_learning_insights_agent_id', 'learning_insights', ['agent_id'])
    op.create_index('ix_learning_insights_priority', 'learning_insights', ['priority'])
    op.create_index('ix_learning_insights_insight_type', 'learning_insights', ['insight_type'])

    op.create_index('ix_prompt_variants_variant_id', 'prompt_variants', ['variant_id'])
    op.create_index('ix_prompt_variants_agent_id', 'prompt_variants', ['agent_id'])


def downgrade() -> None:
    """Downgrade schema - Remove learning engine tables."""

    # Drop indexes
    op.drop_index('ix_prompt_variants_agent_id', 'prompt_variants')
    op.drop_index('ix_prompt_variants_variant_id', 'prompt_variants')

    op.drop_index('ix_learning_insights_insight_type', 'learning_insights')
    op.drop_index('ix_learning_insights_priority', 'learning_insights')
    op.drop_index('ix_learning_insights_agent_id', 'learning_insights')
    op.drop_index('ix_learning_insights_insight_id', 'learning_insights')

    op.drop_index('ix_learning_patterns_pattern_type', 'learning_patterns')
    op.drop_index('ix_learning_patterns_agent_id', 'learning_patterns')
    op.drop_index('ix_learning_patterns_pattern_id', 'learning_patterns')

    # Drop tables
    op.drop_table('prompt_variants')
    op.drop_table('learning_insights')
    op.drop_table('learning_patterns')
