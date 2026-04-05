#!/bin/bash
# Production-Quality Development Startup Script
# Starts all services in correct order with health checks

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Starting CCW-Online ERP Development Environment${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
    return $?
}

# Function to wait for service
wait_for_service() {
    local name=$1
    local port=$2
    local max_attempts=${3:-30}

    echo -e "${YELLOW}⏳ Waiting for $name on port $port...${NC}"

    for ((i=1; i<=max_attempts; i++)); do
        if check_port $port; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi
        sleep 2
    done

    echo -e "${RED}❌ $name failed to start${NC}"
    return 1
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping all services...${NC}"
    docker compose down
    pkill -f "uvicorn src.api.main:app" || true
    pkill -f "next-server" || true
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Step 1: Start Docker services
echo -e "${CYAN}📦 Step 1: Starting Docker services...${NC}"
docker compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker services failed to start. Is Docker Desktop running?${NC}"
    exit 1
fi

# Wait for PostgreSQL
if ! wait_for_service "PostgreSQL" 5433; then
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
fi

# Step 2: Start Backend API
echo ""
echo -e "${CYAN}🐍 Step 2: Starting FastAPI Backend...${NC}"

cd backend
python -m uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ../..

# Wait for Backend
if ! wait_for_service "Backend API" 8000; then
    echo -e "${RED}❌ Backend API failed to start${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Step 3: Start Frontend
echo ""
echo -e "${CYAN}⚛️  Step 3: Starting Next.js Frontend...${NC}"

pnpm dev --filter=web &
FRONTEND_PID=$!

# Wait for Frontend
if ! wait_for_service "Next.js Frontend" 3005; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Success!
echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${CYAN}🌐 Frontend:  http://localhost:3005${NC}"
echo -e "${CYAN}🔌 Backend:   http://localhost:8000${NC}"
echo -e "${CYAN}📊 API Docs:  http://localhost:8000/docs${NC}"
echo -e "${CYAN}🗄️  Database:  postgresql://localhost:5433${NC}"
echo ""
echo -e "${YELLOW}📝 Login: admin@demo.com / demo123${NC}"
echo ""
echo -e "${GRAY}Press Ctrl+C to stop all services${NC}"

# Keep script running
wait
