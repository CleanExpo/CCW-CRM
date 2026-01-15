#!/bin/bash

BASE_URL="http://localhost:8003"
API_KEY="dev-test-api-key-12345"

echo "======================================"
echo "Final Comprehensive Test Results"
echo "======================================"
echo ""

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="$3"
    
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$url")
    http_code="${response: -3}"
    
    if [ "$http_code" = "$expected_code" ]; then
        echo "[PASS] $name (HTTP $http_code)"
        ((PASSED++))
    else
        echo "[FAIL] $name (HTTP $http_code, expected $expected_code)"
        ((FAILED++))
    fi
}

echo "=== Core Endpoints ==="
test_endpoint "Health Check" "$BASE_URL/health" "200"
test_endpoint "API Docs" "$BASE_URL/docs" "200"
test_endpoint "OpenAPI JSON" "$BASE_URL/openapi.json" "200"

echo ""
echo "=== Data Endpoints ==="
test_endpoint "GET /api/suppliers" "$BASE_URL/api/suppliers" "200"
test_endpoint "GET /api/purchase-orders" "$BASE_URL/api/purchase-orders" "200"
test_endpoint "GET /api/contact-submissions" "$BASE_URL/api/contact-submissions" "200"
test_endpoint "GET /api/demo-requests" "$BASE_URL/api/demo-requests" "200"
test_endpoint "GET /api/orders" "$BASE_URL/api/orders" "200"
test_endpoint "GET /api/products" "$BASE_URL/api/products" "200"

echo ""
echo "======================================"
echo "Summary: $PASSED passed, $FAILED failed"
echo "Success Rate: $((PASSED * 100 / (PASSED + FAILED)))%"
echo "======================================"
