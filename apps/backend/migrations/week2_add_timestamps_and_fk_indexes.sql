-- Week 2 Database Fixes: Add Missing Timestamps + Foreign Key Indexes
-- Date: 2026-02-11
-- Priority: HIGH (P2)
-- Expected Impact: +7-8 schema health points, 20-50% query performance improvement
--
-- This migration:
-- 1. Adds missing updated_at columns to 3 tables (order_items, quote_items, submission_notes)
-- 2. Adds 23 missing foreign key indexes for query performance
--
-- Prerequisites: Base Class Fixes (Week 1) completed
-- Status: Ready to apply
-- Safety: Non-breaking, backward compatible

-- =============================================================================
-- PART 1: ADD MISSING UPDATED_AT TIMESTAMPS
-- =============================================================================

-- Add updated_at to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Add trigger to auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_items_updated_at_trigger ON order_items;
CREATE TRIGGER order_items_updated_at_trigger
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_items_updated_at();

-- Add updated_at to quote_items
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Add trigger to auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_quote_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quote_items_updated_at_trigger ON quote_items;
CREATE TRIGGER quote_items_updated_at_trigger
  BEFORE UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_items_updated_at();

-- Add updated_at to submission_notes
ALTER TABLE submission_notes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Add trigger to auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_submission_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submission_notes_updated_at_trigger ON submission_notes;
CREATE TRIGGER submission_notes_updated_at_trigger
  BEFORE UPDATE ON submission_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_submission_notes_updated_at();

-- =============================================================================
-- PART 2: ADD MISSING FOREIGN KEY INDEXES (23 INDEXES)
-- =============================================================================

-- 1. users.organization_id → organizations (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_users_organization_id
  ON users(organization_id);

-- 2. contractors.user_id → users (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_contractors_user_id
  ON contractors(user_id);

-- 3. documents.user_id → users (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents(user_id);

-- 4. products.organization_id → organizations (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_products_organization_id
  ON products(organization_id);

-- 5. customers.organization_id → organizations (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_customers_organization_id
  ON customers(organization_id);

-- 6. orders.organization_id → organizations (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_orders_organization_id
  ON orders(organization_id);

-- 7. quotes.organization_id → organizations (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id
  ON quotes(organization_id);

-- 8. containers.created_by → users (LOW priority)
CREATE INDEX IF NOT EXISTS idx_containers_created_by
  ON containers(created_by);

-- 9. backorders.created_by → users (LOW priority)
CREATE INDEX IF NOT EXISTS idx_backorders_created_by
  ON backorders(created_by);

-- 10. backorders.customer_id → customers (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_backorders_customer_id
  ON backorders(customer_id);

-- 11. learning_insights.agent_id (string-based, informational index)
CREATE INDEX IF NOT EXISTS idx_learning_insights_agent_id
  ON learning_insights(agent_id);

-- 12. prompt_variants.agent_id (string-based, informational index)
CREATE INDEX IF NOT EXISTS idx_prompt_variants_agent_id
  ON prompt_variants(agent_id);

-- 13. ap2_connections.user_id → users (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_ap2_connections_user_id
  ON ap2_connections(user_id);

-- 14. ap2_connections.organization_id → organizations (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_ap2_connections_organization_id
  ON ap2_connections(organization_id);

-- 15. approvals.requested_by → users (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by
  ON approvals(requested_by);

-- 16. approvals.entity_id (polymorphic, informational index)
CREATE INDEX IF NOT EXISTS idx_approvals_entity_id
  ON approvals(entity_id);

-- 17. approval_steps.approver_id → users (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_id
  ON approval_steps(approver_id);

-- 18. email_conversations.customer_id → customers (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_email_conversations_customer_id
  ON email_conversations(customer_id);

-- 19. email_conversations.assigned_to → users (MEDIUM priority)
CREATE INDEX IF NOT EXISTS idx_email_conversations_assigned_to
  ON email_conversations(assigned_to);

-- 20. email_messages.email_message_id → email_messages (MEDIUM priority, self-reference)
CREATE INDEX IF NOT EXISTS idx_email_messages_email_message_id
  ON email_messages(email_message_id);

-- 21. product_stock_by_location.last_counted_by → users (LOW priority)
CREATE INDEX IF NOT EXISTS idx_product_stock_by_location_last_counted_by
  ON product_stock_by_location(last_counted_by);

-- 22. stock_transfers.initiated_by → users (LOW priority)
CREATE INDEX IF NOT EXISTS idx_stock_transfers_initiated_by
  ON stock_transfers(initiated_by);

-- 23. stock_transfers.completed_by → users (LOW priority)
CREATE INDEX IF NOT EXISTS idx_stock_transfers_completed_by
  ON stock_transfers(completed_by);

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify updated_at columns were added
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('order_items', 'quote_items', 'submission_notes')
  AND column_name = 'updated_at'
ORDER BY table_name;

-- Verify all 23 indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%_organization_id'
   OR indexname LIKE 'idx_%_user_id'
   OR indexname LIKE 'idx_%_customer_id'
   OR indexname LIKE 'idx_%_created_by'
   OR indexname LIKE 'idx_%_initiated_by'
   OR indexname LIKE 'idx_%_completed_by'
   OR indexname LIKE 'idx_%_assigned_to'
   OR indexname LIKE 'idx_%_approver_id'
   OR indexname LIKE 'idx_%_requested_by'
   OR indexname LIKE 'idx_%_agent_id'
   OR indexname LIKE 'idx_%_entity_id'
   OR indexname LIKE 'idx_%_email_message_id'
   OR indexname LIKE 'idx_%_last_counted_by'
ORDER BY tablename, indexname;

-- Count total indexes added (should show 23)
SELECT COUNT(*) as total_new_indexes
FROM pg_indexes
WHERE indexname IN (
  'idx_users_organization_id',
  'idx_contractors_user_id',
  'idx_documents_user_id',
  'idx_products_organization_id',
  'idx_customers_organization_id',
  'idx_orders_organization_id',
  'idx_quotes_organization_id',
  'idx_containers_created_by',
  'idx_backorders_created_by',
  'idx_backorders_customer_id',
  'idx_learning_insights_agent_id',
  'idx_prompt_variants_agent_id',
  'idx_ap2_connections_user_id',
  'idx_ap2_connections_organization_id',
  'idx_approvals_requested_by',
  'idx_approvals_entity_id',
  'idx_approval_steps_approver_id',
  'idx_email_conversations_customer_id',
  'idx_email_conversations_assigned_to',
  'idx_email_messages_email_message_id',
  'idx_product_stock_by_location_last_counted_by',
  'idx_stock_transfers_initiated_by',
  'idx_stock_transfers_completed_by'
);

-- =============================================================================
-- PERFORMANCE IMPACT ANALYSIS
-- =============================================================================

-- Before running: Execute EXPLAIN ANALYZE on slow queries
-- After running: Re-run EXPLAIN ANALYZE to measure improvement
-- Expected: 20-50% reduction in query execution time for JOIN operations

-- Example test query (orders with customer data):
-- EXPLAIN ANALYZE
-- SELECT o.*, c.company_name
-- FROM orders o
-- JOIN customers c ON o.customer_id = c.id
-- WHERE c.organization_id = 'YOUR-ORG-UUID-HERE'
-- LIMIT 100;

-- =============================================================================
-- ROLLBACK SCRIPT (if needed)
-- =============================================================================

-- WARNING: Only use this if you need to rollback changes
--
-- -- Remove triggers
-- DROP TRIGGER IF EXISTS order_items_updated_at_trigger ON order_items;
-- DROP TRIGGER IF EXISTS quote_items_updated_at_trigger ON quote_items;
-- DROP TRIGGER IF EXISTS submission_notes_updated_at_trigger ON submission_notes;
--
-- -- Remove trigger functions
-- DROP FUNCTION IF EXISTS update_order_items_updated_at();
-- DROP FUNCTION IF EXISTS update_quote_items_updated_at();
-- DROP FUNCTION IF EXISTS update_submission_notes_updated_at();
--
-- -- Remove updated_at columns
-- ALTER TABLE order_items DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE quote_items DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE submission_notes DROP COLUMN IF EXISTS updated_at;
--
-- -- Remove indexes (all 23)
-- DROP INDEX IF EXISTS idx_users_organization_id;
-- DROP INDEX IF EXISTS idx_contractors_user_id;
-- DROP INDEX IF EXISTS idx_documents_user_id;
-- DROP INDEX IF EXISTS idx_products_organization_id;
-- DROP INDEX IF EXISTS idx_customers_organization_id;
-- DROP INDEX IF EXISTS idx_orders_organization_id;
-- DROP INDEX IF EXISTS idx_quotes_organization_id;
-- DROP INDEX IF EXISTS idx_containers_created_by;
-- DROP INDEX IF EXISTS idx_backorders_created_by;
-- DROP INDEX IF EXISTS idx_backorders_customer_id;
-- DROP INDEX IF EXISTS idx_learning_insights_agent_id;
-- DROP INDEX IF EXISTS idx_prompt_variants_agent_id;
-- DROP INDEX IF EXISTS idx_ap2_connections_user_id;
-- DROP INDEX IF EXISTS idx_ap2_connections_organization_id;
-- DROP INDEX IF EXISTS idx_approvals_requested_by;
-- DROP INDEX IF EXISTS idx_approvals_entity_id;
-- DROP INDEX IF EXISTS idx_approval_steps_approver_id;
-- DROP INDEX IF EXISTS idx_email_conversations_customer_id;
-- DROP INDEX IF EXISTS idx_email_conversations_assigned_to;
-- DROP INDEX IF EXISTS idx_email_messages_email_message_id;
-- DROP INDEX IF EXISTS idx_product_stock_by_location_last_counted_by;
-- DROP INDEX IF EXISTS idx_stock_transfers_initiated_by;
-- DROP INDEX IF EXISTS idx_stock_transfers_completed_by;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
