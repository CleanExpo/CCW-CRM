#!/bin/bash
# Backup Verification Script for CCW-Online ERP
# Version: 1.0
# Description: Automated backup integrity verification and restore testing
# Related: ISS-D041

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
    logger -t ccw-backup-verify "[INFO] $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    logger -t ccw-backup-verify "[WARN] $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    logger -t ccw-backup-verify "[ERROR] $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
CONFIG_DIR="/opt/ccw-online-erp/config"
BACKUP_DIR="/opt/ccw-online-erp/backups/database"
VERIFY_DIR="/tmp/ccw-backup-verify"
LOG_FILE="/var/log/ccw-backup-verify.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load configuration
if [ -f "$CONFIG_DIR/.backup.env" ]; then
    source "$CONFIG_DIR/.backup.env"
else
    log_warn "Backup configuration file not found, using defaults"
fi

# Configuration variables
S3_BUCKET="${S3_BUCKET:-s3://ccw-online-erp-backups}"
USE_S3="${USE_S3:-true}"
ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-true}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
TEST_RESTORE="${TEST_RESTORE:-false}"  # Whether to test full restore

# Verification results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Function to increment counters
check_passed() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    log_info "✓ $1"
}

check_failed() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    log_error "✗ $1"
}

check_warning() {
    WARNINGS=$((WARNINGS + 1))
    log_warn "⚠ $1"
}

# Function to check S3 connectivity
verify_s3_access() {
    log_step "Verifying S3 access..."

    if ! command -v aws &> /dev/null; then
        check_failed "AWS CLI not installed"
        return 1
    fi

    if aws s3 ls "$S3_BUCKET/" > /dev/null 2>&1; then
        check_passed "S3 bucket accessible: $S3_BUCKET"
    else
        check_failed "Cannot access S3 bucket: $S3_BUCKET"
        return 1
    fi
}

# Function to verify backup existence
verify_backup_existence() {
    log_step "Checking for recent backups..."

    # Check for full backups in last 24 hours
    if [ "$USE_S3" = "true" ]; then
        RECENT_FULL_BACKUPS=$(aws s3 ls "$S3_BUCKET/database/full/" | \
            awk '{print $4}' | \
            grep "backup_full_$(date +%Y%m%d)" | wc -l)

        if [ "$RECENT_FULL_BACKUPS" -gt 0 ]; then
            check_passed "Found $RECENT_FULL_BACKUPS full backup(s) from today"
        else
            # Check yesterday's backup
            YESTERDAY=$(date -d "yesterday" +%Y%m%d 2>/dev/null || date -v-1d +%Y%m%d 2>/dev/null)
            RECENT_FULL_BACKUPS=$(aws s3 ls "$S3_BUCKET/database/full/" | \
                awk '{print $4}' | \
                grep "backup_full_${YESTERDAY}" | wc -l)

            if [ "$RECENT_FULL_BACKUPS" -gt 0 ]; then
                check_warning "No backup from today, but found $RECENT_FULL_BACKUPS from yesterday"
            else
                check_failed "No recent full backups found (last 24 hours)"
            fi
        fi
    else
        # Check local backups
        if [ -d "$BACKUP_DIR/full" ]; then
            RECENT_FULL_BACKUPS=$(find "$BACKUP_DIR/full" -name "backup_full_*.sql*" -mtime -1 | wc -l)
            if [ "$RECENT_FULL_BACKUPS" -gt 0 ]; then
                check_passed "Found $RECENT_FULL_BACKUPS local full backup(s) from last 24 hours"
            else
                check_failed "No recent local full backups found"
            fi
        else
            check_failed "Backup directory not found: $BACKUP_DIR/full"
        fi
    fi
}

# Function to verify backup size
verify_backup_size() {
    log_step "Verifying backup file sizes..."

    if [ "$USE_S3" = "true" ]; then
        # Get latest backup
        LATEST_BACKUP=$(aws s3 ls "$S3_BUCKET/database/full/" | \
            sort | tail -1 | awk '{print $4}')

        if [ -z "$LATEST_BACKUP" ]; then
            check_failed "No backups found in S3"
            return 1
        fi

        # Get file size
        BACKUP_SIZE=$(aws s3 ls "$S3_BUCKET/database/full/$LATEST_BACKUP" | \
            awk '{print $3}')

        BACKUP_SIZE_MB=$((BACKUP_SIZE / 1024 / 1024))

        # Check if backup size is reasonable (> 1MB)
        if [ "$BACKUP_SIZE_MB" -gt 1 ]; then
            check_passed "Backup size is reasonable: ${BACKUP_SIZE_MB}MB ($LATEST_BACKUP)"
        else
            check_failed "Backup size is suspiciously small: ${BACKUP_SIZE_MB}MB"
        fi

        # Compare with previous backup (should not differ by more than 50%)
        PREVIOUS_BACKUP=$(aws s3 ls "$S3_BUCKET/database/full/" | \
            sort | tail -2 | head -1 | awk '{print $4}')

        if [ -n "$PREVIOUS_BACKUP" ] && [ "$PREVIOUS_BACKUP" != "$LATEST_BACKUP" ]; then
            PREVIOUS_SIZE=$(aws s3 ls "$S3_BUCKET/database/full/$PREVIOUS_BACKUP" | \
                awk '{print $3}')
            PREVIOUS_SIZE_MB=$((PREVIOUS_SIZE / 1024 / 1024))

            # Calculate percentage difference
            DIFF_PERCENT=$(echo "scale=2; ($BACKUP_SIZE_MB - $PREVIOUS_SIZE_MB) * 100 / $PREVIOUS_SIZE_MB" | bc 2>/dev/null || echo "0")
            DIFF_PERCENT_ABS=$(echo "$DIFF_PERCENT" | tr -d '-')

            if [ "$(echo "$DIFF_PERCENT_ABS > 50" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
                check_warning "Backup size differs significantly from previous: ${DIFF_PERCENT}%"
            else
                check_passed "Backup size consistent with previous: ${DIFF_PERCENT}% difference"
            fi
        fi
    fi
}

# Function to verify checksum
verify_checksum() {
    log_step "Verifying backup checksums..."

    if [ "$USE_S3" != "true" ]; then
        log_info "Skipping checksum verification (local backups only)"
        return
    fi

    # Get latest backup
    LATEST_BACKUP=$(aws s3 ls "$S3_BUCKET/database/full/" | \
        sort | tail -1 | awk '{print $4}')

    if [ -z "$LATEST_BACKUP" ]; then
        check_failed "No backups found for checksum verification"
        return 1
    fi

    # Check if checksum file exists
    if aws s3 ls "$S3_BUCKET/database/full/${LATEST_BACKUP}.sha256" > /dev/null 2>&1; then
        mkdir -p "$VERIFY_DIR"

        # Download backup and checksum
        log_info "Downloading backup for verification: $LATEST_BACKUP"
        aws s3 cp "$S3_BUCKET/database/full/$LATEST_BACKUP" "$VERIFY_DIR/" > /dev/null 2>&1
        aws s3 cp "$S3_BUCKET/database/full/${LATEST_BACKUP}.sha256" "$VERIFY_DIR/" > /dev/null 2>&1

        # Verify checksum
        cd "$VERIFY_DIR"
        if sha256sum -c "${LATEST_BACKUP}.sha256" > /dev/null 2>&1; then
            check_passed "Checksum verification passed for $LATEST_BACKUP"
        else
            check_failed "Checksum verification failed for $LATEST_BACKUP"
        fi
        cd - > /dev/null

        # Cleanup
        rm -f "$VERIFY_DIR/$LATEST_BACKUP" "$VERIFY_DIR/${LATEST_BACKUP}.sha256"
    else
        check_warning "Checksum file not found for $LATEST_BACKUP"
    fi
}

# Function to test decryption
verify_decryption() {
    log_step "Testing backup decryption..."

    if [ "$ENCRYPTION_ENABLED" != "true" ]; then
        log_info "Skipping decryption test (encryption not enabled)"
        return
    fi

    if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        check_failed "Encryption key not set, cannot test decryption"
        return 1
    fi

    if [ "$USE_S3" != "true" ]; then
        log_info "Skipping decryption test (local backups only)"
        return
    fi

    # Get latest backup
    LATEST_BACKUP=$(aws s3 ls "$S3_BUCKET/database/full/" | \
        grep "\.gpg$" | sort | tail -1 | awk '{print $4}')

    if [ -z "$LATEST_BACKUP" ]; then
        check_warning "No encrypted backups found for decryption test"
        return
    fi

    mkdir -p "$VERIFY_DIR"

    # Download small portion for testing (first 10MB)
    log_info "Testing decryption on: $LATEST_BACKUP"
    aws s3 cp "$S3_BUCKET/database/full/$LATEST_BACKUP" "$VERIFY_DIR/" \
        --range bytes=0-10485760 > /dev/null 2>&1 || \
        aws s3 cp "$S3_BUCKET/database/full/$LATEST_BACKUP" "$VERIFY_DIR/" > /dev/null 2>&1

    # Test decryption (just verify it doesn't fail, don't fully decrypt)
    if echo "test" | gpg --decrypt --batch --passphrase "$BACKUP_ENCRYPTION_KEY" \
        "$VERIFY_DIR/$LATEST_BACKUP" > /dev/null 2>&1; then
        check_passed "Decryption test passed"
    else
        # Try actual file decryption test
        if gpg --decrypt --batch --passphrase "$BACKUP_ENCRYPTION_KEY" \
            "$VERIFY_DIR/$LATEST_BACKUP" > /dev/null 2>&1; then
            check_passed "Decryption test passed"
        else
            check_failed "Decryption test failed - encryption key may be incorrect"
        fi
    fi

    # Cleanup
    rm -f "$VERIFY_DIR/$LATEST_BACKUP"
}

# Function to test restore (optional, resource-intensive)
verify_restore() {
    if [ "$TEST_RESTORE" != "true" ]; then
        log_info "Skipping restore test (not enabled)"
        return
    fi

    log_step "Testing database restore to temporary database..."

    # This would require significant resources
    # Only run periodically (e.g., monthly) or on-demand

    log_warn "Full restore testing is resource-intensive"
    log_warn "Run this manually using: sudo TEST_DB=ccw_verify ./scripts/restore-backup.sh"
}

# Function to verify backup retention
verify_retention() {
    log_step "Verifying backup retention policy..."

    if [ "$USE_S3" != "true" ]; then
        log_info "Skipping retention verification (local backups only)"
        return
    fi

    # Count backups by age
    BACKUPS_LAST_7_DAYS=$(aws s3 ls "$S3_BUCKET/database/full/" | \
        awk '{print $1, $2, $4}' | \
        grep "$(date +%Y-%m)" | wc -l)

    BACKUPS_LAST_30_DAYS=$(aws s3 ls "$S3_BUCKET/database/full/" | \
        wc -l)

    log_info "Backups in last 7 days: $BACKUPS_LAST_7_DAYS"
    log_info "Total backups: $BACKUPS_LAST_30_DAYS"

    # Verify we have at least one backup per day for last 7 days
    if [ "$BACKUPS_LAST_7_DAYS" -ge 7 ]; then
        check_passed "Sufficient recent backups (last 7 days): $BACKUPS_LAST_7_DAYS"
    else
        check_warning "Fewer backups than expected (last 7 days): $BACKUPS_LAST_7_DAYS"
    fi

    # Check for very old backups (> 60 days)
    OLD_BACKUPS=$(aws s3 ls "$S3_BUCKET/database/full/" | \
        awk '{print $1, $2, $4}' | \
        while read date time file; do
            backup_date=$(echo "$file" | grep -oP '\d{8}' | head -1)
            if [ -n "$backup_date" ]; then
                age_days=$(( ($(date +%s) - $(date -d "$backup_date" +%s 2>/dev/null || echo 0)) / 86400 ))
                if [ "$age_days" -gt 60 ]; then
                    echo "$file"
                fi
            fi
        done | wc -l)

    if [ "$OLD_BACKUPS" -gt 0 ]; then
        check_warning "Found $OLD_BACKUPS backups older than 60 days (should be cleaned up)"
    else
        check_passed "No excessively old backups found"
    fi
}

# Function to send notification
send_notification() {
    local STATUS=$1
    local MESSAGE=$2

    # Log to file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$STATUS] $MESSAGE" >> "$LOG_FILE"

    # Send email (if configured)
    if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
        echo "$MESSAGE" | mail -s "Backup Verification $STATUS: CCW-Online ERP" "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi

    # Send to Slack (if configured)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local EMOJI="✅"
        [ "$STATUS" = "WARNING" ] && EMOJI="⚠️"
        [ "$STATUS" = "FAILED" ] && EMOJI="❌"

        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"$EMOJI **Backup Verification $STATUS**: $MESSAGE\"}" > /dev/null 2>&1 || true
    fi
}

# Function to generate summary report
generate_report() {
    log_info "========================================"
    log_info "Backup Verification Summary"
    log_info "========================================"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Total Checks: $TOTAL_CHECKS"
    log_info "Passed: $PASSED_CHECKS"
    log_info "Failed: $FAILED_CHECKS"
    log_info "Warnings: $WARNINGS"
    log_info "========================================"

    # Determine overall status
    if [ "$FAILED_CHECKS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
        log_info "Overall Status: ✓ ALL CHECKS PASSED"
        send_notification "SUCCESS" "All backup verification checks passed ($PASSED_CHECKS/$TOTAL_CHECKS)"
        return 0
    elif [ "$FAILED_CHECKS" -eq 0 ]; then
        log_warn "Overall Status: ⚠ PASSED WITH WARNINGS"
        send_notification "WARNING" "Backup verification passed with $WARNINGS warning(s)"
        return 0
    else
        log_error "Overall Status: ✗ FAILED"
        send_notification "FAILED" "Backup verification failed: $FAILED_CHECKS failed checks, $WARNINGS warnings"
        return 1
    fi
}

# Main execution
main() {
    log_info "========================================"
    log_info "CCW-Online ERP Backup Verification"
    log_info "Timestamp: $TIMESTAMP"
    log_info "========================================"

    START_TIME=$(date +%s)

    # Create verification directory
    mkdir -p "$VERIFY_DIR"

    # Run verification checks
    verify_s3_access || true
    verify_backup_existence || true
    verify_backup_size || true
    verify_checksum || true
    verify_decryption || true
    verify_retention || true
    verify_restore || true

    # Cleanup
    rm -rf "$VERIFY_DIR"

    # Generate report
    generate_report

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    log_info "Verification completed in ${DURATION}s"
}

# Error handler
trap 'log_error "Verification script error"; rm -rf "$VERIFY_DIR"; exit 1' ERR

# Run main function
main
