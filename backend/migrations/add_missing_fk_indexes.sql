-- Migration: Add Missing Foreign Key Indexes
-- Issue: ISS-007 - Optimize Foreign Key Indexes
-- Date: 2026-02-11
--
-- Purpose: Add B-tree indexes on foreign key columns that are currently unindexed
--
-- Performance Impact:
--   - Faster JOIN operations on FK columns
--   - Improved referential integrity checking
--   - Reduced query planning time
--   - Better performance for DELETE CASCADE operations
--
-- Technical Details:
--   - B-tree indexes are optimal for equality and range queries on FK columns
--   - FK indexes speed up parent-child relationship queries
--   - Critical for DELETE operations (prevents table scans on child tables)
--
-- Analysis Results:
--   - Total FK columns in database: 64
--   - FK columns already indexed: 60
--   - FK columns missing indexes: 4
--     1. purchase_orders.created_by_id
--     2. translation_queue.target_language
--     3. invoices.created_by
--     4. invoice_payments.created_by

-- ============================================================================
-- VERIFICATION: Core FK Indexes from ISS-007 Scope (Already Exist)
-- ============================================================================

-- orders.customer_id: ✅ Has ix_orders_customer_id
-- order_items.order_id: ✅ Has idx_order_items_order_product (composite)
-- order_items.product_id: ✅ Has idx_order_items_order_product (composite)
-- quotes.customer_id: ✅ Has ix_quotes_customer_id
-- quote_items.quote_id: ✅ Has idx_quote_items_quote_product (composite)
-- quote_items.product_id: ✅ Has idx_quote_items_quote_product (composite)

-- ============================================================================
-- ADD MISSING FK INDEXES (4 indexes)
-- ============================================================================

-- Index 1: purchase_orders.created_by_id → users.id
-- Improves: Queries filtering/joining purchase orders by creator
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_orders_created_by
    ON purchase_orders (created_by_id);

COMMENT ON INDEX idx_purchase_orders_created_by IS
'B-tree index on FK purchase_orders.created_by_id → users.id. Optimizes queries filtering purchase orders by creator and speeds up DELETE CASCADE operations on users table.';

-- Index 2: translation_queue.target_language → languages.code
-- Improves: Queries filtering translations by target language
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_translation_queue_target_language
    ON translation_queue (target_language);

COMMENT ON INDEX idx_translation_queue_target_language IS
'B-tree index on FK translation_queue.target_language → languages.code. Optimizes queries filtering translation jobs by target language and improves translation queue processing performance.';

-- Index 3: invoices.created_by → users.id
-- Improves: Queries filtering/joining invoices by creator
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_created_by
    ON invoices (created_by);

COMMENT ON INDEX idx_invoices_created_by IS
'B-tree index on FK invoices.created_by → users.id. Optimizes queries filtering invoices by creator and speeds up DELETE CASCADE operations on users table.';

-- Index 4: invoice_payments.created_by → users.id
-- Improves: Queries filtering/joining invoice payments by creator
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_payments_created_by
    ON invoice_payments (created_by);

COMMENT ON INDEX idx_invoice_payments_created_by IS
'B-tree index on FK invoice_payments.created_by → users.id. Optimizes queries filtering invoice payments by creator and speeds up DELETE CASCADE operations on users table.';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check all 4 new indexes were created:
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE indexname IN (
--     'idx_purchase_orders_created_by',
--     'idx_translation_queue_target_language',
--     'idx_invoices_created_by',
--     'idx_invoice_payments_created_by'
-- );

-- Check index sizes:
-- SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
-- FROM pg_indexes
-- WHERE indexname IN (
--     'idx_purchase_orders_created_by',
--     'idx_translation_queue_target_language',
--     'idx_invoices_created_by',
--     'idx_invoice_payments_created_by'
-- );

-- Verify no FK columns are missing indexes:
-- SELECT c.conrelid::regclass AS table_name,
--        a.attname AS column_name
-- FROM pg_constraint c
-- JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
-- WHERE c.contype = 'f'
--   AND connamespace = 'public'::regnamespace
--   AND NOT EXISTS (
--       SELECT 1 FROM pg_index i
--       WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
--   )
-- ORDER BY table_name, column_name;
-- Expected result: 0 rows (all FK columns now indexed)

-- ============================================================================
-- Performance Testing
-- ============================================================================

-- Test purchase_orders by creator query:
-- EXPLAIN ANALYZE
-- SELECT * FROM purchase_orders WHERE created_by_id = '<some_uuid>';

-- Test translation queue by language:
-- EXPLAIN ANALYZE
-- SELECT * FROM translation_queue WHERE target_language = 'es';

-- Test invoices by creator:
-- EXPLAIN ANALYZE
-- SELECT * FROM invoices WHERE created_by = '<some_uuid>';

-- Test invoice_payments by creator:
-- EXPLAIN ANALYZE
-- SELECT * FROM invoice_payments WHERE created_by = '<some_uuid>';

-- ============================================================================
-- NOTES
-- ============================================================================
-- Why FK indexes matter:
-- 1. **JOIN Performance**: FKs are almost always used in JOINs, indexes make this fast
-- 2. **Referential Integrity**: Checking FK constraints is faster with indexes
-- 3. **DELETE Performance**: When deleting parent row, DB must check/cascade to children
--    Without index: Full table scan on child table
--    With index: Fast index lookup
-- 4. **Query Planning**: Query planner can make better decisions with FK indexes
--
-- CREATE INDEX CONCURRENTLY:
-- - Does not block table writes during creation
-- - Essential for production systems
-- - Takes longer but allows normal operations
--
-- Index maintenance:
-- - Automatically updated on INSERT/UPDATE/DELETE
-- - Monitor with: SELECT * FROM pg_stat_user_indexes WHERE indexrelname LIKE 'idx_%';
