# Supabase Migration - Quick Start Guide

**Status**: 85% Complete - Manual Data Import Required
**Estimated Time**: 15-20 minutes to complete

---

## ✅ What's Already Done

1. **Schema Imported**: All 31 tables created in Supabase
2. **Data Exported**: 5 chunks ready to import (445KB-910KB each)
3. **Environment Configured**: All `.env` files updated with:
   - ✅ Supabase URLs and API keys
   - ✅ Database connection strings (with password)
   - ✅ JWT secret keys (freshly generated)
   - ✅ Backend API keys
4. **Scripts Created**:
   - ✅ Automated PowerShell import script
   - ✅ Python direct import script
   - ✅ Connection test scripts

---

## 📋 Remaining Steps

### Step 1: Import Data to Supabase (15-20 minutes)

**Why Manual?**: Local machine has DNS issues preventing direct `psql` connection. Browser-based SQL Editor is the only reliable method.

#### Option A: Fully Automated PowerShell (Recommended)

1. **Open SQL Editor** in your browser:
   ```
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql
   ```

2. **Click in the SQL Editor** to make it the active window

3. **Run the automation script**:
   ```powershell
   cd "C:\CCW-Online ERP"
   .\scripts\auto-import-no-prompts.ps1
   ```

4. **Wait for completion**: Script will automatically:
   - Copy each chunk to clipboard
   - Paste into SQL Editor
   - Execute the query
   - Wait for completion
   - Move to next chunk

**Expected Time**: 15-20 minutes (automated)

#### Option B: Manual Import (Alternative)

If the PowerShell script doesn't work, import each chunk manually:

```powershell
# Navigate to backup directory
cd "C:\CCW-Online ERP\backup"

# For EACH chunk (aa, ab, ac, ad, ae):

# 1. Copy chunk to clipboard
powershell -Command "Get-Content 'data_chunk_aa' -Raw | Set-Clipboard"

# 2. In SQL Editor:
#    - Ctrl+A (select all)
#    - Ctrl+V (paste)
#    - Ctrl+Enter (run)
#    - Wait 2-4 minutes for "Success" message

# 3. Repeat for chunks ab, ac, ad, ae
```

#### Verify Data Import

After all 5 chunks imported, run this query in SQL Editor:

```sql
SELECT
    'organizations' as table_name, COUNT(*) as row_count FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'quotes', COUNT(*) FROM quotes
UNION ALL SELECT 'quote_items', COUNT(*) FROM quote_items
ORDER BY table_name;
```

**Expected**: All tables show `row_count > 0`

---

### Step 2: Test Application (5 minutes)

Once data is imported, test that everything works:

#### 2.1 Start Backend

```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload
```

**Expected**: No database connection errors, starts on http://localhost:8000

#### 2.2 Start Frontend

```bash
cd apps/web
pnpm dev
```

**Expected**: Starts on http://localhost:3000

#### 2.3 Test Login

1. Navigate to: http://localhost:3000/login
2. Login with: `admin@demo.com` / `demo123`
3. Verify dashboard loads

#### 2.4 Test CRUD Operations

- **Products**: http://localhost:3000/products
  - Verify list loads from Supabase
  - Try creating a new product
  - Try editing a product
  - Try deleting a product (with confirmation)

- **Customers**: http://localhost:3000/customers
  - Same CRUD tests

- **Orders**: http://localhost:3000/orders
  - Same CRUD tests

- **Quotes**: http://localhost:3000/quotes
  - Same CRUD tests

**Expected**: All operations work, data persists to Supabase

---

### Step 3: Run Quality Checks (2 minutes)

```bash
# From project root
pnpm turbo run type-check lint
```

**Expected**: No errors

---

## 🎯 Success Criteria

You're done when:
- [ ] All 5 data chunks imported successfully
- [ ] Verification query shows data in all tables
- [ ] Backend starts without database connection errors
- [ ] Frontend starts and loads login page
- [ ] Can login with test credentials
- [ ] Can view and edit data in all modules
- [ ] Type check and lint pass

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `SUPABASE-MIGRATION-SPEC.md` | Complete migration documentation |
| `MIGRATION-QUICK-START.md` | This quick-start guide |
| `scripts/auto-import-no-prompts.ps1` | Automated import script |
| `backup/data_chunk_*` | Data files to import (5 chunks) |
| `.env.production` | Root production environment |
| `apps/backend/.env.production` | Backend environment |
| `apps/web/.env.production.local` | Frontend environment |

---

## 🔧 Troubleshooting

### Problem: Import fails with "relation does not exist"

**Solution**: Schema not imported. Verify tables exist:
```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
```
Expected: 31 tables

### Problem: Import hangs or times out

**Solution**:
- Wait longer (chunks can take 3-5 minutes, especially chunk AC)
- Refresh browser and try again
- Ensure SQL Editor tab is active

### Problem: "password authentication failed"

**Solution**: Database password incorrect. Verify in `.env` files:
```
DATABASE_URL=postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres
```

### Problem: Login fails

**Solution**:
- Verify users table has data: `SELECT COUNT(*) FROM users`
- Re-import chunk AA (contains users table)
- Check JWT_SECRET_KEY matches in all `.env` files

### Problem: CRUD operations fail

**Solution**:
- Check backend logs for errors
- Verify DATABASE_URL in backend `.env.production`
- Test API directly: `curl http://localhost:8000/api/products`

---

## 📊 Environment Configuration Summary

All environment files are **fully configured** with:

### Supabase Connection
- **Project URL**: `https://vwfgksqkajnpfjospbpe.supabase.co`
- **Database**: `postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres`
- **Anon Key**: `eyJhbGci...` (configured)
- **Service Role Key**: `eyJhbGci...` (configured)

### Security Keys (Freshly Generated)
- **JWT_SECRET_KEY**: `ipFYeie5PsKPtDxhdbGVZuPgGh2xj52keiu/LPgLjQM=`
- **BACKEND_API_KEY**: `iGxtBP6XOUywt1k8TFTgaI91wbtJQyFHB5iUlITBel0=`

### Test Credentials
- **Admin**: admin@demo.com / demo123
- **Sales**: sales@demo.com / demo123
- **Warehouse**: warehouse@demo.com / demo123

---

## 🚀 Next Steps After Migration

Once everything is working locally:

1. **Deploy Backend to Railway**
   - See: `SUPABASE-MIGRATION-SPEC.md` Section 6.2

2. **Deploy Frontend to Vercel**
   - See: `SUPABASE-MIGRATION-SPEC.md` Section 6.3

3. **Configure Production URLs**
   - Update `NEXT_PUBLIC_BACKEND_URL` in frontend `.env`
   - Update `CORS_ORIGINS` in backend `.env`

4. **Run Production Smoke Tests**
   - Test all modules in production
   - Verify data loads correctly
   - Check browser console for errors

---

## 📞 Getting Help

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Dashboard**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe
- **SQL Editor**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql
- **Logs**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/logs/explorer

---

**Last Updated**: 2026-01-17
**Migration Progress**: 85% Complete

**Start Here**: Open SQL Editor and run `.\scripts\auto-import-no-prompts.ps1`
