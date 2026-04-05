-- ============================================================
-- Migration 001: Add Search Performance Indexes
-- Author: CCW ERP Team
-- Date: 2026-02-02
-- Objective: Improve search operations by 50-70%
-- Target: Customer search 3,500ms → <1,000ms
--         Product search 1,700ms → <800ms
-- ============================================================

-- Enable pg_trgm extension for trigram similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- TRIGRAM INDEXES (for ILIKE '%search%' queries)
-- ============================================================

-- Customer search indexes
CREATE INDEX IF NOT EXISTS idx_customers_company_name_trgm
ON customers USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_contact_name_trgm
ON customers USING gin (contact_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
ON customers USING gin (email gin_trgm_ops);

-- Product search indexes
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
ON products USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
ON products USING gin (description gin_trgm_ops);

-- ============================================================
-- B-TREE INDEXES (for foreign keys and filtering)
-- ============================================================

-- Order relationships
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Quote relationships
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes(quote_date);

-- Quote items
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id);

-- Product filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Customer filtering
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- ============================================================
-- COMPOSITE INDEXES (for common query patterns)
-- ============================================================

-- Orders filtered by customer + status
CREATE INDEX IF NOT EXISTS idx_orders_customer_status
ON orders(customer_id, status);

-- Products filtered by category + active status
CREATE INDEX IF NOT EXISTS idx_products_category_active
ON products(category, is_active);

-- ============================================================
-- ANALYZE TABLES (update statistics for query planner)
-- ============================================================

ANALYZE customers;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE quotes;
ANALYZE quote_items;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Summary
SELECT
    'Migration 001 completed successfully' AS status,
    COUNT(*) AS indexes_created
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';
