#!/usr/bin/env bash

################################################################################
# ISS-029 Verification Script - Full Integration Test Suite
################################################################################
#
# Purpose: Verify complete integration test suite execution with 100% pass rate
#
# This script validates the complete integration test suite for CCW-Online ERP,
# ensuring all 39+ tests across backend and frontend pass successfully with proper
# coverage, no regressions, and production readiness validation.
#
# Validation Categories (17):
#   1.  Backend Test Infrastructure - Pytest installed, conftest.py configured
#   2.  Frontend Test Infrastructure - Vitest installed, test utilities configured
#   3.  Backend Test Files - API tests, unit tests, integration tests exist
#   4.  Frontend Test Files - Component tests, integration tests exist
#   5.  Test Database Configuration - Test database exists, seed data loaded
#   6.  Backend Test Execution - Run pytest with coverage
#   7.  Frontend Test Execution - Run Vitest with coverage
#   8.  Test Results Validation - All tests passing, no failures
#   9.  Test Coverage Analysis - Coverage meets minimum thresholds
#  10.  API Endpoint Testing - CRUD operations for all modules
#  11.  Authentication Testing - Login, logout, token validation
#  12.  Integration Testing - Shopify, Xero, AP2 integrations
#  13.  Regression Testing - Previously fixed issues still resolved
#  14.  Load Testing Preparation - Load test infrastructure ready
#  15.  Test Reporting - Test reports generated, artifacts saved
#  16.  Continuous Integration - CI pipeline configured for tests
#  17.  Production Readiness - All critical tests passing, ready to deploy
#
# Usage:
#   ./scripts/verify-integration-tests.sh
#
# Exit Codes:
#   0 - All tests passing (ready for production)
#   1 - Test failures or critical infrastructure issues
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

# Test results tracking
BACKEND_TESTS_PASSED=false
FRONTEND_TESTS_PASSED=false
BACKEND_TEST_COUNT=0
FRONTEND_TEST_COUNT=0
BACKEND_FAILURES=0
FRONTEND_FAILURES=0

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
    print_header "ISS-029: Full Integration Test Suite Verification"

    echo "Verifying complete integration test suite for CCW-Online ERP"
    echo "Target: 100% pass rate across all backend and frontend tests"
    echo "Date: $(date)"
    echo ""

    verify_backend_test_infrastructure
    verify_frontend_test_infrastructure
    verify_backend_test_files
    verify_frontend_test_files
    verify_test_database_configuration
    verify_backend_test_execution
    verify_frontend_test_execution
    verify_test_results_validation
    verify_test_coverage_analysis
    verify_api_endpoint_testing
    verify_authentication_testing
    verify_integration_testing
    verify_regression_testing
    verify_load_testing_preparation
    verify_test_reporting
    verify_continuous_integration
    verify_production_readiness

    print_summary

    if [[ $FAIL_COUNT -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

################################################################################
# Verification Category 1: Backend Test Infrastructure
################################################################################

verify_backend_test_infrastructure() {
    print_category "1. Backend Test Infrastructure"

    # Check pytest installation
    if command_exists pytest; then
        PYTEST_VERSION=$(pytest --version 2>&1 | head -n1)
        check_pass "pytest installed: $PYTEST_VERSION"
    fi

    # Check pytest-asyncio
    if python3 -c "import pytest_asyncio" 2>/dev/null; then
        check_pass "pytest-asyncio installed"
    else
        check_fail "pytest-asyncio not installed"
    fi

    # Check pytest-cov
    if python3 -c "import pytest_cov" 2>/dev/null; then
        check_pass "pytest-cov installed (coverage)"
    else
        check_warn "pytest-cov not installed (no coverage reports)"
    fi

    # Check conftest.py
    file_exists "apps/backend/tests/conftest.py"

    # Check pytest configuration in pyproject.toml
    if grep -q "tool.pytest.ini_options" apps/backend/pyproject.toml 2>/dev/null; then
        check_pass "pytest configuration exists in pyproject.toml"
    else
        check_fail "pytest configuration missing"
    fi

    # Check for test database environment variable
    if [[ -n "${DATABASE_URL:-}" ]] || [[ -n "${TEST_DATABASE_URL:-}" ]]; then
        check_pass "Test database environment variable configured"
    else
        check_warn "Test database environment variable not set"
    fi
}

################################################################################
# Verification Category 2: Frontend Test Infrastructure
################################################################################

verify_frontend_test_infrastructure() {
    print_category "2. Frontend Test Infrastructure"

    # Check Vitest installation
    if command_exists vitest; then
        check_pass "vitest installed"
    else
        check_fail "vitest not installed"
    fi

    # Check Vitest configuration
    if file_exists "apps/web/vitest.config.ts"; then
        :
    fi

    # Check testing-library packages
    if grep -q "@testing-library/react" apps/web/package.json 2>/dev/null; then
        check_pass "@testing-library/react installed"
    else
        check_warn "@testing-library/react not installed"
    fi

    # Check test directory exists
    dir_exists "apps/web/__tests__"

    # Check for test setup file
    if [[ -f "apps/web/__tests__/setup.ts" ]]; then
        check_pass "Test setup file exists"
    else
        check_warn "Test setup file missing (apps/web/__tests__/setup.ts)"
    fi
}

################################################################################
# Verification Category 3: Backend Test Files
################################################################################

verify_backend_test_files() {
    print_category "3. Backend Test Files"

    # Count test files
    BACKEND_TEST_FILES=$(find apps/backend/tests -name "test_*.py" -type f 2>/dev/null | wc -l)
    if [[ $BACKEND_TEST_FILES -gt 0 ]]; then
        check_pass "Backend test files found: $BACKEND_TEST_FILES"
    else
        check_fail "No backend test files found"
    fi

    # Check API tests
    if [[ -d "apps/backend/tests/api" ]]; then
        API_TESTS=$(find apps/backend/tests/api -name "test_*.py" 2>/dev/null | wc -l)
        check_pass "API tests found: $API_TESTS"
    else
        check_warn "API test directory missing"
    fi

    # Check unit tests
    if [[ -d "apps/backend/tests/unit" ]]; then
        UNIT_TESTS=$(find apps/backend/tests/unit -name "test_*.py" 2>/dev/null | wc -l)
        check_pass "Unit tests found: $UNIT_TESTS"
    else
        check_warn "Unit test directory missing"
    fi

    # Check integration tests
    if [[ -d "apps/backend/tests/integration" ]]; then
        INTEGRATION_TESTS=$(find apps/backend/tests/integration -name "test_*.py" 2>/dev/null | wc -l)
        check_pass "Integration tests found: $INTEGRATION_TESTS"
    else
        check_warn "Integration test directory missing"
    fi

    # Check security tests
    if [[ -d "apps/backend/tests/security" ]]; then
        SECURITY_TESTS=$(find apps/backend/tests/security -name "test_*.py" 2>/dev/null | wc -l)
        check_pass "Security tests found: $SECURITY_TESTS"
    else
        check_warn "Security test directory missing"
    fi

    # Check critical module tests
    for module in "products" "customers" "orders" "quotes" "auth"; do
        if find apps/backend/tests -name "*${module}*.py" -type f | grep -q .; then
            check_pass "Tests exist for $module module"
        else
            check_warn "No tests found for $module module"
        fi
    done
}

################################################################################
# Verification Category 4: Frontend Test Files
################################################################################

verify_frontend_test_files() {
    print_category "4. Frontend Test Files"

    # Count frontend test files
    FRONTEND_TEST_FILES=$(find apps/web/__tests__ -name "*.test.tsx" -o -name "*.test.ts" 2>/dev/null | wc -l)
    if [[ $FRONTEND_TEST_FILES -gt 0 ]]; then
        check_pass "Frontend test files found: $FRONTEND_TEST_FILES"
    else
        check_warn "No frontend test files found"
    fi

    # Check component tests
    if find apps/web/__tests__/components -name "*.test.tsx" 2>/dev/null | grep -q .; then
        COMPONENT_TESTS=$(find apps/web/__tests__/components -name "*.test.tsx" 2>/dev/null | wc -l)
        check_pass "Component tests found: $COMPONENT_TESTS"
    else
        check_warn "No component tests found"
    fi

    # Check portal tests
    if find apps/web/__tests__ -name "*portal*.test.tsx" 2>/dev/null | grep -q .; then
        check_pass "Portal tests exist"
    else
        check_warn "Portal tests missing"
    fi
}

################################################################################
# Verification Category 5: Test Database Configuration
################################################################################

verify_test_database_configuration() {
    print_category "5. Test Database Configuration"

    # Check if Docker is running
    if command_exists docker; then
        check_pass "Docker installed"

        # Check if PostgreSQL container is running
        if docker ps --format '{{.Names}}' | grep -q postgres; then
            check_pass "PostgreSQL container running"
        else
            check_warn "PostgreSQL container not running (docker compose up -d)"
        fi
    else
        check_warn "Docker not installed or not in PATH"
    fi

    # Check seed data script
    if file_exists "apps/backend/src/db/seed_demo.py"; then
        :
    fi

    # Check if test database can be connected
    echo "Checking database connectivity..."
    if cd apps/backend && python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_db():
    try:
        engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/ccw_erp_dev', echo=False)
        async with engine.connect() as conn:
            result = await conn.execute(text('SELECT 1'))
            return True
    except Exception as e:
        print(f'Error: {e}')
        return False

print(asyncio.run(check_db()))
" 2>/dev/null | grep -q "True"; then
        check_pass "Database connection successful"
    else
        check_warn "Database connection failed (check if PostgreSQL is running)"
    fi

    cd - > /dev/null
}

################################################################################
# Verification Category 6: Backend Test Execution
################################################################################

verify_backend_test_execution() {
    print_category "6. Backend Test Execution"

    echo "Running backend tests with pytest..."
    echo ""

    # Create test results directory
    mkdir -p test-results

    # Run pytest with coverage
    if cd apps/backend && pytest -v --tb=short --junit-xml=../../test-results/backend-junit.xml 2>&1 | tee ../../test-results/backend-output.txt; then
        BACKEND_TESTS_PASSED=true
        check_pass "Backend tests executed successfully"
    else
        BACKEND_TESTS_PASSED=false
        check_fail "Backend tests failed"
    fi

    cd - > /dev/null

    # Parse test results
    if [[ -f "test-results/backend-output.txt" ]]; then
        # Extract test count and failures
        if grep -q "passed" test-results/backend-output.txt; then
            PASSED=$(grep -oP '\d+(?= passed)' test-results/backend-output.txt | tail -1)
            BACKEND_TEST_COUNT=${PASSED:-0}
            check_pass "Backend tests passed: $BACKEND_TEST_COUNT"
        fi

        if grep -q "failed" test-results/backend-output.txt; then
            FAILED=$(grep -oP '\d+(?= failed)' test-results/backend-output.txt | tail -1)
            BACKEND_FAILURES=${FAILED:-0}
            check_fail "Backend tests failed: $BACKEND_FAILURES"
        else
            check_pass "No backend test failures"
        fi
    fi
}

################################################################################
# Verification Category 7: Frontend Test Execution
################################################################################

verify_frontend_test_execution() {
    print_category "7. Frontend Test Execution"

    echo "Running frontend tests with Vitest..."
    echo ""

    # Run Vitest
    if cd apps/web && pnpm test run 2>&1 | tee ../../test-results/frontend-output.txt; then
        FRONTEND_TESTS_PASSED=true
        check_pass "Frontend tests executed successfully"
    else
        FRONTEND_TESTS_PASSED=false
        check_fail "Frontend tests failed"
    fi

    cd - > /dev/null

    # Parse test results
    if [[ -f "test-results/frontend-output.txt" ]]; then
        if grep -q "Test Files" test-results/frontend-output.txt; then
            PASSED=$(grep -oP '\d+(?= passed)' test-results/frontend-output.txt | tail -1)
            FRONTEND_TEST_COUNT=${PASSED:-0}
            check_pass "Frontend tests passed: $FRONTEND_TEST_COUNT"
        fi

        if grep -q "failed" test-results/frontend-output.txt; then
            FAILED=$(grep -oP '\d+(?= failed)' test-results/frontend-output.txt | tail -1)
            FRONTEND_FAILURES=${FAILED:-0}
            check_fail "Frontend tests failed: $FRONTEND_FAILURES"
        else
            check_pass "No frontend test failures"
        fi
    fi
}

################################################################################
# Verification Category 8: Test Results Validation
################################################################################

verify_test_results_validation() {
    print_category "8. Test Results Validation"

    # Calculate total tests
    TOTAL_TESTS=$((BACKEND_TEST_COUNT + FRONTEND_TEST_COUNT))
    TOTAL_FAILURES=$((BACKEND_FAILURES + FRONTEND_FAILURES))

    if [[ $TOTAL_TESTS -gt 0 ]]; then
        check_pass "Total tests executed: $TOTAL_TESTS"
    else
        check_fail "No tests were executed"
    fi

    # Check pass rate
    if [[ $TOTAL_FAILURES -eq 0 ]]; then
        check_pass "100% pass rate achieved ($TOTAL_TESTS/$TOTAL_TESTS tests passing)"
    else
        PASS_RATE=$(awk "BEGIN {printf \"%.1f\", (($TOTAL_TESTS - $TOTAL_FAILURES) / $TOTAL_TESTS) * 100}")
        check_fail "Pass rate: ${PASS_RATE}% ($TOTAL_FAILURES failures out of $TOTAL_TESTS tests)"
    fi

    # Check if target of 39+ tests met
    if [[ $TOTAL_TESTS -ge 39 ]]; then
        check_pass "Test suite meets minimum size (39+ tests)"
    else
        check_warn "Test suite smaller than expected (found $TOTAL_TESTS, expected 39+)"
    fi
}

################################################################################
# Verification Category 9: Test Coverage Analysis
################################################################################

verify_test_coverage_analysis() {
    print_category "9. Test Coverage Analysis"

    # Backend coverage
    echo "Checking backend test coverage..."
    if cd apps/backend && pytest --cov=src --cov-report=term-missing --cov-report=html:../../test-results/backend-coverage 2>&1 | tee ../../test-results/backend-coverage.txt; then
        check_pass "Backend coverage report generated"

        # Extract coverage percentage
        if [[ -f "../../test-results/backend-coverage.txt" ]]; then
            if grep -q "TOTAL" test-results/backend-coverage.txt; then
                COVERAGE=$(grep "TOTAL" test-results/backend-coverage.txt | awk '{print $NF}' | sed 's/%//')
                if [[ $(echo "$COVERAGE >= 70" | bc -l) -eq 1 ]]; then
                    check_pass "Backend coverage: ${COVERAGE}% (meets 70% threshold)"
                elif [[ $(echo "$COVERAGE >= 50" | bc -l) -eq 1 ]]; then
                    check_warn "Backend coverage: ${COVERAGE}% (below 70% target)"
                else
                    check_fail "Backend coverage: ${COVERAGE}% (below 50% minimum)"
                fi
            fi
        fi
    else
        check_warn "Backend coverage report failed"
    fi

    cd - > /dev/null

    # Frontend coverage
    echo "Checking frontend test coverage..."
    if cd apps/web && pnpm test run --coverage 2>&1 | tee ../../test-results/frontend-coverage.txt; then
        check_pass "Frontend coverage report generated"

        # Extract coverage percentage
        if [[ -f "../../test-results/frontend-coverage.txt" ]]; then
            if grep -q "All files" test-results/frontend-coverage.txt; then
                COVERAGE=$(grep "All files" test-results/frontend-coverage.txt | awk '{print $4}' | sed 's/%//')
                if [[ -n "$COVERAGE" ]] && [[ $(echo "$COVERAGE >= 60" | bc -l 2>/dev/null || echo 0) -eq 1 ]]; then
                    check_pass "Frontend coverage: ${COVERAGE}% (meets 60% threshold)"
                else
                    check_warn "Frontend coverage: ${COVERAGE}% (below 60% target)"
                fi
            fi
        fi
    else
        check_warn "Frontend coverage report failed"
    fi

    cd - > /dev/null
}

################################################################################
# Verification Category 10: API Endpoint Testing
################################################################################

verify_api_endpoint_testing() {
    print_category "10. API Endpoint Testing"

    # Check for CRUD tests for each module
    for module in "products" "customers" "orders" "quotes"; do
        if grep -r "test.*${module}.*create\|test.*${module}.*post" apps/backend/tests/ 2>/dev/null | grep -q .; then
            check_pass "CREATE tests exist for $module"
        else
            check_warn "CREATE tests missing for $module"
        fi

        if grep -r "test.*${module}.*read\|test.*${module}.*get\|test.*${module}.*list" apps/backend/tests/ 2>/dev/null | grep -q .; then
            check_pass "READ tests exist for $module"
        else
            check_warn "READ tests missing for $module"
        fi

        if grep -r "test.*${module}.*update\|test.*${module}.*put" apps/backend/tests/ 2>/dev/null | grep -q .; then
            check_pass "UPDATE tests exist for $module"
        else
            check_warn "UPDATE tests missing for $module"
        fi

        if grep -r "test.*${module}.*delete" apps/backend/tests/ 2>/dev/null | grep -q .; then
            check_pass "DELETE tests exist for $module"
        else
            check_warn "DELETE tests missing for $module"
        fi
    done
}

################################################################################
# Verification Category 11: Authentication Testing
################################################################################

verify_authentication_testing() {
    print_category "11. Authentication Testing"

    # Check for authentication tests
    if find apps/backend/tests -name "*auth*.py" -type f | grep -q .; then
        check_pass "Authentication test files exist"
    else
        check_warn "Authentication test files missing"
    fi

    # Check for specific auth test cases
    if grep -r "test.*login" apps/backend/tests/ 2>/dev/null | grep -q .; then
        check_pass "Login tests exist"
    else
        check_warn "Login tests missing"
    fi

    if grep -r "test.*token\|test.*jwt" apps/backend/tests/ 2>/dev/null | grep -q .; then
        check_pass "Token validation tests exist"
    else
        check_warn "Token validation tests missing"
    fi

    if grep -r "test.*password.*reset\|test.*forgot.*password" apps/backend/tests/ 2>/dev/null | grep -q .; then
        check_pass "Password reset tests exist"
    else
        check_warn "Password reset tests missing"
    fi
}

################################################################################
# Verification Category 12: Integration Testing
################################################################################

verify_integration_testing() {
    print_category "12. Integration Testing"

    # Check for integration test directory
    if [[ -d "apps/backend/tests/integration" ]]; then
        check_pass "Integration test directory exists"

        # Check for specific integration tests
        for integration in "shopify" "xero" "ap2"; do
            if find apps/backend/tests/integration -name "*${integration}*.py" -type f | grep -q .; then
                check_pass "Integration tests exist for $integration"
            else
                check_warn "Integration tests missing for $integration"
            fi
        done
    else
        check_warn "Integration test directory missing"
    fi
}

################################################################################
# Verification Category 13: Regression Testing
################################################################################

verify_regression_testing() {
    print_category "13. Regression Testing"

    # Check if previously fixed issues are tested
    echo "Checking for regression tests of previously fixed issues..."

    # ISS-001: Quote total calculation
    if grep -r "quote.*total\|calculate.*quote" apps/backend/tests/ 2>/dev/null | grep -q .; then
        check_pass "Quote calculation regression tests exist (ISS-001)"
    else
        check_warn "Quote calculation regression tests missing"
    fi

    # ISS-002: Order item updates
    if grep -r "order.*item.*update\|update.*order.*item" apps/backend/tests/ 2>/dev/null | grep -q .; then
        check_pass "Order item update regression tests exist (ISS-002)"
    else
        check_warn "Order item update regression tests missing"
    fi

    # ISS-003: Quote number uniqueness
    if grep -r "quote.*number.*unique\|duplicate.*quote" apps/backend/tests/ 2>/dev/null | grep -q .; then
        check_pass "Quote number uniqueness regression tests exist (ISS-003)"
    else
        check_warn "Quote number uniqueness regression tests missing"
    fi

    # Check for test files related to fixed issues
    if find apps/backend/tests -name "*404*.py" -o -name "*422*.py" -o -name "*500*.py" | grep -q .; then
        check_pass "Error handling regression tests exist"
    else
        check_warn "Error handling regression tests missing"
    fi
}

################################################################################
# Verification Category 14: Load Testing Preparation
################################################################################

verify_load_testing_preparation() {
    print_category "14. Load Testing Preparation"

    # Check for load test directory
    if [[ -d "apps/backend/tests/load" ]]; then
        check_pass "Load test directory exists"
    else
        check_warn "Load test directory missing"
    fi

    # Check for locustfile
    if file_exists "apps/backend/tests/load/locustfile_ai_features.py"; then
        :
    fi

    # Check for load test scripts
    if file_exists "apps/backend/tests/load/run_full_load_test.py"; then
        :
    fi

    # Check for load test scenarios
    if file_exists "apps/backend/tests/load/test_scenarios.py"; then
        :
    fi
}

################################################################################
# Verification Category 15: Test Reporting
################################################################################

verify_test_reporting() {
    print_category "15. Test Reporting"

    # Check if test results directory exists
    if [[ -d "test-results" ]]; then
        check_pass "Test results directory created"
    else
        check_fail "Test results directory missing"
    fi

    # Check for JUnit XML reports
    if [[ -f "test-results/backend-junit.xml" ]]; then
        check_pass "Backend JUnit XML report generated"
    else
        check_warn "Backend JUnit XML report missing"
    fi

    # Check for coverage HTML reports
    if [[ -d "test-results/backend-coverage" ]]; then
        check_pass "Backend coverage HTML report generated"
    else
        check_warn "Backend coverage HTML report missing"
    fi

    # Check for test output logs
    if [[ -f "test-results/backend-output.txt" ]]; then
        check_pass "Backend test output saved"
    else
        check_warn "Backend test output not saved"
    fi

    if [[ -f "test-results/frontend-output.txt" ]]; then
        check_pass "Frontend test output saved"
    else
        check_warn "Frontend test output not saved"
    fi
}

################################################################################
# Verification Category 16: Continuous Integration
################################################################################

verify_continuous_integration() {
    print_category "16. Continuous Integration"

    # Check for GitHub Actions workflow
    if [[ -d ".github/workflows" ]]; then
        check_pass "GitHub Actions workflow directory exists"

        if find .github/workflows -name "*.yml" -o -name "*.yaml" | grep -q .; then
            check_pass "GitHub Actions workflow files exist"
        else
            check_warn "No GitHub Actions workflow files found"
        fi
    else
        check_warn "GitHub Actions not configured"
    fi

    # Check if workflows include test steps
    if grep -r "pytest\|pnpm test" .github/workflows/ 2>/dev/null | grep -q .; then
        check_pass "CI pipeline includes test execution"
    else
        check_warn "CI pipeline test execution not configured"
    fi
}

################################################################################
# Verification Category 17: Production Readiness
################################################################################

verify_production_readiness() {
    print_category "17. Production Readiness"

    # Check if all tests passed
    if [[ $BACKEND_TESTS_PASSED == true ]] && [[ $FRONTEND_TESTS_PASSED == true ]]; then
        check_pass "All test suites passed"
    else
        check_fail "Not all test suites passed"
    fi

    # Check if pass rate is 100%
    if [[ $TOTAL_FAILURES -eq 0 ]] && [[ $TOTAL_TESTS -gt 0 ]]; then
        check_pass "100% pass rate achieved - production ready"
    else
        check_fail "100% pass rate not achieved - NOT production ready"
    fi

    # Check if minimum test count met
    if [[ $TOTAL_TESTS -ge 39 ]]; then
        check_pass "Minimum test count met (39+ tests)"
    else
        check_warn "Test count below target (found $TOTAL_TESTS, expected 39+)"
    fi

    # Check if critical tests exist
    CRITICAL_TESTS=0
    if grep -r "test.*auth.*login" apps/backend/tests/ 2>/dev/null | grep -q .; then
        ((CRITICAL_TESTS++))
    fi
    if grep -r "test.*order.*create" apps/backend/tests/ 2>/dev/null | grep -q .; then
        ((CRITICAL_TESTS++))
    fi
    if grep -r "test.*quote.*create" apps/backend/tests/ 2>/dev/null | grep -q .; then
        ((CRITICAL_TESTS++))
    fi
    if grep -r "test.*customer.*create" apps/backend/tests/ 2>/dev/null | grep -q .; then
        ((CRITICAL_TESTS++))
    fi
    if grep -r "test.*product.*create" apps/backend/tests/ 2>/dev/null | grep -q .; then
        ((CRITICAL_TESTS++))
    fi

    if [[ $CRITICAL_TESTS -ge 5 ]]; then
        check_pass "All critical path tests exist ($CRITICAL_TESTS/5)"
    else
        check_fail "Critical path tests incomplete ($CRITICAL_TESTS/5)"
    fi
}

################################################################################
# Summary
################################################################################

print_summary() {
    print_header "Verification Summary"

    echo "ISS-029: Full Integration Test Suite Verification Complete"
    echo ""
    echo "Results:"
    echo -e "  ${GREEN}Passed${NC}:  $PASS_COUNT"
    echo -e "  ${YELLOW}Warnings${NC}: $WARN_COUNT"
    echo -e "  ${RED}Failed${NC}:  $FAIL_COUNT"
    echo ""

    # Test Results Summary
    echo "Test Execution Summary:"
    echo "  Backend Tests:  $BACKEND_TEST_COUNT passed, $BACKEND_FAILURES failed"
    echo "  Frontend Tests: $FRONTEND_TEST_COUNT passed, $FRONTEND_FAILURES failed"
    echo "  Total Tests:    $((BACKEND_TEST_COUNT + FRONTEND_TEST_COUNT)) passed, $((BACKEND_FAILURES + FRONTEND_FAILURES)) failed"
    echo ""

    if [[ $FAIL_COUNT -eq 0 ]] && [[ $((BACKEND_FAILURES + FRONTEND_FAILURES)) -eq 0 ]]; then
        echo -e "${GREEN}✓ SUCCESS${NC}: All tests passing - production ready!"
        echo ""
        echo "Next Steps:"
        echo "  1. Review test coverage reports in test-results/"
        echo "  2. Execute load testing (ISS-030)"
        echo "  3. Conduct user acceptance testing (ISS-031)"
        echo "  4. Proceed with staging deployment (ISS-033)"
    else
        echo -e "${RED}✗ FAILURES DETECTED${NC}: Test failures or missing infrastructure"
        echo ""
        echo "Required Actions:"
        if [[ $BACKEND_FAILURES -gt 0 ]]; then
            echo "  - Fix $BACKEND_FAILURES backend test failures"
        fi
        if [[ $FRONTEND_FAILURES -gt 0 ]]; then
            echo "  - Fix $FRONTEND_FAILURES frontend test failures"
        fi
        if [[ $FAIL_COUNT -gt 0 ]]; then
            echo "  - Resolve $FAIL_COUNT infrastructure failures"
        fi
        echo "  - Re-run verification script after fixes"
        echo ""
        echo "DO NOT deploy to production until 100% pass rate achieved"
    fi

    echo ""
    echo "Documentation: docs/ISS-029-VERIFICATION.md"
    echo "Test Reports: test-results/"
}

################################################################################
# Execute Main Function
################################################################################

main "$@"
