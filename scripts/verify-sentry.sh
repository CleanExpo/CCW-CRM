#!/usr/bin/env bash
#
# Sentry Error Tracking Verification Script
# ISS-021: Integrate Sentry Error Tracking
#
# This script verifies comprehensive Sentry error tracking configuration:
# - Backend Sentry SDK installation and configuration
# - Frontend Sentry SDK installation and configuration
# - Error tracking functionality
# - Release tracking and source maps
# - Performance monitoring
# - Alert integration with Prometheus/AlertManager
# - Production deployment readiness
#
# Usage:
#   ./scripts/verify-sentry.sh
#   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx ./scripts/verify-sentry.sh

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
SENTRY_DSN="${SENTRY_DSN:-}"
FRONTEND_DIR="${FRONTEND_DIR:-apps/web}"
BACKEND_DIR="${BACKEND_DIR:-apps/backend}"

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
# 1. Backend Sentry SDK Installation
# ============================================================================

section "1. Backend Sentry SDK Installation"

if [ -f "$BACKEND_DIR/pyproject.toml" ]; then
    if grep -q "sentry-sdk" "$BACKEND_DIR/pyproject.toml"; then
        pass "Backend: sentry-sdk listed in pyproject.toml"

        # Check version
        version=$(grep "sentry-sdk" "$BACKEND_DIR/pyproject.toml" | head -1)
        info "   Version: $version"
    else
        fail "Backend: sentry-sdk NOT found in pyproject.toml"
        info "   Install: cd $BACKEND_DIR && uv add sentry-sdk[fastapi]"
    fi
else
    fail "Backend: pyproject.toml not found at $BACKEND_DIR/pyproject.toml"
fi

# Check if Sentry is importable in Python
if command -v python3 &> /dev/null; then
    if python3 -c "import sentry_sdk" 2>/dev/null; then
        pass "Backend: sentry-sdk is importable in Python"
    else
        warn "Backend: sentry-sdk not importable (may need: uv sync)"
    fi
else
    warn "Backend: Python3 not found in PATH"
fi

# ============================================================================
# 2. Frontend Sentry SDK Installation
# ============================================================================

section "2. Frontend Sentry SDK Installation"

if [ -f "$FRONTEND_DIR/package.json" ]; then
    if grep -q "@sentry/nextjs" "$FRONTEND_DIR/package.json"; then
        pass "Frontend: @sentry/nextjs listed in package.json"

        # Check version
        version=$(grep "@sentry/nextjs" "$FRONTEND_DIR/package.json" | head -1)
        info "   Version: $version"
    else
        fail "Frontend: @sentry/nextjs NOT found in package.json"
        info "   Install: pnpm add @sentry/nextjs --filter=web"
    fi
else
    fail "Frontend: package.json not found at $FRONTEND_DIR/package.json"
fi

# Check for React SDK (alternative)
if [ -f "$FRONTEND_DIR/package.json" ]; then
    if grep -q "@sentry/react" "$FRONTEND_DIR/package.json"; then
        pass "Frontend: @sentry/react listed in package.json"
    fi
fi

# ============================================================================
# 3. Backend Sentry Configuration
# ============================================================================

section "3. Backend Sentry Configuration"

# Check for Sentry initialization in main.py
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "sentry_sdk.init" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Sentry initialization found in main.py"
    else
        fail "Backend: Sentry initialization NOT found in main.py"
        info "   Add: import sentry_sdk and sentry_sdk.init(...)"
    fi

    if grep -q "import sentry_sdk" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: sentry_sdk imported in main.py"
    else
        warn "Backend: sentry_sdk import not found in main.py"
    fi
else
    fail "Backend: main.py not found at $BACKEND_DIR/src/api/main.py"
fi

# Check for Sentry config in settings
if [ -f "$BACKEND_DIR/src/config/settings.py" ]; then
    if grep -q "sentry_dsn\|SENTRY_DSN" "$BACKEND_DIR/src/config/settings.py"; then
        pass "Backend: SENTRY_DSN configured in settings.py"
    else
        warn "Backend: SENTRY_DSN not found in settings.py"
        info "   Add: sentry_dsn: str = Field(default='', description='Sentry DSN')"
    fi

    if grep -q "sentry_environment\|SENTRY_ENVIRONMENT" "$BACKEND_DIR/src/config/settings.py"; then
        pass "Backend: SENTRY_ENVIRONMENT configured"
    else
        warn "Backend: SENTRY_ENVIRONMENT not configured"
    fi
else
    warn "Backend: settings.py not found"
fi

# ============================================================================
# 4. Frontend Sentry Configuration
# ============================================================================

section "4. Frontend Sentry Configuration"

# Check for Sentry config files
if [ -f "$FRONTEND_DIR/sentry.client.config.ts" ]; then
    pass "Frontend: sentry.client.config.ts exists"

    if grep -q "Sentry.init" "$FRONTEND_DIR/sentry.client.config.ts"; then
        pass "Frontend: Sentry.init found in client config"
    else
        warn "Frontend: Sentry.init not found in client config"
    fi
else
    fail "Frontend: sentry.client.config.ts NOT found"
    info "   Create: $FRONTEND_DIR/sentry.client.config.ts"
fi

if [ -f "$FRONTEND_DIR/sentry.server.config.ts" ]; then
    pass "Frontend: sentry.server.config.ts exists"

    if grep -q "Sentry.init" "$FRONTEND_DIR/sentry.server.config.ts"; then
        pass "Frontend: Sentry.init found in server config"
    else
        warn "Frontend: Sentry.init not found in server config"
    fi
else
    fail "Frontend: sentry.server.config.ts NOT found"
    info "   Create: $FRONTEND_DIR/sentry.server.config.ts"
fi

if [ -f "$FRONTEND_DIR/sentry.edge.config.ts" ]; then
    pass "Frontend: sentry.edge.config.ts exists"
else
    warn "Frontend: sentry.edge.config.ts not found (optional)"
fi

# Check for instrumentation hook
if [ -f "$FRONTEND_DIR/instrumentation.ts" ]; then
    pass "Frontend: instrumentation.ts exists"
else
    warn "Frontend: instrumentation.ts not found (recommended for server-side)"
fi

# ============================================================================
# 5. Environment Variables
# ============================================================================

section "5. Environment Variables"

# Check .env.production.example
if [ -f ".env.production.example" ]; then
    if grep -q "SENTRY_DSN" ".env.production.example"; then
        pass "SENTRY_DSN defined in .env.production.example"
    else
        warn "SENTRY_DSN not found in .env.production.example"
    fi
else
    warn ".env.production.example not found"
fi

# Check if SENTRY_DSN is set in environment
if [ -n "$SENTRY_DSN" ]; then
    pass "SENTRY_DSN environment variable is set"

    # Validate DSN format
    if [[ "$SENTRY_DSN" =~ ^https://[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io/[0-9]+$ ]]; then
        pass "SENTRY_DSN format is valid"
    else
        warn "SENTRY_DSN format may be invalid"
        info "   Expected: https://<key>@<org>.ingest.sentry.io/<project>"
    fi
else
    warn "SENTRY_DSN environment variable is NOT set"
    info "   Set: export SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx"
fi

# Check for other Sentry env vars
if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
    pass "SENTRY_AUTH_TOKEN is set (for source maps upload)"
else
    warn "SENTRY_AUTH_TOKEN not set (needed for source maps)"
    info "   Set: export SENTRY_AUTH_TOKEN=<your-auth-token>"
fi

if [ -n "${SENTRY_ORG:-}" ]; then
    pass "SENTRY_ORG is set"
else
    warn "SENTRY_ORG not set (optional but recommended)"
fi

if [ -n "${SENTRY_PROJECT:-}" ]; then
    pass "SENTRY_PROJECT is set"
else
    warn "SENTRY_PROJECT not set (optional but recommended)"
fi

# ============================================================================
# 6. Release Tracking Configuration
# ============================================================================

section "6. Release Tracking Configuration"

# Check for release configuration in Sentry configs
found_release=false

if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "release=" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Release tracking configured in main.py"
        found_release=true
    fi
fi

if [ -f "$FRONTEND_DIR/sentry.client.config.ts" ]; then
    if grep -q "release:" "$FRONTEND_DIR/sentry.client.config.ts"; then
        pass "Frontend: Release tracking configured in client config"
        found_release=true
    fi
fi

if [ "$found_release" = false ]; then
    warn "Release tracking not configured"
    info "   Add: release: process.env.NEXT_PUBLIC_RELEASE"
    info "   Add: release=os.getenv('RELEASE', 'development')"
fi

# Check for Git integration
if [ -d ".git" ]; then
    pass "Git repository detected (can use git commit SHA for releases)"

    current_commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    info "   Current commit: ${current_commit:0:8}"
else
    warn "Not a Git repository"
fi

# ============================================================================
# 7. Source Maps Configuration
# ============================================================================

section "7. Source Maps Configuration"

# Check Next.js config for source maps
if [ -f "$FRONTEND_DIR/next.config.mjs" ] || [ -f "$FRONTEND_DIR/next.config.js" ]; then
    config_file="$FRONTEND_DIR/next.config.mjs"
    [ -f "$FRONTEND_DIR/next.config.js" ] && config_file="$FRONTEND_DIR/next.config.js"

    if grep -q "productionBrowserSourceMaps\|sentry" "$config_file"; then
        pass "Frontend: Source maps configuration found in next.config"
    else
        warn "Frontend: Source maps not configured in next.config"
        info "   Add: productionBrowserSourceMaps: true"
    fi

    if grep -q "@sentry/nextjs" "$config_file" || grep -q "withSentryConfig" "$config_file"; then
        pass "Frontend: Sentry Next.js plugin configured"
    else
        warn "Frontend: Sentry Next.js plugin not configured"
        info "   Wrap: export default withSentryConfig(nextConfig, sentryOptions)"
    fi
else
    warn "Frontend: next.config file not found"
fi

# Check for sentry.properties (for CLI configuration)
if [ -f ".sentryclirc" ] || [ -f "sentry.properties" ]; then
    pass "Sentry CLI configuration file exists"
else
    warn "Sentry CLI configuration not found"
    info "   Create: .sentryclirc or sentry.properties"
fi

# Check build scripts for source maps upload
if [ -f "$FRONTEND_DIR/package.json" ]; then
    if grep -q "sentry:sourcemaps\|sentry-cli" "$FRONTEND_DIR/package.json"; then
        pass "Frontend: Source maps upload script configured"
    else
        warn "Frontend: Source maps upload not configured in package.json"
        info "   Add script: sentry-cli sourcemaps upload"
    fi
fi

# ============================================================================
# 8. Error Tracking Functionality
# ============================================================================

section "8. Error Tracking Functionality"

# Check for error boundary in frontend
if [ -d "$FRONTEND_DIR/components" ]; then
    if find "$FRONTEND_DIR/components" -name "*error*" -o -name "*ErrorBoundary*" | grep -q .; then
        pass "Frontend: Error boundary component exists"
    else
        warn "Frontend: Error boundary component not found"
        info "   Create: components/ErrorBoundary.tsx"
    fi
fi

# Check for custom error handlers
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "exception_handler\|Exception" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Exception handlers configured"
    else
        warn "Backend: Custom exception handlers not found"
    fi
fi

# Test error tracking endpoint (if backend is running)
if curl -s -f "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    pass "Backend API is accessible at $BACKEND_URL"

    # Check if Sentry is initialized (may require custom endpoint)
    # This is informational only
    info "   Backend is running - manual error testing recommended"
else
    warn "Backend API is not accessible at $BACKEND_URL"
    info "   Start backend to test error tracking"
fi

# ============================================================================
# 9. Performance Monitoring
# ============================================================================

section "9. Performance Monitoring"

# Check for performance monitoring config
found_perf=false

if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "traces_sample_rate\|tracesSampleRate" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Performance monitoring (traces) configured"
        found_perf=true
    fi
fi

if [ -f "$FRONTEND_DIR/sentry.client.config.ts" ]; then
    if grep -q "tracesSampleRate" "$FRONTEND_DIR/sentry.client.config.ts"; then
        pass "Frontend: Performance monitoring (traces) configured"
        found_perf=true
    fi
fi

if [ "$found_perf" = false ]; then
    warn "Performance monitoring (traces) not configured"
    info "   Add: tracesSampleRate: 0.1 (10% of transactions)"
fi

# Check for profiling
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "profiles_sample_rate\|profilesSampleRate" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Profiling configured"
    else
        warn "Backend: Profiling not configured (optional)"
        info "   Add: profiles_sample_rate=0.1"
    fi
fi

# ============================================================================
# 10. Alert Integration
# ============================================================================

section "10. Alert Integration (Prometheus/AlertManager)"

# Check for Sentry metrics exporter
if [ -f "monitoring/prometheus/prometheus.yml" ]; then
    if grep -q "sentry" "monitoring/prometheus/prometheus.yml"; then
        pass "Prometheus: Sentry metrics configured"
    else
        warn "Prometheus: Sentry metrics not configured"
        info "   Consider: sentry-exporter for Prometheus integration"
    fi
fi

# Check for alert rules related to error rates
if [ -f "monitoring/prometheus/alert_rules.yml" ]; then
    if grep -q "error.*rate\|ErrorRate" "monitoring/prometheus/alert_rules.yml"; then
        pass "Alert rules: Error rate alerts configured"
    else
        warn "Alert rules: Error rate alerts not found"
        info "   Add: HighErrorRate and CriticalErrorRate alerts"
    fi

    # Check for Sentry-specific alerts
    if grep -q "sentry" "monitoring/prometheus/alert_rules.yml"; then
        pass "Alert rules: Sentry-specific alerts configured"
    else
        warn "Alert rules: Sentry-specific alerts not found"
    fi
else
    warn "Alert rules file not found: monitoring/prometheus/alert_rules.yml"
fi

# Check for webhook integration between Sentry and AlertManager
if [ -f "monitoring/alertmanager/config.yml" ]; then
    if grep -q "sentry" "monitoring/alertmanager/config.yml"; then
        pass "AlertManager: Sentry webhook integration configured"
    else
        warn "AlertManager: Sentry webhook not configured"
        info "   Consider: Sentry webhook receiver in AlertManager"
    fi
fi

# ============================================================================
# 11. Error Filtering & Sampling
# ============================================================================

section "11. Error Filtering & Sampling"

# Check for error filtering configuration
found_filtering=false

if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "before_send\|ignore_errors" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Error filtering configured (before_send/ignore_errors)"
        found_filtering=true
    fi
fi

if [ -f "$FRONTEND_DIR/sentry.client.config.ts" ]; then
    if grep -q "beforeSend\|ignoreErrors" "$FRONTEND_DIR/sentry.client.config.ts"; then
        pass "Frontend: Error filtering configured (beforeSend/ignoreErrors)"
        found_filtering=true
    fi
fi

if [ "$found_filtering" = false ]; then
    warn "Error filtering not configured"
    info "   Add: beforeSend callback to filter unwanted errors"
fi

# Check for sampling configuration
found_sampling=false

if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "sample_rate" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: Error sampling configured"
        found_sampling=true
    fi
fi

if [ "$found_sampling" = false ]; then
    warn "Error sampling not configured"
    info "   Add: sample_rate: 1.0 (100% in development, lower in production)"
fi

# ============================================================================
# 12. User Context & Breadcrumbs
# ============================================================================

section "12. User Context & Breadcrumbs"

# Check for user context configuration
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "set_user\|set_context" "$BACKEND_DIR/src/api/main.py"; then
        pass "Backend: User context tracking configured"
    else
        warn "Backend: User context tracking not found"
        info "   Add: sentry_sdk.set_user({'id': user_id, 'email': email})"
    fi
fi

if [ -f "$FRONTEND_DIR/sentry.client.config.ts" ]; then
    if grep -q "setUser\|setContext" "$FRONTEND_DIR/sentry.client.config.ts"; then
        pass "Frontend: User context tracking configured"
    else
        warn "Frontend: User context tracking not found"
    fi
fi

# Check for breadcrumbs configuration
info "Breadcrumbs: Automatically captured by Sentry SDK (HTTP, console, navigation)"

# ============================================================================
# 13. Testing & Verification
# ============================================================================

section "13. Testing & Verification"

# Check for Sentry test scripts
if [ -f "$BACKEND_DIR/tests/test_sentry.py" ] || [ -f "$BACKEND_DIR/tests/integration/test_sentry.py" ]; then
    pass "Backend: Sentry integration tests exist"
else
    warn "Backend: Sentry integration tests not found"
    info "   Create: tests/integration/test_sentry.py"
fi

# Check for test error endpoint
if [ -f "$BACKEND_DIR/src/api/routes/health.py" ]; then
    if grep -q "test.*error\|sentry.*test" "$BACKEND_DIR/src/api/routes/health.py"; then
        pass "Backend: Test error endpoint exists"
    else
        warn "Backend: Test error endpoint not found"
        info "   Add: /api/test-error endpoint for testing Sentry"
    fi
fi

# Instructions for manual testing
info "Manual testing:"
info "   Backend: curl -X POST $BACKEND_URL/api/test-error"
info "   Frontend: Trigger error in browser and check Sentry dashboard"

# ============================================================================
# 14. Documentation
# ============================================================================

section "14. Documentation"

# Check for Sentry documentation
if [ -f "docs/SENTRY.md" ] || [ -f "docs/monitoring/SENTRY.md" ]; then
    pass "Sentry documentation exists"
else
    warn "Sentry documentation not found"
    info "   Create: docs/SENTRY.md with setup and usage guide"
fi

# Check for Sentry setup guide in main docs
if [ -f "README.md" ]; then
    if grep -q -i "sentry" "README.md"; then
        pass "README.md mentions Sentry"
    else
        warn "README.md does not mention Sentry"
    fi
fi

# ============================================================================
# 15. Production Readiness
# ============================================================================

section "15. Production Readiness"

# Check critical production requirements
prod_ready=true

if [ -z "$SENTRY_DSN" ]; then
    warn "Production: SENTRY_DSN not configured"
    prod_ready=false
fi

if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if ! grep -q "sentry_sdk.init" "$BACKEND_DIR/src/api/main.py"; then
        warn "Production: Backend Sentry not initialized"
        prod_ready=false
    fi
else
    warn "Production: Backend main.py not found"
    prod_ready=false
fi

if [ -f "$FRONTEND_DIR/sentry.client.config.ts" ]; then
    pass "Production: Frontend Sentry client config exists"
else
    warn "Production: Frontend Sentry config missing"
    prod_ready=false
fi

# Check for environment-specific configuration
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "environment=\|'environment'" "$BACKEND_DIR/src/api/main.py"; then
        pass "Production: Environment tagging configured"
    else
        warn "Production: Environment tagging not configured"
        info "   Add: environment='production'"
    fi
fi

# Check for release tagging
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "release=\|'release'" "$BACKEND_DIR/src/api/main.py"; then
        pass "Production: Release tagging configured"
    else
        warn "Production: Release tagging not configured"
    fi
fi

if [ "$prod_ready" = true ]; then
    pass "Production: Ready for deployment"
else
    warn "Production: NOT ready - complete above items first"
fi

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
    echo -e "${GREEN}✅ Sentry error tracking is fully configured!${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Sentry error tracking is mostly configured with some improvements needed.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Address the warnings above"
    echo "2. Configure SENTRY_DSN environment variable"
    echo "3. Test error tracking with test errors"
    echo "4. Upload source maps for production"
    echo "5. Configure alert rules for error rate spikes"
    exit 0
else
    echo -e "${RED}❌ Sentry error tracking is NOT properly configured.${NC}"
    echo ""
    echo "Critical issues found. Please address the failures above."
    echo ""
    echo "Quick start:"
    echo "1. Backend: cd $BACKEND_DIR && uv add sentry-sdk[fastapi]"
    echo "2. Frontend: pnpm add @sentry/nextjs --filter=web"
    echo "3. Configure SENTRY_DSN in environment"
    echo "4. Initialize Sentry in main.py and sentry.*.config.ts files"
    echo "5. Run this script again to verify"
    exit 1
fi
