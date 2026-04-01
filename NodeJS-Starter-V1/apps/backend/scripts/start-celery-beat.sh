#!/bin/bash
#
# Start Celery Beat scheduler for CCW ERP
#
# Usage:
#   ./scripts/start-celery-beat.sh [environment]
#
# Environment: development (default), staging, production
#

set -e

ENV=${1:-development}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "⏰ Starting Celery Beat (${ENV})"
echo "Project root: ${PROJECT_ROOT}"

cd "${PROJECT_ROOT}"

# Set environment
export ENVIRONMENT="${ENV}"

# Start Celery beat scheduler
uv run celery -A src.scheduler.celery_app beat \
    --loglevel=info \
    --pidfile=/tmp/celerybeat.pid
