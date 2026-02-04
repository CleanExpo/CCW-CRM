#!/usr/bin/env bash
#
# ISS-026 Verification: Configure Firewall & Network Security
#
# This script verifies that firewall and network security infrastructure is properly
# configured including UFW firewall rules, SSH hardening, Fail2ban, port restrictions,
# and network isolation for production deployment.
#
# Usage:
#   ./scripts/verify-firewall.sh
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
echo "║   ISS-026 VERIFICATION: Configure Firewall & Network Security     ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 1. FIREWALL CONFIGURATION SCRIPT
# ============================================================================
section "1. Firewall Configuration Script"

if [[ -f "scripts/configure-firewall.sh" ]]; then
    pass "Firewall configuration script exists (scripts/configure-firewall.sh)"

    # Check if executable
    if [[ -x "scripts/configure-firewall.sh" ]]; then
        pass "Script is executable"
    else
        warn "Script is not executable (run: chmod +x scripts/configure-firewall.sh)"
    fi

    # Check for UFW commands
    if grep -q "ufw" scripts/configure-firewall.sh; then
        pass "Script uses UFW firewall"
    else
        fail "Script does not configure UFW"
    fi

    # Check for default policies
    if grep -q "ufw default deny incoming" scripts/configure-firewall.sh; then
        pass "Default deny incoming policy configured"
    else
        fail "Missing default deny incoming policy"
    fi

    if grep -q "ufw default allow outgoing" scripts/configure-firewall.sh; then
        pass "Default allow outgoing policy configured"
    else
        fail "Missing default allow outgoing policy"
    fi

    # Check for required ports
    if grep -q "allow 22" scripts/configure-firewall.sh; then
        pass "SSH port (22) rule configured"
    else
        fail "Missing SSH port rule"
    fi

    if grep -q "allow 80" scripts/configure-firewall.sh; then
        pass "HTTP port (80) rule configured"
    else
        fail "Missing HTTP port rule"
    fi

    if grep -q "allow 443" scripts/configure-firewall.sh; then
        pass "HTTPS port (443) rule configured"
    else
        fail "Missing HTTPS port rule"
    fi

    # Check for rate limiting
    if grep -q "ufw limit" scripts/configure-firewall.sh; then
        pass "Rate limiting configured on ports"
    else
        warn "Rate limiting not configured (recommended for SSH/HTTP/HTTPS)"
    fi

    # Check for security warnings
    if grep -q "RESTRICT TO SPECIFIC IP\|IMPORTANT SECURITY" scripts/configure-firewall.sh; then
        pass "Security warnings present in script"
    else
        warn "Missing security warnings in script"
    fi

else
    fail "Firewall configuration script not found (scripts/configure-firewall.sh)"
fi

# ============================================================================
# 2. UFW INSTALLATION & STATUS
# ============================================================================
section "2. UFW Installation & Status"

if command -v ufw &> /dev/null; then
    pass "UFW is installed"

    # Check UFW status (requires sudo, may not be available)
    if [[ $EUID -eq 0 ]] || sudo -n true 2>/dev/null; then
        UFW_STATUS=$(sudo ufw status 2>/dev/null || echo "inactive")

        if echo "$UFW_STATUS" | grep -q "Status: active"; then
            pass "UFW firewall is active"

            # Check default policies
            if echo "$UFW_STATUS" | grep -q "deny (incoming)"; then
                pass "Default deny incoming policy is active"
            else
                warn "Default deny incoming policy may not be active"
            fi

            # Check for open ports
            if echo "$UFW_STATUS" | grep -q "22"; then
                info "SSH port (22) is open"
            fi

            if echo "$UFW_STATUS" | grep -q "80"; then
                info "HTTP port (80) is open"
            fi

            if echo "$UFW_STATUS" | grep -q "443"; then
                info "HTTPS port (443) is open"
            fi

        else
            warn "UFW firewall is not active (run: sudo ufw enable)"
        fi
    else
        info "Cannot check UFW status (requires sudo)"
        info "Run: sudo ufw status"
    fi

else
    warn "UFW not installed (install: sudo apt-get install ufw)"
    info "Firewall configuration cannot be validated without UFW"
fi

# ============================================================================
# 3. PORT EXPOSURE VALIDATION
# ============================================================================
section "3. Port Exposure Validation"

info "Checking for exposed services..."

# Check if PostgreSQL is exposed externally (should NOT be)
if command -v netstat &> /dev/null || command -v ss &> /dev/null; then
    if command -v ss &> /dev/null; then
        POSTGRES_LISTENING=$(ss -tlnp 2>/dev/null | grep ":5432" || true)
    else
        POSTGRES_LISTENING=$(netstat -tlnp 2>/dev/null | grep ":5432" || true)
    fi

    if [[ -n "$POSTGRES_LISTENING" ]]; then
        if echo "$POSTGRES_LISTENING" | grep -q "127.0.0.1\|localhost"; then
            pass "PostgreSQL (5432) bound to localhost only (SECURE)"
        else
            fail "PostgreSQL (5432) exposed to external network (SECURITY RISK)"
        fi
    else
        info "PostgreSQL not currently running"
    fi

    # Check Redis exposure (should NOT be exposed)
    if command -v ss &> /dev/null; then
        REDIS_LISTENING=$(ss -tlnp 2>/dev/null | grep ":6379" || true)
    else
        REDIS_LISTENING=$(netstat -tlnp 2>/dev/null | grep ":6379" || true)
    fi

    if [[ -n "$REDIS_LISTENING" ]]; then
        if echo "$REDIS_LISTENING" | grep -q "127.0.0.1\|localhost"; then
            pass "Redis (6379) bound to localhost only (SECURE)"
        else
            fail "Redis (6379) exposed to external network (SECURITY RISK)"
        fi
    else
        info "Redis not currently running"
    fi

    # Check backend API exposure (port 8000 - should be internal only)
    if command -v ss &> /dev/null; then
        BACKEND_LISTENING=$(ss -tlnp 2>/dev/null | grep ":8000" || true)
    else
        BACKEND_LISTENING=$(netstat -tlnp 2>/dev/null | grep ":8000" || true)
    fi

    if [[ -n "$BACKEND_LISTENING" ]]; then
        if echo "$BACKEND_LISTENING" | grep -q "127.0.0.1\|localhost"; then
            pass "Backend API (8000) bound to localhost only (SECURE)"
        else
            warn "Backend API (8000) exposed externally (should be behind nginx)"
        fi
    else
        info "Backend API not currently running"
    fi

else
    info "netstat/ss not available - cannot check port bindings"
fi

# ============================================================================
# 4. SSH HARDENING CONFIGURATION
# ============================================================================
section "4. SSH Hardening Configuration"

if [[ -f "/etc/ssh/sshd_config" ]]; then
    pass "SSH configuration file exists"

    # Check for root login disabled
    if grep -q "^PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
        pass "Root login disabled (PermitRootLogin no)"
    elif grep -q "^PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null; then
        warn "Root login may be enabled (SECURITY RISK)"
        info "Set: PermitRootLogin no"
    else
        info "PermitRootLogin not explicitly configured (check default)"
    fi

    # Check for password authentication
    if grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config 2>/dev/null; then
        pass "Password authentication disabled (key-only access)"
    elif grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
        warn "Password authentication enabled (consider disabling for production)"
        info "Set: PasswordAuthentication no"
    else
        info "PasswordAuthentication not explicitly configured"
    fi

    # Check for public key authentication
    if grep -q "^PubkeyAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
        pass "Public key authentication enabled"
    else
        info "PubkeyAuthentication not explicitly enabled (check default)"
    fi

    # Check for X11 forwarding (should be disabled)
    if grep -q "^X11Forwarding no" /etc/ssh/sshd_config 2>/dev/null; then
        pass "X11 forwarding disabled"
    elif grep -q "^X11Forwarding yes" /etc/ssh/sshd_config 2>/dev/null; then
        warn "X11 forwarding enabled (not needed for server)"
    fi

else
    info "Cannot access /etc/ssh/sshd_config (requires sudo)"
    info "SSH hardening checks skipped"
fi

# ============================================================================
# 5. FAIL2BAN CONFIGURATION
# ============================================================================
section "5. Fail2ban Configuration"

if command -v fail2ban-client &> /dev/null; then
    pass "Fail2ban is installed"

    # Check fail2ban status
    if [[ $EUID -eq 0 ]] || sudo -n true 2>/dev/null; then
        if sudo systemctl is-active --quiet fail2ban 2>/dev/null; then
            pass "Fail2ban service is active"

            # Check for SSH jail
            if sudo fail2ban-client status sshd &>/dev/null; then
                pass "SSH jail (sshd) is configured"

                BANNED_IPS=$(sudo fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | grep -o "[0-9]\+" || echo "0")
                info "Currently banned IPs: $BANNED_IPS"
            else
                warn "SSH jail (sshd) not configured"
            fi
        else
            warn "Fail2ban service is not running"
            info "Start: sudo systemctl start fail2ban"
        fi
    else
        info "Cannot check Fail2ban status (requires sudo)"
    fi

    # Check fail2ban configuration files
    if [[ -f "/etc/fail2ban/jail.conf" ]] || [[ -f "/etc/fail2ban/jail.local" ]]; then
        pass "Fail2ban configuration exists"
    else
        warn "Fail2ban configuration not found"
    fi

else
    warn "Fail2ban not installed (recommended for SSH protection)"
    info "Install: sudo apt-get install fail2ban"
fi

# ============================================================================
# 6. PRODUCTION RUNBOOK DOCUMENTATION
# ============================================================================
section "6. Production Runbook Documentation"

if [[ -f "docs/PRODUCTION_RUNBOOK.md" ]]; then
    pass "Production runbook exists (docs/PRODUCTION_RUNBOOK.md)"

    # Check for firewall section
    if grep -q "Firewall" docs/PRODUCTION_RUNBOOK.md; then
        pass "Firewall configuration documented"
    else
        warn "Missing firewall configuration in runbook"
    fi

    # Check for deployment steps
    if grep -q "Deployment Steps\|Deployment" docs/PRODUCTION_RUNBOOK.md; then
        pass "Deployment steps documented"
    else
        warn "Missing deployment steps"
    fi

    # Check for security sections
    if grep -q "Security\|SSH\|Firewall" docs/PRODUCTION_RUNBOOK.md; then
        pass "Security procedures documented"
    else
        warn "Missing security procedures"
    fi

    # Check for monitoring
    if grep -q "Monitoring\|Logs" docs/PRODUCTION_RUNBOOK.md; then
        pass "Monitoring procedures documented"
    else
        warn "Missing monitoring procedures"
    fi

else
    fail "Production runbook not found (docs/PRODUCTION_RUNBOOK.md)"
fi

# ============================================================================
# 7. DOCKER NETWORK ISOLATION
# ============================================================================
section "7. Docker Network Isolation"

if command -v docker &> /dev/null; then
    pass "Docker is installed"

    # Check for custom networks (better isolation)
    if docker network ls 2>/dev/null | grep -q "starter-network\|ccw"; then
        pass "Custom Docker network configured (good isolation)"
    else
        info "Using default Docker network (consider custom networks)"
    fi

    # Check docker-compose.yml for network configuration
    if [[ -f "docker-compose.yml" ]]; then
        if grep -q "networks:" docker-compose.yml; then
            pass "Docker Compose networks configured"
        else
            info "Docker Compose using default network"
        fi
    fi

else
    info "Docker not installed (required for production deployment)"
fi

# ============================================================================
# 8. NGINX REVERSE PROXY VALIDATION
# ============================================================================
section "8. Nginx Reverse Proxy Validation"

if command -v nginx &> /dev/null; then
    pass "Nginx is installed"

    # Check if nginx is running
    if systemctl is-active --quiet nginx 2>/dev/null || pgrep nginx &>/dev/null; then
        pass "Nginx service is running"
    else
        warn "Nginx is not running (required for production)"
    fi

    # Check for reverse proxy configuration
    if [[ -d "/etc/nginx/sites-available" ]]; then
        if ls /etc/nginx/sites-available/ccw* &>/dev/null 2>&1; then
            pass "CCW-ERP nginx configuration exists"
        else
            info "CCW-ERP nginx site not configured yet"
        fi
    fi

    # Check nginx configuration syntax
    if nginx -t &>/dev/null 2>&1; then
        pass "Nginx configuration syntax is valid"
    else
        warn "Nginx configuration has errors"
    fi

else
    warn "Nginx not installed (required for production reverse proxy)"
    info "Install: sudo apt-get install nginx"
fi

# ============================================================================
# 9. IP WHITELISTING VALIDATION
# ============================================================================
section "9. IP Whitelisting Validation"

info "Checking SSH IP restrictions..."

if [[ $EUID -eq 0 ]] || sudo -n true 2>/dev/null; then
    # Check UFW rules for SSH IP restrictions
    UFW_RULES=$(sudo ufw status numbered 2>/dev/null || echo "")

    if echo "$UFW_RULES" | grep -q "22.*ALLOW.*from"; then
        pass "SSH access restricted to specific IPs"
    else
        warn "SSH open to all IPs (PRODUCTION RISK - restrict to admin IPs only)"
        info "Restrict: sudo ufw delete allow 22/tcp"
        info "Then: sudo ufw allow from YOUR_IP to any port 22"
    fi
else
    info "Cannot check IP whitelisting (requires sudo)"
fi

# ============================================================================
# 10. SECURITY HEADERS VALIDATION
# ============================================================================
section "10. Security Headers Validation"

info "Checking for security header configuration..."

# Check production runbook for nginx security headers
if grep -q "add_header Strict-Transport-Security\|HSTS" docs/PRODUCTION_RUNBOOK.md 2>/dev/null; then
    pass "HSTS (Strict-Transport-Security) documented in nginx config"
else
    warn "HSTS header not documented"
fi

if grep -q "add_header X-Frame-Options" docs/PRODUCTION_RUNBOOK.md 2>/dev/null; then
    pass "X-Frame-Options documented in nginx config"
else
    warn "X-Frame-Options header not documented"
fi

if grep -q "add_header X-Content-Type-Options" docs/PRODUCTION_RUNBOOK.md 2>/dev/null; then
    pass "X-Content-Type-Options documented in nginx config"
else
    warn "X-Content-Type-Options header not documented"
fi

# Check backend security headers middleware
if [[ -f "apps/backend/src/api/middleware/security_headers.py" ]]; then
    pass "Backend security headers middleware exists"
else
    warn "Backend security headers middleware not found"
fi

# ============================================================================
# 11. PORT SCANNING PROTECTION
# ============================================================================
section "11. Port Scanning Protection"

info "Validating port scanning protection measures..."

# Check for rate limiting in firewall script
if grep -q "ufw limit" scripts/configure-firewall.sh 2>/dev/null; then
    pass "Rate limiting configured (helps prevent port scanning)"
else
    warn "Rate limiting not configured"
fi

# Check for default deny policy
if grep -q "ufw default deny incoming" scripts/configure-firewall.sh 2>/dev/null; then
    pass "Default deny policy (minimizes attack surface)"
else
    fail "Missing default deny policy"
fi

# ============================================================================
# 12. INTRUSION DETECTION (OPTIONAL)
# ============================================================================
section "12. Intrusion Detection (Optional)"

if command -v aide &> /dev/null; then
    pass "AIDE (intrusion detection) is installed"
else
    info "AIDE not installed (optional but recommended)"
    info "Install: sudo apt-get install aide"
fi

if command -v rkhunter &> /dev/null; then
    pass "rkhunter (rootkit hunter) is installed"
else
    info "rkhunter not installed (optional but recommended)"
    info "Install: sudo apt-get install rkhunter"
fi

# ============================================================================
# 13. LOGGING & AUDIT CONFIGURATION
# ============================================================================
section "13. Logging & Audit Configuration"

info "Checking logging configuration..."

# Check for UFW logging
if [[ $EUID -eq 0 ]] || sudo -n true 2>/dev/null; then
    if sudo ufw status verbose 2>/dev/null | grep -q "Logging: on"; then
        pass "UFW logging is enabled"
    else
        warn "UFW logging may not be enabled (run: sudo ufw logging on)"
    fi
else
    info "Cannot check UFW logging (requires sudo)"
fi

# Check for auditd (system audit daemon)
if systemctl is-active --quiet auditd 2>/dev/null; then
    pass "auditd (system audit daemon) is running"
else
    info "auditd not running (optional but recommended for compliance)"
fi

# ============================================================================
# 14. NETWORK CONFIGURATION FILES
# ============================================================================
section "14. Network Configuration Files"

info "Checking network configuration documentation..."

# Check for network diagram or documentation
if [[ -f "docs/NETWORK_ARCHITECTURE.md" ]]; then
    pass "Network architecture documentation exists"
else
    info "Network architecture not documented (consider creating)"
fi

# Check for IP tables documentation
if [[ -f "docs/FIREWALL_RULES.md" ]]; then
    pass "Firewall rules documentation exists"
else
    info "Firewall rules not separately documented (documented in runbook)"
fi

# ============================================================================
# 15. SECURITY BEST PRACTICES
# ============================================================================
section "15. Security Best Practices Validation"

info "Validating security best practices..."

# Check for security warnings in firewall script
if grep -q "IMPORTANT\|WARNING\|CRITICAL" scripts/configure-firewall.sh 2>/dev/null; then
    pass "Security warnings present in firewall script"
else
    warn "Missing security warnings"
fi

# Check for production-specific notes
if grep -q "PRODUCTION\|production" scripts/configure-firewall.sh 2>/dev/null; then
    pass "Production-specific notes included"
else
    warn "Missing production-specific guidance"
fi

# Check for IPv6 configuration
if grep -q "ip6tables\|IPv6" scripts/configure-firewall.sh 2>/dev/null; then
    info "IPv6 firewall rules documented"
else
    info "IPv6 firewall rules not explicitly configured"
fi

# ============================================================================
# 16. PRODUCTION DEPLOYMENT CHECKLIST
# ============================================================================
section "16. Production Deployment Checklist"

echo ""
echo "Production Deployment Checklist:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DEPLOYMENT_CHECKS=(
    "scripts/configure-firewall.sh:Firewall configuration script"
    "docs/PRODUCTION_RUNBOOK.md:Production runbook"
    "/usr/sbin/ufw:UFW installed"
    "/usr/bin/fail2ban-client:Fail2ban installed"
    "/usr/sbin/nginx:Nginx installed"
)

DEPLOYMENT_PASS=0
DEPLOYMENT_TOTAL=${#DEPLOYMENT_CHECKS[@]}

for check in "${DEPLOYMENT_CHECKS[@]}"; do
    file="${check%%:*}"
    desc="${check#*:}"

    if [[ -f "$file" ]] || command -v "${file##*/}" &>/dev/null; then
        echo -e "${GREEN}✓${NC} $desc"
        ((DEPLOYMENT_PASS++))
    else
        echo -e "${YELLOW}○${NC} $desc (pending)"
    fi
done

echo ""
if [[ $DEPLOYMENT_PASS -ge 3 ]]; then
    echo -e "${GREEN}✓ CORE COMPONENTS: $DEPLOYMENT_PASS/$DEPLOYMENT_TOTAL READY${NC}"
else
    echo -e "${YELLOW}⚠ COMPONENTS: $DEPLOYMENT_PASS/$DEPLOYMENT_TOTAL READY${NC}"
fi

# Optional but recommended
echo ""
echo "Optional but Recommended:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

OPTIONAL_CHECKS=(
    "fail2ban:Fail2ban for SSH protection"
    "aide:AIDE for intrusion detection"
    "rkhunter:rkhunter for rootkit detection"
    "auditd:auditd for system auditing"
)

for check in "${OPTIONAL_CHECKS[@]}"; do
    cmd="${check%%:*}"
    desc="${check#*:}"

    if command -v "$cmd" &>/dev/null; then
        echo -e "${GREEN}✓${NC} $desc"
    else
        echo -e "${YELLOW}○${NC} $desc (optional)"
    fi
done

# ============================================================================
# 17. PRODUCTION READINESS SUMMARY
# ============================================================================
section "17. Production Readiness Summary"

echo ""
echo "Pre-Deployment Actions Required:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Install UFW (if not installed):"
echo "   sudo apt-get install ufw"
echo ""
echo "2. Run firewall configuration:"
echo "   sudo bash scripts/configure-firewall.sh"
echo ""
echo "3. CRITICAL: Restrict SSH to admin IPs only:"
echo "   sudo ufw delete allow 22/tcp"
echo "   sudo ufw allow from YOUR_ADMIN_IP to any port 22"
echo ""
echo "4. Install Fail2ban (recommended):"
echo "   sudo apt-get install fail2ban"
echo "   sudo systemctl enable fail2ban"
echo "   sudo systemctl start fail2ban"
echo ""
echo "5. Configure SSH hardening:"
echo "   Edit /etc/ssh/sshd_config:"
echo "   - PermitRootLogin no"
echo "   - PasswordAuthentication no"
echo "   - PubkeyAuthentication yes"
echo "   sudo systemctl restart sshd"
echo ""
echo "6. Install and configure Nginx:"
echo "   sudo apt-get install nginx"
echo "   Configure as reverse proxy (see docs/PRODUCTION_RUNBOOK.md)"
echo ""
echo "7. Enable UFW logging:"
echo "   sudo ufw logging on"
echo ""
echo "8. Verify firewall status:"
echo "   sudo ufw status numbered"
echo ""

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
        echo "🎉 Firewall and network security infrastructure is fully configured!"
        echo ""
        echo "Next steps:"
        echo "  1. Deploy to production server"
        echo "  2. Run: sudo bash scripts/configure-firewall.sh"
        echo "  3. Restrict SSH to admin IPs"
        echo "  4. Install Fail2ban for SSH protection"
        echo "  5. Configure Nginx as reverse proxy"
        echo "  6. Test firewall rules"
        echo "  7. Monitor logs for intrusion attempts"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚠ PASSED WITH WARNINGS${NC}"
        echo ""
        echo "✓ Core firewall infrastructure is in place"
        echo "⚠ Some optional components missing - review warnings above"
        echo ""
        echo "Next steps:"
        echo "  1. Review warnings above"
        echo "  2. Deploy firewall configuration on production server"
        echo "  3. Install optional security tools (Fail2ban, AIDE, rkhunter)"
        echo "  4. Configure SSH hardening"
        echo "  5. Test firewall rules thoroughly"
        echo ""
        exit 0
    fi
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo ""
    echo "Critical issues detected. Fix the following:"
    echo "  - Review failed checks above"
    echo "  - Ensure firewall configuration script exists"
    echo "  - Verify security best practices are documented"
    echo "  - Run verification again after fixes"
    echo ""
    exit 1
fi
