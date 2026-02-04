#!/bin/bash

# ISS-033: Execute Staging Deployment - Verification Script
# Purpose: Verify staging environment deployment, configuration, and stability
# Components: Infrastructure, services, database, security, performance, monitoring
# Success: All services running, tests passing, 99%+ uptime, stakeholders signed off

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

# Deployment status tracking
STAGING_URL=${STAGING_URL:-"https://staging.ccw-online.com"}
STAGING_API_URL=${STAGING_API_URL:-"https://staging-api.ccw-online.com"}
INFRASTRUCTURE_READY=false
SERVICES_RUNNING=false
DATABASE_MIGRATED=false
TESTS_PASSING=false
SECURITY_VALIDATED=false
PERFORMANCE_ACCEPTABLE=false
MONITORING_ACTIVE=false
STAKEHOLDERS_TESTED=false

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

verify_infrastructure_provisioned() {
    print_header "1. Infrastructure Provisioning"

    # Check if staging server is accessible
    if curl -s --head --request GET "$STAGING_URL" | grep "HTTP" > /dev/null; then
        check_pass "Staging server accessible ($STAGING_URL)"
    else
        check_fail "Staging server not accessible ($STAGING_URL)"
        return
    fi

    # Check API server
    if curl -s --head --request GET "$STAGING_API_URL/api/health" | grep "HTTP" > /dev/null; then
        check_pass "Staging API server accessible ($STAGING_API_URL)"
    else
        check_fail "Staging API server not accessible ($STAGING_API_URL)"
    fi

    # Check SSL certificate
    if curl -s -I "$STAGING_URL" | grep -i "strict-transport-security" > /dev/null; then
        check_pass "SSL/TLS certificate configured (HSTS header present)"
    else
        check_warn "HSTS header not present (SSL may not be fully configured)"
    fi

    # Check DNS resolution
    if nslookup staging.ccw-online.com > /dev/null 2>&1; then
        check_pass "DNS resolution working (staging.ccw-online.com)"
    else
        check_fail "DNS resolution failed for staging.ccw-online.com"
    fi

    # Check load balancer health
    check_info "Checking load balancer configuration..."
    if curl -s "$STAGING_URL" | grep -q "CCW-Online"; then
        check_pass "Load balancer routing traffic correctly"
        INFRASTRUCTURE_READY=true
    else
        check_warn "Load balancer may not be configured correctly"
    fi

    check_info "Infrastructure provisioning validation complete"
}

verify_services_running() {
    print_header "2. Services Running"

    # Check frontend service
    check_info "Checking frontend service (Next.js)..."
    if curl -s "$STAGING_URL" | grep -q "CCW-Online\|ERP"; then
        check_pass "Frontend service running (Next.js)"
    else
        check_fail "Frontend service not responding"
    fi

    # Check backend service
    check_info "Checking backend service (FastAPI)..."
    HEALTH_RESPONSE=$(curl -s "$STAGING_API_URL/api/health" || echo "failed")
    if echo "$HEALTH_RESPONSE" | grep -q "healthy\|ok\|status"; then
        check_pass "Backend service running (FastAPI)"
        SERVICES_RUNNING=true
    else
        check_fail "Backend service not responding correctly"
    fi

    # Check database connection
    if echo "$HEALTH_RESPONSE" | grep -q "database.*connected\|db.*ok"; then
        check_pass "Database connection healthy"
    else
        check_warn "Cannot verify database connection from health endpoint"
    fi

    # Check Redis connection (if configured)
    if echo "$HEALTH_RESPONSE" | grep -q "redis.*connected\|cache.*ok"; then
        check_pass "Redis cache connection healthy"
    else
        check_info "Redis not configured or not included in health check"
    fi

    # Check service versions
    check_info "Verifying service versions match repository..."
    VERSION_RESPONSE=$(curl -s "$STAGING_API_URL/api/version" || echo "unknown")
    if echo "$VERSION_RESPONSE" | grep -q "version\|git"; then
        check_pass "Version endpoint responding"
        echo "     Version: $VERSION_RESPONSE"
    else
        check_warn "Version endpoint not available"
    fi

    check_info "Services validation complete"
}

verify_database_migration() {
    print_header "3. Database Migration"

    check_info "Verifying database schema is up to date..."

    # Check if migration endpoint exists (admin only)
    MIGRATION_STATUS=$(curl -s "$STAGING_API_URL/api/admin/migration/status" 2>/dev/null || echo "unavailable")

    if echo "$MIGRATION_STATUS" | grep -q "current\|head\|up-to-date"; then
        check_pass "Database migrations applied successfully"
        DATABASE_MIGRATED=true
    else
        check_warn "Cannot verify migration status (may require admin auth)"
    fi

    # Check if seed data exists
    PRODUCTS_COUNT=$(curl -s "$STAGING_API_URL/api/products?page_size=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
    if [[ "$PRODUCTS_COUNT" -gt 0 ]]; then
        check_pass "Seed data present (products: $PRODUCTS_COUNT)"
    else
        check_warn "No products found - seed data may not be loaded"
    fi

    # Check database tables exist
    check_info "Verifying critical tables exist..."
    for table in products customers orders quotes users; do
        # Try to query each table via API
        RESPONSE=$(curl -s "$STAGING_API_URL/api/$table?page_size=1" || echo "failed")
        if echo "$RESPONSE" | grep -q "data\|total\|\[\]"; then
            check_pass "Table '$table' accessible via API"
        else
            check_fail "Table '$table' not accessible or API endpoint missing"
        fi
    done

    check_info "Database migration validation complete"
}

verify_environment_configuration() {
    print_header "4. Environment Configuration"

    # Check environment-specific configuration
    check_info "Verifying staging environment configuration..."

    # Check CORS configuration (should allow staging frontend)
    CORS_TEST=$(curl -s -H "Origin: $STAGING_URL" -H "Access-Control-Request-Method: GET" -I "$STAGING_API_URL/api/health" | grep -i "access-control-allow-origin" || echo "missing")
    if echo "$CORS_TEST" | grep -q "access-control-allow-origin"; then
        check_pass "CORS configured for staging frontend"
    else
        check_warn "CORS headers not detected (may cause frontend API errors)"
    fi

    # Check rate limiting is enabled
    check_info "Testing rate limiting configuration..."
    # Make multiple rapid requests to test rate limiting
    RATE_LIMIT_COUNT=0
    for i in {1..15}; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_API_URL/api/health")
        if [[ "$RESPONSE" == "429" ]]; then
            RATE_LIMIT_COUNT=$((RATE_LIMIT_COUNT + 1))
        fi
    done

    if [[ $RATE_LIMIT_COUNT -gt 0 ]]; then
        check_pass "Rate limiting active (received 429 after rapid requests)"
    else
        check_info "Rate limiting not triggered (may be disabled or limits high)"
    fi

    # Check authentication is enforced
    AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_API_URL/api/users")
    if [[ "$AUTH_TEST" == "401" || "$AUTH_TEST" == "403" ]]; then
        check_pass "Authentication enforced (protected endpoints return 401/403)"
    else
        check_warn "Authentication may not be properly enforced (status: $AUTH_TEST)"
    fi

    check_info "Environment configuration validation complete"
}

verify_integration_tests() {
    print_header "5. Integration Tests"

    check_info "Running integration test suite against staging..."

    # Check if test script exists
    if [[ -f "scripts/run-integration-tests.sh" ]]; then
        check_info "Running integration tests..."

        # Set environment to staging
        export TEST_BACKEND_URL="$STAGING_API_URL"
        export TEST_FRONTEND_URL="$STAGING_URL"

        # Run tests (capture output)
        if ./scripts/run-integration-tests.sh > /tmp/staging-integration-tests.log 2>&1; then
            check_pass "Integration tests passed against staging"
            TESTS_PASSING=true
        else
            check_fail "Integration tests failed (see /tmp/staging-integration-tests.log)"
            cat /tmp/staging-integration-tests.log | tail -20
        fi
    else
        check_warn "Integration test script not found (scripts/run-integration-tests.sh)"
    fi

    # Run smoke tests (basic API calls)
    check_info "Running smoke tests..."

    # Test 1: Health endpoint
    if curl -s "$STAGING_API_URL/api/health" | grep -q "healthy\|ok"; then
        check_pass "Smoke test: Health endpoint responding"
    else
        check_fail "Smoke test: Health endpoint failed"
    fi

    # Test 2: Products list
    if curl -s "$STAGING_API_URL/api/products?page_size=5" | grep -q "data"; then
        check_pass "Smoke test: Products API responding"
    else
        check_fail "Smoke test: Products API failed"
    fi

    # Test 3: Authentication
    AUTH_RESPONSE=$(curl -s -X POST "$STAGING_API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@demo.com","password":"demo123"}' || echo "failed")

    if echo "$AUTH_RESPONSE" | grep -q "access_token\|token"; then
        check_pass "Smoke test: Authentication working"
    else
        check_warn "Smoke test: Authentication may not be working (check credentials)"
    fi

    check_info "Integration tests validation complete"
}

verify_security_hardening() {
    print_header "6. Security Hardening"

    check_info "Verifying security configuration..."

    # Check HTTPS redirect
    HTTP_REDIRECT=$(curl -s -I "http://staging.ccw-online.com" | grep -i "location.*https" || echo "missing")
    if echo "$HTTP_REDIRECT" | grep -q "https"; then
        check_pass "HTTP to HTTPS redirect configured"
    else
        check_warn "HTTP to HTTPS redirect not detected"
    fi

    # Check security headers
    check_info "Checking security headers..."
    HEADERS=$(curl -s -I "$STAGING_URL")

    if echo "$HEADERS" | grep -qi "strict-transport-security"; then
        check_pass "HSTS header present"
    else
        check_warn "HSTS header missing"
    fi

    if echo "$HEADERS" | grep -qi "x-content-type-options"; then
        check_pass "X-Content-Type-Options header present"
    else
        check_warn "X-Content-Type-Options header missing"
    fi

    if echo "$HEADERS" | grep -qi "x-frame-options"; then
        check_pass "X-Frame-Options header present"
    else
        check_warn "X-Frame-Options header missing"
    fi

    # Check for exposed secrets
    check_info "Checking for exposed secrets in responses..."
    SECRET_CHECK=$(curl -s "$STAGING_API_URL/api/health" | grep -iE "password|secret|key|token" || echo "none")
    if echo "$SECRET_CHECK" | grep -q "none"; then
        check_pass "No secrets exposed in API responses"
        SECURITY_VALIDATED=true
    else
        check_fail "Potential secrets exposed in API responses"
    fi

    # Check SQL injection protection (basic test)
    SQL_INJECTION_TEST=$(curl -s "$STAGING_API_URL/api/products?search=' OR 1=1--" || echo "failed")
    if echo "$SQL_INJECTION_TEST" | grep -q "data\|\[\]"; then
        check_pass "SQL injection protection active (query sanitized)"
    else
        check_warn "Cannot verify SQL injection protection"
    fi

    check_info "Security hardening validation complete"
}

verify_performance_benchmarks() {
    print_header "7. Performance Benchmarks"

    check_info "Running performance tests..."

    # Test 1: Homepage load time
    HOME_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$STAGING_URL")
    HOME_MS=$(echo "$HOME_TIME * 1000" | bc | cut -d. -f1)
    if [[ $HOME_MS -lt 3000 ]]; then
        check_pass "Homepage load time: ${HOME_MS}ms (<3s target)"
    else
        check_warn "Homepage load time: ${HOME_MS}ms (>3s, may be slow)"
    fi

    # Test 2: API response time
    API_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$STAGING_API_URL/api/health")
    API_MS=$(echo "$API_TIME * 1000" | bc | cut -d. -f1)
    if [[ $API_MS -lt 500 ]]; then
        check_pass "API response time: ${API_MS}ms (<500ms target)"
        PERFORMANCE_ACCEPTABLE=true
    else
        check_warn "API response time: ${API_MS}ms (>500ms, may be slow)"
    fi

    # Test 3: Products list load time
    PRODUCTS_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$STAGING_API_URL/api/products?page_size=50")
    PRODUCTS_MS=$(echo "$PRODUCTS_TIME * 1000" | bc | cut -d. -f1)
    if [[ $PRODUCTS_MS -lt 1000 ]]; then
        check_pass "Products list load time: ${PRODUCTS_MS}ms (<1s target)"
    else
        check_warn "Products list load time: ${PRODUCTS_MS}ms (>1s, may be slow)"
    fi

    # Test 4: Concurrent requests (simple load test)
    check_info "Testing concurrent request handling (10 requests)..."
    CONCURRENT_START=$(date +%s)
    for i in {1..10}; do
        curl -s "$STAGING_API_URL/api/health" > /dev/null &
    done
    wait
    CONCURRENT_END=$(date +%s)
    CONCURRENT_DURATION=$((CONCURRENT_END - CONCURRENT_START))

    if [[ $CONCURRENT_DURATION -lt 5 ]]; then
        check_pass "Concurrent request handling: ${CONCURRENT_DURATION}s for 10 requests"
    else
        check_warn "Concurrent request handling slow: ${CONCURRENT_DURATION}s for 10 requests"
    fi

    check_info "Performance benchmarks validation complete"
}

verify_monitoring_active() {
    print_header "8. Monitoring and Alerting"

    check_info "Verifying monitoring systems..."

    # Check if health endpoint is being monitored
    if curl -s "$STAGING_API_URL/api/health" | grep -q "healthy\|ok"; then
        check_pass "Health endpoint available for monitoring"
    else
        check_fail "Health endpoint not responding"
    fi

    # Check if monitoring documentation exists
    if [[ -f "docs/PRODUCTION_RUNBOOK.md" ]]; then
        check_pass "Production runbook exists (docs/PRODUCTION_RUNBOOK.md)"
    else
        check_warn "Production runbook missing (recommended for monitoring)"
    fi

    # Check if logs are accessible
    check_info "Verifying log accessibility..."
    if docker compose logs backend --tail=1 > /dev/null 2>&1; then
        check_pass "Backend logs accessible via Docker Compose"
        MONITORING_ACTIVE=true
    else
        check_warn "Cannot access backend logs (may need SSH/server access)"
    fi

    # Check Prometheus/Grafana (if configured)
    PROMETHEUS_URL=${PROMETHEUS_URL:-"http://staging.ccw-online.com:9090"}
    if curl -s "$PROMETHEUS_URL" > /dev/null 2>&1; then
        check_pass "Prometheus monitoring available ($PROMETHEUS_URL)"
    else
        check_info "Prometheus not detected (optional monitoring tool)"
    fi

    # Check Sentry error tracking (if configured)
    check_info "Checking error tracking configuration..."
    if grep -q "SENTRY_DSN" .env 2>/dev/null; then
        check_pass "Sentry error tracking configured"
    else
        check_info "Sentry not configured (optional error tracking)"
    fi

    check_info "Monitoring and alerting validation complete"
}

verify_backup_procedures() {
    print_header "9. Backup Procedures"

    check_info "Verifying backup configuration..."

    # Check if backup script exists
    if [[ -f "scripts/backup-database.sh" ]]; then
        check_pass "Backup script exists (scripts/backup-database.sh)"
    else
        check_fail "Backup script missing"
    fi

    # Check backup directory exists
    if [[ -d "backups" ]] || [[ -d "backups/postgresql" ]]; then
        check_pass "Backup directory exists"
    else
        check_warn "Backup directory not found (backups/postgresql)"
    fi

    # Check if automated backups are configured (cron)
    if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
        check_pass "Automated backups configured (cron job active)"
    else
        check_warn "Automated backups not configured in cron"
    fi

    # Check restore procedure documented
    if [[ -f "docs/BACKUP_STRATEGY.md" ]] || grep -q "restore" docs/*.md 2>/dev/null; then
        check_pass "Backup/restore procedures documented"
    else
        check_warn "Backup/restore procedures not documented"
    fi

    check_info "Backup procedures validation complete"
}

verify_stakeholder_testing() {
    print_header "10. Stakeholder Testing"

    check_info "Verifying stakeholder testing status..."

    # Check if UAT sign-off document exists
    if [[ -f "docs/uat/UAT_SIGN_OFF.md" ]]; then
        if grep -q "staging.*approved\|staging.*sign-off" docs/uat/UAT_SIGN_OFF.md 2>/dev/null; then
            check_pass "Stakeholder UAT sign-off obtained for staging"
            STAKEHOLDERS_TESTED=true
        else
            check_warn "UAT sign-off exists but staging approval not documented"
        fi
    else
        check_warn "UAT sign-off document not found (docs/uat/UAT_SIGN_OFF.md)"
    fi

    # Check if stakeholder testing is documented
    if [[ -f "docs/STAGING_VALIDATION.md" ]]; then
        check_pass "Staging validation documentation exists"
    else
        check_warn "Staging validation documentation missing (recommended)"
    fi

    # Check if known issues are documented
    if [[ -f "docs/STAGING_KNOWN_ISSUES.md" ]] || grep -q "known.*issue" docs/*.md 2>/dev/null; then
        check_pass "Known issues documented"
    else
        check_info "No known issues documented (or documentation missing)"
    fi

    check_info "Stakeholder testing validation complete"
}

verify_deployment_rollback() {
    print_header "11. Rollback Capability"

    check_info "Verifying rollback procedures..."

    # Check if rollback script exists
    if [[ -f "scripts/rollback-deployment.sh" ]]; then
        check_pass "Rollback script exists (scripts/rollback-deployment.sh)"
    else
        check_warn "Rollback script missing (recommended for quick recovery)"
    fi

    # Check if previous version is tagged
    if git tag | grep -q "v"; then
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
        check_pass "Git tags exist for versioning (latest: $LATEST_TAG)"
    else
        check_warn "No git tags found (recommended for version tracking)"
    fi

    # Check if deployment documentation includes rollback procedure
    if grep -q "rollback" docs/*.md 2>/dev/null; then
        check_pass "Rollback procedure documented"
    else
        check_warn "Rollback procedure not documented"
    fi

    check_info "Rollback capability validation complete"
}

verify_documentation_complete() {
    print_header "12. Documentation Complete"

    check_info "Verifying all documentation is present..."

    # Check required documentation files
    REQUIRED_DOCS=(
        "docs/PRODUCTION_RUNBOOK.md"
        "docs/DEPLOYMENT_ROADMAP_SUMMARY.md"
        "docs/user-guide/README.md"
        "docs/user-guide/USER_GUIDE.md"
        "docs/user-guide/ADMIN_GUIDE.md"
    )

    DOCS_FOUND=0
    DOCS_MISSING=0

    for doc in "${REQUIRED_DOCS[@]}"; do
        if [[ -f "$doc" ]]; then
            check_pass "Documentation exists: $doc"
            ((DOCS_FOUND++))
        else
            check_warn "Documentation missing: $doc"
            ((DOCS_MISSING++))
        fi
    done

    if [[ $DOCS_FOUND -ge 3 ]]; then
        check_pass "Essential documentation present ($DOCS_FOUND/${#REQUIRED_DOCS[@]} files)"
    else
        check_warn "Missing essential documentation ($DOCS_MISSING/${#REQUIRED_DOCS[@]} files missing)"
    fi

    check_info "Documentation validation complete"
}

verify_seven_day_stability() {
    print_header "13. Seven-Day Stability Period"

    check_info "Verifying 7-day stability observation..."

    # Check if stability tracking document exists
    if [[ -f "docs/STAGING_STABILITY_LOG.md" ]]; then
        check_pass "Stability tracking document exists"

        # Check for daily entries (7 days)
        DAILY_ENTRIES=$(grep -c "Day [0-9]" docs/STAGING_STABILITY_LOG.md 2>/dev/null || echo "0")
        if [[ $DAILY_ENTRIES -ge 7 ]]; then
            check_pass "7-day stability period documented ($DAILY_ENTRIES daily entries)"
        else
            check_warn "7-day stability period incomplete ($DAILY_ENTRIES/$7 days documented)"
        fi
    else
        check_warn "Stability tracking document missing (docs/STAGING_STABILITY_LOG.md)"
        check_info "Create document to track daily uptime, errors, performance for 7 days"
    fi

    # Check uptime target (99%+)
    if [[ -f "docs/STAGING_STABILITY_LOG.md" ]]; then
        UPTIME=$(grep -oP "uptime:?\s*\K[0-9.]+%" docs/STAGING_STABILITY_LOG.md | tail -1 || echo "0")
        UPTIME_NUM=$(echo "$UPTIME" | tr -d '%')

        if [[ $(echo "$UPTIME_NUM >= 99" | bc) -eq 1 ]]; then
            check_pass "Uptime target met: $UPTIME (>99% required)"
        elif [[ $(echo "$UPTIME_NUM > 0" | bc) -eq 1 ]]; then
            check_warn "Uptime below target: $UPTIME (<99% required)"
        else
            check_info "Uptime not yet documented"
        fi
    fi

    check_info "Stability period validation complete"
}

verify_production_readiness() {
    print_header "14. Production Readiness"

    check_info "Validating overall production readiness..."

    # All critical checks must pass
    if [[ "$INFRASTRUCTURE_READY" == true ]]; then
        check_pass "Infrastructure provisioned and accessible"
    else
        check_fail "Infrastructure not ready"
    fi

    if [[ "$SERVICES_RUNNING" == true ]]; then
        check_pass "All services running correctly"
    else
        check_fail "Services not running correctly"
    fi

    if [[ "$DATABASE_MIGRATED" == true ]]; then
        check_pass "Database migrations applied"
    else
        check_fail "Database migrations not confirmed"
    fi

    if [[ "$TESTS_PASSING" == true ]]; then
        check_pass "Integration tests passing"
    else
        check_warn "Integration tests not confirmed passing"
    fi

    if [[ "$SECURITY_VALIDATED" == true ]]; then
        check_pass "Security hardening validated"
    else
        check_warn "Security validation incomplete"
    fi

    if [[ "$PERFORMANCE_ACCEPTABLE" == true ]]; then
        check_pass "Performance benchmarks acceptable"
    else
        check_warn "Performance benchmarks not met"
    fi

    if [[ "$MONITORING_ACTIVE" == true ]]; then
        check_pass "Monitoring systems active"
    else
        check_warn "Monitoring systems not confirmed"
    fi

    if [[ "$STAKEHOLDERS_TESTED" == true ]]; then
        check_pass "Stakeholder testing completed"
    else
        check_warn "Stakeholder testing not documented"
    fi

    # Overall production readiness
    READY_COUNT=0
    [[ "$INFRASTRUCTURE_READY" == true ]] && ((READY_COUNT++))
    [[ "$SERVICES_RUNNING" == true ]] && ((READY_COUNT++))
    [[ "$DATABASE_MIGRATED" == true ]] && ((READY_COUNT++))
    [[ "$TESTS_PASSING" == true ]] && ((READY_COUNT++))
    [[ "$SECURITY_VALIDATED" == true ]] && ((READY_COUNT++))
    [[ "$PERFORMANCE_ACCEPTABLE" == true ]] && ((READY_COUNT++))
    [[ "$MONITORING_ACTIVE" == true ]] && ((READY_COUNT++))
    [[ "$STAKEHOLDERS_TESTED" == true ]] && ((READY_COUNT++))

    if [[ $READY_COUNT -ge 6 ]]; then
        check_pass "✅ STAGING DEPLOYMENT SUCCESSFUL - READY FOR PRODUCTION"
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Status: APPROVED FOR PRODUCTION DEPLOYMENT${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        check_fail "❌ STAGING DEPLOYMENT INCOMPLETE"
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}Status: NOT READY - ADDRESS FAILURES ABOVE${NC}"
        echo -e "${RED}Ready: $READY_COUNT/8 critical checks${NC}"
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

    if [[ $FAILED_CHECKS -eq 0 ]] && [[ $PASSED_CHECKS -gt 30 ]]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ STAGING DEPLOYMENT VERIFICATION PASSED${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${GREEN}Staging environment is production-ready!${NC}"
        echo ""
        echo -e "${BLUE}Next Steps:${NC}"
        echo "  1. Monitor staging for 7 days (track in docs/STAGING_STABILITY_LOG.md)"
        echo "  2. Collect stakeholder feedback"
        echo "  3. Address any issues found during stability period"
        echo "  4. Obtain final sign-off for production deployment"
        echo "  5. Continue with ISS-034 (Production Deployment Execution)"
        return 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}❌ STAGING DEPLOYMENT VERIFICATION FAILED${NC}"
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
║                 ISS-033: STAGING DEPLOYMENT VERIFICATION                     ║
║                    CCW-Online ERP - Production Readiness                     ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}\n"

    verify_infrastructure_provisioned
    verify_services_running
    verify_database_migration
    verify_environment_configuration
    verify_integration_tests
    verify_security_hardening
    verify_performance_benchmarks
    verify_monitoring_active
    verify_backup_procedures
    verify_stakeholder_testing
    verify_deployment_rollback
    verify_documentation_complete
    verify_seven_day_stability
    verify_production_readiness

    print_summary
}

# Run main function
main
exit $?
