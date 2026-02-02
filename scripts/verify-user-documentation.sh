#!/bin/bash

# ISS-032: User Documentation Verification Script
# Purpose: Verify comprehensive user documentation for all modules
# Components: User guides, admin guide, API documentation, troubleshooting guide
# Success: All documentation complete, accurate, accessible

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verification state
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Documentation completeness tracking
USER_GUIDE_EXISTS=false
ADMIN_GUIDE_EXISTS=false
API_DOCS_EXISTS=false
TROUBLESHOOTING_GUIDE_EXISTS=false
MODULE_GUIDES_COMPLETE=false
SCREENSHOTS_INCLUDED=false
TOC_EXISTS=false
SEARCH_FUNCTIONALITY=false

# Module coverage tracking
PRODUCTS_GUIDE_EXISTS=false
CUSTOMERS_GUIDE_EXISTS=false
ORDERS_GUIDE_EXISTS=false
QUOTES_GUIDE_EXISTS=false

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

check_pass() {
    ((TOTAL_CHECKS++))
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    ((TOTAL_CHECKS++))
    ((FAILED_CHECKS++))
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    ((WARNINGS++))
    echo -e "${YELLOW}⚠${NC} $1"
}

check_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Verification Functions

verify_documentation_structure() {
    print_header "1. Documentation Structure"

    # Check main documentation directory
    if [[ -d "docs/user-guide" ]]; then
        check_pass "User guide directory exists (docs/user-guide/)"

        # Check for required guide files
        if [[ -f "docs/user-guide/USER_GUIDE.md" ]]; then
            check_pass "User guide exists (USER_GUIDE.md)"
            USER_GUIDE_EXISTS=true
        else
            check_fail "User guide missing (USER_GUIDE.md)"
        fi

        if [[ -f "docs/user-guide/ADMIN_GUIDE.md" ]]; then
            check_pass "Admin guide exists (ADMIN_GUIDE.md)"
            ADMIN_GUIDE_EXISTS=true
        else
            check_fail "Admin guide missing (ADMIN_GUIDE.md)"
        fi

        if [[ -f "docs/user-guide/API_DOCUMENTATION.md" ]]; then
            check_pass "API documentation exists (API_DOCUMENTATION.md)"
            API_DOCS_EXISTS=true
        else
            check_fail "API documentation missing (API_DOCUMENTATION.md)"
        fi

        if [[ -f "docs/user-guide/TROUBLESHOOTING_GUIDE.md" ]]; then
            check_pass "Troubleshooting guide exists (TROUBLESHOOTING_GUIDE.md)"
            TROUBLESHOOTING_GUIDE_EXISTS=true
        else
            check_fail "Troubleshooting guide missing (TROUBLESHOOTING_GUIDE.md)"
        fi
    else
        check_fail "User guide directory missing (docs/user-guide/)"
    fi

    # Check for images directory
    if [[ -d "docs/user-guide/images" ]]; then
        check_pass "Images directory exists (docs/user-guide/images/)"
        IMAGE_COUNT=$(find docs/user-guide/images -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.gif" \) | wc -l)
        if [[ $IMAGE_COUNT -gt 0 ]]; then
            check_pass "Screenshots/images included ($IMAGE_COUNT files)"
            SCREENSHOTS_INCLUDED=true
        else
            check_warn "No screenshots/images found in docs/user-guide/images/"
        fi
    else
        check_warn "Images directory missing (docs/user-guide/images/)"
    fi

    check_info "Documentation structure validation complete"
}

verify_user_guide_content() {
    print_header "2. User Guide Content"

    if [[ -f "docs/user-guide/USER_GUIDE.md" ]]; then
        # Check for table of contents
        if grep -q -i "table of contents\|## contents" docs/user-guide/USER_GUIDE.md; then
            check_pass "Table of contents included"
            TOC_EXISTS=true
        else
            check_warn "Table of contents missing"
        fi

        # Check for introduction/overview
        if grep -q -i "## introduction\|## overview\|## getting started" docs/user-guide/USER_GUIDE.md; then
            check_pass "Introduction/overview section included"
        else
            check_fail "Introduction/overview section missing"
        fi

        # Check for module-specific sections
        if grep -q -i "## products\|### products module" docs/user-guide/USER_GUIDE.md; then
            check_pass "Products module documentation included"
            PRODUCTS_GUIDE_EXISTS=true
        else
            check_fail "Products module documentation missing"
        fi

        if grep -q -i "## customers\|### customers module" docs/user-guide/USER_GUIDE.md; then
            check_pass "Customers module documentation included"
            CUSTOMERS_GUIDE_EXISTS=true
        else
            check_fail "Customers module documentation missing"
        fi

        if grep -q -i "## orders\|### orders module" docs/user-guide/USER_GUIDE.md; then
            check_pass "Orders module documentation included"
            ORDERS_GUIDE_EXISTS=true
        else
            check_fail "Orders module documentation missing"
        fi

        if grep -q -i "## quotes\|### quotes module" docs/user-guide/USER_GUIDE.md; then
            check_pass "Quotes module documentation included"
            QUOTES_GUIDE_EXISTS=true
        else
            check_fail "Quotes module documentation missing"
        fi

        # Check for workflow documentation
        if grep -q -i "workflow\|step-by-step\|how to" docs/user-guide/USER_GUIDE.md; then
            check_pass "Workflow/step-by-step instructions included"
        else
            check_warn "Workflow/step-by-step instructions missing"
        fi

        # Check for screenshots references
        if grep -q -i "!\[.*\](.*/images/\|!\[.*\](images/" docs/user-guide/USER_GUIDE.md; then
            check_pass "Screenshot references included"
        else
            check_warn "No screenshot references found"
        fi

        # Check word count (should be comprehensive)
        WORD_COUNT=$(wc -w < docs/user-guide/USER_GUIDE.md)
        if [[ $WORD_COUNT -gt 2000 ]]; then
            check_pass "User guide is comprehensive ($WORD_COUNT words)"
        elif [[ $WORD_COUNT -gt 1000 ]]; then
            check_warn "User guide is moderate length ($WORD_COUNT words, recommend >2000)"
        else
            check_fail "User guide is too brief ($WORD_COUNT words, need >2000)"
        fi

        # Check all modules documented
        if [[ "$PRODUCTS_GUIDE_EXISTS" == true ]] && \
           [[ "$CUSTOMERS_GUIDE_EXISTS" == true ]] && \
           [[ "$ORDERS_GUIDE_EXISTS" == true ]] && \
           [[ "$QUOTES_GUIDE_EXISTS" == true ]]; then
            check_pass "All modules documented (4/4)"
            MODULE_GUIDES_COMPLETE=true
        else
            check_fail "Not all modules documented"
        fi
    else
        check_fail "Cannot verify user guide content - file missing"
    fi

    check_info "User guide content validation complete"
}

verify_admin_guide_content() {
    print_header "3. Admin Guide Content"

    if [[ -f "docs/user-guide/ADMIN_GUIDE.md" ]]; then
        # Check for user management section
        if grep -q -i "## user management\|### user management\|## users" docs/user-guide/ADMIN_GUIDE.md; then
            check_pass "User management section included"
        else
            check_fail "User management section missing"
        fi

        # Check for system configuration section
        if grep -q -i "## system configuration\|### system configuration\|## configuration" docs/user-guide/ADMIN_GUIDE.md; then
            check_pass "System configuration section included"
        else
            check_fail "System configuration section missing"
        fi

        # Check for permissions/roles section
        if grep -q -i "## permissions\|## roles\|### permissions\|### roles" docs/user-guide/ADMIN_GUIDE.md; then
            check_pass "Permissions/roles section included"
        else
            check_warn "Permissions/roles section missing"
        fi

        # Check for database management
        if grep -q -i "## database\|### database\|## backup" docs/user-guide/ADMIN_GUIDE.md; then
            check_pass "Database management section included"
        else
            check_warn "Database management section missing"
        fi

        # Check for security settings
        if grep -q -i "## security\|### security settings" docs/user-guide/ADMIN_GUIDE.md; then
            check_pass "Security settings section included"
        else
            check_warn "Security settings section missing"
        fi

        # Check for environment variables
        if grep -q -i "environment variable\|\.env\|configuration file" docs/user-guide/ADMIN_GUIDE.md; then
            check_pass "Environment variables documentation included"
        else
            check_warn "Environment variables documentation missing"
        fi

        # Check word count
        WORD_COUNT=$(wc -w < docs/user-guide/ADMIN_GUIDE.md)
        if [[ $WORD_COUNT -gt 1500 ]]; then
            check_pass "Admin guide is comprehensive ($WORD_COUNT words)"
        elif [[ $WORD_COUNT -gt 800 ]]; then
            check_warn "Admin guide is moderate length ($WORD_COUNT words, recommend >1500)"
        else
            check_fail "Admin guide is too brief ($WORD_COUNT words, need >1500)"
        fi
    else
        check_fail "Cannot verify admin guide content - file missing"
    fi

    check_info "Admin guide content validation complete"
}

verify_api_documentation_content() {
    print_header "4. API Documentation Content"

    if [[ -f "docs/user-guide/API_DOCUMENTATION.md" ]]; then
        # Check for authentication section
        if grep -q -i "## authentication\|### authentication\|## auth" docs/user-guide/API_DOCUMENTATION.md; then
            check_pass "Authentication section included"
        else
            check_fail "Authentication section missing"
        fi

        # Check for endpoints documentation
        if grep -q -i "## endpoints\|### endpoints\|## api endpoints" docs/user-guide/API_DOCUMENTATION.md; then
            check_pass "Endpoints section included"
        else
            check_fail "Endpoints section missing"
        fi

        # Check for request/response examples
        if grep -q -i "```json\|```http\|example request\|example response" docs/user-guide/API_DOCUMENTATION.md; then
            check_pass "Request/response examples included"
        else
            check_warn "Request/response examples missing"
        fi

        # Check for error codes documentation
        if grep -q -i "## error codes\|### error codes\|## errors" docs/user-guide/API_DOCUMENTATION.md; then
            check_pass "Error codes documentation included"
        else
            check_warn "Error codes documentation missing"
        fi

        # Check for rate limiting documentation
        if grep -q -i "rate limit\|throttling" docs/user-guide/API_DOCUMENTATION.md; then
            check_pass "Rate limiting documentation included"
        else
            check_warn "Rate limiting documentation missing"
        fi

        # Check for OpenAPI/Swagger reference
        if grep -q -i "openapi\|swagger\|/docs\|/redoc" docs/user-guide/API_DOCUMENTATION.md; then
            check_pass "OpenAPI/Swagger reference included"
        else
            check_warn "OpenAPI/Swagger reference missing"
        fi

        # Check for module API coverage
        PRODUCTS_API=$(grep -i "products\|/api/products" docs/user-guide/API_DOCUMENTATION.md | wc -l)
        CUSTOMERS_API=$(grep -i "customers\|/api/customers" docs/user-guide/API_DOCUMENTATION.md | wc -l)
        ORDERS_API=$(grep -i "orders\|/api/orders" docs/user-guide/API_DOCUMENTATION.md | wc -l)
        QUOTES_API=$(grep -i "quotes\|/api/quotes" docs/user-guide/API_DOCUMENTATION.md | wc -l)

        if [[ $PRODUCTS_API -gt 0 ]] && [[ $CUSTOMERS_API -gt 0 ]] && [[ $ORDERS_API -gt 0 ]] && [[ $QUOTES_API -gt 0 ]]; then
            check_pass "All module APIs documented (Products, Customers, Orders, Quotes)"
        else
            check_fail "Not all module APIs documented"
        fi

        # Check word count
        WORD_COUNT=$(wc -w < docs/user-guide/API_DOCUMENTATION.md)
        if [[ $WORD_COUNT -gt 2000 ]]; then
            check_pass "API documentation is comprehensive ($WORD_COUNT words)"
        elif [[ $WORD_COUNT -gt 1000 ]]; then
            check_warn "API documentation is moderate length ($WORD_COUNT words, recommend >2000)"
        else
            check_fail "API documentation is too brief ($WORD_COUNT words, need >2000)"
        fi
    else
        check_fail "Cannot verify API documentation content - file missing"
    fi

    check_info "API documentation content validation complete"
}

verify_troubleshooting_guide_content() {
    print_header "5. Troubleshooting Guide Content"

    if [[ -f "docs/user-guide/TROUBLESHOOTING_GUIDE.md" ]]; then
        # Check for common issues section
        if grep -q -i "## common issues\|### common issues\|## common problems" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "Common issues section included"
        else
            check_fail "Common issues section missing"
        fi

        # Check for error messages section
        if grep -q -i "## error messages\|### error messages\|## errors" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "Error messages section included"
        else
            check_warn "Error messages section missing"
        fi

        # Check for FAQ section
        if grep -q -i "## faq\|### faq\|frequently asked questions" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "FAQ section included"
        else
            check_warn "FAQ section missing"
        fi

        # Check for solution steps
        if grep -q -i "solution:\|fix:\|resolution:\|to resolve:" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "Solution steps included"
        else
            check_fail "Solution steps missing"
        fi

        # Check for contact support section
        if grep -q -i "## support\|### support\|## contact\|### contact" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "Support/contact section included"
        else
            check_warn "Support/contact section missing"
        fi

        # Check for performance issues
        if grep -q -i "performance\|slow\|timeout" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "Performance issues documentation included"
        else
            check_warn "Performance issues documentation missing"
        fi

        # Check for connectivity issues
        if grep -q -i "connection\|network\|connectivity\|cannot connect" docs/user-guide/TROUBLESHOOTING_GUIDE.md; then
            check_pass "Connectivity issues documentation included"
        else
            check_warn "Connectivity issues documentation missing"
        fi

        # Check word count
        WORD_COUNT=$(wc -w < docs/user-guide/TROUBLESHOOTING_GUIDE.md)
        if [[ $WORD_COUNT -gt 1500 ]]; then
            check_pass "Troubleshooting guide is comprehensive ($WORD_COUNT words)"
        elif [[ $WORD_COUNT -gt 800 ]]; then
            check_warn "Troubleshooting guide is moderate length ($WORD_COUNT words, recommend >1500)"
        else
            check_fail "Troubleshooting guide is too brief ($WORD_COUNT words, need >1500)"
        fi
    else
        check_fail "Cannot verify troubleshooting guide content - file missing"
    fi

    check_info "Troubleshooting guide content validation complete"
}

verify_documentation_quality() {
    print_header "6. Documentation Quality"

    # Check for broken links
    check_info "Checking for broken internal links..."
    if [[ -d "docs/user-guide" ]]; then
        BROKEN_LINKS=0
        for file in docs/user-guide/*.md; do
            if [[ -f "$file" ]]; then
                # Extract markdown links
                while IFS= read -r link; do
                    # Check if it's an internal link (not http/https)
                    if [[ ! "$link" =~ ^https?:// ]]; then
                        # Check if file exists
                        LINK_PATH=$(echo "$link" | sed 's/[()]//g' | awk '{print $1}')
                        if [[ ! -f "docs/user-guide/$LINK_PATH" ]]; then
                            ((BROKEN_LINKS++))
                        fi
                    fi
                done < <(grep -o '\[.*\](.*\.md)' "$file" || true)
            fi
        done

        if [[ $BROKEN_LINKS -eq 0 ]]; then
            check_pass "No broken internal links found"
        else
            check_warn "Broken internal links found: $BROKEN_LINKS"
        fi
    fi

    # Check for consistent formatting
    check_info "Checking documentation formatting..."
    FORMATTING_ISSUES=0
    for file in docs/user-guide/*.md; do
        if [[ -f "$file" ]]; then
            # Check for consistent heading levels (no skipping from # to ###)
            if grep -q "^# " "$file" && grep -q "^### " "$file" && ! grep -q "^## " "$file"; then
                ((FORMATTING_ISSUES++))
            fi
        fi
    done

    if [[ $FORMATTING_ISSUES -eq 0 ]]; then
        check_pass "Documentation formatting is consistent"
    else
        check_warn "Documentation formatting issues found: $FORMATTING_ISSUES files"
    fi

    # Check for code examples
    check_info "Checking for code examples..."
    CODE_EXAMPLES_COUNT=0
    for file in docs/user-guide/*.md; do
        if [[ -f "$file" ]]; then
            COUNT=$(grep -c '```' "$file" || echo "0")
            ((CODE_EXAMPLES_COUNT += COUNT))
        fi
    done

    if [[ $CODE_EXAMPLES_COUNT -gt 10 ]]; then
        check_pass "Code examples included ($((CODE_EXAMPLES_COUNT / 2)) code blocks)"
    else
        check_warn "Limited code examples ($((CODE_EXAMPLES_COUNT / 2)) code blocks, recommend >5)"
    fi

    # Check for tables
    check_info "Checking for tables..."
    TABLES_COUNT=0
    for file in docs/user-guide/*.md; do
        if [[ -f "$file" ]]; then
            COUNT=$(grep -c '^|.*|.*|' "$file" || echo "0")
            ((TABLES_COUNT += COUNT))
        fi
    done

    if [[ $TABLES_COUNT -gt 5 ]]; then
        check_pass "Tables used for structured information ($TABLES_COUNT table rows)"
    else
        check_warn "Limited table usage ($TABLES_COUNT table rows, recommend using tables)"
    fi

    check_info "Documentation quality validation complete"
}

verify_module_coverage() {
    print_header "7. Module Coverage"

    # Products module
    if grep -r -i "products module\|managing products\|product crud" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Products module documented"
    else
        check_fail "Products module documentation missing"
    fi

    # Customers module
    if grep -r -i "customers module\|managing customers\|customer crud" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Customers module documented"
    else
        check_fail "Customers module documentation missing"
    fi

    # Orders module
    if grep -r -i "orders module\|managing orders\|order crud" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Orders module documented"
    else
        check_fail "Orders module documentation missing"
    fi

    # Quotes module
    if grep -r -i "quotes module\|managing quotes\|quote crud" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Quotes module documented"
    else
        check_fail "Quotes module documentation missing"
    fi

    # CRUD operations documented for each module
    if grep -r -i "create.*product\|add.*product" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "update.*product\|edit.*product" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "delete.*product\|remove.*product" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Products CRUD operations documented"
    else
        check_warn "Products CRUD operations documentation incomplete"
    fi

    if grep -r -i "create.*customer\|add.*customer" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "update.*customer\|edit.*customer" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "delete.*customer\|remove.*customer" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Customers CRUD operations documented"
    else
        check_warn "Customers CRUD operations documentation incomplete"
    fi

    if grep -r -i "create.*order\|add.*order" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "update.*order\|edit.*order" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "status.*order\|order status" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Orders operations documented"
    else
        check_warn "Orders operations documentation incomplete"
    fi

    if grep -r -i "create.*quote\|add.*quote" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "update.*quote\|edit.*quote" docs/user-guide/ 2>/dev/null | grep -q . && \
       grep -r -i "convert.*order\|quote.*order" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Quotes operations documented"
    else
        check_warn "Quotes operations documentation incomplete"
    fi

    check_info "Module coverage validation complete"
}

verify_workflow_documentation() {
    print_header "8. Workflow Documentation"

    # Check for end-to-end workflows
    if grep -r -i "workflow\|end-to-end\|step-by-step" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Workflow documentation included"
    else
        check_warn "Workflow documentation missing"
    fi

    # Check for quote-to-order workflow
    if grep -r -i "quote.*order\|convert.*quote\|quote conversion" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Quote-to-order workflow documented"
    else
        check_warn "Quote-to-order workflow missing"
    fi

    # Check for order fulfillment workflow
    if grep -r -i "order fulfillment\|fulfill.*order\|order processing" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Order fulfillment workflow documented"
    else
        check_warn "Order fulfillment workflow missing"
    fi

    # Check for customer onboarding
    if grep -r -i "customer.*onboarding\|new customer\|customer registration" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Customer onboarding documented"
    else
        check_warn "Customer onboarding missing"
    fi

    # Check for inventory management workflow
    if grep -r -i "inventory.*management\|stock.*management\|inventory workflow" docs/user-guide/ 2>/dev/null | grep -q .; then
        check_pass "Inventory management workflow documented"
    else
        check_warn "Inventory management workflow missing"
    fi

    check_info "Workflow documentation validation complete"
}

verify_screenshots_and_visuals() {
    print_header "9. Screenshots and Visuals"

    if [[ -d "docs/user-guide/images" ]]; then
        # Count screenshots
        SCREENSHOT_COUNT=$(find docs/user-guide/images -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.gif" \) 2>/dev/null | wc -l)

        if [[ $SCREENSHOT_COUNT -gt 20 ]]; then
            check_pass "Comprehensive screenshots ($SCREENSHOT_COUNT images)"
        elif [[ $SCREENSHOT_COUNT -gt 10 ]]; then
            check_warn "Moderate screenshots ($SCREENSHOT_COUNT images, recommend >20)"
        elif [[ $SCREENSHOT_COUNT -gt 0 ]]; then
            check_warn "Limited screenshots ($SCREENSHOT_COUNT images, recommend >20)"
        else
            check_fail "No screenshots found"
        fi

        # Check for dashboard screenshot
        if find docs/user-guide/images -name "*dashboard*" 2>/dev/null | grep -q .; then
            check_pass "Dashboard screenshot included"
        else
            check_warn "Dashboard screenshot missing"
        fi

        # Check for module screenshots
        for module in products customers orders quotes; do
            if find docs/user-guide/images -name "*$module*" 2>/dev/null | grep -q .; then
                check_pass "$(echo $module | sed 's/.*/\u&/') module screenshot included"
            else
                check_warn "$(echo $module | sed 's/.*/\u&/') module screenshot missing"
            fi
        done

        # Check for form screenshots
        if find docs/user-guide/images -name "*form*" -o -name "*create*" -o -name "*edit*" 2>/dev/null | grep -q .; then
            check_pass "Form screenshots included"
        else
            check_warn "Form screenshots missing"
        fi
    else
        check_fail "Images directory missing (docs/user-guide/images/)"
    fi

    check_info "Screenshots and visuals validation complete"
}

verify_navigation_and_search() {
    print_header "10. Navigation and Search"

    # Check for README with navigation
    if [[ -f "docs/user-guide/README.md" ]]; then
        check_pass "README exists for documentation navigation"

        if grep -q "## Table of Contents\|## Contents" docs/user-guide/README.md; then
            check_pass "README contains table of contents"
        else
            check_warn "README missing table of contents"
        fi

        # Check for links to all guides
        if grep -q "USER_GUIDE.md" docs/user-guide/README.md && \
           grep -q "ADMIN_GUIDE.md" docs/user-guide/README.md && \
           grep -q "API_DOCUMENTATION.md" docs/user-guide/README.md && \
           grep -q "TROUBLESHOOTING_GUIDE.md" docs/user-guide/README.md; then
            check_pass "README links to all guides"
        else
            check_warn "README missing links to some guides"
        fi
    else
        check_warn "README missing (recommend creating docs/user-guide/README.md)"
    fi

    # Check for index/search functionality hints
    if grep -r -i "search\|index" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Search/index references included"
        SEARCH_FUNCTIONALITY=true
    else
        check_warn "No search/index references found"
    fi

    check_info "Navigation and search validation complete"
}

verify_versioning_and_changelog() {
    print_header "11. Versioning and Changelog"

    # Check for version information
    if grep -r -i "version\|v[0-9]\+\.[0-9]\+" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Version information included"
    else
        check_warn "Version information missing"
    fi

    # Check for changelog
    if [[ -f "docs/user-guide/CHANGELOG.md" ]]; then
        check_pass "Changelog exists (CHANGELOG.md)"
    else
        check_warn "Changelog missing (recommend creating CHANGELOG.md)"
    fi

    # Check for last updated dates
    if grep -r -i "last updated\|updated:\|date:" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Last updated dates included"
    else
        check_warn "Last updated dates missing"
    fi

    check_info "Versioning and changelog validation complete"
}

verify_accessibility() {
    print_header "12. Accessibility"

    # Check for alt text on images
    ALT_TEXT_COUNT=$(grep -r "!\[.*\]" docs/user-guide/*.md 2>/dev/null | grep -v "!\[\]" | wc -l)
    IMAGES_WITHOUT_ALT=$(grep -r "!\[\]" docs/user-guide/*.md 2>/dev/null | wc -l)

    if [[ $ALT_TEXT_COUNT -gt 0 ]] && [[ $IMAGES_WITHOUT_ALT -eq 0 ]]; then
        check_pass "All images have alt text ($ALT_TEXT_COUNT images)"
    elif [[ $ALT_TEXT_COUNT -gt 0 ]]; then
        check_warn "Some images missing alt text ($IMAGES_WITHOUT_ALT without alt text)"
    else
        check_warn "No image alt text verification possible"
    fi

    # Check for heading structure
    if grep -r "^# " docs/user-guide/*.md 2>/dev/null | grep -q . && \
       grep -r "^## " docs/user-guide/*.md 2>/dev/null | grep -q . && \
       grep -r "^### " docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Proper heading hierarchy used"
    else
        check_warn "Heading hierarchy may be inconsistent"
    fi

    # Check for descriptive links
    DESCRIPTIVE_LINKS=$(grep -r "\[click here\]\|\[here\]\|\[link\]" docs/user-guide/*.md 2>/dev/null | wc -l)
    if [[ $DESCRIPTIVE_LINKS -eq 0 ]]; then
        check_pass "Links use descriptive text"
    else
        check_warn "Non-descriptive links found ($DESCRIPTIVE_LINKS instances)"
    fi

    check_info "Accessibility validation complete"
}

verify_examples_and_tutorials() {
    print_header "13. Examples and Tutorials"

    # Check for examples
    EXAMPLES_COUNT=$(grep -r -i "## example\|### example\|for example" docs/user-guide/*.md 2>/dev/null | wc -l)
    if [[ $EXAMPLES_COUNT -gt 10 ]]; then
        check_pass "Examples included throughout documentation ($EXAMPLES_COUNT examples)"
    elif [[ $EXAMPLES_COUNT -gt 5 ]]; then
        check_warn "Moderate examples ($EXAMPLES_COUNT examples, recommend >10)"
    else
        check_warn "Limited examples ($EXAMPLES_COUNT examples, recommend >10)"
    fi

    # Check for tutorials
    if grep -r -i "## tutorial\|### tutorial\|step-by-step" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Tutorials/step-by-step guides included"
    else
        check_warn "Tutorials/step-by-step guides missing"
    fi

    # Check for quick start guide
    if grep -r -i "quick start\|getting started\|quickstart" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Quick start guide included"
    else
        check_warn "Quick start guide missing"
    fi

    check_info "Examples and tutorials validation complete"
}

verify_feedback_mechanism() {
    print_header "14. Feedback Mechanism"

    # Check for feedback/contribution section
    if grep -r -i "feedback\|contribution\|contribute\|report.*issue" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Feedback mechanism documented"
    else
        check_warn "Feedback mechanism missing"
    fi

    # Check for contact information
    if grep -r -i "contact\|support\|email\|help" docs/user-guide/*.md 2>/dev/null | grep -q .; then
        check_pass "Contact/support information included"
    else
        check_warn "Contact/support information missing"
    fi

    check_info "Feedback mechanism validation complete"
}

verify_production_readiness() {
    print_header "15. Production Readiness"

    # All required documentation files exist
    if [[ "$USER_GUIDE_EXISTS" == true ]] && \
       [[ "$ADMIN_GUIDE_EXISTS" == true ]] && \
       [[ "$API_DOCS_EXISTS" == true ]] && \
       [[ "$TROUBLESHOOTING_GUIDE_EXISTS" == true ]]; then
        check_pass "All required documentation files exist (4/4)"
    else
        check_fail "Not all required documentation files exist"
    fi

    # All modules covered
    if [[ "$MODULE_GUIDES_COMPLETE" == true ]]; then
        check_pass "All modules documented (Products, Customers, Orders, Quotes)"
    else
        check_fail "Not all modules documented"
    fi

    # Screenshots included
    if [[ "$SCREENSHOTS_INCLUDED" == true ]]; then
        check_pass "Screenshots/visuals included"
    else
        check_warn "Screenshots/visuals missing or limited"
    fi

    # Documentation is comprehensive
    TOTAL_WORD_COUNT=0
    for file in docs/user-guide/*.md; do
        if [[ -f "$file" ]]; then
            WC=$(wc -w < "$file")
            ((TOTAL_WORD_COUNT += WC))
        fi
    done

    if [[ $TOTAL_WORD_COUNT -gt 7000 ]]; then
        check_pass "Documentation is comprehensive ($TOTAL_WORD_COUNT total words)"
    elif [[ $TOTAL_WORD_COUNT -gt 5000 ]]; then
        check_warn "Documentation is moderate ($TOTAL_WORD_COUNT total words, recommend >7000)"
    else
        check_fail "Documentation is insufficient ($TOTAL_WORD_COUNT total words, need >7000)"
    fi

    # Final status
    if [[ "$USER_GUIDE_EXISTS" == true ]] && \
       [[ "$ADMIN_GUIDE_EXISTS" == true ]] && \
       [[ "$API_DOCS_EXISTS" == true ]] && \
       [[ "$TROUBLESHOOTING_GUIDE_EXISTS" == true ]] && \
       [[ "$MODULE_GUIDES_COMPLETE" == true ]] && \
       [[ $TOTAL_WORD_COUNT -gt 5000 ]]; then
        check_pass "✅ USER DOCUMENTATION COMPLETE - PRODUCTION READY"
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Status: APPROVED FOR PRODUCTION DEPLOYMENT${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        check_fail "❌ USER DOCUMENTATION INCOMPLETE"
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}Status: NOT READY - ADDRESS FAILURES ABOVE${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi

    check_info "Production readiness validation complete"
}

print_summary() {
    print_header "VERIFICATION SUMMARY"

    echo -e "${BLUE}Total Checks:${NC} $TOTAL_CHECKS"
    echo -e "${GREEN}Passed:${NC} $PASSED_CHECKS"
    echo -e "${RED}Failed:${NC} $FAILED_CHECKS"
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""

    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ USER DOCUMENTATION VERIFICATION PASSED${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${GREEN}All user documentation complete and production-ready!${NC}"
        echo ""
        echo -e "${BLUE}Next Steps:${NC}"
        echo "  1. Review user guides for accuracy"
        echo "  2. Test all workflows with real users"
        echo "  3. Publish documentation to docs site"
        echo "  4. Continue with ISS-033 (Execute Staging Deployment)"
        return 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}❌ USER DOCUMENTATION VERIFICATION FAILED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${RED}Please address the failed checks above before proceeding.${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                    ISS-032: USER DOCUMENTATION VERIFICATION                  ║
║                    CCW-Online ERP - Production Readiness                     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}\n"

    verify_documentation_structure
    verify_user_guide_content
    verify_admin_guide_content
    verify_api_documentation_content
    verify_troubleshooting_guide_content
    verify_documentation_quality
    verify_module_coverage
    verify_workflow_documentation
    verify_screenshots_and_visuals
    verify_navigation_and_search
    verify_versioning_and_changelog
    verify_accessibility
    verify_examples_and_tutorials
    verify_feedback_mechanism
    verify_production_readiness

    print_summary
}

# Run main function
main
exit $?
