"""Add mobile photo-to-order tables

Revision ID: 006_add_mobile_order_tables
Revises: 005
Create Date: 2026-03-24

Adds three tables supporting the mobile photo-to-order workflow:
- tradesperson_customer_links: Links tradespeople to customers
- product_recognition_images: Stores AI photo recognition results
- guest_order_tokens: Shareable approval links sent to customers
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = '006_add_mobile_order_tables'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------------------------
    # tradesperson_customer_links
    # ---------------------------------------------------------------------------
    op.create_table(
        'tradesperson_customer_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tradesperson_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tradesperson_name', sa.String(255), nullable=False),
        sa.Column('tradesperson_email', sa.String(255), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_name', sa.String(255), nullable=False),
        sa.Column('customer_email', sa.String(255), nullable=False),
        sa.Column('status', sa.Enum('active', 'suspended', 'revoked', name='link_status'), nullable=False, server_default='active'),
        sa.Column('default_delivery_address', postgresql.JSONB, nullable=True),
        sa.Column('credit_limit', sa.Float, nullable=True),
        sa.Column('auto_approve_under', sa.Float, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('approved_by_customer_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_tcp_links_tradesperson', 'tradesperson_customer_links', ['tradesperson_id'])
    op.create_index('ix_tcp_links_customer', 'tradesperson_customer_links', ['customer_id'])
    op.create_index('ix_tcp_links_status', 'tradesperson_customer_links', ['status'])

    # ---------------------------------------------------------------------------
    # product_recognition_images
    # ---------------------------------------------------------------------------
    op.create_table(
        'product_recognition_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_filename', sa.String(500), nullable=True),
        sa.Column('storage_key', sa.String(1000), nullable=False),
        sa.Column('file_size_bytes', sa.Integer, nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=False, server_default='image/jpeg'),
        sa.Column('status', sa.Enum('pending', 'processing', 'completed', 'failed', 'low_confidence', name='recognition_status'), nullable=False, server_default='pending'),
        sa.Column('ai_model_used', sa.String(100), nullable=True),
        sa.Column('recognition_results', postgresql.JSONB, nullable=True),
        sa.Column('top_confidence', sa.Float, nullable=True),
        sa.Column('processing_time_ms', sa.Integer, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('raw_ai_response', postgresql.JSONB, nullable=True),
        sa.Column('used_in_order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('context_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_recognition_uploaded_by', 'product_recognition_images', ['uploaded_by'])
    op.create_index('ix_recognition_status', 'product_recognition_images', ['status'])

    # ---------------------------------------------------------------------------
    # guest_order_tokens
    # ---------------------------------------------------------------------------
    op.create_table(
        'guest_order_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('token', sa.String(64), nullable=False, unique=True),
        sa.Column('link_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recognition_image_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_email', sa.String(255), nullable=False),
        sa.Column('customer_name', sa.String(255), nullable=False),
        sa.Column('order_summary', postgresql.JSONB, nullable=False),
        sa.Column('status', sa.Enum('pending', 'viewed', 'approved', 'payment_pending', 'paid', 'dispatched', 'declined', 'expired', 'cancelled', name='guest_order_status'), nullable=False, server_default='pending'),
        sa.Column('customer_notes', sa.Text, nullable=True),
        sa.Column('declined_reason', sa.Text, nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('stripe_payment_link_url', sa.String(1000), nullable=True),
        sa.Column('amount_paid', sa.Float, nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reminder_sent_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_guest_token', 'guest_order_tokens', ['token'], unique=True)
    op.create_index('ix_guest_customer_email', 'guest_order_tokens', ['customer_email'])
    op.create_index('ix_guest_status', 'guest_order_tokens', ['status'])
    op.create_index('ix_guest_created_by', 'guest_order_tokens', ['created_by_user_id'])
    op.create_index('ix_guest_expires_at', 'guest_order_tokens', ['expires_at'])


def downgrade() -> None:
    op.drop_table('guest_order_tokens')
    op.drop_table('product_recognition_images')
    op.drop_table('tradesperson_customer_links')
    op.execute("DROP TYPE IF EXISTS guest_order_status")
    op.execute("DROP TYPE IF EXISTS recognition_status")
    op.execute("DROP TYPE IF EXISTS link_status")
