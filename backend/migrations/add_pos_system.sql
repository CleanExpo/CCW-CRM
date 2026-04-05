-- Migration: Add Point of Sale (POS) System
-- Created: 2026-01-28
-- Purpose: Complete POS system for 3 physical locations + 2 virtual channels

-- ============================================================
-- 1. LOCATIONS TABLE (Master Data)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('physical', 'virtual')),

    -- Address information (for physical locations)
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Australia',

    -- Configuration
    timezone VARCHAR(50) DEFAULT 'Australia/Brisbane',
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_locations_code ON locations(code);
CREATE INDEX idx_locations_type ON locations(location_type);
CREATE INDEX idx_locations_active ON locations(is_active);

COMMENT ON TABLE locations IS 'Master location data for physical stores and virtual sales channels';
COMMENT ON COLUMN locations.code IS 'Unique location code (e.g., brisbane, sydney, online)';
COMMENT ON COLUMN locations.location_type IS 'Type: physical (store) or virtual (online/phone)';

-- ============================================================
-- 2. SALES STAFF TABLE (Salesperson → Location Mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(50),

    -- Location mapping
    primary_location_code VARCHAR(50) NOT NULL,
    can_sell_at_locations VARCHAR(50)[] DEFAULT '{}', -- Array of location codes

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_sales_staff_primary_location
        FOREIGN KEY (primary_location_code) REFERENCES locations(code) ON DELETE RESTRICT
);

CREATE INDEX idx_sales_staff_code ON sales_staff(staff_code);
CREATE INDEX idx_sales_staff_location ON sales_staff(primary_location_code);
CREATE INDEX idx_sales_staff_active ON sales_staff(is_active);

COMMENT ON TABLE sales_staff IS 'Sales staff with location routing configuration';
COMMENT ON COLUMN sales_staff.staff_code IS 'Unique staff identifier (e.g., QLD-JOHN, NSW-MARY)';
COMMENT ON COLUMN sales_staff.primary_location_code IS 'Default location for routing sales';
COMMENT ON COLUMN sales_staff.can_sell_at_locations IS 'Array of location codes where staff can process sales';

-- ============================================================
-- 3. POS TERMINALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id VARCHAR(100) UNIQUE NOT NULL,
    location_code VARCHAR(50) NOT NULL,
    terminal_type VARCHAR(50) NOT NULL CHECK (terminal_type IN ('eftpos', 'amex', 'virtual')),

    -- Configuration
    merchant_id VARCHAR(200), -- EFTPOS merchant ID
    terminal_config JSONB DEFAULT '{}', -- Terminal-specific settings

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_ping_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_pos_terminals_location
        FOREIGN KEY (location_code) REFERENCES locations(code) ON DELETE RESTRICT
);

CREATE INDEX idx_pos_terminals_location ON pos_terminals(location_code);
CREATE INDEX idx_pos_terminals_type ON pos_terminals(terminal_type);
CREATE INDEX idx_pos_terminals_active ON pos_terminals(is_active);

COMMENT ON TABLE pos_terminals IS 'POS terminals (EFTPOS, AMEX, virtual) at each location';
COMMENT ON COLUMN pos_terminals.terminal_id IS 'Unique terminal identifier';
COMMENT ON COLUMN pos_terminals.terminal_config IS 'JSON configuration for terminal provider integration';

-- ============================================================
-- 4. BANK ACCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    bsb VARCHAR(20),
    bank_name VARCHAR(200),
    location_code VARCHAR(50), -- Which location owns this account
    account_type VARCHAR(50) CHECK (account_type IN ('checking', 'savings', 'merchant')),
    currency VARCHAR(3) DEFAULT 'AUD',

    -- Bank Feed Integration
    feed_provider VARCHAR(50), -- 'xero', 'yodlee', 'basiq', 'manual'
    feed_account_id VARCHAR(200), -- External provider account ID
    last_feed_sync_at TIMESTAMPTZ,
    feed_sync_status VARCHAR(50), -- 'active', 'paused', 'error'

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_bank_accounts_location
        FOREIGN KEY (location_code) REFERENCES locations(code) ON DELETE SET NULL
);

CREATE INDEX idx_bank_accounts_location ON bank_accounts(location_code);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX idx_bank_accounts_feed_provider ON bank_accounts(feed_provider);

COMMENT ON TABLE bank_accounts IS 'Bank accounts for each location with feed integration config';
COMMENT ON COLUMN bank_accounts.feed_provider IS 'Bank feed provider: xero, yodlee, basiq, manual';

-- ============================================================
-- 5. POS TRANSACTIONS TABLE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS pos_transaction_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(100) UNIQUE NOT NULL,

    -- Links
    order_id UUID, -- Link to orders table (optional for walk-ins)
    terminal_id UUID, -- Link to POS terminal
    sales_staff_id UUID, -- Who processed the sale

    -- Location routing
    location_code VARCHAR(50) NOT NULL, -- Where sale occurred (terminal location)
    resolved_location_code VARCHAR(50), -- Final location after routing logic

    -- Transaction Details
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('sale', 'refund', 'void')),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('eftpos', 'amex', 'bank_transfer', 'cash')),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AUD',

    -- Payment Processing
    payment_status VARCHAR(50) NOT NULL CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')),
    payment_gateway_ref VARCHAR(200), -- External payment reference
    payment_gateway_response JSONB, -- Raw response from payment gateway

    -- Reconciliation
    bank_statement_ref VARCHAR(200), -- Reference from bank feed
    xero_invoice_id VARCHAR(200), -- Xero invoice ID
    cin7_transaction_id VARCHAR(200), -- Cin7 reference
    reconciliation_status VARCHAR(50) DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'discrepancy', 'resolved')),
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID, -- User who reconciled

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_pos_transactions_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_pos_transactions_terminal
        FOREIGN KEY (terminal_id) REFERENCES pos_terminals(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pos_transactions_staff
        FOREIGN KEY (sales_staff_id) REFERENCES sales_staff(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pos_transactions_location
        FOREIGN KEY (location_code) REFERENCES locations(code) ON DELETE RESTRICT,
    CONSTRAINT fk_pos_transactions_resolved_location
        FOREIGN KEY (resolved_location_code) REFERENCES locations(code) ON DELETE RESTRICT
);

CREATE INDEX idx_pos_transactions_order ON pos_transactions(order_id);
CREATE INDEX idx_pos_transactions_terminal ON pos_transactions(terminal_id);
CREATE INDEX idx_pos_transactions_staff ON pos_transactions(sales_staff_id);
CREATE INDEX idx_pos_transactions_location ON pos_transactions(location_code);
CREATE INDEX idx_pos_transactions_resolved_location ON pos_transactions(resolved_location_code);
CREATE INDEX idx_pos_transactions_status ON pos_transactions(payment_status);
CREATE INDEX idx_pos_transactions_recon_status ON pos_transactions(reconciliation_status);
CREATE INDEX idx_pos_transactions_date ON pos_transactions(created_at);
CREATE INDEX idx_pos_transactions_number ON pos_transactions(transaction_number);

COMMENT ON TABLE pos_transactions IS 'POS transaction records with payment and reconciliation tracking';
COMMENT ON COLUMN pos_transactions.location_code IS 'Where transaction occurred (terminal location)';
COMMENT ON COLUMN pos_transactions.resolved_location_code IS 'Final location after routing logic (for QLD branch routing)';

-- ============================================================
-- 6. BANK FEEDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL,

    -- Transaction data
    transaction_date DATE NOT NULL,
    description TEXT,
    reference VARCHAR(200),
    debit DECIMAL(15, 2),
    credit DECIMAL(15, 2),
    balance DECIMAL(15, 2),

    -- Matching
    matched_pos_transaction_id UUID, -- Link to pos_transactions
    match_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    match_status VARCHAR(50) DEFAULT 'pending' CHECK (match_status IN ('pending', 'auto_matched', 'manual_matched', 'no_match')),
    matched_at TIMESTAMPTZ,
    matched_by UUID,

    -- Metadata
    raw_data JSONB, -- Original bank feed data

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_bank_feeds_account
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_bank_feeds_matched_transaction
        FOREIGN KEY (matched_pos_transaction_id) REFERENCES pos_transactions(id) ON DELETE SET NULL
);

CREATE INDEX idx_bank_feeds_account ON bank_feeds(bank_account_id);
CREATE INDEX idx_bank_feeds_date ON bank_feeds(transaction_date);
CREATE INDEX idx_bank_feeds_match_status ON bank_feeds(match_status);
CREATE INDEX idx_bank_feeds_matched_transaction ON bank_feeds(matched_pos_transaction_id);

COMMENT ON TABLE bank_feeds IS 'Bank feed transactions for automatic reconciliation';
COMMENT ON COLUMN bank_feeds.match_confidence IS 'Confidence score for auto-matching (0.00 to 1.00)';

-- ============================================================
-- 7. HELPER FUNCTION: Generate POS Transaction Number
-- ============================================================
CREATE OR REPLACE FUNCTION generate_pos_transaction_number()
RETURNS TEXT AS $$
DECLARE
    current_year INTEGER;
    next_num INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    next_num := nextval('pos_transaction_number_seq');
    RETURN 'POS-' || current_year::TEXT || '-' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_pos_transaction_number() IS 'Generate next POS transaction number atomically using sequence';

-- ============================================================
-- 8. SEED DATA: Locations
-- ============================================================
INSERT INTO locations (code, name, location_type, city, state, timezone) VALUES
('brisbane', 'Brisbane Headquarters', 'physical', 'Brisbane', 'Queensland', 'Australia/Brisbane'),
('sydney', 'Sydney Branch', 'physical', 'Sydney', 'New South Wales', 'Australia/Sydney'),
('melbourne', 'Melbourne Branch', 'physical', 'Melbourne', 'Victoria', 'Australia/Melbourne'),
('online', 'Online Sales', 'virtual', NULL, NULL, 'Australia/Brisbane'),
('phone', 'Telephone Sales', 'virtual', NULL, NULL, 'Australia/Brisbane')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 9. SEED DATA: Sample Sales Staff
-- ============================================================
INSERT INTO sales_staff (staff_code, full_name, email, primary_location_code, can_sell_at_locations) VALUES
('QLD-JOHN', 'John Smith', 'john.smith@ccw.com.au', 'brisbane', ARRAY['brisbane', 'sydney', 'melbourne']),
('NSW-MARY', 'Mary Johnson', 'mary.johnson@ccw.com.au', 'sydney', ARRAY['sydney', 'brisbane']),
('VIC-ALEX', 'Alex Williams', 'alex.williams@ccw.com.au', 'melbourne', ARRAY['melbourne']),
('ONLINE-SARAH', 'Sarah Davis', 'sarah.davis@ccw.com.au', 'online', ARRAY['online']),
('PHONE-MIKE', 'Mike Brown', 'mike.brown@ccw.com.au', 'phone', ARRAY['phone'])
ON CONFLICT (staff_code) DO NOTHING;

-- ============================================================
-- 10. SEED DATA: Sample POS Terminals
-- ============================================================
INSERT INTO pos_terminals (terminal_id, location_code, terminal_type, merchant_id) VALUES
('BNE-EFTPOS-01', 'brisbane', 'eftpos', 'MERCHANT-BNE-001'),
('BNE-AMEX-01', 'brisbane', 'amex', 'AMEX-BNE-001'),
('SYD-EFTPOS-01', 'sydney', 'eftpos', 'MERCHANT-SYD-001'),
('SYD-AMEX-01', 'sydney', 'amex', 'AMEX-SYD-001'),
('MEL-EFTPOS-01', 'melbourne', 'eftpos', 'MERCHANT-MEL-001'),
('MEL-AMEX-01', 'melbourne', 'amex', 'AMEX-MEL-001'),
('ONLINE-VIRTUAL-01', 'online', 'virtual', NULL),
('PHONE-VIRTUAL-01', 'phone', 'virtual', NULL)
ON CONFLICT (terminal_id) DO NOTHING;

-- ============================================================
-- 11. SEED DATA: Sample Bank Accounts
-- ============================================================
INSERT INTO bank_accounts (account_name, account_number, bsb, bank_name, location_code, account_type, feed_provider) VALUES
('CCW Brisbane Trading Account', '123456789', '062-000', 'Commonwealth Bank', 'brisbane', 'checking', 'xero'),
('CCW Sydney Trading Account', '987654321', '062-001', 'Commonwealth Bank', 'sydney', 'checking', 'xero'),
('CCW Melbourne Trading Account', '555666777', '062-002', 'Commonwealth Bank', 'melbourne', 'checking', 'xero'),
('CCW Online Merchant Account', '111222333', '062-003', 'Commonwealth Bank', 'online', 'merchant', 'xero')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. ADD PAYMENT FIELDS TO ORDERS TABLE
-- ============================================================
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

COMMENT ON COLUMN orders.payment_status IS 'Payment status: unpaid, partial, paid, refunded';
COMMENT ON COLUMN orders.paid_at IS 'Timestamp when order was fully paid';
COMMENT ON COLUMN orders.payment_method IS 'Payment method used (eftpos, amex, bank_transfer, cash)';

-- Set default payment_status for existing orders
UPDATE orders SET payment_status = 'unpaid' WHERE payment_status IS NULL;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
