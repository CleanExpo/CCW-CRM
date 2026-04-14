-- =============================================================================
-- Migration: Index unindexed foreign keys on order_activity and order_items (UNI-1698)
-- Description: Fixes sequential scan degradation on high-traffic order tables.
--              Every order detail page triggered full seq scan on both tables.
-- Applied: 2026-03-31
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_order_activity_order_id
  ON public.order_activity (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);
