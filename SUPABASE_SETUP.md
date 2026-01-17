# Supabase Production Setup Guide

This guide will help you finalize the Supabase integration for your CCW-Online ERP project.

## Project Information

- **Supabase Organization**: CCW-Online-ERP-CRM
- **Project Name**: CCWiCRM-ERP
- **Project Reference**: `vwfgksqkajnpfjospbpe`
- **Project URL**: `https://vwfgksqkajnpfjospbpe.supabase.co`

## Current Status

✅ **Completed**:
- Supabase project created
- Project identified in your dashboard
- Environment file templates created
- Configuration structure prepared

🔧 **Remaining Steps**:
1. Get Supabase API keys
2. Set/retrieve database password
3. Update environment files
4. Test connection
5. Deploy to production

---

## Step 1: Get Supabase API Keys

### 1.1 Navigate to API Keys Page
Go to: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy

### 1.2 Copy Your Keys
You'll see two keys on this page:

**A. Anon Key (Public)**
- Label: `anon public`
- This key is safe to use in your frontend
- Copy the entire key (starts with `eyJ...`)
- Save it for later

**B. Service Role Key (Secret)**
- Label: `service_role secret`
- Click the "Reveal" button to show the key
- Copy the entire key (starts with `eyJ...`)
- ⚠️ **NEVER expose this key in client-side code!**

---

## Step 2: Get Database Password

### 2.1 Navigate to Database Settings
Go to: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/database

### 2.2 Set/View Password
- Click the "Reset database password" button
- **Option A**: Let Supabase generate a strong password
  - Click "Generate password"
  - Copy the generated password
- **Option B**: Set your own password
  - Enter a strong password
  - Save it securely

---

## Step 3: Update Environment Files

You have three environment files to update:

### 3.1 Root Production Environment
**File**: `.env.production`

Replace the following placeholders:
```bash
# Supabase Keys
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste your anon key here>
SUPABASE_SERVICE_ROLE_KEY=<paste your service_role key here>

# Database Password
DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true

# JWT Secret (generate a new one)
JWT_SECRET_KEY=<run: openssl rand -base64 32>

# Backend API Key (generate a new one)
BACKEND_API_KEY=<generate a random key>

# Other Services (optional)
ANTHROPIC_API_KEY=<your anthropic key>
SENDGRID_API_KEY=<your sendgrid key>
```

### 3.2 Backend Production Environment
**File**: `apps/backend/.env.production` (copy from `.env.production.example`)

```bash
cp apps/backend/.env.production.example apps/backend/.env.production
```

Then update:
```bash
# Database
DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true

# Supabase Keys
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>

# Security
JWT_SECRET_KEY=<same as root>
```

### 3.3 Frontend Production Environment
**File**: `apps/web/.env.production.local` (copy from `.env.production.local.example`)

```bash
cp apps/web/.env.production.local.example apps/web/.env.production.local
```

Then update:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>

# Backend URL (update when you deploy backend)
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.railway.app

# Frontend URL (update when you deploy)
NEXT_PUBLIC_FRONTEND_URL=https://ccw-erp.vercel.app
```

---

## Step 4: Test Connection (Local with Production DB)

### 4.1 Test Backend Connection
```bash
cd apps/backend

# Update .env to use production database temporarily
# Or create .env.test with production DATABASE_URL

# Test connection
uv run python -c "from src.config.database import get_database_url; print(get_database_url())"

# Run a simple query
uv run python -c "
from src.config.database import sync_engine
from sqlalchemy import text
with sync_engine.connect() as conn:
    result = conn.execute(text('SELECT version()'))
    print(result.scalar())
"
```

### 4.2 Test API Keys
```bash
# Test if keys work with Supabase client
curl -X GET 'https://vwfgksqkajnpfjospbpe.supabase.co/rest/v1/' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## Step 5: Database Migration

### 5.1 Check Current Schema
Your local PostgreSQL has the following tables:
- organizations
- users
- products
- customers
- orders
- order_items
- quotes
- quote_items

### 5.2 Migrate Schema to Supabase
You have two options:

**Option A: Export/Import SQL**
```bash
# Export schema from local
docker exec nodejs-starter-postgres pg_dump -U starter_user -d starter_db --schema-only > schema.sql

# Import to Supabase (get connection string from dashboard)
psql "postgresql://postgres:YOUR_PASSWORD@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" < schema.sql
```

**Option B: Use Alembic/Migrations**
```bash
cd apps/backend

# Update DATABASE_URL in .env to point to Supabase
# Run migrations
uv run alembic upgrade head
```

### 5.3 Migrate Data (Optional)
If you have demo data to migrate:
```bash
# Export data
docker exec nodejs-starter-postgres pg_dump -U starter_user -d starter_db --data-only > data.sql

# Import to Supabase
psql "postgresql://postgres:YOUR_PASSWORD@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" < data.sql
```

---

## Step 6: Configure Supabase Features

### 6.1 Enable Row Level Security (RLS)
Go to: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/auth/policies

For each table, create RLS policies to secure your data.

### 6.2 Set up Authentication
Go to: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/auth/providers

Configure auth providers if needed (Google, GitHub, etc.)

### 6.3 Configure Storage (if needed)
Go to: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/storage/buckets

Create buckets for file uploads (product images, documents, etc.)

---

## Step 7: Update Application Code

### 7.1 Database Configuration
The `apps/backend/src/config/database.py` is already configured to read from `DATABASE_URL`.
No code changes needed! ✅

### 7.2 Switch Environment
Update your code to use production environment:

**Development** (local PostgreSQL):
```bash
pnpm dev  # Uses .env with local DATABASE_URL
```

**Production** (Supabase):
```bash
NODE_ENV=production pnpm dev  # Uses .env.production
```

---

## Step 8: Deploy to Production

### 8.1 Backend Deployment (Railway)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Add environment variables
railway variables set DATABASE_URL="postgresql://postgres:PASSWORD@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true"
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://vwfgksqkajnpfjospbpe.supabase.co"
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Deploy
railway up
```

### 8.2 Frontend Deployment (Vercel)
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_BACKEND_URL production
```

---

## Troubleshooting

### Connection Issues

**Error: "password authentication failed"**
- Solution: Reset your database password in Supabase dashboard
- Verify you're using the correct password in `DATABASE_URL`

**Error: "too many connections"**
- Solution: Use connection pooling (port 6543) instead of direct connection (port 5432)
- Update DATABASE_URL to use `?pgbouncer=true`

**Error: "SSL required"**
- Solution: Add `?sslmode=require` to your DATABASE_URL
- Example: `postgresql://postgres:pass@host:5432/db?sslmode=require`

### API Key Issues

**Error: "Invalid API key"**
- Solution: Regenerate keys in Supabase dashboard
- Make sure you're using the full key (starts with `eyJ...`)
- Check for extra spaces or newlines when copying

### Migration Issues

**Error: "relation already exists"**
- Solution: Your schema may already exist in Supabase
- Check existing tables: `psql "postgresql://..." -c "\dt"`
- Drop conflicting tables or modify migration

---

## Security Checklist

Before going to production, verify:

- [ ] Strong database password set
- [ ] JWT secret key is random and strong (32+ bytes)
- [ ] Service role key is NEVER used in client-side code
- [ ] Row Level Security (RLS) enabled on all tables
- [ ] CORS origins restricted to your production domains
- [ ] Secure cookies enabled (`SECURE_COOKIES=true`)
- [ ] Rate limiting enabled (`RATE_LIMIT_ENABLED=true`)
- [ ] Environment files added to `.gitignore`
- [ ] SSL enforcement enabled in Supabase dashboard

---

## Next Steps

1. **Complete this setup guide** (Steps 1-8)
2. **Test thoroughly** in development environment
3. **Set up CI/CD** for automated deployments
4. **Monitor** your Supabase usage and performance
5. **Set up backups** (Supabase auto-backups are enabled on Pro plan)

---

## Quick Reference

**Supabase Dashboard URLs:**
- Project Home: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe
- API Keys: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy
- Database: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/database
- SQL Editor: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new
- Logs: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/logs/explorer

**Connection Strings:**
```bash
# Pooled (Recommended for production)
postgresql://postgres:[PASSWORD]@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true

# Direct (For migrations and admin tasks)
postgresql://postgres:[PASSWORD]@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres
```

**Project Details:**
- Project Ref: `vwfgksqkajnpfjospbpe`
- Region: `ap-southeast-2` (Sydney)
- Plan: Free (can upgrade to Pro for production)

---

## Support

If you encounter issues:
1. Check Supabase documentation: https://supabase.com/docs
2. Check project logs in Supabase dashboard
3. Review this guide's troubleshooting section
4. Contact Supabase support: support@supabase.com

---

Generated: 2026-01-17
