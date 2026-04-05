-- ============================================================
-- Rollback for Migration 001: Remove Search Indexes
-- Author: CCW ERP Team
-- Date: 2026-02-02
-- ============================================================

-- Drop trigram indexes
DROP INDEX IF EXISTS idx_customers_company_name_trgm;
DROP INDEX IF EXISTS idx_customers_contact_name_trgm;
DROP INDEX IF EXISTS idx_customers_email_trgm;
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_sku_trgm;
DROP INDEX IF EXISTS idx_products_description_trgm;

-- Drop B-tree indexes
DROP INDEX IF EXISTS idx_orders_customer_id;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_order_date;
DROP INDEX IF EXISTS idx_order_items_order_id;
DROP INDEX IF EXISTS idx_order_items_product_id;
DROP INDEX IF EXISTS idx_quotes_customer_id;
DROP INDEX IF EXISTS idx_quotes_status;
DROP INDEX IF EXISTS idx_quotes_quote_date;
DROP INDEX IF EXISTS idx_quote_items_quote_id;
DROP INDEX IF EXISTS idx_quote_items_product_id;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_is_active;
DROP INDEX IF EXISTS idx_customers_is_active;

-- Drop composite indexes
DROP INDEX IF EXISTS idx_orders_customer_status;
DROP INDEX IF EXISTS idx_products_category_active;

-- Verify rollback
SELECT
    'Rollback completed' AS status,
    COUNT(*) AS remaining_indexes
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';
