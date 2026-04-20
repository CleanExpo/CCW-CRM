#!/bin/bash

################################################################################
# Database Query Performance Verification Script
#
# Purpose: Verify database query performance tuning for CCW-Online ERP
# Issue: ISS-017 - Database Query Performance Tuning
# Version: 1.0
# Date: 2026-02-02
#
# Usage:
#   ./scripts/verify-query-performance.sh [options]
#
# Options:
#   DB_HOST       Database host (default: localhost)
#   DB_PORT       Database port (default: 5432)
#   DB_NAME       Database name (default: starter_db)
#   DB_USER       Database user (default: starter_user)
#   DB_PASSWORD   Database password
#
# Examples:
#   # Default configuration
#   ./scripts/verify-query-performance.sh
#
#   # Custom database
#   DB_NAME=ccw_production ./scripts/verify-query-performance.sh
#
# Exit Codes:
#   0 - All checks passed (or warnings only)
#   1 - One or more checks failed
################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Configuration — defaults are LOCAL DEV ONLY.
# Override via DB_HOST / DB_PASSWORD env vars for any non-localhost target.
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-starter_db}"
DB_USER="${DB_USER:-starter_user}"
DB_PASSWORD="${DB_PASSWORD:-local_dev_password}"

# Refuse to run the default dev password against a non-local host
if [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_PASSWORD" = "local_dev_password" ]; then
    echo "ERROR: DB_HOST is '$DB_HOST' but DB_PASSWORD is still the local dev default."
    echo "       Set DB_PASSWORD explicitly before running against a non-local database."
    exit 1
fi

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo "========================================"
    echo "$1"
    echo "========================================"
}

# Function to execute PostgreSQL query
execute_query() {
    local query="$1"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$query" 2>/dev/null || echo ""
}

# Function to check if PostgreSQL is accessible
check_db_connection() {
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

################################################################################
# Main Verification
################################################################################

echo "================================================================================"
echo "  DATABASE QUERY PERFORMANCE VERIFICATION"
echo "================================================================================"
echo ""
info "Checking database query performance tuning for CCW-Online ERP"
info "Database: $DB_NAME@$DB_HOST:$DB_PORT"
echo ""

################################################################################
# 1. PostgreSQL Connection
################################################################################
section "1. PostgreSQL Connection"

if command -v psql >/dev/null 2>&1; then
    pass "psql command available"
else
    fail "psql command not found (install postgresql-client)"
fi

if check_db_connection; then
    pass "Database connection successful"
else
    fail "Cannot connect to database $DB_NAME@$DB_HOST:$DB_PORT"
    warn "Remaining checks will be skipped"
    echo ""
    echo "================================================================================"
    echo "  VERIFICATION SUMMARY"
    echo "================================================================================"
    echo -e "✓ Passed:   ${GREEN}$PASSED${NC}"
    echo -e "⚠ Warnings: ${YELLOW}$WARNINGS${NC}"
    echo -e "✗ Failed:   ${RED}$FAILED${NC}"
    echo ""
    exit 1
fi

################################################################################
# 2. pg_stat_statements Extension
################################################################################
section "2. pg_stat_statements Extension"

PG_STAT_STATEMENTS=$(execute_query "SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_stat_statements';")

if [ "$PG_STAT_STATEMENTS" = "1" ]; then
    pass "pg_stat_statements extension installed"

    # Check if we can query it
    if execute_query "SELECT COUNT(*) FROM pg_stat_statements LIMIT 1;" >/dev/null 2>&1; then
        pass "pg_stat_statements accessible"
    else
        warn "pg_stat_statements installed but not accessible"
        info "May need to add to shared_preload_libraries in postgresql.conf"
    fi
else
    fail "pg_stat_statements extension not installed"
    info "Install with: CREATE EXTENSION pg_stat_statements;"
fi

################################################################################
# 3. Slow Query Logging
################################################################################
section "3. Slow Query Logging"

LOG_MIN_DURATION=$(execute_query "SHOW log_min_duration_statement;" 2>/dev/null || echo "")

if [ -n "$LOG_MIN_DURATION" ]; then
    if [ "$LOG_MIN_DURATION" = "-1" ]; then
        warn "Slow query logging disabled (log_min_duration_statement = -1)"
        info "Enable with: ALTER DATABASE $DB_NAME SET log_min_duration_statement = 1000;"
    else
        # Extract numeric value (remove 'ms' suffix)
        DURATION_VALUE=$(echo "$LOG_MIN_DURATION" | sed 's/ms//')
        if [ "$DURATION_VALUE" -le 1000 ]; then
            pass "Slow query logging enabled ($LOG_MIN_DURATION)"
        else
            warn "Slow query threshold too high ($LOG_MIN_DURATION, recommend 1000ms)"
        fi
    fi
else
    warn "Cannot determine slow query logging configuration"
fi

################################################################################
# 4. Recommended Indexes
################################################################################
section "4. Recommended Indexes"

info "Checking for recommended indexes..."

# Products indexes
PRODUCTS_SKU_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'products' AND indexname LIKE '%sku%';")
PRODUCTS_CATEGORY_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'products' AND indexname LIKE '%category%';")
PRODUCTS_NAME_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'products' AND indexname LIKE '%name%';")

if [ "$PRODUCTS_SKU_IDX" -ge 1 ]; then
    pass "Products SKU index exists"
else
    fail "Products SKU index missing"
    info "Create with: CREATE INDEX CONCURRENTLY idx_products_sku ON products(sku);"
fi

if [ "$PRODUCTS_CATEGORY_IDX" -ge 1 ]; then
    pass "Products category index exists"
else
    warn "Products category index missing (may impact filtering)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_products_category ON products(category);"
fi

if [ "$PRODUCTS_NAME_IDX" -ge 1 ]; then
    pass "Products name index exists"
else
    warn "Products name index missing (may impact search)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_products_name_trgm ON products USING gin(name gin_trgm_ops);"
fi

# Customers indexes
CUSTOMERS_EMAIL_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'customers' AND indexname LIKE '%email%';")
CUSTOMERS_CUSTOMER_NUMBER_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'customers' AND indexname LIKE '%customer_number%';")

if [ "$CUSTOMERS_EMAIL_IDX" -ge 1 ]; then
    pass "Customers email index exists"
else
    warn "Customers email index missing"
    info "Create with: CREATE INDEX CONCURRENTLY idx_customers_email ON customers(email);"
fi

if [ "$CUSTOMERS_CUSTOMER_NUMBER_IDX" -ge 1 ]; then
    pass "Customers customer_number index exists"
else
    fail "Customers customer_number index missing"
    info "Create with: CREATE INDEX CONCURRENTLY idx_customers_customer_number ON customers(customer_number);"
fi

# Orders indexes
ORDERS_CUSTOMER_ID_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'orders' AND indexname LIKE '%customer_id%';")
ORDERS_ORDER_DATE_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'orders' AND indexname LIKE '%order_date%';")
ORDERS_STATUS_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'orders' AND indexname LIKE '%status%';")

if [ "$ORDERS_CUSTOMER_ID_IDX" -ge 1 ]; then
    pass "Orders customer_id index exists"
else
    fail "Orders customer_id index missing (critical for joins)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_orders_customer_id ON orders(customer_id);"
fi

if [ "$ORDERS_ORDER_DATE_IDX" -ge 1 ]; then
    pass "Orders order_date index exists"
else
    warn "Orders order_date index missing (may impact date range queries)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_orders_order_date ON orders(order_date DESC);"
fi

if [ "$ORDERS_STATUS_IDX" -ge 1 ]; then
    pass "Orders status index exists"
else
    warn "Orders status index missing (may impact filtering)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_orders_status ON orders(status);"
fi

# Order Items indexes
ORDER_ITEMS_ORDER_ID_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'order_items' AND indexname LIKE '%order_id%';")
ORDER_ITEMS_PRODUCT_ID_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'order_items' AND indexname LIKE '%product_id%';")

if [ "$ORDER_ITEMS_ORDER_ID_IDX" -ge 1 ]; then
    pass "Order items order_id index exists"
else
    fail "Order items order_id index missing (critical for joins)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_order_items_order_id ON order_items(order_id);"
fi

if [ "$ORDER_ITEMS_PRODUCT_ID_IDX" -ge 1 ]; then
    pass "Order items product_id index exists"
else
    warn "Order items product_id index missing (may impact product lookups)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_order_items_product_id ON order_items(product_id);"
fi

# Quotes indexes
QUOTES_CUSTOMER_ID_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'quotes' AND indexname LIKE '%customer_id%';")
QUOTES_STATUS_IDX=$(execute_query "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'quotes' AND indexname LIKE '%status%';")

if [ "$QUOTES_CUSTOMER_ID_IDX" -ge 1 ]; then
    pass "Quotes customer_id index exists"
else
    fail "Quotes customer_id index missing (critical for joins)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_quotes_customer_id ON quotes(customer_id);"
fi

if [ "$QUOTES_STATUS_IDX" -ge 1 ]; then
    pass "Quotes status index exists"
else
    warn "Quotes status index missing (may impact filtering)"
    info "Create with: CREATE INDEX CONCURRENTLY idx_quotes_status ON quotes(status);"
fi

################################################################################
# 5. Sequential Scans (Table Scans)
################################################################################
section "5. Sequential Scans Analysis"

info "Analyzing tables with high sequential scan counts..."

SEQ_SCAN_TABLES=$(execute_query "
SELECT tablename, seq_scan, seq_tup_read, idx_scan,
       CASE WHEN seq_scan = 0 THEN 0 ELSE seq_tup_read / seq_scan END as avg_seq_tup
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC
LIMIT 5;" 2>/dev/null)

if [ -n "$SEQ_SCAN_TABLES" ]; then
    TABLES_WITH_HIGH_SEQSCAN=$(echo "$SEQ_SCAN_TABLES" | wc -l)
    if [ "$TABLES_WITH_HIGH_SEQSCAN" -gt 0 ]; then
        warn "$TABLES_WITH_HIGH_SEQSCAN tables have high sequential scan counts"
        info "Consider adding indexes for frequently scanned tables"
        info "Run: SELECT * FROM pg_stat_user_tables WHERE seq_scan > 100 ORDER BY seq_tup_read DESC;"
    else
        pass "No tables with excessive sequential scans"
    fi
else
    pass "No tables with excessive sequential scans"
fi

################################################################################
# 6. Unused Indexes
################################################################################
section "6. Unused Indexes"

info "Checking for unused indexes..."

UNUSED_INDEXES=$(execute_query "
SELECT COUNT(*) FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
  AND indexrelname NOT LIKE 'pg_%'
  AND indexrelname NOT LIKE '%_pkey';" 2>/dev/null || echo "0")

if [ "$UNUSED_INDEXES" = "0" ]; then
    pass "No unused indexes detected"
else
    if [ "$UNUSED_INDEXES" -lt 5 ]; then
        warn "$UNUSED_INDEXES unused indexes detected"
    else
        fail "$UNUSED_INDEXES unused indexes detected (performance impact)"
    fi
    info "Review with: SELECT schemaname, tablename, indexname FROM pg_stat_user_indexes WHERE idx_scan = 0;"
    info "Consider dropping unused indexes to improve write performance"
fi

################################################################################
# 7. Cache Hit Ratio
################################################################################
section "7. Cache Hit Ratio"

info "Checking database cache hit ratio..."

CACHE_HIT_RATIO=$(execute_query "
SELECT ROUND(
    sum(heap_blks_hit) * 100.0 / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
    2
) as cache_hit_ratio
FROM pg_statio_user_tables;" 2>/dev/null || echo "0")

if [ -n "$CACHE_HIT_RATIO" ] && [ "$CACHE_HIT_RATIO" != "0" ]; then
    # Convert to integer for comparison
    CACHE_HIT_INT=$(echo "$CACHE_HIT_RATIO" | cut -d'.' -f1)

    if [ "$CACHE_HIT_INT" -ge 99 ]; then
        pass "Cache hit ratio: ${CACHE_HIT_RATIO}% (excellent)"
    elif [ "$CACHE_HIT_INT" -ge 95 ]; then
        warn "Cache hit ratio: ${CACHE_HIT_RATIO}% (good, but could be better)"
        info "Target: > 99% for optimal performance"
    else
        fail "Cache hit ratio: ${CACHE_HIT_RATIO}% (poor, increase shared_buffers)"
        info "Current shared_buffers: $(execute_query 'SHOW shared_buffers;')"
        info "Recommend: 25% of total RAM"
    fi
else
    warn "Cannot determine cache hit ratio (no data yet or connection issue)"
fi

################################################################################
# 8. Slow Queries (from pg_stat_statements)
################################################################################
section "8. Slow Queries Analysis"

if [ "$PG_STAT_STATEMENTS" = "1" ]; then
    info "Analyzing slow queries from pg_stat_statements..."

    SLOW_QUERY_COUNT=$(execute_query "
    SELECT COUNT(*) FROM pg_stat_statements
    WHERE mean_exec_time > 1000;" 2>/dev/null || echo "0")

    if [ "$SLOW_QUERY_COUNT" = "0" ]; then
        pass "No queries with mean execution time > 1000ms"
    elif [ "$SLOW_QUERY_COUNT" -lt 5 ]; then
        warn "$SLOW_QUERY_COUNT queries with mean execution time > 1000ms"
        info "Review with: SELECT query, mean_exec_time FROM pg_stat_statements WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC;"
    else
        fail "$SLOW_QUERY_COUNT queries with mean execution time > 1000ms"
        info "Use EXPLAIN ANALYZE to optimize these queries"
    fi

    # Check for queries with high total time
    HIGH_TOTAL_TIME=$(execute_query "
    SELECT COUNT(*) FROM pg_stat_statements
    WHERE total_exec_time > 60000;" 2>/dev/null || echo "0")

    if [ "$HIGH_TOTAL_TIME" = "0" ]; then
        pass "No queries with total execution time > 60s"
    else
        warn "$HIGH_TOTAL_TIME queries with cumulative time > 60s"
        info "These queries may need optimization or caching"
    fi
else
    warn "pg_stat_statements not available, cannot analyze slow queries"
fi

################################################################################
# 9. N+1 Query Detection
################################################################################
section "9. N+1 Query Detection"

info "Checking backend code for potential N+1 query patterns..."

BACKEND_DIR="backend/src/api/routes"

if [ -d "$BACKEND_DIR" ]; then
    # Check for common N+1 patterns in Python code

    # Pattern 1: Loop with database query inside
    LOOP_WITH_QUERY=$(grep -r "for .* in " "$BACKEND_DIR" 2>/dev/null | grep -c "execute\|select" 2>/dev/null || echo "0")

    if [ "$LOOP_WITH_QUERY" -eq 0 ]; then
        pass "No obvious N+1 query patterns detected"
    else
        warn "$LOOP_WITH_QUERY potential N+1 query patterns found"
        info "Review loops that execute queries inside"
        info "Use eager loading or batch queries instead"
    fi

    # Pattern 2: Check for joinedload usage (SQLAlchemy eager loading)
    JOINEDLOAD_USAGE=$(grep -r "joinedload\|selectinload" "$BACKEND_DIR" 2>/dev/null | wc -l || echo "0")

    if [ "$JOINEDLOAD_USAGE" -gt 0 ]; then
        pass "Eager loading (joinedload/selectinload) used in $JOINEDLOAD_USAGE locations"
    else
        warn "No eager loading patterns found in code"
        info "Consider using joinedload() or selectinload() to avoid N+1 queries"
    fi
else
    warn "Backend directory not found, cannot check for N+1 patterns"
fi

################################################################################
# 10. Query Result Caching
################################################################################
section "10. Query Result Caching"

info "Checking for query result caching implementation..."

# Check for Redis configuration
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping >/dev/null 2>&1; then
        pass "Redis available for caching"
    else
        warn "Redis command available but server not running"
    fi
else
    warn "Redis not installed (recommended for query caching)"
    info "Install with: sudo apt install redis-server"
fi

# Check for caching in backend code
CACHE_USAGE=$(grep -r "@cache\|cache\.get\|cache\.set\|redis\.get\|redis\.set" "$BACKEND_DIR" 2>/dev/null | wc -l || echo "0")

if [ "$CACHE_USAGE" -gt 0 ]; then
    pass "Caching implemented in $CACHE_USAGE locations"
else
    warn "No caching implementation found in backend code"
    info "Consider implementing Redis caching for frequently accessed queries"
fi

# Check for cache configuration in settings
BACKEND_CONFIG="backend/src/config/settings.py"
if [ -f "$BACKEND_CONFIG" ]; then
    if grep -q "REDIS_URL\|redis_url\|cache" "$BACKEND_CONFIG" 2>/dev/null; then
        pass "Cache configuration found in settings"
    else
        warn "No cache configuration in settings"
    fi
else
    warn "Settings file not found, cannot verify cache configuration"
fi

################################################################################
# 11. Connection Pool Configuration
################################################################################
section "11. Connection Pool Configuration"

DATABASE_CONFIG="backend/src/config/database.py"

if [ -f "$DATABASE_CONFIG" ]; then
    pass "Database configuration file exists"

    # Check pool_size
    if grep -q "pool_size" "$DATABASE_CONFIG"; then
        POOL_SIZE=$(grep "pool_size" "$DATABASE_CONFIG" | head -1 | grep -oP '\d+' || echo "")
        if [ -n "$POOL_SIZE" ]; then
            if [ "$POOL_SIZE" -ge 10 ]; then
                pass "Connection pool_size configured: $POOL_SIZE"
            else
                warn "Connection pool_size too small: $POOL_SIZE (recommend >= 10)"
            fi
        fi
    else
        warn "pool_size not explicitly configured (using default)"
    fi

    # Check max_overflow
    if grep -q "max_overflow" "$DATABASE_CONFIG"; then
        MAX_OVERFLOW=$(grep "max_overflow" "$DATABASE_CONFIG" | head -1 | grep -oP '\d+' || echo "")
        if [ -n "$MAX_OVERFLOW" ]; then
            if [ "$MAX_OVERFLOW" -ge 10 ]; then
                pass "Connection max_overflow configured: $MAX_OVERFLOW"
            else
                warn "Connection max_overflow too small: $MAX_OVERFLOW (recommend >= 10)"
            fi
        fi
    else
        warn "max_overflow not explicitly configured (using default)"
    fi

    # Check pool_pre_ping
    if grep -q "pool_pre_ping.*=.*True" "$DATABASE_CONFIG"; then
        pass "pool_pre_ping enabled (connection health checks)"
    else
        warn "pool_pre_ping not enabled (may have stale connections)"
    fi
else
    fail "Database configuration file not found: $DATABASE_CONFIG"
fi

################################################################################
# 12. VACUUM and ANALYZE
################################################################################
section "12. VACUUM and ANALYZE Status"

info "Checking autovacuum configuration..."

AUTOVACUUM=$(execute_query "SHOW autovacuum;" 2>/dev/null || echo "")

if [ "$AUTOVACUUM" = "on" ]; then
    pass "Autovacuum enabled"
else
    fail "Autovacuum disabled (table bloat will occur)"
    info "Enable with: ALTER SYSTEM SET autovacuum = on;"
fi

# Check last autovacuum time for main tables
TABLES=("products" "customers" "orders" "order_items" "quotes" "quote_items")

for table in "${TABLES[@]}"; do
    LAST_VACUUM=$(execute_query "
    SELECT COALESCE(
        EXTRACT(EPOCH FROM (NOW() - last_autovacuum))::integer,
        999999
    ) as seconds_since_vacuum
    FROM pg_stat_user_tables
    WHERE relname = '$table';" 2>/dev/null || echo "999999")

    if [ -n "$LAST_VACUUM" ] && [ "$LAST_VACUUM" != "999999" ]; then
        DAYS_SINCE_VACUUM=$((LAST_VACUUM / 86400))
        if [ "$DAYS_SINCE_VACUUM" -le 1 ]; then
            pass "$table: vacuumed recently (< 1 day ago)"
        elif [ "$DAYS_SINCE_VACUUM" -le 7 ]; then
            info "$table: vacuumed $DAYS_SINCE_VACUUM days ago"
        else
            warn "$table: not vacuumed in $DAYS_SINCE_VACUUM days"
            info "Consider manual VACUUM: VACUUM ANALYZE $table;"
        fi
    else
        info "$table: vacuum info not available (new table or no data)"
    fi
done

################################################################################
# 13. Query Planner Configuration
################################################################################
section "13. Query Planner Configuration"

info "Checking query planner settings..."

# Random page cost (should be ~1.1 for SSD)
RANDOM_PAGE_COST=$(execute_query "SHOW random_page_cost;" 2>/dev/null || echo "")
if [ -n "$RANDOM_PAGE_COST" ]; then
    # Extract numeric value
    COST_VALUE=$(echo "$RANDOM_PAGE_COST" | sed 's/[^0-9.]//g')
    if [ -n "$COST_VALUE" ]; then
        # Compare as float
        if (( $(echo "$COST_VALUE <= 1.5" | bc -l) )); then
            pass "random_page_cost optimized for SSD: $RANDOM_PAGE_COST"
        else
            warn "random_page_cost: $RANDOM_PAGE_COST (recommend 1.1 for SSD)"
            info "Set with: ALTER SYSTEM SET random_page_cost = 1.1;"
        fi
    fi
fi

# Effective IO concurrency
EFFECTIVE_IO=$(execute_query "SHOW effective_io_concurrency;" 2>/dev/null || echo "")
if [ -n "$EFFECTIVE_IO" ]; then
    if [ "$EFFECTIVE_IO" -ge 100 ]; then
        pass "effective_io_concurrency optimized for SSD: $EFFECTIVE_IO"
    else
        warn "effective_io_concurrency: $EFFECTIVE_IO (recommend 200 for SSD)"
        info "Set with: ALTER SYSTEM SET effective_io_concurrency = 200;"
    fi
fi

################################################################################
# 14. Database Size and Growth
################################################################################
section "14. Database Size Monitoring"

DB_SIZE=$(execute_query "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null || echo "")

if [ -n "$DB_SIZE" ]; then
    info "Database size: $DB_SIZE"

    # Check if database is very large (> 10GB might need partitioning)
    DB_SIZE_BYTES=$(execute_query "SELECT pg_database_size('$DB_NAME');" 2>/dev/null || echo "0")
    if [ "$DB_SIZE_BYTES" -gt 10737418240 ]; then
        warn "Database size > 10GB, consider table partitioning"
    fi
fi

# Show largest tables
info "Largest tables:"
execute_query "
SELECT schemaname || '.' || tablename as table,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 5;" 2>/dev/null | while IFS='|' read -r table size; do
    if [ -n "$table" ]; then
        info "  $table: $size"
    fi
done

################################################################################
# 15. Documentation
################################################################################
section "15. Documentation"

OPTIMIZATION_DOC="docs/DATABASE_OPTIMIZATION.md"
PERFORMANCE_GUIDE="docs/PERFORMANCE-OPTIMIZATION-GUIDE.md"

if [ -f "$OPTIMIZATION_DOC" ]; then
    pass "Database optimization documentation exists"

    # Check if recently updated
    DOC_AGE_DAYS=$(find "$OPTIMIZATION_DOC" -mtime +90 2>/dev/null | wc -l)
    if [ "$DOC_AGE_DAYS" -eq 0 ]; then
        pass "Documentation recently updated (< 90 days)"
    else
        warn "Documentation not updated in > 90 days"
    fi
else
    warn "Database optimization documentation not found: $OPTIMIZATION_DOC"
fi

if [ -f "$PERFORMANCE_GUIDE" ]; then
    pass "Performance optimization guide exists"
else
    info "Performance optimization guide not found: $PERFORMANCE_GUIDE"
fi

################################################################################
# 16. Query Monitoring Endpoints
################################################################################
section "16. Monitoring Endpoints"

MONITORING_DIR="backend/src/api/routes/monitoring"

if [ -d "$MONITORING_DIR" ]; then
    pass "Monitoring routes directory exists"

    # Check for database metrics endpoint
    if grep -r "database.*metric\|query.*performance" "$MONITORING_DIR" >/dev/null 2>&1; then
        pass "Database metrics endpoint implemented"
    else
        warn "No database metrics endpoint found"
        info "Add /api/metrics/database endpoint for monitoring"
    fi
else
    warn "Monitoring routes directory not found"
    info "Create monitoring endpoints for query performance tracking"
fi

################################################################################
# Summary
################################################################################

echo ""
echo "================================================================================"
echo "  VERIFICATION SUMMARY"
echo "================================================================================"
echo -e "✓ Passed:   ${GREEN}$PASSED${NC}"
echo -e "⚠ Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "✗ Failed:   ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ Database query performance configuration looks excellent!${NC}"
    else
        echo -e "${YELLOW}⚠ Database query performance is mostly optimized with some improvements needed.${NC}"
    fi
    echo ""
    echo "Next steps:"
    echo "1. Review and optimize slow queries identified above"
    echo "2. Run EXPLAIN ANALYZE on frequently executed queries"
    echo "3. Monitor pg_stat_statements for performance trends"
    echo "4. Implement caching for frequently accessed data"
    echo "5. Set up continuous query performance monitoring"
    EXIT_CODE=0
else
    echo -e "${RED}✗ Database query performance issues detected.${NC}"
    echo ""
    echo "Priority actions:"
    echo "1. Install missing recommended indexes (critical)"
    echo "2. Enable pg_stat_statements extension"
    echo "3. Configure connection pooling"
    echo "4. Enable slow query logging"
    echo "5. Review and fix failed checks above"
    EXIT_CODE=1
fi

echo ""
exit $EXIT_CODE
