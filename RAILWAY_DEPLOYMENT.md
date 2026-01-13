# Railway Backend Deployment Guide (Development Mode)
**Date:** January 12, 2026
**Environment:** Development
**Platform:** Railway.app

---

## Quick Start

This guide will deploy the CCW ERP backend to Railway in **development mode** for testing and demonstration purposes.

**Deployment Time:** ~10 minutes

---

## Prerequisites

- [x] Railway account (free tier works)
- [x] GitHub repository connected to Railway
- [x] Production database ready (Supabase/Railway PostgreSQL)

---

## Step 1: Create Railway Project

### Option A: Via Railway Dashboard (Recommended)

1. **Login to Railway:**
   - Visit: https://railway.app
   - Click "Login" and authenticate with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository: `CCW-Online-ERP` or equivalent
   - Railway will auto-detect the monorepo structure

3. **Select Service:**
   - Railway should detect `apps/backend`
   - If not, manually set root directory to `apps/backend`

### Option B: Via Railway CLI (Alternative)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\apps\backend"
railway init

# Link to project
railway link
```

---

## Step 2: Configure Environment Variables

### Required Variables for Development Mode

In Railway dashboard, go to your service → **Variables** tab and add:

#### 🔧 **Core Configuration**

```bash
# Environment
ENVIRONMENT=development
DEBUG=true
PROJECT_NAME=CCW Equipment Supplier ERP

# Python
PYTHON_VERSION=3.12
```

#### 🔒 **Security & Authentication**

**CRITICAL: Generate a secure JWT secret before deployment**

**Option A: Use helper script (Recommended)**
```powershell
# From project root
.\scripts\generate-secrets.ps1
# Copy the generated JWT_SECRET_KEY to Railway Variables
```

**Option B: Manual generation**
```bash
# Run locally: openssl rand -hex 32
openssl rand -hex 32
```

**Railway Variables:**
```bash
# Use generated secret from above
JWT_SECRET_KEY=<paste_generated_secret_here>

JWT_EXPIRE_MINUTES=480
JWT_REFRESH_EXPIRE_DAYS=30

# Security
SECURE_COOKIES=false
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=100
```

#### 🗄️ **Database Configuration**

**Option A: Railway PostgreSQL (Recommended)**

1. In Railway dashboard, click "New" → "Database" → "Add PostgreSQL"
2. Railway automatically creates `DATABASE_URL` variable
3. Copy the connection string

**Option B: Supabase**

```bash
# Get from Supabase project settings → Database → Connection String
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Option C: External PostgreSQL**

```bash
DATABASE_URL=postgresql://username:password@host:5432/database
```

#### 🌐 **CORS Configuration**

```bash
# For development testing with localhost frontend
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]

# If deploying with Vercel frontend (add after frontend is deployed):
# CORS_ORIGINS=["http://localhost:3000","https://your-app.vercel.app"]
```

#### 🤖 **AI Configuration (Choose One)**

**Option A: Ollama (Local - Not recommended for Railway)**
```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

**Option B: Anthropic Claude (Recommended for Railway)**
```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...your-key-here
```

#### 📧 **Email (Optional - for password reset)**

```bash
SENDGRID_API_KEY=SG.your-key-here
SENDGRID_FROM_EMAIL=noreply@your-domain.com
SENDGRID_FROM_NAME=CCW ERP
```

---

## Step 3: Configure Build & Deploy Settings

### Verify railway.json Configuration

Railway should auto-detect the `railway.json` file in `apps/backend/`. Verify it contains:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "uv sync"
  },
  "deploy": {
    "startCommand": "uv run uvicorn src.api.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  },
  "env": {
    "PYTHON_VERSION": "3.12",
    "PORT": "8000"
  }
}
```

### Manual Configuration (if needed)

If `railway.json` isn't detected:

1. Go to service → **Settings** tab
2. **Build:**
   - Build Command: `uv sync`
   - Start Command: `uv run uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`
3. **Deploy:**
   - Root Directory: `apps/backend`
   - Watch Paths: `apps/backend/**`

---

## Step 4: Deploy

### Trigger Deployment

**Via Dashboard:**
1. Click "Deploy" or "Redeploy" button
2. Railway will:
   - Clone repository
   - Detect Python/uv
   - Run `uv sync` (install dependencies)
   - Start uvicorn server
   - Expose on public URL

**Via CLI:**
```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\apps\backend"
railway up
```

### Monitor Deployment

1. **Build Logs:**
   - Click "View Logs" → "Build"
   - Watch for errors during `uv sync`

2. **Deploy Logs:**
   - Click "View Logs" → "Deploy"
   - Look for: `Uvicorn running on http://0.0.0.0:8000`

3. **Expected Output:**
```
INFO:     Starting application environment=development
INFO:     Initializing AI agent orchestration system
INFO:     Agents initialized agents=['pricing_agent', 'procurement_agent', ...]
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

---

## Step 5: Initialize Database

### Run Database Migrations

**Option A: One-Command Script (Recommended)**
1. Go to Railway dashboard → Service → Click "..." → "Open Shell"
2. Run the automated post-deployment script:
```bash
bash scripts/railway-post-deploy.sh
```

This script automatically:
- Verifies database connection
- Runs Alembic migrations
- Loads seed data
- Verifies setup

**Option B: Manual Commands (Alternative)**
1. Go to service → Click "..." → "Open Shell"
2. Run commands individually:
```bash
uv run alembic upgrade head
uv run python seed_data.py
```

**Option C: Via Railway CLI**
```bash
# Connect to Railway environment
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\apps\backend"
railway run bash

# Inside Railway shell
bash scripts/railway-post-deploy.sh
exit
```

### Verify Database Setup

```bash
# Check migrations applied
railway run bash -c "uv run alembic current"

# Should show: Current revision
```

---

## Step 6: Get Your Deployment URL

### Find Public URL

1. Go to Railway dashboard → Your service
2. Click "Settings" → "Networking"
3. Railway auto-generates a URL like:
   ```
   https://ccw-erp-backend-production.up.railway.app
   ```

### Generate Domain (if not auto-generated)

1. In "Networking" section
2. Click "Generate Domain"
3. Copy the URL

---

## Step 7: Test Deployment

### Automated Verification (Recommended)

Run the comprehensive verification script from your local machine:

```powershell
# From project root - replace with your actual Railway URL
.\scripts\verify-deployment.ps1 https://your-app-name.up.railway.app
```

This script automatically tests:
- ✅ Health check endpoint
- ✅ API documentation accessibility
- ✅ CORS configuration
- ✅ Authentication endpoint
- ✅ Security headers

**Expected Output:**
```
======================================
 Railway Deployment Verification
======================================

Test 1: Health Check Endpoint...
   ✅ PASS: Health check returned healthy status

Test 2: API Documentation (Swagger UI)...
   ✅ PASS: API docs accessible

Test 3: CORS Headers Configuration...
   ✅ PASS: CORS configured correctly

Test 4: Authentication Endpoint...
   ✅ PASS: Authentication working, token received

Test 5: Security Headers...
   ✅ PASS: All security headers present

======================================
 Verification Summary
======================================

Tests Passed: 5
Tests Failed: 0

✅ All critical tests passed!
```

### Manual Testing (Alternative)

If you prefer manual verification:

**Health Check:**
```bash
curl https://your-app-name.up.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-01-12T..."
}
```

**API Documentation:**
Visit: `https://your-app-name.up.railway.app/docs`

**Test Authentication:**
```bash
curl -X POST https://your-app-name.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": "...",
    "email": "admin@demo.com",
    "full_name": "Demo Administrator",
    "is_admin": true
  }
}
```

---

## Step 8: Update Frontend Configuration

Once backend is deployed, update frontend to use Railway URL:

```bash
# apps/web/.env.local
NEXT_PUBLIC_BACKEND_URL=https://your-app-name.up.railway.app
```

Restart frontend:
```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\apps\web"
pnpm dev
```

Test frontend can connect to Railway backend.

---

## Troubleshooting

### Build Fails: "uv: command not found"

**Solution:** Railway should auto-detect uv. If not, add to `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "curl -LsSf https://astral.sh/uv/install.sh | sh && uv sync"
  }
}
```

### Database Connection Fails

**Check:**
1. `DATABASE_URL` variable is set correctly
2. Database is accessible (not behind firewall)
3. Connection string format is correct

**Test Connection:**
```bash
railway run bash -c "uv run python -c 'from src.config.database import engine; print(engine)'"
```

### App Crashes on Startup

**Check Deploy Logs:**
1. Railway dashboard → Service → "View Logs"
2. Look for Python errors
3. Common issues:
   - Missing environment variables
   - Database connection timeout
   - Port binding issues

**Solution:**
Verify all required environment variables are set (see Step 2).

### CORS Errors from Frontend

**Symptoms:**
```
Access to fetch has been blocked by CORS policy
```

**Solution:**
1. Check `CORS_ORIGINS` includes your frontend URL
2. Verify format: `["http://localhost:3000"]` (JSON array string)
3. Redeploy backend after changing CORS_ORIGINS

### Health Check Fails

**Check:**
1. `/health` endpoint returns 200 OK
2. Database connection is working
3. No errors in deploy logs

**Test:**
```bash
curl -v https://your-app-name.up.railway.app/health
```

---

## Deployment Checklist

### Pre-Deployment ✅

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] Database created (Railway PostgreSQL or Supabase)
- [ ] Environment variables prepared (JWT secret, etc.)
- [ ] AI provider configured (Anthropic API key or Ollama)

### During Deployment ✅

- [ ] Environment variables set in Railway dashboard
- [ ] Build completes successfully
- [ ] Deploy logs show "Application startup complete"
- [ ] Public URL generated

### Post-Deployment ✅

- [ ] Database migrations run (`alembic upgrade head`)
- [ ] Seed data loaded (`python seed_data.py`)
- [ ] Health check returns 200 OK
- [ ] API documentation accessible at `/docs`
- [ ] Authentication works (test login)
- [ ] CORS configured for frontend

### Frontend Integration ✅

- [ ] Frontend `.env.local` updated with Railway URL
- [ ] Frontend can connect to backend API
- [ ] No CORS errors in browser console
- [ ] Login works from frontend
- [ ] Data loads correctly

---

## Development Mode Features

In development mode, the following features are enabled:

- ✅ **Debug Logging:** Verbose logs for troubleshooting
- ✅ **Auto-Reload:** Code changes trigger restart (if using watch mode)
- ✅ **CORS Localhost:** `http://localhost:*` origins allowed
- ✅ **Development Auth:** Lenient authentication (200 OK on unauthenticated in some cases)
- ⚠️ **Insecure Cookies:** `Secure` flag disabled (no HTTPS required)

**Note:** These features should be disabled in production (set `ENVIRONMENT=production`).

---

## Monitoring & Maintenance

### View Logs

**Real-time:**
```bash
railway logs
```

**Or via Dashboard:**
Railway dashboard → Service → "View Logs"

### Metrics

Railway dashboard → Service → "Metrics" tab

Monitor:
- CPU usage
- Memory usage
- Network traffic
- Response times

### Redeploy

**Trigger manual redeploy:**
1. Railway dashboard → Service
2. Click "Deploy" → "Redeploy"

**Or via CLI:**
```bash
railway up --detach
```

### Environment Variables

**Update variables:**
1. Railway dashboard → Service → "Variables"
2. Edit or add variables
3. Click "Save"
4. Railway auto-redeploys with new variables

---

## Cost Estimate (Railway Free Tier)

**Free Tier Includes:**
- $5 credit per month
- 500 hours execution time
- 100 GB egress
- 1 GB memory per service

**Backend Usage (Estimated):**
- ~$0.20/day (light usage)
- ~$6/month (continuous running)

**Recommendation:** Upgrade to Hobby plan ($5/month) for production or heavy testing.

---

## Next Steps

After backend is deployed:

1. **Deploy Frontend to Vercel:**
   - Update `NEXT_PUBLIC_BACKEND_URL` to Railway URL
   - Deploy frontend
   - Test end-to-end

2. **Update CORS:**
   - Add Vercel URL to `CORS_ORIGINS`
   - Redeploy backend

3. **Setup Custom Domain (Optional):**
   - Railway dashboard → Service → Settings → Networking
   - Add custom domain
   - Configure DNS

4. **Enable Production Mode:**
   - Change `ENVIRONMENT=production`
   - Enable `SECURE_COOKIES=true`
   - Redeploy

---

## Quick Reference

### Railway Dashboard URLs

- **Dashboard:** https://railway.app/dashboard
- **Project:** https://railway.app/project/[project-id]
- **Service:** https://railway.app/project/[project-id]/service/[service-id]

### Important Environment Variables

```bash
# Minimum required for development:
ENVIRONMENT=development
DATABASE_URL=postgresql://...
JWT_SECRET_KEY=<generate_with_openssl_rand>
CORS_ORIGINS=["http://localhost:3000"]
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Common Commands

```bash
# View logs
railway logs

# Run command in Railway environment
railway run [command]

# Open shell
railway run bash

# Deploy
railway up

# Link project
railway link
```

---

## Support

**Railway Documentation:** https://docs.railway.app
**Railway Discord:** https://discord.gg/railway
**Project Issues:** Check deploy logs and service metrics

---

**Deployment Status:** 📦 Ready to Deploy

Follow the steps above to deploy your backend to Railway in development mode!
