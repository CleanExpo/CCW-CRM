#!/bin/bash

# Comprehensive ERP System Testing
# Tests all scenarios: walk-in, phone orders, internet sales, inventory, shipping, containers

API_URL="http://127.0.0.1:8000"
EMAIL="admin@demo.com"
PASSWORD="demo123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "CCW-Online ERP - Comprehensive Test Suite"
echo "=========================================="
echo ""

# Login
echo "Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Authentication failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Authenticated (User ID: $USER_ID)${NC}"
echo ""

# Test counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper function to test endpoint
test_endpoint() {
  local TEST_NAME="$1"
  local METHOD="$2"
  local ENDPOINT="$3"
  local DATA="$4"
  local EXPECTED_STATUS="$5"

  echo -n "Testing: $TEST_NAME... "

  if [ "$METHOD" = "POST" ] || [ "$METHOD" = "PUT" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD "$API_URL$ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-User-Id: $USER_ID" \
      -d "$DATA")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $METHOD "$API_URL$ENDPOINT" \
      -H "Authorization: Bearer $TOKEN" \
      -H "X-User-Id: $USER_ID")
  fi

  STATUS=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$STATUS" = "$EXPECTED_STATUS" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $STATUS)"
    ((PASSED++))
    echo "$BODY"
  else
    echo -e "${RED}✗ FAIL${NC} (Expected HTTP $EXPECTED_STATUS, got HTTP $STATUS)"
    ((FAILED++))
    echo "$BODY"
  fi
  echo ""
}

# ==================================================
# SCENARIO 1: New Customer Walk-In
# ==================================================
echo "=========================================="
echo "SCENARIO 1: New Customer Walk-In"
echo "=========================================="
echo "Simulation: A customer walks into the showroom"
echo ""

# Create new customer
CUSTOMER_DATA='{
  "name": "Walk-In Customer Ltd",
  "email": "walkin@test.com",
  "phone": "+1-555-0101",
  "address": "123 Showroom St",
  "city": "Sydney",
  "state": "NSW",
  "country": "Australia",
  "postal_code": "2000",
  "customer_type": "retail",
  "credit_limit": 5000.00
}'

test_endpoint "Create walk-in customer" "POST" "/api/customers" "$CUSTOMER_DATA" "201"

# Get customer ID from response
CUSTOMER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created Customer ID: $CUSTOMER_ID"
echo ""

# Browse products
test_endpoint "Browse products" "GET" "/api/products?page=1&page_size=10" "" "200"

# Get first product
PRODUCT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Selected Product ID: $PRODUCT_ID"
echo ""

# Create quote for walk-in customer
QUOTE_DATA=$(cat <<EOF
{
  "customer_id": "$CUSTOMER_ID",
  "items": [
    {
      "product_id": "$PRODUCT_ID",
      "quantity": 5,
      "unit_price": 1200.00
    }
  ],
  "notes": "Walk-in customer - Showroom demonstration",
  "valid_until": "2026-02-15"
}
EOF
)

test_endpoint "Create quote for walk-in" "POST" "/api/quotes" "$QUOTE_DATA" "201"
QUOTE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created Quote ID: $QUOTE_ID"
echo ""

# ==================================================
# SCENARIO 2: Phone Order (Existing Customer)
# ==================================================
echo "=========================================="
echo "SCENARIO 2: Phone Order"
echo "=========================================="
echo "Simulation: Customer calls to place urgent order"
echo ""

# Check inventory before order
test_endpoint "Check product inventory" "GET" "/api/products/$PRODUCT_ID" "" "200"

# Create order from phone call
PHONE_ORDER_DATA=$(cat <<EOF
{
  "customer_id": "$CUSTOMER_ID",
  "order_type": "phone",
  "priority": "high",
  "items": [
    {
      "product_id": "$PRODUCT_ID",
      "quantity": 3,
      "unit_price": 1200.00
    }
  ],
  "notes": "URGENT: Customer needs by end of week",
  "shipping_address": "123 Showroom St, Sydney, NSW 2000"
}
EOF
)

test_endpoint "Create phone order" "POST" "/api/orders" "$PHONE_ORDER_DATA" "201"
ORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created Order ID: $ORDER_ID"
echo ""

# ==================================================
# SCENARIO 3: Internet Sales
# ==================================================
echo "=========================================="
echo "SCENARIO 3: Internet Sales"
echo "=========================================="
echo "Simulation: Online order through e-commerce"
echo ""

# Create new online customer
ONLINE_CUSTOMER='{
  "name": "Online Buyer Corp",
  "email": "online@ecommerce.com",
  "phone": "+1-555-0202",
  "address": "456 Digital Ave",
  "city": "Melbourne",
  "state": "VIC",
  "country": "Australia",
  "postal_code": "3000",
  "customer_type": "retail"
}'

test_endpoint "Create online customer" "POST" "/api/customers" "$ONLINE_CUSTOMER" "201"
ONLINE_CUSTOMER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# Create online order with multiple products
ONLINE_ORDER=$(cat <<EOF
{
  "customer_id": "$ONLINE_CUSTOMER_ID",
  "order_type": "online",
  "priority": "normal",
  "items": [
    {
      "product_id": "$PRODUCT_ID",
      "quantity": 10,
      "unit_price": 1200.00
    }
  ],
  "notes": "E-commerce order - Payment via credit card",
  "shipping_address": "456 Digital Ave, Melbourne, VIC 3000"
}
EOF
)

test_endpoint "Create online order" "POST" "/api/orders" "$ONLINE_ORDER" "201"
ONLINE_ORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# ==================================================
# SCENARIO 4: Parts Ordering (Low Stock)
# ==================================================
echo "=========================================="
echo "SCENARIO 4: Parts Need to be Ordered"
echo "=========================================="
echo "Simulation: Product low in stock, need to order from supplier"
echo ""

# Check current inventory levels
test_endpoint "Check inventory levels" "GET" "/api/inventory?low_stock=true" "" "200"

# Get supplier list
test_endpoint "Get suppliers" "GET" "/api/suppliers?page=1&page_size=5" "" "200"
SUPPLIER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Selected Supplier ID: $SUPPLIER_ID"
echo ""

# Create purchase order to supplier
PO_DATA=$(cat <<EOF
{
  "supplier_id": "$SUPPLIER_ID",
  "items": [
    {
      "product_id": "$PRODUCT_ID",
      "quantity": 50,
      "unit_cost": 1000.00
    }
  ],
  "expected_delivery": "2026-02-28",
  "notes": "Restock order - Low inventory alert"
}
EOF
)

test_endpoint "Create purchase order" "POST" "/api/purchase-orders" "$PO_DATA" "201"
PO_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# ==================================================
# SCENARIO 5: Multi-Location Inventory
# ==================================================
echo "=========================================="
echo "SCENARIO 5: Parts in Different Locations"
echo "=========================================="
echo "Simulation: Check stock across multiple warehouses"
echo ""

# Check inventory by location
test_endpoint "Check Sydney warehouse" "GET" "/api/inventory?warehouse=Sydney" "" "200"
test_endpoint "Check Melbourne warehouse" "GET" "/api/inventory?warehouse=Melbourne" "" "200"

# Test inventory transfer between locations
TRANSFER_DATA='{
  "product_id": "'$PRODUCT_ID'",
  "from_warehouse": "Sydney",
  "to_warehouse": "Melbourne",
  "quantity": 5,
  "reason": "Stock balancing"
}'

test_endpoint "Transfer inventory" "POST" "/api/inventory/transfer" "$TRANSFER_DATA" "201"
echo ""

# ==================================================
# SCENARIO 6: Shipping with Delivery Days
# ==================================================
echo "=========================================="
echo "SCENARIO 6: Shipping & Delivery"
echo "=========================================="
echo "Simulation: Create shipment with delivery tracking"
echo ""

# Create shipment for order
SHIPMENT_DATA='{
  "order_id": "'$ORDER_ID'",
  "carrier": "Australia Post",
  "tracking_number": "AP123456789AU",
  "estimated_delivery": "2026-01-25",
  "shipping_cost": 150.00
}'

test_endpoint "Create shipment" "POST" "/api/shipments" "$SHIPMENT_DATA" "201"
SHIPMENT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# Update shipment status
test_endpoint "Update shipment to in-transit" "PUT" "/api/shipments/$SHIPMENT_ID/status" '{"status":"in_transit"}' "200"
echo ""

# ==================================================
# SCENARIO 7: Container Tracking (Items on Ship)
# ==================================================
echo "=========================================="
echo "SCENARIO 7: Container Tracking"
echo "=========================================="
echo "Simulation: Items still on ship from overseas"
echo ""

# Create container
CONTAINER_DATA='{
  "container_number": "MSCU9876543",
  "vessel_name": "Pacific Trader",
  "origin_port": "Shanghai",
  "destination_port": "Sydney",
  "departure_date": "2026-01-10",
  "eta": "2026-02-05",
  "status": "in_transit",
  "items": [
    {
      "product_id": "'$PRODUCT_ID'",
      "quantity": 100
    }
  ]
}'

test_endpoint "Create container" "POST" "/api/containers" "$CONTAINER_DATA" "201"
CONTAINER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# Update container ETA
test_endpoint "Update container ETA" "PUT" "/api/containers/$CONTAINER_ID" '{"eta":"2026-02-03","status":"delayed"}' "200"
echo ""

# ==================================================
# SCENARIO 8: Backorder Handling
# ==================================================
echo "=========================================="
echo "SCENARIO 8: Backorder Management"
echo "=========================================="
echo "Simulation: Product out of stock, create backorder"
echo ""

# Create backorder
BACKORDER_DATA='{
  "customer_id": "'$CUSTOMER_ID'",
  "product_id": "'$PRODUCT_ID'",
  "quantity": 15,
  "priority": "high",
  "notes": "Customer willing to wait for container arrival"
}'

test_endpoint "Create backorder" "POST" "/api/backorders" "$BACKORDER_DATA" "201"
BACKORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# Check backorder allocation when stock arrives
test_endpoint "Allocate backorder" "POST" "/api/backorders/$BACKORDER_ID/allocate" '{"allocated_quantity":15}' "200"
echo ""

# ==================================================
# SCENARIO 9: Edge Cases & Error Handling
# ==================================================
echo "=========================================="
echo "SCENARIO 9: Edge Cases & Weaknesses"
echo "=========================================="
echo "Testing system boundaries and error handling"
echo ""

echo "Test 9.1: Negative Quantity"
test_endpoint "Negative quantity order" "POST" "/api/orders" '{"customer_id":"'$CUSTOMER_ID'","items":[{"product_id":"'$PRODUCT_ID'","quantity":-5}]}' "400"

echo "Test 9.2: Invalid Customer ID"
test_endpoint "Invalid customer ID" "POST" "/api/orders" '{"customer_id":"invalid-uuid","items":[{"product_id":"'$PRODUCT_ID'","quantity":1}]}' "400"

echo "Test 9.3: Zero Price"
test_endpoint "Zero price product" "POST" "/api/products" '{"name":"Free Item","sku":"FREE001","price":0}' "201"

echo "Test 9.4: Extremely Large Quantity"
test_endpoint "Huge quantity order" "POST" "/api/orders" '{"customer_id":"'$CUSTOMER_ID'","items":[{"product_id":"'$PRODUCT_ID'","quantity":999999999}]}' "400"

echo "Test 9.5: Duplicate SKU"
test_endpoint "Duplicate product SKU" "POST" "/api/products" '{"name":"Duplicate","sku":"EXISTING-SKU","price":100}' "400"

echo "Test 9.6: SQL Injection Attempt"
test_endpoint "SQL injection in search" "GET" "/api/products?search=test' OR '1'='1" "" "200"

echo "Test 9.7: XSS Attempt"
test_endpoint "XSS in customer name" "POST" "/api/customers" '{"name":"<script>alert(1)</script>","email":"xss@test.com"}' "201"

echo "Test 9.8: Missing Required Fields"
test_endpoint "Missing customer email" "POST" "/api/customers" '{"name":"No Email Customer"}' "400"

echo "Test 9.9: Invalid Date Format"
test_endpoint "Invalid date" "POST" "/api/quotes" '{"customer_id":"'$CUSTOMER_ID'","valid_until":"invalid-date"}' "400"

echo "Test 9.10: Circular Dependencies"
test_endpoint "Delete customer with orders" "DELETE" "/api/customers/$CUSTOMER_ID" "" "400"

# ==================================================
# SCENARIO 10: Concurrent Operations
# ==================================================
echo "=========================================="
echo "SCENARIO 10: Concurrent Operations"
echo "=========================================="
echo "Testing race conditions and concurrent updates"
echo ""

echo "Test 10.1: Simultaneous Inventory Updates"
# Create multiple inventory adjustments at once (in background)
for i in {1..5}; do
  curl -s -X POST "$API_URL/api/inventory/adjust" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-User-Id: $USER_ID" \
    -d '{"product_id":"'$PRODUCT_ID'","quantity_change":1,"reason":"concurrent-test-'$i'"}' &
done
wait
echo -e "${YELLOW}⚠ WARNING: Check inventory consistency${NC}"
((WARNINGS++))
echo ""

echo "Test 10.2: Multiple Orders for Same Product"
# Simulate race condition on low stock
for i in {1..3}; do
  curl -s -X POST "$API_URL/api/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-User-Id: $USER_ID" \
    -d '{"customer_id":"'$CUSTOMER_ID'","items":[{"product_id":"'$PRODUCT_ID'","quantity":10}]}' &
done
wait
echo -e "${YELLOW}⚠ WARNING: Check for overselling${NC}"
((WARNINGS++))
echo ""

# ==================================================
# Test Summary
# ==================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

# Calculate pass rate
TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$((PASSED * 100 / TOTAL))
  echo "Pass Rate: $PASS_RATE%"
fi
echo ""

echo "=========================================="
echo "WEAKNESSES IDENTIFIED:"
echo "=========================================="
echo "1. Race Conditions: Concurrent inventory updates may cause inconsistencies"
echo "2. Overselling Risk: Multiple simultaneous orders for low stock items"
echo "3. Input Validation: Some edge cases may not be properly validated"
echo "4. XSS Protection: Need to verify HTML encoding in frontend"
echo "5. Cascading Deletes: Customer deletion blocked by foreign keys (good!)"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed - review results above${NC}"
  exit 1
fi
