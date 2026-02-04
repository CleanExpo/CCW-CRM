-- Google Agent Payments Protocol (AP2) Integration Database Schema
-- Created: 2026-01-22
-- Purpose: Support for AP2 payment processing, voice commerce, and agent-to-agent transactions

-- Create ENUM types for AP2

CREATE TYPE ap2_connection_status AS ENUM ('pending', 'active', 'expired', 'revoked');
CREATE TYPE ap2_mandate_type AS ENUM ('intent', 'cart', 'payment');
CREATE TYPE ap2_mandate_status AS ENUM ('pending', 'verified', 'executed', 'expired', 'revoked');
CREATE TYPE ap2_transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE ap2_voice_session_status AS ENUM ('active', 'completed', 'abandoned', 'error');

-- 1. AP2 Connections Table
-- Stores OAuth credentials and connection state

CREATE TABLE ap2_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- OAuth credentials
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Connection metadata
    status ap2_connection_status NOT NULL DEFAULT 'pending',
    google_account_id VARCHAR(255),
    google_account_email VARCHAR(255),

    -- Timestamps
    connected_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ap2_connections_user ON ap2_connections(user_id);
CREATE INDEX idx_ap2_connections_organization ON ap2_connections(organization_id);
CREATE INDEX idx_ap2_connections_status ON ap2_connections(status);

-- 2. AP2 Mandates Table
-- Cryptographically-signed purchase authorizations

CREATE TABLE ap2_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES ap2_connections(id) ON DELETE CASCADE,

    -- Mandate details
    mandate_type ap2_mandate_type NOT NULL,
    status ap2_mandate_status NOT NULL DEFAULT 'pending',

    -- Intent data (for INTENT mandates)
    intent_description TEXT,
    intent_language VARCHAR(10),

    -- Cart data (for CART mandates)
    cart_items JSONB,
    cart_total NUMERIC(10, 2),

    -- Payment data (for PAYMENT mandates)
    payment_amount NUMERIC(10, 2),
    payment_currency VARCHAR(3) DEFAULT 'AUD',
    payment_method VARCHAR(100),

    -- Cryptographic verification
    signature TEXT,
    signature_algorithm VARCHAR(50) DEFAULT 'RS256',
    public_key TEXT,

    -- Chain references
    parent_mandate_id UUID REFERENCES ap2_mandates(id),

    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ap2_mandates_connection ON ap2_mandates(connection_id);
CREATE INDEX idx_ap2_mandates_type ON ap2_mandates(mandate_type);
CREATE INDEX idx_ap2_mandates_status ON ap2_mandates(status);
CREATE INDEX idx_ap2_mandates_parent ON ap2_mandates(parent_mandate_id);
CREATE INDEX idx_ap2_mandates_expires ON ap2_mandates(expires_at);

-- 3. AP2 Transactions Table
-- Payment transaction records with full audit trail

CREATE TABLE ap2_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mandate_id UUID REFERENCES ap2_mandates(id) ON DELETE CASCADE NOT NULL,

    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL, -- payment, refund, void
    status ap2_transaction_status NOT NULL DEFAULT 'pending',

    -- Financial details
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
    fee NUMERIC(10, 2),
    net_amount NUMERIC(10, 2),

    -- External references
    google_transaction_id VARCHAR(255) UNIQUE,
    payment_method VARCHAR(100),

    -- Order reference
    order_id UUID REFERENCES orders(id),

    -- Status tracking
    processing_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Audit trail
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ap2_transactions_mandate ON ap2_transactions(mandate_id);
CREATE INDEX idx_ap2_transactions_status ON ap2_transactions(status);
CREATE INDEX idx_ap2_transactions_google_txn ON ap2_transactions(google_transaction_id);
CREATE INDEX idx_ap2_transactions_order ON ap2_transactions(order_id);

-- 4. AP2 Voice Sessions Table
-- Track voice commerce sessions

CREATE TABLE ap2_voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES ap2_connections(id) ON DELETE SET NULL,

    -- Session details
    status ap2_voice_session_status NOT NULL DEFAULT 'active',
    language VARCHAR(10) NOT NULL DEFAULT 'en',

    -- Voice assistant
    assistant_type VARCHAR(50), -- siri, google_assistant, alexa

    -- Conversation tracking
    turn_count INTEGER NOT NULL DEFAULT 0,
    conversation_history JSONB,

    -- Intent detection
    detected_intent VARCHAR(100),
    intent_confidence NUMERIC(5, 4),

    -- Order reference
    mandate_id UUID REFERENCES ap2_mandates(id),
    order_id UUID REFERENCES orders(id),

    -- Session lifecycle
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    abandoned_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ap2_voice_sessions_connection ON ap2_voice_sessions(connection_id);
CREATE INDEX idx_ap2_voice_sessions_status ON ap2_voice_sessions(status);
CREATE INDEX idx_ap2_voice_sessions_started ON ap2_voice_sessions(started_at);

-- 5. AP2 Agent Interactions Table
-- Log agent-to-agent commerce interactions

CREATE TABLE ap2_agent_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES ap2_connections(id) ON DELETE SET NULL,

    -- Agent details
    source_agent_id VARCHAR(255) NOT NULL,
    source_agent_type VARCHAR(100),
    target_agent_id VARCHAR(255),

    -- Interaction details
    interaction_type VARCHAR(100) NOT NULL, -- query, order, cancel, status_check
    request_data JSONB,
    response_data JSONB,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    success BOOLEAN,
    error_message TEXT,

    -- Order reference
    mandate_id UUID REFERENCES ap2_mandates(id),
    order_id UUID REFERENCES orders(id),

    -- Performance tracking
    processing_time_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ap2_agent_interactions_connection ON ap2_agent_interactions(connection_id);
CREATE INDEX idx_ap2_agent_interactions_source ON ap2_agent_interactions(source_agent_id);
CREATE INDEX idx_ap2_agent_interactions_type ON ap2_agent_interactions(interaction_type);
CREATE INDEX idx_ap2_agent_interactions_status ON ap2_agent_interactions(status);

-- 6. AP2 Webhook Logs Table
-- Audit trail for all webhooks from Google

CREATE TABLE ap2_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Webhook details
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) UNIQUE,

    -- Request details
    headers JSONB,
    payload JSONB,
    signature TEXT,

    -- Verification
    signature_verified BOOLEAN,
    verification_error TEXT,

    -- Processing
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,

    -- Related entities
    mandate_id UUID REFERENCES ap2_mandates(id),
    transaction_id UUID REFERENCES ap2_transactions(id),

    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ap2_webhook_logs_event_type ON ap2_webhook_logs(event_type);
CREATE INDEX idx_ap2_webhook_logs_event_id ON ap2_webhook_logs(event_id);
CREATE INDEX idx_ap2_webhook_logs_processed ON ap2_webhook_logs(processed);
CREATE INDEX idx_ap2_webhook_logs_received ON ap2_webhook_logs(received_at);

-- Add triggers for updated_at timestamps

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ap2_connections_updated_at
    BEFORE UPDATE ON ap2_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ap2_mandates_updated_at
    BEFORE UPDATE ON ap2_mandates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ap2_transactions_updated_at
    BEFORE UPDATE ON ap2_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ap2_voice_sessions_updated_at
    BEFORE UPDATE ON ap2_voice_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ap2_agent_interactions_updated_at
    BEFORE UPDATE ON ap2_agent_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust based on your role setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_role;

-- Comments for documentation

COMMENT ON TABLE ap2_connections IS 'OAuth connections and credentials for AP2 integration';
COMMENT ON TABLE ap2_mandates IS 'Cryptographically-signed purchase mandates (Intent → Cart → Payment chain)';
COMMENT ON TABLE ap2_transactions IS 'Payment transaction records with full audit trail';
COMMENT ON TABLE ap2_voice_sessions IS 'Voice commerce session tracking (Siri, Google Assistant, etc.)';
COMMENT ON TABLE ap2_agent_interactions IS 'Agent-to-agent commerce interaction logs';
COMMENT ON TABLE ap2_webhook_logs IS 'Webhook audit trail from Google AP2';

-- Migration complete
-- Version: 1.0
-- Author: CCW Team + Claude Code
-- Date: 2026-01-22
