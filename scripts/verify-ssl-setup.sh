#!/bin/bash

################################################################################
# CCW-Online ERP - SSL/TLS Setup Verification Script (ISS-012)
#
# Purpose: Verify that SSL/TLS certificates are correctly configured
# Usage: ./verify-ssl-setup.sh [domain]
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
echo "  CCW-Online ERP - SSL/TLS Configuration Verification"
echo "  Date: $(date)"
echo "================================================================="
echo ""
info "Testing domains:"
echo "  Frontend: $FRONTEND_DOMAIN"
echo "  Backend: $BACKEND_DOMAIN"
echo ""

# 1. Check if certbot is installed
info "Checking Certbot Installation..."
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version 2>&1 | awk '{print $2}')
    pass "Certbot installed: $CERTBOT_VERSION"
else
    fail "Certbot not installed"
fi
echo ""

# 2. Check certificates exist
info "Checking Certificate Files..."

check_cert_files() {
    local domain=$1
    local cert_dir="/etc/letsencrypt/live/$domain"

    if [ -d "$cert_dir" ]; then
        pass "Certificate directory exists: $cert_dir"

        # Check individual files
        local files=("cert.pem" "chain.pem" "fullchain.pem" "privkey.pem")
        for file in "${files[@]}"; do
            if [ -f "$cert_dir/$file" ]; then
                pass "$file exists"
            else
                fail "$file missing"
            fi
        done
    else
        fail "Certificate directory not found: $cert_dir"
        return 1
    fi
    return 0
}

echo "Frontend certificates ($FRONTEND_DOMAIN):"
check_cert_files "$FRONTEND_DOMAIN"
echo ""

echo "Backend certificates ($BACKEND_DOMAIN):"
check_cert_files "$BACKEND_DOMAIN"
echo ""

# 3. Check certificate validity
info "Checking Certificate Validity..."

check_cert_validity() {
    local domain=$1
    local cert_path="/etc/letsencrypt/live/$domain/cert.pem"

    if [ -f "$cert_path" ]; then
        # Get expiry date
        local expiry=$(openssl x509 -in "$cert_path" -noout -enddate 2>/dev/null | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || echo 0)
        local now_epoch=$(date +%s)
        local days_left=$(( ($expiry_epoch - $now_epoch) / 86400 ))

        if [ $days_left -gt 30 ]; then
            pass "$domain certificate valid for $days_left days"
        elif [ $days_left -gt 14 ]; then
            warn "$domain certificate expires in $days_left days (renewal soon)"
        elif [ $days_left -gt 0 ]; then
            fail "$domain certificate expires in $days_left days (renewal URGENT)"
        else
            fail "$domain certificate has expired"
        fi

        # Check certificate issuer
        local issuer=$(openssl x509 -in "$cert_path" -noout -issuer 2>/dev/null | grep -o "CN=[^,]*" | cut -d= -f2)
        if echo "$issuer" | grep -qi "Let's Encrypt"; then
            pass "$domain certificate issued by: $issuer"
        else
            warn "$domain certificate issuer: $issuer (expected Let's Encrypt)"
        fi
    else
        fail "$domain certificate file not found"
    fi
}

check_cert_validity "$FRONTEND_DOMAIN"
check_cert_validity "$BACKEND_DOMAIN"
echo ""

# 4. Check DNS resolution
info "Checking DNS Resolution..."

check_dns() {
    local domain=$1
    if command -v dig &> /dev/null; then
        local ip=$(dig +short "$domain" A | head -1)
        if [ -n "$ip" ]; then
            pass "$domain resolves to: $ip"
        else
            fail "$domain does not resolve"
        fi
    else
        warn "dig command not available, skipping DNS check"
    fi
}

check_dns "$FRONTEND_DOMAIN"
check_dns "$BACKEND_DOMAIN"
echo ""

# 5. Check HTTPS accessibility
info "Checking HTTPS Accessibility..."

check_https() {
    local domain=$1
    local url="https://$domain"

    if curl -sSf -I --max-time 10 "$url" > /dev/null 2>&1; then
        pass "$domain is accessible via HTTPS"
    else
        warn "$domain is not accessible via HTTPS (Nginx may not be configured)"
    fi
}

check_https "$FRONTEND_DOMAIN"
check_https "$BACKEND_DOMAIN"
echo ""

# 6. Check HTTP to HTTPS redirect
info "Checking HTTP to HTTPS Redirect..."

check_redirect() {
    local domain=$1
    local http_url="http://$domain"

    local redirect=$(curl -sI -w "%{http_code}" -o /dev/null --max-time 10 "$http_url" 2>/dev/null || echo "000")

    if [ "$redirect" = "301" ] || [ "$redirect" = "302" ]; then
        pass "$domain redirects HTTP to HTTPS (HTTP $redirect)"
    elif [ "$redirect" = "000" ]; then
        warn "$domain not accessible (may be down)"
    else
        warn "$domain does not redirect HTTP to HTTPS (HTTP $redirect)"
    fi
}

check_redirect "$FRONTEND_DOMAIN"
check_redirect "$BACKEND_DOMAIN"
echo ""

# 7. Check TLS version support
info "Checking TLS Version Support..."

check_tls_version() {
    local domain=$1

    # Check TLS 1.2
    if openssl s_client -connect "$domain:443" -tls1_2 -brief < /dev/null 2>&1 | grep -q "Protocol.*TLSv1.2"; then
        pass "$domain supports TLS 1.2"
    else
        warn "$domain does not support TLS 1.2"
    fi

    # Check TLS 1.3
    if openssl s_client -connect "$domain:443" -tls1_3 -brief < /dev/null 2>&1 | grep -q "Protocol.*TLSv1.3"; then
        pass "$domain supports TLS 1.3"
    else
        warn "$domain does not support TLS 1.3"
    fi

    # Check TLS 1.0/1.1 are disabled
    if ! openssl s_client -connect "$domain:443" -tls1 -brief < /dev/null 2>&1 | grep -q "Protocol.*TLSv1\\.0"; then
        pass "$domain has TLS 1.0 disabled (secure)"
    else
        fail "$domain has TLS 1.0 enabled (insecure)"
    fi
}

check_tls_version "$FRONTEND_DOMAIN"
check_tls_version "$BACKEND_DOMAIN"
echo ""

# 8. Check security headers
info "Checking Security Headers..."

check_headers() {
    local domain=$1
    local url="https://$domain"

    # Get headers
    local headers=$(curl -sI --max-time 10 "$url" 2>/dev/null || echo "")

    # Check HSTS
    if echo "$headers" | grep -qi "strict-transport-security"; then
        local hsts=$(echo "$headers" | grep -i "strict-transport-security" | head -1)
        if echo "$hsts" | grep -q "max-age=.*includeSubDomains"; then
            pass "$domain has HSTS with includeSubDomains"
        else
            warn "$domain has HSTS but missing includeSubDomains"
        fi
    else
        warn "$domain missing HSTS header"
    fi

    # Check X-Frame-Options
    if echo "$headers" | grep -qi "x-frame-options"; then
        pass "$domain has X-Frame-Options header"
    else
        warn "$domain missing X-Frame-Options header"
    fi

    # Check X-Content-Type-Options
    if echo "$headers" | grep -qi "x-content-type-options"; then
        pass "$domain has X-Content-Type-Options header"
    else
        warn "$domain missing X-Content-Type-Options header"
    fi
}

check_headers "$FRONTEND_DOMAIN"
check_headers "$BACKEND_DOMAIN"
echo ""

# 9. Check OCSP stapling
info "Checking OCSP Stapling..."

check_ocsp() {
    local domain=$1

    local ocsp_status=$(echo | openssl s_client -connect "$domain:443" -status 2>/dev/null | grep "OCSP Response Status" || echo "none")

    if echo "$ocsp_status" | grep -q "successful"; then
        pass "$domain has OCSP stapling enabled"
    else
        warn "$domain OCSP stapling not detected"
    fi
}

check_ocsp "$FRONTEND_DOMAIN"
check_ocsp "$BACKEND_DOMAIN"
echo ""

# 10. Check certificate renewal configuration
info "Checking Certificate Renewal..."

if systemctl is-enabled --quiet certbot.timer 2>/dev/null; then
    pass "Certbot renewal timer is enabled"

    # Check if timer is active
    if systemctl is-active --quiet certbot.timer 2>/dev/null; then
        pass "Certbot renewal timer is active"

        # Get next run time
        local next_run=$(systemctl list-timers certbot.timer 2>/dev/null | grep certbot | awk '{print $1, $2}' || echo "unknown")
        if [ "$next_run" != "unknown" ]; then
            info "Next renewal check: $next_run"
        fi
    else
        fail "Certbot renewal timer is not active"
    fi
else
    fail "Certbot renewal timer is not enabled"
fi

# Check renewal hook
if [ -f "/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh" ]; then
    pass "Nginx reload hook exists"

    if [ -x "/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh" ]; then
        pass "Nginx reload hook is executable"
    else
        fail "Nginx reload hook is not executable"
    fi
else
    warn "Nginx reload hook not found"
fi
echo ""

# 11. Check SSL monitoring script
info "Checking SSL Monitoring..."

if [ -f "/usr/local/bin/check-ssl-expiry.sh" ]; then
    pass "SSL expiry check script exists"

    if [ -x "/usr/local/bin/check-ssl-expiry.sh" ]; then
        pass "SSL expiry check script is executable"
    else
        fail "SSL expiry check script is not executable"
    fi

    # Check cron job
    if crontab -l 2>/dev/null | grep -q "check-ssl-expiry.sh"; then
        pass "SSL expiry check scheduled in cron"
    else
        warn "SSL expiry check not scheduled in cron"
    fi
else
    warn "SSL expiry check script not found"
fi
echo ""

# 12. Check DH parameters
info "Checking DH Parameters..."

if [ -f "/etc/ssl/certs/dhparam.pem" ]; then
    pass "DH parameters file exists"

    # Check DH param size
    local dh_size=$(openssl dhparam -in /etc/ssl/certs/dhparam.pem -text -noout 2>/dev/null | grep "DH Parameters" | grep -o "[0-9]*" || echo "0")
    if [ "$dh_size" -ge 2048 ]; then
        pass "DH parameters size: $dh_size bits"
    else
        warn "DH parameters size: $dh_size bits (recommended: 2048+)"
    fi
else
    warn "DH parameters file not found (optional but recommended)"
fi
echo ""

# 13. Test certificate renewal (dry run)
info "Testing Certificate Renewal..."

if certbot renew --dry-run &> /dev/null; then
    pass "Certificate renewal test passed"
else
    fail "Certificate renewal test failed"
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

# SSL Labs recommendation
if [ $FAILED -eq 0 ] && [ $WARNINGS -lt 5 ]; then
    echo -e "${GREEN}✓ SSL/TLS configuration looks good!${NC}"
    echo ""
    info "Recommended: Test with SSL Labs for A+ rating"
    echo "  https://www.ssllabs.com/ssltest/analyze.html?d=$FRONTEND_DOMAIN"
    echo ""
    info "Recommended: Check security headers"
    echo "  https://securityheaders.com/?q=https://$FRONTEND_DOMAIN"
    echo ""
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ SSL/TLS configuration has warnings.${NC}"
    echo ""
    warn "Review warnings above and improve configuration if needed."
    exit 0
else
    echo -e "${RED}✗ SSL/TLS configuration has issues.${NC}"
    echo ""
    fail "Critical issues found. Please review failed checks above."
    exit 1
fi
