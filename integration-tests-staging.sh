#!/bin/bash

# ==========================================
# CCW-Online ERP - Integration Test Suite
# Focus: Workflows, data integrity, integration
# ==========================================

API_URL="http://localhost:8001"
EMAIL="admin@demo.com"
PASSWORD="demo123"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo "=========================================="
echo "CCW-Online ERP - Integration Test Suite"
echo "=========================================="
echo ""

# Authenticate
echo "Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Authentication failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Authenticated (User ID: $USER_ID)${NC}"
echo ""

# Helper function for tests
test_endpoint() {
  local TEST_NAME=$1
  local METHOD=$2
  local ENDPOINT=$3
  local DATA=$4
  local EXPECTED_STATUS=$5

  echo -n "Testing: $TEST_NAME... "

  if [ -n "$DATA" ]; then
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
# SCENARIO 1: Complete Quote-to-Order Workflow
# ==================================================
echo "=========================================="
echo "SCENARIO 1: Quote-to-Order Workflow"
echo "=========================================="
echo ""

# Generate unique timestamp for this test run
TIMESTAMP=$(date +%s)

# Create a wholesale customer with unique email
WHOLESALE_DATA='{
  "name": "Brisbane Cleaning Services Pty Ltd",
  "email": "purchasing+'$TIMESTAMP'@brisbanecleaning.com.au",
  "phone": "+61 7 3000 1234",
  "address": "45 Industrial Drive",
  "city": "Brisbane",
  "state": "QLD",
  "postal_code": "4000",
  "customer_type": "wholesale"
}'

test_endpoint "Create wholesale customer" "POST" "/api/customers" "$WHOLESALE_DATA" "201"
WHOLESALE_CUSTOMER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Wholesale Customer ID: $WHOLESALE_CUSTOMER_ID"
echo ""

# Get products for quote
echo "Fetching available products..."
PRODUCTS_RESPONSE=$(curl -s -X GET "$API_URL/api/products?page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

PRODUCT_1=$(echo "$PRODUCTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PRODUCT_1_PRICE=$(echo "$PRODUCTS_RESPONSE" | grep -o '"price":"[^"]*"' | head -1 | cut -d'"' -f4)
PRODUCT_2=$(echo "$PRODUCTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)
PRODUCT_2_PRICE=$(echo "$PRODUCTS_RESPONSE" | grep -o '"price":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)

echo "Product 1: $PRODUCT_1 (\$$PRODUCT_1_PRICE)"
echo "Product 2: $PRODUCT_2 (\$$PRODUCT_2_PRICE)"
echo ""

# Create quote
QUOTE_DATA="{
  \"customer_id\": \"$WHOLESALE_CUSTOMER_ID\",
  \"items\": [
    {
      \"product_id\": \"$PRODUCT_1\",
      \"quantity\": 3
    },
    {
      \"product_id\": \"$PRODUCT_2\",
      \"quantity\": 5
    }
  ],
  \"notes\": \"Wholesale pricing - 10% discount applied\",
  \"valid_until\": \"2026-02-28T00:00:00Z\"
}"

test_endpoint "Create quote" "POST" "/api/quotes" "$QUOTE_DATA" "201"
QUOTE_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
QUOTE_NUMBER=$(echo "$BODY" | grep -o '"quote_number":"[^"]*"' | cut -d'"' -f4)
echo "Quote ID: $QUOTE_ID"
echo "Quote Number: $QUOTE_NUMBER"
echo ""

# Retrieve the quote
test_endpoint "Retrieve quote" "GET" "/api/quotes/$QUOTE_ID" "" "200"

# Update quote status to sent
UPDATE_QUOTE='{"status": "sent"}'
test_endpoint "Update quote status to sent" "PUT" "/api/quotes/$QUOTE_ID" "$UPDATE_QUOTE" "200"

# Convert quote to order
test_endpoint "Convert quote to order" "POST" "/api/quotes/$QUOTE_ID/convert-to-order" "" "201"
ORDER_FROM_QUOTE=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Order created from quote: $ORDER_FROM_QUOTE"
echo ""

# ==================================================
# SCENARIO 2: Product Management & Stock Updates
# ==================================================
echo "=========================================="
echo "SCENARIO 2: Product Management"
echo "=========================================="
echo ""

# Create new product with unique SKU
NEW_PRODUCT='{
  "sku": "CHEM-TEST-'$TIMESTAMP'",
  "name": "Test Carpet Cleaner 5L",
  "description": "Test product for integration testing",
  "category": "ACCESSORIES",
  "price": 99.99,
  "cost": 65.00,
  "stock": 50,
  "warehouse_location": "Brisbane Main"
}'

test_endpoint "Create new product" "POST" "/api/products" "$NEW_PRODUCT" "201"
NEW_PRODUCT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "New Product ID: $NEW_PRODUCT_ID"
echo ""

# Update product price
UPDATE_PRICE='{"price": 89.99}'
test_endpoint "Update product price" "PUT" "/api/products/$NEW_PRODUCT_ID" "$UPDATE_PRICE" "200"

# Search for product
test_endpoint "Search products by name" "GET" "/api/products?search=Test+Carpet" "" "200"

# Get product by ID
test_endpoint "Get product details" "GET" "/api/products/$NEW_PRODUCT_ID" "" "200"

# Soft delete product
test_endpoint "Soft delete product" "DELETE" "/api/products/$NEW_PRODUCT_ID" "" "204"

# Verify soft delete (should not appear in active list)
test_endpoint "Verify product not in active list" "GET" "/api/products?search=Test+Carpet" "" "200"
if echo "$BODY" | grep -q "CHEM-TEST-001"; then
  echo -e "${RED}✗ FAIL: Soft-deleted product still appears in list${NC}"
  ((FAILED++))
else
  echo -e "${GREEN}✓ PASS: Soft-deleted product hidden from list${NC}"
  ((PASSED++))
fi
echo ""

# ==================================================
# SCENARIO 3: Customer Data Validation
# ==================================================
echo "=========================================="
echo "SCENARIO 3: Customer Data Validation"
echo "=========================================="
echo ""

# Test duplicate customer email
DUPLICATE_EMAIL="{
  \"name\": \"Duplicate Test Customer\",
  \"email\": \"$EMAIL\"
}"
test_endpoint "Duplicate email check" "POST" "/api/customers" "$DUPLICATE_EMAIL" "400"

# Test invalid email format
INVALID_EMAIL='{
  "name": "Invalid Email Customer",
  "email": "not-an-email"
}'
test_endpoint "Invalid email format" "POST" "/api/customers" "$INVALID_EMAIL" "422"

# Test very long customer name (boundary testing)
LONG_NAME=$(printf 'A%.0s' {1..300})
LONG_NAME_DATA="{
  \"name\": \"$LONG_NAME\",
  \"email\": \"longname@test.com\"
}"
test_endpoint "Very long customer name" "POST" "/api/customers" "$LONG_NAME_DATA" "422"

# Test special characters in name
SPECIAL_CHARS='{
  "name": "Test & Co. (Pty) Ltd.",
  "email": "special+'$TIMESTAMP'@test.com",
  "phone": "+61-7-3000-5678"
}'
test_endpoint "Special characters in name" "POST" "/api/customers" "$SPECIAL_CHARS" "201"

# ==================================================
# SCENARIO 4: Order Workflow Edge Cases
# ==================================================
echo "=========================================="
echo "SCENARIO 4: Order Edge Cases"
echo "=========================================="
echo ""

# Create order with zero quantity (should fail)
ZERO_QTY_ORDER="{
  \"customer_id\": \"$WHOLESALE_CUSTOMER_ID\",
  \"items\": [{
    \"product_id\": \"$PRODUCT_1\",
    \"quantity\": 0
  }]
}"
test_endpoint "Order with zero quantity" "POST" "/api/orders" "$ZERO_QTY_ORDER" "422"

# Create order with non-existent product
FAKE_PRODUCT_ID="00000000-0000-0000-0000-000000000000"
INVALID_PRODUCT_ORDER="{
  \"customer_id\": \"$WHOLESALE_CUSTOMER_ID\",
  \"items\": [{
    \"product_id\": \"$FAKE_PRODUCT_ID\",
    \"quantity\": 5
  }]
}"
test_endpoint "Order with non-existent product" "POST" "/api/orders" "$INVALID_PRODUCT_ORDER" "400"

# Create order with non-existent customer
FAKE_CUSTOMER_ID="00000000-0000-0000-0000-000000000000"
INVALID_CUSTOMER_ORDER="{
  \"customer_id\": \"$FAKE_CUSTOMER_ID\",
  \"items\": [{
    \"product_id\": \"$PRODUCT_1\",
    \"quantity\": 2
  }]
}"
test_endpoint "Order with non-existent customer" "POST" "/api/orders" "$INVALID_CUSTOMER_ORDER" "404"

# Create valid order for next tests
VALID_ORDER="{
  \"customer_id\": \"$WHOLESALE_CUSTOMER_ID\",
  \"items\": [{
    \"product_id\": \"$PRODUCT_1\",
    \"quantity\": 1
  }]
}"
test_endpoint "Create valid order" "POST" "/api/orders" "$VALID_ORDER" "201"
VALID_ORDER_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Valid Order ID: $VALID_ORDER_ID"
echo ""

# Update order status
UPDATE_ORDER_STATUS='{"status": "confirmed"}'
test_endpoint "Update order status" "PUT" "/api/orders/$VALID_ORDER_ID" "$UPDATE_ORDER_STATUS" "200"

# Get order details
test_endpoint "Get order details" "GET" "/api/orders/$VALID_ORDER_ID" "" "200"

# ==================================================
# SCENARIO 5: Pagination & Filtering
# ==================================================
echo "=========================================="
echo "SCENARIO 5: Pagination & Filtering"
echo "=========================================="
echo ""

# Test pagination
test_endpoint "Get page 1 of products" "GET" "/api/products?page=1&page_size=5" "" "200"
PAGE1_COUNT=$(echo "$BODY" | grep -o '"id":"[^"]*"' | wc -l)
echo "Page 1 product count: $PAGE1_COUNT"
echo ""

test_endpoint "Get page 2 of products" "GET" "/api/products?page=2&page_size=5" "" "200"

# Test large page size
test_endpoint "Large page size (100)" "GET" "/api/products?page=1&page_size=100" "" "200"

# Test invalid page number
test_endpoint "Invalid page number (0)" "GET" "/api/products?page=0&page_size=10" "" "422"

# Test category filtering
test_endpoint "Filter by category" "GET" "/api/products?category=ACCESSORIES&page_size=20" "" "200"

# Test active/inactive filtering
test_endpoint "Filter active products" "GET" "/api/products?is_active=true" "" "200"

# ==================================================
# SCENARIO 6: Data Consistency Checks
# ==================================================
echo "=========================================="
echo "SCENARIO 6: Data Consistency"
echo "=========================================="
echo ""

# Get all customers
echo "Checking customer data consistency..."
CUSTOMERS_RESPONSE=$(curl -s -X GET "$API_URL/api/customers?page_size=100" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

CUSTOMER_COUNT=$(echo "$CUSTOMERS_RESPONSE" | grep -o '"customer_number":"CUST-[^"]*"' | wc -l)
echo "Total customers: $CUSTOMER_COUNT"

# Check for duplicate customer numbers
DUPLICATE_CHECK=$(echo "$CUSTOMERS_RESPONSE" | grep -o '"customer_number":"CUST-[^"]*"' | sort | uniq -d)
if [ -z "$DUPLICATE_CHECK" ]; then
  echo -e "${GREEN}✓ PASS: No duplicate customer numbers${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL: Found duplicate customer numbers${NC}"
  echo "$DUPLICATE_CHECK"
  ((FAILED++))
fi
echo ""

# Get all orders
echo "Checking order data consistency..."
ORDERS_RESPONSE=$(curl -s -X GET "$API_URL/api/orders?page_size=100" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

ORDER_COUNT=$(echo "$ORDERS_RESPONSE" | grep -o '"order_number":"ORD-[^"]*"' | wc -l)
echo "Total orders: $ORDER_COUNT"

# Check for duplicate order numbers
DUPLICATE_ORDERS=$(echo "$ORDERS_RESPONSE" | grep -o '"order_number":"ORD-[^"]*"' | sort | uniq -d)
if [ -z "$DUPLICATE_ORDERS" ]; then
  echo -e "${GREEN}✓ PASS: No duplicate order numbers${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL: Found duplicate order numbers${NC}"
  echo "$DUPLICATE_ORDERS"
  ((FAILED++))
fi
echo ""

# ==================================================
# SCENARIO 7: API Response Structure Validation
# ==================================================
echo "=========================================="
echo "SCENARIO 7: API Response Validation"
echo "=========================================="
echo ""

# Check pagination response structure
echo "Checking pagination response structure..."
PAGINATED=$(curl -s -X GET "$API_URL/api/products?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

if echo "$PAGINATED" | grep -q '"items"' && \
   echo "$PAGINATED" | grep -q '"total"' && \
   echo "$PAGINATED" | grep -q '"page"' && \
   echo "$PAGINATED" | grep -q '"page_size"' && \
   echo "$PAGINATED" | grep -q '"total_pages"'; then
  echo -e "${GREEN}✓ PASS: Pagination structure valid${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL: Pagination structure invalid${NC}"
  ((FAILED++))
fi
echo ""

# Check timestamp formats
echo "Checking timestamp formats..."
if echo "$PAGINATED" | grep -q '"created_at":"[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}T'; then
  echo -e "${GREEN}✓ PASS: ISO 8601 timestamp format${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL: Invalid timestamp format${NC}"
  ((FAILED++))
fi
echo ""

# Check UUID formats
echo "Checking UUID formats..."
if echo "$PAGINATED" | grep -q '"id":"[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}"'; then
  echo -e "${GREEN}✓ PASS: Valid UUID format${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL: Invalid UUID format${NC}"
  ((FAILED++))
fi
echo ""

# ==================================================
# SCENARIO 8: Performance & Rate Limits
# ==================================================
echo "=========================================="
echo "SCENARIO 8: Performance Tests"
echo "=========================================="
echo ""

# Rapid sequential requests
echo "Testing rapid sequential requests..."
START_TIME=$(date +%s)
for i in {1..10}; do
  curl -s -X GET "$API_URL/api/products?page=1&page_size=10" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-User-Id: $USER_ID" > /dev/null
done
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "10 requests completed in ${DURATION}s"
if [ $DURATION -lt 5 ]; then
  echo -e "${GREEN}✓ PASS: Good performance (<5s for 10 requests)${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING: Slow performance (${DURATION}s for 10 requests)${NC}"
  ((WARNINGS++))
fi
echo ""

# ==================================================
# SCENARIO 9: Error Handling
# ==================================================
echo "=========================================="
echo "SCENARIO 9: Error Handling"
echo "=========================================="
echo ""

# Test 404 on non-existent resource
test_endpoint "404 for non-existent product" "GET" "/api/products/00000000-0000-0000-0000-000000000000" "" "404"

# Test 404 on non-existent customer
test_endpoint "404 for non-existent customer" "GET" "/api/customers/00000000-0000-0000-0000-000000000000" "" "404"

# Test malformed UUID
test_endpoint "Malformed UUID" "GET" "/api/products/not-a-uuid" "" "422"

# Test missing required fields
MISSING_FIELDS='{}'
test_endpoint "Missing required fields" "POST" "/api/orders" "$MISSING_FIELDS" "422"

# Test invalid JSON
echo -n "Testing: Invalid JSON... "
INVALID_JSON_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/customers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID" \
  -d '{invalid json}')

INVALID_JSON_STATUS=$(echo "$INVALID_JSON_RESPONSE" | tail -1)
if [ "$INVALID_JSON_STATUS" = "422" ] || [ "$INVALID_JSON_STATUS" = "400" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $INVALID_JSON_STATUS)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 400/422, got HTTP $INVALID_JSON_STATUS)"
  ((FAILED++))
fi
echo ""

# ==================================================
# SCENARIO 10: Security Headers & CORS
# ==================================================
echo "=========================================="
echo "SCENARIO 10: Security Headers"
echo "=========================================="
echo ""

# Check security headers
echo "Checking security headers..."
HEADERS=$(curl -s -I -X GET "$API_URL/api/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-User-Id: $USER_ID")

if echo "$HEADERS" | grep -qi "access-control-allow"; then
  echo -e "${GREEN}✓ PASS: CORS headers present${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING: CORS headers missing${NC}"
  ((WARNINGS++))
fi
echo ""

# ==================================================
# TEST SUMMARY
# ==================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$((PASSED * 100 / TOTAL))
  echo "Pass Rate: ${PASS_RATE}%"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed - review results above${NC}"
  exit 1
fi
