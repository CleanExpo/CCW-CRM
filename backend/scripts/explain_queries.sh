#!/bin/bash
# Script to check query execution plans and verify index usage

DB_CONTAINER="nodejs-starter-postgres"
DB_USER="starter_user"
DB_NAME="starter_db"

echo "========================================================================"
echo " QUERY EXECUTION PLAN ANALYSIS"
echo "========================================================================"
echo ""

echo "1. Customer Search Query (company_name OR contact_name ILIKE)"
echo "------------------------------------------------------------------------"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
  "EXPLAIN ANALYZE SELECT * FROM customers WHERE company_name ILIKE '%construction%' OR contact_name ILIKE '%construction%' LIMIT 50;"
echo ""

echo "2. Product Search Query (name ILIKE + is_active filter)"
echo "------------------------------------------------------------------------"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
  "EXPLAIN ANALYZE SELECT * FROM products WHERE name ILIKE '%drill%' AND is_active = true LIMIT 50;"
echo ""

echo "3. SKU Search Query (sku ILIKE)"
echo "------------------------------------------------------------------------"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
  "EXPLAIN ANALYZE SELECT * FROM products WHERE sku ILIKE '%tool%' LIMIT 50;"
echo ""

echo "4. Order with Customer Join"
echo "------------------------------------------------------------------------"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
  "EXPLAIN ANALYZE SELECT o.*, c.company_name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.status = 'pending' LIMIT 50;"
echo ""

echo "5. Products by Category and Active Status"
echo "------------------------------------------------------------------------"
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \
  "EXPLAIN ANALYZE SELECT * FROM products WHERE category = 'power_tools' AND is_active = true LIMIT 50;"
echo ""

echo "========================================================================"
echo " TIPS FOR INTERPRETING RESULTS"
echo "========================================================================"
echo ""
echo "GOOD SIGNS (indexes being used):"
echo "  - 'Index Scan using idx_...' or 'Bitmap Index Scan'"
echo "  - Low cost values (< 100)"
echo "  - Fast execution time (< 10ms)"
echo ""
echo "BAD SIGNS (indexes NOT being used):"
echo "  - 'Seq Scan' on large tables"
echo "  - High cost values (> 1000)"
echo "  - Slow execution time (> 100ms)"
echo ""
echo "NOTE: On small tables (< 100 rows), PostgreSQL may choose Seq Scan"
echo "even with indexes because it's faster. This is correct behavior."
echo ""
