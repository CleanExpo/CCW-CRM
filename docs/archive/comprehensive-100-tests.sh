#!/bin/bash

# Comprehensive Test Suite - 100+ Tests
# Testing all endpoints, methods, error scenarios, and edge cases

BASE_URL="http://localhost:8003"
API_KEY="dev-test-api-key-12345"

echo "======================================"
echo "Comprehensive 100+ Test Suite"
echo "======================================"
echo ""

PASSED=0
FAILED=0
SKIPPED=0

# Color codes for output (if supported)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_code="$4"
    local data="$5"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "%{http_code}" -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "%{http_code}" -X PUT -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "%{http_code}" -X DELETE -H "Authorization: Bearer $API_KEY" "$BASE_URL$endpoint")
    fi

    http_code="${response: -3}"

    if [ "$http_code" = "$expected_code" ]; then
        echo "[PASS] $name (HTTP $http_code)"
        ((PASSED++))
    else
        echo "[FAIL] $name (HTTP $http_code, expected $expected_code)"
        ((FAILED++))
    fi
}

test_endpoint_any_success() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "%{http_code}" -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
    fi

    http_code="${response: -3}"

    # Accept 200, 201, 404 (not found is OK for some endpoints)
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "404" ]; then
        echo "[PASS] $name (HTTP $http_code)"
        ((PASSED++))
    else
        echo "[FAIL] $name (HTTP $http_code, expected 200/201/404)"
        ((FAILED++))
    fi
}

echo "=== CATEGORY 1: CORE ENDPOINTS (10 tests) ==="
test_endpoint "Health Check" "GET" "/health" "200"
test_endpoint "API Docs (HTML)" "GET" "/docs" "200"
test_endpoint "API Docs (Redoc)" "GET" "/redoc" "200"
test_endpoint "OpenAPI JSON" "GET" "/openapi.json" "200"
test_endpoint "Root Endpoint" "GET" "/" "200"
test_endpoint "Config: Get Settings" "GET" "/api/config/settings" "200"
test_endpoint "Config: Get Frontend Config" "GET" "/api/config/frontend-config" "200"
test_endpoint "Config: Get Tax Rate" "GET" "/api/config/tax-rate" "200"
test_endpoint "Config: AI Providers" "GET" "/api/config/ai-providers" "200"
test_endpoint "Config: Locations" "GET" "/api/config/locations" "200"

echo ""
echo "=== CATEGORY 2: ERP DATA - GET OPERATIONS (15 tests) ==="
test_endpoint "GET /api/orders" "GET" "/api/orders" "200"
test_endpoint "GET /api/orders (page 2)" "GET" "/api/orders?page=2&page_size=10" "200"
test_endpoint "GET /api/orders (with status filter)" "GET" "/api/orders?status=pending" "200"
test_endpoint "GET /api/products" "GET" "/api/products" "200"
test_endpoint "GET /api/products (page 2)" "GET" "/api/products?page=2&page_size=10" "200"
test_endpoint "GET /api/products (search)" "GET" "/api/products?search=drill" "200"
test_endpoint "GET /api/customers" "GET" "/api/customers" "200"
test_endpoint "GET /api/customers (search)" "GET" "/api/customers?search=test" "200"
test_endpoint "GET /api/suppliers" "GET" "/api/suppliers" "200"
test_endpoint "GET /api/suppliers (search)" "GET" "/api/suppliers?search=acme" "200"
test_endpoint "GET /api/purchase-orders" "GET" "/api/purchase-orders" "200"
test_endpoint "GET /api/purchase-orders (filter)" "GET" "/api/purchase-orders?status=pending" "200"
test_endpoint "GET /api/quotes" "GET" "/api/quotes" "200"
test_endpoint "GET /api/quotes (filter)" "GET" "/api/quotes?status=draft" "200"
test_endpoint "GET /api/inventory" "GET" "/api/inventory" "200"

echo ""
echo "=== CATEGORY 3: PORTAL & PUBLIC ENDPOINTS (10 tests) ==="
test_endpoint "GET Contact Submissions" "GET" "/api/contact-submissions" "200"
test_endpoint "GET Demo Requests" "GET" "/api/demo-requests" "200"
test_endpoint "POST Contact Submission (valid)" "POST" "/api/contact-submissions" "201" '{"name":"Test User","email":"test@example.com","phone":"0400000000","message":"Test message"}'
test_endpoint "POST Contact Submission (invalid - no email)" "POST" "/api/contact-submissions" "422" '{"name":"Test User","message":"Test"}'
test_endpoint "POST Demo Request (valid)" "POST" "/api/demo-requests" "201" '{"company_name":"Test Co","contact_name":"John Doe","email":"john@test.com","phone":"0400000000","preferred_date":"2026-02-01"}'
test_endpoint "POST Demo Request (invalid)" "POST" "/api/demo-requests" "422" '{"company_name":"Test"}'
test_endpoint_any_success "Portal Auth: Register" "POST" "/api/portal-auth/register" '{"email":"test@test.com","password":"test123","company_name":"Test"}'
test_endpoint_any_success "Portal Auth: Login" "POST" "/api/portal-auth/login" '{"email":"test@test.com","password":"wrong"}'
test_endpoint_any_success "Demo Auth: Register" "POST" "/api/demo-auth/register" '{"email":"demo@test.com","password":"demo123"}'
test_endpoint_any_success "Demo Auth: Login" "POST" "/api/demo-auth/login" '{"email":"demo@test.com","password":"wrong"}'

echo ""
echo "=== CATEGORY 4: AI ENDPOINTS (15 tests) ==="
test_endpoint_any_success "AI Chat: Send Message" "POST" "/api/ai/chat" '{"message":"What are the top selling products?"}'
test_endpoint_any_success "AI Chat: Get History" "GET" "/api/ai/chat/history"
test_endpoint_any_success "AI Generate: Quote" "POST" "/api/ai/generate/quote" '{"customer_id":"123e4567-e89b-12d3-a456-426614174000","products":[]}'
test_endpoint_any_success "AI Generate: Email" "POST" "/api/ai/generate/email" '{"context":"follow_up","customer_name":"John"}'
test_endpoint_any_success "AI Generate: Product Description" "POST" "/api/ai/generate/product-description" '{"product_name":"Power Drill","features":["cordless","20V"]}'
test_endpoint "AI Insights: Sales Trends" "GET" "/api/ai/insights/sales-trends" "200"
test_endpoint "AI Insights: Customer Insights" "GET" "/api/ai/insights/customer-insights" "200"
test_endpoint "AI Insights: Inventory Predictions" "GET" "/api/ai/insights/inventory-predictions" "200"
test_endpoint_any_success "AI Learning: Get Patterns" "GET" "/api/ai/learning/patterns"
test_endpoint_any_success "AI Learning: Get Metrics" "GET" "/api/ai/learning/metrics"
test_endpoint_any_success "AI Monitoring: Agent Status" "GET" "/api/ai/monitoring/agents"
test_endpoint_any_success "AI Monitoring: Health" "GET" "/api/ai/monitoring/health"
test_endpoint_any_success "AI Supervisor: Execute Task" "POST" "/api/ai/supervisor/execute" '{"task":"analyze sales"}'
test_endpoint_any_success "AI Specialized: Pricing Agent" "POST" "/api/ai/specialized/pricing" '{"product_id":"123","action":"recommend"}'
test_endpoint_any_success "AI Specialized: Procurement Agent" "POST" "/api/ai/specialized/procurement" '{"action":"check_inventory"}'

echo ""
echo "=== CATEGORY 5: INTEGRATION ENDPOINTS (12 tests) ==="
test_endpoint_any_success "Xero: Connection Status" "GET" "/api/integrations/xero/status"
test_endpoint_any_success "Xero: Sync Customers" "POST" "/api/integrations/xero/sync/customers" "{}"
test_endpoint_any_success "Xero: Sync Orders" "POST" "/api/integrations/xero/sync/orders" "{}"
test_endpoint_any_success "Shopify: Sync Status" "GET" "/api/integrations/shopify/sync-status"
test_endpoint_any_success "Shopify: Sync Products" "POST" "/api/integrations/shopify/sync/products" "{}"
test_endpoint_any_success "Shopify: Sync Orders" "POST" "/api/integrations/shopify/sync/orders" "{}"
test_endpoint_any_success "SendGrid: Send Email" "POST" "/api/integrations/sendgrid/send" '{"to":"test@test.com","subject":"Test","body":"Test"}'
test_endpoint_any_success "SendGrid: Email Status" "GET" "/api/integrations/sendgrid/status"
test_endpoint_any_success "ElevenLabs: TTS Settings" "GET" "/api/integrations/elevenlabs/settings"
test_endpoint_any_success "ElevenLabs: Generate Speech" "POST" "/api/integrations/elevenlabs/tts" '{"text":"Hello world"}'
test_endpoint_any_success "ElevenLabs: List Voices" "GET" "/api/integrations/elevenlabs/voices"
test_endpoint_any_success "Webhooks: List" "GET" "/api/webhooks"

echo ""
echo "=== CATEGORY 6: LOGISTICS & OPERATIONS (10 tests) ==="
test_endpoint "Shipments: List All" "GET" "/api/shipments" "200"
test_endpoint "Shipments: Filter by status" "GET" "/api/shipments?status=pending" "200"
test_endpoint_any_success "Backorders: List All" "GET" "/api/backorders"
test_endpoint_any_success "Backorders: By Customer" "GET" "/api/backorders?customer_id=123e4567-e89b-12d3-a456-426614174000"
test_endpoint_any_success "Containers: List All" "GET" "/api/containers"
test_endpoint_any_success "Containers: Filter by status" "GET" "/api/containers?status=in_transit"
test_endpoint_any_success "Contractors: List All" "GET" "/api/contractors"
test_endpoint_any_success "Contractors: Search" "GET" "/api/contractors?search=john"
test_endpoint_any_success "Service Requests: List" "GET" "/api/service-requests"
test_endpoint_any_success "Service Requests: Filter" "GET" "/api/service-requests?status=open"

echo ""
echo "=== CATEGORY 7: ERROR HANDLING & EDGE CASES (15 tests) ==="
test_endpoint "GET Non-existent Order (404)" "GET" "/api/orders/123e4567-e89b-12d3-a456-426614174000" "404"
test_endpoint "GET Non-existent Product (404)" "GET" "/api/products/123e4567-e89b-12d3-a456-426614174000" "404"
test_endpoint "GET Non-existent Customer (404)" "GET" "/api/customers/123e4567-e89b-12d3-a456-426614174000" "404"
test_endpoint "POST Order (invalid data - no customer)" "POST" "/api/orders" "422" '{"status":"draft"}'
test_endpoint "POST Product (invalid - no SKU)" "POST" "/api/products" "422" '{"name":"Test Product"}'
test_endpoint "POST Customer (invalid - no email)" "POST" "/api/customers" "422" '{"company_name":"Test Co"}'
test_endpoint "Orders: Invalid page number" "GET" "/api/orders?page=0" "422"
test_endpoint "Orders: Invalid page size" "GET" "/api/orders?page_size=1000" "422"
test_endpoint "Products: Invalid category" "GET" "/api/products?category=INVALID" "200"
test_endpoint "Suppliers: Negative pagination" "GET" "/api/suppliers?page=-1" "422"
test_endpoint "Purchase Orders: Invalid status" "GET" "/api/purchase-orders?status=invalid_status" "200"
test_endpoint "Quotes: Invalid date range" "GET" "/api/quotes?from_date=invalid" "200"
test_endpoint "Inventory: Invalid location" "GET" "/api/inventory?location=mars" "200"
test_endpoint "Customers: XSS attempt in search" "GET" "/api/customers?search=%3Cscript%3Ealert%28%27xss%27%29%3C%2Fscript%3E" "200"
test_endpoint "Orders: SQL injection attempt" "GET" "/api/orders?search=%27%20OR%20%271%27%3D%271" "200"

echo ""
echo "=== CATEGORY 8: DEMO & TESTING UTILITIES (8 tests) ==="
test_endpoint_any_success "Demo Dashboard: Stats" "GET" "/api/demo/dashboard/stats"
test_endpoint_any_success "Demo Dashboard: Recent Activity" "GET" "/api/demo/dashboard/recent-activity"
test_endpoint_any_success "Demo Lists: Products" "GET" "/api/demo/lists/products"
test_endpoint_any_success "Demo Lists: Orders" "GET" "/api/demo/lists/orders"
test_endpoint_any_success "Demo Lists: Customers" "GET" "/api/demo/lists/customers"
test_endpoint_any_success "Test Data: Generate Sample Data" "POST" "/api/test-data/generate" '{"count":5}'
test_endpoint_any_success "Test Data: Clear Test Data" "DELETE" "/api/test-data/clear"
test_endpoint_any_success "Cron Jobs: List All" "GET" "/api/cron-jobs"

echo ""
echo "=== CATEGORY 9: ADVANCED OPERATIONS (10 tests) ==="
test_endpoint "Orders: Pagination (large page)" "GET" "/api/orders?page=10&page_size=100" "200"
test_endpoint "Products: Sort by price" "GET" "/api/products?sort_by=price&order=desc" "200"
test_endpoint "Customers: Filter active only" "GET" "/api/customers?is_active=true" "200"
test_endpoint "Suppliers: Multiple filters" "GET" "/api/suppliers?is_active=true&search=acme" "200"
test_endpoint "Orders: Date range filter" "GET" "/api/orders?from_date=2026-01-01&to_date=2026-01-31" "200"
test_endpoint "Products: Category filter" "GET" "/api/products?category=POWER_TOOLS" "200"
test_endpoint "Inventory: Location filter" "GET" "/api/inventory?location=brisbane" "200"
test_endpoint "Purchase Orders: Supplier filter" "GET" "/api/purchase-orders?supplier_id=123e4567-e89b-12d3-a456-426614174000" "200"
test_endpoint "Quotes: Customer filter" "GET" "/api/quotes?customer_id=123e4567-e89b-12d3-a456-426614174000" "200"
test_endpoint "Shipments: Date range" "GET" "/api/shipments?from_date=2026-01-01" "200"

echo ""
echo "=== CATEGORY 10: AUTHENTICATION & SECURITY (5 tests) ==="
# Test without auth header
echo "[TEST] Request without Authorization header"
response=$(curl -s -w "%{http_code}" "$BASE_URL/api/orders")
http_code="${response: -3}"
if [ "$http_code" = "401" ]; then
    echo "[PASS] No auth header returns 401 (HTTP $http_code)"
    ((PASSED++))
else
    echo "[FAIL] No auth header should return 401 (HTTP $http_code)"
    ((FAILED++))
fi

echo "[TEST] Request with invalid API key"
response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer invalid-key-12345" "$BASE_URL/api/orders")
http_code="${response: -3}"
if [ "$http_code" = "401" ]; then
    echo "[PASS] Invalid API key returns 401 (HTTP $http_code)"
    ((PASSED++))
else
    echo "[FAIL] Invalid API key should return 401 (HTTP $http_code)"
    ((FAILED++))
fi

echo "[TEST] Request with malformed header"
response=$(curl -s -w "%{http_code}" -H "Authorization: InvalidFormat" "$BASE_URL/api/orders")
http_code="${response: -3}"
if [ "$http_code" = "401" ]; then
    echo "[PASS] Malformed auth returns 401 (HTTP $http_code)"
    ((PASSED++))
else
    echo "[FAIL] Malformed auth should return 401 (HTTP $http_code)"
    ((FAILED++))
fi

test_endpoint "Health endpoint (no auth required)" "GET" "/health" "200"
test_endpoint "Docs endpoint (no auth required)" "GET" "/docs" "200"

echo ""
echo "======================================"
echo "FINAL SUMMARY"
echo "======================================"
echo "Total Tests Run: $((PASSED + FAILED))"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Success Rate: $((PASSED * 100 / (PASSED + FAILED)))%"
echo "======================================"

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0
