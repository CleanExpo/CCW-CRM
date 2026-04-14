-- =============================================================================
-- Migration: Enable RLS on public.users to protect hashed_password (UNI-1688)
-- Description: Deny-all lockdown via PostgREST. App uses direct DATABASE_URL
--              (postgres role) so unaffected by RLS. Closes the last remaining
--              credential exposure gap without modifying auth code.
-- Decision: Single-tenant internal tool — multi-tenancy (UNI-1700–1704) not needed.
-- Applied: 2026-03-31
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
