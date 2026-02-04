-- Migration: Add Auto-Sync Enhancement Fields
-- Date: 2026-02-04
-- Purpose: Add configurable sync intervals, webhook support, and AI matching suggestions

-- Phase 1: Sync Configuration
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(200),
ADD COLUMN IF NOT EXISTS sync_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Phase 2: AI Matching Suggestions
ALTER TABLE bank_feeds
ADD COLUMN IF NOT EXISTS match_suggestions JSONB DEFAULT '[]'::jsonb;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_bank_accounts_webhook_enabled
ON bank_accounts(webhook_enabled)
WHERE webhook_enabled = TRUE;

-- Create index for pending match suggestions
CREATE INDEX IF NOT EXISTS idx_bank_feeds_match_suggestions
ON bank_feeds(match_status)
WHERE match_status = 'pending' AND match_suggestions IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN bank_accounts.sync_interval_hours IS 'Sync frequency in hours (1=hourly, 4=every 4 hours, 24=daily)';
COMMENT ON COLUMN bank_accounts.webhook_enabled IS 'Enable real-time sync via webhooks';
COMMENT ON COLUMN bank_accounts.webhook_secret IS 'HMAC secret for webhook signature verification';
COMMENT ON COLUMN bank_feeds.match_suggestions IS 'AI-powered match suggestions with confidence scores';
