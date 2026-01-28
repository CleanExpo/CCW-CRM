-- Migration: Add Search Performance Indexes
-- Created: 2026-01-28
-- Purpose: Improve search performance by 70%+ with trigram and B-tree indexes
-- Expected Impact: Customer search 3,500ms → <1,000ms, Product search 1,700ms → <800ms

-- Enable pg_trgm extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- TRIGRAM INDEXES FOR WILDCARD SEARCH
-- ============================================================
-- These enable fast ILIKE '%search%' queries (wildcard search)
-- Performance improvement: 50-80% reduction in query time

-- Products
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
    ON products USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
    ON products USING gin (description gin_trgm_ops);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_company_trgm
    ON customers USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_contact_trgm
    ON customers USING gin (contact_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
    ON customers USING gin (email gin_trgm_ops);

-- ============================================================
-- B-TREE INDEXES FOR FOREIGN KEYS AND COMMON FILTERS
-- ============================================================
-- These speed up JOIN operations and WHERE clauses

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
    ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_order_date
    ON orders(order_date DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON orders(created_at DESC);

-- Quotes
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id
    ON quotes(customer_id);

CREATE INDEX IF NOT EXISTS idx_quotes_status
    ON quotes(status);

CREATE INDEX IF NOT EXISTS idx_quotes_quote_date
    ON quotes(quote_date DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_valid_until
    ON quotes(valid_until DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_created_at
    ON quotes(created_at DESC);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON order_items(product_id);

-- Quote Items
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id
    ON quote_items(quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_items_product_id
    ON quote_items(product_id);

-- Products (additional filters)
CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category);

CREATE INDEX IF NOT EXISTS idx_products_is_active
    ON products(is_active);

-- Customers (additional filters)
CREATE INDEX IF NOT EXISTS idx_customers_is_active
    ON customers(is_active);

CREATE INDEX IF NOT EXISTS idx_customers_state
    ON customers(state);

-- ============================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================
-- These optimize frequently combined filters

-- Products: Active items by category
CREATE INDEX IF NOT EXISTS idx_products_category_active
    ON products(category, is_active)
    WHERE is_active = true;

-- Orders: Status and date (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_orders_status_date
    ON orders(status, order_date DESC);

-- Quotes: Status and validity (for expiring quotes report)
CREATE INDEX IF NOT EXISTS idx_quotes_status_valid
    ON quotes(status, valid_until DESC)
    WHERE status IN ('sent', 'pending');

-- Customers: Active customers by state
CREATE INDEX IF NOT EXISTS idx_customers_active_state
    ON customers(is_active, state)
    WHERE is_active = true;

-- ============================================================
-- ANALYZE TABLES TO UPDATE QUERY PLANNER STATISTICS
-- ============================================================
-- This helps PostgreSQL make better decisions about query execution plans

ANALYZE products;
ANALYZE customers;
ANALYZE orders;
ANALYZE quotes;
ANALYZE order_items;
ANALYZE quote_items;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these to verify indexes were created successfully

-- Check trigram extension
-- SELECT * FROM pg_extension WHERE extname = 'pg_trgm';

-- Check all indexes on products table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'products' ORDER BY indexname;

-- Check all indexes on customers table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers' ORDER BY indexname;

-- Test search performance (before/after comparison)
-- EXPLAIN ANALYZE SELECT * FROM products WHERE name ILIKE '%drill%';
-- EXPLAIN ANALYZE SELECT * FROM customers WHERE company_name ILIKE '%equipment%';

-- ============================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================
/*
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_sku_trgm;
DROP INDEX IF EXISTS idx_products_description_trgm;
DROP INDEX IF EXISTS idx_customers_company_trgm;
DROP INDEX IF EXISTS idx_customers_contact_trgm;
DROP INDEX IF EXISTS idx_customers_email_trgm;
DROP INDEX IF EXISTS idx_orders_customer_id;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_order_date;
DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_quotes_customer_id;
DROP INDEX IF EXISTS idx_quotes_status;
DROP INDEX IF EXISTS idx_quotes_quote_date;
DROP INDEX IF EXISTS idx_quotes_valid_until;
DROP INDEX IF EXISTS idx_quotes_created_at;
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP INDEX IF EXISTS idx_order_items_product_id;
DROP INDEX IF EXISTS idx_quote_items_quote_id;
DROP INDEX IF EXISTS idx_quote_items_product_id;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_is_active;
DROP INDEX IF EXISTS idx_customers_is_active;
DROP INDEX IF EXISTS idx_customers_state;
DROP INDEX IF EXISTS idx_products_category_active;
DROP INDEX IF EXISTS idx_orders_status_date;
DROP INDEX IF EXISTS idx_quotes_status_valid;
DROP INDEX IF EXISTS idx_customers_active_state;
*/

-- ============================================================
-- END OF MIGRATION
-- ============================================================

-- Expected database size increase: ~100-200MB for indexes
-- Expected query performance improvement:
--   - Customer wildcard search: 3,500ms → <1,000ms (71% improvement)
--   - Product wildcard search: 1,700ms → <800ms (53% improvement)
--   - Order lookups by customer: 50% faster
--   - Quote filtering by status: 60% faster
