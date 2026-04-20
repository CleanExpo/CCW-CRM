-- UNI-1821: per-customer payment terms (sync to Xero contacts)
-- UNI-1831: B2B / B2C customer type (GST and pricing treatment)
--
-- Safe to re-run — all DDL is guarded by IF NOT EXISTS.
-- Run in Supabase SQL Editor after merging PR.

CREATE TABLE IF NOT EXISTS customer_profile (
    customer_id         UUID        PRIMARY KEY
                                    REFERENCES customers(id) ON DELETE CASCADE,
    customer_type       CHAR(3)     NOT NULL DEFAULT 'B2B'
                                    CHECK (customer_type IN ('B2B', 'B2C')),
    payment_terms_days  INTEGER     NOT NULL DEFAULT 30
                                    CHECK (payment_terms_days > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE customer_profile IS
    '1:1 extension of customers table — payment terms + B2B/B2C type (UNI-1821 / UNI-1831)';

COMMENT ON COLUMN customer_profile.customer_type IS
    'B2B = business customer (ex-GST pricing, Xero PaymentTerms set); '
    'B2C = consumer (inc-GST pricing, ACL consumer protections apply)';

COMMENT ON COLUMN customer_profile.payment_terms_days IS
    'Net payment terms in days (e.g. 7, 14, 30, 60). '
    'Synced to Xero contact PaymentTerms.Sales on every Xero contact write.';
