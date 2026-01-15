# Docker Optimization Guide

**Date:** January 14, 2026
**Status:** Complete ✅
**Component:** Week 7 - Infrastructure Optimization

---

## Overview

This document describes the optimized Docker setup for the CCW-Online ERP system. The optimization reduces image sizes by **~85%** (from ~1GB to ~150MB for frontend, ~800MB to ~200MB for backend) and improves build times and security.

**Key Improvements:**
- Multi-stage builds for minimal image size
- Non-root user for security
- Optimized layer caching
- Production-ready configuration
- Comprehensive health checks
- Resource limits and restart policies

---

## File Structure

```
CCW-Online-ERP/
├── apps/
│   ├── backend/
│   │   ├── Dockerfile.optimized      # Multi-stage backend Dockerfile
│   │   └── .dockerignore             # Build context exclusions
│   └── web/
│       ├── Dockerfile                # Multi-stage frontend Dockerfile
│       └── .dockerignore             # Build context exclusions
├── docker-compose.yml                # Development compose file
├── docker-compose.prod.yml           # Production compose file
├── .env.production.example           # Production environment template
└── scripts/
    ├── docker-build.sh               # Build script (Linux/Mac)
    └── docker-build.ps1              # Build script (Windows)
```

---

## Backend Dockerfile (Multi-Stage)

### File: `apps/backend/Dockerfile.optimized`

**Stages:**
1. **Base** - Common dependencies and system packages
2. **Builder** - Install Python dependencies with uv
3. **Runtime** - Final production image (non-root user)
4. **Development** - Hot-reload for local development

**Key Features:**
- Uses `python:3.12-slim` base image
- Installs dependencies with `uv` (fast Python package installer)
- Non-root user (`appuser`) for security
- Health check with curl
- Optimized layer caching

**Image Size:**
- Before: ~800MB
- After: ~200MB
- Reduction: **~75%**

### Build Command

```bash
# Production build
docker build -f apps/backend/Dockerfile.optimized \
  -t ccw-erp-backend:latest \
  --target runtime \
  apps/backend

# Development build
docker build -f apps/backend/Dockerfile.optimized \
  -t ccw-erp-backend:dev \
  --target development \
  apps/backend
```

---

## Frontend Dockerfile (Multi-Stage)

### File: `apps/web/Dockerfile`

**Stages:**
1. **Deps** - Install dependencies with pnpm
2. **Builder** - Build Next.js app with standalone output
3. **Runtime** - Final production image (non-root user)
4. **Development** - Hot-reload for local development

**Key Features:**
- Uses `node:20-alpine` base image
- Next.js standalone output for minimal dependencies
- Non-root user (`nextjs`) for security
- Health check with Node.js HTTP module
- Only includes necessary files

**Image Size:**
- Before: ~1GB
- After: ~150MB
- Reduction: **~85%**

### Build Command

```bash
# Production build
docker build -f apps/web/Dockerfile \
  -t ccw-erp-frontend:latest \
  --target runtime \
  apps/web

# Development build
docker build -f apps/web/Dockerfile \
  -t ccw-erp-frontend:dev \
  --target development \
  apps/web
```

---

## Production Docker Compose

### File: `docker-compose.prod.yml`

**Services:**
1. **postgres** - PostgreSQL database with pgvector
2. **redis** - Redis cache with persistence
3. **backend** - FastAPI application
4. **celery-worker** - Celery async task worker
5. **celery-beat** - Celery scheduler
6. **frontend** - Next.js application

**Features:**
- Health checks for all services
- Restart policies (`unless-stopped`)
- Resource limits (CPU/memory)
- Logging configuration
- Proper networking
- Volume management

### Usage

```bash
# Start all services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes
docker-compose -f docker-compose.prod.yml down -v
```

---

## Build Scripts

### Linux/Mac: `scripts/docker-build.sh`

```bash
#!/bin/bash
# Build optimized images

# Production build
./scripts/docker-build.sh

# Build with custom tag
./scripts/docker-build.sh --tag v1.0.0

# Build without cache
./scripts/docker-build.sh --no-cache

# Build and push to registry
export DOCKER_REGISTRY=registry.example.com
./scripts/docker-build.sh --push
```

### Windows: `scripts/docker-build.ps1`

```powershell
# Build optimized images

# Production build
.\scripts\docker-build.ps1

# Build with custom tag
.\scripts\docker-build.ps1 -Tag "v1.0.0"

# Build without cache
.\scripts\docker-build.ps1 -NoCache

# Build and push to registry
$env:DOCKER_REGISTRY = "registry.example.com"
.\scripts\docker-build.ps1 -Push
```

---

## Environment Configuration

### File: `.env.production.example`

**Required Variables:**
- `POSTGRES_PASSWORD` - Database password (required)
- `AI_PROVIDER` - AI provider (anthropic, openai, ollama)
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` - AI API keys
- Integration API keys (Xero, Shopify, SendGrid, ElevenLabs)

**Setup:**
```bash
# Copy template
cp .env.production.example .env.production

# Edit with your values
nano .env.production

# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

---

## Health Check Endpoints

### Backend Health Checks

**Endpoints:**
1. **GET /health** - Basic liveness probe (<100ms)
   - Returns HTTP 200 if app is running
   - No dependency checks
   - Use for Kubernetes liveness probe

2. **GET /ready** - Readiness probe
   - Returns HTTP 200 if app can serve traffic
   - Checks database connectivity
   - Use for Kubernetes readiness probe

3. **GET /health/detailed** - Comprehensive health check
   - Checks all dependencies (database, Redis, Celery, WebSocket)
   - Returns detailed status and metrics
   - Use for monitoring dashboards

4. **GET /health/live** - Ultra-fast liveness (Kubernetes)
   - Returns {"status": "ok"}
   - Fastest possible check

5. **GET /health/startup** - Startup probe (Kubernetes)
   - Checks critical dependencies during startup
   - Returns HTTP 503 if dependencies not ready

### Response Models

**Basic Health Status:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T12:00:00",
  "version": "1.0.0",
  "uptime_seconds": 3600.5
}
```

**Detailed Health Status:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T12:00:00",
  "version": "1.0.0",
  "uptime_seconds": 3600.5,
  "dependencies": [
    {
      "name": "database",
      "status": "healthy",
      "response_time_ms": 5.2,
      "details": {
        "pool_size": 20,
        "checked_out": 3,
        "available": 17
      }
    },
    {
      "name": "redis",
      "status": "healthy",
      "response_time_ms": 2.1,
      "details": {
        "memory_used": "12.5M",
        "connected_clients": 5
      }
    },
    {
      "name": "celery",
      "status": "healthy",
      "response_time_ms": 150.3,
      "details": {
        "active_workers": 4
      }
    },
    {
      "name": "websocket",
      "status": "healthy",
      "response_time_ms": 1.8,
      "details": {
        "active_connections": 12
      }
    }
  ]
}
```

### Health Status Values

- **healthy** - All systems operational
- **degraded** - Non-critical systems down (e.g., Celery)
- **unhealthy** - Critical systems down (database, Redis)

---

## Resource Limits

### Backend Service

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Frontend Service

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.25'
      memory: 256M
```

### Database Service

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

---

## Security Best Practices

### 1. Non-Root User

All application containers run as non-root users:
- Backend: `appuser` (UID 1001)
- Frontend: `nextjs` (UID 1001)

### 2. Minimal Base Images

- Backend: `python:3.12-slim` (~180MB)
- Frontend: `node:20-alpine` (~120MB)

### 3. Layer Optimization

- Copy dependency files first for better caching
- Install dependencies before copying source code
- Clean up package manager caches

### 4. Read-Only Filesystem

Containers should run with read-only filesystems where possible:

```yaml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /var/run
```

### 5. No Secrets in Images

- Use environment variables for secrets
- Never hard-code API keys or passwords
- Use `.dockerignore` to exclude sensitive files

---

## Build Optimization Tips

### 1. Use .dockerignore

Exclude unnecessary files from build context:
- `node_modules/`
- `.git/`
- Documentation files
- Test files

### 2. Order Layers by Change Frequency

```dockerfile
# 1. Base system dependencies (changes rarely)
RUN apt-get update && apt-get install ...

# 2. Application dependencies (changes occasionally)
COPY package.json package-lock.json ./
RUN npm install

# 3. Application code (changes frequently)
COPY . ./
```

### 3. Combine RUN Commands

```dockerfile
# Bad - creates multiple layers
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y git

# Good - single layer
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*
```

### 4. Use BuildKit

```bash
# Enable BuildKit for faster builds
DOCKER_BUILDKIT=1 docker build ...
```

---

## Monitoring Integration

### Prometheus Metrics

Health check endpoints can be monitored by Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'backend'
    metrics_path: '/health/detailed'
    scrape_interval: 30s
    static_configs:
      - targets: ['backend:8000']
```

### Grafana Dashboard

Import health metrics into Grafana for visualization:
- Uptime tracking
- Response time trends
- Dependency status
- Resource usage

---

## Troubleshooting

### Image Build Fails

```bash
# Check Docker daemon
docker info

# Build with verbose output
docker build --progress=plain ...

# Check disk space
docker system df

# Clean up old images
docker system prune -a
```

### Container Fails to Start

```bash
# Check logs
docker-compose logs backend

# Check health status
docker ps --filter health=unhealthy

# Inspect container
docker inspect ccw-erp-backend

# Execute shell in container
docker exec -it ccw-erp-backend /bin/bash
```

### Health Check Fails

```bash
# Test health endpoint manually
curl http://localhost:8000/health

# Check detailed health
curl http://localhost:8000/health/detailed

# View database connectivity
docker-compose exec backend python -c "from src.db.session import get_db; print('OK')"
```

---

## Next Steps

- **Week 7 Task 3:** Kubernetes manifests with deployment configs
- **Week 7 Task 4:** Horizontal Pod Autoscalers based on metrics
- **Week 7 Task 5:** Prometheus + Grafana monitoring stack

---

*Document Version: 1.0*
*Last Updated: January 14, 2026*
