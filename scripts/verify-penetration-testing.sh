#!/usr/bin/env bash
#
# ISS-028 Verification: Security Penetration Testing
#
# This script verifies penetration testing readiness and provides guidance for
# conducting comprehensive security testing including OWASP Top 10 validation,
# authentication testing, API security testing, and vulnerability scanning.
#
# Usage:
#   ./scripts/verify-penetration-testing.sh
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
echo "║    ISS-028 VERIFICATION: Security Penetration Testing             ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 1. PENETRATION TESTING TOOLS AVAILABILITY
# ============================================================================
section "1. Penetration Testing Tools Availability"

info "Checking for common penetration testing tools..."

# Web application security testing tools
TOOLS=(
    "nmap:Network scanning and discovery"
    "nikto:Web server vulnerability scanner"
    "sqlmap:SQL injection testing"
    "burpsuite:Web application security testing (commercial)"
    "owasp-zap:OWASP ZAP proxy (free alternative to Burp Suite)"
    "nuclei:Vulnerability scanner with templates"
    "ffuf:Fuzzing tool for web applications"
    "gobuster:Directory/file brute-forcing"
    "curl:HTTP client for API testing"
    "jq:JSON processor for API testing"
)

TOOLS_FOUND=0
TOOLS_TOTAL=${#TOOLS[@]}

for tool_desc in "${TOOLS[@]}"; do
    tool="${tool_desc%%:*}"
    desc="${tool_desc#*:}"

    if command -v "$tool" &>/dev/null; then
        pass "$desc ($tool installed)"
        ((TOOLS_FOUND++))
    else
        info "$desc ($tool not installed)"
    fi
done

if [[ $TOOLS_FOUND -ge 3 ]]; then
    pass "Basic penetration testing tools available ($TOOLS_FOUND/$TOOLS_TOTAL)"
else
    warn "Limited penetration testing tools ($TOOLS_FOUND/$TOOLS_TOTAL)"
    info "Consider installing: nmap, curl, jq (minimum requirements)"
fi

# ============================================================================
# 2. SECURITY AUDIT COMPLETION
# ============================================================================
section "2. Security Audit Completion (Pre-requisite)"

AUDIT_FILE="docs/SECURITY_AUDIT_REPORT.md"

if [[ -f "$AUDIT_FILE" ]]; then
    pass "Security audit report exists"

    # Check for critical issues
    if grep -q "0 critical\|CRITICAL.*0" "$AUDIT_FILE"; then
        pass "No critical security issues reported"
    else
        fail "Critical security issues may exist"
    fi

    # Check for OWASP Top 10 coverage
    if grep -q "OWASP Top 10" "$AUDIT_FILE"; then
        pass "OWASP Top 10 coverage documented"
    else
        warn "OWASP Top 10 coverage not documented"
    fi

else
    fail "Security audit report not found (ISS-024 pre-requisite)"
    info "Complete ISS-024 (Security Audit) before penetration testing"
fi

# ============================================================================
# 3. AUTHENTICATION SECURITY TESTING READINESS
# ============================================================================
section "3. Authentication Security Testing Readiness"

info "Checking authentication security implementation..."

AUTH_FILE="apps/backend/src/api/routes/demo_auth.py"

if [[ -f "$AUTH_FILE" ]]; then
    # Check for bcrypt password hashing
    if grep -q "bcrypt\|passlib" apps/backend/src 2>/dev/null; then
        pass "Password hashing implemented (bcrypt)"
    else
        fail "Password hashing may be weak"
    fi

    # Check for JWT implementation
    if grep -q "jwt\|JWT" apps/backend/src 2>/dev/null; then
        pass "JWT authentication implemented"
    else
        fail "JWT authentication not found"
    fi

    # Check for rate limiting on auth endpoints
    if grep -q "@limiter.limit" "$AUTH_FILE" 2>/dev/null; then
        pass "Rate limiting on authentication endpoints"
    else
        warn "Authentication endpoints may lack rate limiting"
    fi
fi

# ============================================================================
# 4. SQL INJECTION PROTECTION VALIDATION
# ============================================================================
section "4. SQL Injection Protection Validation"

info "Checking SQL injection protection mechanisms..."

# Check for SQLAlchemy ORM usage (prevents SQL injection)
if find apps/backend/src -name "*.py" -exec grep -l "SQLAlchemy\|from sqlalchemy" {} \; 2>/dev/null | grep -q "."; then
    pass "SQLAlchemy ORM in use (prevents SQL injection)"
else
    fail "ORM not found - may be vulnerable to SQL injection"
fi

# Check for raw SQL queries (potential vulnerability)
if find apps/backend/src -name "*.py" -exec grep -l "execute.*f\"\|execute.*%" {} \; 2>/dev/null | grep -q "."; then
    warn "Potential SQL injection: String formatting in execute() found"
    info "Review: find apps/backend/src -exec grep -n 'execute.*f\"' {} +"
else
    pass "No string formatting in SQL queries detected"
fi

# ============================================================================
# 5. XSS PROTECTION VALIDATION
# ============================================================================
section "5. XSS Protection Validation"

info "Checking XSS protection mechanisms..."

# Check for React usage (auto-escaping)
if find apps/web -name "*.tsx" -o -name "*.jsx" 2>/dev/null | head -1 | grep -q "."; then
    pass "React framework in use (auto-escaping by default)"
else
    warn "React not detected"
fi

# Check for dangerouslySetInnerHTML (XSS risk)
if find apps/web -name "*.tsx" -o -name "*.jsx" 2>/dev/null -exec grep -l "dangerouslySetInnerHTML" {} \; | grep -q "."; then
    warn "dangerouslySetInnerHTML usage found (XSS risk)"
    info "Review: grep -rn dangerouslySetInnerHTML apps/web/"
else
    pass "No dangerouslySetInnerHTML usage found"
fi

# Check for CSP headers
if grep -r "Content-Security-Policy\|CSP" apps/backend/src docs/ 2>/dev/null | grep -q "."; then
    pass "Content Security Policy configured"
else
    warn "Content Security Policy not explicitly configured"
fi

# ============================================================================
# 6. CSRF PROTECTION VALIDATION
# ============================================================================
section "6. CSRF Protection Validation"

info "Checking CSRF protection mechanisms..."

# Check for SameSite cookie attribute
if grep -r "SameSite.*Strict\|SameSite.*Lax" apps/backend/src 2>/dev/null | grep -q "."; then
    pass "SameSite cookie attribute configured"
else
    warn "SameSite cookie attribute not found"
fi

# Check for CSRF token implementation
if grep -r "csrf\|CSRF" apps/backend/src 2>/dev/null | grep -q "."; then
    pass "CSRF references found in codebase"
else
    info "CSRF token not explicitly implemented (JWT in headers may be sufficient)"
fi

# ============================================================================
# 7. API SECURITY TESTING READINESS
# ============================================================================
section "7. API Security Testing Readiness"

info "Checking API security measures..."

# Check for rate limiting
if [[ -f "apps/backend/src/api/middleware/rate_limit.py" ]]; then
    pass "API rate limiting implemented"
else
    fail "API rate limiting not found"
fi

# Check for authentication middleware
if [[ -f "apps/backend/src/api/middleware/auth.py" ]]; then
    pass "Authentication middleware exists"
else
    fail "Authentication middleware not found"
fi

# Check for input validation (Pydantic)
if grep -r "from pydantic import\|BaseModel" apps/backend/src 2>/dev/null | grep -q "."; then
    pass "Input validation implemented (Pydantic)"
else
    warn "Input validation may be incomplete"
fi

# Check for CORS configuration
if grep -r "CORSMiddleware\|CORS" apps/backend/src 2>/dev/null | grep -q "."; then
    pass "CORS middleware configured"
else
    warn "CORS configuration not found"
fi

# ============================================================================
# 8. NETWORK SECURITY TESTING READINESS
# ============================================================================
section "8. Network Security Testing Readiness"

info "Checking network security configuration..."

# Check for firewall configuration
if [[ -f "scripts/configure-firewall.sh" ]]; then
    pass "Firewall configuration script exists"
else
    warn "Firewall configuration script not found (ISS-026)"
fi

# Check for SSL/TLS configuration
if grep -r "ssl\|tls\|https" docs/ 2>/dev/null | grep -i "certificate\|SSL\|TLS" | head -1 | grep -q "."; then
    pass "SSL/TLS configuration documented"
else
    warn "SSL/TLS configuration not documented"
fi

# ============================================================================
# 9. SESSION MANAGEMENT TESTING READINESS
# ============================================================================
section "9. Session Management Testing Readiness"

info "Checking session management security..."

# Check for secure cookie flags
if grep -r "secure.*=.*True\|httponly.*=.*True" apps/backend/src 2>/dev/null | grep -i "cookie" | grep -q "."; then
    pass "Secure cookie flags configured"
else
    warn "Secure cookie flags may not be configured"
fi

# Check for session timeout
if grep -r "expire\|timeout\|TTL" apps/backend/src 2>/dev/null | grep -i "jwt\|session\|token" | grep -q "."; then
    pass "Session/token expiration configured"
else
    warn "Session expiration not explicitly configured"
fi

# ============================================================================
# 10. ACCESS CONTROL TESTING READINESS
# ============================================================================
section "10. Access Control Testing Readiness"

info "Checking access control implementation..."

# Check for role-based access control
if grep -r "role\|permission\|is_admin" apps/backend/src 2>/dev/null | grep -q "."; then
    pass "Role-based access control references found"
else
    warn "Access control may not be implemented"
fi

# Check for authorization checks
if grep -r "Depends.*get_current_user\|require.*auth" apps/backend/src 2>/dev/null | grep -q "."; then
    pass "Authorization checks in place"
else
    warn "Authorization checks may be incomplete"
fi

# ============================================================================
# 11. DEPENDENCY VULNERABILITY SCANNING
# ============================================================================
section "11. Dependency Vulnerability Scanning"

info "Checking for dependency vulnerabilities..."

# Frontend dependencies
if [[ -f "apps/web/package.json" ]]; then
    if command -v npm &>/dev/null; then
        info "Running npm audit (frontend)..."
        if cd apps/web && npm audit --audit-level=moderate 2>&1 | grep -q "found 0 vulnerabilities"; then
            pass "Frontend dependencies: 0 vulnerabilities"
        else
            warn "Frontend dependencies may have vulnerabilities (run: cd apps/web && npm audit)"
        fi
        cd "$PROJECT_ROOT"
    else
        info "npm not available - skip frontend audit"
    fi
fi

# Backend dependencies
if [[ -f "apps/backend/pyproject.toml" ]]; then
    if command -v pip-audit &>/dev/null; then
        info "Running pip-audit (backend)..."
        if cd apps/backend && pip-audit 2>&1 | grep -q "No known vulnerabilities found"; then
            pass "Backend dependencies: 0 vulnerabilities"
        else
            warn "Backend dependencies may have vulnerabilities (run: cd apps/backend && pip-audit)"
        fi
        cd "$PROJECT_ROOT"
    else
        info "pip-audit not available (install: pip install pip-audit)"
    fi
fi

# ============================================================================
# 12. PENETRATION TESTING DOCUMENTATION
# ============================================================================
section "12. Penetration Testing Documentation"

info "Checking for penetration testing documentation..."

# Check for penetration testing guide
if [[ -f "docs/PENETRATION_TESTING.md" ]]; then
    pass "Penetration testing guide exists"
else
    info "Penetration testing guide not found (will be created)"
fi

# Check for security findings template
if [[ -f "docs/SECURITY_FINDINGS_TEMPLATE.md" ]]; then
    pass "Security findings template exists"
else
    info "Security findings template not found"
fi

# ============================================================================
# 13. TEST ENVIRONMENT READINESS
# ============================================================================
section "13. Test Environment Readiness"

info "Checking test environment configuration..."

# Check if application is running
if curl -s http://localhost:8000/api/health &>/dev/null; then
    pass "Backend API is accessible (http://localhost:8000)"
elif curl -s http://localhost:3000 &>/dev/null; then
    pass "Frontend is accessible (http://localhost:3000)"
else
    warn "Application not running (start with: pnpm dev)"
    info "Penetration testing requires running application"
fi

# Check for test database
if grep -q "test\|staging" .env* 2>/dev/null; then
    pass "Test/staging environment configuration found"
else
    warn "Use test/staging environment for penetration testing (NOT production)"
fi

# ============================================================================
# 14. OWASP TOP 10 TESTING CHECKLIST
# ============================================================================
section "14. OWASP Top 10 Testing Checklist"

echo ""
echo "OWASP Top 10 (2021) Testing Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

OWASP_ITEMS=(
    "A01 Broken Access Control:Verify authorization checks on all endpoints"
    "A02 Cryptographic Failures:Test password hashing JWT secrets SSL/TLS"
    "A03 Injection:Test SQL injection XSS LDAP OS command injection"
    "A04 Insecure Design:Verify rate limiting account lockout security controls"
    "A05 Security Misconfiguration:Check default passwords debug mode CORS"
    "A06 Vulnerable Components:Scan dependencies with npm audit pip-audit"
    "A07 Authentication Failures:Test brute force password reset session management"
    "A08 Data Integrity Failures:Verify webhook signatures CI/CD security"
    "A09 Logging Failures:Check security event logging monitoring"
    "A10 SSRF:Test URL validation external requests"
)

for item in "${OWASP_ITEMS[@]}"; do
    vuln="${item%%:*}"
    test="${item#*:}"
    echo -e "${YELLOW}○${NC} $vuln"
    echo "   → $test"
done

# ============================================================================
# 15. PENETRATION TESTING METHODOLOGY
# ============================================================================
section "15. Penetration Testing Methodology"

echo ""
echo "Recommended Testing Phases:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Phase 1: Reconnaissance (Information Gathering)"
echo "  • Port scanning (nmap)"
echo "  • Service enumeration"
echo "  • Technology fingerprinting"
echo "  • Directory/file discovery (gobuster, ffuf)"
echo ""
echo "Phase 2: Vulnerability Assessment"
echo "  • Automated scanning (OWASP ZAP, Nikto, Nuclei)"
echo "  • Manual code review"
echo "  • Dependency vulnerability scanning"
echo "  • Configuration review"
echo ""
echo "Phase 3: Exploitation (Controlled)"
echo "  • SQL injection testing (sqlmap)"
echo "  • XSS testing (manual + automated)"
echo "  • Authentication bypass attempts"
echo "  • Authorization testing"
echo "  • CSRF testing"
echo "  • API security testing"
echo ""
echo "Phase 4: Post-Exploitation (Simulated)"
echo "  • Privilege escalation attempts"
echo "  • Data access validation"
echo "  • Lateral movement testing"
echo ""
echo "Phase 5: Reporting"
echo "  • Document all findings"
echo "  • Severity classification (Critical, High, Medium, Low)"
echo "  • Proof of concept for each finding"
echo "  • Remediation recommendations"
echo ""
echo "Phase 6: Re-testing"
echo "  • Verify fixes for all findings"
echo "  • Regression testing"
echo "  • Final validation"
echo ""

# ============================================================================
# 16. PRE-TESTING SECURITY CHECKLIST
# ============================================================================
section "16. Pre-Testing Security Checklist"

echo ""
echo "Security Measures Verification:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PRE_TEST_CHECKS=(
    "$AUDIT_FILE:Security audit completed (ISS-024)"
    "scripts/configure-firewall.sh:Firewall configured (ISS-026)"
    "apps/backend/src/api/middleware/rate_limit.py:Rate limiting implemented (ISS-027)"
    ".env.production.example:Production secrets documented (ISS-025)"
)

PRE_TEST_PASS=0
PRE_TEST_TOTAL=${#PRE_TEST_CHECKS[@]}

for check in "${PRE_TEST_CHECKS[@]}"; do
    file="${check%%:*}"
    desc="${check#*:}"

    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓${NC} $desc"
        ((PRE_TEST_PASS++))
    else
        echo -e "${RED}✗${NC} $desc"
    fi
done

echo ""
if [[ $PRE_TEST_PASS -eq $PRE_TEST_TOTAL ]]; then
    echo -e "${GREEN}✓ PRE-REQUISITES: $PRE_TEST_PASS/$PRE_TEST_TOTAL COMPLETE${NC}"
else
    echo -e "${YELLOW}⚠ PRE-REQUISITES: $PRE_TEST_PASS/$PRE_TEST_TOTAL COMPLETE${NC}"
    echo "Complete missing security measures before penetration testing"
fi

# ============================================================================
# 17. PENETRATION TESTING COMMANDS
# ============================================================================
section "17. Penetration Testing Commands"

echo ""
echo "Common Penetration Testing Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Port Scanning (nmap):"
echo "   nmap -sV -sC -p- localhost"
echo "   nmap -sV localhost -oN nmap-scan.txt"
echo ""
echo "2. Web Server Scanning (nikto):"
echo "   nikto -h http://localhost:8000"
echo ""
echo "3. Directory Brute-forcing (gobuster):"
echo "   gobuster dir -u http://localhost:8000 -w /usr/share/wordlists/dirb/common.txt"
echo ""
echo "4. SQL Injection Testing (sqlmap):"
echo "   sqlmap -u \"http://localhost:8000/api/endpoint?id=1\" --batch"
echo ""
echo "5. OWASP ZAP Automated Scan:"
echo "   zap-cli quick-scan http://localhost:8000"
echo ""
echo "6. API Security Testing (curl):"
echo "   # Test authentication bypass"
echo "   curl -X GET http://localhost:8000/api/products -H 'Authorization: Bearer fake_token'"
echo ""
echo "   # Test SQL injection"
echo "   curl -X GET \"http://localhost:8000/api/products?search=' OR '1'='1\""
echo ""
echo "   # Test XSS"
echo "   curl -X POST http://localhost:8000/api/products -d '{\"name\":\"<script>alert('XSS')</script>\"}'"
echo ""
echo "7. Rate Limiting Testing:"
echo "   for i in {1..20}; do curl -X POST http://localhost:8000/api/demo-auth/login; done"
echo ""
echo "8. Dependency Scanning:"
echo "   npm audit --audit-level=moderate  # Frontend"
echo "   pip-audit  # Backend"
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
        echo -e "${GREEN}✓ PENETRATION TESTING READY${NC}"
        echo ""
        echo "🎯 Security measures are in place - ready for penetration testing!"
        echo ""
        echo "Next steps:"
        echo "  1. Set up test environment (NOT production)"
        echo "  2. Run reconnaissance (nmap, directory discovery)"
        echo "  3. Perform automated scanning (OWASP ZAP, Nikto)"
        echo "  4. Conduct manual testing (SQL injection, XSS, auth bypass)"
        echo "  5. Document all findings with severity levels"
        echo "  6. Fix vulnerabilities and re-test"
        echo "  7. Generate final penetration testing report"
        echo ""
        echo "See: docs/ISS-028-VERIFICATION.md for detailed testing procedures"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚠ READY WITH RECOMMENDATIONS${NC}"
        echo ""
        echo "✓ Core security measures are in place"
        echo "⚠ Some enhancements recommended - review warnings above"
        echo ""
        echo "Proceed with penetration testing:"
        echo "  1. Address warnings (optional but recommended)"
        echo "  2. Use test/staging environment"
        echo "  3. Follow testing methodology (see above)"
        echo "  4. Document findings thoroughly"
        echo "  5. Re-test after fixes"
        echo ""
        exit 0
    fi
else
    echo -e "${RED}✗ NOT READY FOR PENETRATION TESTING${NC}"
    echo ""
    echo "Critical issues detected. Complete the following first:"
    echo "  - Review failed checks above"
    echo "  - Complete security audit (ISS-024)"
    echo "  - Implement rate limiting (ISS-027)"
    echo "  - Configure firewall (ISS-026)"
    echo "  - Implement authentication and authorization"
    echo "  - Run verification again after fixes"
    echo ""
    exit 1
fi
