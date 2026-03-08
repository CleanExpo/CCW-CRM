# Supabase Database Import Guide

## Status Summary

Your local machine has DNS/network connectivity issues preventing direct psql or programmatic connections to Supabase. However, **browser-based import via the Supabase SQL Editor works fine**.

## Files Ready for Import

✅ **Schema**: `C:\CCW-Online ERP\backup\schema_final.sql` (2,557 lines, ~69KB)
✅ **Data**: `C:\CCW-Online ERP\backup\data_20260117_110545.sql` (~3.1MB)

## Step-by-Step Manual Import Process

### Step 1: Import Schema

1. Open the schema file in a text editor (Notepad, VS Code, etc.):
   ```
   C:\CCW-Online ERP\backup\schema_final.sql
   ```

2. **Select All** content (Ctrl+A) and **Copy** (Ctrl+C)

3. Open a new SQL Editor tab in Supabase:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new

4. **Paste** the entire schema SQL (Ctrl+V) into the editor

5. Click the green **"Run"** button (or press Ctrl+Enter)

6. Wait for execution to complete. You should see:
   - Multiple "Success" messages or
   - "Success. No rows returned" (this is normal for DDL statements)

7. **Verify** the schema was imported by going to:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/database/tables

   You should see approximately 40 tables listed.

### Step 2: Import Data

1. Open the data file in a text editor:
   ```
   C:\CCW-Online ERP\backup\data_20260117_110545.sql
   ```

2. **Select All** content (Ctrl+A) and **Copy** (Ctrl+C)

3. Return to the Supabase SQL Editor:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql/new

4. Clear the previous query and **Paste** the data SQL (Ctrl+V)

5. Click **"Run"** button

6. Wait for execution (may take 30-60 seconds due to file size)

7. **Verify** data was imported by running this query in SQL Editor:
   ```sql
   SELECT
       'organizations' as table_name, COUNT(*) as row_count FROM organizations
   UNION ALL SELECT 'users', COUNT(*) FROM users
   UNION ALL SELECT 'products', COUNT(*) FROM products
   UNION ALL SELECT 'customers', COUNT(*) FROM customers
   UNION ALL SELECT 'orders', COUNT(*) FROM orders
   UNION ALL SELECT 'quotes', COUNT(*) FROM quotes;
   ```

   You should see data in each table.

## Alternative: Import from Different Machine/Network

If you have access to another computer with better network connectivity (work laptop, cloud VM, etc.):

### Windows PowerShell:
```powershell
$env:PGPASSWORD="lIEI5gV4OkSV5WV3"
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f "C:\CCW-Online ERP\backup\schema_final.sql"
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f "C:\CCW-Online ERP\backup\data_20260117_110545.sql"
```

### Linux/Mac:
```bash
export PGPASSWORD="lIEI5gV4OkSV5WV3"
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f backup/schema_final.sql
psql "postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres" -f backup/data_20260117_110545.sql
```

## Troubleshooting

### Issue: "No tables appear after running schema"
- **Solution**: Make sure you copied the **entire** schema_final.sql file (2,557 lines)
- Verify you didn't accidentally copy schema_20260117_110522.sql (has `\restrict` errors)

### Issue: "Query timeout or browser hangs"
- **Solution**: The file might be too large for browser editor
- Try splitting the data file into smaller chunks or use the alternative machine method

### Issue: "Foreign key constraint errors during data import"
- **Solution**: This shouldn't happen if schema was imported first, but if it does:
  1. Import schema again to ensure all tables exist
  2. Check that all tables have primary keys defined

## Network Issue Details

Your local machine experiences:
- DNS resolution issues with `db.vwfgksqkajnpfjospbpe.supabase.co`
- Cannot establish direct PostgreSQL connections (port 5432)
- Connection pooler authentication errors (port 6543)

This does **NOT** affect:
- ✅ Supabase SQL Editor (browser-based)
- ✅ Production deployments (Vercel/Railway)
- ✅ API calls from your application once deployed

## After Successful Import

1. **Set up Row Level Security (RLS)**:
   https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/auth/policies

2. **Test your application** with production config:
   ```powershell
   $env:NODE_ENV="production"
   pnpm dev
   ```

3. **Deploy to production**:
   - Frontend: Vercel
   - Backend: Railway

## Database Connection String

For your application configuration:

```env
# .env.production
DATABASE_URL=postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres

# Connection pooler (for app runtime)
SUPABASE_DB_URL=postgresql://postgres.vwfgksqkajnpfjospbpe:lIEI5gV4OkSV5WV3@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

---

**Need Help?** Check the SQL Editor query results for specific error messages and refer to Supabase documentation: https://supabase.com/docs/guides/database
