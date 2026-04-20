-- Migration: fix_service_status_enum
-- Adds missing service_status_enum values so the backend enum matches the frontend.
--
-- Background: The frontend (lib/api/service-requests.ts) defines 8 statuses but the
-- PostgreSQL enum only had 6. PATCH /api/service-requests/:id returned 422 whenever
-- staff tried to set under_review, quote_sent, or scheduled via the UI.
--
-- Safe to run multiple times (IF NOT EXISTS guards each ADD VALUE).
-- NOTE: PostgreSQL does not support removing enum values; 'quoted' is retained for
-- backward compatibility with any existing rows.

ALTER TYPE service_status_enum ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
ALTER TYPE service_status_enum ADD VALUE IF NOT EXISTS 'quote_sent'   AFTER 'quoted';
ALTER TYPE service_status_enum ADD VALUE IF NOT EXISTS 'scheduled'    AFTER 'approved';
