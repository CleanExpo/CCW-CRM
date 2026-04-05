#!/bin/bash

################################################################################
# CCW-Online ERP - Secrets Management Verification Script (ISS-014)
#
# Purpose: Verify that secrets management is correctly configured
# Usage: ./verify-secrets-management.sh [environment]
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-production}"
SECRET_NAME="${AWS_SECRET_NAME:-ccw-erp/${ENVIRONMENT}}"
AWS_REGION="${AWS_REGION:-us-east-1}"

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
echo "  CCW-Online ERP - Secrets Management Verification"
echo "  Date: $(date)"
echo "================================================================="
echo ""
info "Testing configuration:"
echo "  Environment: $ENVIRONMENT"
echo "  Secret Name: $SECRET_NAME"
echo "  AWS Region: $AWS_REGION"
echo ""

# 1. Check if secrets generation script exists
info "Checking Secrets Generation Script..."
if [ -f "scripts/generate-secrets.py" ]; then
    pass "Secrets generation script exists: scripts/generate-secrets.py"

    # Check if script is executable
    if [ -x "scripts/generate-secrets.py" ]; then
        pass "Generation script is executable"
    else
        warn "Generation script is not executable (not critical)"
    fi
else
    fail "Secrets generation script not found"
fi
echo ""

# 2. Check if secrets manager module exists
info "Checking Secrets Manager Module..."
SECRETS_MANAGER_FILE="backend/src/config/secrets_manager.py"

if [ -f "$SECRETS_MANAGER_FILE" ]; then
    pass "Secrets manager module exists: $SECRETS_MANAGER_FILE"

    # Check for key components
    if grep -q "class SecretsManager" "$SECRETS_MANAGER_FILE"; then
        pass "SecretsManager class defined"
    else
        fail "SecretsManager class not found"
    fi

    if grep -q "def get_secret" "$SECRETS_MANAGER_FILE"; then
        pass "get_secret method defined"
    else
        fail "get_secret method not found"
    fi

    if grep -q "def load_secrets_from_aws" "$SECRETS_MANAGER_FILE"; then
        pass "load_secrets_from_aws function defined"
    else
        fail "load_secrets_from_aws function not found"
    fi
else
    fail "Secrets manager module not found"
fi
echo ""

# 3. Check Python dependencies
info "Checking Python Dependencies..."

# Check if boto3 is available (AWS SDK)
if python3 -c "import boto3" 2>/dev/null; then
    pass "boto3 (AWS SDK) installed"

    # Get boto3 version
    BOTO3_VERSION=$(python3 -c "import boto3; print(boto3.__version__)" 2>/dev/null || echo "unknown")
    info "boto3 version: $BOTO3_VERSION"
else
    fail "boto3 not installed (required for AWS Secrets Manager)"
fi

# Check if cryptography is available (for Fernet encryption)
if python3 -c "import cryptography" 2>/dev/null; then
    pass "cryptography library installed"

    # Check Fernet
    if python3 -c "from cryptography.fernet import Fernet" 2>/dev/null; then
        pass "Fernet encryption available"
    else
        warn "Fernet encryption not available"
    fi
else
    fail "cryptography library not installed (required for encryption)"
fi

# Check if structlog is available
if python3 -c "import structlog" 2>/dev/null; then
    pass "structlog installed"
else
    warn "structlog not installed (optional, but recommended)"
fi
echo ""

# 4. Check AWS CLI configuration
info "Checking AWS CLI Configuration..."

if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | awk '{print $1}')
    pass "AWS CLI installed: $AWS_VERSION"

    # Check if AWS credentials are configured
    if aws sts get-caller-identity &> /dev/null; then
        pass "AWS credentials configured"

        # Get identity info
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
        USER_ARN=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null || echo "unknown")
        info "AWS Account: $ACCOUNT_ID"
        info "Identity: $USER_ARN"
    else
        warn "AWS credentials not configured (use 'aws configure' or IAM role)"
    fi
else
    warn "AWS CLI not installed (optional, but recommended for manual operations)"
fi
echo ""

# 5. Check if secret exists in AWS Secrets Manager
info "Checking AWS Secrets Manager..."

if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        pass "Secret exists in AWS Secrets Manager: $SECRET_NAME"

        # Get secret metadata
        SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query ARN --output text 2>/dev/null || echo "unknown")
        SECRET_LAST_CHANGED=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query LastChangedDate --output text 2>/dev/null || echo "unknown")

        info "Secret ARN: $SECRET_ARN"
        info "Last Changed: $SECRET_LAST_CHANGED"

        # Check rotation configuration
        ROTATION_ENABLED=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query RotationEnabled --output text 2>/dev/null || echo "false")
        if [ "$ROTATION_ENABLED" = "True" ]; then
            pass "Secret rotation enabled"
        else
            warn "Secret rotation not enabled (recommended for production)"
        fi

        # Check KMS encryption
        KMS_KEY_ID=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query KmsKeyId --output text 2>/dev/null || echo "default")
        if [ "$KMS_KEY_ID" != "None" ]; then
            pass "KMS encryption configured"
            info "KMS Key: $KMS_KEY_ID"
        else
            warn "Using default KMS key (consider dedicated key for production)"
        fi
    else
        warn "Secret not found in AWS Secrets Manager: $SECRET_NAME"
        info "Create secret with: aws secretsmanager create-secret --name $SECRET_NAME --secret-string '{}'"
    fi
else
    warn "Cannot check AWS Secrets Manager (AWS CLI not configured)"
fi
echo ""

# 6. Check environment variables
info "Checking Environment Variables..."

# Check USE_AWS_SECRETS flag
if [ -n "${USE_AWS_SECRETS:-}" ]; then
    if [ "$USE_AWS_SECRETS" = "true" ]; then
        pass "USE_AWS_SECRETS=true (AWS Secrets Manager enabled)"
    else
        info "USE_AWS_SECRETS=$USE_AWS_SECRETS (AWS Secrets Manager disabled)"
    fi
else
    warn "USE_AWS_SECRETS not set (defaults to false)"
fi

# Check AWS_SECRET_NAME
if [ -n "${AWS_SECRET_NAME:-}" ]; then
    pass "AWS_SECRET_NAME set: $AWS_SECRET_NAME"
else
    warn "AWS_SECRET_NAME not set (will use default: ccw-erp/production)"
fi

# Check AWS_REGION
if [ -n "${AWS_REGION:-}" ]; then
    pass "AWS_REGION set: $AWS_REGION"
else
    warn "AWS_REGION not set (will use default: us-east-1)"
fi
echo ""

# 7. Check required secrets
info "Checking Required Secrets..."

REQUIRED_SECRETS=(
    "JWT_SECRET_KEY"
    "ENCRYPTION_KEY"
    "DATABASE_URL"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ -n "${!secret:-}" ]; then
        pass "$secret is set"

        # Check secret strength (basic)
        SECRET_LENGTH=${#!secret}
        if [ "$SECRET_LENGTH" -ge 32 ]; then
            pass "$secret length: $SECRET_LENGTH bytes (sufficient)"
        else
            warn "$secret length: $SECRET_LENGTH bytes (recommended: 32+ bytes)"
        fi
    else
        warn "$secret not set in environment"
    fi
done
echo ""

# 8. Check encryption key format
info "Checking Encryption Key Format..."

if [ -n "${ENCRYPTION_KEY:-}" ]; then
    # Fernet keys are 44 characters (32 bytes base64url-encoded + padding)
    ENCRYPTION_KEY_LENGTH=${#ENCRYPTION_KEY}
    if [ "$ENCRYPTION_KEY_LENGTH" -eq 44 ]; then
        pass "ENCRYPTION_KEY format correct (44 characters, Fernet-compatible)"
    elif [ "$ENCRYPTION_KEY_LENGTH" -eq 43 ]; then
        pass "ENCRYPTION_KEY format correct (43 characters, Fernet-compatible without padding)"
    else
        warn "ENCRYPTION_KEY length unexpected: $ENCRYPTION_KEY_LENGTH characters (Fernet keys are typically 44)"
    fi

    # Test Fernet key validity
    if python3 -c "from cryptography.fernet import Fernet; Fernet('$ENCRYPTION_KEY')" 2>/dev/null; then
        pass "ENCRYPTION_KEY is valid Fernet key"
    else
        fail "ENCRYPTION_KEY is not a valid Fernet key"
    fi
else
    warn "ENCRYPTION_KEY not set (required for encrypting sensitive data)"
fi
echo ""

# 9. Check JWT secret strength
info "Checking JWT Secret Strength..."

if [ -n "${JWT_SECRET_KEY:-}" ]; then
    JWT_LENGTH=${#JWT_SECRET_KEY}

    if [ "$JWT_LENGTH" -ge 64 ]; then
        pass "JWT_SECRET_KEY length sufficient: $JWT_LENGTH bytes (recommended: 64+)"
    elif [ "$JWT_LENGTH" -ge 32 ]; then
        warn "JWT_SECRET_KEY length: $JWT_LENGTH bytes (acceptable, but 64+ recommended)"
    else
        fail "JWT_SECRET_KEY too short: $JWT_LENGTH bytes (minimum: 32, recommended: 64)"
    fi
else
    warn "JWT_SECRET_KEY not set (required for authentication)"
fi
echo ""

# 10. Check IAM permissions (if AWS configured)
info "Checking IAM Permissions..."

if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    # Test GetSecretValue permission
    if aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        pass "IAM has secretsmanager:GetSecretValue permission"
    else
        warn "Cannot retrieve secret (check IAM permissions)"
    fi

    # Test DescribeSecret permission
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        pass "IAM has secretsmanager:DescribeSecret permission"
    else
        warn "Cannot describe secret (check IAM permissions)"
    fi

    # Test KMS Decrypt permission (if applicable)
    if aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        pass "IAM has kms:Decrypt permission"
    else
        warn "Cannot decrypt secret (check KMS key permissions)"
    fi
else
    warn "Cannot check IAM permissions (AWS CLI not configured)"
fi
echo ""

# 11. Check CloudTrail logging
info "Checking CloudTrail Logging..."

if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    # Check if any trails are configured
    TRAIL_COUNT=$(aws cloudtrail describe-trails --region "$AWS_REGION" --query 'trailList | length(@)' --output text 2>/dev/null || echo 0)

    if [ "$TRAIL_COUNT" -gt 0 ]; then
        pass "CloudTrail configured ($TRAIL_COUNT trail(s))"

        # Check if trails are logging
        LOGGING_TRAILS=$(aws cloudtrail get-trail-status --region "$AWS_REGION" --name $(aws cloudtrail describe-trails --region "$AWS_REGION" --query 'trailList[0].Name' --output text) --query IsLogging --output text 2>/dev/null || echo "false")

        if [ "$LOGGING_TRAILS" = "True" ]; then
            pass "CloudTrail logging is active"
        else
            warn "CloudTrail logging is not active"
        fi
    else
        warn "CloudTrail not configured (recommended for audit logging)"
    fi
else
    warn "Cannot check CloudTrail (AWS CLI not configured)"
fi
echo ""

# 12. Check secret rotation schedule
info "Checking Secret Rotation Schedule..."

if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
        ROTATION_ENABLED=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query RotationEnabled --output text 2>/dev/null || echo "false")

        if [ "$ROTATION_ENABLED" = "True" ]; then
            ROTATION_RULES=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query RotationRules --output json 2>/dev/null || echo "{}")

            if [ "$ROTATION_RULES" != "{}" ]; then
                pass "Rotation rules configured"
                info "Rotation rules: $ROTATION_RULES"
            else
                warn "Rotation enabled but no rules configured"
            fi

            # Check last rotation date
            LAST_ROTATED=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query LastRotatedDate --output text 2>/dev/null || echo "never")
            info "Last rotated: $LAST_ROTATED"
        else
            warn "Secret rotation not enabled (recommended: 90-day rotation)"
        fi
    fi
else
    warn "Cannot check rotation schedule (AWS CLI not configured)"
fi
echo ""

# 13. Check VPC endpoints (optional security enhancement)
info "Checking VPC Endpoints..."

if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints --region "$AWS_REGION" --filters "Name=service-name,Values=com.amazonaws.$AWS_REGION.secretsmanager" --query 'VpcEndpoints | length(@)' --output text 2>/dev/null || echo 0)

    if [ "$VPC_ENDPOINTS" -gt 0 ]; then
        pass "VPC endpoint for Secrets Manager configured ($VPC_ENDPOINTS endpoint(s))"
        info "Benefit: Private connectivity, no internet exposure"
    else
        warn "No VPC endpoint for Secrets Manager (traffic goes over internet)"
        info "Consider: Create VPC endpoint for enhanced security"
    fi
else
    warn "Cannot check VPC endpoints (AWS CLI not configured)"
fi
echo ""

# 14. Check documentation
info "Checking Documentation..."

DOCS=(
    "docs/SECRETS_MANAGEMENT.md"
    "docs/SECRETS_GENERATION.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        pass "Documentation exists: $doc"
    else
        fail "Documentation missing: $doc"
    fi
done
echo ""

# 15. Test secret generation
info "Testing Secret Generation..."

if [ -f "scripts/generate-secrets.py" ]; then
    if python3 scripts/generate-secrets.py --test &> /dev/null; then
        pass "Secret generation script executes successfully"
    else
        # Try without --test flag
        if python3 -c "import sys; sys.path.append('scripts'); exec(open('scripts/generate-secrets.py').read())" &> /dev/null; then
            pass "Secret generation script is syntactically valid"
        else
            fail "Secret generation script has errors"
        fi
    fi
else
    warn "Cannot test secret generation (script not found)"
fi
echo ""

# 16. Check backup procedures
info "Checking Backup Procedures..."

# Check if backup script or documentation exists
if [ -f "scripts/backup-secrets.sh" ]; then
    pass "Secrets backup script exists"
elif grep -q "backup" "docs/SECRETS_MANAGEMENT.md" 2>/dev/null; then
    pass "Backup procedures documented in SECRETS_MANAGEMENT.md"
else
    warn "No secrets backup procedures found"
    info "Recommendation: Document backup and recovery procedures"
fi
echo ""

# 17. Check access controls
info "Checking Access Controls..."

# Check file permissions on sensitive files
if [ -f ".env" ]; then
    ENV_PERMS=$(stat -c "%a" .env 2>/dev/null || stat -f "%Lp" .env 2>/dev/null || echo "unknown")
    if [ "$ENV_PERMS" = "600" ] || [ "$ENV_PERMS" = "400" ]; then
        pass ".env file has restrictive permissions: $ENV_PERMS"
    else
        warn ".env file permissions too open: $ENV_PERMS (recommended: 600 or 400)"
    fi
fi

if [ -f ".env.production" ]; then
    fail ".env.production file should NOT exist (use secrets manager)"
    warn "Delete .env.production and use AWS Secrets Manager"
else
    pass "No .env.production file (good - using secrets manager)"
fi
echo ""

# 18. Check secret leakage prevention
info "Checking Secret Leakage Prevention..."

# Check .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "\.env" ".gitignore"; then
        pass ".env files excluded from git"
    else
        warn ".env not in .gitignore (risk of committing secrets)"
    fi

    if grep -q "secrets" ".gitignore" 2>/dev/null; then
        pass "secrets files excluded from git"
    else
        info "Consider: Add 'secrets' to .gitignore"
    fi
else
    warn ".gitignore not found"
fi

# Check for committed secrets (basic check)
if git log --all --oneline -- .env .env.production .env.local 2>/dev/null | head -1 | grep -q ".*"; then
    fail ".env files found in git history (potential secret leak)"
    warn "Action: Remove from history with git filter-branch or BFG Repo-Cleaner"
else
    pass "No .env files in git history"
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
    echo -e "${GREEN}✓ Secrets management configuration looks good!${NC}"
    echo ""
    info "Next steps:"
    echo "  1. Generate production secrets: python scripts/generate-secrets.py"
    echo "  2. Store in AWS Secrets Manager: aws secretsmanager create-secret"
    echo "  3. Configure application: export USE_AWS_SECRETS=true"
    echo "  4. Test secret retrieval: python -c 'from src.config.secrets_manager import load_secrets_from_aws; load_secrets_from_aws(\"$SECRET_NAME\")'"
    echo ""
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Secrets management has warnings.${NC}"
    echo ""
    warn "Review warnings above and improve configuration if needed."
    echo ""
    info "Key recommendations:"
    echo "  - Enable secret rotation (90-day schedule)"
    echo "  - Configure CloudTrail logging for audit"
    echo "  - Create VPC endpoint for private connectivity"
    echo "  - Document backup and recovery procedures"
    exit 0
else
    echo -e "${RED}✗ Secrets management has issues.${NC}"
    echo ""
    fail "Critical issues found. Please review failed checks above."
    echo ""
    info "Critical fixes needed:"
    echo "  - Install required dependencies (boto3, cryptography)"
    echo "  - Create secrets manager module"
    echo "  - Configure AWS credentials"
    echo "  - Generate and store production secrets"
    exit 1
fi
