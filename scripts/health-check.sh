#!/bin/bash

################################################################################
# CCW-Online ERP - Health Check Script
#
# Purpose: Verify deployment health after CI/CD deployment
#
# Usage:
#   ./scripts/health-check.sh [BASE_URL]
#
# Arguments:
#   BASE_URL - API base URL (default: http://localhost:8000)
#
# Exit Codes:
#   0 - All health checks passed
#   1 - One or more health checks failed
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BASE_URL="${1:-http://localhost:8000}"
MAX_RETRIES=10
RETRY_DELAY=5
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_CHECKS++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local method="${4:-GET}"

    ((TOTAL_CHECKS++))
    log_info "Checking: $name"

    local retry=0
    while [ $retry -lt $MAX_RETRIES ]; do
        if [ "$method" = "GET" ]; then
            status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        else
            status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")
        fi

        if [ "$status" = "$expected_status" ]; then
            log_pass "$name (HTTP $status)"
            return 0
        fi

        ((retry++))
        if [ $retry -lt $MAX_RETRIES ]; then
            log_warn "Retry $retry/$MAX_RETRIES (got HTTP $status, expected $expected_status)"
            sleep $RETRY_DELAY
        fi
    done

    log_fail "$name (got HTTP $status, expected $expected_status)"
    return 1
}

check_json_response() {
    local name="$1"
    local url="$2"
    local json_path="$3"
    local expected_value="$4"

    ((TOTAL_CHECKS++))
    log_info "Checking JSON: $name"

    response=$(curl -s "$url" 2>/dev/null || echo "{}")

    if command -v jq &> /dev/null; then
        actual_value=$(echo "$response" | jq -r "$json_path" 2>/dev/null || echo "null")

        if [ "$actual_value" = "$expected_value" ]; then
            log_pass "$name ($json_path = $actual_value)"
            return 0
        else
            log_fail "$name (expected $json_path = $expected_value, got $actual_value)"
            return 1
        fi
    else
        # Fallback if jq is not available
        if echo "$response" | grep -q "$expected_value"; then
            log_pass "$name (contains $expected_value)"
            return 0
        else
            log_fail "$name (expected to contain $expected_value)"
            return 1
        fi
    fi
}

################################################################################
# Health Check Suite
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         CCW-Online ERP - Health Check Suite                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Base URL: ${BASE_URL}"
echo "  Started:  $(date)"
echo ""

################################################################################
# 1. Basic Connectivity
################################################################################

echo ""
log_info "=== 1. Basic Connectivity ==="

check_endpoint "API Health Check" "${BASE_URL}/api/health" 200

################################################################################
# 2. API Status
################################################################################

echo ""
log_info "=== 2. API Status ==="

check_json_response "API Health Status" "${BASE_URL}/api/health" ".status" "healthy"

################################################################################
# 3. Database Connectivity (via API)
################################################################################

echo ""
log_info "=== 3. Database Connectivity ==="

# Products endpoint requires auth but should not return 500
check_endpoint "Products API Reachable" "${BASE_URL}/api/products" "401|200"

################################################################################
# 4. Authentication Endpoints
################################################################################

echo ""
log_info "=== 4. Authentication Endpoints ==="

check_endpoint "Login Endpoint Available" "${BASE_URL}/api/auth/login" "400|422" "POST"

################################################################################
# 5. Response Time Check
################################################################################

echo ""
log_info "=== 5. Response Time Check ==="

((TOTAL_CHECKS++))
log_info "Checking: Response Time"

response_time=$(curl -s -o /dev/null -w "%{time_total}" "${BASE_URL}/api/health" 2>/dev/null || echo "999")
response_time_ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "999000")

if (( $(echo "$response_time < 2.0" | bc -l 2>/dev/null || echo "0") )); then
    log_pass "Response time acceptable (${response_time}s)"
else
    log_fail "Response time too slow (${response_time}s, max 2.0s)"
fi

################################################################################
# Summary
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     Health Check Summary                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total Checks:  ${TOTAL_CHECKS}"
echo -e "  Passed:        ${GREEN}${PASSED_CHECKS}${NC}"
echo -e "  Failed:        ${RED}${FAILED_CHECKS}${NC}"

if [ $TOTAL_CHECKS -gt 0 ]; then
    success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo "  Success Rate:  ${success_rate}%"
fi

echo ""
echo "  Completed:     $(date)"
echo ""

if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}✅ All health checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ ${FAILED_CHECKS} health check(s) failed!${NC}"
    exit 1
fi
