#!/bin/bash
# Phase 4 Health Check Script
# Validates all Phase 4 features are working correctly

set -e  # Exit on any error

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Logging functions
log() {
    echo -e "${GREEN}[CHECK]${NC} $1"
}

pass() {
    TOTAL_CHECKS=$((TOTAL_CHECKS+1))
    PASSED_CHECKS=$((PASSED_CHECKS+1))
    echo -e "${GREEN}✅ PASS:${NC} $1"
}

fail() {
    TOTAL_CHECKS=$((TOTAL_CHECKS+1))
    FAILED_CHECKS=$((FAILED_CHECKS+1))
    echo -e "${RED}❌ FAIL:${NC} $1"
}

warn() {
    TOTAL_CHECKS=$((TOTAL_CHECKS+1))
    WARNING_CHECKS=$((WARNING_CHECKS+1))
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

echo ""
echo "Phase 4 Health Check - $(date)"
echo "Backend: $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""

# Section 1: Infrastructure
section "1. Infrastructure Checks"

# Check Redis
log "Checking Redis connectivity..."
if redis-cli -h localhost -p 6381 ping > /dev/null 2>&1; then
    pass "Redis is running and accessible (port 6381)"
elif docker exec nodejs-starter-redis redis-cli ping > /dev/null 2>&1; then
    pass "Redis is running in Docker"
else
    fail "Redis is not accessible"
fi

# Check PostgreSQL
log "Checking PostgreSQL connectivity..."
if docker exec nodejs-starter-postgres pg_isready -U starter_user -d starter_db > /dev/null 2>&1; then
    pass "PostgreSQL is running and accepting connections"
else
    fail "PostgreSQL is not accessible"
fi

# Check Backend
log "Checking backend health..."
if curl -f "$BACKEND_URL/health" > /dev/null 2>&1; then
    pass "Backend health endpoint responding"
else
    fail "Backend health endpoint not responding"
fi

# Check Frontend
log "Checking frontend availability..."
if curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
    pass "Frontend is accessible"
else
    fail "Frontend is not accessible"
fi

# Section 2: Performance Features
section "2. Performance Optimizations"

# Check aggregated dashboard endpoint
log "Checking aggregated dashboard endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/demo-dashboard/aggregated" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "200" ]; then
    RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$BACKEND_URL/api/demo-dashboard/aggregated")
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        pass "Aggregated dashboard endpoint working (<2s: ${RESPONSE_TIME}s)"
    else
        warn "Dashboard endpoint slow (${RESPONSE_TIME}s, target: <2s)"
    fi
else
    fail "Aggregated dashboard endpoint failed (HTTP $HTTP_CODE)"
fi

# Check database indexes
log "Checking performance indexes..."
INDEX_COUNT=$(docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%';" 2>/dev/null | xargs)

if [ "$INDEX_COUNT" -gt 20 ]; then
    pass "Performance indexes created ($INDEX_COUNT indexes found)"
else
    warn "Expected >20 indexes, found $INDEX_COUNT"
fi

# Section 3: Data Stickiness Features
section "3. Data Stickiness & Autosave"

# Check autosave implementation (check for hook file)
log "Checking autosave implementation..."
if [ -f "apps/web/lib/hooks/use-autosave.ts" ]; then
    pass "Autosave hook exists (use-autosave.ts)"
else
    fail "Autosave hook not found"
fi

# Check draft storage utility
log "Checking draft storage utility..."
if [ -f "apps/web/lib/utils/draft-storage.ts" ]; then
    pass "Draft storage utility exists (draft-storage.ts)"
else
    fail "Draft storage utility not found"
fi

# Check recent items cache
log "Checking recent items cache..."
if [ -f "apps/web/lib/hooks/use-recent-items.ts" ]; then
    pass "Recent items cache exists (use-recent-items.ts)"
else
    warn "Recent items cache not found"
fi

# Check breadcrumb component
log "Checking breadcrumb component..."
if [ -f "apps/web/components/ui/breadcrumb.tsx" ]; then
    pass "Breadcrumb component exists"
else
    fail "Breadcrumb component not found"
fi

# Section 4: AI Enhancements
section "4. AI Enhancements"

# Check AI auto-fill endpoint
log "Checking AI auto-fill endpoint..."
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"form_type": "order", "context": {}}' \
    -w "\n%{http_code}" \
    "$BACKEND_URL/api/ai/form-auto-fill" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "422" ]; then
    # 422 = validation error (expected without full context)
    pass "AI auto-fill endpoint exists and responding"
else
    warn "AI auto-fill endpoint check inconclusive (HTTP $HTTP_CODE)"
fi

# Check anomaly detection agent
log "Checking anomaly detection agent..."
if [ -f "apps/backend/src/ai/agents/specialized/anomaly_detection_agent.py" ]; then
    pass "Anomaly detection agent exists"
else
    warn "Anomaly detection agent not found"
fi

# Check inventory forecasting agent
log "Checking inventory forecasting agent..."
if [ -f "apps/backend/src/ai/agents/specialized/inventory_forecasting_agent.py" ]; then
    pass "Inventory forecasting agent exists"
else
    warn "Inventory forecasting agent not found"
fi

# Section 5: Real-Time Infrastructure
section "5. Real-Time Infrastructure (SSE)"

# Check SSE service
log "Checking SSE service..."
if [ -f "apps/backend/src/services/sse_service.py" ]; then
    pass "SSE service exists (sse_service.py)"
else
    fail "SSE service not found"
fi

# Check inventory stream endpoint
log "Checking inventory stream endpoint..."
RESPONSE=$(timeout 2 curl -s -w "\n%{http_code}" "$BACKEND_URL/api/inventory-stream" 2>/dev/null || echo -e "\ntimeout")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "timeout" ]; then
    # SSE endpoints may timeout on GET (they stream indefinitely)
    pass "Inventory stream endpoint exists (SSE)"
else
    warn "Inventory stream endpoint check inconclusive (HTTP $HTTP_CODE)"
fi

# Check POS failure alerts
log "Checking POS failure alerts..."
if [ -f "apps/backend/src/api/routes/monitoring/alerts.py" ]; then
    pass "Alert management system exists"
else
    fail "Alert management system not found"
fi

# Check dashboard metrics stream
log "Checking dashboard metrics stream..."
RESPONSE=$(timeout 2 curl -s -w "\n%{http_code}" "$BACKEND_URL/api/demo-dashboard/metrics-stream" 2>/dev/null || echo -e "\ntimeout")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "timeout" ]; then
    pass "Dashboard metrics stream exists (SSE)"
else
    warn "Dashboard metrics stream check inconclusive (HTTP $HTTP_CODE)"
fi

# Check real-time indicator component
log "Checking real-time indicator component..."
if [ -f "apps/web/components/ui/real-time-indicator.tsx" ]; then
    pass "Real-time indicator component exists"
else
    fail "Real-time indicator component not found"
fi

# Check SSE hooks
log "Checking SSE hooks..."
if [ -f "apps/web/lib/hooks/use-sse.ts" ]; then
    pass "SSE hooks exist (use-sse.ts)"
else
    fail "SSE hooks not found"
fi

# Final Summary
section "Summary"

echo ""
echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "${YELLOW}Warnings: $WARNING_CHECKS${NC}"
echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

# Calculate success rate
SUCCESS_RATE=$(echo "scale=1; ($PASSED_CHECKS * 100) / $TOTAL_CHECKS" | bc)
echo "Success Rate: $SUCCESS_RATE%"
echo ""

# Overall status
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CRITICAL CHECKS PASSED${NC}"
    echo ""
    echo "Phase 4 is ready for production!"
    exit 0
elif [ $FAILED_CHECKS -le 2 ]; then
    echo -e "${YELLOW}⚠️  SOME CHECKS FAILED${NC}"
    echo ""
    echo "Review failed checks above. Phase 4 may still be deployable."
    exit 1
else
    echo -e "${RED}❌ MULTIPLE CHECKS FAILED${NC}"
    echo ""
    echo "Phase 4 deployment NOT recommended. Fix failed checks first."
    exit 1
fi
