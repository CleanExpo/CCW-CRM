"""Add POS system tables (locations, bank_accounts, bank_feeds, etc.)

Revision ID: 009_add_pos_tables
Revises: 008_merge_heads
Create Date: 2026-03-24

Creates the Point-of-Sale tables that were previously only in the standalone
migrations/add_pos_system.sql and migrations/add_auto_sync_enhancements.sql
files. These are required by bank_feeds, reconciliation, and POS routes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009_add_pos_tables'
down_revision: Union[str, Sequence[str], None] = '008_merge_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create POS system tables."""

    # 1. locations — master location data, no FK deps
    op.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('physical', 'virtual')),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            postal_code VARCHAR(20),
            country VARCHAR(100) DEFAULT 'Australia',
            timezone VARCHAR(50) DEFAULT 'Australia/Brisbane',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active)")

    # 2. sales_staff — FK → locations
    op.execute("""
        CREATE TABLE IF NOT EXISTS sales_staff (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            staff_code VARCHAR(50) UNIQUE NOT NULL,
            full_name VARCHAR(200) NOT NULL,
            email VARCHAR(200),
            phone VARCHAR(50),
            primary_location_code VARCHAR(50) NOT NULL,
            can_sell_at_locations VARCHAR(50)[] DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT fk_sales_staff_primary_location
                FOREIGN KEY (primary_location_code) REFERENCES locations(code) ON DELETE RESTRICT
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_staff_code ON sales_staff(staff_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_staff_location ON sales_staff(primary_location_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_staff_active ON sales_staff(is_active)")

    # 3. pos_terminals — FK → locations
    op.execute("""
        CREATE TABLE IF NOT EXISTS pos_terminals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            terminal_id VARCHAR(100) UNIQUE NOT NULL,
            location_code VARCHAR(50) NOT NULL,
            terminal_type VARCHAR(50) NOT NULL CHECK (terminal_type IN ('eftpos', 'amex', 'virtual')),
            merchant_id VARCHAR(200),
            terminal_config JSONB DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            last_ping_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT fk_pos_terminals_location
                FOREIGN KEY (location_code) REFERENCES locations(code) ON DELETE RESTRICT
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_terminals_location ON pos_terminals(location_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_terminals_type ON pos_terminals(terminal_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_terminals_active ON pos_terminals(is_active)")

    # 4. bank_accounts — FK → locations (includes auto_sync columns)
    op.execute("""
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_name VARCHAR(200) NOT NULL,
            account_number VARCHAR(100) NOT NULL,
            bsb VARCHAR(20),
            bank_name VARCHAR(200),
            location_code VARCHAR(50),
            account_type VARCHAR(50) CHECK (account_type IN ('checking', 'savings', 'merchant')),
            currency VARCHAR(3) DEFAULT 'AUD',
            feed_provider VARCHAR(50),
            feed_account_id VARCHAR(200),
            last_feed_sync_at TIMESTAMPTZ,
            feed_sync_status VARCHAR(50),
            sync_interval_hours INTEGER DEFAULT 24,
            webhook_enabled BOOLEAN DEFAULT FALSE,
            webhook_secret VARCHAR(200),
            sync_retry_count INTEGER DEFAULT 0,
            last_sync_error TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT fk_bank_accounts_location
                FOREIGN KEY (location_code) REFERENCES locations(code) ON DELETE SET NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_accounts_location ON bank_accounts(location_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_accounts_feed_provider ON bank_accounts(feed_provider)")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bank_accounts_webhook_enabled
        ON bank_accounts(webhook_enabled)
        WHERE webhook_enabled = TRUE
    """)

    # 5. pos_transactions — FK → orders, pos_terminals, sales_staff, locations
    op.execute("CREATE SEQUENCE IF NOT EXISTS pos_transaction_number_seq START WITH 1 INCREMENT BY 1")
    op.execute("""
        CREATE TABLE IF NOT EXISTS pos_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_number VARCHAR(100) UNIQUE NOT NULL,
            order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
            terminal_id UUID REFERENCES pos_terminals(id) ON DELETE RESTRICT,
            sales_staff_id UUID REFERENCES sales_staff(id) ON DELETE RESTRICT,
            location_code VARCHAR(50) NOT NULL REFERENCES locations(code) ON DELETE RESTRICT,
            resolved_location_code VARCHAR(50) REFERENCES locations(code) ON DELETE RESTRICT,
            transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('sale', 'refund', 'void')),
            payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('eftpos', 'amex', 'bank_transfer', 'cash')),
            amount DECIMAL(15, 2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'AUD',
            payment_status VARCHAR(50) NOT NULL CHECK (
                payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')
            ),
            payment_gateway_ref VARCHAR(200),
            payment_gateway_response JSONB,
            bank_statement_ref VARCHAR(200),
            xero_invoice_id VARCHAR(200),
            cin7_transaction_id VARCHAR(200),
            reconciliation_status VARCHAR(50) DEFAULT 'pending' CHECK (
                reconciliation_status IN ('pending', 'matched', 'discrepancy', 'resolved')
            ),
            reconciled_at TIMESTAMPTZ,
            reconciled_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_order ON pos_transactions(order_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_terminal ON pos_transactions(terminal_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_staff ON pos_transactions(sales_staff_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_location ON pos_transactions(location_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_status ON pos_transactions(payment_status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_recon_status ON pos_transactions(reconciliation_status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_date ON pos_transactions(created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pos_transactions_number ON pos_transactions(transaction_number)")

    # 6. bank_feeds — FK → bank_accounts, pos_transactions (includes match_suggestions)
    op.execute("""
        CREATE TABLE IF NOT EXISTS bank_feeds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
            transaction_date DATE NOT NULL,
            description TEXT,
            reference VARCHAR(200),
            debit DECIMAL(15, 2),
            credit DECIMAL(15, 2),
            balance DECIMAL(15, 2),
            matched_pos_transaction_id UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,
            match_confidence DECIMAL(3, 2),
            match_status VARCHAR(50) DEFAULT 'pending' CHECK (
                match_status IN ('pending', 'auto_matched', 'manual_matched', 'no_match')
            ),
            matched_at TIMESTAMPTZ,
            matched_by UUID,
            match_suggestions JSONB DEFAULT '[]',
            raw_data JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_feeds_account ON bank_feeds(bank_account_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_feeds_date ON bank_feeds(transaction_date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_feeds_match_status ON bank_feeds(match_status)")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_bank_feeds_match_suggestions
        ON bank_feeds(match_status)
        WHERE match_status = 'pending' AND match_suggestions IS NOT NULL
    """)


def downgrade() -> None:
    """Drop POS system tables."""
    op.execute("DROP TABLE IF EXISTS bank_feeds CASCADE")
    op.execute("DROP TABLE IF EXISTS pos_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS bank_accounts CASCADE")
    op.execute("DROP TABLE IF EXISTS pos_terminals CASCADE")
    op.execute("DROP TABLE IF EXISTS sales_staff CASCADE")
    op.execute("DROP TABLE IF EXISTS locations CASCADE")
    op.execute("DROP SEQUENCE IF EXISTS pos_transaction_number_seq")
