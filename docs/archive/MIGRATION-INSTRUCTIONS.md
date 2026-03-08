# Database Migration to Supabase - Manual Import Instructions

## ✅ Backups Created

Your database has been successfully exported:

- **Schema**: `backup/schema_20260117_110522.sql` (69 KB)
- **Data**: `backup/data_20260117_110545.sql` (3.1 MB)

## 🔧 Migration Method: Supabase SQL Editor

Since direct connection from your local machine isn't working (network/DNS issue), use the Supabase SQL Editor:

### Step 1: Import Schema

1. **Open Supabase SQL Editor**:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new

2. **Open the schema file**: `C:\CCW-Online ERP\backup\schema_20260117_110522.sql`

3. **Copy ALL contents** of the schema file

4. **Paste into SQL Editor**

5. **Click "Run"** button (or press Ctrl+Enter)

6. **Wait for completion** - Should see: "Success. No rows returned"

### Step 2: Import Data

1. **Open the data file**: `C:\CCW-Online ERP\backup\data_20260117_110545.sql`

2. **Copy ALL contents** of the data file (it's 3.1 MB, might take a moment)

3. **In same SQL Editor**, clear previous query and **paste the data SQL**

4. **Click "Run"** button

5. **Wait for completion** - This may take 30-60 seconds due to size

### Step 3: Verify Import

Run this query in SQL Editor to verify:

```sql
-- Check tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check row counts
SELECT
    'organizations' as table_name, COUNT(*) as rows FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'quotes', COUNT(*) FROM quotes;
```

Expected results:
- Should see 18+ tables listed
- Should see data in organizations, users, products, customers, etc.

---

## 🚀 Alternative: Import from Different Machine/Network

If you have access to another machine with better network connectivity:

### Windows PowerShell:
```powershell
$env:PGPASSWORD="lIEI5gV4OkSV5WV3"
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f backup/schema_20260117_110522.sql
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f backup/data_20260117_110545.sql
```

### Linux/Mac:
```bash
export PGPASSWORD="lIEI5gV4OkSV5WV3"
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f backup/schema_20260117_110522.sql
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f backup/data_20260117_110545.sql
```

---

## 🔍 Tables Being Migrated

Your CCW-ERP database includes:

**Core Tables:**
- organizations
- users
- products
- customers
- orders
- order_items
- quotes
- quote_items
- payments

**Additional Tables:**
- conversation_history
- agent_executions
- ai_generated_content
- learning_patterns
- learning_insights
- prompt_variants
- xero_connections
- carrier_configurations
- purchase_orders

**Total:** 18 tables + data

---

## ⚠️ Network Issue Details

Your local machine is experiencing:
- **Issue**: Cannot resolve/connect to `db.vwfgksqkajnpfjospbpe.supabase.co`
- **Cause**: DNS resolving to IPv6 only, or local network restrictions
- **Impact**: Direct psql/Python connections fail from this machine

**This is normal** and doesn't affect:
- ✅ Supabase SQL Editor (works via browser)
- ✅ Production deployments (Vercel/Railway have proper connectivity)
- ✅ API calls from your application once deployed

---

## ✅ After Migration

Once you've imported the schema and data:

1. **Verify in Supabase Dashboard**:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/database/tables

2. **Set up Row Level Security (RLS)**:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/auth/policies

3. **Test your application** with production config:
   ```bash
   $env:NODE_ENV="production"
   pnpm dev
   ```

4. **Deploy to production**:
   - Frontend: Vercel
   - Backend: Railway

---

## 📞 Need Help?

If you encounter issues:
1. Check Supabase SQL Editor query results for errors
2. Review backup files to ensure they're not corrupted
3. Check Supabase dashboard for database status
4. Try from a different network/machine

---

**Backup Location:** `C:\CCW-Online ERP\backup\`
**Created:** 2026-01-17 11:05
