# Production Deployment Checklist

**Linear Issue**: UNI-478 - Deploy to Production/Staging
**Date**: 2026-02-11
**Estimated Time**: 2-3 hours

---

## Pre-Deployment ✅

- [x] Type-check passed
- [x] Lint passed
- [x] Tests passed (154/154)
- [x] Production readiness: 70/70
- [x] Database health: 100/100
- [x] Build verified (93 routes, 550ms)

---

## Step 1: Database Setup (Supabase)

- [ ] Create Supabase project
  - Name: `ccw-erp-production`
  - Region: __________ (e.g., Sydney)
  - Password saved: ☐

- [ ] Enable extensions
  - [ ] `pgvector`
  - [ ] `uuid-ossp`

- [ ] Run schema migration
  - [ ] Tables created
  - [ ] Seed data loaded (if needed)

- [ ] Copy connection details
  ```
  Supabase URL: _____________________________________
  Anon Key: _________________________________________
  Service Role Key: _________________________________
  Database URL: _____________________________________
  ```

---

## Step 2: Cache Setup (Upstash Redis)

- [ ] Create Upstash account
- [ ] Create Redis database
  - Name: `ccw-erp-redis`
  - Region: __________ (same as Supabase)

- [ ] Copy Redis URL
  ```
  Redis URL: _______________________________________
  ```

---

## Step 3: Backend Deployment (Railway)

- [ ] Create Railway project
- [ ] Connect GitHub repository
- [ ] Configure build settings
  - Root directory: `apps/backend`
  - Start command: Auto-detected

- [ ] Add environment variables (see DEPLOYMENT-GUIDE.md)
  - [ ] Database URLs (from Supabase)
  - [ ] Redis URL (from Upstash)
  - [ ] API keys (Anthropic, Google AI, etc.)
  - [ ] CORS origins (will update after frontend)

- [ ] Deploy backend
  - [ ] Build successful
  - [ ] Deployment live

- [ ] Test backend
  ```bash
  curl https://[your-service].railway.app/health
  # Expected: {"status": "healthy"}
  ```

- [ ] Copy backend URL
  ```
  Backend URL: _____________________________________
  ```

---

## Step 4: Frontend Deployment (Vercel)

- [ ] Import project to Vercel
- [ ] Configure build settings
  - Root directory: `apps/web`
  - Framework: Next.js
  - Node version: 20.x

- [ ] Add environment variables
  - [ ] `NEXT_PUBLIC_API_URL` (from Railway)
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` (from Supabase)
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase)
  - [ ] `JINA_API_KEY` (if using Jina)

- [ ] Deploy frontend
  - [ ] Build successful (3-5 minutes)
  - [ ] Deployment live

- [ ] Copy frontend URL
  ```
  Frontend URL: ____________________________________
  ```

- [ ] Set up custom domain (optional)
  - Domain: __________________________________________
  - [ ] DNS configured
  - [ ] SSL certificate issued

---

## Step 5: Update Backend CORS

- [ ] Go to Railway → Variables
- [ ] Update `CORS_ORIGINS` with frontend URL:
  ```json
  ["https://your-app.vercel.app"]
  ```
- [ ] Redeploy backend

---

## Step 6: Smoke Tests

### Frontend Tests
- [ ] Homepage loads
- [ ] Login works (`admin@demo.com` / `demo123`)
- [ ] Dashboard loads
- [ ] Product search works
- [ ] Quote creation works
- [ ] Order creation works
- [ ] Logout works

### Backend API Tests
- [ ] Health endpoint: `/health`
- [ ] API docs: `/docs`
- [ ] Authentication: `/api/auth/login`
- [ ] Products endpoint: `/api/products`
- [ ] Orders endpoint: `/api/orders`
- [ ] Quotes endpoint: `/api/quotes`

### Database Tests
- [ ] Tables exist in Supabase
- [ ] Can query data via SQL Editor
- [ ] Seed data present (if applicable)

### Redis Tests
- [ ] Can view cache in Upstash dashboard
- [ ] API responses are cached (second call faster)

---

## Step 7: Monitoring Setup (Optional)

### Vercel Analytics
- [ ] Enable Web Analytics
- [ ] View real-time traffic

### Railway Observability
- [ ] Set up CPU usage alert (> 80%)
- [ ] Set up memory usage alert (> 80%)
- [ ] Set up error rate alert (> 5%)

### Supabase Monitoring
- [ ] Check database size
- [ ] Monitor API requests
- [ ] Review query performance

### Error Tracking (Optional)
- [ ] Set up Sentry
- [ ] Configure error alerts

---

## Step 8: Backups & Security

### Database Backups
- [ ] Configure daily automated backups in Supabase
- [ ] Test manual backup/restore

### Environment Variables Review
- [ ] All secrets in environment variables (not in code)
- [ ] No API keys committed to Git
- [ ] Production passwords are strong
- [ ] Service role keys are secret

### Security Headers
- [ ] HSTS enabled
- [ ] CSP configured
- [ ] XSS protection enabled
- [ ] CORS configured correctly

---

## Step 9: Update Linear

- [ ] Run deployment status script:
  ```bash
  python scripts/update_deployment_status.py
  ```

- [ ] Update UNI-478 issue
  - [ ] Add deployment comment
  - [ ] Mark as "Done"

- [ ] Update project with URLs
  - Frontend: ________________________________________
  - Backend: _________________________________________

---

## Step 10: Post-Deployment

### Immediate (Next 24 hours)
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Monitor database query performance
- [ ] Check for any 500 errors
- [ ] Verify CORS is working
- [ ] Test from different devices/browsers

### Next Steps (Week 1)
- [ ] Execute UNI-481: Backend Load Testing (100 scenarios)
- [ ] Set up monitoring alerts
- [ ] Configure automated backups schedule
- [ ] Update documentation with production URLs
- [ ] Share production URLs with team

### Future Improvements
- [ ] Set up CDN for static assets
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Implement performance monitoring
- [ ] Configure auto-scaling (if needed)

---

## Production URLs

```
Frontend:  ________________________________________________
Backend:   ________________________________________________
Database:  Supabase (PostgreSQL 15 + pgvector)
Redis:     Upstash (Redis cache)
Region:    ________________________________________________
```

---

## Deployment Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Frontend Build | < 5 min | _____ min | ☐ |
| Backend Build | < 5 min | _____ min | ☐ |
| Database Setup | < 10 min | _____ min | ☐ |
| Total Time | < 3 hours | _____ hours | ☐ |
| Health Checks | All passing | ☐ | ☐ |
| Smoke Tests | All passing | ☐ | ☐ |

---

## Troubleshooting

If you encounter issues, see `DEPLOYMENT-GUIDE.md` for detailed troubleshooting steps.

Common issues:
- Build failures → Check environment variables
- 404 on API calls → Verify NEXT_PUBLIC_API_URL
- CORS errors → Update CORS_ORIGINS in Railway
- Database connection errors → Check DATABASE_URL format
- Redis connection errors → Check REDIS_URL format

---

## Success Criteria

✅ All checks passed:
- [ ] Frontend is live and accessible
- [ ] Backend health check returns 200
- [ ] Database queries work
- [ ] Redis cache is operational
- [ ] Authentication flows work
- [ ] All smoke tests passed
- [ ] No critical errors in logs
- [ ] Linear updated with deployment status

---

**Deployment Complete!** 🎉

Next: Execute UNI-481 (Backend Load Testing)

