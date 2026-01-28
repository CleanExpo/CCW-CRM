# Deployment Runbook for CCW Online ERP

## Overview

This runbook provides step-by-step instructions for deploying the CCW Online ERP system to production.

**Deployment Target**: Supabase + Vercel + managed services
**Estimated Time**: 2-3 hours (first time), 30 minutes (subsequent)
**Rollback Time**: <10 minutes

---

## Pre-Deployment Checklist

### 1. Code Quality

- [ ] All tests passing (`pnpm turbo run test`)
- [ ] Type checking passing (`pnpm turbo run type-check`)
- [ ] Linting passing (`pnpm turbo run lint`)
- [ ] No critical security vulnerabilities (`./scripts/security-audit.ps1`)
- [ ] Load tests passed (p95 < 500ms)
- [ ] Code reviewed and approved

### 2. Database

- [ ] Migrations tested on staging
- [ ] Backup of current production database created
- [ ] Rollback plan documented
- [ ] New indexes tested for performance
- [ ] Data seeding scripts ready (if needed)

### 3. Dependencies

- [ ] All npm dependencies up to date (`pnpm audit`)
- [ ] Python dependencies scanned (`safety check`)
- [ ] No known critical CVEs in dependencies

### 4. Configuration

- [ ] Environment variables documented
- [ ] Secrets rotated (if scheduled)
- [ ] API keys valid and tested
- [ ] CORS origins configured correctly
- [ ] Rate limits reviewed and appropriate

### 5. Monitoring

- [ ] Monitoring alerts configured
- [ ] Error tracking (Sentry) enabled
- [ ] Log aggregation configured
- [ ] Health check endpoints working
- [ ] Status page updated

---

## Environment Setup

### Production Environment Variables

Create a `.env.production` file with these variables:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
DIRECT_DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres

# Backend
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=[GENERATE-NEW-KEY]  # openssl rand -hex 32
JWT_SECRET=[GENERATE-NEW-KEY]   # openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# CORS
CORS_ORIGINS=["https://erp.ccw-example.com","https://portal.ccw-example.com"]

# Rate Limiting
RATE_LIMIT_ENABLED=True
RATE_LIMIT_PER_MINUTE=100

# OpenAI (for embeddings)
OPENAI_API_KEY=[YOUR-KEY]
OPENAI_MODEL=text-embedding-3-small

# Ollama (for code generation)
OLLAMA_HOST=http://ollama-server:11434
OLLAMA_MODEL=qwen2.5-coder:7b

# Redis (caching)
CACHE_ENABLED=True
REDIS_HOST=redis-production.example.com
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=[YOUR-PASSWORD]

# Shopify Integration
SHOPIFY_MODE=live
SHOPIFY_SHOP_URL=https://ccw-equipment.myshopify.com
SHOPIFY_API_KEY=[YOUR-KEY]
SHOPIFY_API_SECRET=[YOUR-SECRET]
SHOPIFY_ACCESS_TOKEN=[YOUR-TOKEN]

# Xero Integration
XERO_MODE=live
XERO_CLIENT_ID=[YOUR-ID]
XERO_CLIENT_SECRET=[YOUR-SECRET]
XERO_TENANT_ID=[YOUR-TENANT]

# Google AP2 Integration
AP2_MODE=live
AP2_PROJECT_ID=[YOUR-PROJECT]
AP2_API_KEY=[YOUR-KEY]
AP2_WEBHOOK_SECRET=[YOUR-SECRET]

# Monitoring
SENTRY_DSN=[YOUR-DSN]
SENTRY_ENVIRONMENT=production
LOG_LEVEL=INFO
```

### Frontend Environment Variables

Create a `.env.production` for Next.js:

```bash
# Backend URL
NEXT_PUBLIC_BACKEND_URL=https://api.ccw-erp.example.com

# Feature Flags
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_VOICE_COMMERCE=true

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=[YOUR-ID]

# Sentry
NEXT_PUBLIC_SENTRY_DSN=[YOUR-DSN]
```

---

## Deployment Steps

### Step 1: Database Migrations

**Duration**: 5-15 minutes
**Risk**: High (can cause downtime)
**Rollback**: Restore from backup

```bash
# 1. Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test migration on staging first
export DATABASE_URL=$STAGING_DATABASE_URL
supabase db push

# 3. Verify migration
psql $STAGING_DATABASE_URL -c "\dt"  # List tables
psql $STAGING_DATABASE_URL -c "\di"  # List indexes

# 4. Run on production (during maintenance window)
export DATABASE_URL=$PRODUCTION_DATABASE_URL
supabase db push

# 5. Verify production
psql $PRODUCTION_DATABASE_URL -c "SELECT count(*) FROM products;"
```

**Migration Checklist**:
- [ ] Backup created
- [ ] Migration tested on staging
- [ ] Tables created successfully
- [ ] Indexes created successfully
- [ ] Data integrity verified
- [ ] Performance tested

**Rollback**:
```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

### Step 2: Deploy Backend (Render/Railway/Fly.io)

**Duration**: 10-15 minutes
**Risk**: Medium
**Rollback**: Revert to previous deployment

#### Option A: Render

```bash
# 1. Install Render CLI
npm install -g @render/cli

# 2. Login
render login

# 3. Deploy
cd apps/backend
render deploy

# 4. Verify
curl https://api.ccw-erp.example.com/health
```

#### Option B: Docker + Any Host

```bash
# 1. Build Docker image
docker build -t ccw-erp-backend:latest -f apps/backend/Dockerfile .

# 2. Tag for registry
docker tag ccw-erp-backend:latest registry.example.com/ccw-erp-backend:latest

# 3. Push to registry
docker push registry.example.com/ccw-erp-backend:latest

# 4. Deploy to server
ssh production-server
docker pull registry.example.com/ccw-erp-backend:latest
docker-compose up -d backend
```

**Dockerfile** (create if not exists):
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY apps/backend/pyproject.toml apps/backend/uv.lock ./
RUN pip install uv && uv sync --frozen

# Copy application
COPY apps/backend/ .

# Run
CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Verify Deployment**:
```bash
# Health check
curl https://api.ccw-erp.example.com/health

# OpenAPI docs
curl https://api.ccw-erp.example.com/docs

# Test authentication
curl -X POST https://api.ccw-erp.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

### Step 3: Deploy Frontend (Vercel)

**Duration**: 5-10 minutes
**Risk**: Low (automatic rollback)
**Rollback**: One-click in Vercel dashboard

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy (production)
cd apps/web
vercel --prod

# 4. Verify
curl https://erp.ccw-example.com
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_BACKEND_URL": "https://api.ccw-erp.example.com"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

### Step 4: Configure Redis (Upstash/Redis Cloud)

**Duration**: 10 minutes
**Risk**: Low (caching is optional)

#### Option A: Upstash (Recommended)

1. Go to https://upstash.com
2. Create new Redis database
3. Copy connection details
4. Update `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` in backend env

#### Option B: Self-Hosted

```bash
# 1. Deploy Redis container
docker run -d \
  --name redis-production \
  --restart always \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine redis-server --requirepass YOUR_PASSWORD

# 2. Verify
redis-cli -h localhost -p 6379 -a YOUR_PASSWORD ping
```

### Step 5: Deploy Ollama (Optional - for Autonomous Dev)

**Duration**: 20 minutes
**Risk**: Low (optional feature)

```bash
# 1. Deploy Ollama server
docker run -d \
  --name ollama \
  --restart always \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  ollama/ollama

# 2. Pull models
docker exec ollama ollama pull qwen2.5-coder:7b

# 3. Verify
curl http://ollama-server:11434/api/tags
```

### Step 6: Configure Monitoring

**Duration**: 15 minutes
**Risk**: Low

#### Sentry (Error Tracking)

```bash
# 1. Create project at https://sentry.io
# 2. Get DSN
# 3. Add to backend env
SENTRY_DSN=https://...@sentry.io/...

# 4. Test
curl https://api.ccw-erp.example.com/sentry-debug
```

#### Health Checks (UptimeRobot/Pingdom)

1. Add endpoint: https://api.ccw-erp.example.com/health
2. Check interval: 5 minutes
3. Alert email: ops@ccw-example.com
4. Verify receives 200 OK

#### Log Aggregation (Papertrail/Logtail)

```bash
# 1. Sign up for log service
# 2. Get log endpoint
# 3. Configure Docker logging

docker-compose.yml:
```
```yaml
version: '3.8'
services:
  backend:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logs.example.com:514"
        tag: "ccw-erp-backend"
```

---

## Post-Deployment Verification

### Automated Tests

Run smoke tests against production:

```bash
# 1. Set production URL
export API_URL=https://api.ccw-erp.example.com

# 2. Run smoke tests
cd apps/backend
pytest tests/smoke/ -v

# Expected: All tests pass
```

### Manual Verification Checklist

**Frontend**:
- [ ] Login works
- [ ] Dashboard loads
- [ ] Products page loads
- [ ] Search works
- [ ] No console errors

**Backend**:
- [ ] Health check returns 200
- [ ] API docs accessible
- [ ] Authentication works
- [ ] Database queries work
- [ ] Semantic search works
- [ ] Recommendations work

**Integrations**:
- [ ] Shopify sync works
- [ ] Xero sync works
- [ ] AP2 connection active
- [ ] Webhooks receiving events

**Performance**:
- [ ] Page load <2s
- [ ] API response <500ms (p95)
- [ ] Search response <500ms
- [ ] No memory leaks
- [ ] No connection pool exhaustion

### Load Test

Run brief load test to verify:

```bash
locust -f tests/load/locustfile_ai_features.py \
  --host=https://api.ccw-erp.example.com \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --headless
```

**Expected**:
- 0% error rate
- p95 response time <500ms
- No 5xx errors

---

## Rollback Procedures

### Database Rollback

```bash
# 1. Stop backend to prevent writes
docker-compose stop backend

# 2. Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 3. Restart backend
docker-compose start backend

# 4. Verify
curl https://api.ccw-erp.example.com/health
```

**Time**: ~10 minutes

### Backend Rollback

**Render/Railway**:
1. Go to dashboard
2. Click "Deployments"
3. Click "Redeploy" on previous successful deployment
4. Verify health check

**Docker**:
```bash
# Revert to previous image
docker-compose down
docker tag registry.example.com/ccw-erp-backend:previous \
  registry.example.com/ccw-erp-backend:latest
docker-compose up -d
```

**Time**: ~5 minutes

### Frontend Rollback

**Vercel**:
1. Go to Vercel dashboard
2. Click "Deployments"
3. Find previous production deployment
4. Click "Promote to Production"

**Time**: ~2 minutes (automatic)

---

## Monitoring & Alerts

### Key Metrics to Monitor

| Metric | Threshold | Alert |
|--------|-----------|-------|
| API Error Rate | >1% | Critical |
| API Response Time (p95) | >500ms | Warning |
| Database Connections | >80 | Warning |
| Memory Usage | >90% | Critical |
| CPU Usage | >80% | Warning |
| Disk Usage | >85% | Warning |
| Health Check | Down | Critical |

### Alert Configuration

**PagerDuty/OpsGenie**:
- Critical: Page on-call engineer immediately
- Warning: Send email/Slack to team channel
- Info: Log only

**Sample Alert Rules**:
```yaml
alerts:
  - name: High Error Rate
    condition: error_rate > 1%
    duration: 5m
    severity: critical
    notification: pagerduty

  - name: Slow API Response
    condition: p95_response_time > 500ms
    duration: 10m
    severity: warning
    notification: slack

  - name: Health Check Failed
    condition: health_check != 200
    duration: 2m
    severity: critical
    notification: pagerduty
```

---

## Maintenance Windows

### Recommended Schedule

- **Weekly**: Dependency updates (Wednesday 2 AM UTC)
- **Monthly**: Major updates, new features (First Saturday 2 AM UTC)
- **Quarterly**: Database maintenance, secret rotation (First Sunday 2 AM UTC)

### Maintenance Procedure

1. **Pre-maintenance** (T-24h):
   - [ ] Announce maintenance via status page
   - [ ] Email notifications to users
   - [ ] Update status page to "scheduled maintenance"

2. **During maintenance**:
   - [ ] Enable maintenance mode (show splash page)
   - [ ] Deploy updates following runbook
   - [ ] Run post-deployment verification
   - [ ] Disable maintenance mode

3. **Post-maintenance**:
   - [ ] Update status page to "operational"
   - [ ] Monitor for issues (4 hours)
   - [ ] Email completion notification

---

## Disaster Recovery

### Backup Strategy

**Database**:
- Automatic: Daily backups (Supabase)
- Manual: Before each deployment
- Retention: 30 days

**Configuration**:
- Version controlled in Git
- Encrypted secrets in 1Password/Vault
- Document recovery steps

### Recovery Time Objectives (RTO/RPO)

| Component | RTO | RPO |
|-----------|-----|-----|
| Database | <30 min | <1 hour |
| Backend | <15 min | 0 (stateless) |
| Frontend | <5 min | 0 (stateless) |
| Overall System | <1 hour | <1 hour |

### Disaster Scenarios

#### Scenario 1: Complete Database Loss

1. Restore from latest backup (<30 min)
2. Verify data integrity
3. Update connection strings if needed
4. Resume operations

#### Scenario 2: Backend Server Failure

1. Deploy to new server from Docker image (<15 min)
2. Update DNS/load balancer
3. Verify health checks
4. Resume operations

#### Scenario 3: Complete Infrastructure Loss

1. Provision new infrastructure (Supabase + Vercel) (<1 hour)
2. Restore database from backup
3. Deploy backend and frontend
4. Update DNS
5. Resume operations

---

## Support Contacts

### On-Call Rotation

- **Primary**: [Name] ([Email]) ([Phone])
- **Secondary**: [Name] ([Email]) ([Phone])
- **Escalation**: [Engineering Manager]

### Third-Party Support

- **Supabase**: support@supabase.com
- **Vercel**: support@vercel.com
- **OpenAI**: support@openai.com
- **Shopify**: partners@shopify.com

---

## Deployment Log Template

```markdown
# Deployment Log - YYYY-MM-DD

## Deployment Details
- **Date**: YYYY-MM-DD HH:MM UTC
- **Version**: v1.x.x
- **Deployed By**: [Name]
- **Duration**: XX minutes
- **Downtime**: XX minutes (if any)

## Changes
- [Feature/Fix 1]
- [Feature/Fix 2]
- [Feature/Fix 3]

## Database Changes
- [ ] Migrations applied: [list]
- [ ] Data migrations: [list]
- [ ] Indexes added: [list]

## Issues Encountered
- [Issue 1]: [Resolution]
- [Issue 2]: [Resolution]

## Rollback Performed
- [ ] Yes (reason: ...)
- [x] No

## Post-Deployment Status
- [ ] All tests passing
- [ ] No errors in logs
- [ ] Performance within targets
- [ ] Monitoring alerts cleared

## Sign-Off
Deployed by: [Name]
Verified by: [Name]
Time: HH:MM UTC
```

---

## Useful Commands

```bash
# Check backend health
curl https://api.ccw-erp.example.com/health

# Check frontend
curl https://erp.ccw-example.com

# View backend logs
docker logs -f ccw-backend --tail=100

# View database connections
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Clear Redis cache
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD FLUSHALL

# Restart services
docker-compose restart backend frontend

# Scale services
docker-compose up -d --scale backend=3
```

---

## Next Steps After Deployment

1. Monitor system for 24-48 hours
2. Review logs for any unusual activity
3. Check performance metrics against baseline
4. Update status page
5. Document any issues encountered
6. Schedule post-mortem if needed
7. Update runbook with learnings
