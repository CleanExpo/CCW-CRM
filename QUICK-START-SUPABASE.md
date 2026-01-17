# 🚀 Quick Start: Supabase Setup (5 Minutes)

## Prerequisites
- ✅ Supabase account (you're already logged in)
- ✅ Supabase project created: **CCWiCRM-ERP**
- ✅ PowerShell (Windows) or Terminal (Mac/Linux)

---

## 3-Step Setup

### Step 1: Configure Credentials (2 minutes)

Run the automated configuration script:

```powershell
.\scripts\configure-supabase.ps1
```

**What it does:**
- Opens Supabase dashboard in your browser
- Prompts you to paste your API keys
- Prompts you to paste your database password
- Automatically updates all environment files
- Generates a secure JWT secret

**What you need to copy:**
1. **Anon Key**: From https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy
2. **Service Role Key**: Click "Reveal" on the same page
3. **Database Password**: From https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/database (click "Reset database password")

---

### Step 2: Test Connection (1 minute)

Verify your configuration works:

```powershell
.\scripts\test-supabase-connection.ps1
```

**Expected Output:**
```
✓ Database URL is configured for Supabase
✓ Using connection pooling (port 6543)
✓ Connected successfully!
✓ PostgreSQL version: PostgreSQL 15.x...
✓ Found X tables in public schema
✓ All Tests Passed!
```

---

### Step 3: Migrate Database (2 minutes)

Transfer your schema and data to Supabase:

```powershell
.\scripts\migrate-to-supabase.ps1
```

**What it does:**
- Exports schema from your local PostgreSQL
- Optionally exports data
- Imports everything to Supabase
- Creates backup files

**Note:** If you don't have `psql` installed, the script will show you how to use the Supabase SQL Editor instead.

---

## ✅ Setup Complete!

You're now ready to:
1. Run your app with Supabase: `NODE_ENV=production pnpm dev`
2. Deploy to production (Vercel + Railway)
3. Set up Row Level Security in Supabase

---

## Troubleshooting

### Connection Failed?
- ✅ Verify your database password is correct
- ✅ Check Supabase dashboard for IP restrictions
- ✅ Try direct connection (port 5432) instead of pooling (port 6543)

### Import Failed?
- ✅ Tables may already exist (this is OK)
- ✅ Use Supabase SQL Editor for manual import
- ✅ Check database logs in Supabase dashboard

### Script Won't Run?
- ✅ Run PowerShell as Administrator
- ✅ Enable script execution: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

## Files Created

✅ **Configuration:**
- `.env.production` - Root production config
- `apps/backend/.env.production` - Backend config
- `apps/web/.env.production.local` - Frontend config

✅ **Scripts:**
- `scripts/configure-supabase.ps1` - Setup wizard
- `scripts/test-supabase-connection.ps1` - Connection test
- `scripts/migrate-to-supabase.ps1` - Database migration

✅ **Documentation:**
- `SUPABASE_SETUP.md` - Comprehensive guide
- `QUICK-START-SUPABASE.md` - This file

---

## Quick Reference

### Your Supabase Project

| Item | Value |
|------|-------|
| **Project Name** | CCWiCRM-ERP |
| **Organization** | CCW-Online-ERP-CRM |
| **Project Ref** | `vwfgksqkajnpfjospbpe` |
| **Project URL** | https://vwfgksqkajnpfjospbpe.supabase.co |
| **Region** | ap-southeast-2 (Sydney) |

### Important URLs

- **Dashboard**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe
- **API Keys**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy
- **Database**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/database
- **SQL Editor**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new
- **Tables**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/database/tables

### Connection Strings

```bash
# Production (Pooled - Recommended)
postgresql://postgres:YOUR_PASSWORD@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true

# Direct (For migrations)
postgresql://postgres:YOUR_PASSWORD@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres
```

---

## Development vs Production

### Development (Local PostgreSQL)
```bash
# Uses local Docker PostgreSQL
pnpm dev
```

### Production (Supabase)
```bash
# Uses Supabase PostgreSQL
NODE_ENV=production pnpm dev
```

---

## Security Reminders

⚠️ **NEVER commit these files to Git:**
- `.env.production`
- `.env.production.local`
- `apps/backend/.env.production`

⚠️ **NEVER expose in client code:**
- `SUPABASE_SERVICE_ROLE_KEY`
- Database password
- JWT secret

✅ **Safe to use in client:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Need Help?

- **Detailed Guide**: See `SUPABASE_SETUP.md`
- **Supabase Docs**: https://supabase.com/docs
- **Project Status**: Check Supabase dashboard for logs and metrics

---

**Setup completed**: 2026-01-17
**Next**: Deploy to production! 🚀
