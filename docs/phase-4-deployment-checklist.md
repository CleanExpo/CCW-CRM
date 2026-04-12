# Phase 4: Deployment Checklist

**Version**: 1.0
**Date**: 2026-02-04
**Status**: Ready for Production Deployment

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Environment Variables

Ensure all required environment variables are set in production:

```bash
# Backend (.env)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...                  # For AI features (if enabled)
OLLAMA_BASE_URL=http://localhost:11434 # For local LLM
SENTRY_DSN=https://...                 # Error tracking
PROMETHEUS_ENABLED=true                # Metrics
LINEAR_API_KEY=lin_api_...             # Task tracking (optional)
LINEAR_TEAM_KEY=UNI                    # Team identifier

# Frontend (.env.local)
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 2. Database Migrations

Run all pending migrations:

```bash
cd apps/backend
alembic upgrade head

# Verify migrations applied
alembic current

# Verify indexes created
python verify_indexes.py
```

**Expected Output**:

- ✅ 66+ indexes across all tables
- ✅ All foreign key indexes present
- ✅ Trigram indexes for search fields

### 3. Dependencies

Verify all dependencies are installed:

```bash
# Frontend
cd apps/web
pnpm install

# Backend
cd apps/backend
uv sync
```

### 4. Build Tests

Run full test suite before deployment:

```bash
# From project root
pnpm turbo run type-check    # TypeScript validation
pnpm turbo run lint          # Code quality
pnpm turbo run test          # Unit tests

# Backend tests
cd apps/backend
uv run pytest                # All pytest tests
```

**Success Criteria**:

- ✅ All type-checks pass (0 errors)
- ✅ All lints pass (0 errors)
- ✅ All tests pass (100%)

### 5. E2E Tests

Run end-to-end tests on staging:

```bash
cd apps/web
pnpm playwright test

# Run specific Phase 4 tests
pnpm playwright test e2e/autosave.spec.ts
pnpm playwright test e2e/orders.spec.ts
pnpm playwright test e2e/products.spec.ts
```

**Success Criteria**:

- ✅ All autosave tests pass
- ✅ All form submission tests pass
- ✅ All navigation tests pass

### 6. Performance Benchmarks

Run performance tests to establish baseline:

```bash
cd apps/backend

# Query performance analysis
python scripts/analyze_query_performance.py

# Load testing (1000 concurrent users)
python tests/load/run_full_load_test.py
```

**Success Criteria**:

- ✅ Dashboard loads in <2s
- ✅ Products API call count = 1 (not 51)
- ✅ Order creation <1.5s
- ✅ p95 API response <300ms
- ✅ System handles 1000 concurrent users

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Backup Current State

```bash
# Database backup
pg_dump -h localhost -U postgres ccw_erp > backup_$(date +%Y%m%d_%H%M%S).sql

# Code backup (Git tag)
git tag -a phase-4-pre-deployment -m "Pre-Phase 4 deployment backup"
git push origin phase-4-pre-deployment
```

### Step 2: Deploy Backend

```bash
cd apps/backend

# Stop backend service
sudo systemctl stop ccw-backend

# Pull latest code
git pull origin main

# Run migrations
alembic upgrade head

# Restart service
sudo systemctl start ccw-backend

# Verify health
curl https://api.yourdomain.com/health
```

**Expected Response**:

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "version": "phase-4.0.0"
}
```

### Step 3: Deploy Frontend

```bash
cd apps/web

# Build production bundle
pnpm build

# Deploy to Vercel/Netlify/Custom
pnpm deploy:production

# Verify deployment
curl https://yourdomain.com/api/health
```

**Verify**:

- ✅ Site loads successfully
- ✅ Dashboard renders within 2s
- ✅ No console errors
- ✅ Autosave indicator visible

### Step 4: Verify Features

#### Autosave (Critical)

1. Open any form (Orders, Quotes, Customers)
2. Fill in data
3. Wait 2 seconds
4. Close dialog
5. Reopen dialog
6. **Verify**: Draft recovery alert appears
7. Click "Restore"
8. **Verify**: All data restored

#### Performance (Critical)

1. Navigate to Products page
2. Open network tab
3. **Verify**: Only 1 API call for products + stock
4. Navigate to Dashboard
5. **Verify**: Dashboard loads in <2s
6. Check real-time indicator
7. **Verify**: "Live Metrics" badge visible

#### Real-Time Updates (Critical)

1. Open Dashboard
2. Create a new order in another tab
3. **Verify**: Dashboard metrics update within 1s
4. Check inventory page
5. **Verify**: Stock changes appear instantly

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### Smoke Tests (15 minutes)

#### Test 1: User Login

- ✅ Login with admin@demo.com / demo123
- ✅ Redirect to dashboard
- ✅ Dashboard loads successfully

#### Test 2: Create Order (Autosave)

- ✅ Click "New Order"
- ✅ Fill customer, location, notes
- ✅ Add 2 line items
- ✅ Close dialog (don't submit)
- ✅ Reopen - verify draft recovery alert
- ✅ Click "Restore"
- ✅ Verify all data restored
- ✅ Submit order successfully

#### Test 3: Products Performance

- ✅ Navigate to Products page
- ✅ Open network tab
- ✅ Refresh page
- ✅ Count API calls (should be 1-2, not 50+)
- ✅ Verify stock data visible

#### Test 4: Real-Time Dashboard

- ✅ Open dashboard
- ✅ Check "Live Metrics" indicator (green badge)
- ✅ Create new order
- ✅ Verify active_orders count updates within 1s

#### Test 5: Recent Items

- ✅ Create order with Customer A
- ✅ Create second order
- ✅ Open customer dropdown
- ✅ Verify Customer A appears at/near top

### Monitoring (24 hours)

#### Application Metrics (Prometheus/Grafana)

Monitor these dashboards:

- **API Response Times**: p50, p95, p99 latencies
- **Database Queries**: Query duration, connection pool
- **SSE Connections**: Active connections, reconnects
- **Cache Hit Rates**: Redis cache effectiveness

**Alerts to Configure**:

- API p95 latency >500ms
- Database connection pool >80% capacity
- SSE connections >1000
- Error rate >1%

#### Error Tracking (Sentry)

Watch for these errors:

- Autosave localStorage quota exceeded
- SSE connection failures
- Database deadlocks
- API timeout errors

**Success Criteria (24h)**:

- ✅ Error rate <0.5%
- ✅ p95 API latency <300ms
- ✅ No autosave data loss reports
- ✅ No performance degradation

---

## 🔄 ROLLBACK PROCEDURE

### If Critical Issues Detected

#### 1. Quick Rollback (Fronten)

```bash
# Revert to previous deployment
vercel rollback  # Or your hosting provider's rollback command

# Or manual rollback
git reset --hard phase-4-pre-deployment
pnpm build
pnpm deploy
```

#### 2. Database Rollback (if needed)

```bash
# Downgrade migrations (ONLY if database changes cause issues)
cd apps/backend
alembic downgrade -1

# Verify current version
alembic current
```

#### 3. Backend Rollback

```bash
cd apps/backend
git checkout phase-4-pre-deployment
sudo systemctl restart ccw-backend
```

### Rollback Decision Tree

**Issue: Autosave not working**

- **Impact**: Low (feature enhancement, not breaking)
- **Action**: Fix forward (disable feature flag if exists)
- **Rollback**: NOT NEEDED

**Issue: Performance regression**

- **Impact**: High (users experiencing slow site)
- **Action**: Check database indexes, verify Redis
- **Rollback**: If >50% slower, rollback immediately

**Issue: Real-time SSE errors**

- **Impact**: Medium (fallback to polling exists)
- **Action**: Disable SSE connections via feature flag
- **Rollback**: NOT NEEDED (graceful degradation)

**Issue: Database errors**

- **Impact**: CRITICAL (data integrity)
- **Action**: ROLLBACK IMMEDIATELY
- **Steps**: Restore database backup, downgrade migrations, rollback code

---

## 📊 SUCCESS METRICS (Week 1)

### Performance (Expected Improvements)

| Metric              | Before Phase 4 | Target | Actual | Status |
| ------------------- | -------------- | ------ | ------ | ------ |
| Dashboard load time | 5-8s           | <2s    | \_\_\_ | ☐      |
| Products API calls  | 51             | 1      | \_\_\_ | ☐      |
| Order creation time | 3-5s           | <1.5s  | \_\_\_ | ☐      |
| p95 API latency     | ~500ms         | <300ms | \_\_\_ | ☐      |

### UX (Expected Improvements)

| Metric                     | Before Phase 4 | Target | Actual | Status |
| -------------------------- | -------------- | ------ | ------ | ------ |
| Form data loss incidents   | High           | 0      | \_\_\_ | ☐      |
| User complaints (autosave) | -              | <5     | \_\_\_ | ☐      |
| Recent items usage rate    | 0%             | >70%   | \_\_\_ | ☐      |

### Stability

| Metric                 | Target | Actual | Status |
| ---------------------- | ------ | ------ | ------ |
| Uptime                 | >99.9% | \_\_\_ | ☐      |
| Error rate             | <0.5%  | \_\_\_ | ☐      |
| SSE connection success | >95%   | \_\_\_ | ☐      |

---

## 🚨 KNOWN LIMITATIONS

### Phase 4 Limitations

1. **AI Features Not Enabled**: Smart form auto-fill, anomaly detection not in this release
   - Reason: Additional testing required
   - Timeline: Phase 4.1 (2-3 weeks)

2. **Load Testing**: Only tested up to 1000 concurrent users
   - Recommended: Monitor real usage, scale if needed

3. **Autosave Storage**: Limited to localStorage (5-10MB)
   - Mitigation: Drafts expire after 7 days automatically

4. **SSE Browser Compatibility**: IE11 not supported
   - Fallback: Graceful degradation to polling (automatic)

---

## 📞 SUPPORT CONTACTS

### Deployment Issues

- **On-Call Engineer**: [Name] - [Phone]
- **DevOps Team**: [Email]
- **Database Admin**: [Name] - [Phone]

### Monitoring Dashboards

- **Grafana**: https://grafana.yourdomain.com
- **Sentry**: https://sentry.io/ccw-erp
- **Status Page**: https://status.yourdomain.com

---

## ✅ DEPLOYMENT SIGN-OFF

### Pre-Deployment Approval

- ☐ Technical Lead: ********\_******** Date: **\_\_\_**
- ☐ QA Lead: ********\_******** Date: **\_\_\_**
- ☐ Product Owner: ********\_******** Date: **\_\_\_**

### Post-Deployment Verification

- ☐ Smoke tests passed: ********\_******** Date: **\_\_\_**
- ☐ 24h monitoring reviewed: ********\_******** Date: **\_\_\_**
- ☐ No critical issues: ********\_******** Date: **\_\_\_**

### Final Sign-Off

- ☐ Deployment SUCCESSFUL: ********\_******** Date: **\_\_\_**

---

**Last Updated**: 2026-02-04
**Version**: 1.0
**Status**: Ready for Production Deployment
