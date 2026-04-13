#!/bin/bash
# =================================================================
# CCW ERP — Backend Deployment Script
# =================================================================
# Deploys the FastAPI backend to a Linux server with Docker.
#
# Prerequisites on the server:
#   - Docker + Docker Compose v2 installed
#   - Git installed
#   - apps/backend/.env file filled in (copy from .env.production.example)
#   - Port 8000 open (or use a reverse proxy on 443)
#
# Usage (run from repo root on the server):
#   bash scripts/deploy-backend.sh
#
# Or deploy remotely via SSH:
#   ssh user@ccw-server "cd /opt/ccw-erp && git pull && bash scripts/deploy-backend.sh"
# =================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="apps/backend/.env"
BACKEND_HEALTH_URL="http://localhost:8000/health"

echo ""
echo "=== CCW ERP Backend Deployment ==="
echo "$(date '+%d/%m/%Y %H:%M:%S AEST')"
echo ""

# ---- Pre-flight checks ----
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERROR: $ENV_FILE not found."
  echo "   Copy apps/backend/.env.production.example to apps/backend/.env and fill in values."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "❌ ERROR: Docker not installed. Install Docker first."
  exit 1
fi

# ---- Pull latest code ----
echo "📥 Pulling latest code from main..."
git pull origin main

# ---- Build Docker image ----
echo "🐳 Building backend Docker image..."
docker build -t ccw-erp-backend:latest ./apps/backend/

# ---- Run database migrations ----
echo "🗄️  Running database migrations..."
docker run --rm \
  --env-file "$ENV_FILE" \
  ccw-erp-backend:latest \
  uv run alembic upgrade head

echo "✅ Migrations complete"

# ---- Stop existing containers ----
echo "🔄 Restarting backend service..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

# ---- Start new containers ----
docker compose -f "$COMPOSE_FILE" up -d

# ---- Health check ----
echo "⏳ Waiting 15s for backend to start..."
sleep 15

MAX_RETRIES=5
RETRY=0
until curl -sf "$BACKEND_HEALTH_URL" > /dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ Health check failed after $MAX_RETRIES attempts."
    echo "   Check logs: docker compose -f $COMPOSE_FILE logs --tail=50"
    exit 1
  fi
  echo "   Retry $RETRY/$MAX_RETRIES..."
  sleep 5
done

echo ""
echo "✅ Backend is healthy at $BACKEND_HEALTH_URL"
echo ""
echo "=== Deployment complete ==="
echo ""
echo "Next steps:"
echo "  1. Set NEXT_PUBLIC_BACKEND_URL in Vercel dashboard"
echo "  2. Toby connects Xero at: Settings → Integrations → Xero"
echo "  3. Toby connects Shopify at: Settings → Integrations → Shopify"
echo ""
