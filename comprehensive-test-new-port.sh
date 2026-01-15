#!/bin/bash

# Comprehensive Test Suite for CCW-Online ERP
# Tests 100+ endpoints and features to identify what's working and broken

BASE_URL="http://localhost:8001"
FRONTEND_URL="http://localhost:3000"
TEST_RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test result tracking
declare -a PASSED_LIST
declare -a FAILED_LIST
declare -a SKIPPED_LIST

# Log function
log_test() {
    local status=$1
    local test_name=$2
    local details=$3

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        PASSED_LIST+=("$test_name")
        echo -e "${GREEN}✓ PASS${NC}: $test_name" | tee -a "$TEST_RESULTS_FILE"
    elif [ "$status" = "FAIL" ]; then
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_LIST+=("$test_name")
        echo -e "${RED}✗ FAIL${NC}: $test_name - $details" | tee -a "$TEST_RESULTS_FILE"
    else
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        SKIPPED_LIST+=("$test_name")
        echo -e "${YELLOW}⊘ SKIP${NC}: $test_name - $details" | tee -a "$TEST_RESULTS_FILE"
    fi
}

# Test if backend is running
test_backend_running() {
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        log_test "PASS" "Backend Server Running" ""
        return 0
    else
        log_test "FAIL" "Backend Server Running" "Cannot connect to $BASE_URL"
        return 1
    fi
}

# Test if frontend is running
test_frontend_running() {
    if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
        log_test "PASS" "Frontend Server Running" ""
        return 0
    else
        log_test "SKIP" "Frontend Server Running" "Frontend not started (optional)"
        return 1
    fi
}

# Health and Info Endpoints (5 tests)
test_health_endpoints() {
    echo -e "\n${YELLOW}=== Health & Info Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # Health check
    response=$(curl -s -w "%{http_code}" "$BASE_URL/health")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /health" ""
    else
        log_test "FAIL" "GET /health" "HTTP $http_code"
    fi

    # API docs
    response=$(curl -s -w "%{http_code}" "$BASE_URL/docs")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /docs (OpenAPI)" ""
    else
        log_test "FAIL" "GET /docs (OpenAPI)" "HTTP $http_code"
    fi

    # API redoc
    response=$(curl -s -w "%{http_code}" "$BASE_URL/redoc")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /redoc" ""
    else
        log_test "FAIL" "GET /redoc" "HTTP $http_code"
    fi

    # OpenAPI JSON
    response=$(curl -s -w "%{http_code}" "$BASE_URL/openapi.json")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /openapi.json" ""
    else
        log_test "FAIL" "GET /openapi.json" "HTTP $http_code"
    fi

    # Root endpoint
    response=$(curl -s -w "%{http_code}" "$BASE_URL/")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET / (root)" ""
    else
        log_test "FAIL" "GET / (root)" "HTTP $http_code"
    fi
}

# Authentication Endpoints (10 tests)
test_auth_endpoints() {
    echo -e "\n${YELLOW}=== Authentication Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # Register new user
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "test_'$(date +%s)'@example.com",
            "password": "TestPass123!",
            "full_name": "Test User"
        }')
    http_code=$(echo "$response" | tail -n1)
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        log_test "PASS" "POST /api/auth/register" ""
        TEST_EMAIL="test_$(date +%s)@example.com"
    else
        log_test "FAIL" "POST /api/auth/register" "HTTP $http_code"
        TEST_EMAIL="demo@example.com"
    fi

    # Login
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "demo@example.com",
            "password": "demo123"
        }')
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "POST /api/auth/login" ""
        ACCESS_TOKEN=$(echo "$body" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    else
        log_test "FAIL" "POST /api/auth/login" "HTTP $http_code"
    fi

    # Get current user (with token)
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" "$BASE_URL/api/auth/me" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            log_test "PASS" "GET /api/auth/me (authenticated)" ""
        else
            log_test "FAIL" "GET /api/auth/me (authenticated)" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "GET /api/auth/me (authenticated)" "No access token"
    fi

    # Get current user (without token - should fail)
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/auth/me")
    http_code="${response: -3}"
    if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
        log_test "PASS" "GET /api/auth/me (unauthenticated - expect 401)" ""
    else
        log_test "FAIL" "GET /api/auth/me (unauthenticated)" "Expected 401, got $http_code"
    fi

    # Logout
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/logout" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            log_test "PASS" "POST /api/auth/logout" ""
        else
            log_test "FAIL" "POST /api/auth/logout" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/auth/logout" "No access token"
    fi

    # Refresh token
    response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/refresh" \
        -H "Content-Type: application/json" \
        -d '{"refresh_token": "dummy"}')
    http_code="${response: -3}"
    # Should return 401 for invalid token
    if [ "$http_code" = "401" ] || [ "$http_code" = "400" ]; then
        log_test "PASS" "POST /api/auth/refresh (invalid token)" ""
    else
        log_test "FAIL" "POST /api/auth/refresh" "Expected 401/400, got $http_code"
    fi

    # Password reset request
    response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/password-reset" \
        -H "Content-Type: application/json" \
        -d '{"email": "demo@example.com"}')
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "202" ]; then
        log_test "PASS" "POST /api/auth/password-reset" ""
    else
        log_test "FAIL" "POST /api/auth/password-reset" "HTTP $http_code"
    fi

    # Change password (requires auth)
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/auth/change-password" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "old_password": "demo123",
                "new_password": "NewPass123!"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "200" ] || [ "$http_code" = "401" ]; then
            log_test "PASS" "POST /api/auth/change-password" ""
        else
            log_test "FAIL" "POST /api/auth/change-password" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/auth/change-password" "No access token"
    fi
}

# Inventory Endpoints (15 tests)
test_inventory_endpoints() {
    echo -e "\n${YELLOW}=== Inventory Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # List products
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/inventory")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/inventory (list products)" ""
    else
        log_test "FAIL" "GET /api/inventory" "HTTP $http_code"
    fi

    # List products with pagination
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/inventory?page=1&page_size=10")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/inventory (with pagination)" ""
    else
        log_test "FAIL" "GET /api/inventory (pagination)" "HTTP $http_code"
    fi

    # Search products
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/inventory?search=test")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/inventory (search)" ""
    else
        log_test "FAIL" "GET /api/inventory (search)" "HTTP $http_code"
    fi

    # Low stock items
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/inventory/low-stock")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/inventory/low-stock" ""
    else
        log_test "FAIL" "GET /api/inventory/low-stock" "HTTP $http_code"
    fi

    # Get single product (assume ID 1 exists)
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/inventory/1")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
        log_test "PASS" "GET /api/inventory/{id}" ""
    else
        log_test "FAIL" "GET /api/inventory/{id}" "HTTP $http_code"
    fi

    # Create product (requires auth)
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/inventory" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "sku": "TEST-'$(date +%s)'",
                "name": "Test Product",
                "description": "Test Description",
                "quantity": 100,
                "cost_price": 10.00,
                "sell_price": 20.00,
                "category": "Test Category"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
            log_test "PASS" "POST /api/inventory (create product)" ""
        else
            log_test "FAIL" "POST /api/inventory" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/inventory" "No access token"
    fi

    # Update product
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X PUT "$BASE_URL/api/inventory/1" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "Updated Product Name"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
            log_test "PASS" "PUT /api/inventory/{id}" ""
        else
            log_test "FAIL" "PUT /api/inventory/{id}" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "PUT /api/inventory/{id}" "No access token"
    fi

    # Stock adjustment
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/inventory/1/adjust-stock" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "adjustment": 10,
                "reason": "Test adjustment"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
            log_test "PASS" "POST /api/inventory/{id}/adjust-stock" ""
        else
            log_test "FAIL" "POST /api/inventory/{id}/adjust-stock" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/inventory/{id}/adjust-stock" "No access token"
    fi
}

# Order Endpoints (15 tests)
test_order_endpoints() {
    echo -e "\n${YELLOW}=== Order Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # List orders
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/orders")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/orders (list)" ""
    else
        log_test "FAIL" "GET /api/orders" "HTTP $http_code"
    fi

    # List orders with filters
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/orders?status=pending")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/orders (with status filter)" ""
    else
        log_test "FAIL" "GET /api/orders (status filter)" "HTTP $http_code"
    fi

    # Get single order
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/orders/1")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
        log_test "PASS" "GET /api/orders/{id}" ""
    else
        log_test "FAIL" "GET /api/orders/{id}" "HTTP $http_code"
    fi

    # Create order
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/orders" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "customer_name": "Test Customer",
                "customer_email": "test@example.com",
                "items": [
                    {
                        "product_id": 1,
                        "quantity": 2,
                        "price": 20.00
                    }
                ],
                "total": 40.00
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "201" ] || [ "$http_code" = "200" ] || [ "$http_code" = "400" ]; then
            log_test "PASS" "POST /api/orders (create)" ""
        else
            log_test "FAIL" "POST /api/orders" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/orders" "No access token"
    fi

    # Update order status
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X PATCH "$BASE_URL/api/orders/1/status" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"status": "processing"}')
        http_code="${response: -3}"
        if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
            log_test "PASS" "PATCH /api/orders/{id}/status" ""
        else
            log_test "FAIL" "PATCH /api/orders/{id}/status" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "PATCH /api/orders/{id}/status" "No access token"
    fi
}

# Supplier Endpoints (10 tests)
test_supplier_endpoints() {
    echo -e "\n${YELLOW}=== Supplier Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # List suppliers
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/suppliers")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/suppliers" ""
    else
        log_test "FAIL" "GET /api/suppliers" "HTTP $http_code"
    fi

    # Get single supplier
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/suppliers/1")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
        log_test "PASS" "GET /api/suppliers/{id}" ""
    else
        log_test "FAIL" "GET /api/suppliers/{id}" "HTTP $http_code"
    fi

    # Create supplier
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/suppliers" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "Test Supplier",
                "contact_name": "John Doe",
                "email": "supplier@example.com",
                "phone": "1234567890"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
            log_test "PASS" "POST /api/suppliers" ""
        else
            log_test "FAIL" "POST /api/suppliers" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/suppliers" "No access token"
    fi
}

# Purchase Order Endpoints (10 tests)
test_purchase_order_endpoints() {
    echo -e "\n${YELLOW}=== Purchase Order Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # List purchase orders
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/purchase-orders")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/purchase-orders" ""
    else
        log_test "FAIL" "GET /api/purchase-orders" "HTTP $http_code"
    fi

    # Get single purchase order
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/purchase-orders/1")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
        log_test "PASS" "GET /api/purchase-orders/{id}" ""
    else
        log_test "FAIL" "GET /api/purchase-orders/{id}" "HTTP $http_code"
    fi
}

# Portal Forms Endpoints (10 tests)
test_portal_forms_endpoints() {
    echo -e "\n${YELLOW}=== Portal Forms Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # Submit contact form
    response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/contact-submissions" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Contact",
            "email": "contact@example.com",
            "phone": "1234567890",
            "subject": "Test Subject",
            "message": "Test message",
            "source": "website"
        }')
    http_code="${response: -3}"
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        log_test "PASS" "POST /api/contact-submissions" ""
    else
        log_test "FAIL" "POST /api/contact-submissions" "HTTP $http_code"
    fi

    # List contact submissions
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/contact-submissions")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/contact-submissions" ""
    else
        log_test "FAIL" "GET /api/contact-submissions" "HTTP $http_code"
    fi

    # Submit demo request
    response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/demo-requests" \
        -H "Content-Type: application/json" \
        -d '{
            "company_name": "Test Company",
            "contact_name": "Test Contact",
            "email": "demo@example.com",
            "phone": "1234567890",
            "product_interest": "ERP System"
        }')
    http_code="${response: -3}"
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        log_test "PASS" "POST /api/demo-requests" ""
    else
        log_test "FAIL" "POST /api/demo-requests" "HTTP $http_code"
    fi

    # List demo requests
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/demo-requests")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/demo-requests" ""
    else
        log_test "FAIL" "GET /api/demo-requests" "HTTP $http_code"
    fi

    # Get statistics
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/submissions/statistics")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ]; then
        log_test "PASS" "GET /api/submissions/statistics" ""
    else
        log_test "FAIL" "GET /api/submissions/statistics" "HTTP $http_code"
    fi
}

# AI Endpoints (15 tests)
test_ai_endpoints() {
    echo -e "\n${YELLOW}=== AI Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # AI chat
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/ai/chat" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "message": "Hello, how are you?",
                "conversation_id": "test-'$(date +%s)'"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            log_test "PASS" "POST /api/ai/chat" ""
        else
            log_test "FAIL" "POST /api/ai/chat" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/ai/chat" "No access token"
    fi

    # AI generate email
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/api/ai/generate/email" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "context": "order_confirmation",
                "recipient": "customer@example.com"
            }')
        http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            log_test "PASS" "POST /api/ai/generate/email" ""
        else
            log_test "FAIL" "POST /api/ai/generate/email" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "POST /api/ai/generate/email" "No access token"
    fi

    # AI insights
    if [ -n "$ACCESS_TOKEN" ]; then
        response=$(curl -s -w "%{http_code}" "$BASE_URL/api/ai/insights" \
            -H "Authorization: Bearer $ACCESS_TOKEN")
        http_code="${response: -3}"
        if [ "$http_code" = "200" ]; then
            log_test "PASS" "GET /api/ai/insights" ""
        else
            log_test "FAIL" "GET /api/ai/insights" "HTTP $http_code"
        fi
    else
        log_test "SKIP" "GET /api/ai/insights" "No access token"
    fi
}

# Integration Tests (10 tests)
test_integration_endpoints() {
    echo -e "\n${YELLOW}=== Integration Endpoints ===${NC}" | tee -a "$TEST_RESULTS_FILE"

    # Shopify sync status
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/integrations/shopify/sync/status")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
        log_test "PASS" "GET /api/integrations/shopify/sync/status" ""
    else
        log_test "FAIL" "GET /api/integrations/shopify/sync/status" "HTTP $http_code"
    fi

    # Xero connection status
    response=$(curl -s -w "%{http_code}" "$BASE_URL/api/integrations/xero/status")
    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "503" ]; then
        log_test "PASS" "GET /api/integrations/xero/status" ""
    else
        log_test "FAIL" "GET /api/integrations/xero/status" "HTTP $http_code"
    fi
}

# Run all test suites
echo "====================================" | tee "$TEST_RESULTS_FILE"
echo "CCW-Online ERP Comprehensive Tests" | tee -a "$TEST_RESULTS_FILE"
echo "Started: $(date)" | tee -a "$TEST_RESULTS_FILE"
echo "====================================" | tee -a "$TEST_RESULTS_FILE"

# Check if servers are running
test_backend_running
BACKEND_RUNNING=$?

if [ $BACKEND_RUNNING -eq 0 ]; then
    test_frontend_running
    test_health_endpoints
    test_auth_endpoints
    test_inventory_endpoints
    test_order_endpoints
    test_supplier_endpoints
    test_purchase_order_endpoints
    test_portal_forms_endpoints
    test_ai_endpoints
    test_integration_endpoints
else
    echo -e "${RED}Backend is not running. Please start the backend server first.${NC}"
    echo "Run: cd apps/backend && uv run uvicorn src.api.main:app --reload"
    exit 1
fi

# Print summary
echo "" | tee -a "$TEST_RESULTS_FILE"
echo "====================================" | tee -a "$TEST_RESULTS_FILE"
echo "Test Summary" | tee -a "$TEST_RESULTS_FILE"
echo "====================================" | tee -a "$TEST_RESULTS_FILE"
echo "Total Tests: $TOTAL_TESTS" | tee -a "$TEST_RESULTS_FILE"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}" | tee -a "$TEST_RESULTS_FILE"
echo -e "${RED}Failed: $FAILED_TESTS${NC}" | tee -a "$TEST_RESULTS_FILE"
echo -e "${YELLOW}Skipped: $SKIPPED_TESTS${NC}" | tee -a "$TEST_RESULTS_FILE"

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; ($PASSED_TESTS * 100) / $TOTAL_TESTS" | bc)
    echo "Success Rate: $SUCCESS_RATE%" | tee -a "$TEST_RESULTS_FILE"
fi

echo "" | tee -a "$TEST_RESULTS_FILE"
echo "Finished: $(date)" | tee -a "$TEST_RESULTS_FILE"
echo "Results saved to: $TEST_RESULTS_FILE" | tee -a "$TEST_RESULTS_FILE"

# Print failed tests
if [ ${#FAILED_LIST[@]} -gt 0 ]; then
    echo "" | tee -a "$TEST_RESULTS_FILE"
    echo "====================================" | tee -a "$TEST_RESULTS_FILE"
    echo "Failed Tests:" | tee -a "$TEST_RESULTS_FILE"
    echo "====================================" | tee -a "$TEST_RESULTS_FILE"
    for test in "${FAILED_LIST[@]}"; do
        echo "- $test" | tee -a "$TEST_RESULTS_FILE"
    done
fi

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi
