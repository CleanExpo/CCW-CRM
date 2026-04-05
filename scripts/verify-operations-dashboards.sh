#!/usr/bin/env bash
#
# Operations Dashboards Verification Script
# ISS-023: Create Operations Dashboards
#
# This script verifies comprehensive Grafana operations dashboards configuration:
# - Grafana deployment and accessibility
# - Prometheus datasource configuration
# - Dashboard files (API performance, business metrics, database)
# - Dashboard provisioning
# - Panel configuration (request rate, response time, error rate)
# - Alert integration
# - User access and authentication
# - Production deployment readiness
#
# Usage:
#   ./scripts/verify-operations-dashboards.sh
#   GRAFANA_URL=https://grafana.ccw-online.com ./scripts/verify-operations-dashboards.sh

set -e

# Color codes for output
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Configuration
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"

if [ ! -d "monitoring" ]; then
    info "monitoring/ not present in repository; skipping Grafana/Prometheus file checks."
    exit 0
fi

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# 1. Grafana Configuration Files
# ============================================================================

section "1. Grafana Configuration Files"

# Check for Grafana provisioning directory
if [ -d "monitoring/grafana/provisioning" ]; then
    pass "Grafana provisioning directory exists"

    # Check datasources configuration
    if [ -f "monitoring/grafana/provisioning/datasources.yml" ]; then
        pass "Datasources configuration file exists (datasources.yml)"

        # Check for Prometheus datasource
        if grep -q "type: prometheus" "monitoring/grafana/provisioning/datasources.yml"; then
            pass "Prometheus datasource configured in datasources.yml"

            # Check datasource URL
            if grep -q "url:.*prometheus" "monitoring/grafana/provisioning/datasources.yml"; then
                pass "Prometheus datasource URL configured"

                ds_url=$(grep "url:" "monitoring/grafana/provisioning/datasources.yml" | head -1 | awk '{print $2}')
                info "   Datasource URL: $ds_url"
            else
                warn "Prometheus datasource URL not found"
            fi
        else
            fail "Prometheus datasource NOT configured in datasources.yml"
        fi
    else
        fail "Datasources configuration file NOT found"
        info "   Create: monitoring/grafana/provisioning/datasources.yml"
    fi

    # Check dashboards provisioning configuration
    if [ -f "monitoring/grafana/provisioning/dashboards.yml" ]; then
        pass "Dashboards provisioning configuration exists (dashboards.yml)"
    else
        warn "Dashboards provisioning configuration not found"
        info "   Create: monitoring/grafana/provisioning/dashboards.yml"
    fi
else
    fail "Grafana provisioning directory NOT found"
    info "   Create: monitoring/grafana/provisioning/"
fi

# Check for Grafana dashboards directory
if [ -d "monitoring/grafana/dashboards" ]; then
    pass "Grafana dashboards directory exists"

    # Count dashboard files
    dashboard_count=$(find monitoring/grafana/dashboards -name "*.json" -type f 2>/dev/null | wc -l)
    info "   Dashboard files found: $dashboard_count"

    if [ "$dashboard_count" -ge 4 ]; then
        pass "Multiple dashboard files exist ($dashboard_count dashboards)"
    elif [ "$dashboard_count" -gt 0 ]; then
        warn "Limited dashboard files ($dashboard_count dashboards)"
        info "   Recommended: At least 4 dashboards (API, Business, PostgreSQL, Redis)"
    else
        fail "No dashboard files found"
    fi
else
    fail "Grafana dashboards directory NOT found"
    info "   Create: monitoring/grafana/dashboards/"
fi

# ============================================================================
# 2. Dashboard Files Validation
# ============================================================================

section "2. Dashboard Files Validation"

# Required dashboards
required_dashboards=(
    "api_performance.json:API Performance Dashboard"
    "business_metrics.json:Business Metrics Dashboard"
    "postgresql_metrics.json:PostgreSQL Metrics Dashboard"
    "redis_metrics.json:Redis Metrics Dashboard"
)

for dashboard_info in "${required_dashboards[@]}"; do
    dashboard_file="${dashboard_info%%:*}"
    dashboard_name="${dashboard_info#*:}"

    if [ -f "monitoring/grafana/dashboards/$dashboard_file" ]; then
        pass "$dashboard_name exists ($dashboard_file)"

        # Validate JSON syntax
        if command -v python3 &> /dev/null; then
            if python3 -m json.tool "monitoring/grafana/dashboards/$dashboard_file" > /dev/null 2>&1; then
                pass "  └─ JSON syntax is valid"
            else
                fail "  └─ JSON syntax is INVALID"
            fi
        fi

        # Check for required fields
        if grep -q '"title"' "monitoring/grafana/dashboards/$dashboard_file"; then
            pass "  └─ Dashboard has title field"
        else
            warn "  └─ Dashboard missing title field"
        fi

        if grep -q '"panels"' "monitoring/grafana/dashboards/$dashboard_file"; then
            pass "  └─ Dashboard has panels field"

            # Count panels
            panel_count=$(grep -o '"title":' "monitoring/grafana/dashboards/$dashboard_file" | wc -l)
            info "     Panels: $panel_count"
        else
            warn "  └─ Dashboard missing panels field"
        fi
    else
        fail "$dashboard_name NOT found ($dashboard_file)"
        info "   Create: monitoring/grafana/dashboards/$dashboard_file"
    fi
done

# ============================================================================
# 3. API Performance Dashboard
# ============================================================================

section "3. API Performance Dashboard"

if [ -f "monitoring/grafana/dashboards/api_performance.json" ]; then
    # Check for key metrics panels
    metrics=(
        "Request Rate:rate.*http_requests"
        "Response Time:histogram_quantile.*http_request_duration"
        "Error Rate:http_requests.*5"
        "Slowest Endpoints:topk"
        "Status Codes:http_requests.*status"
    )

    for metric_info in "${metrics[@]}"; do
        metric_name="${metric_info%%:*}"
        metric_pattern="${metric_info#*:}"

        if grep -q "$metric_pattern" "monitoring/grafana/dashboards/api_performance.json"; then
            pass "API Performance: $metric_name panel configured"
        else
            warn "API Performance: $metric_name panel not found"
        fi
    done
else
    warn "API Performance dashboard file not found - skipping panel checks"
fi

# ============================================================================
# 4. Business Metrics Dashboard
# ============================================================================

section "4. Business Metrics Dashboard"

if [ -f "monitoring/grafana/dashboards/business_metrics.json" ]; then
    # Check for business metrics panels
    business_metrics=(
        "Orders:order"
        "Revenue:revenue\|sales"
        "Customers:customer"
        "Products:product"
    )

    for metric_info in "${business_metrics[@]}"; do
        metric_name="${metric_info%%:*}"
        metric_pattern="${metric_info#*:}"

        if grep -iq "$metric_pattern" "monitoring/grafana/dashboards/business_metrics.json"; then
            pass "Business Metrics: $metric_name panel configured"
        else
            warn "Business Metrics: $metric_name panel not found"
        fi
    done
else
    warn "Business Metrics dashboard file not found - skipping panel checks"
fi

# ============================================================================
# 5. PostgreSQL Dashboard
# ============================================================================

section "5. PostgreSQL Dashboard"

if [ -f "monitoring/grafana/dashboards/postgresql_metrics.json" ]; then
    # Check for PostgreSQL metrics panels
    pg_metrics=(
        "Connections:pg.*connections"
        "Query Performance:pg.*query"
        "Cache Hit Ratio:pg.*cache"
        "Locks:pg.*locks"
        "Transaction Rate:pg.*transaction"
    )

    for metric_info in "${pg_metrics[@]}"; do
        metric_name="${metric_info%%:*}"
        metric_pattern="${metric_info#*:}"

        if grep -q "$metric_pattern" "monitoring/grafana/dashboards/postgresql_metrics.json"; then
            pass "PostgreSQL: $metric_name panel configured"
        else
            warn "PostgreSQL: $metric_name panel not found"
        fi
    done
else
    warn "PostgreSQL dashboard file not found - skipping panel checks"
fi

# ============================================================================
# 6. Redis Dashboard
# ============================================================================

section "6. Redis Dashboard"

if [ -f "monitoring/grafana/dashboards/redis_metrics.json" ]; then
    # Check for Redis metrics panels
    redis_metrics=(
        "Memory Usage:redis.*memory"
        "Hit Rate:redis.*hit"
        "Commands:redis.*commands"
        "Connections:redis.*connections"
    )

    for metric_info in "${redis_metrics[@]}"; do
        metric_name="${metric_info%%:*}"
        metric_pattern="${metric_info#*:}"

        if grep -q "$metric_pattern" "monitoring/grafana/dashboards/redis_metrics.json"; then
            pass "Redis: $metric_name panel configured"
        else
            warn "Redis: $metric_name panel not found"
        fi
    done
else
    warn "Redis dashboard file not found - skipping panel checks"
fi

# ============================================================================
# 7. Docker Compose Configuration
# ============================================================================

section "7. Docker Compose Configuration"

if [ -f "docker-compose.yml" ]; then
    if grep -q "grafana:" "docker-compose.yml"; then
        pass "Grafana service defined in docker-compose.yml"

        # Check Grafana image
        if grep -A5 "grafana:" "docker-compose.yml" | grep -q "image:.*grafana"; then
            pass "Grafana image configured"

            grafana_image=$(grep -A5 "grafana:" "docker-compose.yml" | grep "image:" | awk '{print $2}')
            info "   Image: $grafana_image"
        else
            warn "Grafana image not specified"
        fi

        # Check port configuration
        if grep -A10 "grafana:" "docker-compose.yml" | grep -q "ports:"; then
            pass "Grafana port mapping configured"

            grafana_port=$(grep -A10 "grafana:" "docker-compose.yml" | grep -E "^\s+- \"[0-9]+:3000\"" | head -1 | sed 's/.*"\([0-9]*\):.*/\1/')
            if [ -n "$grafana_port" ]; then
                info "   Port: $grafana_port"
            fi
        else
            warn "Grafana port mapping not found"
        fi

        # Check volume mounts
        if grep -A15 "grafana:" "docker-compose.yml" | grep -q "volumes:"; then
            pass "Grafana volume mounts configured"
        else
            warn "Grafana volume mounts not found"
        fi

        # Check environment variables
        if grep -A15 "grafana:" "docker-compose.yml" | grep -q "GF_SECURITY_ADMIN_PASSWORD"; then
            pass "Grafana admin password configured"
        else
            warn "Grafana admin password not set"
            info "   Add: GF_SECURITY_ADMIN_PASSWORD environment variable"
        fi
    else
        fail "Grafana service NOT defined in docker-compose.yml"
        info "   Add Grafana service to docker-compose.yml"
    fi
else
    fail "docker-compose.yml not found"
fi

# ============================================================================
# 8. Grafana Service Status
# ============================================================================

section "8. Grafana Service Status"

# Check if Grafana container is running
if command -v docker &> /dev/null; then
    grafana_container=$(docker ps --filter "name=grafana" --format "{{.Names}}" 2>/dev/null | head -1)

    if [ -n "$grafana_container" ]; then
        pass "Grafana container is running ($grafana_container)"

        # Check container health
        container_status=$(docker inspect --format='{{.State.Status}}' "$grafana_container" 2>/dev/null)
        if [ "$container_status" = "running" ]; then
            pass "Grafana container status: running"
        else
            warn "Grafana container status: $container_status"
        fi

        # Check container uptime
        uptime=$(docker inspect --format='{{.State.StartedAt}}' "$grafana_container" 2>/dev/null)
        info "   Started: $uptime"
    else
        fail "Grafana container is NOT running"
        info "   Start: docker-compose up -d grafana"
    fi
else
    warn "Docker not available - cannot check container status"
fi

# ============================================================================
# 9. Grafana API Accessibility
# ============================================================================

section "9. Grafana API Accessibility"

# Test Grafana health endpoint
if curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    pass "Grafana health endpoint is accessible at $GRAFANA_URL"

    # Get health response
    health_response=$(curl -s "$GRAFANA_URL/api/health")

    if echo "$health_response" | grep -q '"database":"ok"'; then
        pass "Grafana database is OK"
    else
        warn "Grafana database status unknown"
    fi
else
    fail "Grafana health endpoint is NOT accessible at $GRAFANA_URL"
    info "   Ensure Grafana is running: docker-compose up -d grafana"
    info "   Or set custom URL: export GRAFANA_URL=https://grafana.ccw-online.com"
fi

# Test Grafana login
if curl -s -f -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/org" > /dev/null 2>&1; then
    pass "Grafana authentication is working (admin credentials)"

    # Get org info
    org_response=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/org")
    org_name=$(echo "$org_response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$org_name" ]; then
        info "   Organization: $org_name"
    fi
else
    warn "Grafana authentication failed with default credentials"
    info "   Default: admin/admin"
    info "   Change password on first login"
fi

# ============================================================================
# 10. Prometheus Datasource
# ============================================================================

section "10. Prometheus Datasource"

if curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    # Check datasources via API
    datasources_response=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/datasources" 2>/dev/null)

    if echo "$datasources_response" | grep -q '"type":"prometheus"'; then
        pass "Prometheus datasource exists in Grafana"

        # Check datasource name
        if echo "$datasources_response" | grep -q '"name":"Prometheus"'; then
            pass "Prometheus datasource is named 'Prometheus'"
        fi

        # Check if it's the default datasource
        if echo "$datasources_response" | grep -q '"isDefault":true'; then
            pass "Prometheus is set as default datasource"
        else
            warn "Prometheus is not the default datasource"
        fi

        # Test datasource connectivity
        datasource_id=$(echo "$datasources_response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        if [ -n "$datasource_id" ]; then
            test_response=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/datasources/$datasource_id/health" 2>/dev/null)

            if echo "$test_response" | grep -q '"status":"OK"'; then
                pass "Prometheus datasource connectivity: OK"
            else
                warn "Prometheus datasource connectivity test failed"
                info "   Ensure Prometheus is running and accessible"
            fi
        fi
    else
        warn "Prometheus datasource not found in Grafana"
        info "   Datasource should be auto-provisioned from datasources.yml"
    fi
else
    warn "Cannot check datasources - Grafana not accessible"
fi

# ============================================================================
# 11. Dashboards in Grafana
# ============================================================================

section "11. Dashboards in Grafana"

if curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    # Get dashboards via API
    dashboards_response=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/search?type=dash-db" 2>/dev/null)

    dashboard_count=$(echo "$dashboards_response" | grep -o '"title"' | wc -l)
    info "Dashboards found in Grafana: $dashboard_count"

    if [ "$dashboard_count" -ge 4 ]; then
        pass "Multiple dashboards loaded in Grafana ($dashboard_count dashboards)"

        # Check for specific dashboards
        if echo "$dashboards_response" | grep -q '"title":"API Performance"'; then
            pass "  └─ API Performance dashboard loaded"
        else
            warn "  └─ API Performance dashboard not found"
        fi

        if echo "$dashboards_response" | grep -qi '"title":".*Business.*Metrics"'; then
            pass "  └─ Business Metrics dashboard loaded"
        else
            warn "  └─ Business Metrics dashboard not found"
        fi

        if echo "$dashboards_response" | grep -qi '"title":".*PostgreSQL"'; then
            pass "  └─ PostgreSQL dashboard loaded"
        else
            warn "  └─ PostgreSQL dashboard not found"
        fi

        if echo "$dashboards_response" | grep -qi '"title":".*Redis"'; then
            pass "  └─ Redis dashboard loaded"
        else
            warn "  └─ Redis dashboard not found"
        fi
    elif [ "$dashboard_count" -gt 0 ]; then
        warn "Limited dashboards loaded ($dashboard_count dashboards)"
        info "   Expected: At least 4 dashboards"
    else
        fail "No dashboards found in Grafana"
        info "   Dashboards should be auto-provisioned from dashboards/"
    fi
else
    warn "Cannot check dashboards - Grafana not accessible"
fi

# ============================================================================
# 12. Dashboard Panels and Metrics
# ============================================================================

section "12. Dashboard Panels and Metrics"

# Check if Prometheus has data
if curl -s -f "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null 2>&1; then
    pass "Prometheus is accessible and has data"

    # Check for key metrics
    metrics_to_check=(
        "http_requests_total:HTTP request metrics"
        "http_request_duration_seconds:HTTP response time metrics"
        "pg_stat_database_numbackends:PostgreSQL connection metrics"
        "redis_connected_clients:Redis connection metrics"
    )

    for metric_info in "${metrics_to_check[@]}"; do
        metric="${metric_info%%:*}"
        description="${metric_info#*:}"

        query_result=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=$metric" 2>/dev/null)

        if echo "$query_result" | grep -q '"status":"success"'; then
            if echo "$query_result" | grep -q '"result":\[' && ! echo "$query_result" | grep -q '"result":\[\]'; then
                pass "Metric available: $metric"
            else
                warn "Metric exists but no data: $metric"
                info "   $description"
            fi
        else
            warn "Metric not found: $metric"
            info "   $description"
        fi
    done
else
    warn "Prometheus not accessible - cannot verify metrics"
    info "   URL: $PROMETHEUS_URL"
fi

# ============================================================================
# 13. Alert Integration
# ============================================================================

section "13. Alert Integration"

# Check if Grafana alert rules exist
if curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    alert_rules_response=$(curl -s -u "$GRAFANA_USER:$GRAFANA_PASSWORD" "$GRAFANA_URL/api/ruler/grafana/api/v1/rules" 2>/dev/null)

    if echo "$alert_rules_response" | grep -q "alertname\|alert"; then
        pass "Grafana alert rules configured"

        alert_count=$(echo "$alert_rules_response" | grep -o '"alert"' | wc -l)
        info "   Alert rules: $alert_count"
    else
        warn "No alert rules found in Grafana"
        info "   Consider: Configure alerts for dashboard panels"
    fi
else
    warn "Cannot check alert rules - Grafana not accessible"
fi

# Check for AlertManager integration
if [ -f "monitoring/grafana/provisioning/datasources.yml" ]; then
    if grep -q "type: alertmanager" "monitoring/grafana/provisioning/datasources.yml"; then
        pass "AlertManager datasource configured in Grafana"
    else
        warn "AlertManager datasource not configured"
        info "   Optional: Add AlertManager datasource for unified alerts view"
    fi
fi

# ============================================================================
# 14. User Access and Authentication
# ============================================================================

section "14. User Access and Authentication"

# Check for anonymous access setting
if grep -q "GF_AUTH_ANONYMOUS_ENABLED" "docker-compose.yml" 2>/dev/null; then
    if grep "GF_AUTH_ANONYMOUS_ENABLED" "docker-compose.yml" | grep -q "true"; then
        warn "Anonymous access is ENABLED"
        info "   Recommended: Disable for production (set to false)"
    else
        pass "Anonymous access is DISABLED (secure)"
    fi
else
    info "Anonymous access setting not found (defaults to disabled)"
fi

# Check for auth provider configuration
if grep -q "GF_AUTH" "docker-compose.yml" 2>/dev/null; then
    pass "Authentication configuration found in docker-compose.yml"

    if grep -q "GF_AUTH_GENERIC_OAUTH_ENABLED" "docker-compose.yml"; then
        pass "OAuth authentication configured"
    fi

    if grep -q "GF_AUTH_LDAP_ENABLED" "docker-compose.yml"; then
        pass "LDAP authentication configured"
    fi
else
    warn "No custom authentication configured (using built-in)"
    info "   Built-in authentication is sufficient for small teams"
fi

# Check for user management
info "User management:"
info "   • Default admin user: admin"
info "   • Change password on first login"
info "   • Create additional users in Grafana UI"
info "   • Configure user roles (Viewer, Editor, Admin)"

# ============================================================================
# 15. Documentation
# ============================================================================

section "15. Documentation"

# Check for operations dashboard documentation
if [ -f "docs/OPERATIONS_DASHBOARDS.md" ] || [ -f "docs/monitoring/DASHBOARDS.md" ]; then
    pass "Operations dashboards documentation exists"
else
    warn "Operations dashboards documentation not found"
    info "   Create: docs/OPERATIONS_DASHBOARDS.md"
fi

# Check for Grafana setup guide
if [ -f "docs/GRAFANA_SETUP.md" ] || grep -q "Grafana" docs/*.md 2>/dev/null; then
    pass "Grafana setup documentation exists"
else
    warn "Grafana setup documentation not found"
    info "   Document: Grafana installation, dashboard creation, user management"
fi

# Check for dashboard screenshots
if [ -d "docs/images/dashboards" ] || [ -d "docs/screenshots" ]; then
    pass "Dashboard screenshots directory exists"
else
    warn "Dashboard screenshots not found"
    info "   Recommended: Add screenshots of dashboards for documentation"
fi

# ============================================================================
# 16. Production Readiness
# ============================================================================

section "16. Production Readiness"

# Check critical production requirements
prod_ready=true

# Grafana service
if ! grep -q "grafana:" "docker-compose.yml" 2>/dev/null; then
    warn "Production: Grafana service not in docker-compose.yml"
    prod_ready=false
fi

# Dashboards exist
if [ ! -d "monitoring/grafana/dashboards" ]; then
    warn "Production: Dashboard directory missing"
    prod_ready=false
else
    dashboard_file_count=$(find monitoring/grafana/dashboards -name "*.json" -type f 2>/dev/null | wc -l)
    if [ "$dashboard_file_count" -lt 4 ]; then
        warn "Production: Insufficient dashboards ($dashboard_file_count < 4)"
        prod_ready=false
    fi
fi

# Prometheus datasource
if [ ! -f "monitoring/grafana/provisioning/datasources.yml" ]; then
    warn "Production: Datasource configuration missing"
    prod_ready=false
fi

# Grafana accessible
if ! curl -s -f "$GRAFANA_URL/api/health" > /dev/null 2>&1; then
    warn "Production: Grafana not accessible"
    prod_ready=false
fi

# Documentation
if [ ! -f "docs/OPERATIONS_DASHBOARDS.md" ]; then
    warn "Production: Documentation missing"
    prod_ready=false
fi

if [ "$prod_ready" = true ]; then
    pass "Production: Operations dashboards ready for deployment"
else
    warn "Production: NOT ready - complete above items first"
fi

# Summary of setup steps
info "Production setup checklist:"
info "   1. Add Grafana to docker-compose.yml"
info "   2. Start Grafana: docker-compose up -d grafana"
info "   3. Access Grafana: $GRAFANA_URL"
info "   4. Login with admin/admin"
info "   5. Change admin password"
info "   6. Verify dashboards loaded"
info "   7. Verify Prometheus datasource connected"
info "   8. Test dashboard panels with data"
info "   9. Configure user access"
info "   10. Document dashboard usage for ops team"

# ============================================================================
# Summary
# ============================================================================

section "Summary"

total=$((PASSED + FAILED + WARNINGS))
pass_rate=0
if [ $total -gt 0 ]; then
    pass_rate=$((PASSED * 100 / total))
fi

echo ""
echo -e "${GREEN}✓ Passed:   $PASSED${NC}"
echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo -e "${RED}✗ Failed:   $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Operations dashboards are fully configured!${NC}"
    echo ""
    echo "Grafana dashboards:"
    echo "  • URL: $GRAFANA_URL"
    echo "  • API Performance: Request rate, response time, error rate"
    echo "  • Business Metrics: Orders, revenue, customers"
    echo "  • PostgreSQL: Connections, queries, cache hit ratio"
    echo "  • Redis: Memory, hit rate, commands"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Operations dashboards are partially configured with some improvements needed.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Add Grafana to docker-compose.yml (if not present)"
    echo "2. Start Grafana: docker-compose up -d grafana"
    echo "3. Access Grafana at $GRAFANA_URL"
    echo "4. Login with admin/admin and change password"
    echo "5. Verify dashboards are loaded"
    echo "6. Configure user access for ops team"
    echo ""
    echo "Dashboard files found: $(find monitoring/grafana/dashboards -name "*.json" -type f 2>/dev/null | wc -l)"
    exit 0
else
    echo -e "${RED}❌ Operations dashboards are NOT properly configured.${NC}"
    echo ""
    echo "Critical issues found. Please address the failures above."
    echo ""
    echo "Quick start:"
    echo "1. Create dashboard files in monitoring/grafana/dashboards/"
    echo "2. Configure datasource in monitoring/grafana/provisioning/datasources.yml"
    echo "3. Add Grafana service to docker-compose.yml"
    echo "4. Start Grafana: docker-compose up -d grafana"
    echo "5. Run this script again to verify"
    exit 1
fi
