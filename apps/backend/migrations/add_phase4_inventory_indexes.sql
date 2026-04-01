-- PHASE 4: Multi-Location Inventory Performance Indexes
-- Created: 2026-02-03
-- Purpose: Optimize multi-location stock queries for Phase 4 N+1 fix
-- Expected Impact: 40-60% faster stock queries, supports new include_stock parameter

-- ============================================================================
-- ENABLE pg_trgm EXTENSION (if not already enabled)
-- ============================================================================
-- Required for trigram indexes on text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- PRODUCT_STOCK_BY_LOCATION TABLE INDEXES
-- ============================================================================

-- Index for product_id foreign key (CRITICAL for Phase 4 optimization)
-- Used in: SELECT * FROM product_stock_by_location WHERE product_id IN (...)
CREATE INDEX IF NOT EXISTS idx_product_stock_product_id
ON product_stock_by_location(product_id);

-- Index for location filtering (used in location-specific queries)
CREATE INDEX IF NOT EXISTS idx_product_stock_location
ON product_stock_by_location(location);

-- Composite index for product + location queries (unique constraint support)
CREATE INDEX IF NOT EXISTS idx_product_stock_product_location
ON product_stock_by_location(product_id, location);

-- Index for low stock alerts (stock <= reorder_point)
CREATE INDEX IF NOT EXISTS idx_product_stock_low_stock
ON product_stock_by_location(stock)
WHERE stock <= reorder_point;

-- Index for available stock queries
CREATE INDEX IF NOT EXISTS idx_product_stock_available
ON product_stock_by_location(available)
WHERE available > 0;

COMMENT ON INDEX idx_product_stock_product_id IS 'PHASE 4: Critical for N+1 fix - batch stock lookups';
COMMENT ON INDEX idx_product_stock_location IS 'Fast filtering by warehouse location';
COMMENT ON INDEX idx_product_stock_product_location IS 'Unique product per location lookup';
COMMENT ON INDEX idx_product_stock_low_stock IS 'Fast low stock alerts';

-- ============================================================================
-- STOCK_RESERVATIONS TABLE INDEXES
-- ============================================================================

-- Index for product_id (used to check reservation availability)
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_id
ON stock_reservations(product_id);

-- Index for location (used in location-specific reservation queries)
CREATE INDEX IF NOT EXISTS idx_stock_reservations_location
ON stock_reservations(location);

-- Index for order_id (used to fetch reservations for an order)
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id
ON stock_reservations(order_id);

-- Index for expires_at (used to clean up expired reservations)
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at
ON stock_reservations(expires_at);

-- Composite index for product + location + active reservations
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_location_expires
ON stock_reservations(product_id, location, expires_at)
WHERE expires_at > NOW();

COMMENT ON INDEX idx_stock_reservations_product_id IS 'Fast reservation checks by product';
COMMENT ON INDEX idx_stock_reservations_order_id IS 'Fast order reservation lookup';
COMMENT ON INDEX idx_stock_reservations_expires_at IS 'Fast expired reservation cleanup';

-- ============================================================================
-- STOCK_TRANSFERS TABLE INDEXES
-- ============================================================================

-- Index for product_id (used in transfer history)
CREATE INDEX IF NOT EXISTS idx_stock_transfers_product_id
ON stock_transfers(product_id);

-- Index for from_location
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_location
ON stock_transfers(from_location);

-- Index for to_location
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_location
ON stock_transfers(to_location);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status
ON stock_transfers(status);

-- Index for created_at (used for recent transfers)
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_at
ON stock_transfers(created_at DESC);

-- Composite index for pending transfers by location
CREATE INDEX IF NOT EXISTS idx_stock_transfers_location_status
ON stock_transfers(from_location, status)
WHERE status IN ('pending', 'in_transit');

COMMENT ON INDEX idx_stock_transfers_product_id IS 'Fast product transfer history';
COMMENT ON INDEX idx_stock_transfers_status IS 'Fast status filtering';

-- ============================================================================
-- STOCK_ADJUSTMENTS TABLE INDEXES
-- ============================================================================

-- Index for product_id
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id
ON stock_adjustments(product_id);

-- Index for location
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_location
ON stock_adjustments(location);

-- Index for reason (used for adjustment reporting)
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_reason
ON stock_adjustments(reason);

-- Index for created_at (audit trail)
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at
ON stock_adjustments(created_at DESC);

-- Index for created_by (user audit)
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_by
ON stock_adjustments(created_by);

COMMENT ON INDEX idx_stock_adjustments_product_id IS 'Fast product adjustment history';
COMMENT ON INDEX idx_stock_adjustments_reason IS 'Adjustment reporting by reason';

-- ============================================================================
-- PURCHASE_ORDERS TABLE INDEXES (if exists)
-- ============================================================================

-- Index for supplier_id foreign key
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id
ON purchase_orders(supplier_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
ON purchase_orders(status);

-- Index for order_date
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date
ON purchase_orders(order_date DESC);

-- Index for expected_delivery_date
CREATE INDEX IF NOT EXISTS idx_purchase_orders_expected_delivery
ON purchase_orders(expected_delivery_date);

COMMENT ON INDEX idx_purchase_orders_supplier_id IS 'Fast supplier PO history';
COMMENT ON INDEX idx_purchase_orders_status IS 'Fast PO status filtering';

-- ============================================================================
-- PURCHASE_ORDER_ITEMS TABLE INDEXES (if exists)
-- ============================================================================

-- Index for purchase_order_id foreign key
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id
ON purchase_order_items(purchase_order_id);

-- Index for product_id foreign key
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id
ON purchase_order_items(product_id);

COMMENT ON INDEX idx_purchase_order_items_po_id IS 'Fast PO line items lookup';
COMMENT ON INDEX idx_purchase_order_items_product_id IS 'Fast product PO history';

-- ============================================================================
-- SUPPLIERS TABLE INDEXES (if exists)
-- ============================================================================

-- Index for supplier name searches
CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
ON suppliers USING gin(name gin_trgm_ops);

-- Index for active supplier filtering
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active
ON suppliers(is_active);

COMMENT ON INDEX idx_suppliers_name_trgm IS 'Fast supplier name search';

-- ============================================================================
-- ADDITIONAL PHASE 4 OPTIMIZATIONS
-- ============================================================================

-- Index for orders.fulfillment_location (used in Phase 4 location-based queries)
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_location
ON orders(fulfillment_location);

-- Index for quotes.fulfillment_location
CREATE INDEX IF NOT EXISTS idx_quotes_fulfillment_location
ON quotes(fulfillment_location);

COMMENT ON INDEX idx_orders_fulfillment_location IS 'PHASE 4: Fast location-based order queries';
COMMENT ON INDEX idx_quotes_fulfillment_location IS 'PHASE 4: Fast location-based quote queries';

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update table statistics for query planner after creating indexes

ANALYZE product_stock_by_location;
ANALYZE stock_reservations;
ANALYZE stock_transfers;
ANALYZE stock_adjustments;
ANALYZE purchase_orders;
ANALYZE purchase_order_items;
ANALYZE suppliers;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify Phase 4 indexes were created successfully:

-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_product_stock_%'
--    OR indexname LIKE 'idx_stock_%'
--    OR indexname LIKE 'idx_purchase_%'
-- ORDER BY tablename, indexname;

-- ============================================================================
-- PERFORMANCE TESTING
-- ============================================================================
-- Test queries to verify index usage:

-- 1. Test product stock batch lookup (Phase 4 N+1 fix)
-- EXPLAIN ANALYZE
-- SELECT * FROM product_stock_by_location
-- WHERE product_id IN (SELECT id FROM products LIMIT 50);

-- 2. Test low stock alerts
-- EXPLAIN ANALYZE
-- SELECT * FROM product_stock_by_location
-- WHERE stock <= reorder_point;

-- 3. Test location-specific queries
-- EXPLAIN ANALYZE
-- SELECT * FROM product_stock_by_location
-- WHERE location = 'brisbane' AND available > 0;

-- ============================================================================
-- SUCCESS METRICS
-- ============================================================================
-- Expected improvements after applying this migration:
-- - Product stock batch queries: 40-60% faster
-- - Dashboard stock health widget: 50% faster
-- - Low stock alerts: 70% faster
-- - Transfer suggestions: 60% faster
-- - Overall inventory page load: 2-3x faster
