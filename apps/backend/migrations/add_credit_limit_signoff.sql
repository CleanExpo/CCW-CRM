-- UNI-1829: Credit limit and credit hold companion table for customers
-- Uses a one-to-one extension table to avoid modifying the locked demo_models.py.
CREATE TABLE IF NOT EXISTS customer_credit_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    credit_limit NUMERIC(12, 2) DEFAULT NULL,
    credit_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_credit_profiles_customer_id
    ON customer_credit_profiles (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_credit_profiles_hold
    ON customer_credit_profiles (credit_hold)
    WHERE credit_hold = TRUE;

-- UNI-1836: Customer sign-off columns on workshop bookings
ALTER TABLE workshop_bookings
    ADD COLUMN IF NOT EXISTS customer_signed_off BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sign_off_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS sign_off_method VARCHAR(20) DEFAULT NULL;

-- Index for fast lookup of unsigned-off completed bookings
CREATE INDEX IF NOT EXISTS idx_workshop_bookings_pending_signoff
    ON workshop_bookings (status, customer_signed_off)
    WHERE status = 'completed' AND customer_signed_off = FALSE;
