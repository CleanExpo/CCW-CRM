# Deployment Helper Scripts

This document explains the helper scripts created to streamline the Railway deployment process.

---

## Scripts Overview

### 1. `scripts/generate-secrets.ps1`

**Purpose:** Generate cryptographically secure secrets for production deployment.

**Usage:**
```powershell
.\scripts\generate-secrets.ps1
```

**Output:**
- JWT_SECRET_KEY (64 characters, 32 bytes hex)
- SESSION_SECRET (optional, for future use)

**When to use:** Before deploying to Railway, run this to generate a production-grade JWT secret instead of using a weak/predictable value.

**Example Output:**
```
======================================
 Production Secrets Generator
======================================

1. JWT Secret Key (for Railway/backend):
   Variable: JWT_SECRET_KEY

   a3f8c9d2e1b4a7f6c8d9e2b3a4f7c8d9e1b2a3f4c5d6e7f8a9b0c1d2e3f4a5b6

   Copy this to Railway dashboard → Variables → JWT_SECRET_KEY
```

---

### 2. `scripts/verify-deployment.ps1`

**Purpose:** Verify that the Railway backend deployment is working correctly.

**Usage:**
```powershell
.\scripts\verify-deployment.ps1 https://your-app-name.up.railway.app
```

**Tests Performed:**
1. **Health Check** - Verifies `/health` endpoint returns "healthy" status
2. **API Documentation** - Checks Swagger UI is accessible at `/docs`
3. **CORS Configuration** - Verifies CORS headers for localhost frontend
4. **Authentication** - Tests login endpoint with demo credentials
5. **Security Headers** - Checks CSP, X-Frame-Options, X-Content-Type-Options, etc.

**Exit Codes:**
- `0` - All tests passed
- `1` - Some tests failed

**Example Output:**
```
======================================
 Railway Deployment Verification
======================================

Backend URL: https://ccw-erp-backend.up.railway.app

Test 1: Health Check Endpoint...
   ✅ PASS: Health check returned healthy status

Test 2: API Documentation (Swagger UI)...
   ✅ PASS: API docs accessible

Test 3: CORS Headers Configuration...
   ✅ PASS: CORS configured correctly

Test 4: Authentication Endpoint...
   ⚠️  WARN: Authentication failed - this is expected if demo user doesn't exist yet
   Run database migrations and seed data on Railway

Test 5: Security Headers...
   ✅ PASS: All security headers present

======================================
 Verification Summary
======================================

Tests Passed: 4
Tests Failed: 0

✅ All critical tests passed!
```

---

### 3. `scripts/railway-post-deploy.sh`

**Purpose:** Initialize the database after Railway deployment (migrations + seed data).

**Usage:** Run this in Railway's shell interface:
1. Go to Railway dashboard
2. Click on your backend service
3. Click "..." menu → "Open Shell"
4. Run:
```bash
bash scripts/railway-post-deploy.sh
```

**Steps Performed:**
1. Verify correct directory (checks for `pyproject.toml`)
2. Test database connection
3. Run Alembic migrations (`alembic upgrade head`)
4. Load seed data (`python seed_data.py`)
5. Verify current migration revision

**Example Output:**
```
======================================
 Railway Post-Deployment Setup
======================================

✅ Found pyproject.toml - in correct directory

Step 1: Verifying database connection...
✅ Database connection successful

Step 2: Running database migrations...
✅ Database migrations completed

Step 3: Loading seed data...
✅ Seed data loaded successfully

Step 4: Verifying database schema...
✅ Current database revision: abc123def456

======================================
 Post-Deployment Setup Complete!
======================================

✅ Database initialized
✅ Migrations applied
✅ Seed data loaded

Test Credentials:
  Email: admin@demo.com
  Password: demo123
```

---

## Deployment Workflow

### Step-by-Step Guide with Helper Scripts

#### 1. Pre-Deployment (Local)

Generate production secrets:
```powershell
# From project root
.\scripts\generate-secrets.ps1
```

Copy the generated JWT_SECRET_KEY.

#### 2. Railway Setup

1. Login to Railway: https://railway.app
2. Create new project from GitHub repo
3. Select `apps/backend` as root directory
4. Configure environment variables (use values from `RAILWAY_DEPLOYMENT.md`)
5. Paste generated JWT_SECRET_KEY into Railway Variables
6. Deploy

#### 3. Post-Deployment (Railway Shell)

Initialize database:
```bash
# In Railway dashboard → Service → ... → Open Shell
bash scripts/railway-post-deploy.sh
```

#### 4. Verification (Local)

Test deployment:
```powershell
# Replace with your actual Railway URL
.\scripts\verify-deployment.ps1 https://your-app-name.up.railway.app
```

If all tests pass, deployment is successful!

---

## Troubleshooting

### `generate-secrets.ps1` fails

**Error:** "Cannot find type [Security.Cryptography.RandomNumberGenerator]"

**Solution:** This script requires PowerShell 5.1+ or PowerShell Core 7+. Check version:
```powershell
$PSVersionTable.PSVersion
```

**Alternative:** Generate manually using OpenSSL:
```bash
openssl rand -hex 32
```

---

### `verify-deployment.ps1` all tests fail

**Common Causes:**
1. **Backend not deployed yet** - Wait for Railway build to complete
2. **Wrong URL format** - Use HTTPS URL from Railway (e.g., `https://app.railway.app`, not `http://`)
3. **Network/firewall issue** - Check if you can access the URL in browser

**Debug Steps:**
```powershell
# Test basic connectivity
curl https://your-app-name.up.railway.app/health

# Check Railway logs
# Railway dashboard → Service → View Logs
```

---

### `railway-post-deploy.sh` database connection fails

**Error:** "Database connection failed"

**Causes:**
1. **DATABASE_URL not set** - Check Railway Variables
2. **Database not created** - Create Railway PostgreSQL service
3. **Connection string wrong** - Verify format: `postgresql://user:password@host:port/database`

**Solution:**
```bash
# Test database connection manually
uv run python -c "from src.config.database import engine; print(engine)"

# Check environment variable
echo $DATABASE_URL
```

---

### Authentication test fails with 401

**This is expected** if you haven't run `railway-post-deploy.sh` yet.

**Solution:**
1. Run post-deployment script in Railway shell
2. Verify seed data loaded: `SELECT * FROM users;`
3. Re-run verification script

---

## Security Notes

### Secret Management

**DO:**
- ✅ Generate new secrets for each environment (dev, staging, production)
- ✅ Store secrets in Railway Variables (encrypted at rest)
- ✅ Rotate secrets every 90 days
- ✅ Use different secrets for different projects

**DON'T:**
- ❌ Commit secrets to Git (even in `.env.example`)
- ❌ Share secrets via email, Slack, or other channels
- ❌ Reuse secrets across environments
- ❌ Use weak/predictable secrets (like "secret123")

### Secret Rotation

When rotating JWT_SECRET_KEY:
1. Generate new secret with `generate-secrets.ps1`
2. Update Railway Variables with new secret
3. Railway auto-redeploys
4. All active users will be logged out (expected behavior)
5. Users re-login with new tokens

**Frequency:** Every 90 days or immediately if compromised.

---

## Integration with CI/CD

These scripts can be integrated into GitHub Actions for automated deployment verification.

**Example `.github/workflows/deploy.yml`:**
```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Railway deployment happens automatically
      # Wait for deployment to complete
      - name: Wait for deployment
        run: sleep 60

      # Verify deployment
      - name: Verify deployment
        run: |
          curl -f https://your-app-name.up.railway.app/health || exit 1
```

---

## Additional Resources

- **Main Deployment Guide:** `RAILWAY_DEPLOYMENT.md`
- **Security Configuration:** `PRODUCTION_SECURITY.md`
- **Security Verification:** `SECURITY_VERIFICATION.md`
- **Railway Documentation:** https://docs.railway.app

---

**Status:** 🛠️ Helper Scripts Ready

These scripts streamline the deployment process and reduce the chance of configuration errors. Use them as part of your deployment workflow.
