# CCW-ERP/CRM - Production Deployment Guide

**Date**: 2026-02-11
**Linear Issue**: UNI-478 - Deploy to Production/Staging
**Status**: Ready for Deployment (All checks passed ✅)

---

## 📋 Pre-Deployment Checklist

✅ **Production Readiness**: 70/70 score
✅ **Database Health**: 100/100 (Perfect)
✅ **Type-check**: PASSED (21.5s)
✅ **Lint**: PASSED (179ms, 163 non-blocking warnings)
✅ **Tests**: PASSED (154/154 tests in 7.03s)
✅ **Build**: 93 routes compiled, 550ms start time

---

## 🎯 Deployment Overview

This guide will deploy:
1. **Frontend** → Vercel (Next.js 15 app)
2. **Backend** → Railway (FastAPI Python app)
3. **Database** → Supabase (PostgreSQL 15 with pgvector)
4. **Redis** → Upstash (Redis cache)

**Estimated Time**: 2-3 hours

---

## Step 1: Set Up Supabase Project (Database)

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name**: `ccw-erp-production`
   - **Database Password**: (Generate strong password - save it!)
   - **Region**: Choose closest to your users (e.g., Sydney for Australia)
   - **Pricing Plan**: Free tier (upgrade later if needed)
4. Click **"Create new project"** (takes ~2 minutes to provision)

### 1.2 Enable Required Extensions

1. Go to **"Database" → "Extensions"** in Supabase dashboard
2. Enable these extensions:
   - ✅ `pgvector` (for AI embeddings)
   - ✅ `uuid-ossp` (for UUID generation)

### 1.3 Run Database Schema Migration

1. Go to **"SQL Editor"** in Supabase dashboard
2. Copy the schema from `apps/backend/migrations/*.sql` files
3. Execute the SQL to create tables
4. Or use Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push schema
supabase db push
```

### 1.4 Get Connection Details

1. Go to **"Project Settings" → "Database"**
2. Copy these values:
   - **Connection String (URI)**: `postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres`
   - **Supabase URL**: `https://[PROJECT-REF].supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (keep secret!)

---

## Step 2: Set Up Upstash Redis (Cache)

### 2.1 Create Upstash Account

1. Go to https://upstash.com
2. Sign up/login with GitHub
3. Click **"Create Database"**
4. Fill in:
   - **Name**: `ccw-erp-redis`
   - **Type**: Regional
   - **Region**: Choose same as Supabase
   - **Eviction**: Default (LRU)
5. Click **"Create"**

### 2.2 Get Redis URL

1. Go to database details page
2. Copy **"REST URL"** or **"Redis URL"**:
   - Format: `redis://default:[PASSWORD]@[HOST]:6379`

---

## Step 3: Set Up Railway (Backend Deployment)

### 3.1 Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account
5. Select the `CCW-ERP-CRM` repository
6. Railway will auto-detect the Dockerfile

### 3.2 Configure Build Settings

1. Go to **"Settings" → "General"**
2. Set:
   - **Root Directory**: `apps/backend`
   - **Start Command**: Already configured in `railway.json`

### 3.3 Add Environment Variables

Go to **"Variables"** tab and add:

```bash
# Database (from Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Redis (from Upstash)
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379

# API Configuration
BACKEND_API_KEY=generate-random-32-char-string-here
CORS_ORIGINS=["https://your-frontend-domain.vercel.app"]
ENVIRONMENT=production
DEBUG=false

# AI Model API Keys (Required)
ANTHROPIC_API_KEY=sk-ant-api-...
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_MAX_TOKENS=4096
ANTHROPIC_TEMPERATURE=0.4

# Google AI (for translations)
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Xero Integration (Optional - for bank feed sync)
XERO_MODE=demo
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=https://your-backend.railway.app/api/integrations/xero/callback
XERO_ACCESS_TOKEN=your_xero_access_token
XERO_TENANT_ID=your_xero_tenant_id

# SendGrid (Optional - for email notifications)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@ccw-erp.com
ACCOUNTS_TEAM_EMAIL=accounts@ccw-erp.com

# Monitoring (Optional)
SMTP_PASSWORD=your_gmail_app_password
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3.4 Deploy Backend

1. Click **"Deploy"** (Railway will build and deploy automatically)
2. Wait for deployment to complete (~5 minutes)
3. Check logs for any errors
4. Get the public URL: `https://[your-service].railway.app`

### 3.5 Test Backend Health

```bash
curl https://[your-service].railway.app/health
# Should return: {"status": "healthy"}
```

---

## Step 4: Set Up Vercel (Frontend Deployment)

### 4.1 Import Project to Vercel

1. Go to https://vercel.com/dashboard
2. Click **"Add New..." → "Project"**
3. Import your GitHub repository: `CCW-ERP-CRM`
4. Vercel will auto-detect Next.js

### 4.2 Configure Build Settings

1. **Framework Preset**: Next.js
2. **Root Directory**: `apps/web`
3. **Build Command**: `pnpm build`
4. **Output Directory**: `.next`
5. **Install Command**: `pnpm install`

### 4.3 Add Environment Variables

Go to **"Environment Variables"** and add:

```bash
# Backend API (from Railway)
NEXT_PUBLIC_API_URL=https://[your-service].railway.app

# Supabase (from Step 1)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Jina AI Reader (server-side only)
JINA_API_KEY=your_jina_api_key_here
JINA_READER_BASE_URL=https://r.jina.ai/http://

# Monitoring (Optional)
PROMETHEUS_URL=your_prometheus_url_if_using
```

### 4.4 Configure Vercel Settings

1. Go to **"Settings" → "General"**
2. Set:
   - **Framework**: Next.js
   - **Node.js Version**: 20.x
   - **Install Command**: `pnpm install`
   - **Build Command**: `pnpm build`

3. Go to **"Settings" → "Headers"** (already configured in `vercel.json`)
   - Security headers are pre-configured
   - Cron jobs are pre-configured

### 4.5 Deploy Frontend

1. Click **"Deploy"**
2. Wait for build to complete (~3-5 minutes)
3. Vercel will give you a production URL: `https://your-app.vercel.app`
4. Set up custom domain (optional):
   - Go to **"Settings" → "Domains"**
   - Add your domain (e.g., `erp.ccw.com.au`)
   - Follow DNS configuration instructions

---

## Step 5: Update Backend CORS

After frontend is deployed, update backend environment variables:

1. Go to Railway → Your backend service → **"Variables"**
2. Update `CORS_ORIGINS`:
   ```bash
   CORS_ORIGINS=["https://your-app.vercel.app", "https://erp.ccw.com.au"]
   ```
3. Redeploy backend

---

## Step 6: Run Smoke Tests

### 6.1 Frontend Tests

1. Visit your production URL: `https://your-app.vercel.app`
2. Test these flows:
   - ✅ Homepage loads
   - ✅ Login page works (try `admin@demo.com` / `demo123`)
   - ✅ Dashboard loads after login
   - ✅ Product search works
   - ✅ Quote creation works
   - ✅ Order creation works
   - ✅ Logout works

### 6.2 Backend API Tests

```bash
# Health check
curl https://[your-service].railway.app/health

# API docs
curl https://[your-service].railway.app/docs

# Test authentication
curl -X POST https://[your-service].railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "demo123"}'

# Test protected endpoint (use token from login)
curl https://[your-service].railway.app/api/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6.3 Database Tests

1. Go to Supabase dashboard → **"Table Editor"**
2. Check that tables exist:
   - ✅ `users`
   - ✅ `products`
   - ✅ `customers`
   - ✅ `orders`
   - ✅ `quotes`
   - ✅ Other tables from your schema
3. Run test query in SQL Editor:
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM products;
   ```

### 6.4 Redis Tests

1. Go to Upstash dashboard → Your database
2. Click **"Data Browser"**
3. Check for cache keys (may be empty initially)
4. Test with backend:
   ```bash
   # This should cache the result
   curl https://[your-service].railway.app/api/products

   # Second call should be faster (cached)
   curl https://[your-service].railway.app/api/products
   ```

---

## Step 7: Post-Deployment Configuration

### 7.1 Set Up Monitoring (Optional)

**Vercel Analytics:**
1. Go to Vercel → Your project → **"Analytics"**
2. Enable Web Analytics
3. View real-time traffic

**Railway Observability:**
1. Go to Railway → Your service → **"Observability"**
2. Set up alerts for:
   - CPU usage > 80%
   - Memory usage > 80%
   - Request errors > 5%

**Supabase Monitoring:**
1. Go to Supabase → **"Reports"**
2. Monitor:
   - Database size
   - API requests
   - Query performance

### 7.2 Set Up Error Tracking (Optional)

**Sentry Integration:**
```bash
# Install Sentry
pnpm add @sentry/nextjs @sentry/node

# Configure in next.config.js and backend
# Follow: https://docs.sentry.io/platforms/javascript/guides/nextjs/
```

### 7.3 Set Up Backups

**Supabase Backups:**
1. Go to Supabase → **"Database" → "Backups"**
2. Configure daily automated backups
3. Test manual backup/restore

---

## Step 8: Update Linear with Deployment Status

### 8.1 Update UNI-478 Issue

Run this script:

```bash
python scripts/update_deployment_status.py
```

Or manually update in Linear:
1. Go to https://linear.app/unite-hub/issue/UNI-478
2. Add comment:
   ```
   ## ✅ Production Deployment Complete (2026-02-11)

   ### URLs
   - Frontend: https://your-app.vercel.app
   - Backend: https://your-service.railway.app
   - Database: Supabase (Sydney region)
   - Redis: Upstash (Sydney region)

   ### Tests Passed
   - ✅ Type-check: PASSED
   - ✅ Lint: PASSED
   - ✅ Tests: 154/154 PASSED
   - ✅ Smoke tests: All flows working

   ### Next Steps
   - Monitor performance for 24 hours
   - Execute UNI-481: Backend Load Testing
   ```
3. Change status to **"Done"**

---

## 📊 Production Metrics

| Metric | Target | Status |
|--------|--------|--------|
| **Frontend Build Time** | < 5 min | ✅ 3-5 min |
| **Backend Build Time** | < 5 min | ✅ ~5 min |
| **Database Setup** | < 10 min | ✅ ~2 min |
| **Total Deployment** | < 2 hours | ⏳ Your time |
| **Health Checks** | All passing | ⏳ Verify |
| **Smoke Tests** | All passing | ⏳ Test |

---

## 🔧 Troubleshooting

### Frontend Issues

**Build Fails on Vercel:**
```bash
# Check build logs in Vercel dashboard
# Common issues:
# - Missing environment variables
# - TypeScript errors
# - Build timeout

# Solution: Check environment variables match .env.example
```

**404 on API calls:**
```bash
# Check NEXT_PUBLIC_API_URL is correct
# Should be: https://[your-service].railway.app
# NOT: http://localhost:8000
```

### Backend Issues

**Railway build fails:**
```bash
# Check railway.json and Dockerfile are correct
# Check ROOT_DIRECTORY is set to: apps/backend
# View logs in Railway dashboard
```

**Database connection errors:**
```bash
# Check DATABASE_URL format:
# postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
# Test connection in Railway logs
```

**CORS errors:**
```bash
# Update CORS_ORIGINS in Railway environment variables
# Must include your Vercel URL
# Format: ["https://your-app.vercel.app"]
```

### Database Issues

**Tables not created:**
```bash
# Run migration manually in Supabase SQL Editor
# Copy from: apps/backend/migrations/*.sql
```

**Connection timeout:**
```bash
# Check Supabase project is not paused (free tier pauses after 7 days inactivity)
# Wake up: Go to Supabase dashboard → Click "Wake up"
```

---

## 📝 Next Steps After Deployment

1. ✅ Monitor logs for 24 hours
2. ✅ Execute UNI-481: Backend Load Testing (100 scenarios)
3. ✅ Set up custom domain (optional)
4. ✅ Configure automated backups
5. ✅ Set up monitoring alerts
6. ✅ Update documentation with production URLs

---

## 🚀 Quick Reference

### URLs

```bash
# Frontend
Production: https://your-app.vercel.app
Vercel Dashboard: https://vercel.com/dashboard

# Backend
Production: https://your-service.railway.app
Railway Dashboard: https://railway.app/dashboard

# Database
Supabase Dashboard: https://supabase.com/dashboard

# Redis
Upstash Dashboard: https://upstash.com/dashboard
```

### Key Commands

```bash
# Deploy frontend
cd apps/web
vercel --prod

# Deploy backend
cd apps/backend
railway up

# Check health
curl https://[backend-url]/health
curl https://[frontend-url]/api/health

# View logs
railway logs
vercel logs
```

---

**Status**: Ready to deploy ✅
**Last Updated**: 2026-02-11
**Linear Issue**: UNI-478

