-- Migration: Add purchase order polling watermark to cin7_connections
-- Ticket: UNI-1830 — Add PO and invoice events to Cin7 polling handler
--
-- Run this against your Supabase project:
--   Settings → SQL Editor → paste and execute
--
-- Safe to re-run (IF NOT EXISTS guard).

ALTER TABLE cin7_connections
    ADD COLUMN IF NOT EXISTS last_purchase_order_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN cin7_connections.last_purchase_order_sync_at
    IS 'Watermark timestamp for purchase-order polling (UNI-1830)';
