#!/bin/bash

# ISS-034: Production Deployment Execution - Verification Script
# Purpose: Verify production environment deployment, configuration, and operational status
# Components: Infrastructure, services, database, security, performance, monitoring, 24h stability
# Success: All services running, tests passing, 99.9%+ uptime, production operational

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
PRODUCTION_URL=${PRODUCTION_URL:-"https://ccw-online.com"}
PRODUCTION_API_URL=${PRODUCTION_API_URL:-"https://api.ccw-online.com"}
DEPLOYMENT_WINDOW_START=""
DEPLOYMENT_WINDOW_END=""
INFRASTRUCTURE_READY=false
SERVICES_RUNNING=false
DATABASE_MIGRATED=false
TESTS_PASSING=false
SECURITY_VALIDATED=false
PERFORMANCE_ACCEPTABLE=false
MONITORING_ACTIVE=false
ALERTS_CONFIGURED=false
BACKUP_VERIFIED=false
ROLLBACK_READY=false

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

verify_pre_deployment_checklist() {
    print_header "1. Pre-Deployment Checklist"

    check_info "Verifying pre-deployment requirements..."

    # Check staging approval exists
    if [[ -f "docs/PRODUCTION_DEPLOYMENT_APPROVAL.md" ]]; then
        if grep -q "AUTHORIZED\|APPROVED" docs/PRODUCTION_DEPLOYMENT_APPROVAL.md; then
            check_pass "Production deployment approval obtained"
        else
            check_fail "Production deployment approval missing or not authorized"
        fi
    else
        check_fail "Production deployment approval document missing"
    fi

    # Check staging stability period completed
    if [[ -f "docs/STAGING_STABILITY_LOG.md" ]]; then
        DAILY_ENTRIES=$(grep -c "Day [0-9]" docs/STAGING_STABILITY_LOG.md 2>/dev/null || echo "0")
        if [[ $DAILY_ENTRIES -ge 7 ]]; then
            check_pass "7-day staging stability period completed ($DAILY_ENTRIES days)"
        else
            check_warn "Staging stability period incomplete ($DAILY_ENTRIES/7 days)"
        fi
    else
        check_warn "Staging stability log missing (docs/STAGING_STABILITY_LOG.md)"
    fi

    # Check backup exists
    if [[ -d "backups/postgresql" ]]; then
        LATEST_BACKUP=$(ls -t backups/postgresql/*.sql.gz 2>/dev/null | head -1)
        if [[ -n "$LATEST_BACKUP" ]]; then
            BACKUP_AGE=$(find "$LATEST_BACKUP" -mmin +60 2>/dev/null)
            if [[ -z "$BACKUP_AGE" ]]; then
                check_pass "Recent backup exists (less than 1 hour old)"
            else
                check_warn "Backup is older than 1 hour - create fresh backup"
            fi
        else
            check_fail "No backup found in backups/postgresql/"
        fi
    else
        check_fail "Backup directory missing (backups/postgresql/)"
    fi

    # Check deployment window
    CURRENT_HOUR=$(date +%H)
    if [[ $CURRENT_HOUR -ge 2 && $CURRENT_HOUR -le 6 ]]; then
        check_pass "Deployment during low-traffic window (2 AM - 6 AM UTC)"
    else
        check_warn "Deployment outside recommended window (current: ${CURRENT_HOUR}:00 UTC)"
    fi

    # Check notification sent
    if [[ -f "docs/DEPLOYMENT_NOTIFICATION.md" ]]; then
        check_pass "Deployment notification documented"
    else
        check_warn "Deployment notification not documented"
    fi

    check_info "Pre-deployment checklist validation complete"
}

verify_deployment_window() {
    print_header "2. Deployment Window"

    check_info "Verifying deployment timing..."

    # Record deployment start time
    DEPLOYMENT_WINDOW_START=$(date +"%Y-%m-%d %H:%M:%S UTC")
    check_info "Deployment started: $DEPLOYMENT_WINDOW_START"

    # Check if in recommended window (2 AM - 6 AM UTC Sunday)
    DAY_OF_WEEK=$(date +%u)  # 1 = Monday, 7 = Sunday
    HOUR_OF_DAY=$(date +%H)

    if [[ $DAY_OF_WEEK -eq 7 ]] && [[ $HOUR_OF_DAY -ge 2 ]] && [[ $HOUR_OF_DAY -le 6 ]]; then
        check_pass "Deployment during optimal window (Sunday 2-6 AM UTC)"
    elif [[ $HOUR_OF_DAY -ge 2 ]] && [[ $HOUR_OF_DAY -le 6 ]]; then
        check_warn "Deployment during acceptable window (2-6 AM UTC, but not Sunday)"
    else
        check_warn "Deployment outside recommended window (current: ${HOUR_OF_DAY}:00 UTC)"
    fi

    # Estimate deployment duration
    check_info "Estimated deployment duration: 4-6 hours"
    check_info "Expected completion: $(date -d '+6 hours' +'%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"

    check_info "Deployment window validation complete"
}

verify_infrastructure_production() {
    print_header "3. Production Infrastructure"

    # Check if production server is accessible
    if curl -s --head --request GET "$PRODUCTION_URL" | grep "HTTP" > /dev/null; then
        check_pass "Production server accessible ($PRODUCTION_URL)"
        INFRASTRUCTURE_READY=true
    else
        check_fail "Production server not accessible ($PRODUCTION_URL)"
        return
    fi

    # Check API server
    if curl -s --head --request GET "$PRODUCTION_API_URL/api/health" | grep "HTTP" > /dev/null; then
        check_pass "Production API server accessible ($PRODUCTION_API_URL)"
    else
        check_fail "Production API server not accessible ($PRODUCTION_API_URL)"
    fi

    # Check SSL certificate
    if curl -s -I "$PRODUCTION_URL" | grep -i "strict-transport-security" > /dev/null; then
        check_pass "SSL/TLS certificate configured (HSTS header present)"
    else
        check_warn "HSTS header not present (SSL may not be fully configured)"
    fi

    # Check DNS resolution
    if nslookup ccw-online.com > /dev/null 2>&1; then
        check_pass "DNS resolution working (ccw-online.com)"
    else
        check_fail "DNS resolution failed for ccw-online.com"
    fi

    # Check SSL certificate expiry
    check_info "Checking SSL certificate validity..."
    CERT_EXPIRY=$(echo | openssl s_client -servername ccw-online.com -connect ccw-online.com:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
    if [[ "$CERT_EXPIRY" != "unknown" ]]; then
        check_pass "SSL certificate valid until: $CERT_EXPIRY"
    else
        check_warn "Cannot verify SSL certificate expiry"
    fi

    check_info "Production infrastructure validation complete"
}

verify_services_production() {
    print_header "4. Production Services"

    # Check frontend service
    check_info "Checking frontend service (Next.js)..."
    if curl -s "$PRODUCTION_URL" | grep -q "CCW-Online\|ERP"; then
        check_pass "Frontend service running (Next.js)"
    else
        check_fail "Frontend service not responding"
    fi

    # Check backend service
    check_info "Checking backend service (FastAPI)..."
    HEALTH_RESPONSE=$(curl -s "$PRODUCTION_API_URL/api/health" || echo "failed")
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
    check_info "Verifying service versions..."
    VERSION_RESPONSE=$(curl -s "$PRODUCTION_API_URL/api/version" || echo "unknown")
    if echo "$VERSION_RESPONSE" | grep -q "version\|git"; then
        check_pass "Version endpoint responding"
        echo "     Version: $VERSION_RESPONSE"
    else
        check_warn "Version endpoint not available"
    fi

    # Check uptime
    UPTIME_RESPONSE=$(curl -s "$PRODUCTION_API_URL/api/health" | grep -oP '"uptime":\s*\K[0-9.]+' || echo "0")
    if [[ $(echo "$UPTIME_RESPONSE > 0" | bc 2>/dev/null || echo "0") -eq 1 ]]; then
        check_pass "Service uptime: ${UPTIME_RESPONSE}s"
    else
        check_info "Uptime not available in health check"
    fi

    check_info "Production services validation complete"
}

verify_database_production() {
    print_header "5. Production Database"

    check_info "Verifying production database..."

    # Check if migration status endpoint exists
    MIGRATION_STATUS=$(curl -s "$PRODUCTION_API_URL/api/admin/migration/status" 2>/dev/null || echo "unavailable")

    if echo "$MIGRATION_STATUS" | grep -q "current\|head\|up-to-date"; then
        check_pass "Database migrations applied successfully"
        DATABASE_MIGRATED=true
    else
        check_warn "Cannot verify migration status (may require admin auth)"
    fi

    # Check if data exists (don't check seed data in production)
    PRODUCTS_COUNT=$(curl -s "$PRODUCTION_API_URL/api/products?page_size=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
    if [[ "$PRODUCTS_COUNT" -gt 0 ]]; then
        check_pass "Production data present (products: $PRODUCTS_COUNT)"
    else
        check_warn "No products found - may be fresh deployment"
    fi

    # Check database tables exist
    check_info "Verifying critical tables accessible..."
    for table in products customers orders quotes users; do
        RESPONSE=$(curl -s "$PRODUCTION_API_URL/api/$table?page_size=1" || echo "failed")
        if echo "$RESPONSE" | grep -q "data\|total\|\[\]"; then
            check_pass "Table '$table' accessible via API"
        else
            check_fail "Table '$table' not accessible or API endpoint missing"
        fi
    done

    check_info "Production database validation complete"
}

verify_production_tests() {
    print_header "6. Production Smoke Tests"

    check_info "Running production smoke tests..."

    # Test 1: Health endpoint
    if curl -s "$PRODUCTION_API_URL/api/health" | grep -q "healthy\|ok"; then
        check_pass "Smoke test: Health endpoint responding"
    else
        check_fail "Smoke test: Health endpoint failed"
    fi

    # Test 2: Products list
    if curl -s "$PRODUCTION_API_URL/api/products?page_size=5" | grep -q "data"; then
        check_pass "Smoke test: Products API responding"
    else
        check_fail "Smoke test: Products API failed"
    fi

    # Test 3: Customers list
    if curl -s "$PRODUCTION_API_URL/api/customers?page_size=5" | grep -q "data"; then
        check_pass "Smoke test: Customers API responding"
    else
        check_fail "Smoke test: Customers API failed"
    fi

    # Test 4: Authentication
    AUTH_RESPONSE=$(curl -s -X POST "$PRODUCTION_API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@demo.com","password":"demo123"}' || echo "failed")

    if echo "$AUTH_RESPONSE" | grep -q "access_token\|token"; then
        check_pass "Smoke test: Authentication working"
        TESTS_PASSING=true
    else
        check_warn "Smoke test: Authentication may not be working (check credentials)"
    fi

    # Test 5: Frontend homepage
    if curl -s "$PRODUCTION_URL" | grep -q "CCW-Online\|ERP"; then
        check_pass "Smoke test: Frontend homepage rendering"
    else
        check_fail "Smoke test: Frontend homepage failed"
    fi

    check_info "Production smoke tests complete"
}

verify_security_production() {
    print_header "7. Production Security"

    check_info "Verifying production security..."

    # Check HTTPS redirect
    HTTP_REDIRECT=$(curl -s -I "http://ccw-online.com" | grep -i "location.*https" || echo "missing")
    if echo "$HTTP_REDIRECT" | grep -q "https"; then
        check_pass "HTTP to HTTPS redirect configured"
    else
        check_warn "HTTP to HTTPS redirect not detected"
    fi

    # Check security headers
    check_info "Checking security headers..."
    HEADERS=$(curl -s -I "$PRODUCTION_URL")

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
    check_info "Checking for exposed secrets..."
    SECRET_CHECK=$(curl -s "$PRODUCTION_API_URL/api/health" | grep -iE "password|secret|key" || echo "none")
    if echo "$SECRET_CHECK" | grep -q "none"; then
        check_pass "No secrets exposed in API responses"
        SECURITY_VALIDATED=true
    else
        check_fail "Potential secrets exposed in API responses"
    fi

    # Check authentication enforcement
    AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_API_URL/api/users")
    if [[ "$AUTH_TEST" == "401" || "$AUTH_TEST" == "403" ]]; then
        check_pass "Authentication enforced (protected endpoints return 401/403)"
    else
        check_warn "Authentication may not be properly enforced (status: $AUTH_TEST)"
    fi

    # Check rate limiting
    check_info "Testing rate limiting..."
    RATE_LIMIT_COUNT=0
    for i in {1..15}; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PRODUCTION_API_URL/api/health")
        if [[ "$RESPONSE" == "429" ]]; then
            RATE_LIMIT_COUNT=$((RATE_LIMIT_COUNT + 1))
        fi
    done

    if [[ $RATE_LIMIT_COUNT -gt 0 ]]; then
        check_pass "Rate limiting active (received 429 after rapid requests)"
    else
        check_info "Rate limiting not triggered (may be disabled or limits high)"
    fi

    check_info "Production security validation complete"
}

verify_performance_production() {
    print_header "8. Production Performance"

    check_info "Running production performance tests..."

    # Test 1: Homepage load time
    HOME_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$PRODUCTION_URL")
    HOME_MS=$(echo "$HOME_TIME * 1000" | bc | cut -d. -f1)
    if [[ $HOME_MS -lt 3000 ]]; then
        check_pass "Homepage load time: ${HOME_MS}ms (<3s target)"
    else
        check_warn "Homepage load time: ${HOME_MS}ms (>3s, may be slow)"
    fi

    # Test 2: API response time
    API_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$PRODUCTION_API_URL/api/health")
    API_MS=$(echo "$API_TIME * 1000" | bc | cut -d. -f1)
    if [[ $API_MS -lt 200 ]]; then
        check_pass "API response time: ${API_MS}ms (<200ms target)"
        PERFORMANCE_ACCEPTABLE=true
    else
        check_warn "API response time: ${API_MS}ms (>200ms, may be slow)"
    fi

    # Test 3: Products list load time
    PRODUCTS_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$PRODUCTION_API_URL/api/products?page_size=50")
    PRODUCTS_MS=$(echo "$PRODUCTS_TIME * 1000" | bc | cut -d. -f1)
    if [[ $PRODUCTS_MS -lt 500 ]]; then
        check_pass "Products list load time: ${PRODUCTS_MS}ms (<500ms target)"
    else
        check_warn "Products list load time: ${PRODUCTS_MS}ms (>500ms, may be slow)"
    fi

    # Test 4: Database query performance
    ORDERS_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$PRODUCTION_API_URL/api/orders?page_size=50")
    ORDERS_MS=$(echo "$ORDERS_TIME * 1000" | bc | cut -d. -f1)
    if [[ $ORDERS_MS -lt 500 ]]; then
        check_pass "Orders list load time: ${ORDERS_MS}ms (<500ms target)"
    else
        check_warn "Orders list load time: ${ORDERS_MS}ms (>500ms, may be slow)"
    fi

    check_info "Production performance validation complete"
}

verify_monitoring_production() {
    print_header "9. Production Monitoring"

    check_info "Verifying production monitoring..."

    # Check health endpoint for monitoring
    if curl -s "$PRODUCTION_API_URL/api/health" | grep -q "healthy\|ok"; then
        check_pass "Health endpoint available for monitoring"
        MONITORING_ACTIVE=true
    else
        check_fail "Health endpoint not responding"
    fi

    # Check if UptimeRobot or similar configured (would show in docs)
    if grep -q -i "uptimerobot\|pingdom\|uptime monitor" docs/*.md 2>/dev/null; then
        check_pass "Uptime monitoring documented"
    else
        check_warn "Uptime monitoring not documented"
    fi

    # Check if Prometheus configured
    PROMETHEUS_URL=${PROMETHEUS_URL:-"http://ccw-online.com:9090"}
    if curl -s "$PROMETHEUS_URL" > /dev/null 2>&1; then
        check_pass "Prometheus monitoring available"
    else
        check_info "Prometheus not detected (optional)"
    fi

    # Check if Sentry configured
    if grep -q "SENTRY_DSN" .env 2>/dev/null; then
        check_pass "Sentry error tracking configured"
    else
        check_info "Sentry not configured (optional)"
    fi

    # Check logs accessible
    if docker compose logs backend --tail=1 > /dev/null 2>&1; then
        check_pass "Application logs accessible"
    else
        check_warn "Cannot access application logs (may need server access)"
    fi

    check_info "Production monitoring validation complete"
}

verify_alerts_configured() {
    print_header "10. Alert Configuration"

    check_info "Verifying alert configuration..."

    # Check if alert documentation exists
    if [[ -f "docs/PRODUCTION_RUNBOOK.md" ]]; then
        if grep -q -i "alert\|notification\|pagerduty\|slack" docs/PRODUCTION_RUNBOOK.md; then
            check_pass "Alert procedures documented in runbook"
            ALERTS_CONFIGURED=true
        else
            check_warn "Alert procedures not found in runbook"
        fi
    else
        check_warn "Production runbook missing (docs/PRODUCTION_RUNBOOK.md)"
    fi

    # Check if on-call schedule exists
    if grep -q -i "on-call\|oncall\|rotation" docs/*.md 2>/dev/null; then
        check_pass "On-call schedule documented"
    else
        check_warn "On-call schedule not documented"
    fi

    # Check if escalation procedures exist
    if grep -q -i "escalation\|incident response" docs/*.md 2>/dev/null; then
        check_pass "Escalation procedures documented"
    else
        check_warn "Escalation procedures not documented"
    fi

    check_info "Alert configuration validation complete"
}

verify_backup_production() {
    print_header "11. Production Backup"

    check_info "Verifying production backup configuration..."

    # Check if backup script exists
    if [[ -f "scripts/backup-database.sh" ]]; then
        check_pass "Backup script exists (scripts/backup-database.sh)"
    else
        check_fail "Backup script missing"
    fi

    # Check if automated backups configured (cron)
    if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
        check_pass "Automated backups configured (cron job active)"
        BACKUP_VERIFIED=true
    else
        check_warn "Automated backups not configured in cron"
    fi

    # Check backup directory
    if [[ -d "backups/postgresql" ]]; then
        BACKUP_COUNT=$(ls backups/postgresql/*.sql.gz 2>/dev/null | wc -l)
        if [[ $BACKUP_COUNT -gt 0 ]]; then
            check_pass "Backup directory exists with $BACKUP_COUNT backups"
        else
            check_warn "Backup directory empty (no backups found)"
        fi
    else
        check_warn "Backup directory missing (backups/postgresql)"
    fi

    # Check off-site backup configuration
    if grep -q -i "s3\|aws\|azure\|offsite\|remote backup" docs/*.md 2>/dev/null; then
        check_pass "Off-site backup documented"
    else
        check_warn "Off-site backup not documented"
    fi

    check_info "Production backup validation complete"
}

verify_rollback_readiness() {
    print_header "12. Rollback Readiness"

    check_info "Verifying rollback capability..."

    # Check if rollback script exists
    if [[ -f "scripts/rollback-deployment.sh" ]]; then
        check_pass "Rollback script exists (scripts/rollback-deployment.sh)"
        ROLLBACK_READY=true
    else
        check_warn "Rollback script missing (recommended)"
    fi

    # Check if previous version tagged
    if git tag | grep -q "v"; then
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
        PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "none")
        check_pass "Git tags exist (current: $LATEST_TAG, previous: $PREVIOUS_TAG)"
    else
        check_warn "No git tags found (recommended for version tracking)"
    fi

    # Check if pre-deployment backup exists
    if [[ -d "backups/postgresql" ]]; then
        PRE_DEPLOY_BACKUP=$(ls -t backups/postgresql/*pre*deploy*.sql.gz 2>/dev/null | head -1)
        if [[ -n "$PRE_DEPLOY_BACKUP" ]]; then
            check_pass "Pre-deployment backup exists"
        else
            check_warn "Pre-deployment backup not found (should be labeled *pre*deploy*)"
        fi
    fi

    # Check if rollback procedure documented
    if grep -q "rollback" docs/*.md 2>/dev/null; then
        check_pass "Rollback procedure documented"
    else
        check_warn "Rollback procedure not documented"
    fi

    check_info "Rollback readiness validation complete"
}

verify_documentation_production() {
    print_header "13. Production Documentation"

    check_info "Verifying production documentation complete..."

    # Check required documentation
    REQUIRED_DOCS=(
        "docs/PRODUCTION_RUNBOOK.md"
        "docs/user-guide/README.md"
        "docs/user-guide/USER_GUIDE.md"
        "docs/user-guide/ADMIN_GUIDE.md"
    )

    DOCS_FOUND=0
    for doc in "${REQUIRED_DOCS[@]}"; do
        if [[ -f "$doc" ]]; then
            check_pass "Documentation exists: $doc"
            ((DOCS_FOUND++))
        else
            check_warn "Documentation missing: $doc"
        fi
    done

    if [[ $DOCS_FOUND -ge 3 ]]; then
        check_pass "Essential documentation present ($DOCS_FOUND/${#REQUIRED_DOCS[@]} files)"
    else
        check_fail "Missing critical documentation ($DOCS_FOUND/${#REQUIRED_DOCS[@]} files)"
    fi

    check_info "Production documentation validation complete"
}

verify_stakeholder_notification() {
    print_header "14. Stakeholder Notification"

    check_info "Verifying stakeholder notification..."

    # Check if deployment notification sent
    if [[ -f "docs/DEPLOYMENT_NOTIFICATION.md" ]]; then
        if grep -q "production\|go-live\|deployment.*complete" docs/DEPLOYMENT_NOTIFICATION.md; then
            check_pass "Production deployment notification documented"
        else
            check_warn "Deployment notification incomplete"
        fi
    else
        check_warn "Deployment notification not documented"
    fi

    # Check if all stakeholders notified
    EXPECTED_STAKEHOLDERS=("business.*owner" "sales" "warehouse" "customer.*service" "technical.*lead")
    STAKEHOLDERS_NOTIFIED=0

    for stakeholder in "${EXPECTED_STAKEHOLDERS[@]}"; do
        if grep -q -i "$stakeholder" docs/DEPLOYMENT_NOTIFICATION.md 2>/dev/null; then
            ((STAKEHOLDERS_NOTIFIED++))
        fi
    done

    if [[ $STAKEHOLDERS_NOTIFIED -ge 3 ]]; then
        check_pass "Key stakeholders notified ($STAKEHOLDERS_NOTIFIED notified)"
    else
        check_warn "Not all stakeholders notified ($STAKEHOLDERS_NOTIFIED notified)"
    fi

    check_info "Stakeholder notification validation complete"
}

verify_post_deployment_monitoring() {
    print_header "15. 24-Hour Post-Deployment Monitoring"

    check_info "Verifying 24-hour monitoring plan..."

    # Check if monitoring schedule exists
    if [[ -f "docs/POST_DEPLOYMENT_MONITORING.md" ]]; then
        check_pass "24-hour monitoring plan documented"

        # Check for hourly monitoring entries
        HOURLY_ENTRIES=$(grep -c "Hour [0-9]" docs/POST_DEPLOYMENT_MONITORING.md 2>/dev/null || echo "0")
        if [[ $HOURLY_ENTRIES -ge 24 ]]; then
            check_pass "24-hour monitoring complete ($HOURLY_ENTRIES hourly entries)"
        else
            check_info "24-hour monitoring in progress ($HOURLY_ENTRIES/24 hours)"
        fi
    else
        check_warn "24-hour monitoring plan missing (docs/POST_DEPLOYMENT_MONITORING.md)"
    fi

    # Check uptime since deployment
    if [[ -n "$DEPLOYMENT_WINDOW_START" ]]; then
        check_info "Deployment started: $DEPLOYMENT_WINDOW_START"
        check_info "Monitor for next 24 hours until: $(date -d '+24 hours' +'%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"
    fi

    check_info "Post-deployment monitoring validation complete"
}

verify_production_operational() {
    print_header "16. Production Operational Status"

    check_info "Validating overall production operational status..."

    # All critical checks
    if [[ "$INFRASTRUCTURE_READY" == true ]]; then
        check_pass "Infrastructure operational"
    else
        check_fail "Infrastructure not operational"
    fi

    if [[ "$SERVICES_RUNNING" == true ]]; then
        check_pass "All services running"
    else
        check_fail "Services not running correctly"
    fi

    if [[ "$DATABASE_MIGRATED" == true ]]; then
        check_pass "Database migrations successful"
    else
        check_fail "Database migrations incomplete"
    fi

    if [[ "$TESTS_PASSING" == true ]]; then
        check_pass "Smoke tests passing"
    else
        check_fail "Smoke tests failing"
    fi

    if [[ "$SECURITY_VALIDATED" == true ]]; then
        check_pass "Security validated"
    else
        check_warn "Security validation incomplete"
    fi

    if [[ "$PERFORMANCE_ACCEPTABLE" == true ]]; then
        check_pass "Performance acceptable"
    else
        check_warn "Performance below target"
    fi

    if [[ "$MONITORING_ACTIVE" == true ]]; then
        check_pass "Monitoring active"
    else
        check_warn "Monitoring not fully configured"
    fi

    if [[ "$ALERTS_CONFIGURED" == true ]]; then
        check_pass "Alerts configured"
    else
        check_warn "Alert configuration incomplete"
    fi

    if [[ "$BACKUP_VERIFIED" == true ]]; then
        check_pass "Backup system verified"
    else
        check_warn "Backup system not verified"
    fi

    if [[ "$ROLLBACK_READY" == true ]]; then
        check_pass "Rollback capability ready"
    else
        check_warn "Rollback capability not confirmed"
    fi

    # Calculate operational readiness score
    OPERATIONAL_COUNT=0
    [[ "$INFRASTRUCTURE_READY" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$SERVICES_RUNNING" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$DATABASE_MIGRATED" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$TESTS_PASSING" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$SECURITY_VALIDATED" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$PERFORMANCE_ACCEPTABLE" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$MONITORING_ACTIVE" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$ALERTS_CONFIGURED" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$BACKUP_VERIFIED" == true ]] && ((OPERATIONAL_COUNT++))
    [[ "$ROLLBACK_READY" == true ]] && ((OPERATIONAL_COUNT++))

    if [[ $OPERATIONAL_COUNT -ge 7 ]]; then
        check_pass "✅ PRODUCTION DEPLOYMENT SUCCESSFUL"
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Status: PRODUCTION OPERATIONAL${NC}"
        echo -e "${GREEN}Operational Score: $OPERATIONAL_COUNT/10 critical systems${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        check_fail "❌ PRODUCTION DEPLOYMENT INCOMPLETE"
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}Status: NOT FULLY OPERATIONAL${NC}"
        echo -e "${RED}Operational Score: $OPERATIONAL_COUNT/10 critical systems${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi

    # Record deployment end time
    DEPLOYMENT_WINDOW_END=$(date +"%Y-%m-%d %H:%M:%S UTC")
    check_info "Deployment completed: $DEPLOYMENT_WINDOW_END"

    check_info "Production operational status validation complete"
}

print_summary() {
    print_header "VERIFICATION SUMMARY"

    echo -e "${BLUE}Total Checks:${NC} $TOTAL_CHECKS"
    echo -e "${GREEN}Passed:${NC} $PASSED_CHECKS"
    echo -e "${RED}Failed:${NC} $FAILED_CHECKS"
    echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""

    if [[ $FAILED_CHECKS -eq 0 ]] && [[ $PASSED_CHECKS -gt 40 ]]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ PRODUCTION DEPLOYMENT VERIFICATION PASSED${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${GREEN}CCW-Online ERP is now LIVE in production!${NC}"
        echo ""
        echo -e "${BLUE}Next Steps:${NC}"
        echo "  1. Monitor for 24 hours (track hourly in docs/POST_DEPLOYMENT_MONITORING.md)"
        echo "  2. Watch for any errors or performance issues"
        echo "  3. Respond to alerts immediately"
        echo "  4. Collect user feedback"
        echo "  5. Celebrate successful launch! 🎉🚀"
        echo ""
        echo -e "${BLUE}Production URL:${NC} $PRODUCTION_URL"
        echo -e "${BLUE}API URL:${NC} $PRODUCTION_API_URL"
        return 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}❌ PRODUCTION DEPLOYMENT VERIFICATION FAILED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${RED}Please address the failed checks above before going live.${NC}"
        echo ""
        echo -e "${YELLOW}Consider rolling back if critical failures persist.${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║               ISS-034: PRODUCTION DEPLOYMENT VERIFICATION                    ║
║                    CCW-Online ERP - Production Go-Live                       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}\n"

    verify_pre_deployment_checklist
    verify_deployment_window
    verify_infrastructure_production
    verify_services_production
    verify_database_production
    verify_production_tests
    verify_security_production
    verify_performance_production
    verify_monitoring_production
    verify_alerts_configured
    verify_backup_production
    verify_rollback_readiness
    verify_documentation_production
    verify_stakeholder_notification
    verify_post_deployment_monitoring
    verify_production_operational

    print_summary
}

# Run main function
main
exit $?
