# CCW-Online ERP - Staging Deployment Guide

**Date:** January 15, 2026
**Status:** Production-Ready (100% Test Pass Rate Achieved)
**Version:** 1.0.0

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Staging Environment Setup](#staging-environment-setup)
3. [Configuration](#configuration)
4. [Deployment Steps](#deployment-steps)
5. [Verification & Testing](#verification--testing)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedure](#rollback-procedure)

---

## Prerequisites

### System Requirements

**Minimum Specifications:**
- 4 CPU cores
- 8 GB RAM
- 50 GB SSD storage
- Ubuntu 20.04+ or similar Linux distribution

**Recommended Specifications:**
- 8 CPU cores
- 16 GB RAM
- 100 GB SSD storage
- Ubuntu 22.04 LTS

### Software Dependencies

```bash
# 1. Docker & Docker Compose
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl enable docker
sudo systemctl start docker

# 2. Verify Docker installation
docker --version          # Should be 20.10+
docker-compose --version  # Should be 1.29+

# 3. Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Required Credentials

Before deployment, prepare the following:

#### Database
- Strong PostgreSQL password (16+ characters, mixed case, numbers, symbols)

#### Security Keys
```bash
# Generate SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate JWT_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### Integration Credentials (Staging/Sandbox)

1. **Xero** (Sandbox)
   - Client ID
   - Client Secret
   - Redirect URI: `http://your-staging-url:8001/api/integrations/xero/callback`
   - Obtain at: https://developer.xero.com/app/manage

2. **Shopify** (Development Store)
   - Shop URL: `your-store-staging.myshopify.com`
   - Access Token (Admin API)
   - Obtain at: https://partners.shopify.com/

3. **SendGrid** (Staging Key)
   - API Key
   - Verified sender email
   - Obtain at: https://app.sendgrid.com/settings/api_keys

4. **ElevenLabs** (Staging Key)
   - API Key
   - Obtain at: https://elevenlabs.io/app/settings/api-keys

5. **Anthropic Claude** (Staging Key)
   - API Key
   - Obtain at: https://console.anthropic.com/settings/keys

---

## Staging Environment Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/ccw-online-erp.git
cd ccw-online-erp/NodeJS-Starter-V1

# Checkout stable release (or use main branch)
git checkout v1.0.0
```

### 2. Configure Environment

```bash
# Copy staging environment template
cp .env.staging .env.staging.local

# Edit with your credentials
nano .env.staging.local
```

**Critical Configuration Values:**

```bash
# Database - Use strong password
POSTGRES_PASSWORD=your_strong_password_here

# Security - Generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=your_generated_secret_key
JWT_SECRET_KEY=your_generated_jwt_secret_key

# AI Provider
ANTHROPIC_API_KEY=sk-ant-api03-your_staging_key

# Integrations (Staging credentials)
XERO_CLIENT_ID_STAGING=your_xero_client_id
XERO_CLIENT_SECRET_STAGING=your_xero_client_secret
SHOPIFY_SHOP_URL_STAGING=your-store-staging.myshopify.com
SHOPIFY_ACCESS_TOKEN_STAGING=your_shopify_token
SENDGRID_API_KEY_STAGING=your_sendgrid_key
ELEVENLABS_API_KEY_STAGING=your_elevenlabs_key
```

### 3. Create Required Directories

```bash
# Create log directories
mkdir -p logs/backend logs/celery logs/celery-beat logs/frontend

# Set permissions
chmod 755 logs
chmod 755 logs/*
```

### 4. Initialize Database

```bash
# Create database initialization script (if not exists)
mkdir -p scripts

# The init-db.sql is automatically executed on first PostgreSQL startup
# It creates the database schema, extensions, and seed data
```

---

## Deployment Steps

### Step 1: Build Docker Images

```bash
# Load staging environment
export $(cat .env.staging.local | xargs)

# Build all images
docker-compose -f docker-compose.staging.yml build --no-cache
```

**Expected Output:**
```
Building postgres... Done
Building redis...    Done
Building backend...  Done
Building celery-worker... Done
Building celery-beat...   Done
Building frontend... Done
```

### Step 2: Start Services

```bash
# Start all services
docker-compose -f docker-compose.staging.yml up -d

# Check status
docker-compose -f docker-compose.staging.yml ps
```

**Expected Output:**
```
NAME                          STATUS    PORTS
ccw-erp-postgres-staging      Up        0.0.0.0:5434->5432/tcp
ccw-erp-redis-staging         Up        0.0.0.0:6380->6379/tcp
ccw-erp-backend-staging       Up        0.0.0.0:8001->8000/tcp
ccw-erp-celery-worker-staging Up
ccw-erp-celery-beat-staging   Up
ccw-erp-frontend-staging      Up        0.0.0.0:3001->3000/tcp
```

### Step 3: Wait for Services to Start

```bash
# Wait for health checks (60-90 seconds)
echo "Waiting for services to be healthy..."
sleep 90

# Check health status
docker-compose -f docker-compose.staging.yml ps | grep "Up (healthy)"
```

### Step 4: Run Database Migrations (if needed)

```bash
# Connect to backend container
docker exec -it ccw-erp-backend-staging bash

# Inside container - run migrations
cd /app
alembic upgrade head

# Exit container
exit
```

### Step 5: Verify Service Health

```bash
# Check backend health
curl http://localhost:8001/health

# Expected response:
# {"status":"healthy","timestamp":"2026-01-15T...","version":"1.0.0"}

# Check frontend
curl http://localhost:3001

# Expected: HTML response with status 200
```

---

## Verification & Testing

### 1. Automated Integration Tests

```bash
# Run full integration test suite (100% pass rate expected)
bash integration-tests.sh

# Expected output:
# ==========================================
# TEST SUMMARY
# ==========================================
# Passed: 39
# Failed: 0
# Warnings: 1
# Pass Rate: 100%
# ✓ All tests passed!
```

### 2. Manual Verification Checklist

**Backend API Tests:**

```bash
# 1. Authentication
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'

# Expected: JWT token returned

# 2. Products endpoint (with token)
TOKEN="your_token_here"
curl http://localhost:8001/api/products \
  -H "Authorization: Bearer $TOKEN"

# Expected: Paginated product list

# 3. Customers endpoint
curl http://localhost:8001/api/customers \
  -H "Authorization: Bearer $TOKEN"

# Expected: Customer list

# 4. Orders endpoint
curl http://localhost:8001/api/orders \
  -H "Authorization: Bearer $TOKEN"

# Expected: Order list
```

**Frontend Tests:**

1. Open browser: `http://localhost:3001`
2. Login with: `admin@demo.com` / `demo123`
3. Navigate through all modules:
   - ✅ Dashboard loads
   - ✅ Products page displays items
   - ✅ Customers page loads
   - ✅ Orders page shows orders
   - ✅ Quotes module works
   - ✅ Inventory page functions
   - ✅ Dark mode toggle works
4. Test CRUD operations:
   - ✅ Create new product
   - ✅ Edit existing customer
   - ✅ Delete test record (with confirmation)
   - ✅ Search functionality works
5. Test integrations (if configured):
   - ✅ Xero sync status
   - ✅ Shopify product sync

### 3. Integration Health Checks

**Xero Integration:**
```bash
# Test Xero connection
curl http://localhost:8001/api/integrations/xero/status \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"status": "connected"} or {"status": "not_configured"}
```

**Shopify Integration:**
```bash
# Test Shopify connection
curl http://localhost:8001/api/integrations/shopify/status \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"status": "connected", "shop": "your-store-staging.myshopify.com"}
```

### 4. Performance Baseline

```bash
# Simple load test (requires apache2-utils)
sudo apt install apache2-utils -y

# Test backend performance (100 requests, 10 concurrent)
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:8001/api/products?page=1&page_size=50

# Expected metrics:
# - Requests per second: > 50
# - Time per request (mean): < 200ms
# - Failed requests: 0
```

### 5. Log Review

```bash
# Check backend logs for errors
docker logs ccw-erp-backend-staging --tail 100

# Check Celery worker logs
docker logs ccw-erp-celery-worker-staging --tail 50

# Check frontend logs
docker logs ccw-erp-frontend-staging --tail 50

# Look for:
# ✅ No ERROR or CRITICAL level logs
# ✅ Successful service startups
# ✅ Database connections established
# ✅ Redis connections established
```

---

## Monitoring & Maintenance

### Daily Monitoring

**Health Check Script:**

```bash
#!/bin/bash
# save as: check-staging-health.sh

echo "=== Staging Health Check ==="
echo ""

# 1. Service status
echo "Service Status:"
docker-compose -f docker-compose.staging.yml ps

echo ""

# 2. Backend health
echo "Backend Health:"
curl -s http://localhost:8001/health | jq .

echo ""

# 3. Disk usage
echo "Disk Usage:"
df -h | grep -E '(Filesystem|/var/lib/docker)'

echo ""

# 4. Memory usage
echo "Memory Usage:"
free -h

echo ""

# 5. Docker stats
echo "Container Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=== Health Check Complete ==="
```

**Run daily:**
```bash
chmod +x check-staging-health.sh
./check-staging-health.sh
```

### Weekly Maintenance

```bash
# 1. Backup database
docker exec ccw-erp-postgres-staging pg_dump -U ccw_staging ccw_erp_staging > backup-$(date +%Y%m%d).sql

# 2. Clean old logs
find logs/ -name "*.log" -mtime +7 -delete

# 3. Prune Docker system
docker system prune -f

# 4. Update container images (if new version available)
docker-compose -f docker-compose.staging.yml pull
docker-compose -f docker-compose.staging.yml up -d
```

### Log Rotation

Create `/etc/logrotate.d/ccw-erp-staging`:

```
/path/to/ccw-online-erp/NodeJS-Starter-V1/logs/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

---

## Troubleshooting

### Issue 1: Services Won't Start

**Symptoms:** Container exits immediately or stuck in restart loop

**Diagnosis:**
```bash
# Check container logs
docker logs ccw-erp-backend-staging

# Check for port conflicts
sudo netstat -tulpn | grep -E '(8001|3001|5434|6380)'
```

**Solution:**
```bash
# If ports are in use, stop conflicting services or change ports in docker-compose.staging.yml
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d
```

### Issue 2: Database Connection Fails

**Symptoms:** Backend logs show "could not connect to database"

**Diagnosis:**
```bash
# Check PostgreSQL is running
docker exec ccw-erp-postgres-staging pg_isready

# Test connection
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "SELECT 1"
```

**Solution:**
```bash
# Ensure DATABASE_URL matches POSTGRES_* variables
# Restart services with health check wait
docker-compose -f docker-compose.staging.yml restart backend celery-worker
```

### Issue 3: Frontend Shows "API Connection Error"

**Symptoms:** Frontend loads but shows connection error

**Diagnosis:**
```bash
# Check NEXT_PUBLIC_API_URL
docker exec ccw-erp-frontend-staging env | grep NEXT_PUBLIC_API_URL

# Test API from frontend container
docker exec ccw-erp-frontend-staging curl http://backend:8000/health
```

**Solution:**
```bash
# Update NEXT_PUBLIC_API_URL in .env.staging.local
# Rebuild frontend
docker-compose -f docker-compose.staging.yml up -d --build frontend
```

### Issue 4: Integration Tests Fail

**Symptoms:** Test pass rate < 100%

**Diagnosis:**
```bash
# Run tests with verbose output
bash integration-tests.sh 2>&1 | tee test-output.log

# Check for specific failures
grep "FAIL" test-output.log
```

**Solution:**
```bash
# Common fixes:
# 1. Clean test data
docker exec ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging -c "
TRUNCATE TABLE quote_items, quotes, order_items, orders RESTART IDENTITY CASCADE;
DELETE FROM customers WHERE email LIKE '%test%';
DELETE FROM products WHERE sku LIKE 'CHEM-TEST%';
"

# 2. Restart services
docker-compose -f docker-compose.staging.yml restart

# 3. Re-run tests
bash integration-tests.sh
```

### Issue 5: High Memory Usage

**Symptoms:** System slowdown, OOM errors

**Diagnosis:**
```bash
# Check memory by container
docker stats --no-stream

# Check PostgreSQL memory
docker exec ccw-erp-postgres-staging free -h
```

**Solution:**
```bash
# Adjust memory limits in docker-compose.staging.yml
# Restart services
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d
```

---

## Rollback Procedure

### Emergency Rollback

**If critical issue occurs after deployment:**

```bash
# 1. Stop all services immediately
docker-compose -f docker-compose.staging.yml down

# 2. Restore database from last backup
cat backup-YYYYMMDD.sql | docker exec -i ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging

# 3. Checkout previous stable version
git checkout v0.9.0  # or previous tag

# 4. Rebuild and restart
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml up -d

# 5. Verify rollback
curl http://localhost:8001/health
bash integration-tests.sh
```

**Estimated rollback time:** 10-15 minutes

---

## Deployment Success Criteria

**Staging deployment is successful when:**

- ✅ All 6 containers running and healthy
- ✅ Backend health check returns 200 OK
- ✅ Frontend loads successfully
- ✅ All 39 integration tests pass (100% pass rate)
- ✅ Database migrations complete
- ✅ Authentication works (login successful)
- ✅ All CRUD operations functional
- ✅ No ERROR logs in past 5 minutes
- ✅ Integrations connect successfully (if configured)
- ✅ Performance meets baseline (< 200ms API response)

---

## Next Steps

After successful staging deployment:

1. **Monitor for 48 hours** - Watch logs, performance metrics, error rates
2. **Perform UAT** - User acceptance testing with stakeholders
3. **Load testing** - Simulate production traffic
4. **Security audit** - Review exposed ports, credentials, SSL/TLS
5. **Documentation** - Document any staging-specific configurations
6. **Production planning** - Prepare production deployment (see PRODUCTION-DEPLOYMENT-CHECKLIST.md)

---

## Support & Resources

**Documentation:**
- Full API documentation: `http://localhost:8001/docs`
- Database schema: `SCHEMA.md`
- Development guide: `CLAUDE.md`
- Integration test details: `100-PERCENT-ACHIEVEMENT.md`

**Useful Commands:**

```bash
# View all logs
docker-compose -f docker-compose.staging.yml logs -f

# Restart specific service
docker-compose -f docker-compose.staging.yml restart backend

# Access backend shell
docker exec -it ccw-erp-backend-staging bash

# Access database
docker exec -it ccw-erp-postgres-staging psql -U ccw_staging -d ccw_erp_staging

# View environment variables
docker exec ccw-erp-backend-staging env | sort
```

---

**Document Version:** 1.0.0
**Last Updated:** January 15, 2026
**Author:** CCW Development Team
**Status:** Production-Ready (100% Test Pass Rate)
