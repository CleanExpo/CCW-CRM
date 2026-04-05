#!/bin/bash

################################################################################
# CCW-Online ERP - Rollback Script
#
# Purpose: Rollback to previous deployment in case of failure
#
# Usage:
#   ./deployment/scripts/rollback.sh [OPTIONS]
#
# Options:
#   --version TAG         Rollback to specific git tag/commit
#   --backup FILENAME     Restore specific database backup
#   --force               Skip confirmation prompts
#   --preserve-db         Keep current database (code rollback only)
#
# Scenarios:
#   1. Code rollback only:         ./rollback.sh --version v1.0.0 --preserve-db
#   2. Full rollback with DB:      ./rollback.sh --version v1.0.0 --backup backup_20260203.sql
#   3. DB restore only:            ./rollback.sh --backup backup_20260203.sql --preserve-db
#
# Exit Codes:
#   0 - Rollback successful
#   1 - General error
#   2 - Rollback failed
################################################################################

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGING_SERVER="${STAGING_SERVER:-staging.ccw-erp.com}"
STAGING_USER="${STAGING_USER:-ubuntu}"
DEPLOY_PATH="/opt/ccw-erp"
BACKUP_DIR="/var/backups/ccw-erp"

# Flags
ROLLBACK_VERSION=""
BACKUP_FILE=""
FORCE=false
PRESERVE_DB=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      ROLLBACK_VERSION="$2"
      shift 2
      ;;
    --backup)
      BACKUP_FILE="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --preserve-db)
      PRESERVE_DB=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --version TAG         Rollback to specific git tag/commit"
      echo "  --backup FILENAME     Restore specific database backup"
      echo "  --force               Skip confirmation prompts"
      echo "  --preserve-db         Keep current database (code rollback only)"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

################################################################################
# Helper Functions
################################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

confirm() {
  if [ "$FORCE" = true ]; then
    return 0
  fi

  read -p "$1 (y/N): " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

ssh_exec() {
  ssh "${STAGING_USER}@${STAGING_SERVER}" "$@"
}

################################################################################
# Pre-Rollback Validation
################################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         CCW-Online ERP - Rollback Script                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Validate inputs
if [ -z "$ROLLBACK_VERSION" ] && [ -z "$BACKUP_FILE" ]; then
  log_error "Must specify either --version or --backup (or both)"
  exit 1
fi

# Get current version
log_info "Detecting current deployment version..."
CURRENT_VERSION=$(ssh_exec "cd ${DEPLOY_PATH} && git rev-parse --short HEAD")
log_info "Current version: ${CURRENT_VERSION}"

# Verify rollback version exists
if [ -n "$ROLLBACK_VERSION" ]; then
  log_info "Verifying rollback version: ${ROLLBACK_VERSION}..."
  if ! ssh_exec "cd ${DEPLOY_PATH} && git rev-parse ${ROLLBACK_VERSION}" > /dev/null 2>&1; then
    log_error "Rollback version does not exist: ${ROLLBACK_VERSION}"
    exit 1
  fi
  ROLLBACK_COMMIT=$(ssh_exec "cd ${DEPLOY_PATH} && git rev-parse --short ${ROLLBACK_VERSION}")
fi

# List available backups
if [ -n "$BACKUP_FILE" ]; then
  log_info "Verifying database backup: ${BACKUP_FILE}..."
  if ! ssh_exec "[ -f ${BACKUP_DIR}/${BACKUP_FILE} ]"; then
    log_error "Backup file not found: ${BACKUP_DIR}/${BACKUP_FILE}"
    log_info "Available backups:"
    ssh_exec "ls -lh ${BACKUP_DIR}/*.sql | tail -10" || true
    exit 1
  fi

  BACKUP_SIZE=$(ssh_exec "du -h ${BACKUP_DIR}/${BACKUP_FILE} | cut -f1")
  log_info "Backup size: ${BACKUP_SIZE}"
fi

################################################################################
# Rollback Summary & Confirmation
################################################################################

echo ""
log_warn "⚠️  ROLLBACK SUMMARY"
echo ""
echo "  Current Version:  ${CURRENT_VERSION}"
if [ -n "$ROLLBACK_VERSION" ]; then
  echo "  Rollback To:      ${ROLLBACK_COMMIT} (${ROLLBACK_VERSION})"
fi
if [ -n "$BACKUP_FILE" ]; then
  echo "  Database Restore: ${BACKUP_FILE} (${BACKUP_SIZE})"
fi
if [ "$PRESERVE_DB" = true ]; then
  echo "  Database:         PRESERVED (no restore)"
fi
echo ""

log_warn "This will:"
if [ -n "$ROLLBACK_VERSION" ]; then
  echo "  • Stop current application"
  echo "  • Checkout code version: ${ROLLBACK_COMMIT}"
  echo "  • Rebuild Docker images"
  echo "  • Restart application"
fi
if [ -n "$BACKUP_FILE" ] && [ "$PRESERVE_DB" = false ]; then
  echo "  • Stop database"
  echo "  • Restore database from: ${BACKUP_FILE}"
  echo "  • Restart database"
fi
echo ""

if ! confirm "⚠️  Are you absolutely sure you want to proceed?"; then
  log_warn "Rollback cancelled by user"
  exit 0
fi

################################################################################
# Execute Rollback
################################################################################

log_info "Starting rollback process..."

# 1. Create emergency backup of current state
log_info "Creating emergency backup of current state..."
EMERGENCY_BACKUP="emergency_backup_$(date +%Y%m%d_%H%M%S).sql"

ssh_exec "
  docker compose -f ${DEPLOY_PATH}/docker-compose.staging.yml exec -T postgres \
    pg_dump -U starter_user starter_db_staging > ${BACKUP_DIR}/${EMERGENCY_BACKUP}
" || log_warn "Emergency backup failed (continuing anyway)"

log_success "Emergency backup created: ${EMERGENCY_BACKUP}"

# 2. Stop application services
log_info "Stopping application services..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml stop web backend
"
log_success "Application services stopped"

# 3. Code rollback (if specified)
if [ -n "$ROLLBACK_VERSION" ]; then
  log_info "Rolling back code to version: ${ROLLBACK_COMMIT}..."

  ssh_exec "
    cd ${DEPLOY_PATH} &&
    git fetch --all &&
    git checkout ${ROLLBACK_VERSION} &&
    git reset --hard ${ROLLBACK_VERSION}
  "

  log_success "Code rolled back to: ${ROLLBACK_COMMIT}"
fi

# 4. Database rollback (if specified and not preserved)
if [ -n "$BACKUP_FILE" ] && [ "$PRESERVE_DB" = false ]; then
  log_info "Stopping database service..."
  ssh_exec "
    cd ${DEPLOY_PATH} &&
    docker compose -f docker-compose.staging.yml stop postgres
  "

  log_info "Restoring database from: ${BACKUP_FILE}..."
  ssh_exec "
    cd ${DEPLOY_PATH} &&
    docker compose -f docker-compose.staging.yml start postgres &&
    sleep 10 &&
    docker compose -f docker-compose.staging.yml exec -T postgres \
      psql -U starter_user -d starter_db_staging < ${BACKUP_DIR}/${BACKUP_FILE}
  " || {
    log_error "Database restore failed!"
    log_warn "Attempting to restore emergency backup: ${EMERGENCY_BACKUP}"
    ssh_exec "
      docker compose -f docker-compose.staging.yml exec -T postgres \
        psql -U starter_user -d starter_db_staging < ${BACKUP_DIR}/${EMERGENCY_BACKUP}
    "
    exit 2
  }

  log_success "Database restored successfully"
fi

# 5. Rebuild and restart services
if [ -n "$ROLLBACK_VERSION" ]; then
  log_info "Rebuilding Docker images..."
  ssh_exec "
    cd ${DEPLOY_PATH} &&
    docker compose -f docker-compose.staging.yml build --no-cache
  "
  log_success "Docker images rebuilt"
fi

log_info "Starting all services..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml up -d
"

# 6. Wait for services to become healthy
log_info "Waiting for services to become healthy..."
sleep 20

MAX_RETRIES=12
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if ssh_exec "
    cd ${DEPLOY_PATH} &&
    docker compose -f docker-compose.staging.yml ps | grep -q 'Up (healthy)'
  "; then
    log_success "Services are healthy"
    break
  fi

  ((RETRY_COUNT++))
  log_info "Waiting for services... (${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 10
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  log_error "Services did not become healthy after rollback"
  log_warn "Check logs: ssh ${STAGING_USER}@${STAGING_SERVER} 'cd ${DEPLOY_PATH} && docker compose -f docker-compose.staging.yml logs'"
  exit 2
fi

# 7. Run smoke tests
log_info "Running smoke tests..."
if ! "${SCRIPT_DIR}/smoke-tests.sh" "https://api.staging.ccw-erp.com"; then
  log_warn "Smoke tests failed after rollback - manual verification required"
else
  log_success "Smoke tests passed"
fi

################################################################################
# Rollback Complete
################################################################################

echo ""
log_success "🎉 Rollback completed successfully!"
echo ""
echo "  Rolled back to:"
if [ -n "$ROLLBACK_VERSION" ]; then
  echo "    Code:     ${ROLLBACK_COMMIT}"
fi
if [ -n "$BACKUP_FILE" ] && [ "$PRESERVE_DB" = false ]; then
  echo "    Database: ${BACKUP_FILE}"
fi
echo ""
echo "  Emergency backup saved:"
echo "    ${EMERGENCY_BACKUP}"
echo ""
log_info "Next steps:"
echo "  1. Monitor logs: ssh ${STAGING_USER}@${STAGING_SERVER} 'cd ${DEPLOY_PATH} && docker compose -f docker-compose.staging.yml logs -f'"
echo "  2. Verify application: https://staging.ccw-erp.com"
echo "  3. Check monitoring: http://staging.ccw-erp.com:3001"
echo ""

exit 0
