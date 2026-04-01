-- =============================================================================
-- Migration: AU Privacy Act 2024 Compliance Tables (UNI-1726)
-- Description: consent_records, ai_decision_log, deletion_requests, retention_schedule
-- Deadline: July 2026 ($66K/violation if non-compliant)
-- Applied: 2026-03-31
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_own ON public.consent_records FOR ALL USING ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.ai_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision_made TEXT NOT NULL,
  confidence_score NUMERIC(3,2),
  reasoning TEXT,
  affected_user_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.ai_decision_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_log_service_role ON public.ai_decision_log FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  processed_by TEXT
);
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY deletion_own ON public.deletion_requests FOR ALL USING ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.retention_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  last_purge_at TIMESTAMPTZ,
  next_purge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.retention_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY retention_service_role ON public.retention_schedule FOR ALL USING (auth.role() = 'service_role');

INSERT INTO public.retention_schedule (table_name, retention_days, next_purge_at) VALUES
  ('search_queries', 90, now() + interval '90 days'),
  ('voice_search_sessions', 90, now() + interval '90 days'),
  ('customer_product_interactions', 365, now() + interval '365 days'),
  ('ai_decision_log', 730, now() + interval '730 days'),
  ('consent_records', 2555, now() + interval '2555 days')
ON CONFLICT (table_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON public.consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON public.deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_decision_log_session ON public.ai_decision_log(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_log_created ON public.ai_decision_log(created_at);
