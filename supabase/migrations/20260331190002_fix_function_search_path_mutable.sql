-- =============================================================================
-- Migration: Fix mutable search_path on 10 public functions (UNI-1705)
-- Description: Sets search_path = public, pg_catalog on all custom functions
--              to prevent search_path hijacking attacks.
--              Note: api_usage_summary view does not exist in this instance.
-- Applied: 2026-03-31
-- =============================================================================

ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_ai_memories_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.increment_memory_access(memory_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.find_similar_memories(query_embedding vector, match_threshold double precision, match_count integer, filter_domain text, filter_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.prune_stale_memories(min_relevance double precision, max_age_days integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.notify_agent_run_status_change() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_active_agent_runs(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_expired_evidence() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog;
