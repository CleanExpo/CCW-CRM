-- Migration: Add PostgreSQL pg_trgm extension and trigram indexes for fast wildcard searches
-- ISS-006: Add PostgreSQL Trigram Indexes
-- Expected improvement: Customer search 3500ms → <1000ms, Product search 1700ms → <500ms

-- Enable pg_trgm extension for trigram-based similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- ============================================================================
-- CUSTOMER INDEXES
-- ============================================================================
-- Drop existing indexes if they exist (for idempotency)
DROP INDEX IF EXISTS idx_customers_company_name_trgm;
DROP INDEX IF EXISTS idx_customers_contact_name_trgm;
DROP INDEX IF EXISTS idx_customers_customer_number_trgm;
DROP INDEX IF EXISTS idx_customers_email_trgm;

-- Create trigram indexes for customer search fields
-- These indexes enable fast ILIKE '%pattern%' searches
CREATE INDEX idx_customers_company_name_trgm
    ON customers USING gin (company_name gin_trgm_ops);

CREATE INDEX idx_customers_contact_name_trgm
    ON customers USING gin (contact_name gin_trgm_ops);

CREATE INDEX idx_customers_customer_number_trgm
    ON customers USING gin (customer_number gin_trgm_ops);

CREATE INDEX idx_customers_email_trgm
    ON customers USING gin (email gin_trgm_ops);

-- ============================================================================
-- PRODUCT INDEXES
-- ============================================================================
-- Drop existing indexes if they exist (for idempotency)
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_sku_trgm;
DROP INDEX IF EXISTS idx_products_description_trgm;

-- Create trigram indexes for product search fields
CREATE INDEX idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

CREATE INDEX idx_products_sku_trgm
    ON products USING gin (sku gin_trgm_ops);

CREATE INDEX idx_products_description_trgm
    ON products USING gin (description gin_trgm_ops);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check that all indexes were created successfully
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE '%_trgm'
ORDER BY tablename, indexname;

-- Check index sizes (should be reasonable, not too large)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE indexname LIKE '%_trgm'
ORDER BY tablename, indexname;

-- ============================================================================
-- PERFORMANCE TEST QUERIES
-- ============================================================================
-- Test customer search performance (before: ~3500ms, after: <1000ms)
-- EXPLAIN ANALYZE
-- SELECT * FROM customers
-- WHERE company_name ILIKE '%construction%'
--    OR contact_name ILIKE '%construction%'
--    OR customer_number ILIKE '%construction%'
--    OR email ILIKE '%construction%';

-- Test product search performance (before: ~1700ms, after: <500ms)
-- EXPLAIN ANALYZE
-- SELECT * FROM products
-- WHERE name ILIKE '%drill%'
--    OR sku ILIKE '%drill%'
--    OR description ILIKE '%drill%';

-- ============================================================================
-- NOTES
-- ============================================================================
-- GIN (Generalized Inverted Index) is used instead of GiST because:
-- - GIN is faster for queries (but slower for inserts/updates)
-- - Better for mostly read-heavy workloads (which applies to search)
-- - More accurate results for similarity searches
--
-- The gin_trgm_ops operator class enables:
-- - Fast ILIKE '%pattern%' searches
-- - Similarity searches (pg_trgm provides similarity() function)
-- - Case-insensitive pattern matching
--
-- Index maintenance:
-- - Automatically updated on INSERT/UPDATE/DELETE
-- - May need occasional REINDEX if performance degrades
-- - Monitor with: SELECT * FROM pg_stat_user_indexes WHERE indexrelname LIKE '%_trgm';
