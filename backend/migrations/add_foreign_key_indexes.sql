-- Migration: Add B-tree indexes on foreign key columns for faster JOINs
-- ISS-007: Optimize Foreign Key Indexes
-- Expected improvement: 40% faster queries with JOINs, better query planning

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
-- Index on customer_id for fast customer->orders lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
    ON orders (customer_id);

-- Index on organization_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_orders_organization_id
    ON orders (organization_id);

-- Composite index for common query patterns (status + date filtering)
CREATE INDEX IF NOT EXISTS idx_orders_status_date
    ON orders (status, order_date DESC);

-- Index for date-based queries (recent orders, reporting)
CREATE INDEX IF NOT EXISTS idx_orders_order_date
    ON orders (order_date DESC);

-- ============================================================================
-- ORDER_ITEMS TABLE
-- ============================================================================
-- Index on order_id for fast order->items lookups (most critical)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items (order_id);

-- Index on product_id for product->orders lookups, inventory queries
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON order_items (product_id);

-- Composite index for order items with product details
CREATE INDEX IF NOT EXISTS idx_order_items_order_product
    ON order_items (order_id, product_id);

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================
-- Index on customer_id for fast customer->quotes lookups
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id
    ON quotes (customer_id);

-- Index on organization_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id
    ON quotes (organization_id);

-- Composite index for common query patterns (status + date filtering)
CREATE INDEX IF NOT EXISTS idx_quotes_status_date
    ON quotes (status, quote_date DESC);

-- Index for date-based queries and expiration checking
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until
    ON quotes (valid_until);

-- ============================================================================
-- QUOTE_ITEMS TABLE
-- ============================================================================
-- Index on quote_id for fast quote->items lookups (most critical)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id
    ON quote_items (quote_id);

-- Index on product_id for product->quotes lookups
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id
    ON quote_items (product_id);

-- Composite index for quote items with product details
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_product
    ON quote_items (quote_id, product_id);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
-- Index on organization_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_products_organization_id
    ON products (organization_id);

-- Index on category for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (category);

-- Composite index for active products by category
CREATE INDEX IF NOT EXISTS idx_products_category_active
    ON products (category, is_active) WHERE is_active = true;

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
-- Index on organization_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_customers_organization_id
    ON customers (organization_id);

-- Composite index for active customers
CREATE INDEX IF NOT EXISTS idx_customers_active
    ON customers (is_active) WHERE is_active = true;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check all indexes on orders and related tables
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename IN ('orders', 'order_items', 'quotes', 'quote_items', 'products', 'customers')
    AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Check for foreign keys without indexes (potential performance issues)
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_indexes
            WHERE tablename = tc.table_name
                AND indexdef LIKE '%' || kcu.column_name || '%'
        ) THEN 'INDEXED'
        ELSE 'MISSING INDEX'
    END AS index_status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('orders', 'order_items', 'quotes', 'quote_items', 'products', 'customers')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- NOTES
-- ============================================================================
-- B-tree indexes are optimal for:
-- - Foreign key lookups (JOINs)
-- - Equality comparisons (WHERE customer_id = ?)
-- - Range queries (WHERE order_date > ?)
-- - Sorting (ORDER BY date DESC)
--
-- Composite indexes benefit queries that filter on multiple columns:
-- - (status, order_date) speeds up: WHERE status = ? ORDER BY order_date DESC
-- - (order_id, product_id) speeds up: WHERE order_id = ? AND product_id = ?
--
-- Partial indexes (WHERE is_active = true) are smaller and faster for filtered queries
--
-- Index maintenance:
-- - Automatically updated on INSERT/UPDATE/DELETE
-- - Monitor usage: SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
-- - Unused indexes can be dropped to save space and improve write performance
