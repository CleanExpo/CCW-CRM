#!/bin/bash
# Database Backup Script for CCW-Online ERP
# Version: 1.0
# Description: Automated PostgreSQL database backup with encryption
# Related: ISS-015

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
    logger -t ccw-backup "[INFO] $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    logger -t ccw-backup "[WARN] $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    logger -t ccw-backup "[ERROR] $1"
}

# Configuration
BACKUP_TYPE="${1:-full}"  # full or incremental
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Prefer repo-local paths; fall back to legacy /opt layout when present.
CONFIG_DIR="${BACKUP_CONFIG_DIR:-$REPO_ROOT/config}"
if [ ! -d "$CONFIG_DIR" ] && [ -d "/opt/ccw-online-erp/config" ]; then
    CONFIG_DIR="/opt/ccw-online-erp/config"
fi
BACKUP_DIR="${BACKUP_ROOT:-$REPO_ROOT/backups/database}"
LOG_FILE="${BACKUP_LOG_FILE:-$REPO_ROOT/backups/ccw-backup.log}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_PATH=$(date +%Y/%m/%d)

# Load configuration (if exists)
if [ -f "$CONFIG_DIR/.backup.env" ]; then
    # shellcheck disable=SC1091
    source "$CONFIG_DIR/.backup.env"
else
    log_warn "Backup configuration file not found: $CONFIG_DIR/.backup.env"
    log_warn "Using default configuration"
fi

# Database configuration (Supabase: use direct port 5432, not pooler 6543)
DB_NAME="${DB_NAME:-ccw_production}"
DB_USER="${DB_USER:-ccw_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# S3 configuration — Australian region for Optix production residency
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-southeast-2}"
S3_BUCKET="${S3_BUCKET:-s3://ccw-online-erp-backups-ap-southeast-2}"
USE_S3="${USE_S3:-true}"
# Server-side encryption on upload (in addition to client-side GPG)
S3_SSE="${S3_SSE:-AES256}"

# Encryption (required for Toby security control — GPG AES-256 at rest)
ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-true}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Retention
FULL_RETENTION_DAYS="${FULL_RETENTION_DAYS:-30}"
INCREMENTAL_RETENTION_DAYS="${INCREMENTAL_RETENTION_DAYS:-7}"

encrypt_file() {
    local src="$1"
    if [ "$ENCRYPTION_ENABLED" != "true" ]; then
        echo "$src"
        return 0
    fi
    if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        log_error "BACKUP_ENCRYPTION_KEY not set"
        exit 1
    fi
    if gpg --symmetric --cipher-algo AES256 --batch --yes \
        --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --output "${src}.gpg" \
        "$src"; then
        rm -f "$src"
        echo "${src}.gpg"
    else
        log_error "Encryption failed for $src"
        exit 1
    fi
}

s3_cp() {
    local src="$1"
    local dest="$2"
    local storage_class="${3:-STANDARD}"
    aws s3 cp "$src" "$dest" \
        --region "$AWS_DEFAULT_REGION" \
        --sse "$S3_SSE" \
        --storage-class "$storage_class"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"/{full,incremental,wal}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if PostgreSQL client tools are installed
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi

    # Check if database is accessible
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        log_error "Database is not accessible at $DB_HOST:$DB_PORT"
        exit 1
    fi

    # Check if AWS CLI is installed (if using S3)
    if [ "$USE_S3" = "true" ] && ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install awscli."
        exit 1
    fi

    # Check if GPG is installed (if encryption enabled)
    if [ "$ENCRYPTION_ENABLED" = "true" ] && ! command -v gpg &> /dev/null; then
        log_error "GPG not found. Please install gnupg."
        exit 1
    fi

    # Check if encryption key is set (if encryption enabled)
    if [ "$ENCRYPTION_ENABLED" = "true" ] && [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        log_error "BACKUP_ENCRYPTION_KEY not set. Please configure encryption key."
        exit 1
    fi

    log_info "All prerequisites met"
}

# Function to perform full database backup
backup_full() {
    log_info "Starting full database backup..."

    BACKUP_FILE="backup_full_${TIMESTAMP}.sql"
    BACKUP_PATH="$BACKUP_DIR/full/$BACKUP_FILE"

    # Create backup using pg_dump
    log_info "Creating database dump..."
    if pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$BACKUP_PATH"; then
        log_info "Database dump created successfully"
    else
        log_error "Database dump failed"
        exit 1
    fi

    # Get file size before compression
    ORIGINAL_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log_info "Backup size (before compression): $ORIGINAL_SIZE"

    # Compress backup
    log_info "Compressing backup..."
    if gzip "$BACKUP_PATH"; then
        BACKUP_PATH="${BACKUP_PATH}.gz"
        BACKUP_FILE="${BACKUP_FILE}.gz"
        log_info "Backup compressed successfully"
    else
        log_error "Compression failed"
        exit 1
    fi

    COMPRESSED_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log_info "Backup size (after compression): $COMPRESSED_SIZE"

    # Encrypt backup (AES-256 via GPG — required)
    if [ "$ENCRYPTION_ENABLED" = "true" ]; then
        log_info "Encrypting backup (AES-256)..."
        BACKUP_PATH="$(encrypt_file "$BACKUP_PATH")"
        BACKUP_FILE="$(basename "$BACKUP_PATH")"
        log_info "Backup encrypted successfully"
    fi

    FINAL_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    log_info "Final backup size: $FINAL_SIZE"

    # Calculate checksum
    CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
    echo "$CHECKSUM  $BACKUP_FILE" > "${BACKUP_PATH}.sha256"
    log_info "Checksum: $CHECKSUM"

    # Upload to S3 (if enabled) — TLS in transit + SSE at rest
    if [ "$USE_S3" = "true" ]; then
        log_info "Uploading backup to S3 ($AWS_DEFAULT_REGION, SSE=$S3_SSE)..."
        S3_PATH="$S3_BUCKET/database/full/$BACKUP_FILE"

        if s3_cp "$BACKUP_PATH" "$S3_PATH" STANDARD; then
            log_info "Backup uploaded to S3: $S3_PATH"
            s3_cp "${BACKUP_PATH}.sha256" "${S3_PATH}.sha256" STANDARD

            if aws s3 ls "$S3_PATH" --region "$AWS_DEFAULT_REGION" > /dev/null 2>&1; then
                log_info "S3 upload verified"
                if [ "${KEEP_LOCAL_BACKUP:-false}" != "true" ]; then
                    rm "$BACKUP_PATH" "${BACKUP_PATH}.sha256"
                    log_info "Local backup removed (uploaded to S3)"
                fi
            else
                log_error "S3 upload verification failed"
                exit 1
            fi
        else
            log_error "S3 upload failed"
            exit 1
        fi
    fi

    log_info "Full backup completed successfully: $BACKUP_FILE"
}

# Function to perform incremental backup (via WAL archiving)
backup_incremental() {
    log_info "Starting incremental backup (WAL archiving)..."

    WAL_BACKUP_DIR="$BACKUP_DIR/wal/$DATE_PATH"
    mkdir -p "$WAL_BACKUP_DIR"

    # Get WAL directory from PostgreSQL
    WAL_DIR=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SHOW data_directory;" | xargs -I {} echo {}/pg_wal 2>/dev/null)

    if [ -z "$WAL_DIR" ] || [ ! -d "$WAL_DIR" ]; then
        log_warn "WAL directory not accessible. Using logical backup instead."
        # Fall back to a quick SQL dump of recent changes
        backup_logical_incremental
        return
    fi

    # Archive WAL files
    log_info "Archiving WAL files from: $WAL_DIR"

    # Find WAL files modified in the last hour
    WAL_FILES=$(find "$WAL_DIR" -name "0*" -type f -mmin -60 2>/dev/null)

    if [ -z "$WAL_FILES" ]; then
        log_info "No new WAL files to archive"
        return
    fi

    ARCHIVED_COUNT=0
    for WAL_FILE in $WAL_FILES; do
        WAL_BASENAME=$(basename "$WAL_FILE")

        # Copy, compress, and encrypt WAL file
        if gzip -c "$WAL_FILE" > "$WAL_BACKUP_DIR/${WAL_BASENAME}.gz"; then
            WAL_PATH="$(encrypt_file "$WAL_BACKUP_DIR/${WAL_BASENAME}.gz")"
            ARCHIVED_COUNT=$((ARCHIVED_COUNT + 1))

            if [ "$USE_S3" = "true" ]; then
                S3_PATH="$S3_BUCKET/database/wal/$DATE_PATH/$(basename "$WAL_PATH")"
                s3_cp "$WAL_PATH" "$S3_PATH" STANDARD_IA > /dev/null 2>&1 || true
            fi
        fi
    done

    log_info "Incremental backup completed: $ARCHIVED_COUNT WAL files archived"
}

# Function to perform logical incremental backup (fallback)
backup_logical_incremental() {
    log_info "Performing logical incremental backup..."

    BACKUP_FILE="backup_incremental_${TIMESTAMP}.sql.gz"
    BACKUP_PATH="$BACKUP_DIR/incremental/$BACKUP_FILE"

    # Create a dump of data modified in the last hour (simplified approach)
    # In production, you might want to track changes more precisely
    log_info "Creating incremental dump..."

    # Export tables with recent changes (example: last 2 hours)
    if pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
        --exclude-table-data='translations' | gzip > "$BACKUP_PATH"; then
        BACKUP_PATH="$(encrypt_file "$BACKUP_PATH")"
        BACKUP_FILE="$(basename "$BACKUP_PATH")"
        log_info "Incremental dump created+encrypted: $(du -h "$BACKUP_PATH" | cut -f1)"

        if [ "$USE_S3" = "true" ]; then
            S3_PATH="$S3_BUCKET/database/incremental/$DATE_PATH/$BACKUP_FILE"
            s3_cp "$BACKUP_PATH" "$S3_PATH" STANDARD_IA
            log_info "Incremental backup uploaded to S3 ($AWS_DEFAULT_REGION)"
        fi
    else
        log_error "Incremental dump failed"
        exit 1
    fi
}

# Function to clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."

    # Clean up local full backups older than retention period
    if [ -d "$BACKUP_DIR/full" ]; then
        DELETED_COUNT=$(find "$BACKUP_DIR/full" -name "backup_full_*.sql.gz*" \
            -mtime "+$FULL_RETENTION_DAYS" -delete -print | wc -l)
        if [ "$DELETED_COUNT" -gt 0 ]; then
            log_info "Deleted $DELETED_COUNT old full backups (older than $FULL_RETENTION_DAYS days)"
        fi
    fi

    # Clean up local incremental backups older than retention period
    if [ -d "$BACKUP_DIR/incremental" ]; then
        DELETED_COUNT=$(find "$BACKUP_DIR/incremental" -name "backup_incremental_*.sql.gz*" \
            -mtime "+$INCREMENTAL_RETENTION_DAYS" -delete -print | wc -l)
        if [ "$DELETED_COUNT" -gt 0 ]; then
            log_info "Deleted $DELETED_COUNT old incremental backups (older than $INCREMENTAL_RETENTION_DAYS days)"
        fi
    fi

    # Clean up WAL files older than 7 days
    if [ -d "$BACKUP_DIR/wal" ]; then
        find "$BACKUP_DIR/wal" -name "*.gz" -mtime +7 -delete
    fi

    log_info "Cleanup completed"
}

# Function to send notification
send_notification() {
    local STATUS=$1
    local MESSAGE=$2

    # Log to file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$STATUS] $MESSAGE" >> "$LOG_FILE"

    # Send email (if configured)
    if [ -n "${NOTIFICATION_EMAIL:-}" ]; then
        echo "$MESSAGE" | mail -s "Backup $STATUS: CCW-Online ERP" "$NOTIFICATION_EMAIL" || true
    fi

    # Send to Slack (if configured)
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"🔧 **Backup $STATUS**: $MESSAGE\"}" > /dev/null 2>&1 || true
    fi
}

# Main execution
main() {
    log_info "========================================"
    log_info "CCW-Online ERP Database Backup"
    log_info "Backup Type: $BACKUP_TYPE"
    log_info "Timestamp: $TIMESTAMP"
    log_info "========================================"

    START_TIME=$(date +%s)

    # Check prerequisites
    check_prerequisites

    # Perform backup based on type
    case "$BACKUP_TYPE" in
        full)
            backup_full
            ;;
        incremental)
            backup_incremental
            ;;
        *)
            log_error "Invalid backup type: $BACKUP_TYPE (use 'full' or 'incremental')"
            exit 1
            ;;
    esac

    # Clean up old backups
    cleanup_old_backups

    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    log_info "========================================"
    log_info "Backup completed successfully"
    log_info "Duration: ${DURATION}s"
    log_info "========================================"

    # Send success notification
    send_notification "SUCCESS" "$BACKUP_TYPE backup completed in ${DURATION}s"
}

# Error handler
trap 'log_error "Backup failed"; send_notification "FAILED" "Backup failed with error"; exit 1' ERR

# Run main function
main
