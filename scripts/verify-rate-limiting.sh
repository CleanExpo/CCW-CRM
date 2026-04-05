#!/usr/bin/env bash
#
# ISS-027 Verification: Implement API Rate Limiting
#
# This script verifies that API rate limiting infrastructure is properly configured
# including slowapi middleware, rate limit configurations, authentication endpoint
# protection, Redis support, and proper error handling for production deployment.
#
# Usage:
#   ./scripts/verify-rate-limiting.sh
#
# Exit codes:
#   0 - All checks passed or warnings only
#   1 - Critical failures detected

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL_COUNT++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN_COUNT++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
}

# Banner
echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                                                                    ║"
echo "║     ISS-027 VERIFICATION: Implement API Rate Limiting             ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 1. RATE LIMIT MIDDLEWARE FILE
# ============================================================================
section "1. Rate Limit Middleware File"

RATE_LIMIT_FILE="backend/src/api/middleware/rate_limit.py"

if [[ -f "$RATE_LIMIT_FILE" ]]; then
    pass "Rate limit middleware exists ($RATE_LIMIT_FILE)"

    # Check for slowapi import
    if grep -q "from slowapi import Limiter" "$RATE_LIMIT_FILE"; then
        pass "slowapi Limiter imported"
    else
        fail "Missing slowapi Limiter import"
    fi

    # Check for limiter instance
    if grep -q "limiter = Limiter" "$RATE_LIMIT_FILE"; then
        pass "Limiter instance created"
    else
        fail "Limiter instance not created"
    fi

    # Check for rate limit key function
    if grep -q "def get_rate_limit_key" "$RATE_LIMIT_FILE"; then
        pass "Rate limit key function exists"
    else
        fail "Missing rate limit key function"
    fi

    # Check for RateLimits class
    if grep -q "class RateLimits" "$RATE_LIMIT_FILE"; then
        pass "RateLimits configuration class exists"
    else
        fail "Missing RateLimits configuration class"
    fi

else
    fail "Rate limit middleware not found ($RATE_LIMIT_FILE)"
fi

# ============================================================================
# 2. SLOWAPI DEPENDENCY
# ============================================================================
section "2. slowapi Dependency"

if [[ -f "backend/pyproject.toml" ]]; then
    if grep -q "slowapi" backend/pyproject.toml; then
        pass "slowapi dependency listed in pyproject.toml"
    else
        fail "slowapi not in dependencies"
    fi
fi

# Check if slowapi is importable
if command -v python3 &> /dev/null; then
    if python3 -c "import slowapi" 2>/dev/null; then
        pass "slowapi module is importable"
    else
        warn "slowapi not installed (run: uv sync)"
    fi
fi

# ============================================================================
# 3. RATE LIMIT CONFIGURATIONS
# ============================================================================
section "3. Rate Limit Configurations"

if [[ -f "$RATE_LIMIT_FILE" ]]; then
    info "Checking rate limit configurations..."

    # Check for LOGIN rate limit
    if grep -q 'LOGIN.*=.*".*minute"' "$RATE_LIMIT_FILE"; then
        LOGIN_LIMIT=$(grep 'LOGIN.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "LOGIN rate limit configured: $LOGIN_LIMIT"
    else
        fail "Missing LOGIN rate limit"
    fi

    # Check for PASSWORD_RESET rate limit
    if grep -q 'PASSWORD_RESET.*=.*".*hour"' "$RATE_LIMIT_FILE"; then
        RESET_LIMIT=$(grep 'PASSWORD_RESET.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "PASSWORD_RESET rate limit configured: $RESET_LIMIT"
    else
        fail "Missing PASSWORD_RESET rate limit"
    fi

    # Check for REFRESH rate limit
    if grep -q 'REFRESH.*=.*".*minute"' "$RATE_LIMIT_FILE"; then
        REFRESH_LIMIT=$(grep 'REFRESH.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "REFRESH rate limit configured: $REFRESH_LIMIT"
    else
        fail "Missing REFRESH rate limit"
    fi

    # Check for READ rate limit
    if grep -q 'READ.*=.*".*minute"' "$RATE_LIMIT_FILE"; then
        READ_LIMIT=$(grep 'READ.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "READ rate limit configured: $READ_LIMIT"
    else
        warn "Missing READ rate limit (optional)"
    fi

    # Check for WRITE rate limit
    if grep -q 'WRITE.*=.*".*minute"' "$RATE_LIMIT_FILE"; then
        WRITE_LIMIT=$(grep 'WRITE.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "WRITE rate limit configured: $WRITE_LIMIT"
    else
        warn "Missing WRITE rate limit (optional)"
    fi

    # Check for DELETE rate limit
    if grep -q 'DELETE.*=.*".*minute"' "$RATE_LIMIT_FILE"; then
        DELETE_LIMIT=$(grep 'DELETE.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "DELETE rate limit configured: $DELETE_LIMIT"
    else
        warn "Missing DELETE rate limit (optional)"
    fi

    # Check for PUBLIC rate limit
    if grep -q 'PUBLIC.*=.*".*minute"' "$RATE_LIMIT_FILE"; then
        PUBLIC_LIMIT=$(grep 'PUBLIC.*=' "$RATE_LIMIT_FILE" | grep -o '"[^"]*"' | head -1)
        pass "PUBLIC rate limit configured: $PUBLIC_LIMIT"
    else
        warn "Missing PUBLIC rate limit (optional)"
    fi

fi

# ============================================================================
# 4. AUTHENTICATION ENDPOINT PROTECTION
# ============================================================================
section "4. Authentication Endpoint Protection"

AUTH_FILE="backend/src/api/routes/demo_auth.py"

if [[ -f "$AUTH_FILE" ]]; then
    pass "Authentication routes file exists"

    # Check for rate limit import
    if grep -q "from src.api.middleware.rate_limit import.*limiter" "$AUTH_FILE"; then
        pass "Rate limiter imported in auth routes"
    else
        fail "Rate limiter not imported in auth routes"
    fi

    # Check for @limiter.limit decorator on login
    if grep -B5 "^async def login" "$AUTH_FILE" | grep -q "@limiter.limit"; then
        pass "Login endpoint has rate limiting"
    else
        fail "Login endpoint missing rate limiting"
    fi

    # Check for @limiter.limit on refresh
    if grep -B5 "^async def refresh" "$AUTH_FILE" | grep -q "@limiter.limit"; then
        pass "Refresh token endpoint has rate limiting"
    else
        warn "Refresh token endpoint missing rate limiting"
    fi

    # Check for @limiter.limit on password reset
    if grep -B5 "^async def forgot_password\|^async def reset_password" "$AUTH_FILE" | grep -q "@limiter.limit"; then
        pass "Password reset endpoints have rate limiting"
    else
        warn "Password reset endpoints missing rate limiting"
    fi

else
    fail "Authentication routes file not found ($AUTH_FILE)"
fi

# ============================================================================
# 5. USER-BASED VS IP-BASED RATE LIMITING
# ============================================================================
section "5. User-Based vs IP-Based Rate Limiting"

if [[ -f "$RATE_LIMIT_FILE" ]]; then
    # Check for user_id based rate limiting
    if grep -q "user_id\|user:" "$RATE_LIMIT_FILE"; then
        pass "User-based rate limiting implemented (authenticated users)"
    else
        warn "User-based rate limiting may not be implemented"
    fi

    # Check for IP-based rate limiting
    if grep -q "get_remote_address\|ip:" "$RATE_LIMIT_FILE"; then
        pass "IP-based rate limiting implemented (unauthenticated users)"
    else
        warn "IP-based rate limiting may not be implemented"
    fi

    # Check for differentiation logic
    if grep -q "auth_token\|if.*authenticated" "$RATE_LIMIT_FILE"; then
        pass "Different limits for authenticated vs unauthenticated users"
    else
        warn "No differentiation between authenticated and unauthenticated"
    fi
fi

# ============================================================================
# 6. REDIS SUPPORT FOR DISTRIBUTED RATE LIMITING
# ============================================================================
section "6. Redis Support for Distributed Rate Limiting"

if [[ -f "$RATE_LIMIT_FILE" ]]; then
    # Check for Redis URI configuration
    if grep -q "redis://\|storage_uri" "$RATE_LIMIT_FILE"; then
        pass "Redis storage URI configured"

        # Check if memory:// is used (development)
        if grep -q 'storage_uri.*=.*"memory://"' "$RATE_LIMIT_FILE"; then
            warn "Using in-memory storage (for production: use Redis)"
            info "Update storage_uri to: redis://localhost:6379"
        fi

        # Check if redis:// is commented/documented
        if grep -q "redis://localhost:6379" "$RATE_LIMIT_FILE"; then
            pass "Redis connection string documented"
        fi
    else
        warn "Redis storage URI not configured"
    fi

    # Check for Redis dependency
    if [[ -f "backend/pyproject.toml" ]]; then
        if grep -q "redis" backend/pyproject.toml; then
            pass "Redis Python client in dependencies"
        else
            warn "Redis client not in dependencies (needed for distributed rate limiting)"
        fi
    fi
fi

# ============================================================================
# 7. RATE LIMIT ENABLED IN SETTINGS
# ============================================================================
section "7. Rate Limit Enabled in Settings"

SETTINGS_FILE="backend/src/config/settings.py"

if [[ -f "$SETTINGS_FILE" ]]; then
    if grep -q "rate_limit_enabled\|RATE_LIMIT_ENABLED" "$SETTINGS_FILE"; then
        pass "Rate limit enabled setting exists"

        # Check default value
        if grep -q "rate_limit_enabled.*=.*True" "$SETTINGS_FILE"; then
            pass "Rate limiting enabled by default"
        else
            warn "Rate limiting may be disabled by default"
        fi
    else
        warn "Rate limit enabled setting not found"
        info "Add: rate_limit_enabled: bool = True"
    fi
else
    warn "Settings file not found ($SETTINGS_FILE)"
fi

# Check environment variable documentation
if [[ -f ".env.example" ]]; then
    if grep -q "RATE_LIMIT_ENABLED" .env.example; then
        pass "RATE_LIMIT_ENABLED documented in .env.example"
    else
        info "Consider adding RATE_LIMIT_ENABLED to .env.example"
    fi
fi

# ============================================================================
# 8. RATE LIMIT ERROR HANDLER
# ============================================================================
section "8. Rate Limit Error Handler"

MAIN_FILE="backend/src/api/main.py"

if [[ -f "$MAIN_FILE" ]]; then
    # Check for RateLimitExceeded import
    if grep -q "from slowapi.errors import RateLimitExceeded" "$MAIN_FILE"; then
        pass "RateLimitExceeded error class imported"
    else
        warn "RateLimitExceeded not imported"
    fi

    # Check for rate limit exceeded handler
    if grep -q "_rate_limit_exceeded_handler\|rate_limit_exceeded" "$MAIN_FILE"; then
        pass "Rate limit exceeded handler registered"
    else
        warn "Rate limit exceeded handler not registered"
        info "Add: app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)"
    fi

    # Check for limiter state
    if grep -q "app.state.limiter\|limiter" "$MAIN_FILE"; then
        pass "Limiter attached to app state"
    else
        warn "Limiter may not be attached to app"
    fi
fi

# ============================================================================
# 9. RATE LIMIT HEADERS
# ============================================================================
section "9. Rate Limit Headers"

info "Checking for rate limit response headers documentation..."

# Check if headers are documented anywhere
if grep -r "X-RateLimit\|X-Rate-Limit" docs/ 2>/dev/null | grep -q "."; then
    pass "Rate limit headers documented"
else
    info "Rate limit headers not explicitly documented"
    info "slowapi automatically adds: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
fi

# ============================================================================
# 10. RATE LIMIT BYPASS FOR HEALTH CHECKS
# ============================================================================
section "10. Rate Limit Bypass for Health Checks"

HEALTH_FILE="backend/src/api/routes/health.py"

if [[ -f "$HEALTH_FILE" ]]; then
    # Check if health endpoints have rate limiting
    if grep -q "@limiter" "$HEALTH_FILE"; then
        warn "Health endpoints have rate limiting (may cause monitoring issues)"
        info "Health endpoints should typically be exempt from rate limiting"
    else
        pass "Health endpoints exempt from rate limiting (recommended)"
    fi
fi

# ============================================================================
# 11. MEMORY VS REDIS STORAGE
# ============================================================================
section "11. Memory vs Redis Storage"

if [[ -f "$RATE_LIMIT_FILE" ]]; then
    if grep -q 'storage_uri.*=.*"memory://"' "$RATE_LIMIT_FILE"; then
        warn "Using in-memory storage (NOT suitable for production)"
        info "In-memory storage issues:"
        info "  - Rate limits reset on app restart"
        info "  - Doesn't work with multiple workers/servers"
        info "  - Not persistent across deployments"
        info ""
        info "For production, use Redis:"
        info '  storage_uri="redis://localhost:6379/0"'
    elif grep -q 'storage_uri.*=.*"redis://' "$RATE_LIMIT_FILE"; then
        pass "Using Redis storage (production-ready)"
    else
        warn "Storage URI configuration unclear"
    fi
fi

# ============================================================================
# 12. RATE LIMITING DOCUMENTATION
# ============================================================================
section "12. Rate Limiting Documentation"

# Check for API documentation
if [[ -f "docs/api/API-DOCUMENTATION.md" ]]; then
    if grep -q "Rate Limit\|rate limit" docs/api/API-DOCUMENTATION.md; then
        pass "Rate limiting documented in API docs"
    else
        warn "Rate limiting not documented in API docs"
    fi
fi

# Check for security documentation
if [[ -f "docs/SECURITY_HARDENING_COMPLETE.md" ]]; then
    if grep -q "ISS-027\|Rate Limiting" docs/SECURITY_HARDENING_COMPLETE.md; then
        pass "Rate limiting mentioned in security hardening docs"
    else
        info "Rate limiting not in security hardening docs"
    fi
fi

# ============================================================================
# 13. RATE LIMIT TESTING
# ============================================================================
section "13. Rate Limit Testing"

info "Checking for rate limit tests..."

if [[ -d "backend/tests" ]]; then
    # Check for rate limit tests
    if find backend/tests -name "*rate*" -o -name "*limit*" 2>/dev/null | grep -q "."; then
        pass "Rate limit test files found"
    else
        warn "No dedicated rate limit tests found"
        info "Consider adding tests for rate limiting behavior"
    fi

    # Check for test imports
    if grep -r "limiter\|RateLimits" backend/tests/ 2>/dev/null | grep -q "."; then
        pass "Rate limit testing references found"
    else
        info "Rate limit testing may not be comprehensive"
    fi
fi

# ============================================================================
# 14. PRODUCTION CONFIGURATION
# ============================================================================
section "14. Production Configuration"

if [[ -f ".env.example" ]]; then
    # Check for rate limit settings
    if grep -q "RATE_LIMIT\|rate_limit" .env.example; then
        pass "Rate limit settings in production environment template"
    else
        warn "Rate limit settings not in production template"
    fi

    # Check for Redis URL
    if grep -q "REDIS_URL" .env.example; then
        pass "Redis URL in production environment template"
    else
        warn "Redis URL not in production template"
    fi
fi

# ============================================================================
# 15. RATE LIMIT OBSERVABILITY
# ============================================================================
section "15. Rate Limit Observability"

info "Checking for rate limit monitoring and logging..."

# Check for logging in rate limit middleware
if [[ -f "$RATE_LIMIT_FILE" ]]; then
    if grep -q "logger\|logging" "$RATE_LIMIT_FILE"; then
        pass "Logging configured in rate limit middleware"
    else
        info "No explicit logging in rate limit middleware"
        info "Consider adding logging for rate limit violations"
    fi
fi

# Check for monitoring documentation
if [[ -f "docs/PRODUCTION_RUNBOOK.md" ]]; then
    if grep -q "rate limit\|Rate Limit" docs/PRODUCTION_RUNBOOK.md; then
        pass "Rate limiting mentioned in production runbook"
    else
        info "Rate limiting not explicitly in production runbook"
    fi
fi

# ============================================================================
# 16. COMMON RATE LIMIT BYPASS ATTEMPTS
# ============================================================================
section "16. Common Rate Limit Bypass Prevention"

info "Checking for rate limit bypass prevention..."

if [[ -f "$RATE_LIMIT_FILE" ]]; then
    # Check if using user_id prevents IP switching bypass
    if grep -q "user_id" "$RATE_LIMIT_FILE"; then
        pass "User-based limiting prevents IP switching bypass"
    else
        warn "May be vulnerable to IP switching bypass"
    fi

    # Check if IP-based has proxy/CDN protection
    if grep -q "X-Forwarded-For\|X-Real-IP" "$RATE_LIMIT_FILE"; then
        info "Using forwarded IP headers (ensure proxy is trusted)"
    fi

    # Check for rate limit key hashing/obfuscation
    if grep -q "f\"user:\|f\"ip:" "$RATE_LIMIT_FILE"; then
        pass "Rate limit keys are namespaced (user:xxx, ip:xxx)"
    fi
fi

# ============================================================================
# 17. PRODUCTION READINESS CHECKLIST
# ============================================================================
section "17. Production Readiness Checklist"

echo ""
echo "Production Readiness Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CRITICAL_CHECKS=(
    "$RATE_LIMIT_FILE:Rate limit middleware exists"
    "slowapi:slowapi dependency installed"
    "@limiter.limit:Rate limits applied to auth endpoints"
)

CRITICAL_PASS=0
CRITICAL_TOTAL=${#CRITICAL_CHECKS[@]}

for check in "${CRITICAL_CHECKS[@]}"; do
    pattern="${check%%:*}"
    desc="${check#*:}"

    if [[ -f "$pattern" ]] || grep -r "$pattern" backend/src 2>/dev/null | grep -q "."; then
        echo -e "${GREEN}✓${NC} $desc"
        ((CRITICAL_PASS++))
    else
        echo -e "${RED}✗${NC} $desc"
    fi
done

echo ""
if [[ $CRITICAL_PASS -eq $CRITICAL_TOTAL ]]; then
    echo -e "${GREEN}✓ CRITICAL CHECKS: $CRITICAL_PASS/$CRITICAL_TOTAL PASSED${NC}"
else
    echo -e "${RED}✗ CRITICAL CHECKS: $CRITICAL_PASS/$CRITICAL_TOTAL PASSED${NC}"
fi

# Production recommendations
echo ""
echo "Production Recommendations:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RECOMMENDATIONS=(
    "Use Redis storage instead of memory://"
    "Configure RATE_LIMIT_ENABLED in environment"
    "Add rate limit monitoring and alerts"
    "Document rate limits in API documentation"
    "Test rate limiting with load testing tools"
    "Configure lower limits for public endpoints"
    "Set up rate limit metrics in monitoring"
)

for rec in "${RECOMMENDATIONS[@]}"; do
    echo -e "${YELLOW}○${NC} $rec"
done

# ============================================================================
# FINAL SUMMARY
# ============================================================================
section "FINAL SUMMARY"

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                       VERIFICATION RESULTS                         ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${GREEN}Passed:${NC}  $PASS_COUNT"
echo -e "  ${YELLOW}Warnings:${NC} $WARN_COUNT"
echo -e "  ${RED}Failed:${NC}  $FAIL_COUNT"
echo ""

if [[ $FAIL_COUNT -eq 0 ]]; then
    if [[ $WARN_COUNT -eq 0 ]]; then
        echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
        echo ""
        echo "🎉 API rate limiting infrastructure is fully configured!"
        echo ""
        echo "Next steps:"
        echo "  1. Switch to Redis storage for production"
        echo "  2. Configure rate limits in environment variables"
        echo "  3. Add rate limit monitoring to dashboards"
        echo "  4. Document rate limits in API documentation"
        echo "  5. Perform load testing to validate limits"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚠ PASSED WITH WARNINGS${NC}"
        echo ""
        echo "✓ Core rate limiting is configured"
        echo "⚠ Some optimizations recommended - review warnings above"
        echo ""
        echo "Key recommendations:"
        echo "  1. Switch from memory:// to Redis storage for production"
        echo "  2. Add rate limit monitoring and alerting"
        echo "  3. Document rate limits in API docs"
        echo "  4. Add comprehensive rate limit testing"
        echo ""
        exit 0
    fi
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo ""
    echo "Critical issues detected. Fix the following:"
    echo "  - Review failed checks above"
    echo "  - Ensure rate limit middleware exists"
    echo "  - Apply rate limits to authentication endpoints"
    echo "  - Configure slowapi dependency"
    echo "  - Run verification again after fixes"
    echo ""
    exit 1
fi
