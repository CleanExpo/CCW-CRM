-- =============================================================================
-- Migration: Enable RLS on 9 sensitive credential/token tables (UNI-1719)
-- Description: Phase 1 deny-all lockdown. No policies = deny all for
--              anon/authenticated roles via PostgREST. App uses direct
--              DATABASE_URL (postgres role) so unaffected by RLS.
-- Decision: D-028 / Session CCW-BOARD-20260331-1200
-- Applied: 2026-03-31
-- =============================================================================

-- CRITICAL: OAuth credentials
ALTER TABLE public.xero_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap2_connections ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Financial data
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- HIGH: Webhook auth secret
ALTER TABLE public.cin7_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- MEDIUM: Auth token
ALTER TABLE public.testimonial_requests ENABLE ROW LEVEL SECURITY;

-- LOW: Session tracking
ALTER TABLE public.customer_product_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_search_sessions ENABLE ROW LEVEL SECURITY;
