-- Migration: add_organisation_bank_details
-- Creates the organisation_bank_details table so each org can store
-- their bank account details for display on tax invoices.
--
-- Background: apps/web invoices previously showed hardcoded placeholder
-- BSB/account numbers (UNI-1806). This table provides the org-configurable
-- values. All fields are nullable — a missing row (or null fields) is
-- handled gracefully on the invoice page.
--
-- Safe to run multiple times (IF NOT EXISTS guard on table; idempotent index).

CREATE TABLE IF NOT EXISTS organisation_bank_details (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID          NOT NULL UNIQUE,
    bank_name       VARCHAR(255),
    account_name    VARCHAR(255),
    bsb             VARCHAR(10),
    account_number  VARCHAR(30),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_bank_details_org_id
    ON organisation_bank_details (organization_id);
