#!/bin/bash

################################################################################
# CCW-Online ERP - Smoke Test Suite
#
# Purpose: Post-deployment smoke tests to verify critical functionality
#
# Usage:
#   ./deployment/scripts/smoke-tests.sh [BASE_URL]
#
# Arguments:
#   BASE_URL - API base URL (default: http://localhost:8000)
#
# Exit Codes:
#   0 - All tests passed
#   1 - Test failures detected
################################################################################

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_URL="${1:-http://localhost:8000}"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test credentials (demo account)
TEST_EMAIL="admin@demo.com"
TEST_PASSWORD="demo123"
AUTH_TOKEN=""

################################################################################
# Helper Functions
################################################################################

log_test() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED_TESTS++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED_TESTS++))
}

run_test() {
  ((TOTAL_TESTS++))
  log_test "$1"
}

http_get() {
  local url="$1"
  local expected_status="${2:-200}"

  response=$(curl -s -w "\n%{http_code}" "$url" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer ${AUTH_TOKEN}"})

  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)

  if [ "$status" -eq "$expected_status" ]; then
    log_pass "HTTP GET $url → $status"
    echo "$body"
    return 0
  else
    log_fail "HTTP GET $url → $status (expected $expected_status)"
    return 1
  fi
}

http_post() {
  local url="$1"
  local data="$2"
  local expected_status="${3:-200}"

  response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
    -H "Content-Type: application/json" \
    ${AUTH_TOKEN:+-H "Authorization: Bearer ${AUTH_TOKEN}"} \
    -d "$data")

  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)

  if [ "$status" -eq "$expected_status" ]; then
    log_pass "HTTP POST $url → $status"
    echo "$body"
    return 0
  else
    log_fail "HTTP POST $url → $status (expected $expected_status)"
    echo "$body"
    return 1
  fi
}

################################################################################
# Test Suite
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         CCW-Online ERP - Smoke Test Suite                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Base URL: ${BASE_URL}"
echo "  Started:  $(date)"
echo ""

################################################################################
# 1. Health Check
################################################################################

run_test "1.1 Health check endpoint"
if http_get "${BASE_URL}/api/health" 200 > /dev/null; then
  :
fi

################################################################################
# 2. Authentication
################################################################################

run_test "2.1 Login with valid credentials"
login_response=$(http_post "${BASE_URL}/api/auth/login" \
  "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
  200) || exit 1

AUTH_TOKEN=$(echo "$login_response" | jq -r '.access_token')

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
  log_fail "Failed to extract access token"
  exit 1
fi

run_test "2.2 Login with invalid credentials"
if http_post "${BASE_URL}/api/auth/login" \
  '{"email":"invalid@test.com","password":"wrong"}' \
  401 > /dev/null; then
  :
fi

################################################################################
# 3. Products API
################################################################################

run_test "3.1 List products (authenticated)"
products_response=$(http_get "${BASE_URL}/api/products?page=1&page_size=10" 200) || exit 1

product_count=$(echo "$products_response" | jq -r '.total')
if [ "$product_count" -gt 0 ]; then
  log_pass "Product count: $product_count"
else
  log_fail "No products found in database"
fi

run_test "3.2 Search products by keyword"
if http_get "${BASE_URL}/api/products?search=drill" 200 > /dev/null; then
  :
fi

run_test "3.3 Filter products by category"
if http_get "${BASE_URL}/api/products?category=power_tools" 200 > /dev/null; then
  :
fi

################################################################################
# 4. Customers API
################################################################################

run_test "4.1 List customers (authenticated)"
customers_response=$(http_get "${BASE_URL}/api/customers?page=1&page_size=10" 200) || exit 1

customer_count=$(echo "$customers_response" | jq -r '.total')
if [ "$customer_count" -gt 0 ]; then
  log_pass "Customer count: $customer_count"
else
  log_fail "No customers found in database"
fi

################################################################################
# 5. Orders API
################################################################################

run_test "5.1 List orders (authenticated)"
orders_response=$(http_get "${BASE_URL}/api/orders?page=1&page_size=10" 200) || exit 1

order_count=$(echo "$orders_response" | jq -r '.total')
if [ "$order_count" -gt 0 ]; then
  log_pass "Order count: $order_count"
else
  log_fail "No orders found in database"
fi

################################################################################
# 6. Quotes API
################################################################################

run_test "6.1 List quotes (authenticated)"
quotes_response=$(http_get "${BASE_URL}/api/quotes?page=1&page_size=10" 200) || exit 1

quote_count=$(echo "$quotes_response" | jq -r '.total')
if [ "$quote_count" -gt 0 ]; then
  log_pass "Quote count: $quote_count"
else
  log_fail "No quotes found in database"
fi

################################################################################
# 7. Dashboard API
################################################################################

run_test "7.1 Dashboard metrics"
if http_get "${BASE_URL}/api/dashboard/metrics" 200 > /dev/null; then
  :
fi

run_test "7.2 Dashboard charts"
if http_get "${BASE_URL}/api/dashboard/charts" 200 > /dev/null; then
  :
fi

################################################################################
# 8. Billing API (if available)
################################################################################

run_test "8.1 Get subscription status"
if http_get "${BASE_URL}/api/billing/subscription" 200 > /dev/null 2>&1; then
  :
else
  log_fail "Billing API not available (may not be implemented yet)"
fi

################################################################################
# 9. Rate Limiting
################################################################################

run_test "9.1 Rate limiting protection"
rate_limit_exceeded=false

for i in {1..150}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health")
  if [ "$status" -eq 429 ]; then
    rate_limit_exceeded=true
    break
  fi
done

if [ "$rate_limit_exceeded" = true ]; then
  log_pass "Rate limiting active (429 Too Many Requests)"
else
  log_fail "Rate limiting may not be configured (expected 429 after 100 requests)"
fi

################################################################################
# 10. Security Headers
################################################################################

run_test "10.1 Security headers present"
headers=$(curl -s -I "${BASE_URL}/api/health")

security_headers=(
  "X-Content-Type-Options"
  "X-Frame-Options"
  "X-XSS-Protection"
  "Strict-Transport-Security"
)

headers_present=0
for header in "${security_headers[@]}"; do
  if echo "$headers" | grep -qi "$header"; then
    ((headers_present++))
  fi
done

if [ "$headers_present" -ge 3 ]; then
  log_pass "Security headers present: $headers_present/4"
else
  log_fail "Missing security headers: only $headers_present/4 found"
fi

################################################################################
# Test Summary
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Test Summary                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total Tests:  ${TOTAL_TESTS}"
echo "  Passed:       ${GREEN}${PASSED_TESTS}${NC}"
echo "  Failed:       ${RED}${FAILED_TESTS}${NC}"
echo "  Success Rate: $(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")%"
echo ""
echo "  Completed:    $(date)"
echo ""

if [ "$FAILED_TESTS" -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ ${FAILED_TESTS} test(s) failed!${NC}"
  exit 1
fi
