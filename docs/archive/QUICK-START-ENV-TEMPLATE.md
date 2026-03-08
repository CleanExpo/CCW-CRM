# Quick Start: Create .env.production File

**Estimated Time**: 20 minutes
**Goal**: Create production environment configuration

---

## Step 1: Copy the Template

```bash
# From project root
cp .env.production.example .env.production
```

---

## Step 2: Fill in REQUIRED Values (Minimum for Deployment)

Open `.env.production` in your editor and fill in these **8 critical values**:

### 1. Database URL (from Task 4 - Supabase)

```bash
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@db.abcdefghijk.supabase.co:5432/postgres
```

**Replace with your actual Supabase connection string**

**IMPORTANT**: Change `postgresql://` to `postgresql+asyncpg://` (add `+asyncpg`)

---

### 2. JWT Secret Key (generate now)

```bash
# Run this command to generate:
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copy the output and paste into `.env.production`:

```bash
JWT_SECRET_KEY=YOUR_GENERATED_SECRET_HERE
```

---

### 3. Encryption Key (generate now)

```bash
# Run this command:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output and paste:

```bash
ENCRYPTION_KEY=YOUR_GENERATED_KEY_HERE
```

---

### 4. Sentry DSN - Backend (from Task 3)

```bash
SENTRY_DSN=https://abc123...@o123456.ingest.sentry.io/7890123
```

**Paste your backend Sentry DSN**

---

### 5. Sentry DSN - Frontend (from Task 3)

```bash
NEXT_PUBLIC_SENTRY_DSN=https://def456...@o123456.ingest.sentry.io/7890456
```

**Paste your frontend Sentry DSN**

---

### 6. CORS Origins (update after deployment)

```bash
# For now, use localhost for testing:
CORS_ORIGINS=http://localhost:3000

# After deployment, update to:
# CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

### 7. API URL (update after backend deployment)

```bash
# For now, keep as:
NEXT_PUBLIC_API_URL=http://localhost:8000

# After deploying backend to Railway, update to:
# NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

### 8. SendGrid API Key (OPTIONAL for Quick Start)

If you want to send emails immediately:

1. Sign up at https://sendgrid.com/ (free tier: 100 emails/day)
2. Go to Settings > API Keys
3. Create API Key with "Mail Send" permission
4. Copy the key and paste:

```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@your-domain.com
SENDGRID_FROM_NAME=CCW Equipment ERP
```

**If you skip this**: Emails won't send, but system will still work.

---

## Step 3: Leave Other Values as Default (For Now)

These can stay as-is or be filled in later:

```bash
# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# JWT Settings (defaults are fine)
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
JWT_REFRESH_EXPIRE_DAYS=30

# Database Pool (defaults are fine)
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis (optional - can add later)
# REDIS_URL=redis://localhost:6379/0

# Xero (optional - configure when integrating)
# XERO_CLIENT_ID=
# XERO_CLIENT_SECRET=

# Security (defaults are production-ready)
SECURE_COOKIES=true
RATE_LIMIT_ENABLED=true

# Prometheus (enabled by default)
PROMETHEUS_ENABLED=true

# Sentry Settings (defaults are fine)
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_RELEASE=ccw-erp@1.0.0

# AWS (optional - skip for now)
# USE_AWS_SECRETS=false
```

---

## Step 4: Verify Your .env.production File

Your minimal `.env.production` should have these filled in:

```bash
# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# JWT
JWT_SECRET_KEY=[your-generated-secret]
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=480
JWT_REFRESH_EXPIRE_DAYS=30

# Encryption
ENCRYPTION_KEY=[your-generated-key]

# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@db.xyz.supabase.co:5432/postgres
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Security
SECURE_COOKIES=true
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_ENABLED=true

# Monitoring
SENTRY_DSN=https://abc@o123.ingest.sentry.io/789
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_RELEASE=ccw-erp@1.0.0
PROMETHEUS_ENABLED=true

# Frontend (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SENTRY_DSN=https://def@o123.ingest.sentry.io/456

# Email (Optional)
# SENDGRID_API_KEY=SG.xxx
# SENDGRID_FROM_EMAIL=noreply@your-domain.com
# SENDGRID_FROM_NAME=CCW Equipment ERP
```

---

## Step 5: Test Locally (Optional but Recommended)

Before deploying, test that your configuration works:

```bash
# Start local services with production config
docker-compose down
docker-compose up -d postgres redis

# Load production env
export $(cat .env.production | grep -v '^#' | xargs)

# Run backend
cd apps/backend
uv run uvicorn src.api.main:app --reload

# In another terminal, run frontend
cd apps/web
pnpm dev

# Test login at http://localhost:3000
# Credentials: admin@demo.com / demo123
```

**If login works** ✅: Your configuration is correct!

**If errors** ❌: Check logs and verify all values are correct

---

## Security Checklist ⚠️

Before deployment, ensure:

- [ ] ✅ Generated NEW secrets (don't reuse from .env.development)
- [ ] ✅ JWT_SECRET_KEY is at least 32 characters
- [ ] ✅ ENCRYPTION_KEY is a valid Fernet key
- [ ] ✅ Database password is strong (if you set it manually)
- [ ] ✅ `.env.production` is in `.gitignore` (it should be already)
- [ ] ❌ NEVER commit `.env.production` to Git
- [ ] ❌ NEVER share secrets in Slack, email, or screenshots

---

## What's Next?

Once your `.env.production` is complete:

1. ✅ Quick Start is DONE! (3 hours complete)
2. 🚀 Ready for Week 1: Infrastructure & Deployment
3. 📋 Follow `PRODUCTION-DEPLOYMENT-GUIDE.md` for next steps

---

## Troubleshooting

### Issue: "cryptography module not found"

```bash
# Install cryptography package
pip install cryptography

# Or with uv:
cd apps/backend
uv pip install cryptography
```

### Issue: "Invalid Fernet key"

The encryption key must be exactly 44 characters and end with `=`:

```bash
# Regenerate:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Example valid key: `1234567890abcdefghijklmnopqrstuvwxyzABCD=`

### Issue: "Database connection failed"

Check:
1. Connection string has `+asyncpg` (not just `postgresql://`)
2. Password is correct (no special characters that need escaping)
3. Host is reachable (try `ping db.xyz.supabase.co`)
4. Supabase project is running (check dashboard)

### Issue: "CORS error in browser"

Update `CORS_ORIGINS` to include your frontend URL:

```bash
# For local testing:
CORS_ORIGINS=http://localhost:3000

# For production:
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

**Time to complete**: 20 minutes
**Output**: `.env.production` file ready for deployment
**Next**: Deploy to Railway/Vercel (Week 1, Days 6-7)
