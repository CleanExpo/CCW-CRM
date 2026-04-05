"""Add approvals workflow tables

Revision ID: 001_add_approvals
Revises:
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_approvals'
down_revision = '7a9c1d2e3f4b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create approvals table
    op.create_table(
        'approvals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approval_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('total_steps', sa.Integer(), nullable=False),
        sa.Column('current_step', sa.Integer(), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for approvals
    op.create_index('ix_approvals_approval_type', 'approvals', ['approval_type'])
    op.create_index('ix_approvals_entity_id', 'approvals', ['entity_id'])
    op.create_index('ix_approvals_status', 'approvals', ['status'])
    op.create_index('ix_approvals_requested_by', 'approvals', ['requested_by'])
    op.create_index('ix_approvals_created_at', 'approvals', ['created_at'])

    # Create approval_steps table
    op.create_table(
        'approval_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approval_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('approver_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approver_role', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['approval_id'], ['approvals.id'], ondelete='CASCADE')
    )

    # Create indexes for approval_steps
    op.create_index('ix_approval_steps_approval_id', 'approval_steps', ['approval_id'])
    op.create_index('ix_approval_steps_approver_id', 'approval_steps', ['approver_id'])
    op.create_index('ix_approval_steps_status', 'approval_steps', ['status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_approval_steps_status', 'approval_steps')
    op.drop_index('ix_approval_steps_approver_id', 'approval_steps')
    op.drop_index('ix_approval_steps_approval_id', 'approval_steps')
    op.drop_index('ix_approvals_created_at', 'approvals')
    op.drop_index('ix_approvals_requested_by', 'approvals')
    op.drop_index('ix_approvals_status', 'approvals')
    op.drop_index('ix_approvals_entity_id', 'approvals')
    op.drop_index('ix_approvals_approval_type', 'approvals')

    # Drop tables
    op.drop_table('approval_steps')
    op.drop_table('approvals')
