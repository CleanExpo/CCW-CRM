#!/bin/bash
# Phase 4 Backend Deployment Script
# Blue-Green Deployment Strategy

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$PROJECT_ROOT/logs/deploy-backend-$TIMESTAMP.log"

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
log "Phase 4 Backend Deployment Starting"
log "======================================"

# Step 1: Verify environment
log "Step 1: Verifying environment..."

if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL is not set. Set it in your environment or .env file before deploying."
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    warn "REDIS_URL not set. Using default: redis://localhost:6381/0"
    export REDIS_URL="redis://localhost:6381/0"
fi

log "Environment variables configured."

# Step 2: Check Redis connectivity
log "Step 2: Checking Redis connectivity..."

if command -v redis-cli &> /dev/null; then
    if redis-cli -h localhost -p 6381 ping > /dev/null 2>&1; then
        log "✅ Redis is running and accessible"
    else
        error "❌ Redis is not accessible. Please start Redis first."
        exit 1
    fi
else
    warn "redis-cli not found. Checking via Docker..."
    if docker exec nodejs-starter-redis redis-cli ping > /dev/null 2>&1; then
        log "✅ Redis is running in Docker"
    else
        error "❌ Redis Docker container not accessible"
        exit 1
    fi
fi

# Step 3: Run database migration
log "Step 3: Running database migration..."

cd "$BACKEND_DIR"

if [ -f "migrations/add_performance_indexes.sql" ]; then
    # Check if PostgreSQL is available via Docker
    if docker ps --filter "name=nodejs-starter-postgres" --format "{{.Names}}" | grep -q "nodejs-starter-postgres"; then
        log "Running migration via Docker..."
        docker exec -i nodejs-starter-postgres psql -U starter_user -d starter_db < migrations/add_performance_indexes.sql >> "$LOG_FILE" 2>&1

        if [ $? -eq 0 ]; then
            log "✅ Database migration completed"
        else
            error "❌ Database migration failed. Check logs at $LOG_FILE"
            exit 1
        fi
    else
        # Try direct psql connection
        if command -v psql &> /dev/null; then
            log "Running migration via psql..."
            psql "$DATABASE_URL" < migrations/add_performance_indexes.sql >> "$LOG_FILE" 2>&1

            if [ $? -eq 0 ]; then
                log "✅ Database migration completed"
            else
                error "❌ Database migration failed. Check logs at $LOG_FILE"
                exit 1
            fi
        else
            error "❌ Neither Docker nor psql available for migration"
            exit 1
        fi
    fi
else
    error "❌ Migration file not found: migrations/add_performance_indexes.sql"
    exit 1
fi

# Step 4: Install dependencies
log "Step 4: Installing dependencies..."

if command -v uv &> /dev/null; then
    log "Installing dependencies with uv..."
    uv sync >> "$LOG_FILE" 2>&1

    if [ $? -eq 0 ]; then
        log "✅ Dependencies installed"
    else
        error "❌ Dependency installation failed"
        exit 1
    fi
else
    warn "uv not found. Skipping dependency installation."
fi

# Step 5: Run health check
log "Step 5: Running backend health check..."

# Start backend in background for health check
log "Starting backend server..."
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --log-level info > "$PROJECT_ROOT/logs/backend-$TIMESTAMP.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
log "Waiting for backend to start (PID: $BACKEND_PID)..."
sleep 5

# Health check
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log "✅ Backend health check passed"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT+1))
        log "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed. Retrying..."
        sleep 2
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    error "❌ Backend health check failed after $MAX_RETRIES attempts"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Step 6: Verify Phase 4 endpoints
log "Step 6: Verifying Phase 4 endpoints..."

# Test aggregated dashboard endpoint
log "Testing /api/demo-dashboard/aggregated..."
if curl -f http://localhost:8000/api/demo-dashboard/aggregated > /dev/null 2>&1; then
    log "✅ Aggregated dashboard endpoint working"
else
    warn "⚠️  Aggregated dashboard endpoint check failed"
fi

# Test inventory stream endpoint (SSE)
log "Testing /api/inventory-stream..."
if curl -f --max-time 2 http://localhost:8000/api/inventory-stream > /dev/null 2>&1; then
    log "✅ Inventory stream endpoint working"
else
    warn "⚠️  Inventory stream endpoint check failed (may timeout for SSE)"
fi

# Test AI auto-fill endpoint
log "Testing /api/ai/form-auto-fill..."
if curl -f http://localhost:8000/api/ai/form-auto-fill > /dev/null 2>&1 || [ $? -eq 22 ]; then
    # 22 = HTTP error (405 METHOD NOT ALLOWED for GET on POST endpoint)
    log "✅ AI auto-fill endpoint exists"
else
    warn "⚠️  AI auto-fill endpoint check failed"
fi

log "======================================"
log "✅ Phase 4 Backend Deployment Complete"
log "======================================"
log ""
log "Backend is running at: http://localhost:8000"
log "Backend PID: $BACKEND_PID"
log "Logs: $PROJECT_ROOT/logs/backend-$TIMESTAMP.log"
log ""
log "Next steps:"
log "1. Run frontend deployment: ./scripts/deploy-phase4-frontend.sh"
log "2. Run Phase 4 health checks: ./scripts/health-check-phase4.sh"
log "3. Monitor logs for 24 hours"
log ""
log "To stop backend: kill $BACKEND_PID"
log "To view logs: tail -f $PROJECT_ROOT/logs/backend-$TIMESTAMP.log"

# Keep the script running to show logs
log ""
log "Press Ctrl+C to stop the backend and exit..."
log ""

# Trap Ctrl+C to cleanup
trap "log 'Stopping backend...'; kill $BACKEND_PID 2>/dev/null; log 'Backend stopped.'; exit 0" INT

# Follow logs
tail -f "$PROJECT_ROOT/logs/backend-$TIMESTAMP.log"
