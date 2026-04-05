#!/bin/bash

################################################################################
# CCW-Online ERP - Staging Deployment Script
#
# Purpose: Automated deployment to staging environment
#
# Usage:
#   ./deployment/scripts/deploy-staging.sh [OPTIONS]
#
# Options:
#   --skip-backup     Skip database backup
#   --skip-tests      Skip smoke tests after deployment
#   --force           Force deployment without confirmation
#   --version TAG     Deploy specific git tag/commit (default: current branch)
#
# Requirements:
#   - SSH access to staging server
#   - Docker + Docker Compose installed on server
#   - Git repository access
#   - .env.staging file configured
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Deployment failed
#   3 - Smoke tests failed
#   4 - Rollback triggered
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STAGING_SERVER="${STAGING_SERVER:-staging.ccw-erp.com}"
STAGING_USER="${STAGING_USER:-ubuntu}"
DEPLOY_PATH="/opt/ccw-erp"
BACKUP_DIR="/var/backups/ccw-erp"

# Flags
SKIP_BACKUP=false
SKIP_TESTS=false
FORCE=false
VERSION="${VERSION:-HEAD}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-backup     Skip database backup"
      echo "  --skip-tests      Skip smoke tests after deployment"
      echo "  --force           Force deployment without confirmation"
      echo "  --version TAG     Deploy specific git tag/commit (default: current branch)"
      echo "  -h, --help        Show this help message"
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
# Pre-Deployment Checks
################################################################################

log_info "Starting pre-deployment checks..."

# Check SSH connectivity
log_info "Testing SSH connection to ${STAGING_SERVER}..."
if ! ssh_exec "echo 'SSH connection successful'" > /dev/null 2>&1; then
  log_error "Cannot connect to staging server via SSH"
  exit 1
fi
log_success "SSH connection verified"

# Check Git repository
log_info "Checking Git repository..."
if [ ! -d "${PROJECT_ROOT}/.git" ]; then
  log_error "Not a Git repository: ${PROJECT_ROOT}"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  log_warn "Uncommitted changes detected in local repository"
  if ! confirm "Deploy anyway?"; then
    exit 1
  fi
fi

# Verify version exists
log_info "Verifying version: ${VERSION}..."
if ! git rev-parse "${VERSION}" > /dev/null 2>&1; then
  log_error "Version does not exist: ${VERSION}"
  exit 1
fi

COMMIT_HASH=$(git rev-parse --short "${VERSION}")
log_info "Deploying commit: ${COMMIT_HASH}"

# Check .env.staging exists
if [ ! -f "${PROJECT_ROOT}/.env.staging" ]; then
  log_error "Missing .env.staging file"
  exit 1
fi

# Verify required environment variables
required_vars=(
  "DATABASE_URL"
  "JWT_SECRET_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
)

log_info "Verifying environment variables..."
for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" "${PROJECT_ROOT}/.env.staging"; then
    log_error "Missing required environment variable: ${var}"
    exit 1
  fi
done
log_success "Environment variables verified"

################################################################################
# Deployment Confirmation
################################################################################

echo ""
log_info "Deployment Summary:"
echo "  Server:  ${STAGING_SERVER}"
echo "  Version: ${VERSION} (${COMMIT_HASH})"
echo "  Path:    ${DEPLOY_PATH}"
echo "  Backup:  $([ "$SKIP_BACKUP" = true ] && echo 'Skipped' || echo 'Enabled')"
echo "  Tests:   $([ "$SKIP_TESTS" = true ] && echo 'Skipped' || echo 'Enabled')"
echo ""

if ! confirm "Proceed with deployment?"; then
  log_warn "Deployment cancelled by user"
  exit 0
fi

################################################################################
# Database Backup
################################################################################

if [ "$SKIP_BACKUP" = false ]; then
  log_info "Creating database backup..."

  BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="backup_${BACKUP_TIMESTAMP}.sql"

  ssh_exec "
    mkdir -p ${BACKUP_DIR} &&
    docker compose -f ${DEPLOY_PATH}/docker-compose.staging.yml exec -T postgres \
      pg_dump -U starter_user starter_db_staging > ${BACKUP_DIR}/${BACKUP_FILE}
  "

  log_success "Database backup created: ${BACKUP_FILE}"
else
  log_warn "Database backup skipped"
fi

################################################################################
# Code Deployment
################################################################################

log_info "Deploying code to staging server..."

# Pull latest code
log_info "Pulling code from Git..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  git fetch --all &&
  git checkout ${VERSION} &&
  git pull origin ${VERSION}
"

# Copy environment file
log_info "Copying environment file..."
scp "${PROJECT_ROOT}/.env.staging" "${STAGING_USER}@${STAGING_SERVER}:${DEPLOY_PATH}/.env"

log_success "Code deployed successfully"

################################################################################
# Build & Deploy Services
################################################################################

log_info "Building Docker images..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml build --no-cache
"

log_info "Stopping current services..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml down
"

log_info "Starting services..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml up -d
"

log_success "Services started"

################################################################################
# Post-Deployment Health Checks
################################################################################

log_info "Waiting for services to become healthy..."
sleep 15

log_info "Checking service health..."
if ! ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml ps | grep -q 'Up (healthy)'
"; then
  log_error "Services did not start healthy"
  exit 2
fi

log_success "All services are healthy"

################################################################################
# Database Migrations
################################################################################

log_info "Running database migrations..."
ssh_exec "
  cd ${DEPLOY_PATH} &&
  docker compose -f docker-compose.staging.yml exec -T backend \
    alembic upgrade head
" || {
  log_error "Database migration failed"
  log_warn "Rolling back deployment..."
  exit 4
}

log_success "Database migrations completed"

################################################################################
# Smoke Tests
################################################################################

if [ "$SKIP_TESTS" = false ]; then
  log_info "Running smoke tests..."

  if ! "${SCRIPT_DIR}/smoke-tests.sh" "https://api.staging.ccw-erp.com"; then
    log_error "Smoke tests failed"
    log_warn "Deployment succeeded but tests failed - manual verification required"
    exit 3
  fi

  log_success "Smoke tests passed"
else
  log_warn "Smoke tests skipped"
fi

################################################################################
# Deployment Complete
################################################################################

echo ""
log_success "🎉 Deployment completed successfully!"
echo ""
echo "  URL:     https://staging.ccw-erp.com"
echo "  API:     https://api.staging.ccw-erp.com"
echo "  Version: ${COMMIT_HASH}"
echo ""
log_info "Next steps:"
echo "  1. Monitor logs: ssh ${STAGING_USER}@${STAGING_SERVER} 'cd ${DEPLOY_PATH} && docker compose -f docker-compose.staging.yml logs -f'"
echo "  2. Check Grafana: http://staging.ccw-erp.com:3001"
echo "  3. Check Sentry: https://sentry.io/your-project"
echo ""

exit 0
