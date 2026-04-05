-- ISS-037: Email Audit Trail for GDPR Compliance
-- Migration: add_email_audit_tables.sql
-- Created: 2026-02-12
--
-- Creates tables for comprehensive email audit logging:
-- - email_logs: Complete audit trail of all emails sent
-- - email_consents: Per-recipient consent tracking
--
-- GDPR Compliance Features:
-- - Full content archival for data export
-- - Consent tracking per purpose
-- - Delivery status tracking
-- - Suppression list management

-- ============================================================
-- Email Logs Table
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recipient Information
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),

    -- Sender Information
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    reply_to VARCHAR(255),

    -- Email Content (for GDPR export)
    subject VARCHAR(500) NOT NULL,
    html_content TEXT,
    text_content TEXT,
    template_id VARCHAR(100),

    -- Delivery Tracking
    sendgrid_message_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    error_message TEXT,
    error_code VARCHAR(50),

    -- Engagement Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    open_count INTEGER NOT NULL DEFAULT 0,
    clicked_at TIMESTAMPTZ,
    click_count INTEGER NOT NULL DEFAULT 0,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    spam_reported_at TIMESTAMPTZ,

    -- GDPR Compliance
    purpose VARCHAR(50) NOT NULL DEFAULT 'transactional',
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    consent_source VARCHAR(100),
    content_purged BOOLEAN NOT NULL DEFAULT FALSE,
    purged_at TIMESTAMPTZ,

    -- Relationships
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Related Entity Tracking
    related_entity_type VARCHAR(50),
    related_entity_id UUID,

    -- Metadata (extra_metadata in Python model, column name: metadata)
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    metadata JSONB,  -- Maps to extra_metadata attribute in SQLAlchemy model

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary indexes
CREATE INDEX IF NOT EXISTS ix_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS ix_email_logs_template_id ON email_logs(template_id);
CREATE INDEX IF NOT EXISTS ix_email_logs_sendgrid_message_id ON email_logs(sendgrid_message_id);
CREATE INDEX IF NOT EXISTS ix_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS ix_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS ix_email_logs_purpose ON email_logs(purpose);
CREATE INDEX IF NOT EXISTS ix_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_email_logs_customer_id ON email_logs(customer_id);
CREATE INDEX IF NOT EXISTS ix_email_logs_organization_id ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS ix_email_logs_related_entity_type ON email_logs(related_entity_type);
CREATE INDEX IF NOT EXISTS ix_email_logs_related_entity_id ON email_logs(related_entity_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS ix_email_logs_customer_date
    ON email_logs(customer_id, created_at);
CREATE INDEX IF NOT EXISTS ix_email_logs_status_date
    ON email_logs(status, created_at);
CREATE INDEX IF NOT EXISTS ix_email_logs_entity
    ON email_logs(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS ix_email_logs_purpose_consent
    ON email_logs(purpose, consent_given);
CREATE INDEX IF NOT EXISTS ix_email_logs_recipient_date
    ON email_logs(recipient_email, created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_logs_updated_at ON email_logs;
CREATE TRIGGER trigger_email_logs_updated_at
    BEFORE UPDATE ON email_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_email_logs_updated_at();

-- ============================================================
-- Email Consents Table
-- ============================================================

CREATE TABLE IF NOT EXISTS email_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Recipient Identification
    email VARCHAR(255) NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

    -- Marketing Consent (GDPR required)
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_consent_at TIMESTAMPTZ,
    marketing_consent_source VARCHAR(100),

    -- Notification Consent
    notification_consent BOOLEAN NOT NULL DEFAULT TRUE,
    notification_consent_at TIMESTAMPTZ,

    -- Unsubscribe Tracking
    unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason VARCHAR(500),

    -- Bounce Tracking
    hard_bounced BOOLEAN NOT NULL DEFAULT FALSE,
    hard_bounced_at TIMESTAMPTZ,
    bounce_count INTEGER NOT NULL DEFAULT 0,

    -- Spam Report Tracking
    spam_reported BOOLEAN NOT NULL DEFAULT FALSE,
    spam_reported_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for email_consents
CREATE INDEX IF NOT EXISTS ix_email_consents_email ON email_consents(email);
CREATE INDEX IF NOT EXISTS ix_email_consents_customer_id ON email_consents(customer_id);
CREATE INDEX IF NOT EXISTS ix_email_consents_marketing_consent
    ON email_consents(marketing_consent) WHERE marketing_consent = TRUE;
CREATE INDEX IF NOT EXISTS ix_email_consents_suppressed
    ON email_consents(email)
    WHERE hard_bounced = TRUE OR spam_reported = TRUE OR unsubscribed = TRUE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_consents_updated_at ON email_consents;
CREATE TRIGGER trigger_email_consents_updated_at
    BEFORE UPDATE ON email_consents
    FOR EACH ROW
    EXECUTE FUNCTION update_email_consents_updated_at();

-- ============================================================
-- Comments for Documentation
-- ============================================================

COMMENT ON TABLE email_logs IS 'GDPR-compliant email audit trail. Stores all emails sent by the system with content for data export and delivery tracking.';
COMMENT ON COLUMN email_logs.recipient_email IS 'Recipient email address (lowercase, trimmed)';
COMMENT ON COLUMN email_logs.sendgrid_message_id IS 'SendGrid X-Message-Id for webhook correlation';
COMMENT ON COLUMN email_logs.status IS 'Delivery status: queued, sent, delivered, opened, clicked, bounced, soft_bounced, dropped, deferred, spam_report, unsubscribed, failed';
COMMENT ON COLUMN email_logs.purpose IS 'Email purpose for GDPR: transactional, notification, marketing, support, system';
COMMENT ON COLUMN email_logs.consent_given IS 'TRUE if marketing consent was given (required for marketing emails)';
COMMENT ON COLUMN email_logs.content_purged IS 'TRUE if email content was purged for data retention compliance';
COMMENT ON COLUMN email_logs.related_entity_type IS 'Entity that triggered email: order, quote, customer, etc.';

COMMENT ON TABLE email_consents IS 'Per-recipient email consent tracking for GDPR compliance and suppression list management.';
COMMENT ON COLUMN email_consents.marketing_consent IS 'Explicit consent for marketing emails (GDPR Article 6)';
COMMENT ON COLUMN email_consents.hard_bounced IS 'Email address bounced permanently - do not send';
COMMENT ON COLUMN email_consents.spam_reported IS 'Recipient marked as spam - do not send marketing';

-- ============================================================
-- Verification
-- ============================================================

DO $$
BEGIN
    -- Verify tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
        RAISE EXCEPTION 'email_logs table was not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_consents') THEN
        RAISE EXCEPTION 'email_consents table was not created';
    END IF;

    RAISE NOTICE 'ISS-037: Email audit tables created successfully';
    RAISE NOTICE '- email_logs: Comprehensive email audit trail';
    RAISE NOTICE '- email_consents: GDPR consent tracking';
END $$;
