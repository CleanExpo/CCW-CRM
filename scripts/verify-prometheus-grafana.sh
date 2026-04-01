#!/bin/bash

################################################################################
# Prometheus & Grafana Monitoring Verification Script
#
# Purpose: Verify Prometheus and Grafana monitoring deployment for CCW-Online ERP
# Issue: ISS-019 - Deploy Prometheus/Grafana
# Version: 1.0
# Date: 2026-02-02
#
# Usage:
#   ./scripts/verify-prometheus-grafana.sh [options]
#
# Options:
#   PROMETHEUS_URL    Prometheus URL (default: http://localhost:9090)
#   GRAFANA_URL       Grafana URL (default: http://localhost:3001)
#
# Examples:
#   # Local development
#   ./scripts/verify-prometheus-grafana.sh
#
#   # Production verification
#   PROMETHEUS_URL=https://prometheus.ccw-online.com ./scripts/verify-prometheus-grafana.sh
#
# Exit Codes:
#   0 - All checks passed (or warnings only)
#   1 - One or more checks failed
################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Configuration
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
MONITORING_DIR="monitoring"

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
    echo "========================================"
    echo "$1"
    echo "========================================"
}

################################################################################
# Main Verification
################################################################################

echo "================================================================================"
echo "  PROMETHEUS & GRAFANA MONITORING VERIFICATION"
echo "================================================================================"
echo ""
info "Checking monitoring infrastructure for CCW-Online ERP"
info "Prometheus URL: $PROMETHEUS_URL"
info "Grafana URL: $GRAFANA_URL"
echo ""

################################################################################
# 1. Monitoring Configuration Files
################################################################################
section "1. Monitoring Configuration Files"

# Check monitoring directory structure
if [ -d "$MONITORING_DIR" ]; then
    pass "Monitoring directory exists"
else
    fail "Monitoring directory not found: $MONITORING_DIR"
fi

# Check Prometheus configuration
PROMETHEUS_CONFIG="$MONITORING_DIR/prometheus/prometheus.yml"
if [ -f "$PROMETHEUS_CONFIG" ]; then
    pass "Prometheus configuration exists: $PROMETHEUS_CONFIG"

    # Check for required scrape configs
    REQUIRED_JOBS=("ccw-backend" "prometheus" "postgres")
    for job in "${REQUIRED_JOBS[@]}"; do
        if grep -q "job_name.*$job" "$PROMETHEUS_CONFIG"; then
            pass "Scrape config for $job defined"
        else
            warn "Scrape config for $job not found"
        fi
    done
else
    fail "Prometheus configuration not found: $PROMETHEUS_CONFIG"
fi

# Check alert rules
ALERT_RULES="$MONITORING_DIR/prometheus/alert_rules.yml"
if [ -f "$ALERT_RULES" ]; then
    pass "Prometheus alert rules exist: $ALERT_RULES"

    # Count number of alert rules
    RULE_COUNT=$(grep -c "alert:" "$ALERT_RULES" 2>/dev/null || echo "0")
    if [ "$RULE_COUNT" -gt 0 ]; then
        pass "Alert rules defined: $RULE_COUNT rules"
    else
        warn "No alert rules found in $ALERT_RULES"
    fi
else
    warn "Prometheus alert rules not found: $ALERT_RULES"
    info "Create alert_rules.yml with monitoring alerts"
fi

# Check Grafana provisioning
GRAFANA_PROVISIONING="$MONITORING_DIR/grafana/provisioning"
if [ -d "$GRAFANA_PROVISIONING" ]; then
    pass "Grafana provisioning directory exists"

    # Check for datasources
    if [ -d "$GRAFANA_PROVISIONING/datasources" ]; then
        pass "Grafana datasources directory exists"
    else
        warn "Grafana datasources directory not found"
    fi

    # Check for dashboards
    if [ -d "$GRAFANA_PROVISIONING/dashboards" ]; then
        pass "Grafana dashboards provisioning directory exists"
    else
        warn "Grafana dashboards provisioning directory not found"
    fi
else
    warn "Grafana provisioning directory not found: $GRAFANA_PROVISIONING"
fi

# Check Grafana dashboards
GRAFANA_DASHBOARDS="$MONITORING_DIR/grafana/dashboards"
if [ -d "$GRAFANA_DASHBOARDS" ]; then
    pass "Grafana dashboards directory exists"

    # Count dashboard files
    DASHBOARD_COUNT=$(find "$GRAFANA_DASHBOARDS" -name "*.json" 2>/dev/null | wc -l)
    if [ "$DASHBOARD_COUNT" -gt 0 ]; then
        pass "Grafana dashboards found: $DASHBOARD_COUNT dashboards"
    else
        warn "No Grafana dashboard JSON files found"
        info "Add dashboard JSON files to $GRAFANA_DASHBOARDS"
    fi
else
    warn "Grafana dashboards directory not found: $GRAFANA_DASHBOARDS"
fi

################################################################################
# 2. Docker Compose Configuration
################################################################################
section "2. Docker Compose Configuration"

DOCKER_COMPOSE="docker-compose.yml"

if [ -f "$DOCKER_COMPOSE" ]; then
    pass "docker-compose.yml exists"

    # Check for Prometheus service
    if grep -q "prometheus:" "$DOCKER_COMPOSE"; then
        pass "Prometheus service defined in docker-compose.yml"

        # Check Prometheus image
        if grep -A 5 "prometheus:" "$DOCKER_COMPOSE" | grep -q "image.*prom/prometheus"; then
            pass "Prometheus image configured"
        fi

        # Check Prometheus port
        if grep -A 10 "prometheus:" "$DOCKER_COMPOSE" | grep -q "9090:9090"; then
            pass "Prometheus port 9090 exposed"
        else
            warn "Prometheus port 9090 not exposed"
        fi
    else
        fail "Prometheus service not defined in docker-compose.yml"
    fi

    # Check for Grafana service
    if grep -q "grafana:" "$DOCKER_COMPOSE"; then
        pass "Grafana service defined in docker-compose.yml"

        # Check Grafana image
        if grep -A 5 "grafana:" "$DOCKER_COMPOSE" | grep -q "image.*grafana/grafana"; then
            pass "Grafana image configured"
        fi

        # Check Grafana port
        if grep -A 10 "grafana:" "$DOCKER_COMPOSE" | grep -q "3000\|3001"; then
            pass "Grafana port exposed"
        else
            warn "Grafana port not clearly defined"
        fi
    else
        warn "Grafana service not defined in docker-compose.yml"
        info "Add Grafana service or note if using alternative monitoring"
    fi

    # Check for postgres-exporter
    if grep -q "postgres-exporter:" "$DOCKER_COMPOSE"; then
        pass "PostgreSQL exporter defined"
    else
        warn "PostgreSQL exporter not defined"
        info "Add postgres-exporter for database metrics"
    fi

    # Check for redis-exporter
    if grep -q "redis-exporter:" "$DOCKER_COMPOSE"; then
        pass "Redis exporter defined"
    else
        info "Redis exporter not defined (optional)"
    fi

    # Check for alertmanager
    if grep -q "alertmanager:" "$DOCKER_COMPOSE"; then
        pass "AlertManager service defined"
    else
        warn "AlertManager not defined"
        info "Add AlertManager for alert notifications"
    fi
else
    fail "docker-compose.yml not found"
fi

################################################################################
# 3. Prometheus Service Status
################################################################################
section "3. Prometheus Service Status"

if command -v docker >/dev/null 2>&1; then
    # Check if Prometheus container is running
    if docker ps --format '{{.Names}}' | grep -q "prometheus\|ccw-prometheus"; then
        pass "Prometheus container is running"

        # Get container name
        PROMETHEUS_CONTAINER=$(docker ps --format '{{.Names}}' | grep "prometheus\|ccw-prometheus" | head -1)
        info "Container: $PROMETHEUS_CONTAINER"

        # Check container health
        CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$PROMETHEUS_CONTAINER" 2>/dev/null || echo "unknown")
        if [ "$CONTAINER_STATUS" = "running" ]; then
            pass "Prometheus container status: $CONTAINER_STATUS"
        else
            warn "Prometheus container status: $CONTAINER_STATUS"
        fi
    else
        warn "Prometheus container not running"
        info "Start with: docker-compose up -d prometheus"
    fi
else
    warn "Docker not available, cannot check container status"
fi

################################################################################
# 4. Prometheus API Accessibility
################################################################################
section "4. Prometheus API Accessibility"

if command -v curl >/dev/null 2>&1; then
    info "Testing Prometheus API..."

    # Test Prometheus health endpoint
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROMETHEUS_URL/-/healthy" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "Prometheus is healthy and accessible"
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "Prometheus not accessible at $PROMETHEUS_URL"
        info "Check if Prometheus is running: docker-compose ps prometheus"
    else
        warn "Prometheus returned HTTP $HTTP_STATUS"
    fi

    # Test Prometheus API
    if [ "$HTTP_STATUS" = "200" ]; then
        # Check for active targets
        TARGETS_RESPONSE=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null || echo "")

        if [ -n "$TARGETS_RESPONSE" ]; then
            # Count active targets
            ACTIVE_TARGETS=$(echo "$TARGETS_RESPONSE" | grep -o '"health":"up"' | wc -l || echo "0")
            TOTAL_TARGETS=$(echo "$TARGETS_RESPONSE" | grep -o '"health":"' | wc -l || echo "0")

            if [ "$TOTAL_TARGETS" -gt 0 ]; then
                pass "Prometheus targets: $ACTIVE_TARGETS/$TOTAL_TARGETS active"

                if [ "$ACTIVE_TARGETS" -lt "$TOTAL_TARGETS" ]; then
                    warn "Some targets are down, check Prometheus UI"
                fi
            else
                warn "No Prometheus targets configured or responding"
            fi
        fi

        # Check for alerts
        ALERTS_RESPONSE=$(curl -s "$PROMETHEUS_URL/api/v1/alerts" 2>/dev/null || echo "")
        if [ -n "$ALERTS_RESPONSE" ]; then
            FIRING_ALERTS=$(echo "$ALERTS_RESPONSE" | grep -o '"state":"firing"' | wc -l || echo "0")
            if [ "$FIRING_ALERTS" -gt 0 ]; then
                warn "$FIRING_ALERTS alert(s) currently firing"
                info "Check Prometheus UI: $PROMETHEUS_URL/alerts"
            else
                pass "No alerts currently firing"
            fi
        fi
    fi
else
    warn "curl not available, cannot test Prometheus API"
fi

################################################################################
# 5. Grafana Service Status
################################################################################
section "5. Grafana Service Status"

if command -v docker >/dev/null 2>&1; then
    # Check if Grafana container is running
    if docker ps --format '{{.Names}}' | grep -q "grafana\|ccw-grafana"; then
        pass "Grafana container is running"

        # Get container name
        GRAFANA_CONTAINER=$(docker ps --format '{{.Names}}' | grep "grafana\|ccw-grafana" | head -1)
        info "Container: $GRAFANA_CONTAINER"

        # Check container health
        CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$GRAFANA_CONTAINER" 2>/dev/null || echo "unknown")
        if [ "$CONTAINER_STATUS" = "running" ]; then
            pass "Grafana container status: $CONTAINER_STATUS"
        else
            warn "Grafana container status: $CONTAINER_STATUS"
        fi
    else
        warn "Grafana container not running"
        info "Grafana may not be configured in docker-compose.yml"
        info "Add Grafana service: see docs/MONITORING_SETUP.md"
    fi
fi

################################################################################
# 6. Grafana API Accessibility
################################################################################
section "6. Grafana API Accessibility"

if command -v curl >/dev/null 2>&1; then
    info "Testing Grafana API..."

    # Test Grafana health endpoint
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$GRAFANA_URL/api/health" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "Grafana is healthy and accessible"

        # Check Grafana version
        VERSION_INFO=$(curl -s "$GRAFANA_URL/api/health" 2>/dev/null || echo "")
        if [ -n "$VERSION_INFO" ]; then
            info "Grafana is responding"
        fi
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "Grafana not accessible at $GRAFANA_URL"
        info "Check if Grafana is running or configured"
    else
        warn "Grafana returned HTTP $HTTP_STATUS"
    fi
else
    warn "curl not available, cannot test Grafana API"
fi

################################################################################
# 7. Metrics Exporters
################################################################################
section "7. Metrics Exporters"

# Check PostgreSQL exporter
if command -v curl >/dev/null 2>&1; then
    POSTGRES_EXPORTER_URL="http://localhost:9187/metrics"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$POSTGRES_EXPORTER_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "PostgreSQL exporter accessible"

        # Check for metrics
        METRICS=$(curl -s "$POSTGRES_EXPORTER_URL" 2>/dev/null | grep -c "^pg_" || echo "0")
        if [ "$METRICS" -gt 0 ]; then
            pass "PostgreSQL metrics available: $METRICS metric families"
        fi
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "PostgreSQL exporter not accessible at $POSTGRES_EXPORTER_URL"
        info "Start with: docker-compose up -d postgres-exporter"
    else
        warn "PostgreSQL exporter returned HTTP $HTTP_STATUS"
    fi
fi

# Check Redis exporter (optional)
if command -v curl >/dev/null 2>&1; then
    REDIS_EXPORTER_URL="http://localhost:9121/metrics"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$REDIS_EXPORTER_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "Redis exporter accessible"
    elif [ "$HTTP_STATUS" = "000" ]; then
        info "Redis exporter not accessible (optional)"
    fi
fi

################################################################################
# 8. Alert Rules Validation
################################################################################
section "8. Alert Rules Validation"

if [ -f "$ALERT_RULES" ]; then
    info "Validating alert rules syntax..."

    # Check YAML syntax (basic validation)
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import yaml; yaml.safe_load(open('$ALERT_RULES'))" 2>/dev/null; then
            pass "Alert rules YAML syntax is valid"
        else
            fail "Alert rules YAML syntax is invalid"
            info "Run: python3 -c \"import yaml; yaml.safe_load(open('$ALERT_RULES'))\""
        fi
    else
        info "Python3 not available, cannot validate YAML syntax"
    fi

    # Check for common alert rules
    COMMON_ALERTS=("HighErrorRate" "HighResponseTime" "ServiceDown" "DatabaseDown")
    for alert in "${COMMON_ALERTS[@]}"; do
        if grep -q "$alert" "$ALERT_RULES" 2>/dev/null; then
            pass "Alert rule $alert defined"
        else
            info "Alert rule $alert not defined (consider adding)"
        fi
    done
fi

################################################################################
# 9. AlertManager Configuration
################################################################################
section "9. AlertManager Configuration"

ALERTMANAGER_CONFIG="$MONITORING_DIR/alertmanager/config.yml"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    pass "AlertManager configuration exists"

    # Check for notification receivers
    if grep -q "receivers:" "$ALERTMANAGER_CONFIG"; then
        pass "AlertManager receivers configured"

        # Check for common receivers
        COMMON_RECEIVERS=("email" "slack" "webhook")
        for receiver in "${COMMON_RECEIVERS[@]}"; do
            if grep -qi "$receiver" "$ALERTMANAGER_CONFIG"; then
                pass "AlertManager receiver: $receiver configured"
            fi
        done
    else
        warn "No AlertManager receivers configured"
        info "Add notification receivers (email, Slack, PagerDuty)"
    fi
else
    warn "AlertManager configuration not found: $ALERTMANAGER_CONFIG"
    info "Create AlertManager config for alert notifications"
fi

# Check AlertManager service
if command -v docker >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' | grep -q "alertmanager\|ccw-alertmanager"; then
        pass "AlertManager container is running"
    else
        warn "AlertManager container not running"
        info "Start with: docker-compose up -d alertmanager"
    fi
fi

# Check AlertManager API
if command -v curl >/dev/null 2>&1; then
    ALERTMANAGER_URL="http://localhost:9093"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ALERTMANAGER_URL/-/healthy" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "AlertManager is accessible"
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "AlertManager not accessible at $ALERTMANAGER_URL"
    fi
fi

################################################################################
# 10. Backend Metrics Endpoint
################################################################################
section "10. Backend Metrics Endpoint"

BACKEND_METRICS_URL="http://localhost:8000/metrics"

if command -v curl >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_METRICS_URL" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "Backend metrics endpoint accessible"

        # Check for Prometheus format metrics
        METRICS_CONTENT=$(curl -s "$BACKEND_METRICS_URL" 2>/dev/null || echo "")
        if echo "$METRICS_CONTENT" | grep -q "# TYPE\|# HELP"; then
            pass "Backend exposing Prometheus-format metrics"

            # Count metric families
            METRIC_COUNT=$(echo "$METRICS_CONTENT" | grep -c "^# TYPE" || echo "0")
            if [ "$METRIC_COUNT" -gt 0 ]; then
                pass "Backend metrics available: $METRIC_COUNT metric families"
            fi
        else
            warn "Backend metrics not in Prometheus format"
        fi
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "Backend metrics endpoint not accessible"
        info "Ensure backend is running: cd apps/backend && uv run uvicorn src.api.main:app --reload"
        info "Add metrics endpoint: see docs/MONITORING_SETUP.md"
    elif [ "$HTTP_STATUS" = "404" ]; then
        fail "Backend metrics endpoint not found (HTTP 404)"
        info "Implement /metrics endpoint in FastAPI backend"
    else
        warn "Backend metrics endpoint returned HTTP $HTTP_STATUS"
    fi
else
    warn "curl not available, cannot test backend metrics"
fi

################################################################################
# 11. Monitoring Documentation
################################################################################
section "11. Monitoring Documentation"

MONITORING_DOCS=("docs/MONITORING_SETUP.md" "docs/PROMETHEUS_SETUP.md" "docs/GRAFANA_SETUP.md")

DOCS_FOUND=false
for doc in "${MONITORING_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        pass "Monitoring documentation exists: $doc"
        DOCS_FOUND=true
    fi
done

if [ "$DOCS_FOUND" = false ]; then
    warn "No monitoring documentation found"
    info "Create docs/MONITORING_SETUP.md with setup instructions"
fi

################################################################################
# 12. Data Retention Configuration
################################################################################
section "12. Data Retention Configuration"

if [ -f "$PROMETHEUS_CONFIG" ]; then
    # Check retention time in docker-compose.yml
    if [ -f "$DOCKER_COMPOSE" ]; then
        if grep -A 10 "prometheus:" "$DOCKER_COMPOSE" | grep -q "storage.tsdb.retention"; then
            RETENTION=$(grep -A 10 "prometheus:" "$DOCKER_COMPOSE" | grep "storage.tsdb.retention" | head -1)
            pass "Prometheus retention configured"
            info "Retention: $(echo "$RETENTION" | sed 's/.*retention.*=\|--//g')"
        else
            warn "Prometheus retention not explicitly configured"
            info "Default retention is 15 days"
        fi
    fi
fi

################################################################################
# 13. Monitoring Volumes
################################################################################
section "13. Monitoring Volumes"

if [ -f "$DOCKER_COMPOSE" ]; then
    # Check for prometheus-data volume
    if grep -q "prometheus-data:" "$DOCKER_COMPOSE"; then
        pass "Prometheus data volume defined"
    else
        warn "Prometheus data volume not defined"
        info "Data will be lost on container restart"
    fi

    # Check for grafana-data volume
    if grep -q "grafana-data:" "$DOCKER_COMPOSE"; then
        pass "Grafana data volume defined"
    else
        info "Grafana data volume not defined (may be using custom config)"
    fi
fi

################################################################################
# Summary
################################################################################

echo ""
echo "================================================================================"
echo "  VERIFICATION SUMMARY"
echo "================================================================================"
echo -e "✓ Passed:   ${GREEN}$PASSED${NC}"
echo -e "⚠ Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "✗ Failed:   ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ Monitoring infrastructure looks excellent!${NC}"
    else
        echo -e "${YELLOW}⚠ Monitoring is mostly configured with some improvements needed.${NC}"
    fi
    echo ""
    echo "Access URLs:"
    echo "- Prometheus: $PROMETHEUS_URL"
    echo "- Grafana: $GRAFANA_URL"
    echo "- AlertManager: http://localhost:9093"
    echo ""
    echo "Next steps:"
    echo "1. Import Grafana dashboards for CCW-ERP metrics"
    echo "2. Configure AlertManager notification channels"
    echo "3. Set up custom alerts for business metrics"
    echo "4. Test alert delivery with test alert"
    EXIT_CODE=0
else
    echo -e "${RED}✗ Monitoring infrastructure issues detected.${NC}"
    echo ""
    echo "Priority actions:"
    echo "1. Fix failed checks above"
    echo "2. Ensure Prometheus and Grafana are running"
    echo "3. Verify metrics endpoints are accessible"
    echo "4. Configure AlertManager for notifications"
    EXIT_CODE=1
fi

echo ""
exit $EXIT_CODE
