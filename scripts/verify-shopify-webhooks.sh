#!/bin/bash

################################################################################
# Shopify Webhooks Configuration Verification Script
#
# Purpose: Verify Shopify webhook configuration for CCW-Online ERP
# Issue: ISS-018 - Configure Shopify Webhooks
# Version: 1.0
# Date: 2026-02-02
#
# Usage:
#   ./scripts/verify-shopify-webhooks.sh [options]
#
# Options:
#   BACKEND_URL    Backend API URL (default: http://localhost:8000)
#   WEBHOOK_URL    Public webhook URL (for production verification)
#
# Examples:
#   # Local development
#   ./scripts/verify-shopify-webhooks.sh
#
#   # Production verification
#   WEBHOOK_URL=https://api.ccw-online.com ./scripts/verify-shopify-webhooks.sh
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
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
BACKEND_DIR="backend/src"

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
echo "  SHOPIFY WEBHOOKS VERIFICATION"
echo "================================================================================"
echo ""
info "Checking Shopify webhook configuration for CCW-Online ERP"
info "Backend URL: $BACKEND_URL"
if [ -n "$WEBHOOK_URL" ]; then
    info "Public Webhook URL: $WEBHOOK_URL"
fi
echo ""

################################################################################
# 1. Webhook Handler Implementation
################################################################################
section "1. Webhook Handler Implementation"

WEBHOOK_HANDLER="$BACKEND_DIR/integrations/shopify/webhooks.py"

if [ -f "$WEBHOOK_HANDLER" ]; then
    pass "Webhook handler exists: $WEBHOOK_HANDLER"

    # Check for ShopifyWebhookHandler class
    if grep -q "class ShopifyWebhookHandler" "$WEBHOOK_HANDLER"; then
        pass "ShopifyWebhookHandler class defined"
    else
        fail "ShopifyWebhookHandler class not found"
    fi

    # Check for required webhook topics
    REQUIRED_TOPICS=("orders/create" "orders/updated" "orders/cancelled" "products/create" "products/update" "inventory_levels/update")

    for topic in "${REQUIRED_TOPICS[@]}"; do
        if grep -q "$topic" "$WEBHOOK_HANDLER"; then
            pass "Handler for $topic topic implemented"
        else
            warn "Handler for $topic topic not found"
        fi
    done
else
    fail "Webhook handler not found: $WEBHOOK_HANDLER"
fi

################################################################################
# 2. Webhook API Endpoint
################################################################################
section "2. Webhook API Endpoint"

SHOPIFY_ROUTES="$BACKEND_DIR/api/routes/integrations/shopify.py"

if [ -f "$SHOPIFY_ROUTES" ]; then
    pass "Shopify routes file exists"

    # Check for webhook endpoint
    if grep -q '@router.post("/webhooks")' "$SHOPIFY_ROUTES"; then
        pass "Webhook endpoint defined: POST /api/integrations/shopify/webhooks"
    else
        fail "Webhook endpoint not found in routes"
    fi

    # Check for signature verification
    if grep -q "verify_webhook\|x_shopify_hmac_sha256" "$SHOPIFY_ROUTES"; then
        pass "Webhook signature verification implemented"
    else
        warn "Webhook signature verification not found"
    fi

    # Check for required headers
    REQUIRED_HEADERS=("x-shopify-topic" "x-shopify-shop-domain" "x-shopify-hmac-sha256")

    for header in "${REQUIRED_HEADERS[@]}"; do
        if grep -qi "$header" "$SHOPIFY_ROUTES"; then
            pass "Header $header handled"
        else
            warn "Header $header not found"
        fi
    done
else
    fail "Shopify routes file not found: $SHOPIFY_ROUTES"
fi

################################################################################
# 3. Webhook Security
################################################################################
section "3. Webhook Security"

SECURITY_FILES=(
    "$BACKEND_DIR/security/webhook_verification.py"
    "$BACKEND_DIR/integrations/xero/webhook_security.py"
)

SECURITY_FOUND=false
for security_file in "${SECURITY_FILES[@]}"; do
    if [ -f "$security_file" ]; then
        pass "Webhook security module exists: $(basename "$security_file")"
        SECURITY_FOUND=true

        # Check for HMAC verification
        if grep -q "hmac\|signature" "$security_file" 2>/dev/null; then
            pass "HMAC signature verification implemented"
        fi
    fi
done

if [ "$SECURITY_FOUND" = false ]; then
    warn "No dedicated webhook security module found"
    info "Security may be implemented inline in webhook handler"
fi

# Check for webhook secret in settings
SETTINGS_FILE="$BACKEND_DIR/config/shopify_settings.py"
if [ -f "$SETTINGS_FILE" ]; then
    if grep -q "webhook_secret\|WEBHOOK_SECRET" "$SETTINGS_FILE"; then
        pass "Webhook secret configuration found"
    else
        warn "Webhook secret not found in settings"
        info "Secret may be in main settings.py or .env"
    fi
fi

################################################################################
# 4. Webhook Logging
################################################################################
section "4. Webhook Logging"

SHOPIFY_MODELS="$BACKEND_DIR/db/shopify_models.py"

if [ -f "$SHOPIFY_MODELS" ]; then
    if grep -q "ShopifyWebhookLog\|WebhookLog" "$SHOPIFY_MODELS"; then
        pass "Webhook logging model exists (ShopifyWebhookLog)"
    else
        warn "Webhook logging model not found"
        info "Consider adding ShopifyWebhookLog for audit trail"
    fi
else
    warn "Shopify models file not found: $SHOPIFY_MODELS"
fi

# Check for logging in webhook handler
if [ -f "$WEBHOOK_HANDLER" ]; then
    if grep -q "webhook_log\|log_webhook" "$WEBHOOK_HANDLER"; then
        pass "Webhook logging implementation found"
    else
        warn "Webhook logging not implemented"
    fi
fi

################################################################################
# 5. Backend API Health
################################################################################
section "5. Backend API Health"

info "Checking if backend API is running..."

if command -v curl >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        pass "Backend API is running ($BACKEND_URL)"
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "Backend API not accessible at $BACKEND_URL"
        info "Start with: cd backend && uv run uvicorn src.api.main:app --reload"
    else
        warn "Backend API returned HTTP $HTTP_STATUS"
    fi
else
    warn "curl not available, cannot test API"
fi

################################################################################
# 6. Webhook Endpoint Accessibility
################################################################################
section "6. Webhook Endpoint Accessibility"

if command -v curl >/dev/null 2>&1; then
    info "Testing webhook endpoint accessibility..."

    # Test with POST (webhooks are POST requests)
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND_URL/api/integrations/shopify/webhooks" \
        -H "Content-Type: application/json" \
        -H "X-Shopify-Topic: orders/create" \
        -H "X-Shopify-Shop-Domain: test.myshopify.com" \
        -d '{"id": 123}' 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "400" ]; then
        pass "Webhook endpoint is accessible (HTTP $HTTP_STATUS)"
        if [ "$HTTP_STATUS" = "401" ]; then
            info "401 is expected without valid signature"
        fi
    elif [ "$HTTP_STATUS" = "000" ]; then
        warn "Webhook endpoint not accessible"
        info "Backend may not be running or endpoint not registered"
    else
        warn "Webhook endpoint returned HTTP $HTTP_STATUS"
    fi
else
    warn "curl not available, cannot test webhook endpoint"
fi

################################################################################
# 7. Public Webhook URL (Production)
################################################################################
section "7. Public Webhook URL (Production)"

if [ -n "$WEBHOOK_URL" ]; then
    info "Checking public webhook URL accessibility..."

    if command -v curl >/dev/null 2>&1; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL/api/integrations/shopify/webhooks" \
            -H "Content-Type: application/json" \
            -H "X-Shopify-Topic: orders/create" \
            -H "X-Shopify-Shop-Domain: test.myshopify.com" \
            --max-time 10 \
            -d '{"id": 123}' 2>/dev/null || echo "000")

        if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "400" ]; then
            pass "Public webhook URL is accessible"
            info "URL: $WEBHOOK_URL/api/integrations/shopify/webhooks"
        elif [ "$HTTP_STATUS" = "000" ]; then
            fail "Public webhook URL not accessible"
            info "Check DNS, SSL, and firewall configuration"
        else
            warn "Public webhook URL returned HTTP $HTTP_STATUS"
        fi
    fi
else
    info "No public webhook URL provided (development mode)"
    info "For production, verify with: WEBHOOK_URL=https://api.domain.com ./verify-shopify-webhooks.sh"
fi

################################################################################
# 8. SSL/HTTPS Configuration (Production)
################################################################################
section "8. SSL/HTTPS Configuration (Production)"

if [ -n "$WEBHOOK_URL" ]; then
    if [[ "$WEBHOOK_URL" == https://* ]]; then
        pass "Webhook URL uses HTTPS (required by Shopify)"

        if command -v openssl >/dev/null 2>&1; then
            DOMAIN=$(echo "$WEBHOOK_URL" | sed -e 's|https\?://||' -e 's|/.*||')
            info "Checking SSL certificate for $DOMAIN..."

            if openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
                pass "SSL certificate is valid"
            else
                warn "SSL certificate validation failed"
                info "Shopify requires valid SSL certificate"
            fi
        fi
    else
        fail "Webhook URL does not use HTTPS"
        info "Shopify webhooks require HTTPS endpoint"
        info "Configure SSL certificate (see docs/SSL_SETUP.md)"
    fi
else
    info "Local development mode - SSL not required"
fi

################################################################################
# 9. Required Shopify Topics
################################################################################
section "9. Required Shopify Topics"

info "Webhook topics that should be configured in Shopify Admin:"

# Define required topics and their purposes
declare -A TOPICS=(
    ["orders/create"]="New orders from Shopify"
    ["orders/updated"]="Order status/details updates"
    ["orders/cancelled"]="Order cancellations"
    ["products/create"]="New products from Shopify (ISS-009)"
    ["products/update"]="Product updates from Shopify (ISS-009)"
    ["inventory_levels/update"]="Inventory sync from Shopify (ISS-010)"
)

for topic in "${!TOPICS[@]}"; do
    PURPOSE="${TOPICS[$topic]}"

    if grep -q "$topic" "$WEBHOOK_HANDLER" 2>/dev/null; then
        pass "$topic - ${PURPOSE}"
    else
        warn "$topic - ${PURPOSE} (handler not found)"
    fi
done

################################################################################
# 10. Shopify Settings
################################################################################
section "10. Shopify Settings"

if [ -f "$SETTINGS_FILE" ]; then
    pass "Shopify settings file exists"

    # Check for required settings
    REQUIRED_SETTINGS=("shop_domain" "access_token" "api_version")

    for setting in "${REQUIRED_SETTINGS[@]}"; do
        if grep -qi "$setting" "$SETTINGS_FILE"; then
            pass "Setting $setting configured"
        else
            warn "Setting $setting not found"
        fi
    done

    # Check for webhook-specific settings
    if grep -q "webhook" "$SETTINGS_FILE" 2>/dev/null; then
        info "Webhook-specific settings found"
    fi
else
    fail "Shopify settings file not found: $SETTINGS_FILE"
fi

################################################################################
# 11. Environment Variables
################################################################################
section "11. Environment Variables"

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    pass ".env file exists"

    # Check for Shopify configuration
    REQUIRED_ENV_VARS=("SHOPIFY_SHOP_DOMAIN" "SHOPIFY_ACCESS_TOKEN" "SHOPIFY_API_VERSION")

    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if grep -q "^$var=" "$ENV_FILE" 2>/dev/null; then
            pass "$var set in .env"
        else
            warn "$var not found in .env"
        fi
    done

    # Check for webhook secret
    if grep -q "SHOPIFY_WEBHOOK_SECRET\|WEBHOOK_SECRET" "$ENV_FILE" 2>/dev/null; then
        pass "Webhook secret configured in .env"
    else
        warn "Webhook secret not found in .env"
        info "Set SHOPIFY_WEBHOOK_SECRET for signature verification"
    fi
else
    warn ".env file not found"
    info "Copy .env.example to .env and configure Shopify credentials"
fi

################################################################################
# 12. Documentation
################################################################################
section "12. Documentation"

DOCS_DIR="docs"

# Check for Shopify webhook documentation
WEBHOOK_DOCS=$(find "$DOCS_DIR" -name "*shopify*webhook*" -o -name "*webhook*setup*" 2>/dev/null || true)

if [ -n "$WEBHOOK_DOCS" ]; then
    pass "Webhook documentation exists"
    echo "$WEBHOOK_DOCS" | while read -r doc; do
        info "  - $doc"
    done
else
    warn "No webhook-specific documentation found"
    info "Create docs/SHOPIFY_WEBHOOK_SETUP.md with configuration guide"
fi

# Check for general integration documentation
if [ -f "$DOCS_DIR/SHOPIFY_INTEGRATION.md" ]; then
    pass "Shopify integration documentation exists"
else
    warn "Shopify integration documentation not found"
fi

################################################################################
# 13. Test Webhook Delivery
################################################################################
section "13. Test Webhook Delivery"

info "To test webhook delivery:"
echo ""
echo "1. Configure webhooks in Shopify Admin:"
echo "   https://YOUR_SHOP.myshopify.com/admin/settings/notifications"
echo ""
echo "2. Add webhook subscriptions:"
echo "   - Topic: orders/create"
echo "   - URL: $WEBHOOK_URL/api/integrations/shopify/webhooks"
echo "   - Format: JSON"
echo ""
echo "3. Test webhook delivery:"
echo "   - Create a test order in Shopify"
echo "   - Check webhook logs in database (shopify_webhook_logs table)"
echo "   - Verify order imported in ERP"
echo ""

################################################################################
# 14. Webhook Retry Configuration
################################################################################
section "14. Webhook Retry Configuration"

info "Shopify webhook retry behavior:"
echo ""
echo "- Shopify retries failed webhooks up to 19 times over 48 hours"
echo "- Webhook endpoint should return HTTP 200 for successful processing"
echo "- Return 200 even if processing fails (log error in database)"
echo "- Timeouts: Shopify expects response within 5 seconds"
echo ""

if [ -f "$WEBHOOK_HANDLER" ]; then
    if grep -q "return 200\|success.*True" "$WEBHOOK_HANDLER" 2>/dev/null; then
        pass "Webhook handler returns success response"
    else
        warn "Webhook handler may not return proper success response"
    fi
fi

################################################################################
# 15. Database Migration
################################################################################
section "15. Database Migration"

MIGRATIONS_DIR="backend/alembic/versions"

if [ -d "$MIGRATIONS_DIR" ]; then
    # Check for webhook-related migrations
    WEBHOOK_MIGRATIONS=$(find "$MIGRATIONS_DIR" -name "*webhook*" 2>/dev/null || true)

    if [ -n "$WEBHOOK_MIGRATIONS" ]; then
        pass "Webhook database migrations exist"
        echo "$WEBHOOK_MIGRATIONS" | while read -r migration; do
            info "  - $(basename "$migration")"
        done
    else
        warn "No webhook-specific migrations found"
        info "Ensure ShopifyWebhookLog table exists in database"
    fi
else
    warn "Migrations directory not found: $MIGRATIONS_DIR"
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
        echo -e "${GREEN}✓ Shopify webhooks configuration looks excellent!${NC}"
    else
        echo -e "${YELLOW}⚠ Shopify webhooks are mostly configured with some improvements needed.${NC}"
    fi
    echo ""
    echo "Next steps:"
    echo "1. Configure webhook subscriptions in Shopify Admin"
    echo "2. Test webhook delivery with a test order"
    echo "3. Monitor webhook logs for successful processing"
    echo "4. Set up webhook failure alerts"
    EXIT_CODE=0
else
    echo -e "${RED}✗ Shopify webhooks configuration issues detected.${NC}"
    echo ""
    echo "Priority actions:"
    echo "1. Fix failed checks above"
    echo "2. Ensure webhook endpoint is accessible"
    echo "3. Configure webhook secret for signature verification"
    echo "4. Test webhook delivery"
    EXIT_CODE=1
fi

echo ""
exit $EXIT_CODE
