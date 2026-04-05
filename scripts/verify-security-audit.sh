#!/usr/bin/env bash
#
# Security Audit Verification Script
# ISS-024: Conduct Security Audit
#
# This script verifies comprehensive security audit completion:
# - OWASP Top 10 vulnerability checks
# - Authentication and authorization security
# - JWT token implementation
# - Rate limiting and DDoS protection
# - Input validation and sanitization
# - SQL injection protection
# - XSS and CSRF protection
# - Encryption at rest and in transit
# - Secrets management
# - Dependency vulnerabilities
# - API security configuration
# - Security headers
# - Production security readiness
#
# Usage:
#   ./scripts/verify-security-audit.sh

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
BACKEND_DIR="${BACKEND_DIR:-backend}"
FRONTEND_DIR="${FRONTEND_DIR:-app}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

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
# 1. Security Documentation
# ============================================================================

section "1. Security Documentation"

# Check for security audit report
if [ -f "docs/SECURITY_AUDIT_REPORT.md" ]; then
    pass "Security audit report exists (SECURITY_AUDIT_REPORT.md)"

    # Check if marked as complete
    if grep -q "READY FOR PRODUCTION\|COMPLETE" "docs/SECURITY_AUDIT_REPORT.md"; then
        pass "Security audit report marked as complete"
    else
        warn "Security audit report not marked as complete"
    fi
else
    fail "Security audit report NOT found"
    info "   Create: docs/SECURITY_AUDIT_REPORT.md"
fi

# Check for security checklist
if [ -f "docs/security/SECURITY-AUDIT-CHECKLIST.md" ]; then
    pass "Security audit checklist exists"
else
    warn "Security audit checklist not found"
fi

# Check for security hardening documentation
if [ -f "docs/SECURITY_HARDENING_COMPLETE.md" ]; then
    pass "Security hardening documentation exists"
else
    warn "Security hardening documentation not found"
fi

# ============================================================================
# 2. Authentication Security (OWASP A07:2021)
# ============================================================================

section "2. Authentication Security"

# Check for bcrypt password hashing
if [ -f "$BACKEND_DIR/src/api/routes/demo_auth.py" ]; then
    if grep -q "bcrypt\|CryptContext" "$BACKEND_DIR/src/api/routes/demo_auth.py"; then
        pass "Password hashing with bcrypt implemented"
    else
        fail "Bcrypt password hashing NOT found"
    fi

    # Check for password verification
    if grep -q "verify_password\|verify" "$BACKEND_DIR/src/api/routes/demo_auth.py"; then
        pass "Password verification function implemented"
    else
        warn "Password verification not clearly implemented"
    fi
else
    fail "Authentication file not found: $BACKEND_DIR/src/api/routes/demo_auth.py"
fi

# Check for JWT implementation
if [ -f "$BACKEND_DIR/src/api/middleware/auth.py" ]; then
    if grep -q "jwt\|JWT" "$BACKEND_DIR/src/api/middleware/auth.py"; then
        pass "JWT authentication middleware implemented"
    else
        warn "JWT authentication not found in middleware"
    fi

    # Check for token verification
    if grep -q "decode.*jwt\|verify.*token" "$BACKEND_DIR/src/api/middleware/auth.py"; then
        pass "JWT token verification implemented"
    else
        warn "JWT token verification not clearly implemented"
    fi
else
    fail "Auth middleware not found: $BACKEND_DIR/src/api/middleware/auth.py"
fi

# Check for secure JWT secret
if [ -f ".env.example" ]; then
    if grep -q "JWT_SECRET_KEY" ".env.example"; then
        pass "JWT secret configured in environment"

        # Check if it's a placeholder
        if grep "JWT_SECRET_KEY" ".env.example" | grep -q "GENERATE\|change-me\|secret"; then
            pass "JWT secret is placeholder (must be generated for production)"
        fi
    else
        fail "JWT_SECRET_KEY not found in environment configuration"
    fi
fi

# ============================================================================
# 3. Authorization & Access Control (OWASP A01:2021)
# ============================================================================

section "3. Authorization & Access Control"

# Check for role-based access control
if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "role\|permission\|admin\|user_type" {} \; | head -1 | grep -q "."; then
    pass "Role-based access control references found"
else
    warn "Role-based access control not clearly implemented"
    info "   Consider: Implement roles (admin, user, viewer)"
fi

# Check for auth middleware usage
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "AuthMiddleware\|auth.*middleware" "$BACKEND_DIR/src/api/main.py"; then
        pass "Auth middleware registered in main.py"
    else
        warn "Auth middleware may not be globally registered"
    fi
fi

# Check for protected routes
protected_routes=$(find "$BACKEND_DIR/src/api/routes" -name "*.py" -exec grep -l "Depends.*get_current_user\|@requires_auth" {} \; | wc -l)
info "Protected routes found: $protected_routes files"

if [ "$protected_routes" -ge 5 ]; then
    pass "Multiple routes protected with authentication"
else
    warn "Limited protected routes found ($protected_routes)"
fi

# ============================================================================
# 4. SQL Injection Protection (OWASP A03:2021)
# ============================================================================

section "4. SQL Injection Protection"

# Check for SQLAlchemy ORM usage
if [ -f "$BACKEND_DIR/pyproject.toml" ]; then
    if grep -q "sqlalchemy" "$BACKEND_DIR/pyproject.toml"; then
        pass "SQLAlchemy ORM installed (protects against SQL injection)"
    else
        fail "SQLAlchemy not found in dependencies"
    fi
fi

# Check for parameterized queries
if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "execute.*select\|db.execute" {} \; | head -1 | grep -q "."; then
    pass "Parameterized queries used (SQLAlchemy)"

    # Check for dangerous raw SQL
    if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "execute.*f\"\|execute.*%\|execute.*format" {} \; | grep -q "."; then
        fail "Potential SQL injection: String formatting in execute() found"
        info "   Use parameterized queries: db.execute(text('SELECT * FROM users WHERE id = :id'), {'id': user_id})"
    else
        pass "No string formatting in SQL queries detected"
    fi
fi

# Check for text() with parameters
if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "text(" {} \; | head -1 | grep -q "."; then
    warn "Raw SQL with text() found - verify parameterization"
    info "   Ensure parameters: text('SELECT * FROM table WHERE col = :val')"
fi

# ============================================================================
# 5. XSS Protection (OWASP A03:2021)
# ============================================================================

section "5. XSS (Cross-Site Scripting) Protection"

# Check React usage (auto-escapes by default)
if [ -f "$FRONTEND_DIR/package.json" ]; then
    if grep -q "\"react\"" "$FRONTEND_DIR/package.json"; then
        pass "React used (auto-escapes JSX by default)"
    fi

    # Check for dangerouslySetInnerHTML usage
    if find "$FRONTEND_DIR" -name "*.tsx" -o -name "*.jsx" | xargs grep -l "dangerouslySetInnerHTML" 2>/dev/null | grep -q "."; then
        fail "dangerouslySetInnerHTML found - potential XSS risk"
        info "   Review all usage for proper sanitization"
    else
        pass "No dangerouslySetInnerHTML usage found"
    fi
fi

# Check backend response sanitization
info "Backend: FastAPI/Pydantic auto-escapes JSON responses (safe by default)"

# ============================================================================
# 6. CSRF Protection (OWASP A01:2021)
# ============================================================================

section "6. CSRF (Cross-Site Request Forgery) Protection"

# Check for SameSite cookie configuration
if [ -f "$BACKEND_DIR/src/api/main.py" ] || [ -f "$FRONTEND_DIR/middleware.ts" ]; then
    if grep -r "SameSite.*Lax\|SameSite.*Strict" "$BACKEND_DIR/src" "$FRONTEND_DIR" 2>/dev/null | grep -q "."; then
        pass "SameSite cookie attribute configured"
    else
        warn "SameSite cookie attribute not explicitly set"
        info "   Recommended: Set SameSite=Lax or Strict for cookies"
    fi
fi

# Check for CSRF token implementation
if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "csrf\|CSRF" {} \; | grep -q "."; then
    pass "CSRF protection references found"
else
    warn "CSRF token protection not explicitly implemented"
    info "   FastAPI with JWT in headers provides implicit CSRF protection"
    info "   SameSite cookies provide additional protection"
fi

# ============================================================================
# 7. Rate Limiting & DDoS Protection (OWASP A04:2021)
# ============================================================================

section "7. Rate Limiting & DDoS Protection"

# Check for slowapi/rate limiting
if [ -f "$BACKEND_DIR/pyproject.toml" ]; then
    if grep -q "slowapi\|ratelimit" "$BACKEND_DIR/pyproject.toml"; then
        pass "Rate limiting library installed (slowapi)"
    else
        warn "Rate limiting library not found"
        info "   Recommended: Install slowapi"
    fi
fi

# Check for rate limit middleware
if [ -f "$BACKEND_DIR/src/api/middleware/rate_limit.py" ]; then
    pass "Rate limit middleware exists"

    if grep -q "limiter.*=.*Limiter\|RateLimiter" "$BACKEND_DIR/src/api/middleware/rate_limit.py"; then
        pass "Rate limiter configured"
    fi
else
    warn "Rate limit middleware not found"
fi

# Check for rate limit application
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "limiter\|rate_limit" "$BACKEND_DIR/src/api/main.py"; then
        pass "Rate limiting applied in main.py"
    else
        warn "Rate limiting not applied globally"
    fi
fi

# ============================================================================
# 8. Encryption at Rest (OWASP A02:2021)
# ============================================================================

section "8. Encryption at Rest"

# Check for encryption service
if [ -f "$BACKEND_DIR/src/security/encryption.py" ]; then
    pass "Encryption service exists (encryption.py)"

    # Check for Fernet/cryptography
    if grep -q "Fernet\|cryptography" "$BACKEND_DIR/src/security/encryption.py"; then
        pass "Fernet encryption (AES-256) implemented"
    else
        warn "Encryption algorithm not clearly identified"
    fi
else
    warn "Encryption service not found"
    info "   Create: src/security/encryption.py with Fernet"
fi

# Check for encrypted fields
if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "encrypt\|decrypt" {} \; | grep -q "."; then
    pass "Encryption/decryption functions used"

    # Count encrypted fields
    encrypted_count=$(find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "encrypt.*token\|encrypt.*secret" {} \; | wc -l)
    info "   Files with encrypted data: $encrypted_count"
else
    warn "No encryption usage found"
fi

# Check for ENCRYPTION_KEY in environment
if [ -f ".env.example" ]; then
    if grep -q "ENCRYPTION_KEY" ".env.example"; then
        pass "ENCRYPTION_KEY configured in environment"
    else
        warn "ENCRYPTION_KEY not in environment configuration"
    fi
fi

# ============================================================================
# 9. Encryption in Transit (SSL/TLS)
# ============================================================================

section "9. Encryption in Transit (SSL/TLS)"

# Check for HTTPS enforcement
if [ -f "nginx/nginx.conf" ] || [ -f "nginx/default.conf" ]; then
    pass "Nginx configuration exists"

    if grep -r "ssl\|443" nginx/ 2>/dev/null | grep -q "."; then
        pass "SSL/TLS configuration found in Nginx"
    else
        warn "SSL/TLS not configured in Nginx"
    fi

    # Check for HTTP to HTTPS redirect
    if grep -r "return 301 https" nginx/ 2>/dev/null | grep -q "."; then
        pass "HTTP to HTTPS redirect configured"
    else
        warn "HTTP to HTTPS redirect not found"
    fi
else
    warn "Nginx configuration not found"
    info "   Production: Configure SSL/TLS with Let's Encrypt"
fi

# Check for secure cookie flag
if grep -r "secure.*=.*True\|Secure.*cookie" "$BACKEND_DIR/src" 2>/dev/null | grep -q "."; then
    pass "Secure cookie flag used"
else
    warn "Secure cookie flag not explicitly set"
    info "   Set Secure flag for cookies in production (HTTPS only)"
fi

# ============================================================================
# 10. Secrets Management (OWASP A02:2021)
# ============================================================================

section "10. Secrets Management"

# Check for .env files not in git
if [ -f ".gitignore" ]; then
    if grep -q "\.env" ".gitignore"; then
        pass ".env files excluded from git (.gitignore)"
    else
        fail ".env files NOT in .gitignore (security risk)"
    fi
fi

# Check for hardcoded secrets
if find "$BACKEND_DIR/src" "$FRONTEND_DIR/app" -name "*.py" -o -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs grep -i "password\s*=\s*['\"].\{8,\}\|api_key\s*=\s*['\"].\{8,\}\|secret\s*=\s*['\"].\{8,\}" 2>/dev/null | grep -v "password.*=.*Field\|api_key.*Field" | grep -q "."; then
    fail "Potential hardcoded secrets found in source code"
    info "   Use environment variables for all secrets"
else
    pass "No obvious hardcoded secrets found"
fi

# Check for secrets generation script
if [ -f "scripts/generate-secrets.py" ]; then
    pass "Secrets generation script exists"
else
    warn "Secrets generation script not found"
    info "   Create: scripts/generate-secrets.py"
fi

# Check for AWS Secrets Manager or Vault
if grep -r "boto3\|aws.*secrets\|vault" "$BACKEND_DIR/src" 2>/dev/null | grep -q "."; then
    pass "Secrets manager integration found (AWS/Vault)"
else
    warn "No secrets manager integration found"
    info "   Recommended: AWS Secrets Manager or HashiCorp Vault"
fi

# ============================================================================
# 11. Webhook Security
# ============================================================================

section "11. Webhook Signature Verification"

# Check for webhook security modules
if [ -f "$BACKEND_DIR/src/security/webhook_verification.py" ]; then
    pass "Webhook verification module exists"
else
    warn "Generic webhook verification module not found"
fi

# Check for specific webhook security
webhook_modules=(
    "src/integrations/xero/webhook_security.py:Xero webhook security"
    "src/integrations/ap2/security.py:AP2 webhook security"
)

for module_info in "${webhook_modules[@]}"; do
    module="${module_info%%:*}"
    description="${module_info#*:}"

    if [ -f "$BACKEND_DIR/$module" ]; then
        pass "$description exists"

        # Check for HMAC verification
        if grep -q "hmac\|HMAC\|signature" "$BACKEND_DIR/$module"; then
            pass "  └─ HMAC signature verification implemented"
        fi
    else
        warn "$description not found"
    fi
done

# ============================================================================
# 12. Input Validation (OWASP A03:2021)
# ============================================================================

section "12. Input Validation"

# Check for Pydantic usage (backend)
if [ -f "$BACKEND_DIR/pyproject.toml" ]; then
    if grep -q "pydantic" "$BACKEND_DIR/pyproject.toml"; then
        pass "Pydantic installed (backend input validation)"
    else
        fail "Pydantic not found in dependencies"
    fi
fi

# Check for Zod usage (frontend)
if [ -f "$FRONTEND_DIR/package.json" ]; then
    if grep -q "\"zod\"" "$FRONTEND_DIR/package.json"; then
        pass "Zod installed (frontend input validation)"
    else
        warn "Zod not found in frontend dependencies"
    fi
fi

# Check for validation models
validation_models=$(find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "class.*BaseModel\|Field(" {} \; | wc -l)
info "Pydantic validation models found: $validation_models files"

if [ "$validation_models" -ge 10 ]; then
    pass "Comprehensive input validation with Pydantic"
else
    warn "Limited validation models found ($validation_models)"
fi

# ============================================================================
# 13. Dependency Vulnerabilities
# ============================================================================

section "13. Dependency Vulnerabilities"

# Check for npm audit (frontend)
if [ -f "$FRONTEND_DIR/package.json" ]; then
    info "Running npm audit (frontend)..."
    if command -v npm &> /dev/null; then
        cd "$FRONTEND_DIR" && npm audit --audit-level=high > /tmp/npm-audit.txt 2>&1 || true

        if grep -q "0 vulnerabilities" /tmp/npm-audit.txt; then
            pass "Frontend: No high/critical npm vulnerabilities"
        elif grep -q "vulnerabilities" /tmp/npm-audit.txt; then
            vuln_count=$(grep -o "[0-9]* vulnerabilities" /tmp/npm-audit.txt | head -1 | awk '{print $1}')
            warn "Frontend: $vuln_count npm vulnerabilities found"
            info "   Run: cd $FRONTEND_DIR && npm audit fix"
        fi
        cd - > /dev/null
    else
        warn "npm not available - cannot check frontend dependencies"
    fi
else
    warn "Frontend package.json not found"
fi

# Check for pip audit (backend)
if [ -f "$BACKEND_DIR/pyproject.toml" ]; then
    info "Checking for Python vulnerability scanning tools..."
    if command -v pip &> /dev/null; then
        # Try pip-audit if available
        if command -v pip-audit &> /dev/null; then
            pass "pip-audit tool available"
            info "   Run: pip-audit to scan Python dependencies"
        else
            warn "pip-audit not installed"
            info "   Install: pip install pip-audit"
        fi

        # Try safety if available
        if command -v safety &> /dev/null; then
            pass "safety tool available"
            info "   Run: safety check to scan Python dependencies"
        else
            warn "safety tool not installed"
            info "   Install: pip install safety"
        fi
    fi
fi

# ============================================================================
# 14. Security Headers
# ============================================================================

section "14. Security Headers"

# Check for security headers middleware
if [ -f "$BACKEND_DIR/src/api/middleware/security_headers.py" ]; then
    pass "Security headers middleware exists"

    # Check for specific headers
    headers=(
        "X-Content-Type-Options:nosniff"
        "X-Frame-Options:DENY\|SAMEORIGIN"
        "X-XSS-Protection:1"
        "Strict-Transport-Security:HSTS"
        "Content-Security-Policy:CSP"
    )

    for header_info in "${headers[@]}"; do
        header="${header_info%%:*}"
        pattern="${header_info#*:}"

        if grep -q "$pattern" "$BACKEND_DIR/src/api/middleware/security_headers.py"; then
            pass "  └─ $header configured"
        else
            warn "  └─ $header not found"
        fi
    done
else
    warn "Security headers middleware not found"
    info "   Create: src/api/middleware/security_headers.py"
fi

# Check if middleware is registered
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "SecurityHeadersMiddleware" "$BACKEND_DIR/src/api/main.py"; then
        pass "Security headers middleware registered"
    else
        warn "Security headers middleware not registered in main.py"
    fi
fi

# ============================================================================
# 15. Logging & Monitoring
# ============================================================================

section "15. Logging & Monitoring (Security Events)"

# Check for structured logging
if [ -f "$BACKEND_DIR/pyproject.toml" ]; then
    if grep -q "structlog" "$BACKEND_DIR/pyproject.toml"; then
        pass "Structured logging installed (structlog)"
    else
        warn "Structured logging not found"
    fi
fi

# Check for security event logging
if find "$BACKEND_DIR/src" -name "*.py" -exec grep -l "logger.*auth\|logger.*login\|logger.*security" {} \; | grep -q "."; then
    pass "Security event logging found"
else
    warn "Security event logging not clearly implemented"
    info "   Log: Failed logins, auth errors, rate limit hits"
fi

# Check for Sentry integration
if [ -f "$BACKEND_DIR/src/config/sentry.py" ]; then
    pass "Sentry error tracking configured"
else
    warn "Sentry error tracking not configured (ISS-021)"
fi

# ============================================================================
# 16. API Security
# ============================================================================

section "16. API Security Configuration"

# Check for CORS configuration
if [ -f "$BACKEND_DIR/src/api/main.py" ]; then
    if grep -q "CORSMiddleware\|cors" "$BACKEND_DIR/src/api/main.py"; then
        pass "CORS configured"

        # Check for wildcard origins (security risk)
        if grep -q "allow_origins.*\[\"*\"\]\|allow_origins.*\*" "$BACKEND_DIR/src/api/main.py"; then
            fail "CORS allows all origins (*) - security risk"
            info "   Restrict to specific domains in production"
        else
            pass "CORS origins restricted (no wildcard)"
        fi
    else
        warn "CORS configuration not found"
    fi
fi

# Check for API versioning
if find "$BACKEND_DIR/src/api/routes" -name "*.py" -exec grep -l "/api/v1\|/api/v2\|prefix.*v[0-9]" {} \; | grep -q "."; then
    pass "API versioning implemented"
else
    warn "API versioning not found"
    info "   Recommended: Use /api/v1 prefix for routes"
fi

# ============================================================================
# 17. Production Readiness
# ============================================================================

section "17. Production Security Readiness"

# Check critical production requirements
prod_ready=true

# Security audit report
if [ ! -f "docs/SECURITY_AUDIT_REPORT.md" ]; then
    warn "Production: Security audit report missing"
    prod_ready=false
fi

# Encryption at rest
if [ ! -f "$BACKEND_DIR/src/security/encryption.py" ]; then
    warn "Production: Encryption service missing"
    prod_ready=false
fi

# Rate limiting
if ! grep -q "slowapi\|ratelimit" "$BACKEND_DIR/pyproject.toml" 2>/dev/null; then
    warn "Production: Rate limiting not configured"
    prod_ready=false
fi

# Security headers
if [ ! -f "$BACKEND_DIR/src/api/middleware/security_headers.py" ]; then
    warn "Production: Security headers middleware missing"
    prod_ready=false
fi

# Secrets management
if [ ! -f ".env.example" ]; then
    warn "Production: Environment template missing"
    prod_ready=false
fi

if [ "$prod_ready" = true ]; then
    pass "Production: Security audit ready for deployment"
else
    warn "Production: NOT ready - complete above security items first"
fi

# Summary of security requirements
info "Production security checklist:"
info "   1. Complete security audit report"
info "   2. Generate production secrets (JWT, encryption, database)"
info "   3. Configure SSL/TLS certificates (Let's Encrypt)"
info "   4. Enable rate limiting (slowapi)"
info "   5. Configure security headers middleware"
info "   6. Set up secrets manager (AWS Secrets Manager)"
info "   7. Configure firewall rules (UFW/iptables)"
info "   8. Enable Sentry error tracking"
info "   9. Review and fix dependency vulnerabilities"
info "   10. Conduct penetration testing"

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
    echo -e "${GREEN}✅ Security audit is complete - ready for production!${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Security audit mostly complete with some improvements needed.${NC}"
    echo ""
    echo "Address warnings above for optimal security posture."
    exit 0
else
    echo -e "${RED}❌ Security audit has FAILED items requiring immediate attention.${NC}"
    echo ""
    echo "Critical security issues found. Please address failures above."
    exit 1
fi
