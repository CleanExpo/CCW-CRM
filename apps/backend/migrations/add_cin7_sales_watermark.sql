-- Migration: add_cin7_sales_watermark
-- Adds last_sales_sync_at column to cin7_connections so that Cin7 poll
-- watermarks for the sales entity can be persisted across restarts.
--
-- Background: Cin7ChangeDetector tracks last-polled timestamps per entity type.
-- The other three entity columns (products, customers, inventory) already exist;
-- sales was missing, causing the sales watermark to always reset to epoch on
-- backend restart and forcing a full re-poll of all historical sales records.
--
-- Safe to run multiple times (IF NOT EXISTS guard).

ALTER TABLE cin7_connections
    ADD COLUMN IF NOT EXISTS last_sales_sync_at TIMESTAMPTZ;
