-- =============================================================================
-- Migration: Fix agent_run_summaries SECURITY DEFINER view
-- Description: Recreate view with security_invoker = true so it respects
--              the querying user's RLS policies on agent_runs, instead of
--              bypassing them with the view owner's permissions.
-- Applied: 2026-03-31 (UNI-1688)
-- =============================================================================

CREATE OR REPLACE VIEW public.agent_run_summaries
WITH (security_invoker = true)
AS
SELECT
  ar.id,
  ar.task_id,
  ar.user_id,
  ar.agent_name,
  ar.status,
  ar.current_step,
  ar.progress_percent,
  ar.verification_attempts,
  ar.started_at,
  ar.completed_at,
  ar.updated_at,
  t.description AS task_description,
  EXTRACT(EPOCH FROM (COALESCE(ar.completed_at, NOW()) - ar.started_at)) AS duration_seconds
FROM public.agent_runs ar
LEFT JOIN public.tasks t ON ar.task_id = t.id;

-- Re-grant access
GRANT SELECT ON public.agent_run_summaries TO authenticated;
GRANT SELECT ON public.agent_run_summaries TO service_role;
