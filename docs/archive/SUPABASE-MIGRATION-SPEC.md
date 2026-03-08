# CCW-Online ERP - Supabase Migration Specification

**Date Created**: 2026-01-17
**Status**: 🔄 IN PROGRESS (70% Complete)
**Migration Type**: PostgreSQL (Docker) → Supabase (Cloud PostgreSQL)

---

## Executive Summary

The CCW-Online ERP project is migrating from local Docker PostgreSQL to Supabase cloud database. This migration enables production deployment, better scalability, and managed database infrastructure.

**Current Progress**: 70% Complete
- ✅ Schema imported successfully (31 tables)
- ✅ Data exported and split into 5 importable chunks
- ⏳ Data import pending (manual process via SQL Editor)
- ⏳ Environment configuration pending
- ⏳ Application testing pending
- ⏳ Production deployment pending

**Estimated Time to Complete**: 1 hour

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Database Migration Status](#2-database-migration-status)
3. [Data Import Procedure](#3-data-import-procedure)
4. [Environment Configuration](#4-environment-configuration)
5. [Testing Checklist](#5-testing-checklist)
6. [Deployment Roadmap](#6-deployment-roadmap)
7. [Rollback Plan](#7-rollback-plan)
8. [Troubleshooting Guide](#8-troubleshooting-guide)

---

## 1. Project Overview

### 1.1 Migration Goals

**Primary Objectives**:
- Migrate from local PostgreSQL to Supabase cloud database
- Enable production deployment (Railway + Vercel)
- Maintain data integrity throughout migration
- Zero downtime for development work

**Success Criteria**:
- [ ] All 31 tables migrated with schema intact
- [ ] All data imported successfully
- [ ] Application connects to Supabase without errors
- [ ] All CRUD operations work correctly
- [ ] Authentication flow works
- [ ] No data loss or corruption

### 1.2 Technical Details

**Source Database**:
- Platform: Docker PostgreSQL 15
- Container: `nodejs-starter-postgres`
- Database: `starter_db`
- User: `starter_user`

**Target Database**:
- Platform: Supabase (Managed PostgreSQL)
- Project: CCWiCRM-ERP
- Reference: `vwfgksqkajnpfjospbpe`
- Region: ap-southeast-2 (Sydney, Australia)
- URL: `https://vwfgksqkajnpfjospbpe.supabase.co`

### 1.3 Migration Constraints

**Why Manual Import Required**:
1. SQL Editor has 2MB file size limit (original data file is 3.1MB)
2. Local machine has DNS resolution issues preventing direct `psql` connection
3. Python scripts fail due to network connectivity issues
4. Browser-based SQL Editor is the only reliable method

**Solution**: Split data into 5 chunks (445KB-910KB each) for manual import

---

## 2. Database Migration Status

### 2.1 Schema Import

**Status**: ✅ COMPLETE

**Tables Created** (31 total):

| Table Name | Purpose | Status |
|------------|---------|--------|
| organizations | Organization/tenant data | ✅ Created |
| users | User accounts | ✅ Created |
| products | Product catalog | ✅ Created |
| customers | Customer directory | ✅ Created |
| orders | Sales orders | ✅ Created |
| order_items | Order line items | ✅ Created |
| quotes | Customer quotes | ✅ Created |
| quote_items | Quote line items | ✅ Created |
| payments | Payment records | ✅ Created |
| invoices | Invoice records | ✅ Created |
| invoice_items | Invoice line items | ✅ Created |
| purchase_orders | Purchase orders | ✅ Created |
| purchase_order_items | PO line items | ✅ Created |
| suppliers | Supplier directory | ✅ Created |
| warehouses | Warehouse locations | ✅ Created |
| inventory_transactions | Inventory movements | ✅ Created |
| stock_levels | Current stock levels | ✅ Created |
| containers | Shipping containers | ✅ Created |
| container_items | Container contents | ✅ Created |
| shipments | Shipment records | ✅ Created |
| shipment_items | Shipment contents | ✅ Created |
| activities | Activity log | ✅ Created |
| notifications | User notifications | ✅ Created |
| documents | Document attachments | ✅ Created |
| tags | Tag system | ✅ Created |
| entity_tags | Tag relationships | ✅ Created |
| settings | System settings | ✅ Created |
| audit_logs | Audit trail | ✅ Created |
| sessions | User sessions | ✅ Created |
| refresh_tokens | JWT refresh tokens | ✅ Created |
| password_resets | Password reset tokens | ✅ Created |

**Verification Query** (run in SQL Editor to confirm):
```sql
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: 31 rows returned

### 2.2 Data Export

**Status**: ✅ COMPLETE

**Backup Files Created**:

| File | Size | Contents | Status |
|------|------|----------|--------|
| `backup/data_chunk_aa` | 445 KB | Organizations, Users, Products (partial) | ✅ Ready |
| `backup/data_chunk_ab` | 512 KB | Products (continued), Customers (partial) | ✅ Ready |
| `backup/data_chunk_ac` | 910 KB | Customers, Orders, Order Items | ✅ Ready |
| `backup/data_chunk_ad` | 777 KB | Quotes, Quote Items, Payments | ✅ Ready |
| `backup/data_chunk_ae` | 481 KB | Remaining tables + relationships | ✅ Ready |

**Total Data Size**: ~3.1 MB (split into 5 chunks for import)

### 2.3 Data Import

**Status**: ⏳ PENDING (Ready to Start)

**Import Order** (CRITICAL - must be done in this sequence):
1. Chunk AA (organizations, users - required for foreign keys)
2. Chunk AB (products, customers)
3. Chunk AC (orders, order_items)
4. Chunk AD (quotes, quote_items, payments)
5. Chunk AE (remaining data)

**Progress Tracking**:
- [ ] Chunk AA imported
- [ ] Chunk AB imported
- [ ] Chunk AC imported
- [ ] Chunk AD imported
- [ ] Chunk AE imported
- [ ] Data verification completed

---

## 3. Data Import Procedure

### 3.1 Prerequisites

**Before Starting**:
- [ ] Browser open to Supabase SQL Editor
- [ ] All 5 chunk files accessible in `C:\CCW-Online ERP\backup\`
- [ ] Notepad or text editor ready
- [ ] Estimated time: 15-20 minutes (3-4 minutes per chunk)

**SQL Editor URL**: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql

### 3.2 Import Process (Detailed Steps)

**For EACH chunk (aa, ab, ac, ad, ae):**

#### Step 1: Prepare Chunk File
```powershell
# Open PowerShell and navigate to backup directory
cd "C:\CCW-Online ERP\backup"

# Copy chunk to clipboard (replace XX with aa, ab, ac, ad, or ae)
powershell -Command "Get-Content 'data_chunk_XX' -Raw | Set-Clipboard"
```

**Alternative**: Open file in Notepad, Select All (Ctrl+A), Copy (Ctrl+C)

#### Step 2: Open SQL Editor
1. Navigate to: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql
2. Wait for editor to load
3. Clear any existing queries in the editor

#### Step 3: Paste and Execute
1. Click in editor window
2. Select All (Ctrl+A) to clear
3. Paste chunk (Ctrl+V)
4. Verify SQL appears in editor
5. Click "Run" button (or press Ctrl+Enter)

#### Step 4: Wait for Completion
- Expected message: "Success. No rows returned" (or similar)
- Expected time: 2-4 minutes per chunk
- **DO NOT** close browser or navigate away during execution
- Larger chunks (AC, AD) may take slightly longer

#### Step 5: Verify Success
Look for success message in SQL Editor output panel:
- ✅ Green checkmark or "Success" message
- ❌ If you see errors, see [Troubleshooting](#8-troubleshooting-guide)

#### Step 6: Move to Next Chunk
Repeat Steps 1-5 for the next chunk in sequence

### 3.3 Quick Command Reference

```powershell
# Navigate to backup directory
cd "C:\CCW-Online ERP\backup"

# Chunk 1 of 5 - Organizations, Users
powershell -Command "Get-Content 'data_chunk_aa' -Raw | Set-Clipboard"
# → Paste in SQL Editor, Run, Wait for success

# Chunk 2 of 5 - Products, Customers (start)
powershell -Command "Get-Content 'data_chunk_ab' -Raw | Set-Clipboard"
# → Paste in SQL Editor, Run, Wait for success

# Chunk 3 of 5 - Customers, Orders
powershell -Command "Get-Content 'data_chunk_ac' -Raw | Set-Clipboard"
# → Paste in SQL Editor, Run, Wait for success

# Chunk 4 of 5 - Quotes, Payments
powershell -Command "Get-Content 'data_chunk_ad' -Raw | Set-Clipboard"
# → Paste in SQL Editor, Run, Wait for success

# Chunk 5 of 5 - Remaining data
powershell -Command "Get-Content 'data_chunk_ae' -Raw | Set-Clipboard"
# → Paste in SQL Editor, Run, Wait for success
```

### 3.4 Data Verification

**After ALL 5 chunks imported**, run this verification query in SQL Editor:

```sql
-- Comprehensive row count verification
SELECT
    'organizations' as table_name, COUNT(*) as row_count FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'quotes', COUNT(*) FROM quotes
UNION ALL SELECT 'quote_items', COUNT(*) FROM quote_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'containers', COUNT(*) FROM containers
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'warehouses', COUNT(*) FROM warehouses
ORDER BY table_name;
```

**Expected Results**:
- All tables show `row_count > 0`
- No tables show `row_count = 0` (indicates import failure)

**Sample Expected Output**:
```
table_name         | row_count
-------------------|----------
organizations      | 1
users              | 5
products           | 150
customers          | 75
orders             | 50
order_items        | 200
quotes             | 30
quote_items        | 120
...
```

### 3.5 Import Completion Checklist

After verification query passes:
- [ ] All 5 chunks imported without errors
- [ ] Verification query shows row counts > 0 for all tables
- [ ] No SQL errors in Supabase logs
- [ ] Update this spec: Mark "Data Import" as ✅ COMPLETE

---

## 4. Environment Configuration

### 4.1 Supabase API Keys

**Status**: ⏳ PENDING

#### Step 1: Navigate to API Keys Page
URL: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy

#### Step 2: Copy API Keys

**Anon Key (Public)**:
- Label: `anon public`
- Safe for frontend use
- Starts with `eyJ...`
- [ ] Copied to secure location

**Service Role Key (Secret)**:
- Label: `service_role secret`
- Click "Reveal" to show
- Starts with `eyJ...`
- ⚠️ **NEVER expose in client code**
- [ ] Copied to secure location

### 4.2 Database Connection String

**Connection String Format**:
```
postgresql://postgres:[PASSWORD]@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true
```

**Password**: `lIEI5gV4OkSV5WV3` (from plan)

**Full Connection String**:
```
postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true
```

**Why Port 6543?**: Uses PgBouncer connection pooling (recommended for production)

**Direct Connection** (for migrations/admin only):
```
postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres
```

### 4.3 Environment Files to Update

#### File 1: Root Production Environment

**File**: `.env.production`
**Status**: ⏳ PENDING

**Values to Add**:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key from Step 4.1>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from Step 4.1>

# Database Connection (Pooled)
DATABASE_URL=postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true

# Security Keys (Generate New)
JWT_SECRET_KEY=<generate via: openssl rand -base64 32>
BACKEND_API_KEY=<generate random string>

# Application URLs (Update after deployment)
NEXT_PUBLIC_FRONTEND_URL=https://ccw-erp.vercel.app
NEXT_PUBLIC_BACKEND_URL=https://ccw-backend.railway.app
```

**Action Items**:
- [ ] Update Supabase URL
- [ ] Paste anon key
- [ ] Paste service_role key
- [ ] Update DATABASE_URL with password
- [ ] Generate JWT_SECRET_KEY
- [ ] Generate BACKEND_API_KEY

#### File 2: Backend Production Environment

**File**: `apps/backend/.env.production`
**Status**: ⏳ PENDING
**Template**: Copy from `apps/backend/.env.production.example`

**Command**:
```powershell
Copy-Item "apps/backend/.env.production.example" "apps/backend/.env.production"
```

**Values to Update**:
```bash
# Database
DATABASE_URL=postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as root .env>
SUPABASE_SERVICE_ROLE_KEY=<same as root .env>

# Security
JWT_SECRET_KEY=<same as root .env>
BACKEND_API_KEY=<same as root .env>
```

**Action Items**:
- [ ] Copy from example file
- [ ] Update DATABASE_URL
- [ ] Update Supabase configuration
- [ ] Update security keys (match root .env)

#### File 3: Frontend Production Environment

**File**: `apps/web/.env.production.local`
**Status**: ⏳ PENDING
**Template**: Copy from `apps/web/.env.production.local.example`

**Command**:
```powershell
Copy-Item "apps/web/.env.production.local.example" "apps/web/.env.production.local"
```

**Values to Update**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as root .env>

# Backend API (Update after Railway deployment)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000  # For local testing
# NEXT_PUBLIC_BACKEND_URL=https://ccw-backend.railway.app  # For production

# Frontend URL
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000  # For local testing
# NEXT_PUBLIC_FRONTEND_URL=https://ccw-erp.vercel.app  # For production
```

**Action Items**:
- [ ] Copy from example file
- [ ] Update Supabase configuration
- [ ] Set NEXT_PUBLIC_BACKEND_URL for local testing
- [ ] (Later) Update URLs after deployment

### 4.4 Generate Security Keys

**JWT Secret Key**:
```powershell
# Windows PowerShell
$bytes = New-Object Byte[] 32
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

**Backend API Key** (any random string):
```powershell
# Windows PowerShell
$bytes = New-Object Byte[] 32
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

**Action Items**:
- [ ] Generate JWT_SECRET_KEY
- [ ] Generate BACKEND_API_KEY
- [ ] Save keys in all environment files

### 4.5 Configuration Completion Checklist

- [ ] All 3 environment files created/updated
- [ ] Supabase API keys added to all files
- [ ] Database connection strings updated
- [ ] Security keys generated and added
- [ ] Files added to `.gitignore` (verify)

---

## 5. Testing Checklist

### 5.1 Database Connection Test

**Status**: ⏳ PENDING

**Script**: `scripts/test-supabase-connection.ps1`

**Run**:
```powershell
.\scripts\test-supabase-connection.ps1
```

**Expected Output**:
```
✅ Connection successful
✅ Tables exist: 31 tables found
✅ Data present: All tables have rows
```

**If Fails**:
- Check DATABASE_URL in environment files
- Verify password is correct
- Check network connectivity
- See [Troubleshooting](#8-troubleshooting-guide)

**Action Items**:
- [ ] Connection test passes
- [ ] Tables verified
- [ ] Data confirmed present

### 5.2 Type Check and Lint

**Status**: ⏳ PENDING

**Commands**:
```bash
# Run from project root
pnpm turbo run type-check
pnpm turbo run lint
```

**Expected**:
- No TypeScript errors
- No ESLint errors
- All checks pass

**Action Items**:
- [ ] Type check passes
- [ ] Lint passes

### 5.3 Application Startup Test

**Status**: ⏳ PENDING

#### Backend Startup

**Terminal 1** (Backend):
```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload
```

**Expected Output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

**Verify**:
- [ ] Backend starts without errors
- [ ] No database connection errors
- [ ] Health check endpoint works: http://localhost:8000/health

#### Frontend Startup

**Terminal 2** (Frontend):
```bash
cd apps/web
pnpm dev
```

**Expected Output**:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
```

**Verify**:
- [ ] Frontend starts without errors
- [ ] No build errors
- [ ] Page loads at http://localhost:3000

### 5.4 Authentication Test

**Status**: ⏳ PENDING

**Test Credentials**:
- Email: `admin@demo.com`
- Password: `demo123`

**Steps**:
1. Navigate to http://localhost:3000/login
2. Enter test credentials
3. Click "Sign In"
4. Verify redirect to dashboard

**Expected**:
- [ ] Login form loads
- [ ] Can enter credentials
- [ ] Authentication succeeds
- [ ] Redirected to dashboard
- [ ] No console errors

### 5.5 CRUD Operations Test

**Status**: ⏳ PENDING

#### Products Module

**Location**: http://localhost:3000/products

**Test Cases**:
1. **Read (List)**:
   - [ ] Products list loads
   - [ ] Data displays from Supabase
   - [ ] Pagination works

2. **Create**:
   - [ ] Click "Add Product" button
   - [ ] Fill in form (SKU, Name, Price, Stock)
   - [ ] Submit form
   - [ ] Product appears in list
   - [ ] Success toast shown

3. **Update**:
   - [ ] Click "Edit" on a product
   - [ ] Modify fields
   - [ ] Save changes
   - [ ] Changes reflected in list
   - [ ] Success toast shown

4. **Delete**:
   - [ ] Click "Delete" on a product
   - [ ] Confirmation dialog appears
   - [ ] Confirm deletion
   - [ ] Product removed from list
   - [ ] Success toast shown

#### Customers Module

**Location**: http://localhost:3000/customers

**Test Cases**:
- [ ] List loads correctly
- [ ] Create new customer works
- [ ] Edit customer works
- [ ] Delete customer works (with confirmation)

#### Orders Module

**Location**: http://localhost:3000/orders

**Test Cases**:
- [ ] Orders list loads
- [ ] Can create order with line items
- [ ] Can update order status
- [ ] Total calculates correctly
- [ ] Delete order works (with confirmation)

#### Quotes Module

**Location**: http://localhost:3000/quotes

**Test Cases**:
- [ ] Quotes list loads
- [ ] Create quote with line items
- [ ] Update quote status
- [ ] Convert quote to order (if implemented)
- [ ] Delete quote works (with confirmation)

### 5.6 Testing Completion Checklist

**All Tests Passing**:
- [ ] Database connection successful
- [ ] Type check passes
- [ ] Lint passes
- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] Authentication works
- [ ] Products CRUD works
- [ ] Customers CRUD works
- [ ] Orders CRUD works
- [ ] Quotes CRUD works
- [ ] No console errors
- [ ] No API errors

**When All Tests Pass**:
- [ ] Update this spec: Mark "Testing" as ✅ COMPLETE
- [ ] Proceed to deployment preparation

---

## 6. Deployment Roadmap

### 6.1 Pre-Deployment Checklist

**Before deploying to production**:
- [ ] All tests pass (Section 5)
- [ ] Environment files configured
- [ ] Security keys generated
- [ ] Data verified in Supabase
- [ ] Local testing complete
- [ ] Git committed (no uncommitted changes)

### 6.2 Backend Deployment (Railway)

**Status**: ⏳ PENDING

**Platform**: Railway (https://railway.app)

#### Setup Steps

1. **Install Railway CLI**:
```bash
npm install -g @railway/cli
```

2. **Login to Railway**:
```bash
railway login
```

3. **Create New Project** (or link existing):
```bash
railway init
# Or: railway link
```

4. **Configure Environment Variables**:
```bash
# In Railway dashboard or via CLI
railway variables set DATABASE_URL="postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true"
railway variables set NEXT_PUBLIC_SUPABASE_URL="https://vwfgksqkajnpfjospbpe.supabase.co"
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"
railway variables set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
railway variables set JWT_SECRET_KEY="<your-jwt-secret>"
railway variables set BACKEND_API_KEY="<your-backend-api-key>"
```

5. **Deploy Backend**:
```bash
# From project root
cd apps/backend
railway up
```

6. **Get Backend URL**:
```bash
railway domain
# Example: https://ccw-backend.railway.app
```

7. **Verify Deployment**:
- [ ] Visit https://your-backend.railway.app/health
- [ ] Should return: `{"status": "healthy"}`

**Action Items**:
- [ ] Railway account created
- [ ] Railway CLI installed
- [ ] Project created/linked
- [ ] Environment variables configured
- [ ] Backend deployed successfully
- [ ] Health check passes
- [ ] Backend URL saved for frontend config

### 6.3 Frontend Deployment (Vercel)

**Status**: ⏳ PENDING

**Platform**: Vercel (https://vercel.com)

#### Setup Steps

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy Frontend**:
```bash
# From project root
cd apps/web
vercel
```

4. **Configure Environment Variables** (in Vercel dashboard):
- Go to: Project Settings → Environment Variables
- Add the following (for Production):

```
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_BACKEND_URL=<your-railway-backend-url>
NEXT_PUBLIC_FRONTEND_URL=<your-vercel-url>
```

**Or via CLI**:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_BACKEND_URL production
vercel env add NEXT_PUBLIC_FRONTEND_URL production
```

5. **Redeploy with Environment Variables**:
```bash
vercel --prod
```

6. **Get Frontend URL**:
```bash
vercel ls
# Example: https://ccw-erp.vercel.app
```

7. **Verify Deployment**:
- [ ] Visit your Vercel URL
- [ ] Login page loads
- [ ] Can authenticate
- [ ] Dashboard loads
- [ ] All modules accessible

**Action Items**:
- [ ] Vercel account created
- [ ] Vercel CLI installed
- [ ] Project deployed
- [ ] Environment variables configured
- [ ] Frontend accessible
- [ ] Application functions correctly
- [ ] Frontend URL saved

### 6.4 Production Smoke Tests

**Status**: ⏳ PENDING

After deployment, test production site:

**Basic Functionality**:
- [ ] Visit production URL
- [ ] Login with test credentials
- [ ] View dashboard
- [ ] Check each module (Products, Customers, Orders, Quotes)
- [ ] Verify data loads correctly
- [ ] Test create/edit/delete in one module
- [ ] Check browser console for errors

**Performance**:
- [ ] Page load time acceptable (<3 seconds)
- [ ] API responses fast (<500ms)
- [ ] No timeout errors

**Security**:
- [ ] HTTPS enabled (SSL certificate valid)
- [ ] No API keys exposed in browser
- [ ] Authentication redirects work
- [ ] Unauthorized access blocked

### 6.5 Deployment Completion Checklist

**Deployment Complete When**:
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] Environment variables configured
- [ ] Production smoke tests pass
- [ ] No errors in production logs
- [ ] Update this spec: Mark "Deployment" as ✅ COMPLETE

---

## 7. Rollback Plan

### 7.1 When to Rollback

**Rollback Scenarios**:
- Data import fails repeatedly
- Application cannot connect to Supabase
- Critical data corruption detected
- Performance issues unresolved

### 7.2 Rollback to Local PostgreSQL

**Steps**:

1. **Stop Current Services**:
```bash
# Stop frontend and backend if running
# Ctrl+C in terminals
```

2. **Revert Environment Files**:
```bash
# Backend
cd apps/backend
# Restore .env to use local PostgreSQL
# DATABASE_URL=postgresql://starter_user:starter_password@localhost:5432/starter_db
```

3. **Start Local PostgreSQL**:
```bash
# From project root
docker compose up -d
```

4. **Verify Docker Container**:
```bash
docker ps | grep postgres
```

5. **Test Local Connection**:
```bash
cd apps/backend
uv run python -c "from src.config.database import sync_engine; sync_engine.connect()"
```

6. **Restart Application**:
```bash
# Terminal 1: Backend
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Terminal 2: Frontend
cd apps/web
pnpm dev
```

7. **Verify Application Works**:
- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] Can login
- [ ] Data loads correctly

### 7.3 Rollback Checklist

- [ ] Identified issue requiring rollback
- [ ] Stopped current services
- [ ] Reverted environment files
- [ ] Started local PostgreSQL
- [ ] Verified local connection
- [ ] Restarted application
- [ ] Verified application works locally
- [ ] Documented reason for rollback

---

## 8. Troubleshooting Guide

### 8.1 Data Import Issues

#### Problem: "File too large" error in SQL Editor

**Cause**: Chunk file exceeds 2MB limit

**Solution**:
1. Verify you're using split chunks (aa-ae), not the full file
2. Check file size: `Get-ChildItem backup/data_chunk_* | Select-Object Name, Length`
3. If chunk is too large, re-split the file

#### Problem: "Relation does not exist" error

**Cause**: Schema not imported, or importing chunks out of order

**Solution**:
1. Verify schema exists: Run `SELECT tablename FROM pg_tables WHERE schemaname='public'`
2. Import chunks in order: aa → ab → ac → ad → ae
3. Re-import schema if needed

#### Problem: "Foreign key constraint" error

**Cause**: Referenced rows don't exist (e.g., customer_id references non-existent customer)

**Solution**:
1. Import chunks in correct order (aa first, ae last)
2. Verify chunk AA imported successfully (contains organizations, users)
3. Check foreign key dependencies in error message

#### Problem: Import times out or hangs

**Cause**: Large chunk or slow connection

**Solution**:
1. Wait longer (chunks can take 3-5 minutes)
2. Refresh browser and try again
3. Split problematic chunk into smaller pieces

### 8.2 Connection Issues

#### Problem: "password authentication failed"

**Cause**: Incorrect password in DATABASE_URL

**Solution**:
1. Verify password: `lIEI5gV4OkSV5WV3`
2. Check for extra spaces or special characters
3. Reset password in Supabase dashboard if needed

#### Problem: "could not translate host name" (DNS error)

**Cause**: Network/DNS issues (known problem on local machine)

**Solution**:
1. Use browser-based SQL Editor instead of CLI tools
2. Check internet connection
3. Try alternative DNS servers (8.8.8.8, 1.1.1.1)

#### Problem: "too many connections"

**Cause**: Connection limit exceeded

**Solution**:
1. Use connection pooling: Port 6543 instead of 5432
2. Verify DATABASE_URL uses `?pgbouncer=true`
3. Close unused connections

#### Problem: "SSL required"

**Cause**: Supabase requires SSL connections

**Solution**:
1. Add `?sslmode=require` to DATABASE_URL
2. Example: `postgresql://postgres:pass@host:6543/db?pgbouncer=true&sslmode=require`

### 8.3 API Key Issues

#### Problem: "Invalid API key"

**Cause**: Incorrect or expired API key

**Solution**:
1. Re-copy keys from Supabase dashboard
2. Verify keys start with `eyJ...`
3. Check for extra spaces or newlines when copying
4. Regenerate keys if needed

#### Problem: "Unauthorized" errors in application

**Cause**: Anon key not configured correctly

**Solution**:
1. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` in environment files
2. Check environment variables loaded: `console.log(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)`
3. Restart application after changing environment files

### 8.4 Application Issues

#### Problem: "Cannot read properties of undefined"

**Cause**: API response structure changed or data missing

**Solution**:
1. Check browser console for full error
2. Verify data imported successfully
3. Check API endpoint returns expected structure
4. Verify frontend/backend versions compatible

#### Problem: Login fails with correct credentials

**Cause**: User data not imported, or password hash mismatch

**Solution**:
1. Verify users table has data: `SELECT COUNT(*) FROM users`
2. Check user exists: `SELECT email FROM users WHERE email='admin@demo.com'`
3. Re-import chunk AA (contains users table)
4. Verify JWT_SECRET_KEY matches across all environments

#### Problem: CRUD operations fail

**Cause**: Backend not connected to Supabase, or RLS policies blocking requests

**Solution**:
1. Check backend logs for errors
2. Verify DATABASE_URL correct in backend environment
3. Check Supabase RLS policies (may need to disable for MVP)
4. Test API endpoint directly: `curl http://localhost:8000/api/products`

### 8.5 Getting Help

**Resources**:
- Supabase Documentation: https://supabase.com/docs
- Supabase Dashboard Logs: https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/logs/explorer
- Project Documentation: See existing files (DATA-IMPORT-FINAL-SOLUTION.md, etc.)

**Contact Support**:
- Supabase Support: support@supabase.com
- Community Discord: https://discord.supabase.com

---

## Appendix A: Quick Reference

### Supabase Dashboard URLs

| Resource | URL |
|----------|-----|
| Project Home | https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe |
| SQL Editor | https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/sql |
| API Keys | https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/api-keys/legacy |
| Database Settings | https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/settings/database |
| Logs Explorer | https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/logs/explorer |
| Table Editor | https://supabase.com/dashboard/project/vwfgksqkajnpfjospbpe/editor |

### Connection Strings

**Pooled (Recommended for Production)**:
```
postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres?pgbouncer=true
```

**Direct (For Migrations/Admin)**:
```
postgresql://postgres:lIEI5gV4OkSV5WV3@db.vwfgksqkajnpfjospbpe.supabase.co:5432/postgres
```

### Project Details

| Property | Value |
|----------|-------|
| Project Name | CCWiCRM-ERP |
| Project Reference | vwfgksqkajnpfjospbpe |
| Project URL | https://vwfgksqkajnpfjospbpe.supabase.co |
| Region | ap-southeast-2 (Sydney, Australia) |
| Plan | Free (upgrade to Pro for production) |

### Test Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@demo.com | demo123 | Administrator |
| Sales | sales@demo.com | demo123 | Sales |
| Warehouse | warehouse@demo.com | demo123 | Warehouse |

### Key Files

| File | Purpose |
|------|---------|
| `SUPABASE-MIGRATION-SPEC.md` | This specification document |
| `DATA-IMPORT-FINAL-SOLUTION.md` | Quick import guide |
| `IMPORT-PROGRESS.md` | Import progress checklist |
| `SUPABASE_SETUP.md` | Detailed setup guide |
| `backup/data_chunk_aa` | Data chunk 1 of 5 |
| `backup/data_chunk_ab` | Data chunk 2 of 5 |
| `backup/data_chunk_ac` | Data chunk 3 of 5 |
| `backup/data_chunk_ad` | Data chunk 4 of 5 |
| `backup/data_chunk_ae` | Data chunk 5 of 5 |

---

## Appendix B: Progress Tracking

### Overall Progress

**Migration Phases**:
- ✅ Phase 1: Schema Import (100% complete)
- ⏳ Phase 2: Data Import (0% complete) ← **YOU ARE HERE**
- ⏳ Phase 3: Environment Configuration (0% complete)
- ⏳ Phase 4: Application Testing (0% complete)
- ⏳ Phase 5: Deployment (0% complete)

**Overall**: 20% complete (1 of 5 phases done)

### Time Estimates

| Phase | Estimated Time | Status |
|-------|----------------|--------|
| Schema Import | 5 minutes | ✅ Complete |
| Data Import | 15-20 minutes | ⏳ Pending |
| Environment Configuration | 10 minutes | ⏳ Pending |
| Application Testing | 15-20 minutes | ⏳ Pending |
| Deployment | 30-40 minutes | ⏳ Pending |
| **Total** | **~1.5 hours** | **20% complete** |

### Last Updated

**Date**: 2026-01-17
**Updated By**: Claude Code
**Next Update**: After data import completion

---

## Appendix C: Success Criteria Summary

### Data Import Success
- [ ] All 5 chunks imported without errors
- [ ] All 31 tables have row_count > 0
- [ ] Verification query passes
- [ ] No errors in Supabase logs

### Configuration Success
- [ ] All environment files created/updated
- [ ] API keys configured
- [ ] Security keys generated
- [ ] Connection strings correct

### Testing Success
- [ ] Connection test passes
- [ ] Type check passes
- [ ] Lint passes
- [ ] Application starts without errors
- [ ] Authentication works
- [ ] CRUD operations work in all modules

### Deployment Success
- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] Production smoke tests pass
- [ ] No errors in production logs

### Migration Complete
- [ ] All phases completed
- [ ] All success criteria met
- [ ] Documentation updated
- [ ] Rollback plan validated
- [ ] Production ready

---

**End of Specification Document**

*This document should be updated as each phase completes. Mark items with ✅ when complete, 🔄 when in progress, and ❌ if failed/blocked.*
