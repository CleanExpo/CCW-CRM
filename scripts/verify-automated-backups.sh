#!/bin/bash

################################################################################
# CCW-Online ERP - Automated Backups Verification Script (ISS-015)
#
# Purpose: Verify that automated backup system is correctly configured
# Usage: ./verify-automated-backups.sh
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONFIG_DIR="${CONFIG_DIR:-/opt/ccw-online-erp/config}"
BACKUP_DIR="${BACKUP_DIR:-/opt/ccw-online-erp/backups}"
S3_BUCKET="${S3_BUCKET:-s3://ccw-online-erp-backups}"

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
echo "  CCW-Online ERP - Automated Backups Verification"
echo "  Date: $(date)"
echo "================================================================="
echo ""
info "Testing configuration:"
echo "  Config Directory: $CONFIG_DIR"
echo "  Backup Directory: $BACKUP_DIR"
echo "  S3 Bucket: $S3_BUCKET"
echo ""

# 1. Check if backup scripts exist
info "Checking Backup Scripts..."

BACKUP_SCRIPTS=(
    "scripts/backup-database.sh"
    "scripts/restore-backup.sh"
    "scripts/verify-backup.sh"
)

for script in "${BACKUP_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        pass "Script exists: $script"

        # Check if executable
        if [ -x "$script" ]; then
            pass "$script is executable"
        else
            warn "$script is not executable (chmod +x needed)"
        fi
    else
        fail "Script missing: $script"
    fi
done
echo ""

# 2. Check backup configuration file
info "Checking Backup Configuration..."

if [ -f "$CONFIG_DIR/.backup.env" ]; then
    pass "Backup configuration file exists: $CONFIG_DIR/.backup.env"

    # Check file permissions
    PERMS=$(stat -c "%a" "$CONFIG_DIR/.backup.env" 2>/dev/null || stat -f "%Lp" "$CONFIG_DIR/.backup.env" 2>/dev/null || echo "unknown")
    if [ "$PERMS" = "600" ] || [ "$PERMS" = "400" ]; then
        pass "Configuration file has secure permissions: $PERMS"
    else
        warn "Configuration file permissions too open: $PERMS (recommended: 600)"
    fi

    # Check for required variables
    source "$CONFIG_DIR/.backup.env" 2>/dev/null || true

    if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        pass "BACKUP_ENCRYPTION_KEY is set"

        # Check key length
        KEY_LENGTH=${#BACKUP_ENCRYPTION_KEY}
        if [ "$KEY_LENGTH" -ge 32 ]; then
            pass "Encryption key length sufficient: $KEY_LENGTH characters"
        else
            warn "Encryption key length: $KEY_LENGTH characters (recommended: 32+)"
        fi
    else
        warn "BACKUP_ENCRYPTION_KEY not set (encryption disabled)"
    fi

    if [ -n "${S3_BUCKET:-}" ]; then
        pass "S3_BUCKET is configured"
    else
        warn "S3_BUCKET not configured"
    fi

    if [ -n "${DB_NAME:-}" ]; then
        pass "DB_NAME is configured: $DB_NAME"
    else
        warn "DB_NAME not configured (will use default)"
    fi
else
    warn "Backup configuration file not found: $CONFIG_DIR/.backup.env"
    info "Create with: scripts/setup-backup-config.sh"
fi
echo ""

# 3. Check backup directories
info "Checking Backup Directories..."

BACKUP_SUBDIRS=(
    "$BACKUP_DIR"
    "$BACKUP_DIR/database"
    "$BACKUP_DIR/database/full"
    "$BACKUP_DIR/database/incremental"
    "$BACKUP_DIR/database/wal"
)

for dir in "${BACKUP_SUBDIRS[@]}"; do
    if [ -d "$dir" ]; then
        pass "Directory exists: $dir"

        # Check write permissions
        if [ -w "$dir" ]; then
            pass "Directory is writable: $dir"
        else
            fail "Directory is not writable: $dir"
        fi
    else
        warn "Directory missing: $dir (will be created on first backup)"
    fi
done
echo ""

# 4. Check PostgreSQL client tools
info "Checking PostgreSQL Client Tools..."

if command -v pg_dump &> /dev/null; then
    PG_VERSION=$(pg_dump --version | awk '{print $3}')
    pass "pg_dump installed: version $PG_VERSION"
else
    fail "pg_dump not installed (required for database backups)"
fi

if command -v pg_restore &> /dev/null; then
    pass "pg_restore installed"
else
    fail "pg_restore not installed (required for restores)"
fi

if command -v pg_isready &> /dev/null; then
    pass "pg_isready installed"
else
    warn "pg_isready not installed (optional)"
fi
echo ""

# 5. Check database connectivity
info "Checking Database Connectivity..."

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-ccw_user}"
DB_NAME="${DB_NAME:-ccw_production}"

if command -v pg_isready &> /dev/null; then
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        pass "Database is accessible at $DB_HOST:$DB_PORT"
    else
        warn "Database not accessible (may not be running)"
    fi
else
    warn "Cannot test database connectivity (pg_isready not installed)"
fi
echo ""

# 6. Check encryption tools
info "Checking Encryption Tools..."

if command -v gpg &> /dev/null; then
    GPG_VERSION=$(gpg --version | head -1 | awk '{print $3}')
    pass "GPG installed: version $GPG_VERSION"

    # Test encryption/decryption
    if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        if echo "test" | gpg --symmetric --cipher-algo AES256 --batch --passphrase "$BACKUP_ENCRYPTION_KEY" | \
           gpg --decrypt --batch --passphrase "$BACKUP_ENCRYPTION_KEY" &> /dev/null; then
            pass "GPG encryption/decryption test successful"
        else
            fail "GPG encryption/decryption test failed"
        fi
    else
        warn "Cannot test GPG (BACKUP_ENCRYPTION_KEY not set)"
    fi
else
    fail "GPG not installed (required for encryption)"
fi
echo ""

# 7. Check compression tools
info "Checking Compression Tools..."

if command -v gzip &> /dev/null; then
    pass "gzip installed"
else
    fail "gzip not installed (required for compression)"
fi

if command -v gunzip &> /dev/null; then
    pass "gunzip installed"
else
    fail "gunzip not installed (required for decompression)"
fi
echo ""

# 8. Check AWS CLI and S3 access
info "Checking AWS CLI and S3 Access..."

if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | awk '{print $1}')
    pass "AWS CLI installed: $AWS_VERSION"

    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        pass "AWS credentials configured"

        # Get identity
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
        USER_ARN=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null || echo "unknown")
        info "AWS Account: $ACCOUNT_ID"
        info "Identity: $USER_ARN"

        # Test S3 access
        if aws s3 ls "$S3_BUCKET" &> /dev/null; then
            pass "S3 bucket accessible: $S3_BUCKET"

            # Check bucket versioning
            VERSIONING=$(aws s3api get-bucket-versioning --bucket "${S3_BUCKET#s3://}" --query Status --output text 2>/dev/null || echo "None")
            if [ "$VERSIONING" = "Enabled" ]; then
                pass "S3 bucket versioning enabled"
            else
                warn "S3 bucket versioning not enabled (recommended)"
            fi

            # Check bucket encryption
            if aws s3api get-bucket-encryption --bucket "${S3_BUCKET#s3://}" &> /dev/null; then
                pass "S3 bucket encryption enabled"
            else
                warn "S3 bucket encryption not enabled (recommended)"
            fi

            # Check lifecycle policy
            if aws s3api get-bucket-lifecycle-configuration --bucket "${S3_BUCKET#s3://}" &> /dev/null; then
                pass "S3 lifecycle policy configured"
            else
                warn "S3 lifecycle policy not configured (recommended for cost optimization)"
            fi
        else
            warn "S3 bucket not accessible: $S3_BUCKET (check permissions or create bucket)"
        fi
    else
        warn "AWS credentials not configured (use 'aws configure' or IAM role)"
    fi
else
    fail "AWS CLI not installed (required for S3 backups)"
fi
echo ""

# 9. Check cron jobs
info "Checking Cron Jobs..."

# Check if cron is installed
if command -v crontab &> /dev/null; then
    pass "crontab command available"

    # Check for backup-related cron jobs
    if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
        pass "Database backup cron job configured"

        # Show backup schedule
        CRON_SCHEDULE=$(crontab -l 2>/dev/null | grep "backup-database.sh" | head -1)
        info "Schedule: $CRON_SCHEDULE"
    else
        warn "Database backup cron job not configured"
        info "Configure with: crontab -e"
    fi

    if crontab -l 2>/dev/null | grep -q "verify-backup.sh"; then
        pass "Backup verification cron job configured"
    else
        warn "Backup verification cron job not configured (recommended)"
    fi
else
    warn "crontab not available (cron may not be installed)"
fi
echo ""

# 10. Check backup logs
info "Checking Backup Logs..."

LOG_FILE="/var/log/ccw-backup.log"

if [ -f "$LOG_FILE" ]; then
    pass "Backup log file exists: $LOG_FILE"

    # Check if log file is writable
    if [ -w "$LOG_FILE" ]; then
        pass "Backup log file is writable"
    else
        warn "Backup log file is not writable (check permissions)"
    fi

    # Check log file size
    LOG_SIZE=$(du -h "$LOG_FILE" | cut -f1)
    info "Log file size: $LOG_SIZE"

    # Check for recent backup activity
    if [ -s "$LOG_FILE" ]; then
        LAST_BACKUP=$(grep "Backup completed successfully" "$LOG_FILE" | tail -1 || echo "No successful backups found")
        if [ "$LAST_BACKUP" != "No successful backups found" ]; then
            pass "Recent backup activity detected"
            info "Last successful backup: $(echo "$LAST_BACKUP" | head -c 100)..."
        else
            warn "No successful backups found in log"
        fi
    else
        warn "Backup log file is empty (no backups run yet)"
    fi
else
    warn "Backup log file not found: $LOG_FILE (will be created on first backup)"
fi
echo ""

# 11. Check existing backups
info "Checking Existing Backups..."

# Check local backups
if [ -d "$BACKUP_DIR/database/full" ]; then
    LOCAL_BACKUP_COUNT=$(find "$BACKUP_DIR/database/full" -name "*.sql.gz.gpg" 2>/dev/null | wc -l || echo 0)
    if [ "$LOCAL_BACKUP_COUNT" -gt 0 ]; then
        pass "Found $LOCAL_BACKUP_COUNT local backup file(s)"

        # Get most recent backup
        LATEST_BACKUP=$(find "$BACKUP_DIR/database/full" -name "*.sql.gz.gpg" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2- || echo "")
        if [ -n "$LATEST_BACKUP" ]; then
            BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP" 2>/dev/null || echo 0)) / 86400 ))
            info "Latest local backup: $(basename "$LATEST_BACKUP")"
            info "Backup age: $BACKUP_AGE days"

            if [ "$BACKUP_AGE" -le 1 ]; then
                pass "Recent backup exists (< 1 day old)"
            elif [ "$BACKUP_AGE" -le 7 ]; then
                warn "Latest backup is $BACKUP_AGE days old"
            else
                fail "Latest backup is $BACKUP_AGE days old (backups may not be running)"
            fi
        fi
    else
        warn "No local backup files found (backups may be stored in S3 only)"
    fi
else
    warn "Local backup directory not found"
fi

# Check S3 backups
if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    if aws s3 ls "$S3_BUCKET/database/full/" &> /dev/null; then
        S3_BACKUP_COUNT=$(aws s3 ls "$S3_BUCKET/database/full/" --recursive 2>/dev/null | grep ".sql.gz.gpg" | wc -l || echo 0)
        if [ "$S3_BACKUP_COUNT" -gt 0 ]; then
            pass "Found $S3_BACKUP_COUNT backup file(s) in S3"

            # Get most recent S3 backup
            LATEST_S3_BACKUP=$(aws s3 ls "$S3_BUCKET/database/full/" --recursive 2>/dev/null | grep ".sql.gz.gpg" | sort | tail -1)
            if [ -n "$LATEST_S3_BACKUP" ]; then
                info "Latest S3 backup: $(echo "$LATEST_S3_BACKUP" | awk '{print $NF}')"
            fi
        else
            warn "No backup files found in S3"
        fi
    else
        warn "Cannot access S3 backup directory"
    fi
else
    warn "Cannot check S3 backups (AWS CLI not configured)"
fi
echo ""

# 12. Check retention policies
info "Checking Retention Policies..."

FULL_RETENTION_DAYS="${FULL_RETENTION_DAYS:-30}"
INCREMENTAL_RETENTION_DAYS="${INCREMENTAL_RETENTION_DAYS:-7}"

info "Configured retention:"
echo "  Full backups: $FULL_RETENTION_DAYS days"
echo "  Incremental backups: $INCREMENTAL_RETENTION_DAYS days"

# Check if cleanup script exists
if [ -f "scripts/cleanup-backups.sh" ]; then
    pass "Backup cleanup script exists"

    # Check if scheduled in cron
    if crontab -l 2>/dev/null | grep -q "cleanup-backups.sh"; then
        pass "Backup cleanup scheduled in cron"
    else
        warn "Backup cleanup not scheduled (old backups won't be removed)"
    fi
else
    warn "Backup cleanup script not found (old backups must be removed manually)"
fi
echo ""

# 13. Check backup monitoring
info "Checking Backup Monitoring..."

# Check if monitoring tools are configured
if command -v prometheus &> /dev/null || [ -f "/etc/prometheus/prometheus.yml" ]; then
    pass "Prometheus monitoring available"

    # Check for backup metrics
    if curl -s http://localhost:9090/-/healthy &> /dev/null; then
        pass "Prometheus is running"
    else
        warn "Prometheus is not running"
    fi
else
    warn "Prometheus not installed (backup metrics not available)"
fi

# Check for alert configuration
if [ -f "/etc/prometheus/rules/backup-alerts.yml" ] || [ -f "monitoring/backup-alerts.yml" ]; then
    pass "Backup alert rules configured"
else
    warn "Backup alert rules not configured (failures won't generate alerts)"
fi
echo ""

# 14. Check backup documentation
info "Checking Backup Documentation..."

DOCS=(
    "docs/BACKUP_STRATEGY.md"
    "docs/DISASTER_RECOVERY.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        pass "Documentation exists: $doc"
    else
        if [ "$doc" = "docs/DISASTER_RECOVERY.md" ]; then
            warn "Documentation missing: $doc (optional but recommended)"
        else
            fail "Documentation missing: $doc"
        fi
    fi
done
echo ""

# 15. Check restore capability
info "Checking Restore Capability..."

if [ -f "scripts/restore-backup.sh" ]; then
    pass "Restore script exists"

    if [ -x "scripts/restore-backup.sh" ]; then
        pass "Restore script is executable"
    else
        warn "Restore script is not executable"
    fi

    # Check if restore has been tested
    RESTORE_LOG="/var/log/ccw-restore.log"
    if [ -f "$RESTORE_LOG" ]; then
        pass "Restore log exists (restore has been tested)"

        LAST_RESTORE=$(grep "Restore completed successfully" "$RESTORE_LOG" | tail -1 || echo "")
        if [ -n "$LAST_RESTORE" ]; then
            info "Last restore test: $(echo "$LAST_RESTORE" | head -c 100)..."
        fi
    else
        warn "Restore has not been tested yet (run test restore to verify)"
    fi
else
    fail "Restore script missing"
fi
echo ""

# 16. Check backup verification
info "Checking Backup Verification..."

if [ -f "scripts/verify-backup.sh" ]; then
    pass "Backup verification script exists"

    # Check if verification is scheduled
    if crontab -l 2>/dev/null | grep -q "verify-backup.sh"; then
        pass "Backup verification scheduled in cron"
    else
        warn "Backup verification not scheduled (integrity not automatically checked)"
    fi

    # Check verification log
    VERIFY_LOG="/var/log/ccw-backup-verify.log"
    if [ -f "$VERIFY_LOG" ]; then
        pass "Verification log exists"

        # Check for recent verification
        if [ -s "$VERIFY_LOG" ]; then
            LAST_VERIFY=$(tail -1 "$VERIFY_LOG")
            info "Last verification: $(echo "$LAST_VERIFY" | head -c 100)..."
        fi
    else
        warn "Verification log not found (verification may not have run)"
    fi
else
    fail "Backup verification script missing"
fi
echo ""

# 17. Check disaster recovery plan
info "Checking Disaster Recovery Plan..."

if [ -f "docs/DISASTER_RECOVERY.md" ]; then
    pass "Disaster recovery documentation exists"

    # Check for key sections
    if grep -q "RTO\|Recovery Time Objective" "docs/DISASTER_RECOVERY.md"; then
        pass "RTO (Recovery Time Objective) documented"
    else
        warn "RTO not documented"
    fi

    if grep -q "RPO\|Recovery Point Objective" "docs/DISASTER_RECOVERY.md"; then
        pass "RPO (Recovery Point Objective) documented"
    else
        warn "RPO not documented"
    fi
else
    warn "Disaster recovery documentation not found"
fi
echo ""

# 18. Check backup security
info "Checking Backup Security..."

# Check encryption status
if [ -n "${ENCRYPTION_ENABLED:-}" ] && [ "$ENCRYPTION_ENABLED" = "true" ]; then
    pass "Backup encryption enabled"
else
    fail "Backup encryption not enabled (backups are stored in plain text)"
fi

# Check S3 bucket access logging
if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
    if aws s3api get-bucket-logging --bucket "${S3_BUCKET#s3://}" &> /dev/null; then
        LOGGING_ENABLED=$(aws s3api get-bucket-logging --bucket "${S3_BUCKET#s3://}" --query 'LoggingEnabled.TargetBucket' --output text 2>/dev/null || echo "None")
        if [ "$LOGGING_ENABLED" != "None" ] && [ "$LOGGING_ENABLED" != "" ]; then
            pass "S3 access logging enabled"
        else
            warn "S3 access logging not enabled (recommended for audit)"
        fi
    fi
fi

# Check backup file permissions
if [ -d "$BACKUP_DIR/database/full" ]; then
    SAMPLE_BACKUP=$(find "$BACKUP_DIR/database/full" -name "*.sql.gz.gpg" -type f | head -1)
    if [ -n "$SAMPLE_BACKUP" ]; then
        BACKUP_PERMS=$(stat -c "%a" "$SAMPLE_BACKUP" 2>/dev/null || stat -f "%Lp" "$SAMPLE_BACKUP" 2>/dev/null || echo "unknown")
        if [ "$BACKUP_PERMS" = "600" ] || [ "$BACKUP_PERMS" = "400" ]; then
            pass "Backup files have secure permissions: $BACKUP_PERMS"
        else
            warn "Backup file permissions: $BACKUP_PERMS (recommended: 600)"
        fi
    fi
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
    echo -e "${GREEN}✓ Automated backup configuration looks good!${NC}"
    echo ""
    info "Next steps:"
    echo "  1. Configure cron jobs: crontab -e"
    echo "  2. Run test backup: ./scripts/backup-database.sh full"
    echo "  3. Verify backup: ./scripts/verify-backup.sh"
    echo "  4. Test restore: ./scripts/restore-backup.sh <backup-file>"
    echo "  5. Monitor backup logs: tail -f /var/log/ccw-backup.log"
    echo ""
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Automated backup system has warnings.${NC}"
    echo ""
    warn "Review warnings above and improve configuration if needed."
    echo ""
    info "Key recommendations:"
    echo "  - Enable S3 bucket versioning and encryption"
    echo "  - Configure backup verification in cron"
    echo "  - Test restore procedure"
    echo "  - Set up backup monitoring and alerts"
    echo "  - Document disaster recovery procedures"
    exit 0
else
    echo -e "${RED}✗ Automated backup system has issues.${NC}"
    echo ""
    fail "Critical issues found. Please review failed checks above."
    echo ""
    info "Critical fixes needed:"
    echo "  - Install required tools (pg_dump, gpg, aws-cli)"
    echo "  - Create backup configuration file"
    echo "  - Configure AWS credentials and S3 bucket"
    echo "  - Enable encryption"
    echo "  - Set up cron jobs for automated backups"
    exit 1
fi
