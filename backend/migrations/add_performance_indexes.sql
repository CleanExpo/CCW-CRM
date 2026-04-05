-- Performance Optimization: Add Database Indexes
-- Created: 2026-01-18
-- Purpose: Improve query performance identified in load testing
-- Expected Impact: 50-80% reduction in response times for list and lookup operations

-- ============================================================================
-- PRODUCTS TABLE INDEXES
-- ============================================================================

-- Index for SKU lookups (frequently used for product identification)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Index for category filtering (used in product lists)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Index for active product filtering
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Composite index for category + active filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, is_active);

-- Index for name searches (used with ILIKE in search)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

COMMENT ON INDEX idx_products_sku IS 'Fast SKU lookups for product identification';
COMMENT ON INDEX idx_products_category IS 'Fast filtering by product category';
COMMENT ON INDEX idx_products_category_active IS 'Composite index for category + active queries';

-- ============================================================================
-- CUSTOMERS TABLE INDEXES
-- ============================================================================

-- Index for customer number lookups (unique identifier)
CREATE INDEX IF NOT EXISTS idx_customers_customer_number ON customers(customer_number);

-- Index for email lookups (used in authentication and user search)
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Index for active customer filtering
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

-- Index for company name searches
CREATE INDEX IF NOT EXISTS idx_customers_company_name_trgm ON customers USING gin(company_name gin_trgm_ops);

COMMENT ON INDEX idx_customers_customer_number IS 'Fast customer number lookups';
COMMENT ON INDEX idx_customers_email IS 'Fast email lookups for authentication';

-- ============================================================================
-- ORDERS TABLE INDEXES
-- ============================================================================

-- Index for order number lookups (unique identifier)
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Index for customer foreign key (used in customer order history)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Index for status filtering (used in order lists)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Index for order date sorting and filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date DESC);

-- Composite index for customer + status queries (common pattern)
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(customer_id, status);

-- Composite index for date range queries with status
CREATE INDEX IF NOT EXISTS idx_orders_date_status ON orders(order_date DESC, status);

COMMENT ON INDEX idx_orders_order_number IS 'Fast order number lookups';
COMMENT ON INDEX idx_orders_customer_id IS 'Fast customer order history queries';
COMMENT ON INDEX idx_orders_status IS 'Fast status filtering for order lists';

-- ============================================================================
-- ORDER ITEMS TABLE INDEXES
-- ============================================================================

-- Index for order foreign key (used to fetch order line items)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Index for product foreign key (used for product sales history)
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Composite index for order + product queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);

COMMENT ON INDEX idx_order_items_order_id IS 'Fast order line items lookup';
COMMENT ON INDEX idx_order_items_product_id IS 'Fast product sales history';

-- ============================================================================
-- QUOTES TABLE INDEXES
-- ============================================================================

-- Index for quote number lookups (unique identifier)
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);

-- Index for customer foreign key (used in customer quote history)
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);

-- Index for status filtering (used in quote lists)
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- Index for quote date sorting and filtering
CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes(quote_date DESC);

-- Index for valid_until date (used for expiring quotes)
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);

-- Composite index for customer + status queries
CREATE INDEX IF NOT EXISTS idx_quotes_customer_status ON quotes(customer_id, status);

COMMENT ON INDEX idx_quotes_quote_number IS 'Fast quote number lookups';
COMMENT ON INDEX idx_quotes_customer_id IS 'Fast customer quote history';
COMMENT ON INDEX idx_quotes_status IS 'Fast status filtering for quote lists';

-- ============================================================================
-- QUOTE ITEMS TABLE INDEXES
-- ============================================================================

-- Index for quote foreign key (used to fetch quote line items)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- Index for product foreign key (used for product quote history)
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id);

-- Composite index for quote + product queries
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_product ON quote_items(quote_id, product_id);

COMMENT ON INDEX idx_quote_items_quote_id IS 'Fast quote line items lookup';
COMMENT ON INDEX idx_quote_items_product_id IS 'Fast product quote history';

-- ============================================================================
-- USERS TABLE INDEXES (if not already present)
-- ============================================================================

-- Index for email lookups (authentication)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index for organization foreign key
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

-- Index for active user filtering
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

COMMENT ON INDEX idx_users_email IS 'Fast email lookups for authentication';

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update table statistics for query planner after creating indexes

ANALYZE products;
ANALYZE customers;
ANALYZE orders;
ANALYZE order_items;
ANALYZE quotes;
ANALYZE quote_items;
ANALYZE users;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify indexes were created successfully:

-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- To remove all indexes created by this migration:

-- DROP INDEX IF EXISTS idx_products_sku;
-- DROP INDEX IF EXISTS idx_products_category;
-- DROP INDEX IF EXISTS idx_products_is_active;
-- DROP INDEX IF EXISTS idx_products_category_active;
-- DROP INDEX IF EXISTS idx_products_name_trgm;
-- DROP INDEX IF EXISTS idx_customers_customer_number;
-- DROP INDEX IF EXISTS idx_customers_email;
-- DROP INDEX IF EXISTS idx_customers_is_active;
-- DROP INDEX IF EXISTS idx_customers_company_name_trgm;
-- DROP INDEX IF EXISTS idx_orders_order_number;
-- DROP INDEX IF EXISTS idx_orders_customer_id;
-- DROP INDEX IF EXISTS idx_orders_status;
-- DROP INDEX IF EXISTS idx_orders_order_date;
-- DROP INDEX IF EXISTS idx_orders_customer_status;
-- DROP INDEX IF EXISTS idx_orders_date_status;
-- DROP INDEX IF EXISTS idx_order_items_order_id;
-- DROP INDEX IF EXISTS idx_order_items_product_id;
-- DROP INDEX IF EXISTS idx_order_items_order_product;
-- DROP INDEX IF EXISTS idx_quotes_quote_number;
-- DROP INDEX IF EXISTS idx_quotes_customer_id;
-- DROP INDEX IF EXISTS idx_quotes_status;
-- DROP INDEX IF EXISTS idx_quotes_quote_date;
-- DROP INDEX IF EXISTS idx_quotes_valid_until;
-- DROP INDEX IF EXISTS idx_quotes_customer_status;
-- DROP INDEX IF EXISTS idx_quote_items_quote_id;
-- DROP INDEX IF EXISTS idx_quote_items_product_id;
-- DROP INDEX IF EXISTS idx_quote_items_quote_product;
-- DROP INDEX IF EXISTS idx_users_email;
-- DROP INDEX IF EXISTS idx_users_organization_id;
-- DROP INDEX IF EXISTS idx_users_is_active;
