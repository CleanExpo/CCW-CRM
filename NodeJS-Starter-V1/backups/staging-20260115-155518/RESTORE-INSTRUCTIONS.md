# Staging Database Backup - Restore Instructions

**Backup Date:** January 15, 2026, 3:56 PM
**Database:** ccw_erp_staging
**Status at Backup:** 100% Operational
**Total Size:** 176 KB

---

## 📦 Backup Contents

| File | Size | Description |
|------|------|-------------|
| `database-full-dump.sql` | 91 KB | Complete database dump (schema + data) |
| `database-schema-only.sql` | 51 KB | Schema only (tables, indexes, constraints) |
| `docker-compose.staging.yml` | 7 KB | Docker Compose configuration |
| `migration.sql` | 24 KB | Original Alembic migration SQL |
| `env-staging-backup.txt` | 2.4 KB | Environment variables (contains passwords!) |

---

## 📊 Database State at Backup

**Tables:** 26 ERP tables
- ✅ organizations (1 record)
- ✅ users (3 records)
- ✅ customers (3 records)
- ✅ products (100 records)
- ✅ orders (0 records)
- ✅ quotes (0 records)
- ✅ suppliers (0 records)
- ✅ backorders (0 records)
- ✅ containers (0 records)
- ✅ Plus 17 additional tables

**Demo Users:**
- admin@demo.com / demo123 (admin role)
- sales@demo.com / demo123 (sales role)
- warehouse@demo.com / demo123 (warehouse role)

**Password Hash:** $2b$12$rOTVEHVk1whN3OzwdRdtquY/q4mLvucM6O0FtaL8bhpW/b73pRAVS

---

## 🔧 Full Restore (Complete Reset)

Use this when you want to completely reset the staging environment to this backed-up state.

### Step 1: Stop All Services

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1"
docker-compose -f docker-compose.staging.yml down
```

### Step 2: Remove Old Database Volume

```bash
docker volume rm nodejs-starter-v1_postgres_staging_data
```

### Step 3: Start PostgreSQL Only

```bash
docker-compose -f docker-compose.staging.yml up -d postgres
```

### Step 4: Wait for PostgreSQL to Be Ready

```bash
# Wait 10 seconds
sleep 10

# Verify it's ready
docker exec ccw-erp-postgres-staging pg_isready -U ccw_staging
# Should output: /var/run/postgresql:5432 - accepting connections
```

### Step 5: Restore Database Dump

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\backups\staging-20260115-155518"

cat database-full-dump.sql | docker exec -i ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging
```

### Step 6: Verify Restore

```bash
# Check tables
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c '\dt'

# Check data counts
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c '
SELECT
  (SELECT count(*) FROM organizations) as orgs,
  (SELECT count(*) FROM users) as users,
  (SELECT count(*) FROM products) as products,
  (SELECT count(*) FROM customers) as customers;'

# Expected output:
# orgs | users | products | customers
# -----+-------+----------+-----------
#    1 |     3 |      100 |         3
```

### Step 7: Start All Services

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1"
docker-compose -f docker-compose.staging.yml up -d
```

### Step 8: Test Authentication

```bash
# Wait for backend to start
sleep 15

# Test login
curl -X POST "http://127.0.0.1:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'

# Should return: {"access_token":"eyJ...","token_type":"bearer",...}
```

---

## 🔄 Partial Restore (Data Only)

Use this when you want to restore just the data without rebuilding containers.

### Option A: Restore with Services Running

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\backups\staging-20260115-155518"

# Drop all tables (keeps database)
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c '
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ccw_staging;
GRANT ALL ON SCHEMA public TO public;'

# Restore dump
cat database-full-dump.sql | docker exec -i ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging

# Restart backend
cd "C:\CCW-Online ERP\NodeJS-Starter-V1"
docker-compose -f docker-compose.staging.yml restart backend
```

### Option B: Restore Specific Tables Only

```bash
# Extract specific table data from dump
grep -A 1000 "COPY users" database-full-dump.sql > users-only.sql

# Restore just that table
cat users-only.sql | docker exec -i ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging
```

---

## 📋 Schema-Only Restore

Use this when you want to recreate the database structure without data.

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\backups\staging-20260115-155518"

# Drop and recreate schema
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c '
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ccw_staging;
GRANT ALL ON SCHEMA public TO public;'

# Restore schema only
cat database-schema-only.sql | docker exec -i ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging

# Now you have empty tables ready for fresh data
```

---

## 🔐 Environment Restore

If you need to restore environment variables:

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1"

# Copy backup to .env.staging.local
cp backups/staging-20260115-155518/env-staging-backup.txt .env.staging.local

# Recreate services to pick up new env vars
docker-compose -f docker-compose.staging.yml up -d --force-recreate
```

**Important:** The env file contains sensitive passwords!
- Database password: `StagingPass2026`
- JWT secret keys
- API keys (if configured)

---

## 🚨 Emergency Recovery

If something goes catastrophically wrong:

### Nuclear Option (Complete Reset)

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1"

# Stop everything
docker-compose -f docker-compose.staging.yml down -v

# Remove all containers
docker rm -f $(docker ps -aq --filter name=ccw-erp)

# Remove all volumes
docker volume rm nodejs-starter-v1_postgres_staging_data
docker volume rm nodejs-starter-v1_redis_staging_data

# Restore config files
cp backups/staging-20260115-155518/docker-compose.staging.yml ./
cp backups/staging-20260115-155518/env-staging-backup.txt .env.staging.local

# Start from scratch
docker-compose -f docker-compose.staging.yml up -d postgres
sleep 10

# Restore database
cat backups/staging-20260115-155518/database-full-dump.sql | \
  docker exec -i ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging

# Start everything
docker-compose -f docker-compose.staging.yml up -d

# Wait and test
sleep 15
curl -X POST "http://127.0.0.1:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'
```

---

## ✅ Verification Checklist

After restore, verify these items:

```bash
# 1. Check all tables exist
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c '\dt' | wc -l
# Should be: 27 lines (26 tables + header)

# 2. Check data counts
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c '
SELECT
  (SELECT count(*) FROM organizations) as orgs,
  (SELECT count(*) FROM users) as users,
  (SELECT count(*) FROM products) as products,
  (SELECT count(*) FROM customers) as customers;'
# Expected: orgs=1, users=3, products=100, customers=3

# 3. Test authentication
curl -X POST "http://127.0.0.1:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}' | grep access_token
# Should return: JWT token

# 4. Test API endpoint
# First get token
TOKEN=$(curl -s -X POST "http://127.0.0.1:8001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}' | \
  grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# Then query products
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8001/api/products?page=1&page_size=5"
# Should return: List of 5 products

# 5. Check backend health
curl http://127.0.0.1:8001/health
# Should return: {"status":"healthy",...}
```

**All 5 checks should pass** ✅

---

## 📝 Backup File Integrity

### Verify Backup Files

```bash
cd "C:\CCW-Online ERP\NodeJS-Starter-V1\backups\staging-20260115-155518"

# Check SQL files are valid
head -n 1 database-full-dump.sql
# Should start with: --

tail -n 1 database-full-dump.sql
# Should end with: -- PostgreSQL database dump complete

# Count lines
wc -l database-full-dump.sql
# Should be: ~2100 lines

# Check for key tables
grep "CREATE TABLE" database-full-dump.sql | wc -l
# Should be: 26 tables
```

### File Checksums (Optional)

```bash
# Generate checksums for verification
md5sum database-full-dump.sql > checksums.md5
md5sum database-schema-only.sql >> checksums.md5

# Later, verify integrity
md5sum -c checksums.md5
```

---

## 🔄 Creating New Backups

To create a fresh backup in the future:

```bash
# Create new backup directory
cd "C:\CCW-Online ERP\NodeJS-Starter-V1"
mkdir -p backups/staging-$(date +%Y%m%d-%H%M%S)
cd backups/staging-$(date +%Y%m%d-%H%M%S)

# Dump database
docker exec ccw-erp-postgres-staging pg_dump -U ccw_staging -d ccw_erp_staging > database-full-dump.sql

# Schema only
docker exec ccw-erp-postgres-staging pg_dump -U ccw_staging -d ccw_erp_staging --schema-only > database-schema-only.sql

# Copy configs
cd ../..
cp .env.staging.local backups/staging-$(date +%Y%m%d-%H%M%S)/env-staging-backup.txt
cp docker-compose.staging.yml backups/staging-$(date +%Y%m%d-%H%M%S)/
cp migration.sql backups/staging-$(date +%Y%m%d-%H%M%S)/
```

---

## 💡 Common Issues and Solutions

### Issue: "relation does not exist"

**Problem:** Table names in dump don't match
**Solution:** Ensure you're restoring to the correct database: `ccw_erp_staging`

### Issue: "password authentication failed"

**Problem:** Environment variable password doesn't match
**Solution:** Check `env-staging-backup.txt` and update `POSTGRES_PASSWORD`

### Issue: "port already in use"

**Problem:** Another postgres container running
**Solution:** Stop all containers: `docker ps -a | grep postgres | awk '{print $1}' | xargs docker stop`

### Issue: "no space left on device"

**Problem:** Docker volumes full
**Solution:** Clean old volumes: `docker volume prune`

### Issue: "connection refused"

**Problem:** PostgreSQL not fully started
**Solution:** Wait longer (30 seconds) or check logs: `docker logs ccw-erp-postgres-staging`

---

## 🎯 Restore Success Criteria

After restore, you should have:

- ✅ 26 tables in database
- ✅ 1 organization (CCW Online ERP)
- ✅ 3 demo users (admin, sales, warehouse)
- ✅ 100 products
- ✅ 3 customers (from previous tests)
- ✅ Authentication working (can get JWT token)
- ✅ API responding (health check passes)
- ✅ Products queryable via API
- ✅ All services running and healthy

---

## 📞 Support Commands

```bash
# Check what's running
docker ps --filter name=ccw-erp

# Check logs
docker logs ccw-erp-backend-staging --tail 50
docker logs ccw-erp-postgres-staging --tail 50

# Connect to database
docker exec -it ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging

# Check table sizes
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check database connections
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "
SELECT count(*) as active_connections FROM pg_stat_activity WHERE datname = 'ccw_erp_staging';"
```

---

## ⚠️ Important Notes

1. **Passwords in Backup:** The `env-staging-backup.txt` file contains passwords. Keep this backup secure!

2. **Version Compatibility:** This backup is from Docker images:
   - PostgreSQL: pgvector/pgvector:pg15
   - Backend: Python 3.12 with FastAPI
   - Frontend: Node.js 22 with Next.js 15

3. **Data Growth:** As you add more data, backups will grow. Monitor backup sizes.

4. **Automated Backups:** Consider setting up automated daily backups:
   ```bash
   # Add to crontab
   0 2 * * * cd /path/to/project && ./scripts/backup-staging.sh
   ```

5. **Retention Policy:** Keep at least 3 recent backups. Archive monthly backups.

---

**Backup Created:** January 15, 2026, 3:56 PM
**Database Size:** 91 KB (2,100 lines SQL)
**Schema Version:** Alembic head (6 migrations applied)
**Status:** ✅ Fully functional, 100% operational

---

**Ready to restore anytime!** 🚀
