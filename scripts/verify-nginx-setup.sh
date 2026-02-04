#!/bin/bash

################################################################################
# CCW-Online ERP - Nginx Load Balancer Verification Script (ISS-013)
#
# Purpose: Verify that Nginx reverse proxy is correctly configured
# Usage: ./verify-nginx-setup.sh [frontend_domain] [backend_domain]
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DOMAIN="${1:-ccw-online.com}"
BACKEND_DOMAIN="${2:-api.ccw-online.com}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Functions
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

# Header
echo ""
echo "================================================================="
echo "  CCW-Online ERP - Nginx Load Balancer Verification"
echo "  Date: $(date)"
echo "================================================================="
echo ""
info "Testing configuration:"
echo "  Frontend Domain: $FRONTEND_DOMAIN"
echo "  Backend Domain: $BACKEND_DOMAIN"
echo "  Frontend Port: $FRONTEND_PORT"
echo "  Backend Port: $BACKEND_PORT"
echo ""

# 1. Check if Nginx is installed
info "Checking Nginx Installation..."
if command -v nginx &> /dev/null; then
    NGINX_VERSION=$(nginx -v 2>&1 | awk -F'/' '{print $2}')
    pass "Nginx installed: $NGINX_VERSION"
else
    fail "Nginx not installed"
fi
echo ""

# 2. Check if Nginx is running
info "Checking Nginx Service..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    pass "Nginx service is running"

    # Check if enabled
    if systemctl is-enabled --quiet nginx 2>/dev/null; then
        pass "Nginx service is enabled (starts on boot)"
    else
        warn "Nginx service is not enabled for automatic startup"
    fi
else
    fail "Nginx service is not running"
fi
echo ""

# 3. Check Nginx configuration syntax
info "Checking Nginx Configuration Syntax..."
if sudo nginx -t &> /dev/null; then
    pass "Nginx configuration syntax is valid"
else
    fail "Nginx configuration has syntax errors"
    info "Run: sudo nginx -t"
fi
echo ""

# 4. Check main configuration file
info "Checking Main Configuration File..."
NGINX_CONF="/etc/nginx/nginx.conf"

if [ -f "$NGINX_CONF" ]; then
    pass "Main config file exists: $NGINX_CONF"

    # Check worker processes
    if grep -q "worker_processes" "$NGINX_CONF"; then
        WORKER_PROCESSES=$(grep "worker_processes" "$NGINX_CONF" | awk '{print $2}' | tr -d ';')
        pass "Worker processes configured: $WORKER_PROCESSES"
    else
        warn "Worker processes not explicitly configured"
    fi

    # Check worker connections
    if grep -q "worker_connections" "$NGINX_CONF"; then
        WORKER_CONNECTIONS=$(grep "worker_connections" "$NGINX_CONF" | awk '{print $2}' | tr -d ';')
        pass "Worker connections configured: $WORKER_CONNECTIONS"
    else
        warn "Worker connections not explicitly configured"
    fi

    # Check gzip compression
    if grep -q "gzip on" "$NGINX_CONF"; then
        pass "Gzip compression enabled"
    else
        warn "Gzip compression not enabled"
    fi
else
    fail "Main config file not found: $NGINX_CONF"
fi
echo ""

# 5. Check site configuration
info "Checking Site Configuration..."
SITES_AVAILABLE="/etc/nginx/sites-available"
SITES_ENABLED="/etc/nginx/sites-enabled"

if [ -d "$SITES_AVAILABLE" ]; then
    pass "Sites-available directory exists"

    # Check for CCW configuration
    CCW_CONFIG_COUNT=$(find "$SITES_AVAILABLE" -name "*ccw*" -o -name "*$FRONTEND_DOMAIN*" 2>/dev/null | wc -l)
    if [ "$CCW_CONFIG_COUNT" -gt 0 ]; then
        pass "Found $CCW_CONFIG_COUNT CCW-related configuration file(s)"
    else
        warn "No CCW-related configuration files found"
    fi
else
    warn "Sites-available directory not found"
fi

if [ -d "$SITES_ENABLED" ]; then
    pass "Sites-enabled directory exists"

    # Check for enabled CCW configuration
    CCW_ENABLED_COUNT=$(find "$SITES_ENABLED" -name "*ccw*" -o -name "*$FRONTEND_DOMAIN*" 2>/dev/null | wc -l)
    if [ "$CCW_ENABLED_COUNT" -gt 0 ]; then
        pass "Found $CCW_ENABLED_COUNT enabled CCW configuration(s)"
    else
        warn "No enabled CCW configurations found"
    fi
else
    warn "Sites-enabled directory not found"
fi
echo ""

# 6. Check upstream configuration
info "Checking Upstream Configuration..."

# Check if upstream blocks are defined
if sudo nginx -T 2>/dev/null | grep -q "upstream"; then
    pass "Upstream blocks defined in configuration"

    # Check for Next.js upstream
    if sudo nginx -T 2>/dev/null | grep -q "upstream.*nextjs\|upstream.*frontend"; then
        pass "Frontend (Next.js) upstream configured"

        # Check upstream server
        if sudo nginx -T 2>/dev/null | grep -A 5 "upstream.*nextjs\|upstream.*frontend" | grep -q "server.*$FRONTEND_PORT"; then
            pass "Frontend upstream points to port $FRONTEND_PORT"
        else
            warn "Frontend upstream may not point to expected port $FRONTEND_PORT"
        fi
    else
        warn "Frontend (Next.js) upstream not found"
    fi

    # Check for FastAPI upstream
    if sudo nginx -T 2>/dev/null | grep -q "upstream.*fastapi\|upstream.*backend\|upstream.*api"; then
        pass "Backend (FastAPI) upstream configured"

        # Check upstream server
        if sudo nginx -T 2>/dev/null | grep -A 5 "upstream.*fastapi\|upstream.*backend\|upstream.*api" | grep -q "server.*$BACKEND_PORT"; then
            pass "Backend upstream points to port $BACKEND_PORT"
        else
            warn "Backend upstream may not point to expected port $BACKEND_PORT"
        fi
    else
        warn "Backend (FastAPI) upstream not found"
    fi
else
    warn "No upstream blocks found in configuration"
fi
echo ""

# 7. Check proxy settings
info "Checking Proxy Configuration..."

if sudo nginx -T 2>/dev/null | grep -q "proxy_pass"; then
    pass "Proxy pass directives configured"

    # Check proxy headers
    PROXY_HEADERS=(
        "proxy_set_header Host"
        "proxy_set_header X-Real-IP"
        "proxy_set_header X-Forwarded-For"
        "proxy_set_header X-Forwarded-Proto"
    )

    for header in "${PROXY_HEADERS[@]}"; do
        if sudo nginx -T 2>/dev/null | grep -q "$header"; then
            pass "$header is set"
        else
            warn "$header is not set"
        fi
    done

    # Check proxy timeouts
    if sudo nginx -T 2>/dev/null | grep -q "proxy_connect_timeout\|proxy_read_timeout\|proxy_send_timeout"; then
        pass "Proxy timeouts configured"
    else
        warn "Proxy timeouts not explicitly configured"
    fi
else
    warn "No proxy_pass directives found"
fi
echo ""

# 8. Check rate limiting
info "Checking Rate Limiting Configuration..."

if sudo nginx -T 2>/dev/null | grep -q "limit_req_zone"; then
    pass "Rate limiting zones defined"

    # Count zones
    ZONE_COUNT=$(sudo nginx -T 2>/dev/null | grep -c "limit_req_zone" || echo 0)
    info "Found $ZONE_COUNT rate limiting zone(s)"

    # Check if rate limiting is applied
    if sudo nginx -T 2>/dev/null | grep -q "limit_req zone"; then
        pass "Rate limiting applied to locations"
    else
        warn "Rate limiting zones defined but not applied"
    fi
else
    warn "No rate limiting configured"
fi
echo ""

# 9. Check caching
info "Checking Caching Configuration..."

if sudo nginx -T 2>/dev/null | grep -q "proxy_cache_path"; then
    pass "Proxy cache path configured"

    # Check cache zones
    if sudo nginx -T 2>/dev/null | grep -q "proxy_cache"; then
        pass "Proxy caching enabled"
    fi

    # Check cache validity
    if sudo nginx -T 2>/dev/null | grep -q "proxy_cache_valid"; then
        pass "Cache validity periods configured"
    else
        warn "Cache validity periods not configured"
    fi
else
    warn "No proxy caching configured"
fi
echo ""

# 10. Check WebSocket support
info "Checking WebSocket Support..."

if sudo nginx -T 2>/dev/null | grep -q "Upgrade"; then
    pass "WebSocket Upgrade header configured"

    if sudo nginx -T 2>/dev/null | grep -q "Connection.*upgrade"; then
        pass "WebSocket Connection header configured"
    else
        warn "WebSocket Connection header not found"
    fi
else
    warn "WebSocket support not configured (required for Next.js HMR)"
fi
echo ""

# 11. Check SSL/TLS integration
info "Checking SSL/TLS Integration..."

if sudo nginx -T 2>/dev/null | grep -q "ssl_certificate"; then
    pass "SSL certificates configured"

    # Check SSL protocols
    if sudo nginx -T 2>/dev/null | grep -q "ssl_protocols.*TLSv1.2\|ssl_protocols.*TLSv1.3"; then
        pass "Modern TLS protocols configured"
    else
        warn "TLS protocol configuration may be outdated"
    fi

    # Check SSL session cache
    if sudo nginx -T 2>/dev/null | grep -q "ssl_session_cache"; then
        pass "SSL session cache configured"
    else
        warn "SSL session cache not configured (performance impact)"
    fi
else
    warn "SSL certificates not configured in Nginx"
fi
echo ""

# 12. Check security headers
info "Checking Security Headers..."

SECURITY_HEADERS=(
    "Strict-Transport-Security"
    "X-Frame-Options"
    "X-Content-Type-Options"
    "X-XSS-Protection"
)

for header in "${SECURITY_HEADERS[@]}"; do
    if sudo nginx -T 2>/dev/null | grep -q "add_header $header"; then
        pass "$header configured"
    else
        warn "$header not configured"
    fi
done
echo ""

# 13. Check logging
info "Checking Logging Configuration..."

# Check access log
if sudo nginx -T 2>/dev/null | grep -q "access_log"; then
    pass "Access logging configured"

    ACCESS_LOG_PATH=$(sudo nginx -T 2>/dev/null | grep "access_log" | head -1 | awk '{print $2}' | tr -d ';')
    if [ -f "$ACCESS_LOG_PATH" ]; then
        pass "Access log file exists: $ACCESS_LOG_PATH"
    fi
else
    warn "Access logging not explicitly configured"
fi

# Check error log
if sudo nginx -T 2>/dev/null | grep -q "error_log"; then
    pass "Error logging configured"

    ERROR_LOG_PATH=$(sudo nginx -T 2>/dev/null | grep "error_log" | head -1 | awk '{print $2}' | tr -d ';')
    if [ -f "$ERROR_LOG_PATH" ]; then
        pass "Error log file exists: $ERROR_LOG_PATH"
    fi
else
    warn "Error logging not explicitly configured"
fi
echo ""

# 14. Check health check endpoint
info "Checking Health Check Endpoints..."

# Check if health check locations are defined
if sudo nginx -T 2>/dev/null | grep -q "location.*health\|location.*/api/health"; then
    pass "Health check endpoint configured"
else
    warn "Health check endpoint not found"
fi
echo ""

# 15. Check log rotation
info "Checking Log Rotation..."

if [ -f "/etc/logrotate.d/nginx" ]; then
    pass "Nginx log rotation configured"

    # Check rotation settings
    if grep -q "daily\|weekly" "/etc/logrotate.d/nginx"; then
        pass "Log rotation frequency configured"
    fi

    if grep -q "rotate" "/etc/logrotate.d/nginx"; then
        ROTATE_COUNT=$(grep "rotate" "/etc/logrotate.d/nginx" | awk '{print $2}')
        pass "Logs retained for $ROTATE_COUNT rotations"
    fi
else
    warn "Nginx log rotation not configured"
fi
echo ""

# 16. Check upstream health
info "Checking Upstream Services..."

# Check if frontend service is running
if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    pass "Frontend service responding on port $FRONTEND_PORT"
else
    warn "Frontend service not responding on port $FRONTEND_PORT"
fi

# Check if backend service is running
if curl -sf "http://localhost:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
    pass "Backend service responding on port $BACKEND_PORT"
else
    warn "Backend service not responding on port $BACKEND_PORT"
fi
echo ""

# 17. Check listen directives
info "Checking Listen Directives..."

if sudo nginx -T 2>/dev/null | grep -q "listen 80"; then
    pass "HTTP (port 80) listener configured"
fi

if sudo nginx -T 2>/dev/null | grep -q "listen 443"; then
    pass "HTTPS (port 443) listener configured"
fi

if sudo nginx -T 2>/dev/null | grep -q "listen.*http2"; then
    pass "HTTP/2 enabled"
else
    warn "HTTP/2 not enabled (performance impact)"
fi
echo ""

# 18. Check keepalive connections
info "Checking Keepalive Configuration..."

if sudo nginx -T 2>/dev/null | grep -q "keepalive_timeout"; then
    KEEPALIVE_TIMEOUT=$(sudo nginx -T 2>/dev/null | grep "keepalive_timeout" | head -1 | awk '{print $2}' | tr -d ';')
    pass "Keepalive timeout configured: $KEEPALIVE_TIMEOUT"
fi

if sudo nginx -T 2>/dev/null | grep -q "keepalive.*;" | grep "upstream" -A 10; then
    pass "Upstream keepalive connections configured"
else
    warn "Upstream keepalive not configured (performance impact)"
fi
echo ""

# 19. Check buffer sizes
info "Checking Buffer Configuration..."

BUFFER_DIRECTIVES=(
    "client_body_buffer_size"
    "client_max_body_size"
    "proxy_buffer_size"
    "proxy_buffers"
)

for directive in "${BUFFER_DIRECTIVES[@]}"; do
    if sudo nginx -T 2>/dev/null | grep -q "$directive"; then
        VALUE=$(sudo nginx -T 2>/dev/null | grep "$directive" | head -1 | awk '{print $2}' | tr -d ';')
        pass "$directive: $VALUE"
    fi
done
echo ""

# 20. Check reload capability
info "Checking Nginx Reload Capability..."

if sudo nginx -t &> /dev/null; then
    if sudo systemctl reload nginx &> /dev/null; then
        pass "Nginx can reload configuration without downtime"
    else
        warn "Nginx reload failed (may require restart)"
    fi
else
    fail "Cannot reload due to configuration errors"
fi
echo ""

# Summary
echo "================================================================="
echo "  Verification Summary"
echo "================================================================="
echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

# Recommendations
if [ $FAILED -eq 0 ] && [ $WARNINGS -lt 5 ]; then
    echo -e "${GREEN}✓ Nginx load balancer configuration looks good!${NC}"
    echo ""
    info "Next steps:"
    echo "  1. Configure domain DNS to point to this server"
    echo "  2. Deploy application services (frontend + backend)"
    echo "  3. Test full request flow"
    echo "  4. Monitor logs for issues"
    echo ""
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Nginx is configured but has some warnings.${NC}"
    echo ""
    warn "Review warnings above and improve configuration if needed."
    exit 0
else
    echo -e "${RED}✗ Nginx configuration has issues.${NC}"
    echo ""
    fail "Critical issues found. Please review failed checks above."
    exit 1
fi
