-- ISS-036: Webhook Transaction Boundaries
-- Migration to add webhook event tracking with transaction safety
--
-- Run with: psql $DATABASE_URL -f migrations/add_webhook_events_table.sql

BEGIN;

-- Create webhook_events table for reliable webhook processing
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source identification
    source VARCHAR(50) NOT NULL,  -- shopify, xero, sendgrid, stripe, etc.
    event_type VARCHAR(100) NOT NULL,  -- orders/create, INVOICE.UPDATE, etc.

    -- Idempotency key (unique per source)
    event_id VARCHAR(255) NOT NULL,

    -- Webhook payload and headers
    payload JSONB NOT NULL,
    headers JSONB,

    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Values: pending, processing, completed, failed, dead_letter

    -- Retry management
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- Processing result
    processing_result JSONB,

    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_processing_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Composite unique index for idempotency (source + event_id)
CREATE UNIQUE INDEX IF NOT EXISTS ix_webhook_events_source_event_id
    ON webhook_events(source, event_id);

-- Index for querying by status (for monitoring dashboard)
CREATE INDEX IF NOT EXISTS ix_webhook_events_status
    ON webhook_events(status);

-- Index for retry queue queries
CREATE INDEX IF NOT EXISTS ix_webhook_events_status_next_retry
    ON webhook_events(status, next_retry_at)
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Index for recent webhooks by source
CREATE INDEX IF NOT EXISTS ix_webhook_events_source_received
    ON webhook_events(source, received_at DESC);

-- Index for completed webhooks (for metrics)
CREATE INDEX IF NOT EXISTS ix_webhook_events_completed
    ON webhook_events(completed_at DESC)
    WHERE status = 'completed';

-- Index for dead letter queue
CREATE INDEX IF NOT EXISTS ix_webhook_events_dead_letter
    ON webhook_events(received_at DESC)
    WHERE status = 'dead_letter';

-- Create webhook_metrics table for aggregated statistics
CREATE TABLE IF NOT EXISTS webhook_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Metric period
    period_type VARCHAR(20) NOT NULL,  -- hourly, daily, weekly
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Metrics by source
    source VARCHAR(50) NOT NULL,

    -- Counts
    total_received INTEGER NOT NULL DEFAULT 0,
    total_completed INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    total_dead_letter INTEGER NOT NULL DEFAULT 0,

    -- Performance
    avg_processing_time_ms INTEGER,
    max_processing_time_ms INTEGER,

    -- Reliability rate
    reliability_rate FLOAT,

    -- Timestamp
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for metrics period/source combination
CREATE UNIQUE INDEX IF NOT EXISTS ix_webhook_metrics_source_period
    ON webhook_metrics(source, period_type, period_start);

-- Index for querying metrics by period
CREATE INDEX IF NOT EXISTS ix_webhook_metrics_period_start
    ON webhook_metrics(period_start DESC);

-- Add comments for documentation
COMMENT ON TABLE webhook_events IS 'Persistent webhook event log for reliable processing with transaction safety (ISS-036)';
COMMENT ON COLUMN webhook_events.source IS 'Webhook source: shopify, xero, sendgrid, stripe, fedex, ups, usps, contact_form, demo_request, other';
COMMENT ON COLUMN webhook_events.event_id IS 'Unique event ID from webhook provider for idempotency';
COMMENT ON COLUMN webhook_events.status IS 'Processing status: pending, processing, completed, failed, dead_letter';
COMMENT ON COLUMN webhook_events.next_retry_at IS 'When to retry failed webhook (exponential backoff)';

COMMENT ON TABLE webhook_metrics IS 'Aggregated webhook metrics for monitoring dashboards';
COMMENT ON COLUMN webhook_metrics.reliability_rate IS 'Success rate: completed / (completed + failed + dead_letter)';

-- Function to calculate webhook metrics for a period
CREATE OR REPLACE FUNCTION calculate_webhook_metrics(
    p_period_type VARCHAR(20),
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_source VARCHAR(50);
BEGIN
    -- Delete existing metrics for this period
    DELETE FROM webhook_metrics
    WHERE period_type = p_period_type
      AND period_start = p_period_start;

    -- Calculate metrics for each source
    FOR v_source IN
        SELECT DISTINCT source FROM webhook_events
        WHERE received_at >= p_period_start AND received_at < p_period_end
    LOOP
        INSERT INTO webhook_metrics (
            period_type,
            period_start,
            period_end,
            source,
            total_received,
            total_completed,
            total_failed,
            total_dead_letter,
            avg_processing_time_ms,
            max_processing_time_ms,
            reliability_rate
        )
        SELECT
            p_period_type,
            p_period_start,
            p_period_end,
            v_source,
            COUNT(*),
            COUNT(*) FILTER (WHERE status = 'completed'),
            COUNT(*) FILTER (WHERE status = 'failed'),
            COUNT(*) FILTER (WHERE status = 'dead_letter'),
            AVG(
                EXTRACT(EPOCH FROM (completed_at - started_processing_at)) * 1000
            )::INTEGER FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            MAX(
                EXTRACT(EPOCH FROM (completed_at - started_processing_at)) * 1000
            )::INTEGER FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL),
            CASE
                WHEN COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dead_letter')) > 0
                THEN (
                    COUNT(*) FILTER (WHERE status = 'completed')::FLOAT /
                    COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dead_letter'))
                )
                ELSE NULL
            END
        FROM webhook_events
        WHERE source = v_source
          AND received_at >= p_period_start
          AND received_at < p_period_end;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION calculate_webhook_metrics IS 'Calculate aggregated webhook metrics for a time period';

-- View for real-time webhook health monitoring
CREATE OR REPLACE VIEW webhook_health AS
SELECT
    source,
    COUNT(*) AS total_24h,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_24h,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_24h,
    COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_24h,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_now,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_now,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
         NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'dead_letter')), 0)) * 100,
        2
    ) AS reliability_rate,
    AVG(
        EXTRACT(EPOCH FROM (completed_at - started_processing_at)) * 1000
    ) FILTER (WHERE status = 'completed')::INTEGER AS avg_processing_ms,
    MAX(received_at) AS last_webhook_at
FROM webhook_events
WHERE received_at >= NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY source;

COMMENT ON VIEW webhook_health IS 'Real-time webhook health metrics per source (last 24 hours)';

COMMIT;

-- Example queries:
--
-- Check webhook health:
-- SELECT * FROM webhook_health;
--
-- Get failed webhooks ready for retry:
-- SELECT * FROM webhook_events
-- WHERE status = 'failed'
--   AND next_retry_at <= NOW()
--   AND retry_count < max_retries
-- ORDER BY next_retry_at
-- LIMIT 100;
--
-- Get dead letter queue:
-- SELECT * FROM webhook_events
-- WHERE status = 'dead_letter'
-- ORDER BY received_at DESC
-- LIMIT 50;
--
-- Calculate hourly metrics:
-- SELECT calculate_webhook_metrics(
--     'hourly',
--     date_trunc('hour', NOW() - INTERVAL '1 hour'),
--     date_trunc('hour', NOW())
-- );
