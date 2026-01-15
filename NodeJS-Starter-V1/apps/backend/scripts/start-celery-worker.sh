#!/bin/bash
#
# Start Celery worker for CCW ERP
#
# Usage:
#   ./scripts/start-celery-worker.sh [environment]
#
# Environment: development (default), staging, production
#

set -e

ENV=${1:-development}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Starting Celery Worker (${ENV})"
echo "Project root: ${PROJECT_ROOT}"

cd "${PROJECT_ROOT}"

# Set environment
export ENVIRONMENT="${ENV}"

# Start Celery worker with auto-reload in development
if [ "${ENV}" = "development" ]; then
    echo "📝 Development mode - auto-reload enabled"
    uv run celery -A src.scheduler.celery_app worker \
        --loglevel=info \
        --concurrency=4 \
        --max-tasks-per-child=100 \
        --autoreload
else
    echo "🏭 Production mode"
    uv run celery -A src.scheduler.celery_app worker \
        --loglevel=info \
        --concurrency=4 \
        --max-tasks-per-child=1000 \
        --time-limit=300 \
        --soft-time-limit=270
fi
