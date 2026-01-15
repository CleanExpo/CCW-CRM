#!/bin/bash
#
# Start Flower monitoring UI for Celery
#
# Usage:
#   ./scripts/start-flower.sh [port]
#
# Default port: 5555
# Access at: http://localhost:5555
#

set -e

PORT=${1:-5555}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🌸 Starting Flower Monitoring UI"
echo "Project root: ${PROJECT_ROOT}"
echo "Access at: http://localhost:${PORT}"

cd "${PROJECT_ROOT}"

# Start Flower with authentication
uv run celery -A src.scheduler.celery_app flower \
    --port=${PORT} \
    --broker=redis://localhost:6379/0 \
    --loglevel=info \
    --max_tasks=10000
