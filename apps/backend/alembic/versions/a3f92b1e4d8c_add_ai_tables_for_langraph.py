"""add_ai_tables_for_langraph

Revision ID: a3f92b1e4d8c
Revises: 68d51946645a
Create Date: 2026-01-09 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a3f92b1e4d8c'
down_revision: str | Sequence[str] | None = '68d51946645a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - Add AI tables for LangGraph agents."""

    # Create conversation_history table
    op.create_table(
        'conversation_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create agent_executions table
    op.create_table(
        'agent_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('agent_id', sa.String(100), nullable=False),
        sa.Column('agent_name', sa.String(255), nullable=False),
        sa.Column('task', sa.Text(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('result', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('completed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create ai_generated_content table
    op.create_table(
        'ai_generated_content',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('content_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for better query performance
    op.create_index('ix_conversation_history_conversation_id', 'conversation_history', ['conversation_id'])
    op.create_index('ix_conversation_history_user_id', 'conversation_history', ['user_id'])
    op.create_index('ix_agent_executions_agent_id', 'agent_executions', ['agent_id'])
    op.create_index('ix_agent_executions_user_id', 'agent_executions', ['user_id'])
    op.create_index('ix_ai_generated_content_content_type', 'ai_generated_content', ['content_type'])
    op.create_index('ix_ai_generated_content_entity_id', 'ai_generated_content', ['entity_id'])
    op.create_index('ix_ai_generated_content_user_id', 'ai_generated_content', ['user_id'])


def downgrade() -> None:
    """Downgrade schema - Remove AI tables."""

    # Drop indexes
    op.drop_index('ix_ai_generated_content_user_id', 'ai_generated_content')
    op.drop_index('ix_ai_generated_content_entity_id', 'ai_generated_content')
    op.drop_index('ix_ai_generated_content_content_type', 'ai_generated_content')
    op.drop_index('ix_agent_executions_user_id', 'agent_executions')
    op.drop_index('ix_agent_executions_agent_id', 'agent_executions')
    op.drop_index('ix_conversation_history_user_id', 'conversation_history')
    op.drop_index('ix_conversation_history_conversation_id', 'conversation_history')

    # Drop tables
    op.drop_table('ai_generated_content')
    op.drop_table('agent_executions')
    op.drop_table('conversation_history')
