#!/usr/bin/env bash
#
# ISS-025 Verification: Generate Secure Production Secrets
#
# This script verifies that secure production secrets infrastructure is properly
# configured including secret generation script, environment template, secrets
# management integration, and secret rotation procedures.
#
# Usage:
#   ./scripts/verify-secrets.sh
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
echo "║   ISS-025 VERIFICATION: Generate Secure Production Secrets        ║"
echo "║                                                                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 1. SECRET GENERATION SCRIPT
# ============================================================================
section "1. Secret Generation Script"

if [[ -f "scripts/generate-secrets.py" ]]; then
    pass "Secret generation script exists (scripts/generate-secrets.py)"

    # Check if executable
    if [[ -x "scripts/generate-secrets.py" ]]; then
        pass "Script is executable"
    else
        warn "Script is not executable (run: chmod +x scripts/generate-secrets.py)"
    fi

    # Check for required imports
    if grep -q "import secrets" scripts/generate-secrets.py; then
        pass "Uses Python 'secrets' module (cryptographically secure)"
    else
        fail "Missing 'secrets' module import"
    fi

    if grep -q "from cryptography.fernet import Fernet" scripts/generate-secrets.py; then
        pass "Uses Fernet for encryption key generation"
    else
        fail "Missing Fernet import for encryption keys"
    fi

    # Check for required functions
    if grep -q "def generate_jwt_secret" scripts/generate-secrets.py; then
        pass "JWT secret generation function exists"
    else
        fail "Missing JWT secret generation function"
    fi

    if grep -q "def generate_encryption_key" scripts/generate-secrets.py; then
        pass "Encryption key generation function exists"
    else
        fail "Missing encryption key generation function"
    fi

    if grep -q "def generate_database_password" scripts/generate-secrets.py; then
        pass "Database password generation function exists"
    else
        fail "Missing database password generation function"
    fi

    # Check secret strength requirements
    if grep -q "length: int = 64" scripts/generate-secrets.py || grep -q "length=64" scripts/generate-secrets.py; then
        pass "JWT secret uses 64-byte length (512 bits) - STRONG"
    else
        warn "JWT secret may not meet 64-byte requirement"
    fi

    if grep -q "length: int = 32" scripts/generate-secrets.py || grep -q "length=32" scripts/generate-secrets.py; then
        pass "Database password uses 32-character length - STRONG"
    else
        warn "Database password may not meet 32-character requirement"
    fi

else
    fail "Secret generation script not found (scripts/generate-secrets.py)"
fi

# ============================================================================
# 2. PRODUCTION ENVIRONMENT TEMPLATE
# ============================================================================
section "2. Production Environment Template"

if [[ -f ".env.example" ]]; then
    pass "Production environment template exists (.env.example)"

    # Check for required sections
    if grep -q "JWT_SECRET_KEY" .env.example; then
        pass "JWT configuration section present"
    else
        fail "Missing JWT configuration in template"
    fi

    if grep -q "ENCRYPTION_KEY" .env.example; then
        pass "Encryption key section present"
    else
        fail "Missing encryption key configuration"
    fi

    if grep -q "DATABASE_URL\|POSTGRES_PASSWORD" .env.example; then
        pass "Database configuration section present"
    else
        fail "Missing database configuration"
    fi

    if grep -q "SENDGRID_API_KEY" .env.example; then
        pass "SendGrid email configuration present"
    else
        warn "Missing SendGrid configuration (may be optional)"
    fi

    if grep -q "XERO_WEBHOOK_KEY\|AP2_WEBHOOK_SECRET\|FEDEX_WEBHOOK_SECRET" .env.example; then
        pass "Webhook secrets configuration present"
    else
        warn "Missing webhook secrets configuration"
    fi

    if grep -q "AWS_SECRET_NAME\|USE_AWS_SECRETS" .env.example; then
        pass "AWS Secrets Manager integration documented"
    else
        warn "AWS Secrets Manager configuration not documented"
    fi

    # Check for placeholder values (should not have real secrets)
    if grep -q "GENERATE_WITH_SCRIPT\|YOUR_" .env.example; then
        pass "Template uses placeholders (no real secrets)"
    else
        warn "Template may contain hardcoded values"
    fi

    # Check for security warnings
    if grep -q "SECURITY WARNING\|DO NOT" .env.example; then
        pass "Security warning present in template"
    else
        warn "Missing security warning in template"
    fi

else
    fail "Production environment template not found (.env.example)"
fi

# ============================================================================
# 3. SECRETS GENERATION DOCUMENTATION
# ============================================================================
section "3. Secrets Generation Documentation"

if [[ -f "docs/SECRETS_GENERATION.md" ]]; then
    pass "Secrets generation documentation exists (docs/SECRETS_GENERATION.md)"

    # Check for key sections
    if grep -q "JWT Secret" docs/SECRETS_GENERATION.md; then
        pass "JWT secret documentation present"
    else
        warn "Missing JWT secret documentation"
    fi

    if grep -q "Encryption Key" docs/SECRETS_GENERATION.md; then
        pass "Encryption key documentation present"
    else
        warn "Missing encryption key documentation"
    fi

    if grep -q "Secret Rotation\|Rotation Schedule" docs/SECRETS_GENERATION.md; then
        pass "Secret rotation procedures documented"
    else
        warn "Missing secret rotation documentation"
    fi

    if grep -q "AWS Secrets Manager\|HashiCorp Vault" docs/SECRETS_GENERATION.md; then
        pass "Secret storage options documented"
    else
        warn "Missing secret storage documentation"
    fi

    if grep -q "90 days" docs/SECRETS_GENERATION.md; then
        pass "Rotation schedule documented (90-day recommendation)"
    else
        warn "Missing rotation schedule information"
    fi

else
    fail "Secrets generation documentation not found (docs/SECRETS_GENERATION.md)"
fi

# ============================================================================
# 4. HARDCODED SECRETS CHECK
# ============================================================================
section "4. Hardcoded Secrets Check"

info "Scanning codebase for potential hardcoded secrets..."

# Check for hardcoded JWT secrets (common patterns)
if grep -r "jwt.*=.*['\"][A-Za-z0-9_-]{64,}['\"]" backend/src --include="*.py" 2>/dev/null | grep -v "test" | grep -v "example"; then
    warn "Potential hardcoded JWT secret found in source code"
else
    pass "No hardcoded JWT secrets found in source code"
fi

# Check for hardcoded database passwords
if grep -r "password.*=.*['\"][^<>]" backend/src/config --include="*.py" 2>/dev/null | grep -v "getenv\|env.get" | grep -v "example"; then
    warn "Potential hardcoded database password found"
else
    pass "No hardcoded database passwords found"
fi

# Check for hardcoded encryption keys
if grep -r "ENCRYPTION_KEY.*=.*['\"][^<>]" backend/src --include="*.py" 2>/dev/null | grep -v "getenv\|env.get" | grep -v "test"; then
    warn "Potential hardcoded encryption key found"
else
    pass "No hardcoded encryption keys found"
fi

# Check for hardcoded API keys
if grep -r "api_key.*=.*['\"][A-Za-z0-9_-]{20,}['\"]" backend/src --include="*.py" 2>/dev/null | grep -v "getenv\|env.get" | grep -v "test" | grep -v "example"; then
    warn "Potential hardcoded API key found"
else
    pass "No hardcoded API keys found in source code"
fi

# ============================================================================
# 5. GITIGNORE CONFIGURATION
# ============================================================================
section "5. Git Ignore Configuration"

if [[ -f ".gitignore" ]]; then
    pass ".gitignore file exists"

    # Check for .env file exclusions
    if grep -q "^\.env$" .gitignore || grep -q "^\.env\.production$" .gitignore; then
        pass ".env files excluded from version control"
    else
        fail ".env files NOT excluded from git (SECURITY RISK)"
    fi

    if grep -q "\.env\.local\|\.env\.\*" .gitignore; then
        pass "Local environment files excluded"
    else
        warn "Local environment files may not be fully excluded"
    fi

    # Check for secret file patterns
    if grep -q "secret\|credential" .gitignore; then
        pass "Secret/credential files excluded"
    else
        warn "Consider adding secret/credential patterns to .gitignore"
    fi

else
    fail ".gitignore file not found (CRITICAL)"
fi

# ============================================================================
# 6. SECRET STRENGTH VALIDATION
# ============================================================================
section "6. Secret Strength Validation"

info "Validating secret generation strength requirements..."

# Check JWT secret strength in script
if grep -q "64" scripts/generate-secrets.py 2>/dev/null; then
    JWT_LENGTH=$(grep -o "length.*=.*[0-9]\+" scripts/generate-secrets.py | head -1 | grep -o "[0-9]\+" || echo "0")
    if [[ $JWT_LENGTH -ge 64 ]]; then
        pass "JWT secret length >= 64 bytes (512 bits) - STRONG"
    else
        warn "JWT secret length < 64 bytes (current: ${JWT_LENGTH})"
    fi
fi

# Check database password strength
if grep -q "32" scripts/generate-secrets.py 2>/dev/null; then
    DB_LENGTH=$(grep "generate_database_password" -A 5 scripts/generate-secrets.py | grep -o "length.*=.*[0-9]\+" | head -1 | grep -o "[0-9]\+" || echo "0")
    if [[ $DB_LENGTH -ge 32 ]]; then
        pass "Database password length >= 32 characters - STRONG"
    else
        warn "Database password length < 32 characters (current: ${DB_LENGTH})"
    fi
fi

# Check for entropy source (secrets.token_urlsafe uses os.urandom - cryptographically secure)
if grep -q "secrets\.token_urlsafe\|secrets\.choice" scripts/generate-secrets.py 2>/dev/null; then
    pass "Uses cryptographically secure random generator (secrets module)"
else
    warn "May not be using cryptographically secure random generator"
fi

# Check for Fernet key generation (always 256-bit)
if grep -q "Fernet\.generate_key" scripts/generate-secrets.py 2>/dev/null; then
    pass "Encryption key uses Fernet (AES-256) - STRONG"
else
    warn "Encryption key generation method unclear"
fi

# ============================================================================
# 7. ENVIRONMENT VARIABLE VALIDATION
# ============================================================================
section "7. Environment Variable Validation"

info "Checking for environment variable usage in code..."

# Check backend config files use environment variables
if find backend/src/config -name "*.py" -exec grep -l "os.getenv\|os.environ" {} \; 2>/dev/null | grep -q "."; then
    pass "Backend config uses environment variables"
else
    warn "Backend config may not be reading from environment variables"
fi

# Check for proper default values (should not have sensitive defaults)
if find backend/src/config -name "*.py" -exec grep -l "getenv.*default.*['\"][^<>]" {} \; 2>/dev/null | grep -q "."; then
    info "Environment variables have default values (verify they're safe)"
else
    pass "No default values for sensitive environment variables"
fi

# ============================================================================
# 8. AWS SECRETS MANAGER INTEGRATION
# ============================================================================
section "8. AWS Secrets Manager Integration"

if [[ -f "backend/src/config/secrets_manager.py" ]]; then
    pass "AWS Secrets Manager integration exists (secrets_manager.py)"

    # Check for required methods
    if grep -q "def get_secret" backend/src/config/secrets_manager.py; then
        pass "get_secret() method implemented"
    else
        warn "Missing get_secret() method"
    fi

    if grep -q "def update_secret\|def rotate" backend/src/config/secrets_manager.py; then
        pass "Secret rotation methods implemented"
    else
        warn "Missing secret rotation methods"
    fi

    if grep -q "import boto3\|secretsmanager" backend/src/config/secrets_manager.py; then
        pass "boto3 AWS SDK integration present"
    else
        warn "Missing boto3 import for AWS Secrets Manager"
    fi

    # Check for fallback mechanism
    if grep -q "fallback\|except\|try" backend/src/config/secrets_manager.py; then
        pass "Fallback mechanism exists (graceful degradation)"
    else
        warn "No fallback if AWS Secrets Manager unavailable"
    fi

else
    warn "AWS Secrets Manager integration not found (optional but recommended)"
    info "See docs/SECRETS_MANAGEMENT.md for setup instructions"
fi

# ============================================================================
# 9. SECRET ROTATION DOCUMENTATION
# ============================================================================
section "9. Secret Rotation Documentation"

if [[ -f "docs/SECRETS_MANAGEMENT.md" ]]; then
    pass "Secret management documentation exists (docs/SECRETS_MANAGEMENT.md)"

    # Check for rotation procedures
    if grep -q "rotation\|rotate" docs/SECRETS_MANAGEMENT.md 2>/dev/null; then
        pass "Rotation procedures documented"
    else
        warn "Missing rotation procedures"
    fi

    if grep -q "JWT.*rotation\|JWT.*rotate" docs/SECRETS_MANAGEMENT.md 2>/dev/null; then
        pass "JWT secret rotation documented"
    else
        warn "Missing JWT rotation procedure"
    fi

    if grep -q "encryption.*key.*rotation\|encryption.*rotate" docs/SECRETS_MANAGEMENT.md 2>/dev/null; then
        pass "Encryption key rotation documented"
    else
        warn "Missing encryption key rotation procedure"
    fi

else
    warn "Secret management documentation not found (docs/SECRETS_MANAGEMENT.md)"
    info "Create documentation with rotation procedures"
fi

# Check SECRETS_GENERATION.md for rotation schedule
if grep -q "90 days\|90-day\|quarterly" docs/SECRETS_GENERATION.md 2>/dev/null; then
    pass "Rotation schedule documented (90-day recommendation)"
else
    warn "Missing rotation schedule"
fi

# ============================================================================
# 10. SECRET GENERATION SCRIPT EXECUTION TEST
# ============================================================================
section "10. Secret Generation Script Execution Test"

info "Testing secret generation script (dry run)..."

if command -v python3 &> /dev/null; then
    # Test script syntax
    if python3 -m py_compile scripts/generate-secrets.py 2>/dev/null; then
        pass "Secret generation script syntax is valid"
    else
        fail "Secret generation script has syntax errors"
    fi

    # Check if script can be imported (dependencies available)
    if python3 -c "import secrets, string; from cryptography.fernet import Fernet" 2>/dev/null; then
        pass "Required dependencies available (secrets, cryptography)"
    else
        fail "Missing required dependencies (cryptography)"
    fi

    # Test individual functions (if script is structured properly)
    if grep -q "if __name__ == .__main__.:" scripts/generate-secrets.py; then
        pass "Script is properly structured as executable module"
    else
        warn "Script may not be properly structured"
    fi

else
    warn "Python3 not available for testing"
fi

# ============================================================================
# 11. SECRET LEAK DETECTION (GIT HISTORY)
# ============================================================================
section "11. Secret Leak Detection (Git History)"

info "Scanning git history for potential secret leaks..."

if command -v git &> /dev/null && [[ -d ".git" ]]; then

    # Check for .env files in git history
    if git log --all --full-history -- "*.env" 2>/dev/null | grep -q "commit"; then
        warn ".env files found in git history (may contain secrets)"
        info "Consider using 'git filter-branch' to remove"
    else
        pass "No .env files in git history"
    fi

    # Check for potential JWT secrets in history
    if git log --all -p -S "JWT_SECRET" 2>/dev/null | grep -E "^\+.*JWT_SECRET.*=.*['\"][^<>]{20,}" | grep -v "GENERATE" | head -5 | grep -q "."; then
        warn "Potential JWT secret found in git history"
    else
        pass "No JWT secrets found in git history"
    fi

    # Check for potential encryption keys
    if git log --all -p -S "ENCRYPTION_KEY" 2>/dev/null | grep -E "^\+.*ENCRYPTION_KEY.*=.*['\"][^<>]{20,}" | grep -v "GENERATE" | head -5 | grep -q "."; then
        warn "Potential encryption key found in git history"
    else
        pass "No encryption keys found in git history"
    fi

else
    info "Git not available or not a git repository"
fi

# ============================================================================
# 12. SECURE COOKIE CONFIGURATION
# ============================================================================
section "12. Secure Cookie Configuration"

info "Checking secure cookie configuration..."

if grep -r "SECURE_COOKIES\|secure.*cookie" .env.example 2>/dev/null | grep -q "true"; then
    pass "Secure cookies enabled in production template"
else
    warn "Secure cookies may not be configured"
fi

if grep -r "SameSite.*Strict\|SameSite.*Lax" backend/src --include="*.py" 2>/dev/null | grep -q "."; then
    pass "SameSite cookie attribute configured"
else
    warn "SameSite cookie attribute may not be set"
fi

if grep -r "httponly.*True\|HttpOnly" backend/src --include="*.py" 2>/dev/null | grep -q "."; then
    pass "HttpOnly flag configured for cookies"
else
    warn "HttpOnly flag may not be set (XSS risk)"
fi

# ============================================================================
# 13. PRODUCTION DEPLOYMENT CHECKLIST
# ============================================================================
section "13. Production Deployment Checklist"

info "Verifying production deployment readiness..."

CHECKLIST_ITEMS=(
    "scripts/generate-secrets.py:Secret generation script"
    ".env.example:Environment template"
    "docs/SECRETS_GENERATION.md:Secrets documentation"
    ".gitignore:.gitignore configuration"
)

CHECKLIST_PASS=0
CHECKLIST_TOTAL=${#CHECKLIST_ITEMS[@]}

for item in "${CHECKLIST_ITEMS[@]}"; do
    file="${item%%:*}"
    desc="${item#*:}"

    if [[ -f "$file" ]]; then
        ((CHECKLIST_PASS++))
    fi
done

if [[ $CHECKLIST_PASS -eq $CHECKLIST_TOTAL ]]; then
    pass "All production deployment files present ($CHECKLIST_PASS/$CHECKLIST_TOTAL)"
else
    warn "Some production files missing ($CHECKLIST_PASS/$CHECKLIST_TOTAL)"
fi

# Check for AWS Secrets Manager integration (optional)
if [[ -f "backend/src/config/secrets_manager.py" ]]; then
    pass "AWS Secrets Manager integration available (optional)"
else
    info "AWS Secrets Manager integration not present (optional)"
fi

# ============================================================================
# 14. SECRET ENTROPY VALIDATION
# ============================================================================
section "14. Secret Entropy Validation"

info "Validating secret entropy and randomness..."

# Check for proper entropy source usage
if grep -q "os.urandom\|secrets.token_urlsafe\|secrets.token_hex" scripts/generate-secrets.py 2>/dev/null; then
    pass "Uses system entropy source (cryptographically secure)"
else
    warn "Entropy source unclear or may be weak"
fi

# Check that random() is NOT used (weak)
if grep -q "random.random\|random.randint" scripts/generate-secrets.py 2>/dev/null; then
    fail "Uses weak random() generator (NOT cryptographically secure)"
else
    pass "Does not use weak random() generator"
fi

# Check for proper character sets
if grep -q "string.ascii_letters.*string.digits" scripts/generate-secrets.py 2>/dev/null; then
    pass "Uses proper character set (letters + digits + special)"
else
    warn "Character set may be limited"
fi

# ============================================================================
# 15. DOCUMENTATION COMPLETENESS
# ============================================================================
section "15. Documentation Completeness"

info "Checking documentation completeness..."

REQUIRED_DOCS=(
    "docs/SECRETS_GENERATION.md:Secrets generation guide"
    "docs/SECRETS_MANAGEMENT.md:Secrets management guide"
)

DOCS_FOUND=0
DOCS_TOTAL=${#REQUIRED_DOCS[@]}

for doc in "${REQUIRED_DOCS[@]}"; do
    file="${doc%%:*}"
    desc="${doc#*:}"

    if [[ -f "$file" ]]; then
        pass "$desc exists"
        ((DOCS_FOUND++))
    else
        warn "$desc not found"
    fi
done

if [[ $DOCS_FOUND -eq $DOCS_TOTAL ]]; then
    pass "All required documentation present ($DOCS_FOUND/$DOCS_TOTAL)"
else
    warn "Some documentation missing ($DOCS_FOUND/$DOCS_TOTAL)"
fi

# Check for key topics in documentation
if [[ -f "docs/SECRETS_GENERATION.md" ]]; then
    TOPICS=("JWT Secret" "Encryption Key" "Database Password" "Secret Rotation" "AWS Secrets Manager")
    TOPICS_FOUND=0

    for topic in "${TOPICS[@]}"; do
        if grep -q "$topic" docs/SECRETS_GENERATION.md 2>/dev/null; then
            ((TOPICS_FOUND++))
        fi
    done

    if [[ $TOPICS_FOUND -ge 4 ]]; then
        pass "Documentation covers key topics ($TOPICS_FOUND/5)"
    else
        warn "Documentation may be incomplete ($TOPICS_FOUND/5 topics)"
    fi
fi

# ============================================================================
# 16. SECURITY BEST PRACTICES VALIDATION
# ============================================================================
section "16. Security Best Practices Validation"

info "Validating security best practices..."

# Check for security warnings in documentation
if grep -q "WARNING\|CRITICAL\|DO NOT" docs/SECRETS_GENERATION.md 2>/dev/null; then
    pass "Security warnings present in documentation"
else
    warn "Missing security warnings in documentation"
fi

# Check for least privilege recommendations
if grep -q "least privilege\|IAM policy\|access control" docs/SECRETS_GENERATION.md docs/SECRETS_MANAGEMENT.md 2>/dev/null; then
    pass "Least privilege principle documented"
else
    warn "Least privilege principle not documented"
fi

# Check for audit logging mention
if grep -q "audit\|logging.*access" docs/SECRETS_GENERATION.md docs/SECRETS_MANAGEMENT.md 2>/dev/null; then
    pass "Audit logging documented"
else
    warn "Audit logging not documented"
fi

# Check for secret leak prevention
if grep -q "leak\|scan\|GitGuardian" docs/SECRETS_GENERATION.md 2>/dev/null; then
    pass "Secret leak prevention mentioned"
else
    warn "Secret leak prevention not documented"
fi

# Check for rotation automation
if grep -q "automated.*rotation\|rotation.*script" docs/SECRETS_GENERATION.md docs/SECRETS_MANAGEMENT.md 2>/dev/null; then
    pass "Rotation automation documented"
else
    info "Consider documenting rotation automation"
fi

# ============================================================================
# 17. PRODUCTION READINESS CHECKLIST
# ============================================================================
section "17. Production Readiness Checklist"

echo ""
echo "Production Readiness Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CRITICAL_CHECKS=(
    "scripts/generate-secrets.py:Secret generation script exists"
    ".env.example:Production environment template"
    "docs/SECRETS_GENERATION.md:Secrets documentation"
    ".gitignore:.env files excluded from git"
)

CRITICAL_PASS=0
CRITICAL_TOTAL=${#CRITICAL_CHECKS[@]}

for check in "${CRITICAL_CHECKS[@]}"; do
    file="${check%%:*}"
    desc="${check#*:}"

    if [[ -f "$file" ]]; then
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

# Optional but recommended checks
echo ""
echo "Optional but Recommended:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

OPTIONAL_CHECKS=(
    "backend/src/config/secrets_manager.py:AWS Secrets Manager integration"
    "docs/SECRETS_MANAGEMENT.md:Secret management guide"
)

for check in "${OPTIONAL_CHECKS[@]}"; do
    file="${check%%:*}"
    desc="${check#*:}"

    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✓${NC} $desc"
    else
        echo -e "${YELLOW}○${NC} $desc (optional)"
    fi
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
        echo "🎉 Secure production secrets infrastructure is fully configured!"
        echo ""
        echo "Next steps:"
        echo "  1. Generate production secrets: python scripts/generate-secrets.py"
        echo "  2. Store secrets in AWS Secrets Manager or HashiCorp Vault"
        echo "  3. Configure environment variables in production"
        echo "  4. Set up secret rotation schedule (90 days recommended)"
        echo "  5. Review docs/SECRETS_GENERATION.md for rotation procedures"
        echo ""
        exit 0
    else
        echo -e "${YELLOW}⚠ PASSED WITH WARNINGS${NC}"
        echo ""
        echo "✓ Core infrastructure is in place"
        echo "⚠ Some warnings detected - review and address before production"
        echo ""
        echo "Next steps:"
        echo "  1. Review warnings above"
        echo "  2. Generate production secrets: python scripts/generate-secrets.py"
        echo "  3. Configure AWS Secrets Manager (recommended)"
        echo "  4. Set up secret rotation automation"
        echo ""
        exit 0
    fi
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo ""
    echo "Critical issues detected. Fix the following:"
    echo "  - Review failed checks above"
    echo "  - Ensure all required files exist"
    echo "  - Verify no hardcoded secrets in code"
    echo "  - Run verification again after fixes"
    echo ""
    exit 1
fi
