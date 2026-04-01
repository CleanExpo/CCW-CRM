#!/bin/bash
# Database Restore Script for CCW-Online ERP
# Version: 1.0
# Description: Restore PostgreSQL database from backup
# Related: ISS-016

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
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configuration
CONFIG_DIR="/opt/ccw-online-erp/config"
BACKUP_DIR="/opt/ccw-online-erp/backups/database"
RESTORE_DIR="/tmp/ccw-restore"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load configuration
if [ -f "$CONFIG_DIR/.backup.env" ]; then
    source "$CONFIG_DIR/.backup.env"
else
    log_error "Backup configuration file not found: $CONFIG_DIR/.backup.env"
    exit 1
fi

# Database configuration
DB_NAME="${DB_NAME:-ccw_production}"
DB_USER="${DB_USER:-ccw_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# S3 configuration
S3_BUCKET="${S3_BUCKET:-s3://ccw-online-erp-backups}"
USE_S3="${USE_S3:-true}"

# Encryption
ENCRYPTION_ENABLED="${ENCRYPTION_ENABLED:-true}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Function to display usage
usage() {
    cat <<EOF
Usage: $0 [OPTIONS] BACKUP_FILE

Restore CCW-Online ERP database from backup.

OPTIONS:
    -l, --local             Restore from local backup file
    -s, --s3                Restore from S3 (default)
    -t, --target-db NAME    Target database name (default: $DB_NAME)
    -h, --help              Show this help message

EXAMPLES:
    # Restore from S3 (default)
    $0 backup_full_20260202_020000.sql.gz.gpg

    # Restore from local file
    $0 --local /path/to/backup_full_20260202_020000.sql.gz.gpg

    # Restore to different database
    $0 --target-db ccw_staging backup_full_20260202_020000.sql.gz.gpg

EOF
    exit 1
}

# Function to confirm action
confirm_restore() {
    log_warn "========================================"
    log_warn "WARNING: DATABASE RESTORE OPERATION"
    log_warn "========================================"
    log_warn "This will REPLACE the current database:"
    log_warn "  Database: $DB_NAME"
    log_warn "  Host: $DB_HOST"
    log_warn "  Backup: $BACKUP_FILE"
    log_warn ""
    log_warn "ALL CURRENT DATA WILL BE LOST!"
    log_warn ""

    read -p "Type 'YES' to confirm restore: " CONFIRMATION

    if [ "$CONFIRMATION" != "YES" ]; then
        log_error "Restore cancelled"
        exit 1
    fi

    log_info "Restore confirmed. Proceeding..."
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check if PostgreSQL client tools are installed
    if ! command -v pg_restore &> /dev/null; then
        log_error "pg_restore not found. Please install PostgreSQL client tools."
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

    # Check if encryption key is set
    if [ "$ENCRYPTION_ENABLED" = "true" ] && [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        log_error "BACKUP_ENCRYPTION_KEY not set. Cannot decrypt backup."
        exit 1
    fi

    # Create restore directory
    mkdir -p "$RESTORE_DIR"

    log_info "All prerequisites met"
}

# Function to download backup from S3
download_from_s3() {
    log_step "Downloading backup from S3..."

    S3_PATH="$S3_BUCKET/database/full/$BACKUP_FILE"

    log_info "S3 path: $S3_PATH"

    if aws s3 cp "$S3_PATH" "$RESTORE_DIR/$BACKUP_FILE"; then
        log_info "Backup downloaded successfully"

        # Download checksum file (if exists)
        aws s3 cp "${S3_PATH}.sha256" "$RESTORE_DIR/${BACKUP_FILE}.sha256" 2>/dev/null || true
    else
        log_error "Failed to download backup from S3"
        log_info "Available backups:"
        aws s3 ls "$S3_BUCKET/database/full/" | tail -10
        exit 1
    fi
}

# Function to verify backup integrity
verify_backup() {
    log_step "Verifying backup integrity..."

    BACKUP_PATH="$RESTORE_DIR/$BACKUP_FILE"

    # Check if backup file exists
    if [ ! -f "$BACKUP_PATH" ]; then
        log_error "Backup file not found: $BACKUP_PATH"
        exit 1
    fi

    # Verify checksum (if available)
    if [ -f "${BACKUP_PATH}.sha256" ]; then
        log_info "Verifying checksum..."
        cd "$RESTORE_DIR"
        if sha256sum -c "${BACKUP_FILE}.sha256"; then
            log_info "Checksum verification passed"
        else
            log_error "Checksum verification failed"
            exit 1
        fi
        cd - > /dev/null
    else
        log_warn "Checksum file not found, skipping verification"
    fi

    # Check file size (should be > 1KB)
    FILE_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)
    if [ "$FILE_SIZE" -lt 1024 ]; then
        log_error "Backup file is too small ($FILE_SIZE bytes). Possibly corrupted."
        exit 1
    fi

    log_info "Backup file size: $(du -h "$BACKUP_PATH" | cut -f1)"
}

# Function to decrypt backup
decrypt_backup() {
    if [ "$ENCRYPTION_ENABLED" != "true" ]; then
        return
    fi

    log_step "Decrypting backup..."

    ENCRYPTED_FILE="$RESTORE_DIR/$BACKUP_FILE"
    DECRYPTED_FILE="${ENCRYPTED_FILE%.gpg}"

    if gpg --decrypt --batch --yes \
        --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --output "$DECRYPTED_FILE" \
        "$ENCRYPTED_FILE"; then
        log_info "Backup decrypted successfully"
        rm "$ENCRYPTED_FILE"  # Remove encrypted file
        BACKUP_FILE=$(basename "$DECRYPTED_FILE")
    else
        log_error "Decryption failed"
        exit 1
    fi
}

# Function to decompress backup
decompress_backup() {
    log_step "Decompressing backup..."

    COMPRESSED_FILE="$RESTORE_DIR/$BACKUP_FILE"

    if [[ "$BACKUP_FILE" == *.gz ]]; then
        if gunzip "$COMPRESSED_FILE"; then
            log_info "Backup decompressed successfully"
            BACKUP_FILE="${BACKUP_FILE%.gz}"
        else
            log_error "Decompression failed"
            exit 1
        fi
    else
        log_info "Backup is not compressed, skipping decompression"
    fi
}

# Function to create database backup before restore
create_pre_restore_backup() {
    log_step "Creating pre-restore backup (safety measure)..."

    PRE_RESTORE_BACKUP="$BACKUP_DIR/full/pre_restore_${TIMESTAMP}.sql.gz"

    if pg_dump -Fc -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$PRE_RESTORE_BACKUP"; then
        log_info "Pre-restore backup created: $PRE_RESTORE_BACKUP"
    else
        log_warn "Failed to create pre-restore backup (continuing anyway)"
    fi
}

# Function to stop application services
stop_services() {
    log_step "Stopping application services..."

    # Stop Docker containers (if running)
    if command -v docker &> /dev/null; then
        log_info "Stopping Docker containers..."
        docker compose -f /opt/ccw-online-erp/docker-compose.yml down 2>/dev/null || true
    fi

    # Stop systemd services (if configured)
    for service in ccw-frontend ccw-backend; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            log_info "Stopping $service..."
            systemctl stop "$service" || true
        fi
    done

    log_info "Application services stopped"
}

# Function to start application services
start_services() {
    log_step "Starting application services..."

    # Start Docker containers (if docker-compose.yml exists)
    if [ -f "/opt/ccw-online-erp/docker-compose.yml" ]; then
        log_info "Starting Docker containers..."
        docker compose -f /opt/ccw-online-erp/docker-compose.yml up -d 2>/dev/null || true
    fi

    # Start systemd services (if configured)
    for service in ccw-backend ccw-frontend; do
        if systemctl is-enabled --quiet "$service" 2>/dev/null; then
            log_info "Starting $service..."
            systemctl start "$service" || true
        fi
    done

    log_info "Application services started"
}

# Function to restore database
restore_database() {
    log_step "Restoring database..."

    RESTORE_FILE="$RESTORE_DIR/$BACKUP_FILE"

    log_info "Restore file: $RESTORE_FILE"
    log_info "Target database: $DB_NAME"

    # Terminate existing connections
    log_info "Terminating existing database connections..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$DB_NAME'
  AND pid <> pg_backend_pid();
EOF

    # Drop and recreate database (clean slate)
    log_info "Dropping and recreating database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME;
EOF

    # Restore database
    log_info "Restoring database from backup (this may take a while)..."

    if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose "$RESTORE_FILE" 2>&1 | tee "$RESTORE_DIR/restore.log"; then
        log_info "Database restore completed successfully"
    else
        log_error "Database restore failed"
        log_info "Check restore log: $RESTORE_DIR/restore.log"
        exit 1
    fi
}

# Function to verify restore
verify_restore() {
    log_step "Verifying restore..."

    # Check database connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Cannot connect to restored database"
        exit 1
    fi

    # Check table count
    TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

    log_info "Restored tables: $TABLE_COUNT"

    if [ "$TABLE_COUNT" -lt 5 ]; then
        log_warn "Table count is lower than expected. Restore may be incomplete."
    fi

    # Check data integrity (example: count users)
    USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

    log_info "Restored users: $USER_COUNT"

    log_info "Restore verification completed"
}

# Function to cleanup
cleanup() {
    log_step "Cleaning up temporary files..."

    if [ -d "$RESTORE_DIR" ]; then
        rm -rf "$RESTORE_DIR"
        log_info "Temporary files removed"
    fi
}

# Main execution
main() {
    log_info "========================================"
    log_info "CCW-Online ERP Database Restore"
    log_info "Timestamp: $TIMESTAMP"
    log_info "========================================"

    START_TIME=$(date +%s)

    # Check prerequisites
    check_prerequisites

    # Confirm restore
    confirm_restore

    # Create pre-restore backup
    create_pre_restore_backup

    # Stop application services
    stop_services

    # Download backup (if from S3)
    if [ "$USE_S3" = "true" ]; then
        download_from_s3
    fi

    # Verify backup
    verify_backup

    # Decrypt backup
    decrypt_backup

    # Decompress backup
    decompress_backup

    # Restore database
    restore_database

    # Verify restore
    verify_restore

    # Start application services
    start_services

    # Cleanup
    cleanup

    # Calculate duration
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))

    log_info "========================================"
    log_info "Restore completed successfully"
    log_info "Duration: ${DURATION}s"
    log_info "========================================"
    log_info ""
    log_info "Next steps:"
    log_info "  1. Verify application functionality"
    log_info "  2. Check logs for any errors"
    log_info "  3. Test critical features"
    log_info ""
}

# Parse arguments
BACKUP_FILE=""
USE_S3=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--local)
            USE_S3=false
            shift
            ;;
        -s|--s3)
            USE_S3=true
            shift
            ;;
        -t|--target-db)
            DB_NAME="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
    log_error "Backup file not specified"
    usage
fi

# Error handler
trap 'log_error "Restore failed"; cleanup; exit 1' ERR

# Run main function
main
