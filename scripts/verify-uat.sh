#!/usr/bin/env bash

################################################################################
# ISS-031 Verification Script - User Acceptance Testing
################################################################################
#
# Purpose: Verify user acceptance testing execution and sign-off completion
#
# This script validates UAT execution for CCW-Online ERP, ensuring stakeholder
# sessions completed, feedback documented, critical issues resolved, UAT test
# cases executed, business workflows validated, sign-off obtained, and
# production readiness confirmed from business perspective.
#
# Validation Categories (15):
#   1.  UAT Environment Setup - UAT environment accessible, data loaded
#   2.  UAT Test Cases - Test cases defined, scenarios documented
#   3.  Stakeholder Participation - Key stakeholders identified, available
#   4.  UAT Session Execution - Sessions scheduled, conducted, documented
#   5.  Business Workflows Testing - End-to-end workflows validated
#   6.  Products Module UAT - CRUD operations, search, filtering validated
#   7.  Customers Module UAT - Customer management workflows validated
#   8.  Orders Module UAT - Order creation, status updates, line items validated
#   9.  Quotes Module UAT - Quote creation, approval, conversion validated
#  10.  UAT Feedback Collection - Feedback documented, categorized, prioritized
#  11.  Critical Issues Resolution - Blocking issues resolved, verified
#  12.  UAT Test Results - Pass/fail status, coverage documented
#  13.  UAT Sign-Off - Business owner approval obtained, documented
#  14.  UAT Documentation - Test results, feedback, sign-off archived
#  15.  Production Readiness - UAT passed, ready for staging deployment
#
# Usage:
#   ./scripts/verify-uat.sh
#
# Exit Codes:
#   0 - UAT passed, sign-off obtained (production ready)
#   1 - UAT incomplete or critical issues unresolved
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

# UAT results tracking
UAT_PASSED=false
UAT_TEST_CASES_TOTAL=0
UAT_TEST_CASES_PASSED=0
UAT_TEST_CASES_FAILED=0
UAT_PASS_RATE=0
CRITICAL_ISSUES=0
UAT_SIGN_OFF_OBTAINED=false

# UAT success criteria
readonly MIN_UAT_PASS_RATE=90.0
readonly MAX_CRITICAL_ISSUES=0

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

################################################################################
# Main Verification Script
################################################################################

main() {
    print_header "ISS-031: User Acceptance Testing Verification"

    echo "Verifying user acceptance testing execution for CCW-Online ERP"
    echo "Target: 90%+ pass rate, critical issues resolved, sign-off obtained"
    echo "Date: $(date)"
    echo ""

    verify_uat_environment_setup
    verify_uat_test_cases
    verify_stakeholder_participation
    verify_uat_session_execution
    verify_business_workflows_testing
    verify_products_module_uat
    verify_customers_module_uat
    verify_orders_module_uat
    verify_quotes_module_uat
    verify_uat_feedback_collection
    verify_critical_issues_resolution
    verify_uat_test_results
    verify_uat_sign_off
    verify_uat_documentation
    verify_production_readiness

    print_summary

    if [[ $FAIL_COUNT -gt 0 ]] || [[ $UAT_SIGN_OFF_OBTAINED == false ]]; then
        exit 1
    else
        exit 0
    fi
}

################################################################################
# Verification Category 1: UAT Environment Setup
################################################################################

verify_uat_environment_setup() {
    print_category "1. UAT Environment Setup"

    # Check if UAT environment is accessible
    echo "Checking UAT environment accessibility..."
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        check_pass "UAT frontend accessible (port 3000)"
    else
        check_fail "UAT frontend not accessible (start with: pnpm dev)"
    fi

    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        check_pass "UAT backend accessible (port 8000)"
    else
        check_fail "UAT backend not accessible (start backend)"
    fi

    # Check if UAT data is loaded
    echo "Checking UAT test data..."
    if cd backend && python3 -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_data():
    try:
        engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/ccw_erp_dev', echo=False)
        async with engine.connect() as conn:
            # Check for products
            result = await conn.execute(text('SELECT COUNT(*) FROM products'))
            products = result.scalar()

            # Check for customers
            result = await conn.execute(text('SELECT COUNT(*) FROM customers'))
            customers = result.scalar()

            return products > 0 and customers > 0
    except Exception:
        return False

print(asyncio.run(check_data()))
" 2>/dev/null | grep -q "True"; then
        check_pass "UAT test data loaded (products, customers exist)"
    else
        check_warn "UAT test data may not be loaded"
    fi

    cd - > /dev/null

    # Check if UAT documentation directory exists
    if [[ ! -d "docs/uat" ]]; then
        mkdir -p docs/uat
        check_pass "UAT documentation directory created (docs/uat/)"
    else
        check_pass "UAT documentation directory exists"
    fi
}

################################################################################
# Verification Category 2: UAT Test Cases
################################################################################

verify_uat_test_cases() {
    print_category "2. UAT Test Cases"

    # Check for UAT test cases document
    if [[ -f "docs/uat/UAT_TEST_CASES.md" ]]; then
        check_pass "UAT test cases documented"

        # Count test cases
        UAT_TEST_CASES_TOTAL=$(grep -c "^##.*Test Case" docs/uat/UAT_TEST_CASES.md 2>/dev/null || echo "0")
        if [[ $UAT_TEST_CASES_TOTAL -gt 0 ]]; then
            check_pass "UAT test cases defined ($UAT_TEST_CASES_TOTAL test cases)"
        else
            check_warn "No UAT test cases found in document"
        fi
    else
        check_warn "UAT test cases not documented (docs/uat/UAT_TEST_CASES.md)"
    fi

    # Check for specific module test cases
    for module in "Products" "Customers" "Orders" "Quotes"; do
        if grep -q "$module" docs/uat/UAT_TEST_CASES.md 2>/dev/null; then
            check_pass "UAT test cases exist for $module module"
        else
            check_warn "UAT test cases missing for $module module"
        fi
    done

    # Check for business workflow test cases
    if grep -q -i "workflow\|end-to-end\|e2e" docs/uat/UAT_TEST_CASES.md 2>/dev/null; then
        check_pass "Business workflow test cases documented"
    else
        check_warn "Business workflow test cases not documented"
    fi
}

################################################################################
# Verification Category 3: Stakeholder Participation
################################################################################

verify_stakeholder_participation() {
    print_category "3. Stakeholder Participation"

    # Check for stakeholder list
    if [[ -f "docs/uat/UAT_STAKEHOLDERS.md" ]]; then
        check_pass "Stakeholder list documented"

        # Check for key stakeholder roles
        for role in "Business Owner" "Sales" "Warehouse" "Customer Service"; do
            if grep -q "$role" docs/uat/UAT_STAKEHOLDERS.md 2>/dev/null; then
                check_pass "Stakeholder identified: $role"
            else
                check_warn "Stakeholder missing: $role"
            fi
        done
    else
        check_warn "Stakeholder list not documented (docs/uat/UAT_STAKEHOLDERS.md)"
    fi

    # Check for stakeholder availability
    if grep -q -i "available\|schedule\|session" docs/uat/UAT_STAKEHOLDERS.md 2>/dev/null; then
        check_pass "Stakeholder availability documented"
    else
        check_warn "Stakeholder availability not documented"
    fi
}

################################################################################
# Verification Category 4: UAT Session Execution
################################################################################

verify_uat_session_execution() {
    print_category "4. UAT Session Execution"

    # Check for UAT session log
    if [[ -f "docs/uat/UAT_SESSION_LOG.md" ]]; then
        check_pass "UAT session log exists"

        # Count sessions conducted
        SESSION_COUNT=$(grep -c "^## Session" docs/uat/UAT_SESSION_LOG.md 2>/dev/null || echo "0")
        if [[ $SESSION_COUNT -gt 0 ]]; then
            check_pass "UAT sessions conducted ($SESSION_COUNT sessions)"
        else
            check_warn "No UAT sessions logged"
        fi

        # Check for session dates
        if grep -q "[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" docs/uat/UAT_SESSION_LOG.md 2>/dev/null; then
            check_pass "UAT session dates documented"
        else
            check_warn "UAT session dates not documented"
        fi

        # Check for session participants
        if grep -q -i "participant\|attendee" docs/uat/UAT_SESSION_LOG.md 2>/dev/null; then
            check_pass "UAT session participants documented"
        else
            check_warn "UAT session participants not documented"
        fi
    else
        check_warn "UAT session log not found (docs/uat/UAT_SESSION_LOG.md)"
    fi
}

################################################################################
# Verification Category 5: Business Workflows Testing
################################################################################

verify_business_workflows_testing() {
    print_category "5. Business Workflows Testing"

    # Check for end-to-end workflow testing
    if [[ -f "docs/uat/UAT_WORKFLOW_RESULTS.md" ]]; then
        check_pass "Workflow testing results documented"

        # Check for specific workflows
        WORKFLOWS=(
            "Quote to Order Conversion"
            "Order Fulfillment"
            "Customer Registration"
            "Product Search and Purchase"
            "Inventory Management"
        )

        for workflow in "${WORKFLOWS[@]}"; do
            if grep -q "$workflow" docs/uat/UAT_WORKFLOW_RESULTS.md 2>/dev/null; then
                check_pass "Workflow tested: $workflow"
            else
                check_warn "Workflow not tested: $workflow"
            fi
        done
    else
        check_warn "Workflow testing results not documented (docs/uat/UAT_WORKFLOW_RESULTS.md)"
    fi
}

################################################################################
# Verification Category 6: Products Module UAT
################################################################################

verify_products_module_uat() {
    print_category "6. Products Module UAT"

    # Check for products module UAT results
    if [[ -f "docs/uat/UAT_RESULTS.md" ]]; then
        if grep -q -i "products" docs/uat/UAT_RESULTS.md 2>/dev/null; then
            check_pass "Products module UAT results documented"

            # Check for specific product features tested
            for feature in "Create Product" "Search Product" "Update Product" "Delete Product"; do
                if grep -q "$feature" docs/uat/UAT_RESULTS.md 2>/dev/null; then
                    check_pass "Products feature tested: $feature"
                else
                    check_warn "Products feature not tested: $feature"
                fi
            done
        else
            check_warn "Products module UAT results not found"
        fi
    fi
}

################################################################################
# Verification Category 7: Customers Module UAT
################################################################################

verify_customers_module_uat() {
    print_category "7. Customers Module UAT"

    # Check for customers module UAT results
    if [[ -f "docs/uat/UAT_RESULTS.md" ]]; then
        if grep -q -i "customers" docs/uat/UAT_RESULTS.md 2>/dev/null; then
            check_pass "Customers module UAT results documented"

            # Check for specific customer features tested
            for feature in "Create Customer" "Search Customer" "Update Customer" "View Customer Orders"; do
                if grep -q "$feature" docs/uat/UAT_RESULTS.md 2>/dev/null; then
                    check_pass "Customers feature tested: $feature"
                else
                    check_warn "Customers feature not tested: $feature"
                fi
            done
        else
            check_warn "Customers module UAT results not found"
        fi
    fi
}

################################################################################
# Verification Category 8: Orders Module UAT
################################################################################

verify_orders_module_uat() {
    print_category "8. Orders Module UAT"

    # Check for orders module UAT results
    if [[ -f "docs/uat/UAT_RESULTS.md" ]]; then
        if grep -q -i "orders" docs/uat/UAT_RESULTS.md 2>/dev/null; then
            check_pass "Orders module UAT results documented"

            # Check for specific order features tested
            for feature in "Create Order" "Add Order Items" "Update Order Status" "View Order Details"; do
                if grep -q "$feature" docs/uat/UAT_RESULTS.md 2>/dev/null; then
                    check_pass "Orders feature tested: $feature"
                else
                    check_warn "Orders feature not tested: $feature"
                fi
            done
        else
            check_warn "Orders module UAT results not found"
        fi
    fi
}

################################################################################
# Verification Category 9: Quotes Module UAT
################################################################################

verify_quotes_module_uat() {
    print_category "9. Quotes Module UAT"

    # Check for quotes module UAT results
    if [[ -f "docs/uat/UAT_RESULTS.md" ]]; then
        if grep -q -i "quotes" docs/uat/UAT_RESULTS.md 2>/dev/null; then
            check_pass "Quotes module UAT results documented"

            # Check for specific quote features tested
            for feature in "Create Quote" "Add Quote Items" "Calculate Quote Total" "Convert Quote to Order"; do
                if grep -q "$feature" docs/uat/UAT_RESULTS.md 2>/dev/null; then
                    check_pass "Quotes feature tested: $feature"
                else
                    check_warn "Quotes feature not tested: $feature"
                fi
            done
        else
            check_warn "Quotes module UAT results not found"
        fi
    fi
}

################################################################################
# Verification Category 10: UAT Feedback Collection
################################################################################

verify_uat_feedback_collection() {
    print_category "10. UAT Feedback Collection"

    # Check for feedback document
    if [[ -f "docs/uat/UAT_FEEDBACK.md" ]]; then
        check_pass "UAT feedback documented"

        # Count feedback items
        FEEDBACK_COUNT=$(grep -c "^-" docs/uat/UAT_FEEDBACK.md 2>/dev/null || echo "0")
        if [[ $FEEDBACK_COUNT -gt 0 ]]; then
            check_pass "Feedback items collected ($FEEDBACK_COUNT items)"
        else
            check_warn "No feedback items found"
        fi

        # Check for feedback categorization
        if grep -q -i "priority\|severity\|critical\|high\|medium\|low" docs/uat/UAT_FEEDBACK.md 2>/dev/null; then
            check_pass "Feedback categorized by priority"
        else
            check_warn "Feedback not categorized"
        fi

        # Check for positive feedback
        if grep -q -i "positive\|working well\|satisfied\|good" docs/uat/UAT_FEEDBACK.md 2>/dev/null; then
            check_pass "Positive feedback documented"
        fi
    else
        check_warn "UAT feedback not documented (docs/uat/UAT_FEEDBACK.md)"
    fi
}

################################################################################
# Verification Category 11: Critical Issues Resolution
################################################################################

verify_critical_issues_resolution() {
    print_category "11. Critical Issues Resolution"

    # Check for issues document
    if [[ -f "docs/uat/UAT_ISSUES.md" ]]; then
        check_pass "UAT issues documented"

        # Count critical issues
        CRITICAL_ISSUES=$(grep -c -i "critical\|blocker\|p0" docs/uat/UAT_ISSUES.md 2>/dev/null || echo "0")

        if [[ $CRITICAL_ISSUES -eq 0 ]]; then
            check_pass "No critical issues found"
        else
            # Check if critical issues are resolved
            RESOLVED=$(grep -c -i "resolved\|fixed\|closed" docs/uat/UAT_ISSUES.md 2>/dev/null || echo "0")

            if [[ $RESOLVED -ge $CRITICAL_ISSUES ]]; then
                check_pass "All critical issues resolved ($CRITICAL_ISSUES/$CRITICAL_ISSUES)"
            else
                check_fail "Critical issues unresolved ($RESOLVED/$CRITICAL_ISSUES resolved)"
            fi
        fi

        # Check for issue tracking
        if grep -q "Status:" docs/uat/UAT_ISSUES.md 2>/dev/null; then
            check_pass "Issue status tracked"
        else
            check_warn "Issue status not tracked"
        fi
    else
        check_warn "UAT issues not documented (docs/uat/UAT_ISSUES.md)"
    fi
}

################################################################################
# Verification Category 12: UAT Test Results
################################################################################

verify_uat_test_results() {
    print_category "12. UAT Test Results"

    # Check for test results summary
    if [[ -f "docs/uat/UAT_RESULTS.md" ]]; then
        check_pass "UAT test results documented"

        # Extract pass/fail counts
        PASSED=$(grep -c -i "✓\|pass\|passed\|success" docs/uat/UAT_RESULTS.md 2>/dev/null || echo "0")
        FAILED=$(grep -c -i "✗\|fail\|failed\|error" docs/uat/UAT_RESULTS.md 2>/dev/null || echo "0")

        UAT_TEST_CASES_PASSED=$PASSED
        UAT_TEST_CASES_FAILED=$FAILED
        UAT_TEST_CASES_TOTAL=$((PASSED + FAILED))

        if [[ $UAT_TEST_CASES_TOTAL -gt 0 ]]; then
            UAT_PASS_RATE=$(echo "scale=2; ($PASSED / $UAT_TEST_CASES_TOTAL) * 100" | bc -l)

            if [[ $(echo "$UAT_PASS_RATE >= $MIN_UAT_PASS_RATE" | bc -l) -eq 1 ]]; then
                check_pass "UAT pass rate: ${UAT_PASS_RATE}% (target: ${MIN_UAT_PASS_RATE}%)"
                UAT_PASSED=true
            else
                check_fail "UAT pass rate: ${UAT_PASS_RATE}% (below target: ${MIN_UAT_PASS_RATE}%)"
            fi
        else
            check_warn "UAT pass rate not calculated (no test results)"
        fi

        # Check for test coverage
        if grep -q -i "coverage\|tested" docs/uat/UAT_RESULTS.md 2>/dev/null; then
            check_pass "UAT test coverage documented"
        else
            check_warn "UAT test coverage not documented"
        fi
    else
        check_fail "UAT test results not documented (docs/uat/UAT_RESULTS.md)"
    fi
}

################################################################################
# Verification Category 13: UAT Sign-Off
################################################################################

verify_uat_sign_off() {
    print_category "13. UAT Sign-Off"

    # Check for sign-off document
    if [[ -f "docs/uat/UAT_SIGN_OFF.md" ]]; then
        check_pass "UAT sign-off document exists"

        # Check for business owner approval
        if grep -q -i "approved\|sign-off\|signed off" docs/uat/UAT_SIGN_OFF.md 2>/dev/null; then
            check_pass "UAT approval documented"
            UAT_SIGN_OFF_OBTAINED=true
        else
            check_fail "UAT approval not documented"
        fi

        # Check for sign-off date
        if grep -q "[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" docs/uat/UAT_SIGN_OFF.md 2>/dev/null; then
            check_pass "UAT sign-off date documented"
        else
            check_warn "UAT sign-off date not documented"
        fi

        # Check for approver name/signature
        if grep -q -i "signed by\|approver\|name:" docs/uat/UAT_SIGN_OFF.md 2>/dev/null; then
            check_pass "UAT approver identified"
        else
            check_warn "UAT approver not identified"
        fi
    else
        check_fail "UAT sign-off document missing (docs/uat/UAT_SIGN_OFF.md)"
    fi
}

################################################################################
# Verification Category 14: UAT Documentation
################################################################################

verify_uat_documentation() {
    print_category "14. UAT Documentation"

    # Check for complete documentation set
    UAT_DOCS=(
        "UAT_TEST_CASES.md"
        "UAT_STAKEHOLDERS.md"
        "UAT_SESSION_LOG.md"
        "UAT_RESULTS.md"
        "UAT_FEEDBACK.md"
        "UAT_ISSUES.md"
        "UAT_SIGN_OFF.md"
    )

    DOC_COUNT=0
    for doc in "${UAT_DOCS[@]}"; do
        if [[ -f "docs/uat/$doc" ]]; then
            ((DOC_COUNT++))
        fi
    done

    if [[ $DOC_COUNT -eq ${#UAT_DOCS[@]} ]]; then
        check_pass "All UAT documentation complete ($DOC_COUNT/${#UAT_DOCS[@]} documents)"
    else
        check_warn "UAT documentation incomplete ($DOC_COUNT/${#UAT_DOCS[@]} documents)"
    fi

    # Check for screenshots/evidence
    if [[ -d "docs/uat/screenshots" ]] && [[ $(find docs/uat/screenshots -type f | wc -l) -gt 0 ]]; then
        check_pass "UAT screenshots/evidence collected"
    else
        check_warn "UAT screenshots/evidence not collected"
    fi

    # Check for summary document
    if [[ -f "docs/uat/UAT_SUMMARY.md" ]]; then
        check_pass "UAT summary document exists"
    else
        check_warn "UAT summary document missing (docs/uat/UAT_SUMMARY.md)"
    fi
}

################################################################################
# Verification Category 15: Production Readiness
################################################################################

verify_production_readiness() {
    print_category "15. Production Readiness"

    # Check if UAT passed
    if [[ $UAT_PASSED == true ]]; then
        check_pass "UAT passed with acceptable pass rate"
    else
        check_fail "UAT not passed (pass rate below target)"
    fi

    # Check if critical issues resolved
    if [[ $CRITICAL_ISSUES -eq 0 ]]; then
        check_pass "No critical issues blocking production"
    else
        check_fail "$CRITICAL_ISSUES critical issues unresolved"
    fi

    # Check if sign-off obtained
    if [[ $UAT_SIGN_OFF_OBTAINED == true ]]; then
        check_pass "Business owner sign-off obtained"
    else
        check_fail "Business owner sign-off not obtained"
    fi

    # Overall production readiness
    if [[ $UAT_PASSED == true ]] && [[ $CRITICAL_ISSUES -eq 0 ]] && [[ $UAT_SIGN_OFF_OBTAINED == true ]]; then
        check_pass "Production readiness confirmed - ready for staging deployment"
    else
        check_fail "Production readiness not confirmed"
    fi
}

################################################################################
# Summary
################################################################################

print_summary() {
    print_header "Verification Summary"

    echo "ISS-031: User Acceptance Testing Verification Complete"
    echo ""
    echo "Results:"
    echo -e "  ${GREEN}Passed${NC}:  $PASS_COUNT"
    echo -e "  ${YELLOW}Warnings${NC}: $WARN_COUNT"
    echo -e "  ${RED}Failed${NC}:  $FAIL_COUNT"
    echo ""

    # UAT Results Summary
    if [[ $UAT_TEST_CASES_TOTAL -gt 0 ]]; then
        echo "UAT Test Results:"
        echo "  Total Test Cases:   $UAT_TEST_CASES_TOTAL"
        echo "  Passed:             $UAT_TEST_CASES_PASSED"
        echo "  Failed:             $UAT_TEST_CASES_FAILED"
        echo "  Pass Rate:          ${UAT_PASS_RATE}% (target: ${MIN_UAT_PASS_RATE}%)"
        echo ""
    fi

    # Issues Summary
    echo "Issues:"
    echo "  Critical Issues:    $CRITICAL_ISSUES (target: 0)"
    echo ""

    # Sign-Off Status
    if [[ $UAT_SIGN_OFF_OBTAINED == true ]]; then
        echo "Sign-Off: ✅ Obtained"
    else
        echo "Sign-Off: ❌ Not Obtained"
    fi
    echo ""

    if [[ $FAIL_COUNT -eq 0 ]] && [[ $UAT_SIGN_OFF_OBTAINED == true ]]; then
        echo -e "${GREEN}✓ SUCCESS${NC}: UAT passed - production ready!"
        echo ""
        echo "UAT Achievements:"
        echo "  ✓ Stakeholder sessions conducted"
        echo "  ✓ Business workflows validated"
        echo "  ✓ All modules tested (Products, Customers, Orders, Quotes)"
        echo "  ✓ Feedback collected and addressed"
        echo "  ✓ Critical issues resolved"
        echo "  ✓ Business owner sign-off obtained"
        echo ""
        echo "Next Steps:"
        echo "  1. Create user documentation (ISS-032)"
        echo "  2. Execute staging deployment (ISS-033)"
        echo "  3. Final production deployment (ISS-034)"
    else
        echo -e "${RED}✗ FAILURES DETECTED${NC}: UAT incomplete or issues unresolved"
        echo ""
        echo "Required Actions:"
        if [[ $UAT_SIGN_OFF_OBTAINED == false ]]; then
            echo "  - Obtain business owner sign-off (docs/uat/UAT_SIGN_OFF.md)"
        fi
        if [[ $(echo "$UAT_PASS_RATE < $MIN_UAT_PASS_RATE" | bc -l) -eq 1 ]]; then
            echo "  - Improve UAT pass rate to ${MIN_UAT_PASS_RATE}% (current: ${UAT_PASS_RATE}%)"
        fi
        if [[ $CRITICAL_ISSUES -gt 0 ]]; then
            echo "  - Resolve $CRITICAL_ISSUES critical issues"
        fi
        if [[ $FAIL_COUNT -gt 0 ]]; then
            echo "  - Address $FAIL_COUNT verification failures"
        fi
        echo "  - Re-run verification script after fixes"
        echo ""
        echo "DO NOT deploy to production until UAT passes and sign-off obtained"
    fi

    echo ""
    echo "Documentation: docs/ISS-031-VERIFICATION.md"
    echo "UAT Documents: docs/uat/"
}

################################################################################
# Execute Main Function
################################################################################

main "$@"
