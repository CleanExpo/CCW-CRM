#!/bin/bash

################################################################################
# Alert Rules & Notifications Verification Script
#
# Purpose: Verify Prometheus alert rules and AlertManager notifications for CCW-Online ERP
# Issue: ISS-020 - Configure Alert Rules & Notifications
# Version: 1.0
# Date: 2026-02-02
#
# Usage:
#   ./scripts/verify-alert-rules.sh [options]
#
# Options:
#   PROMETHEUS_URL    Prometheus URL (default: http://localhost:9090)
#   ALERTMANAGER_URL  AlertManager URL (default: http://localhost:9093)
#
# Examples:
#   # Local verification
#   ./scripts/verify-alert-rules.sh
#
#   # Production verification
#   PROMETHEUS_URL=https://prometheus.ccw-online.com \
#   ALERTMANAGER_URL=https://alertmanager.ccw-online.com \
#   ./scripts/verify-alert-rules.sh
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
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"
ALERT_RULES_FILE="monitoring/prometheus/alert_rules.yml"
ALERTMANAGER_CONFIG="monitoring/alertmanager/config.yml"

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
echo "  ALERT RULES & NOTIFICATIONS VERIFICATION"
echo "================================================================================"
echo ""
info "Checking alert rules and notification configuration for CCW-Online ERP"
info "Prometheus URL: $PROMETHEUS_URL"
info "AlertManager URL: $ALERTMANAGER_URL"
echo ""

################################################################################
# 1. Alert Rules File
################################################################################
section "1. Alert Rules File"

if [ -f "$ALERT_RULES_FILE" ]; then
    pass "Alert rules file exists: $ALERT_RULES_FILE"

    # Validate YAML syntax
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import yaml; yaml.safe_load(open('$ALERT_RULES_FILE'))" 2>/dev/null; then
            pass "Alert rules YAML syntax is valid"
        else
            fail "Alert rules YAML syntax is invalid"
            info "Run: python3 -c \"import yaml; yaml.safe_load(open('$ALERT_RULES_FILE'))\""
        fi
    fi

    # Count alert groups
    GROUP_COUNT=$(grep -c "^  - name:" "$ALERT_RULES_FILE" 2>/dev/null || echo "0")
    if [ "$GROUP_COUNT" -gt 0 ]; then
        pass "Alert groups defined: $GROUP_COUNT groups"
    else
        fail "No alert groups found"
    fi

    # Count alert rules
    RULE_COUNT=$(grep -c "alert:" "$ALERT_RULES_FILE" 2>/dev/null || echo "0")
    if [ "$RULE_COUNT" -gt 0 ]; then
        pass "Alert rules defined: $RULE_COUNT rules"
    else
        fail "No alert rules found"
    fi
else
    fail "Alert rules file not found: $ALERT_RULES_FILE"
fi

################################################################################
# 2. Required Alert Rules
################################################################################
section "2. Required Alert Rules"

# Define required alert rules
REQUIRED_ALERTS=(
    "HighResponseTime:API response time monitoring"
    "HighErrorRate:API error rate monitoring"
    "BackendDown:Backend service availability"
    "HighMemoryUsage:Memory usage monitoring"
    "DatabasePoolSaturation:Database connection pool"
    "PostgreSQLDown:PostgreSQL availability"
    "PostgreSQLTooManyConnections:Database connections limit"
    "PostgreSQLSlowQueries:Slow query detection"
)

if [ -f "$ALERT_RULES_FILE" ]; then
    for alert_desc in "${REQUIRED_ALERTS[@]}"; do
        ALERT_NAME="${alert_desc%%:*}"
        ALERT_PURPOSE="${alert_desc#*:}"

        if grep -q "alert: $ALERT_NAME" "$ALERT_RULES_FILE"; then
            pass "$ALERT_NAME - $ALERT_PURPOSE"
        else
            warn "$ALERT_NAME not found - $ALERT_PURPOSE"
            info "Consider adding this alert rule"
        fi
    done
fi

################################################################################
# 3. Alert Severity Levels
################################################################################
section "3. Alert Severity Levels"

if [ -f "$ALERT_RULES_FILE" ]; then
    # Check for severity labels
    if grep -q "severity: critical" "$ALERT_RULES_FILE"; then
        CRITICAL_COUNT=$(grep -c "severity: critical" "$ALERT_RULES_FILE" || echo "0")
        pass "Critical severity alerts: $CRITICAL_COUNT"
    else
        warn "No critical severity alerts defined"
    fi

    if grep -q "severity: warning" "$ALERT_RULES_FILE"; then
        WARNING_COUNT=$(grep -c "severity: warning" "$ALERT_RULES_FILE" || echo "0")
        pass "Warning severity alerts: $WARNING_COUNT"
    else
        warn "No warning severity alerts defined"
    fi
fi

################################################################################
# 4. Alert Annotations
################################################################################
section "4. Alert Annotations"

if [ -f "$ALERT_RULES_FILE" ]; then
    # Check for required annotations
    if grep -q "summary:" "$ALERT_RULES_FILE"; then
        pass "Alert summaries defined"
    else
        warn "No alert summaries found"
    fi

    if grep -q "description:" "$ALERT_RULES_FILE"; then
        pass "Alert descriptions defined"
    else
        warn "No alert descriptions found"
    fi

    # Check for variable interpolation in descriptions
    if grep -q "{{ \$value" "$ALERT_RULES_FILE"; then
        pass "Alert descriptions use variable interpolation"
    else
        info "Consider adding {{ \$value }} to alert descriptions"
    fi
fi

################################################################################
# 5. Prometheus Rules API
################################################################################
section "5. Prometheus Rules API"

if command -v curl >/dev/null 2>&1; then
    info "Checking Prometheus rules API..."

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROMETHEUS_URL/api/v1/rules" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "Prometheus rules API accessible"

        # Get rules response
        RULES_RESPONSE=$(curl -s "$PROMETHEUS_URL/api/v1/rules" 2>/dev/null || echo "")

        if [ -n "$RULES_RESPONSE" ]; then
            # Count loaded rule groups
            LOADED_GROUPS=$(echo "$RULES_RESPONSE" | grep -o '"name":' | wc -l || echo "0")
            if [ "$LOADED_GROUPS" -gt 0 ]; then
                pass "Rule groups loaded in Prometheus: $LOADED_GROUPS"
            else
                warn "No rule groups loaded in Prometheus"
                info "Check Prometheus logs for rule loading errors"
            fi

            # Check for evaluation errors
            if echo "$RULES_RESPONSE" | grep -q '"lastError"'; then
                fail "Some alert rules have evaluation errors"
                info "Check: $PROMETHEUS_URL/rules"
            else
                pass "No alert rule evaluation errors"
            fi
        fi
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "Prometheus not accessible at $PROMETHEUS_URL"
        info "Start Prometheus: docker-compose up -d prometheus"
    else
        warn "Prometheus rules API returned HTTP $HTTP_STATUS"
    fi
fi

################################################################################
# 6. AlertManager Configuration
################################################################################
section "6. AlertManager Configuration"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    pass "AlertManager configuration exists: $ALERTMANAGER_CONFIG"

    # Validate YAML syntax
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import yaml; yaml.safe_load(open('$ALERTMANAGER_CONFIG'))" 2>/dev/null; then
            pass "AlertManager config YAML syntax is valid"
        else
            fail "AlertManager config YAML syntax is invalid"
        fi
    fi

    # Check for receivers
    if grep -q "^receivers:" "$ALERTMANAGER_CONFIG"; then
        pass "Alert receivers configured"

        # Count receivers
        RECEIVER_COUNT=$(grep -c "^  - name:" "$ALERTMANAGER_CONFIG" || echo "0")
        if [ "$RECEIVER_COUNT" -gt 0 ]; then
            pass "Alert receivers defined: $RECEIVER_COUNT receivers"
        fi
    else
        fail "No alert receivers configured"
    fi

    # Check for routes
    if grep -q "^route:" "$ALERTMANAGER_CONFIG"; then
        pass "Alert routing configured"
    else
        fail "No alert routing configured"
    fi
else
    fail "AlertManager configuration not found: $ALERTMANAGER_CONFIG"
fi

################################################################################
# 7. Email Notifications
################################################################################
section "7. Email Notifications"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    # Check for email configuration
    if grep -q "email_configs:" "$ALERTMANAGER_CONFIG"; then
        pass "Email notifications configured"

        # Check SMTP settings
        if grep -q "smtp_smarthost:" "$ALERTMANAGER_CONFIG"; then
            pass "SMTP server configured"

            SMTP_HOST=$(grep "smtp_smarthost:" "$ALERTMANAGER_CONFIG" | head -1 | sed "s/.*smtp_smarthost: '\(.*\)'.*/\1/")
            info "SMTP host: $SMTP_HOST"
        else
            warn "SMTP server not configured"
        fi

        # Check for email recipient
        EMAIL_RECIPIENTS=$(grep -c "to:" "$ALERTMANAGER_CONFIG" || echo "0")
        if [ "$EMAIL_RECIPIENTS" -gt 0 ]; then
            pass "Email recipients configured: $EMAIL_RECIPIENTS"
        else
            warn "No email recipients configured"
        fi

        # Check for HTML templates
        if grep -q "html:" "$ALERTMANAGER_CONFIG"; then
            pass "HTML email templates configured"
        else
            info "No HTML email templates (using plain text)"
        fi
    else
        warn "Email notifications not configured"
        info "Add email_configs to AlertManager configuration"
    fi
fi

################################################################################
# 8. Slack Notifications
################################################################################
section "8. Slack Notifications"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    # Check for Slack configuration
    if grep -q "slack_configs:" "$ALERTMANAGER_CONFIG"; then
        # Check if commented out
        if grep "# slack_configs:" "$ALERTMANAGER_CONFIG" >/dev/null; then
            warn "Slack notifications commented out (not enabled)"
            info "Uncomment slack_configs and set SLACK_WEBHOOK_URL to enable"
        else
            pass "Slack notifications configured"

            # Check for webhook URL
            if grep -q "api_url:" "$ALERTMANAGER_CONFIG"; then
                pass "Slack webhook URL configured"
            fi

            # Check for channel
            if grep -q "channel:" "$ALERTMANAGER_CONFIG"; then
                pass "Slack channel configured"
            fi
        fi
    else
        info "Slack notifications not configured (optional)"
        info "Add slack_configs for Slack alerts"
    fi
fi

################################################################################
# 9. PagerDuty Integration
################################################################################
section "9. PagerDuty Integration"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    # Check for PagerDuty configuration
    if grep -q "pagerduty_configs:" "$ALERTMANAGER_CONFIG"; then
        pass "PagerDuty integration configured"

        # Check for service key
        if grep -q "service_key:" "$ALERTMANAGER_CONFIG"; then
            pass "PagerDuty service key configured"
        elif grep -q "routing_key:" "$ALERTMANAGER_CONFIG"; then
            pass "PagerDuty routing key configured"
        fi
    else
        info "PagerDuty integration not configured (optional)"
        info "Add pagerduty_configs for on-call paging"
    fi
fi

################################################################################
# 10. Routing Configuration
################################################################################
section "10. Routing Configuration"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    # Check for severity-based routing
    if grep -q "match:" "$ALERTMANAGER_CONFIG" && grep -q "severity:" "$ALERTMANAGER_CONFIG"; then
        pass "Severity-based routing configured"

        # Check for critical routing
        if grep -A 3 "match:" "$ALERTMANAGER_CONFIG" | grep -q "severity: critical"; then
            pass "Critical alert routing configured"
        fi

        # Check for warning routing
        if grep -A 3 "match:" "$ALERTMANAGER_CONFIG" | grep -q "severity: warning"; then
            pass "Warning alert routing configured"
        fi
    else
        warn "Severity-based routing not configured"
        info "Configure different receivers for critical vs warning alerts"
    fi

    # Check grouping configuration
    if grep -q "group_by:" "$ALERTMANAGER_CONFIG"; then
        pass "Alert grouping configured"

        GROUP_BY=$(grep "group_by:" "$ALERTMANAGER_CONFIG" | head -1)
        info "Grouping: $GROUP_BY"
    fi

    # Check repeat interval
    if grep -q "repeat_interval:" "$ALERTMANAGER_CONFIG"; then
        pass "Alert repeat interval configured"
    fi
fi

################################################################################
# 11. Inhibition Rules
################################################################################
section "11. Inhibition Rules"

if [ -f "$ALERTMANAGER_CONFIG" ]; then
    # Check for inhibition rules
    if grep -q "^inhibit_rules:" "$ALERTMANAGER_CONFIG"; then
        pass "Inhibition rules configured"

        # Count inhibition rules
        INHIBIT_COUNT=$(grep -c "^  - source_match:" "$ALERTMANAGER_CONFIG" || echo "0")
        if [ "$INHIBIT_COUNT" -gt 0 ]; then
            pass "Inhibition rules defined: $INHIBIT_COUNT rules"
            info "Inhibitions suppress redundant alerts"
        fi
    else
        warn "No inhibition rules configured"
        info "Add inhibition rules to reduce alert noise"
    fi
fi

################################################################################
# 12. AlertManager Status
################################################################################
section "12. AlertManager Status"

if command -v curl >/dev/null 2>&1; then
    info "Checking AlertManager status..."

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ALERTMANAGER_URL/-/healthy" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "AlertManager is healthy and accessible"

        # Check AlertManager API
        STATUS_RESPONSE=$(curl -s "$ALERTMANAGER_URL/api/v2/status" 2>/dev/null || echo "")
        if [ -n "$STATUS_RESPONSE" ]; then
            # Check config loaded
            if echo "$STATUS_RESPONSE" | grep -q '"config"'; then
                pass "AlertManager configuration loaded"
            fi

            # Check uptime
            if echo "$STATUS_RESPONSE" | grep -q '"uptime"'; then
                pass "AlertManager is running"
            fi
        fi

        # Check for active alerts
        ALERTS_RESPONSE=$(curl -s "$ALERTMANAGER_URL/api/v2/alerts" 2>/dev/null || echo "")
        if [ -n "$ALERTS_RESPONSE" ]; then
            ACTIVE_ALERTS=$(echo "$ALERTS_RESPONSE" | grep -o '"state":"active"' | wc -l || echo "0")
            SUPPRESSED_ALERTS=$(echo "$ALERTS_RESPONSE" | grep -o '"state":"suppressed"' | wc -l || echo "0")

            if [ "$ACTIVE_ALERTS" -gt 0 ]; then
                warn "$ACTIVE_ALERTS alert(s) currently active"
                info "Check: $ALERTMANAGER_URL/#/alerts"
            else
                pass "No active alerts"
            fi

            if [ "$SUPPRESSED_ALERTS" -gt 0 ]; then
                info "$SUPPRESSED_ALERTS alert(s) suppressed by inhibition rules"
            fi
        fi
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "AlertManager not accessible at $ALERTMANAGER_URL"
        info "Start AlertManager: docker-compose up -d alertmanager"
    else
        warn "AlertManager returned HTTP $HTTP_STATUS"
    fi
fi

################################################################################
# 13. Alert Testing
################################################################################
section "13. Alert Testing"

info "To test alert delivery:"
echo ""
echo "1. Trigger a test alert in Prometheus:"
echo "   curl -X POST http://localhost:9090/-/reload"
echo ""
echo "2. Create a manual test alert:"
echo "   curl -H 'Content-Type: application/json' -d '[{\"labels\":{\"alertname\":\"TestAlert\",\"severity\":\"warning\"}}]' http://localhost:9093/api/v1/alerts"
echo ""
echo "3. Check email inbox for alert notification"
echo ""
echo "4. Verify alert shows in AlertManager UI:"
echo "   $ALERTMANAGER_URL/#/alerts"
echo ""

################################################################################
# 14. Environment Variables
################################################################################
section "14. Environment Variables"

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    # Check for SMTP password
    if grep -q "SMTP_PASSWORD=" "$ENV_FILE" 2>/dev/null; then
        pass "SMTP_PASSWORD configured in .env"
    else
        warn "SMTP_PASSWORD not found in .env"
        info "Set SMTP_PASSWORD for email notifications"
    fi

    # Check for Slack webhook (if Slack configured)
    if grep -q "slack_configs:" "$ALERTMANAGER_CONFIG" 2>/dev/null; then
        if grep -q "SLACK_WEBHOOK_URL=" "$ENV_FILE" 2>/dev/null; then
            pass "SLACK_WEBHOOK_URL configured in .env"
        else
            warn "SLACK_WEBHOOK_URL not found in .env"
            info "Set SLACK_WEBHOOK_URL for Slack notifications"
        fi
    fi
else
    warn ".env file not found"
    info "Create .env with SMTP_PASSWORD and other notification credentials"
fi

################################################################################
# 15. Documentation
################################################################################
section "15. Documentation"

# Check for alert runbook
DOCS_DIR="docs"
RUNBOOK_FILES=("$DOCS_DIR/ALERT_RUNBOOK.md" "$DOCS_DIR/operations/ALERT_RUNBOOK.md" "$DOCS_DIR/ALERT_RESPONSE.md")

RUNBOOK_FOUND=false
for runbook in "${RUNBOOK_FILES[@]}"; do
    if [ -f "$runbook" ]; then
        pass "Alert runbook exists: $runbook"
        RUNBOOK_FOUND=true
        break
    fi
done

if [ "$RUNBOOK_FOUND" = false ]; then
    warn "No alert runbook found"
    info "Create docs/ALERT_RUNBOOK.md with response procedures"
fi

# Check for on-call schedule documentation
if [ -f "$DOCS_DIR/ON_CALL_SCHEDULE.md" ]; then
    pass "On-call schedule documented"
elif grep -qi "on-call\|oncall" "$DOCS_DIR"/*.md 2>/dev/null; then
    pass "On-call information found in documentation"
else
    info "On-call schedule not documented"
    info "Create docs/ON_CALL_SCHEDULE.md with rotation schedule"
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
        echo -e "${GREEN}✓ Alert rules and notifications configuration looks excellent!${NC}"
    else
        echo -e "${YELLOW}⚠ Alerts are mostly configured with some improvements needed.${NC}"
    fi
    echo ""
    echo "Alert Management:"
    echo "- Prometheus: $PROMETHEUS_URL/alerts"
    echo "- AlertManager: $ALERTMANAGER_URL/#/alerts"
    echo ""
    echo "Next steps:"
    echo "1. Test alert delivery by triggering a test alert"
    echo "2. Configure Slack notifications (if needed)"
    echo "3. Set up PagerDuty for on-call rotation"
    echo "4. Create alert runbook with response procedures"
    echo "5. Test critical alert escalation path"
    EXIT_CODE=0
else
    echo -e "${RED}✗ Alert rules and notifications issues detected.${NC}"
    echo ""
    echo "Priority actions:"
    echo "1. Fix failed checks above"
    echo "2. Ensure alert rules file is valid YAML"
    echo "3. Configure AlertManager receivers"
    echo "4. Set up email notifications (SMTP)"
    echo "5. Test alert delivery end-to-end"
    EXIT_CODE=1
fi

echo ""
exit $EXIT_CODE
