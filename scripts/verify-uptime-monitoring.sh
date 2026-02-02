#!/usr/bin/env bash
#
# Uptime Monitoring Verification Script
# ISS-022: Set Up Uptime Monitoring
#
# This script verifies comprehensive uptime monitoring configuration:
# - Health endpoint implementation and accessibility
# - Uptime monitoring service configuration (UptimeRobot/Pingdom)
# - Health check frequency (1-minute checks)
# - Alert configuration for downtime
# - Status page setup
# - SSL certificate monitoring
# - Response time tracking
# - Multi-region monitoring
#
# Usage:
#   ./scripts/verify-uptime-monitoring.sh
#   BACKEND_URL=https://api.ccw-online.com ./scripts/verify-uptime-monitoring.sh

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
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
PRODUCTION_URL="${PRODUCTION_URL:-}"
UPTIME_ROBOT_API_KEY="${UPTIME_ROBOT_API_KEY:-}"
PINGDOM_API_KEY="${PINGDOM_API_KEY:-}"

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
# 1. Health Endpoint Implementation
# ============================================================================

section "1. Health Endpoint Implementation"

# Check if health.py exists
if [ -f "apps/backend/src/api/routes/health.py" ]; then
    pass "Health endpoint file exists (health.py)"

    # Check for main health endpoint
    if grep -q "def health_check\|async def health_check" "apps/backend/src/api/routes/health.py"; then
        pass "Main health check endpoint implemented (/api/health)"
    else
        fail "Main health check endpoint NOT found"
    fi

    # Check for database health check
    if grep -q "def database_health_check\|database.*health" "apps/backend/src/api/routes/health.py"; then
        pass "Database health check endpoint implemented"
    else
        warn "Database health check endpoint not found"
    fi

    # Check for readiness endpoint
    if grep -q "def readiness_check\|async def readiness_check" "apps/backend/src/api/routes/health.py"; then
        pass "Readiness check endpoint implemented (/api/ready)"
    else
        warn "Readiness check endpoint not found (recommended for K8s)"
    fi

    # Check for liveness endpoint
    if grep -q "def liveness_check\|liveness" "apps/backend/src/api/routes/health.py"; then
        pass "Liveness check endpoint implemented"
    else
        warn "Liveness check endpoint not found (optional)"
    fi
else
    fail "Health endpoint file NOT found: apps/backend/src/api/routes/health.py"
fi

# Check if health route is registered in main.py
if [ -f "apps/backend/src/api/main.py" ]; then
    if grep -q "health" "apps/backend/src/api/main.py"; then
        pass "Health routes registered in main.py"
    else
        warn "Health routes may not be registered in main.py"
    fi
fi

# ============================================================================
# 2. Health Endpoint Accessibility
# ============================================================================

section "2. Health Endpoint Accessibility"

# Test health endpoint locally
if curl -s -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    pass "Health endpoint is accessible at $BACKEND_URL/api/health"

    # Get health response
    health_response=$(curl -s "$BACKEND_URL/api/health")

    # Check for status field
    if echo "$health_response" | grep -q '"status"'; then
        pass "Health endpoint returns status field"

        # Check status value
        if echo "$health_response" | grep -q '"status":"healthy"\|"status": "healthy"'; then
            pass "Health status is 'healthy'"
        else
            warn "Health status is not 'healthy'"
            info "   Response: $health_response"
        fi
    else
        warn "Health endpoint does not return status field"
    fi

    # Check for database field
    if echo "$health_response" | grep -q '"database"'; then
        pass "Health endpoint checks database connectivity"
    else
        warn "Health endpoint does not check database"
    fi

    # Check for timestamp
    if echo "$health_response" | grep -q '"timestamp"'; then
        pass "Health endpoint includes timestamp"
    else
        warn "Health endpoint does not include timestamp"
    fi

    # Check for version
    if echo "$health_response" | grep -q '"version"'; then
        pass "Health endpoint includes version"
    else
        warn "Health endpoint does not include version (optional)"
    fi

    # Check response time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/api/health")
    response_time_ms=$(echo "$response_time * 1000" | bc)
    info "   Response time: ${response_time_ms}ms"

    if (( $(echo "$response_time < 1.0" | bc -l) )); then
        pass "Health endpoint response time < 1s (${response_time}s)"
    else
        warn "Health endpoint response time > 1s (${response_time}s)"
    fi
else
    fail "Health endpoint is NOT accessible at $BACKEND_URL/api/health"
    info "   Start backend: cd apps/backend && uv run uvicorn src.api.main:app --reload"
fi

# Test readiness endpoint
if curl -s -f "$BACKEND_URL/api/ready" > /dev/null 2>&1; then
    pass "Readiness endpoint is accessible at $BACKEND_URL/api/ready"
else
    warn "Readiness endpoint is not accessible"
fi

# ============================================================================
# 3. Production URL Configuration
# ============================================================================

section "3. Production URL Configuration"

if [ -n "$PRODUCTION_URL" ]; then
    pass "Production URL is configured: $PRODUCTION_URL"

    # Test production health endpoint
    if curl -s -f -m 10 "$PRODUCTION_URL/api/health" > /dev/null 2>&1; then
        pass "Production health endpoint is accessible"

        # Get production response
        prod_response=$(curl -s -m 10 "$PRODUCTION_URL/api/health")

        if echo "$prod_response" | grep -q '"status":"healthy"\|"status": "healthy"'; then
            pass "Production health status is 'healthy'"
        else
            warn "Production health status is not 'healthy'"
            info "   Response: $prod_response"
        fi
    else
        warn "Production health endpoint is NOT accessible"
        info "   This is expected if production is not deployed yet"
    fi
else
    warn "Production URL is NOT configured"
    info "   Set: export PRODUCTION_URL=https://api.ccw-online.com"
    info "   This is expected for development environments"
fi

# ============================================================================
# 4. UptimeRobot Configuration
# ============================================================================

section "4. UptimeRobot Configuration"

if [ -n "$UPTIME_ROBOT_API_KEY" ]; then
    pass "UptimeRobot API key is configured"

    # Test UptimeRobot API
    if command -v curl &> /dev/null; then
        uptime_robot_response=$(curl -s -X POST https://api.uptimerobot.com/v2/getMonitors \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "api_key=$UPTIME_ROBOT_API_KEY" \
            -d "format=json" 2>&1)

        if echo "$uptime_robot_response" | grep -q '"stat":"ok"'; then
            pass "UptimeRobot API is accessible"

            # Count monitors
            monitor_count=$(echo "$uptime_robot_response" | grep -o '"id":[0-9]*' | wc -l)
            info "   Monitors configured: $monitor_count"

            if [ "$monitor_count" -gt 0 ]; then
                pass "UptimeRobot monitors are configured ($monitor_count monitors)"

                # Check if CCW-ERP monitor exists
                if echo "$uptime_robot_response" | grep -q "ccw-erp\|ccw-online\|CCW"; then
                    pass "CCW-ERP monitor found in UptimeRobot"
                else
                    warn "CCW-ERP monitor not found in UptimeRobot"
                fi

                # Check monitor interval
                if echo "$uptime_robot_response" | grep -q '"interval":60\|"interval":"60"'; then
                    pass "1-minute check interval configured"
                else
                    warn "1-minute check interval not detected"
                    info "   Recommended: Set interval to 60 seconds (1 minute)"
                fi
            else
                warn "No monitors configured in UptimeRobot"
                info "   Create monitor: https://uptimerobot.com/dashboard"
            fi
        else
            warn "UptimeRobot API is not accessible or key is invalid"
            info "   Response: $uptime_robot_response"
        fi
    fi
else
    warn "UptimeRobot API key is NOT configured"
    info "   Get API key: https://uptimerobot.com/dashboard → Settings → API Settings"
    info "   Set: export UPTIME_ROBOT_API_KEY=<your-api-key>"
    info "   This is optional - you can also configure via web dashboard"
fi

# Check for UptimeRobot documentation
if [ -f "docs/UPTIME_MONITORING.md" ] || [ -f "docs/monitoring/UPTIME.md" ]; then
    pass "UptimeRobot documentation exists"
else
    warn "UptimeRobot documentation not found"
    info "   Create: docs/UPTIME_MONITORING.md"
fi

# ============================================================================
# 5. Pingdom Configuration
# ============================================================================

section "5. Pingdom Configuration"

if [ -n "$PINGDOM_API_KEY" ]; then
    pass "Pingdom API key is configured"

    # Test Pingdom API
    if command -v curl &> /dev/null; then
        pingdom_response=$(curl -s -X GET https://api.pingdom.com/api/3.1/checks \
            -H "Authorization: Bearer $PINGDOM_API_KEY" 2>&1)

        if echo "$pingdom_response" | grep -q '"checks"'; then
            pass "Pingdom API is accessible"

            # Count checks
            check_count=$(echo "$pingdom_response" | grep -o '"id":[0-9]*' | wc -l)
            info "   Checks configured: $check_count"

            if [ "$check_count" -gt 0 ]; then
                pass "Pingdom checks are configured ($check_count checks)"

                # Check if CCW-ERP check exists
                if echo "$pingdom_response" | grep -q "ccw-erp\|ccw-online\|CCW"; then
                    pass "CCW-ERP check found in Pingdom"
                else
                    warn "CCW-ERP check not found in Pingdom"
                fi
            else
                warn "No checks configured in Pingdom"
                info "   Create check: https://my.pingdom.com/checks"
            fi
        else
            warn "Pingdom API is not accessible or key is invalid"
            info "   Response: $pingdom_response"
        fi
    fi
else
    warn "Pingdom API key is NOT configured"
    info "   Get API key: https://my.pingdom.com/app/api-tokens"
    info "   Set: export PINGDOM_API_KEY=<your-api-key>"
    info "   This is optional - alternative to UptimeRobot"
fi

# ============================================================================
# 6. Alert Configuration
# ============================================================================

section "6. Alert Configuration"

# Check for alert webhook configuration
if [ -f "monitoring/alertmanager/config.yml" ]; then
    if grep -q "webhook.*uptime\|uptime.*webhook" "monitoring/alertmanager/config.yml"; then
        pass "Uptime monitoring webhook configured in AlertManager"
    else
        warn "Uptime monitoring webhook not found in AlertManager"
        info "   Consider: Configure webhook for uptime alerts"
    fi
fi

# Check for alert rules related to health checks
if [ -f "monitoring/prometheus/alert_rules.yml" ]; then
    if grep -q "health.*check\|HealthCheck\|ServiceDown\|BackendDown" "monitoring/prometheus/alert_rules.yml"; then
        pass "Health check alert rules configured in Prometheus"
    else
        warn "Health check alert rules not found in Prometheus"
        info "   Recommended: Add ServiceDown alert rule"
    fi
fi

# Check for notification channels
info "Alert notification channels to configure:"
info "   • Email notifications (via UptimeRobot/Pingdom)"
info "   • Slack notifications (optional)"
info "   • SMS notifications (optional)"
info "   • PagerDuty integration (optional)"

# ============================================================================
# 7. Status Page Configuration
# ============================================================================

section "7. Status Page Configuration"

# Check for status page configuration
if [ -n "$UPTIME_ROBOT_API_KEY" ]; then
    # Check for status page in UptimeRobot
    uptime_robot_status=$(curl -s -X POST https://api.uptimerobot.com/v2/getPSPs \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "api_key=$UPTIME_ROBOT_API_KEY" \
        -d "format=json" 2>&1)

    if echo "$uptime_robot_status" | grep -q '"stat":"ok"'; then
        status_page_count=$(echo "$uptime_robot_status" | grep -o '"id":[0-9]*' | wc -l)

        if [ "$status_page_count" -gt 0 ]; then
            pass "Status page configured in UptimeRobot ($status_page_count pages)"
        else
            warn "No status page configured in UptimeRobot"
            info "   Create: https://uptimerobot.com/dashboard → Status Pages"
        fi
    fi
else
    warn "Status page configuration cannot be verified (no API key)"
    info "   Status page provides public visibility of uptime"
fi

# Check for custom status page
if [ -f "apps/web/app/(public)/status/page.tsx" ] || [ -f "apps/web/app/status/page.tsx" ]; then
    pass "Custom status page exists in frontend"
else
    warn "Custom status page not found in frontend"
    info "   Consider: Create public status page showing system health"
fi

# ============================================================================
# 8. SSL Certificate Monitoring
# ============================================================================

section "8. SSL Certificate Monitoring"

if [ -n "$PRODUCTION_URL" ]; then
    # Extract domain from URL
    domain=$(echo "$PRODUCTION_URL" | sed -E 's|https?://([^/]+).*|\1|')

    if command -v openssl &> /dev/null && [[ "$PRODUCTION_URL" == https://* ]]; then
        pass "SSL certificate monitoring is possible (openssl available)"

        # Check certificate expiry
        cert_info=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")

        if [ -n "$cert_info" ]; then
            pass "SSL certificate is accessible for $domain"

            # Extract expiry date
            expiry_date=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
            info "   Certificate expires: $expiry_date"

            # Check if expiring soon (within 30 days)
            expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s 2>/dev/null || echo "0")
            current_epoch=$(date +%s)
            days_until_expiry=$(( ($expiry_epoch - $current_epoch) / 86400 ))

            if [ "$days_until_expiry" -gt 30 ]; then
                pass "SSL certificate is valid (expires in $days_until_expiry days)"
            elif [ "$days_until_expiry" -gt 0 ]; then
                warn "SSL certificate expires soon (in $days_until_expiry days)"
            else
                fail "SSL certificate has EXPIRED"
            fi
        else
            warn "SSL certificate information not available"
            info "   This is expected if production is not deployed"
        fi
    else
        warn "SSL certificate monitoring not available (openssl not found or not HTTPS)"
    fi
else
    warn "SSL certificate monitoring not configured (no production URL)"
fi

# Check if UptimeRobot monitors SSL expiry
info "UptimeRobot/Pingdom SSL monitoring:"
info "   • Automatic SSL certificate expiry monitoring"
info "   • Alerts 30 days before expiry"
info "   • Recommended: Enable in monitor settings"

# ============================================================================
# 9. Response Time Monitoring
# ============================================================================

section "9. Response Time Monitoring"

# Check if backend is accessible for timing
if curl -s -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    # Measure response times for different endpoints
    health_time=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/api/health")
    health_time_ms=$(echo "$health_time * 1000" | bc)

    info "Response time measurements:"
    info "   • /api/health: ${health_time_ms}ms"

    if (( $(echo "$health_time < 0.5" | bc -l) )); then
        pass "Health endpoint response time is excellent (<500ms)"
    elif (( $(echo "$health_time < 1.0" | bc -l) )); then
        pass "Health endpoint response time is good (<1s)"
    else
        warn "Health endpoint response time is slow (>1s)"
    fi

    # Check ready endpoint
    if curl -s -f "$BACKEND_URL/api/ready" > /dev/null 2>&1; then
        ready_time=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/api/ready")
        ready_time_ms=$(echo "$ready_time * 1000" | bc)
        info "   • /api/ready: ${ready_time_ms}ms"
    fi
fi

# Check for response time thresholds in Prometheus
if [ -f "monitoring/prometheus/alert_rules.yml" ]; then
    if grep -q "response.*time\|ResponseTime" "monitoring/prometheus/alert_rules.yml"; then
        pass "Response time alerts configured in Prometheus"
    else
        warn "Response time alerts not found in Prometheus"
    fi
fi

info "UptimeRobot/Pingdom response time monitoring:"
info "   • Average response time tracking"
info "   • Response time threshold alerts"
info "   • Historical response time graphs"

# ============================================================================
# 10. Multi-Endpoint Monitoring
# ============================================================================

section "10. Multi-Endpoint Monitoring"

# List recommended endpoints to monitor
info "Recommended endpoints to monitor:"

endpoints=(
    "/api/health:Main health check (database, api)"
    "/api/ready:Readiness check (K8s liveness)"
    "/:Frontend homepage"
    "/api/products:Sample API endpoint"
)

monitored_count=0
for endpoint_desc in "${endpoints[@]}"; do
    endpoint="${endpoint_desc%%:*}"
    description="${endpoint_desc#*:}"

    if curl -s -f -m 5 "$BACKEND_URL$endpoint" > /dev/null 2>&1 || curl -s -f -m 5 "$FRONTEND_URL$endpoint" > /dev/null 2>&1; then
        pass "Endpoint accessible: $endpoint ($description)"
        ((monitored_count++))
    else
        warn "Endpoint not accessible: $endpoint"
        info "   Description: $description"
    fi
done

if [ "$monitored_count" -ge 2 ]; then
    pass "Multiple endpoints are accessible for monitoring ($monitored_count endpoints)"
else
    warn "Limited endpoints accessible (only $monitored_count)"
fi

# ============================================================================
# 11. Multi-Region Monitoring
# ============================================================================

section "11. Multi-Region Monitoring"

info "Multi-region monitoring configuration:"
info "   • UptimeRobot: Check from multiple locations (free plan: limited)"
info "   • Pingdom: Check from multiple locations (paid plans)"
info "   • Recommended regions: US East, US West, Europe, Asia"
info "   • Helps detect regional outages and DNS issues"

if [ -n "$UPTIME_ROBOT_API_KEY" ] || [ -n "$PINGDOM_API_KEY" ]; then
    warn "Multi-region monitoring: Configure in web dashboard"
    info "   UptimeRobot: Settings → Monitoring Locations"
    info "   Pingdom: Check Settings → Probe servers"
else
    warn "Multi-region monitoring not configured (no API keys)"
fi

# ============================================================================
# 12. Check Frequency Configuration
# ============================================================================

section "12. Check Frequency Configuration"

info "Recommended check frequencies:"
info "   • Production: 1 minute (60 seconds)"
info "   • Staging: 5 minutes (300 seconds)"
info "   • Development: 10 minutes (600 seconds)"

if [ -n "$UPTIME_ROBOT_API_KEY" ]; then
    info "UptimeRobot check intervals:"
    info "   • Free plan: 5 minutes"
    info "   • Paid plans: 1 minute or less"
elif [ -n "$PINGDOM_API_KEY" ]; then
    info "Pingdom check intervals:"
    info "   • Standard: 1 minute"
    info "   • Advanced: 30 seconds"
else
    warn "Check frequency cannot be verified (no API keys configured)"
fi

# ============================================================================
# 13. Incident Response Configuration
# ============================================================================

section "13. Incident Response Configuration"

# Check for incident response documentation
if [ -f "docs/INCIDENT_RESPONSE.md" ] || [ -f "docs/operations/INCIDENT_RESPONSE.md" ]; then
    pass "Incident response documentation exists"
else
    warn "Incident response documentation not found"
    info "   Create: docs/INCIDENT_RESPONSE.md"
fi

# Check for on-call schedule
if [ -f "docs/ON_CALL_SCHEDULE.md" ] || grep -q "on-call\|oncall" docs/*.md 2>/dev/null; then
    pass "On-call schedule documentation exists"
else
    warn "On-call schedule not documented"
    info "   Create: docs/ON_CALL_SCHEDULE.md"
fi

info "Incident response checklist:"
info "   • Define downtime alert thresholds"
info "   • Configure escalation policies"
info "   • Document incident response procedures"
info "   • Set up on-call rotation"
info "   • Test alert delivery regularly"

# ============================================================================
# 14. Documentation
# ============================================================================

section "14. Documentation"

# Check for uptime monitoring documentation
if [ -f "docs/UPTIME_MONITORING.md" ]; then
    pass "Uptime monitoring documentation exists"
else
    warn "Uptime monitoring documentation not found"
    info "   Create: docs/UPTIME_MONITORING.md"
fi

# Check for monitoring overview
if [ -f "docs/MONITORING_OVERVIEW.md" ] || [ -f "docs/monitoring/README.md" ]; then
    pass "Monitoring overview documentation exists"
else
    warn "Monitoring overview not found"
fi

# Check for deployment documentation mentioning uptime monitoring
if [ -f "docs/DEPLOYMENT_RUNBOOK.md" ] || [ -f "docs/PRODUCTION_RUNBOOK.md" ]; then
    if grep -q "uptime\|health.*check" docs/DEPLOYMENT_RUNBOOK.md docs/PRODUCTION_RUNBOOK.md 2>/dev/null; then
        pass "Deployment documentation mentions uptime monitoring"
    else
        warn "Deployment documentation does not mention uptime monitoring"
    fi
fi

# ============================================================================
# 15. Production Readiness
# ============================================================================

section "15. Production Readiness"

# Check critical production requirements
prod_ready=true

# Health endpoint
if ! curl -s -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    warn "Production: Health endpoint not accessible locally"
    prod_ready=false
fi

# Production URL
if [ -z "$PRODUCTION_URL" ]; then
    warn "Production: Production URL not configured"
    prod_ready=false
fi

# Uptime monitoring service
if [ -z "$UPTIME_ROBOT_API_KEY" ] && [ -z "$PINGDOM_API_KEY" ]; then
    warn "Production: Uptime monitoring service not configured"
    prod_ready=false
fi

# Alert configuration
if [ ! -f "monitoring/prometheus/alert_rules.yml" ]; then
    warn "Production: Alert rules not configured"
    prod_ready=false
fi

# Documentation
if [ ! -f "docs/UPTIME_MONITORING.md" ]; then
    warn "Production: Uptime monitoring documentation missing"
    prod_ready=false
fi

if [ "$prod_ready" = true ]; then
    pass "Production: Uptime monitoring is ready for deployment"
else
    warn "Production: NOT ready - complete above items first"
fi

# Summary of setup steps
info "Production setup checklist:"
info "   1. Deploy application to production"
info "   2. Verify /api/health is publicly accessible"
info "   3. Create UptimeRobot or Pingdom account"
info "   4. Configure monitor for production URL"
info "   5. Set check interval to 1 minute"
info "   6. Configure alert contacts (email, SMS, Slack)"
info "   7. Set up status page (optional)"
info "   8. Enable SSL certificate monitoring"
info "   9. Test alert delivery"
info "   10. Document incident response procedures"

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
    echo -e "${GREEN}✅ Uptime monitoring is fully configured!${NC}"
    echo ""
    echo "Uptime monitoring details:"
    echo "  • Health endpoint: $BACKEND_URL/api/health"
    [ -n "$PRODUCTION_URL" ] && echo "  • Production URL: $PRODUCTION_URL"
    [ -n "$UPTIME_ROBOT_API_KEY" ] && echo "  • UptimeRobot: Configured"
    [ -n "$PINGDOM_API_KEY" ] && echo "  • Pingdom: Configured"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Uptime monitoring is partially configured with some improvements needed.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure production URL (export PRODUCTION_URL=https://api.ccw-online.com)"
    echo "2. Sign up for UptimeRobot (https://uptimerobot.com) or Pingdom (https://pingdom.com)"
    echo "3. Create monitor for production health endpoint"
    echo "4. Set check interval to 1 minute"
    echo "5. Configure alert notifications (email, SMS, Slack)"
    echo "6. Test alert delivery by simulating downtime"
    echo ""
    echo "Health endpoint: $BACKEND_URL/api/health"
    exit 0
else
    echo -e "${RED}❌ Uptime monitoring is NOT properly configured.${NC}"
    echo ""
    echo "Critical issues found. Please address the failures above."
    echo ""
    echo "Quick start:"
    echo "1. Ensure backend is running: cd apps/backend && uv run uvicorn src.api.main:app --reload"
    echo "2. Test health endpoint: curl $BACKEND_URL/api/health"
    echo "3. Deploy to production and get public URL"
    echo "4. Sign up for UptimeRobot: https://uptimerobot.com"
    echo "5. Create monitor pointing to https://yourdomain.com/api/health"
    echo "6. Run this script again to verify"
    exit 1
fi
