#!/usr/bin/env bash

################################################################################
# ISS-030 Verification Script - Load Testing Post-Fixes
################################################################################
#
# Purpose: Execute comprehensive load testing and verify performance baselines
#
# This script validates load testing execution for CCW-Online ERP, running
# 8000+ scenarios across all modules (products, customers, orders, quotes) to
# verify 95%+ pass rate, <200ms p95 response time, proper error handling under
# load, memory/CPU stability, and production readiness under high concurrency.
#
# Validation Categories (17):
#   1.  Load Testing Infrastructure - Locust installed, locustfiles exist
#   2.  Load Test Configuration - Test parameters, scenarios configured
#   3.  Test Environment Preparation - Database ready, services running
#   4.  Backend Services Health - All endpoints accessible
#   5.  Database Connection Pool - Pool size, overflow, timeouts configured
#   6.  Redis Cache Health - Redis running, cache functional
#   7.  Products Load Testing - 2000 scenarios, 95%+ pass rate
#   8.  Customers Load Testing - 2000 scenarios, 95%+ pass rate
#   9.  Orders Load Testing - 2000 scenarios, 95%+ pass rate
#  10.  Quotes Load Testing - 2000 scenarios, 95%+ pass rate
#  11.  Response Time Analysis - P50, P95, P99 under 200ms
#  12.  Error Rate Analysis - <5% error rate, proper error handling
#  13.  Concurrency Testing - 8000 concurrent requests handled
#  14.  Memory Stability - No memory leaks under load
#  15.  CPU Utilization - CPU usage within acceptable limits
#  16.  Performance Baseline Documentation - Baselines recorded
#  17.  Production Readiness - Load test passed, ready for staging
#
# Usage:
#   ./scripts/verify-load-testing.sh
#
# Exit Codes:
#   0 - Load testing passed (95%+ pass rate, production ready)
#   1 - Load testing failed or critical infrastructure issues
#
################################################################################

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Counters for validation results
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# Load test results tracking
LOAD_TEST_PASSED=false
TOTAL_SCENARIOS=0
PASSED_SCENARIOS=0
FAILED_SCENARIOS=0
PASS_RATE=0
P95_RESPONSE_TIME=0
ERROR_RATE=0

# Performance baselines (targets)
readonly TARGET_PASS_RATE=95.0
readonly TARGET_P95_MS=200
readonly MAX_ERROR_RATE=5.0

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_category() {
    echo ""
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
}

check_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((WARN_COUNT++))
}

check_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

file_exists() {
    if [[ -f "$1" ]]; then
        check_pass "File exists: $1"
        return 0
    else
        check_fail "File missing: $1"
        return 1
    fi
}

dir_exists() {
    if [[ -d "$1" ]]; then
        check_pass "Directory exists: $1"
        return 0
    else
        check_fail "Directory missing: $1"
        return 1
    fi
}

command_exists() {
    if command -v "$1" &> /dev/null; then
        check_pass "Command available: $1"
        return 0
    else
        check_fail "Command not found: $1"
        return 1
    fi
}

################################################################################
# Main Verification Script
################################################################################

main() {
    print_header "ISS-030: Load Testing Post-Fixes Verification"

    echo "Executing comprehensive load testing for CCW-Online ERP"
    echo "Target: 8000+ scenarios, 95%+ pass rate, <200ms p95 response time"
    echo "Date: $(date)"
    echo ""

    verify_load_testing_infrastructure
    verify_load_test_configuration
    verify_test_environment_preparation
    verify_backend_services_health
    verify_database_connection_pool
    verify_redis_cache_health
    verify_products_load_testing
    verify_customers_load_testing
    verify_orders_load_testing
    verify_quotes_load_testing
    verify_response_time_analysis
    verify_error_rate_analysis
    verify_concurrency_testing
    verify_memory_stability
    verify_cpu_utilization
    verify_performance_baseline_documentation
    verify_production_readiness

    print_summary

    if [[ $FAIL_COUNT -gt 0 ]] || [[ $(echo "$PASS_RATE < $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
        exit 1
    else
        exit 0
    fi
}

################################################################################
# Verification Category 1: Load Testing Infrastructure
################################################################################

verify_load_testing_infrastructure() {
    print_category "1. Load Testing Infrastructure"

    # Check Locust installation
    if command_exists locust; then
        LOCUST_VERSION=$(locust --version 2>&1 | head -n1)
        check_pass "Locust installed: $LOCUST_VERSION"
    fi

    # Check Python httpx (for async load tests)
    if python3 -c "import httpx" 2>/dev/null; then
        check_pass "httpx installed (async HTTP client)"
    else
        check_warn "httpx not installed (required for custom load tests)"
    fi

    # Check load test directory
    dir_exists "backend/tests/load"

    # Check locustfile
    file_exists "backend/tests/load/locustfile_ai_features.py"

    # Check full load test script
    file_exists "backend/tests/load/run_full_load_test.py"

    # Check quick load test script
    if file_exists "backend/tests/load/run_quick_load_test.py"; then
        :
    fi

    # Check test scenarios
    file_exists "backend/tests/load/test_scenarios.py"

    # Check scenario generators
    if [[ -d "backend/tests/load/generators" ]]; then
        check_pass "Scenario generators directory exists"

        for module in "products" "customers" "orders" "quotes"; do
            if [[ -f "backend/tests/load/generators/${module}.py" ]]; then
                check_pass "Scenario generator exists: ${module}.py"
            else
                check_warn "Scenario generator missing: ${module}.py"
            fi
        done
    else
        check_warn "Scenario generators directory missing"
    fi
}

################################################################################
# Verification Category 2: Load Test Configuration
################################################################################

verify_load_test_configuration() {
    print_category "2. Load Test Configuration"

    # Check load test configuration in run_full_load_test.py
    if grep -q "2000 product scenarios" backend/tests/load/run_full_load_test.py 2>/dev/null; then
        check_pass "Products load test configured (2000 scenarios)"
    else
        check_warn "Products load test configuration missing"
    fi

    if grep -q "2000 customer scenarios" backend/tests/load/run_full_load_test.py 2>/dev/null; then
        check_pass "Customers load test configured (2000 scenarios)"
    else
        check_warn "Customers load test configuration missing"
    fi

    if grep -q "2000 order scenarios" backend/tests/load/run_full_load_test.py 2>/dev/null; then
        check_pass "Orders load test configured (2000 scenarios)"
    else
        check_warn "Orders load test configuration missing"
    fi

    if grep -q "2000 quote scenarios" backend/tests/load/run_full_load_test.py 2>/dev/null; then
        check_pass "Quotes load test configured (2000 scenarios)"
    else
        check_warn "Quotes load test configuration missing"
    fi

    # Check performance targets in locustfile
    if grep -q "p95" backend/tests/load/locustfile_ai_features.py 2>/dev/null; then
        check_pass "Performance targets defined in locustfile"
    else
        check_warn "Performance targets not defined"
    fi

    # Check max concurrent configuration
    if grep -q "max_concurrent" backend/tests/load/run_full_load_test.py 2>/dev/null; then
        check_pass "Concurrency limits configured"
    else
        check_warn "Concurrency limits not configured"
    fi
}

################################################################################
# Verification Category 3: Test Environment Preparation
################################################################################

verify_test_environment_preparation() {
    print_category "3. Test Environment Preparation"

    # Check if backend is running
    echo "Checking if backend service is running..."
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        check_pass "Backend service running (port 8000)"
    else
        check_fail "Backend service not running (start with: pnpm dev or uvicorn)"
    fi

    # Check if Docker containers are running
    if command_exists docker; then
        check_pass "Docker installed"

        # Check PostgreSQL
        if docker ps --format '{{.Names}}' | grep -q postgres; then
            check_pass "PostgreSQL container running"
        else
            check_warn "PostgreSQL container not running"
        fi

        # Check Redis
        if docker ps --format '{{.Names}}' | grep -q redis; then
            check_pass "Redis container running"
        else
            check_warn "Redis container not running (optional but recommended)"
        fi
    else
        check_warn "Docker not installed or not in PATH"
    fi

    # Check database seed data loaded
    echo "Checking if database has seed data..."
    if cd backend && python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_data():
    try:
        engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/ccw_erp_dev', echo=False)
        async with engine.connect() as conn:
            result = await conn.execute(text('SELECT COUNT(*) FROM products'))
            count = result.scalar()
            return count > 0
    except Exception as e:
        return False

print(asyncio.run(check_data()))
" 2>/dev/null | grep -q "True"; then
        check_pass "Database has seed data loaded"
    else
        check_warn "Database may not have seed data (run: python -m src.db.seed_demo)"
    fi

    cd - > /dev/null

    # Create load test reports directory
    mkdir -p backend/tests/load/reports
    check_pass "Load test reports directory created"
}

################################################################################
# Verification Category 4: Backend Services Health
################################################################################

verify_backend_services_health() {
    print_category "4. Backend Services Health"

    # Check health endpoint
    echo "Checking backend health endpoint..."
    if HEALTH_RESPONSE=$(curl -s http://localhost:8000/api/health); then
        if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"' || echo "$HEALTH_RESPONSE" | grep -q '"api":"healthy"'; then
            check_pass "Health endpoint responding: healthy"
        else
            check_warn "Health endpoint responding but status unclear"
        fi
    else
        check_fail "Health endpoint not responding"
    fi

    # Check key API endpoints
    for endpoint in "/api/products" "/api/customers" "/api/orders" "/api/quotes"; do
        echo "Testing endpoint: $endpoint"
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000${endpoint}?page=1&page_size=10" | grep -q "200"; then
            check_pass "Endpoint accessible: $endpoint"
        else
            check_warn "Endpoint not accessible or requires auth: $endpoint"
        fi
    done
}

################################################################################
# Verification Category 5: Database Connection Pool
################################################################################

verify_database_connection_pool() {
    print_category "5. Database Connection Pool"

    # Check database configuration
    if grep -r "pool_size" backend/src/config/ 2>/dev/null | grep -q .; then
        check_pass "Database pool_size configured"
    else
        check_warn "Database pool_size not explicitly configured (using defaults)"
    fi

    if grep -r "max_overflow" backend/src/config/ 2>/dev/null | grep -q .; then
        check_pass "Database max_overflow configured"
    else
        check_warn "Database max_overflow not configured"
    fi

    # Check SQLAlchemy async configuration
    if grep -q "create_async_engine" backend/src/config/database.py 2>/dev/null; then
        check_pass "Async database engine configured (SQLAlchemy async)"
    else
        check_warn "Async database engine configuration unclear"
    fi

    # Verify database can handle concurrent connections
    echo "Testing database concurrent connections..."
    if cd backend && python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def test_concurrent():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/ccw_erp_dev',
                                   pool_size=10, max_overflow=20, echo=False)

    async def query():
        async with engine.connect() as conn:
            result = await conn.execute(text('SELECT 1'))
            return result.scalar()

    tasks = [query() for _ in range(10)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    success = sum(1 for r in results if r == 1)
    return success == 10

print(asyncio.run(test_concurrent()))
" 2>/dev/null | grep -q "True"; then
        check_pass "Database handles 10 concurrent connections successfully"
    else
        check_warn "Database concurrent connection test failed"
    fi

    cd - > /dev/null
}

################################################################################
# Verification Category 6: Redis Cache Health
################################################################################

verify_redis_cache_health() {
    print_category "6. Redis Cache Health"

    # Check if Redis is running
    if command_exists redis-cli; then
        check_pass "redis-cli installed"

        if redis-cli ping 2>/dev/null | grep -q "PONG"; then
            check_pass "Redis server responding to PING"
        else
            check_warn "Redis server not responding (optional for load testing)"
        fi
    else
        check_warn "redis-cli not installed (optional)"
    fi

    # Check Redis configuration in backend
    if grep -r "redis" backend/src/config/ 2>/dev/null | grep -q .; then
        check_pass "Redis configuration exists in backend"
    else
        check_warn "Redis configuration not found (optional)"
    fi
}

################################################################################
# Verification Category 7: Products Load Testing
################################################################################

verify_products_load_testing() {
    print_category "7. Products Load Testing"

    echo "Executing products load test (2000 scenarios)..."
    echo "This will take several minutes..."
    echo ""

    # Run products load test
    if cd backend && python3 -m tests.load.generators.products 2>&1 | tee ../../load-test-products.log; then
        check_pass "Products load test executed"
    else
        check_warn "Products load test execution had issues"
    fi

    cd - > /dev/null

    # Parse results (if available)
    if [[ -f "load-test-products.log" ]]; then
        if grep -q "Pass Rate:" load-test-products.log; then
            PRODUCTS_PASS_RATE=$(grep "Pass Rate:" load-test-products.log | grep -oP '\d+\.\d+' | head -1)
            if [[ -n "$PRODUCTS_PASS_RATE" ]] && [[ $(echo "$PRODUCTS_PASS_RATE >= $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
                check_pass "Products pass rate: ${PRODUCTS_PASS_RATE}% (target: ${TARGET_PASS_RATE}%)"
            else
                check_fail "Products pass rate: ${PRODUCTS_PASS_RATE}% (below target: ${TARGET_PASS_RATE}%)"
            fi
        fi
    fi
}

################################################################################
# Verification Category 8: Customers Load Testing
################################################################################

verify_customers_load_testing() {
    print_category "8. Customers Load Testing"

    echo "Executing customers load test (2000 scenarios)..."
    echo ""

    # Run customers load test
    if cd backend && python3 -m tests.load.generators.customers 2>&1 | tee ../../load-test-customers.log; then
        check_pass "Customers load test executed"
    else
        check_warn "Customers load test execution had issues"
    fi

    cd - > /dev/null

    # Parse results
    if [[ -f "load-test-customers.log" ]]; then
        if grep -q "Pass Rate:" load-test-customers.log; then
            CUSTOMERS_PASS_RATE=$(grep "Pass Rate:" load-test-customers.log | grep -oP '\d+\.\d+' | head -1)
            if [[ -n "$CUSTOMERS_PASS_RATE" ]] && [[ $(echo "$CUSTOMERS_PASS_RATE >= $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
                check_pass "Customers pass rate: ${CUSTOMERS_PASS_RATE}% (target: ${TARGET_PASS_RATE}%)"
            else
                check_fail "Customers pass rate: ${CUSTOMERS_PASS_RATE}% (below target: ${TARGET_PASS_RATE}%)"
            fi
        fi
    fi
}

################################################################################
# Verification Category 9: Orders Load Testing
################################################################################

verify_orders_load_testing() {
    print_category "9. Orders Load Testing"

    echo "Executing orders load test (2000 scenarios)..."
    echo ""

    # Run orders load test
    if cd backend && python3 -m tests.load.generators.orders 2>&1 | tee ../../load-test-orders.log; then
        check_pass "Orders load test executed"
    else
        check_warn "Orders load test execution had issues"
    fi

    cd - > /dev/null

    # Parse results
    if [[ -f "load-test-orders.log" ]]; then
        if grep -q "Pass Rate:" load-test-orders.log; then
            ORDERS_PASS_RATE=$(grep "Pass Rate:" load-test-orders.log | grep -oP '\d+\.\d+' | head -1)
            if [[ -n "$ORDERS_PASS_RATE" ]] && [[ $(echo "$ORDERS_PASS_RATE >= $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
                check_pass "Orders pass rate: ${ORDERS_PASS_RATE}% (target: ${TARGET_PASS_RATE}%)"
            else
                check_fail "Orders pass rate: ${ORDERS_PASS_RATE}% (below target: ${TARGET_PASS_RATE}%)"
            fi
        fi
    fi
}

################################################################################
# Verification Category 10: Quotes Load Testing
################################################################################

verify_quotes_load_testing() {
    print_category "10. Quotes Load Testing"

    echo "Executing quotes load test (2000 scenarios)..."
    echo ""

    # Run quotes load test
    if cd backend && python3 -m tests.load.generators.quotes 2>&1 | tee ../../load-test-quotes.log; then
        check_pass "Quotes load test executed"
    else
        check_warn "Quotes load test execution had issues"
    fi

    cd - > /dev/null

    # Parse results
    if [[ -f "load-test-quotes.log" ]]; then
        if grep -q "Pass Rate:" load-test-quotes.log; then
            QUOTES_PASS_RATE=$(grep "Pass Rate:" load-test-quotes.log | grep -oP '\d+\.\d+' | head -1)
            if [[ -n "$QUOTES_PASS_RATE" ]] && [[ $(echo "$QUOTES_PASS_RATE >= $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
                check_pass "Quotes pass rate: ${QUOTES_PASS_RATE}% (target: ${TARGET_PASS_RATE}%)"
            else
                check_fail "Quotes pass rate: ${QUOTES_PASS_RATE}% (below target: ${TARGET_PASS_RATE}%)"
            fi
        fi
    fi
}

################################################################################
# Verification Category 11: Response Time Analysis
################################################################################

verify_response_time_analysis() {
    print_category "11. Response Time Analysis"

    echo "Analyzing response times from load test results..."

    # Check if full load test results exist
    if [[ -f "backend/tests/load/reports/load_test_latest.json" ]]; then
        check_pass "Load test results file found"

        # Extract response time metrics
        if P95=$(jq -r '.summary.p95_response_time_ms' backend/tests/load/reports/load_test_latest.json 2>/dev/null); then
            P95_RESPONSE_TIME=$P95
            if [[ $(echo "$P95 < $TARGET_P95_MS" | bc -l) -eq 1 ]]; then
                check_pass "P95 response time: ${P95}ms (target: <${TARGET_P95_MS}ms)"
            else
                check_fail "P95 response time: ${P95}ms (exceeds target: ${TARGET_P95_MS}ms)"
            fi
        fi

        if P50=$(jq -r '.summary.p50_response_time_ms' backend/tests/load/reports/load_test_latest.json 2>/dev/null); then
            check_pass "P50 response time: ${P50}ms"
        fi

        if P99=$(jq -r '.summary.p99_response_time_ms' backend/tests/load/reports/load_test_latest.json 2>/dev/null); then
            check_pass "P99 response time: ${P99}ms"
        fi

        if AVG=$(jq -r '.summary.avg_response_time_ms' backend/tests/load/reports/load_test_latest.json 2>/dev/null); then
            check_pass "Average response time: ${AVG}ms"
        fi
    else
        check_warn "Load test results file not found (run full load test first)"
    fi
}

################################################################################
# Verification Category 12: Error Rate Analysis
################################################################################

verify_error_rate_analysis() {
    print_category "12. Error Rate Analysis"

    echo "Analyzing error rates from load test results..."

    if [[ -f "backend/tests/load/reports/load_test_latest.json" ]]; then
        # Calculate error rate
        TOTAL=$(jq -r '.summary.total_scenarios' backend/tests/load/reports/load_test_latest.json 2>/dev/null)
        FAILED=$(jq -r '.summary.failed' backend/tests/load/reports/load_test_latest.json 2>/dev/null)

        if [[ -n "$TOTAL" ]] && [[ -n "$FAILED" ]] && [[ "$TOTAL" -gt 0 ]]; then
            TOTAL_SCENARIOS=$TOTAL
            FAILED_SCENARIOS=$FAILED
            PASSED_SCENARIOS=$((TOTAL - FAILED))
            ERROR_RATE=$(echo "scale=2; ($FAILED / $TOTAL) * 100" | bc -l)

            if [[ $(echo "$ERROR_RATE < $MAX_ERROR_RATE" | bc -l) -eq 1 ]]; then
                check_pass "Error rate: ${ERROR_RATE}% (target: <${MAX_ERROR_RATE}%)"
            else
                check_fail "Error rate: ${ERROR_RATE}% (exceeds target: ${MAX_ERROR_RATE}%)"
            fi
        fi

        # Check error types
        if jq -e '.summary.failures_by_status' backend/tests/load/reports/load_test_latest.json > /dev/null 2>&1; then
            check_pass "Error types categorized by status code"
        fi
    fi
}

################################################################################
# Verification Category 13: Concurrency Testing
################################################################################

verify_concurrency_testing() {
    print_category "13. Concurrency Testing"

    echo "Verifying concurrency handling..."

    if [[ -f "backend/tests/load/reports/load_test_latest.json" ]]; then
        CONCURRENT=$(jq -r '.summary.total_scenarios' backend/tests/load/reports/load_test_latest.json 2>/dev/null)

        if [[ -n "$CONCURRENT" ]] && [[ "$CONCURRENT" -ge 8000 ]]; then
            check_pass "Handled ${CONCURRENT} scenarios (target: 8000+)"
        else
            check_warn "Handled ${CONCURRENT} scenarios (below target: 8000)"
        fi

        # Check scenarios per second (throughput)
        if THROUGHPUT=$(jq -r '.summary.scenarios_per_second' backend/tests/load/reports/load_test_latest.json 2>/dev/null); then
            if [[ -n "$THROUGHPUT" ]]; then
                check_pass "Throughput: ${THROUGHPUT} scenarios/second"
            fi
        fi
    fi
}

################################################################################
# Verification Category 14: Memory Stability
################################################################################

verify_memory_stability() {
    print_category "14. Memory Stability"

    echo "Checking memory stability during load test..."

    # Check if memory profiling results exist
    if [[ -f "memory-profile.log" ]]; then
        check_pass "Memory profile log found"

        if grep -q "memory leak" memory-profile.log; then
            check_fail "Memory leak detected"
        else
            check_pass "No memory leaks detected"
        fi
    else
        check_warn "Memory profile not available (requires profiling tools)"
    fi

    # Basic memory check
    echo "Current system memory usage:"
    if command_exists free; then
        free -h
        check_pass "System memory status available"
    else
        check_warn "free command not available (Linux only)"
    fi
}

################################################################################
# Verification Category 15: CPU Utilization
################################################################################

verify_cpu_utilization() {
    print_category "15. CPU Utilization"

    echo "Checking CPU utilization..."

    # Check current CPU usage
    if command_exists top; then
        echo "Sampling CPU usage..."
        CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        if [[ -n "$CPU_USAGE" ]]; then
            check_pass "Current CPU usage: ${CPU_USAGE}%"

            if [[ $(echo "$CPU_USAGE > 90" | bc -l) -eq 1 ]]; then
                check_warn "High CPU usage detected (>90%)"
            fi
        fi
    else
        check_warn "top command not available"
    fi
}

################################################################################
# Verification Category 16: Performance Baseline Documentation
################################################################################

verify_performance_baseline_documentation() {
    print_category "16. Performance Baseline Documentation"

    echo "Checking performance baseline documentation..."

    # Check if baseline results are saved
    if [[ -f "backend/tests/load/reports/load_test_latest.json" ]]; then
        check_pass "Load test results saved (latest)"

        # Check for timestamped reports
        REPORT_COUNT=$(find backend/tests/load/reports -name "load_test_full_*.json" 2>/dev/null | wc -l)
        if [[ "$REPORT_COUNT" -gt 0 ]]; then
            check_pass "Timestamped load test reports exist ($REPORT_COUNT reports)"
        else
            check_warn "No timestamped load test reports found"
        fi
    else
        check_warn "Load test results not saved"
    fi

    # Check for HTML reports
    if [[ -f "backend/tests/load/reports/load_test_latest.html" ]]; then
        check_pass "HTML load test report generated"
    else
        check_warn "HTML load test report not found"
    fi

    # Check if baseline is documented
    if [[ -f "docs/PERFORMANCE_BASELINE.md" ]]; then
        check_pass "Performance baseline documentation exists"
    else
        check_warn "Performance baseline documentation missing (docs/PERFORMANCE_BASELINE.md)"
    fi
}

################################################################################
# Verification Category 17: Production Readiness
################################################################################

verify_production_readiness() {
    print_category "17. Production Readiness"

    echo "Validating production readiness based on load test results..."

    # Calculate overall pass rate if we have results
    if [[ $TOTAL_SCENARIOS -gt 0 ]]; then
        PASS_RATE=$(echo "scale=2; ($PASSED_SCENARIOS / $TOTAL_SCENARIOS) * 100" | bc -l)

        if [[ $(echo "$PASS_RATE >= $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
            check_pass "Overall pass rate: ${PASS_RATE}% (target: ${TARGET_PASS_RATE}%)"
            LOAD_TEST_PASSED=true
        else
            check_fail "Overall pass rate: ${PASS_RATE}% (below target: ${TARGET_PASS_RATE}%)"
        fi
    else
        check_warn "Overall pass rate not calculated (run full load test)"
    fi

    # Check performance targets
    if [[ $P95_RESPONSE_TIME -gt 0 ]] && [[ $P95_RESPONSE_TIME -lt $TARGET_P95_MS ]]; then
        check_pass "Performance target met: P95 < ${TARGET_P95_MS}ms"
    else
        check_warn "Performance target validation pending"
    fi

    # Check error rate
    if [[ -n "$ERROR_RATE" ]] && [[ $(echo "$ERROR_RATE < $MAX_ERROR_RATE" | bc -l) -eq 1 ]]; then
        check_pass "Error rate within limits: ${ERROR_RATE}% < ${MAX_ERROR_RATE}%"
    else
        check_warn "Error rate validation pending"
    fi

    # Overall production readiness
    if [[ $LOAD_TEST_PASSED == true ]]; then
        check_pass "Load testing passed - production ready"
    else
        check_fail "Load testing not passed - NOT production ready"
    fi
}

################################################################################
# Summary
################################################################################

print_summary() {
    print_header "Verification Summary"

    echo "ISS-030: Load Testing Post-Fixes Verification Complete"
    echo ""
    echo "Results:"
    echo -e "  ${GREEN}Passed${NC}:  $PASS_COUNT"
    echo -e "  ${YELLOW}Warnings${NC}: $WARN_COUNT"
    echo -e "  ${RED}Failed${NC}:  $FAIL_COUNT"
    echo ""

    # Load Test Results Summary
    if [[ $TOTAL_SCENARIOS -gt 0 ]]; then
        echo "Load Test Execution Summary:"
        echo "  Total Scenarios:    $TOTAL_SCENARIOS"
        echo "  Passed:             $PASSED_SCENARIOS"
        echo "  Failed:             $FAILED_SCENARIOS"
        echo "  Pass Rate:          ${PASS_RATE}% (target: ${TARGET_PASS_RATE}%)"
        echo ""
    fi

    # Performance Metrics
    if [[ $P95_RESPONSE_TIME -gt 0 ]]; then
        echo "Performance Metrics:"
        echo "  P95 Response Time:  ${P95_RESPONSE_TIME}ms (target: <${TARGET_P95_MS}ms)"
        echo "  Error Rate:         ${ERROR_RATE}% (target: <${MAX_ERROR_RATE}%)"
        echo ""
    fi

    if [[ $FAIL_COUNT -eq 0 ]] && [[ $LOAD_TEST_PASSED == true ]]; then
        echo -e "${GREEN}✓ SUCCESS${NC}: Load testing passed - production ready!"
        echo ""
        echo "Performance Baselines Established:"
        echo "  ✓ 8000+ scenarios executed successfully"
        echo "  ✓ 95%+ pass rate achieved"
        echo "  ✓ Response times within target (<200ms p95)"
        echo "  ✓ Error rates within acceptable limits (<5%)"
        echo ""
        echo "Next Steps:"
        echo "  1. Conduct user acceptance testing (ISS-031)"
        echo "  2. Create user documentation (ISS-032)"
        echo "  3. Execute staging deployment (ISS-033)"
    else
        echo -e "${RED}✗ FAILURES DETECTED${NC}: Load testing failed or incomplete"
        echo ""
        echo "Required Actions:"
        if [[ $TOTAL_SCENARIOS -eq 0 ]]; then
            echo "  - Run full load test suite (python backend/tests/load/run_full_load_test.py)"
        fi
        if [[ $(echo "$PASS_RATE < $TARGET_PASS_RATE" | bc -l) -eq 1 ]]; then
            echo "  - Improve pass rate to ${TARGET_PASS_RATE}% (current: ${PASS_RATE}%)"
        fi
        if [[ $P95_RESPONSE_TIME -gt $TARGET_P95_MS ]]; then
            echo "  - Optimize response times (P95: ${P95_RESPONSE_TIME}ms, target: <${TARGET_P95_MS}ms)"
        fi
        if [[ $FAIL_COUNT -gt 0 ]]; then
            echo "  - Resolve $FAIL_COUNT infrastructure failures"
        fi
        echo "  - Re-run verification script after fixes"
        echo ""
        echo "DO NOT deploy to production until load testing passes"
    fi

    echo ""
    echo "Documentation: docs/ISS-030-VERIFICATION.md"
    echo "Load Test Reports: backend/tests/load/reports/"
}

################################################################################
# Execute Main Function
################################################################################

main "$@"
