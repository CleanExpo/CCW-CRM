#!/bin/bash
# Phase 4 Frontend Deployment Script
# Blue-Green Deployment Strategy

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/apps/web"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$PROJECT_ROOT/logs/deploy-frontend-$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

log "======================================"
log "Phase 4 Frontend Deployment Starting"
log "======================================"

# Step 1: Verify environment
log "Step 1: Verifying environment..."

if [ -z "$NEXT_PUBLIC_BACKEND_URL" ]; then
    warn "NEXT_PUBLIC_BACKEND_URL not set. Using default: http://localhost:8000"
    export NEXT_PUBLIC_BACKEND_URL="http://localhost:8000"
fi

log "Environment variables configured."

# Step 2: Install dependencies
log "Step 2: Installing dependencies..."

cd "$FRONTEND_DIR"

if command -v pnpm &> /dev/null; then
    log "Installing dependencies with pnpm..."
    pnpm install >> "$LOG_FILE" 2>&1

    if [ $? -eq 0 ]; then
        log "✅ Dependencies installed"
    else
        error "❌ Dependency installation failed"
        exit 1
    fi
else
    error "❌ pnpm not found. Please install pnpm first."
    exit 1
fi

# Step 3: Type checking
log "Step 3: Running type checks..."

pnpm --filter web run type-check >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log "✅ Type checking passed"
else
    error "❌ Type checking failed. Check logs at $LOG_FILE"
    exit 1
fi

# Step 4: Linting
log "Step 4: Running linting..."

pnpm --filter web run lint >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log "✅ Linting passed"
else
    warn "⚠️  Linting warnings/errors found. Check logs at $LOG_FILE"
fi

# Step 5: Build frontend
log "Step 5: Building frontend..."

pnpm --filter web run build >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log "✅ Frontend build completed"
else
    error "❌ Frontend build failed. Check logs at $LOG_FILE"
    exit 1
fi

# Step 6: Start frontend server
log "Step 6: Starting frontend server..."

cd "$FRONTEND_DIR"
PORT=3000

log "Starting Next.js server on port $PORT..."
pnpm start --port $PORT > "$PROJECT_ROOT/logs/frontend-$TIMESTAMP.log" 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
log "Waiting for frontend to start (PID: $FRONTEND_PID)..."
sleep 5

# Health check
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:$PORT > /dev/null 2>&1; then
        log "✅ Frontend health check passed"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT+1))
        log "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed. Retrying..."
        sleep 2
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    error "❌ Frontend health check failed after $MAX_RETRIES attempts"
    kill $FRONTEND_PID 2>/dev/null
    exit 1
fi

log "======================================"
log "✅ Phase 4 Frontend Deployment Complete"
log "======================================"
log ""
log "Frontend is running at: http://localhost:$PORT"
log "Frontend PID: $FRONTEND_PID"
log "Logs: $PROJECT_ROOT/logs/frontend-$TIMESTAMP.log"
log ""
log "Next steps:"
log "1. Open browser: http://localhost:$PORT"
log "2. Run Phase 4 health checks: ./scripts/health-check-phase4.sh"
log "3. Monitor logs for 24 hours"
log ""
log "To stop frontend: kill $FRONTEND_PID"
log "To view logs: tail -f $PROJECT_ROOT/logs/frontend-$TIMESTAMP.log"

# Keep the script running to show logs
log ""
log "Press Ctrl+C to stop the frontend and exit..."
log ""

# Trap Ctrl+C to cleanup
trap "log 'Stopping frontend...'; kill $FRONTEND_PID 2>/dev/null; log 'Frontend stopped.'; exit 0" INT

# Follow logs
tail -f "$PROJECT_ROOT/logs/frontend-$TIMESTAMP.log"
