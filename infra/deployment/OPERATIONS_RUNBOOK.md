# Operations Runbook - CCW-Online ERP

Complete operations guide for staging and production environments.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Common Operations](#common-operations)
3. [Deployment](#deployment)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Incident Response](#incident-response)
6. [Database Operations](#database-operations)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Procedures](#emergency-procedures)

---

## Quick Reference

### Essential URLs

**Staging:**

- Frontend: https://staging.ccw-erp.com
- API: https://api.staging.ccw-erp.com
- Grafana: http://staging.ccw-erp.com:3001
- Prometheus: http://staging.ccw-erp.com:9090
- Alertmanager: http://staging.ccw-erp.com:9093

**Production:**

- Frontend: https://ccw-erp.com
- API: https://api.ccw-erp.com
- Grafana: http://ccw-erp.com:3001
- Prometheus: http://ccw-erp.com:9090

### SSH Access

```bash
# Staging
ssh ubuntu@staging.ccw-erp.com

# Production
ssh ubuntu@ccw-erp.com
```

### Service Commands

```bash
# View running services
docker compose -f docker-compose.staging.yml ps

# View logs (all services)
docker compose -f docker-compose.staging.yml logs -f

# View logs (specific service)
docker compose -f docker-compose.staging.yml logs -f backend

# Restart a service
docker compose -f docker-compose.staging.yml restart backend

# Check service health
docker compose -f docker-compose.staging.yml ps | grep healthy
```

---

## Common Operations

### 1. Deploy to Staging

```bash
# Standard deployment
./deployment/scripts/deploy-staging.sh

# Deploy specific version
./deployment/scripts/deploy-staging.sh --version v1.2.0

# Skip smoke tests (not recommended)
./deployment/scripts/deploy-staging.sh --skip-tests

# Force deployment without confirmation
./deployment/scripts/deploy-staging.sh --force
```

### 2. Run Smoke Tests

```bash
# Local
./deployment/scripts/smoke-tests.sh http://localhost:8000

# Staging
./deployment/scripts/smoke-tests.sh https://api.staging.ccw-erp.com

# Production
./deployment/scripts/smoke-tests.sh https://api.ccw-erp.com
```

### 3. Check Service Status

```bash
# SSH into server
ssh ubuntu@staging.ccw-erp.com

# Check all services
cd /opt/ccw-erp
docker compose -f docker-compose.staging.yml ps

# Expected output:
# NAME                           STATUS
# ccw-erp-postgres-staging       Up (healthy)
# ccw-erp-redis-staging          Up (healthy)
# ccw-erp-backend-staging        Up (healthy)
# ccw-erp-web-staging            Up (healthy)
# ccw-erp-nginx-staging          Up (healthy)
```

### 4. View Application Logs

```bash
# All services (live tail)
docker compose -f docker-compose.staging.yml logs -f

# Backend only
docker compose -f docker-compose.staging.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.staging.yml logs --tail=100 backend

# Search for errors
docker compose -f docker-compose.staging.yml logs backend | grep -i error

# Search for specific request
docker compose -f docker-compose.staging.yml logs backend | grep "POST /api/orders"
```

### 5. Restart Services

```bash
# Restart specific service
docker compose -f docker-compose.staging.yml restart backend

# Restart all services
docker compose -f docker-compose.staging.yml restart

# Rebuild and restart (after code changes)
docker compose -f docker-compose.staging.yml up -d --build
```

---

## Deployment

### Pre-Deployment Checklist

- [ ] All tests passing in CI/CD
- [ ] Code review approved
- [ ] Database migrations tested locally
- [ ] Environment variables configured
- [ ] Secrets rotated (if needed)
- [ ] Stakeholders notified
- [ ] Rollback plan ready
- [ ] Monitoring dashboards open

### Deployment Steps

1. **Create backup**

   ```bash
   ssh ubuntu@staging.ccw-erp.com
   cd /opt/ccw-erp
   docker compose -f docker-compose.staging.yml exec -T postgres \
     pg_dump -U starter_user starter_db_staging > /var/backups/ccw-erp/backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Deploy**

   ```bash
   ./deployment/scripts/deploy-staging.sh --version v1.2.0
   ```

3. **Verify deployment**

   ```bash
   # Run smoke tests
   ./deployment/scripts/smoke-tests.sh https://api.staging.ccw-erp.com

   # Check logs for errors
   ssh ubuntu@staging.ccw-erp.com 'docker compose -f /opt/ccw-erp/docker-compose.staging.yml logs --tail=50 backend | grep -i error'

   # Check Grafana dashboards
   # Open: http://staging.ccw-erp.com:3001
   ```

4. **Monitor for 1 hour**
   - Watch error rate in Grafana
   - Check response times
   - Verify no alerts firing
   - Monitor Sentry for exceptions

### Post-Deployment Verification

```bash
# 1. Health check
curl https://api.staging.ccw-erp.com/api/health

# Expected: {"status":"healthy","environment":"staging"}

# 2. Authentication
curl -X POST https://api.staging.ccw-erp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo123"}'

# Expected: {"access_token":"...","token_type":"bearer"}

# 3. API endpoints
curl https://api.staging.ccw-erp.com/api/products?page=1&page_size=10 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: {"data":[...],"total":123,"page":1}
```

---

## Monitoring & Alerts

### Grafana Dashboards

**Access:** http://staging.ccw-erp.com:3001
**Login:** admin / (GRAFANA_ADMIN_PASSWORD)

**Key Dashboards:**

1. **API Performance** - Request rate, response time, error rate
2. **System Resources** - CPU, memory, disk, network
3. **Database** - Query performance, connections, slow queries
4. **Business Metrics** - Orders, revenue, active users

### Prometheus Queries

```promql
# Request rate (last 5 minutes)
rate(http_requests_total[5m])

# p95 response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Active connections
pg_stat_database_numbackends

# Memory usage
container_memory_usage_bytes{name="ccw-erp-backend-staging"}
```

### Alert Rules

**Critical Alerts** (PagerDuty + Slack):

- Database down (>1 minute)
- API error rate >5% (>5 minutes)
- Backend service down

**Warning Alerts** (Slack only):

- High response time >500ms p95 (>5 minutes)
- High CPU >80% (>10 minutes)
- High memory >85% (>10 minutes)
- Redis down (>1 minute)

### Viewing Active Alerts

```bash
# Prometheus alerts
curl http://staging.ccw-erp.com:9090/api/v1/alerts | jq '.data.alerts[]'

# Alertmanager (active alerts)
curl http://staging.ccw-erp.com:9093/api/v1/alerts | jq '.data[]'

# Silence an alert (1 hour)
curl -X POST http://staging.ccw-erp.com:9093/api/v1/silences \
  -d '{
    "matchers":[{"name":"alertname","value":"HighResponseTime"}],
    "startsAt":"2026-02-03T10:00:00Z",
    "endsAt":"2026-02-03T11:00:00Z",
    "comment":"Planned maintenance"
  }'
```

---

## Incident Response

### Severity Levels

**P0 - Critical** (Immediate response, <15 min)

- Complete outage
- Data loss
- Security breach
- Payment processing down

**P1 - High** (Respond within 1 hour)

- Major feature broken
- High error rate (>10%)
- Slow response times (p95 >2s)

**P2 - Medium** (Respond within 4 hours)

- Minor feature broken
- Moderate error rate (5-10%)
- Non-critical service degraded

**P3 - Low** (Respond within 24 hours)

- UI bug
- Documentation issue
- Low error rate (<5%)

### Incident Response Steps

1. **Acknowledge**

   ```bash
   # Acknowledge in Slack
   # Post to #incidents channel
   ```

2. **Assess**

   ```bash
   # Check Grafana dashboards
   # Check Sentry errors
   # Review application logs
   docker compose -f docker-compose.staging.yml logs --tail=200 backend | grep -i error
   ```

3. **Mitigate**

   ```bash
   # Quick fixes:
   # - Restart service: docker compose restart backend
   # - Scale up: Add more backend instances in load balancer
   # - Rollback: ./deployment/scripts/rollback.sh --version v1.1.0
   ```

4. **Resolve**

   ```bash
   # Deploy fix
   ./deployment/scripts/deploy-staging.sh --version v1.2.1

   # Verify fix
   ./deployment/scripts/smoke-tests.sh https://api.staging.ccw-erp.com
   ```

5. **Document**
   - Create postmortem document
   - Identify root cause
   - Document timeline
   - List action items

---

## Database Operations

### Create Backup

```bash
# Manual backup
ssh ubuntu@staging.ccw-erp.com

docker compose -f /opt/ccw-erp/docker-compose.staging.yml exec -T postgres \
  pg_dump -U starter_user starter_db_staging > /var/backups/ccw-erp/manual_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh /var/backups/ccw-erp/*.sql
```

### Restore Backup

```bash
# List available backups
ssh ubuntu@staging.ccw-erp.com
ls -lh /var/backups/ccw-erp/*.sql

# Restore specific backup
./deployment/scripts/rollback.sh --backup backup_20260203_120000.sql --preserve-db=false
```

### Run Migrations

```bash
# SSH into server
ssh ubuntu@staging.ccw-erp.com
cd /opt/ccw-erp

# Run migrations
docker compose -f docker-compose.staging.yml exec backend alembic upgrade head

# Rollback last migration
docker compose -f docker-compose.staging.yml exec backend alembic downgrade -1

# View migration history
docker compose -f docker-compose.staging.yml exec backend alembic history
```

### Database Queries

```bash
# Connect to PostgreSQL
docker compose -f docker-compose.staging.yml exec postgres \
  psql -U starter_user starter_db_staging

# Common queries
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders WHERE status = 'pending';
SELECT * FROM users WHERE email = 'admin@demo.com';

# Slow query analysis
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Active connections
SELECT * FROM pg_stat_activity;
```

---

## Troubleshooting

### Problem: Application Won't Start

**Symptoms:** Containers keep restarting

**Diagnosis:**

```bash
# Check container logs
docker compose -f docker-compose.staging.yml logs backend

# Check container status
docker compose -f docker-compose.staging.yml ps
```

**Common Causes:**

1. Database connection failure
2. Missing environment variables
3. Port conflicts
4. Insufficient memory

**Solution:**

```bash
# 1. Verify database is running
docker compose -f docker-compose.staging.yml logs postgres

# 2. Check environment variables
docker compose -f docker-compose.staging.yml config

# 3. Check memory usage
free -h
docker stats

# 4. Restart services
docker compose -f docker-compose.staging.yml restart
```

### Problem: High Response Times

**Symptoms:** p95 >500ms in Grafana

**Diagnosis:**

```bash
# Check slow queries
docker compose -f docker-compose.staging.yml exec postgres \
  psql -U starter_user -d starter_db_staging -c \
  "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check CPU usage
top

# Check memory usage
free -h
```

**Solution:**

1. Add missing database indexes
2. Enable Redis caching
3. Optimize slow queries
4. Scale horizontally (add more backend instances)

### Problem: High Error Rate

**Symptoms:** Error rate >5% in Grafana

**Diagnosis:**

```bash
# Check Sentry for errors
# Navigate to: https://sentry.io/your-project

# Check application logs
docker compose -f docker-compose.staging.yml logs backend | grep ERROR

# Check specific error pattern
docker compose -f docker-compose.staging.yml logs backend | grep "500 Internal Server Error"
```

**Solution:**

1. Identify error pattern in Sentry
2. Check related code changes
3. Review recent deployments
4. Consider rollback if critical

### Problem: Database Connection Errors

**Symptoms:** "OperationalError: could not connect to server"

**Diagnosis:**

```bash
# Check PostgreSQL is running
docker compose -f docker-compose.staging.yml ps postgres

# Check PostgreSQL logs
docker compose -f docker-compose.staging.yml logs postgres

# Test connection
docker compose -f docker-compose.staging.yml exec backend \
  python -c "from src.config.database import test_connection; test_connection()"
```

**Solution:**

```bash
# Restart PostgreSQL
docker compose -f docker-compose.staging.yml restart postgres

# If still failing, check DATABASE_URL
docker compose -f docker-compose.staging.yml exec backend printenv DATABASE_URL
```

---

## Emergency Procedures

### Complete Outage

1. **Immediate Actions** (<5 minutes)

   ```bash
   # Check if services are running
   ssh ubuntu@staging.ccw-erp.com
   docker compose -f /opt/ccw-erp/docker-compose.staging.yml ps

   # Quick restart all services
   docker compose -f /opt/ccw-erp/docker-compose.staging.yml restart
   ```

2. **If restart doesn't work** (<10 minutes)

   ```bash
   # Rollback to last known good version
   ./deployment/scripts/rollback.sh --version v1.1.0 --force
   ```

3. **Notify stakeholders**
   - Post to #incidents Slack channel
   - Update status page (if applicable)
   - Email stakeholders

### Data Loss

1. **STOP IMMEDIATELY**
   - Do not run any more commands
   - Do not restart services

2. **Assess damage**

   ```bash
   # Check database integrity
   docker compose -f docker-compose.staging.yml exec postgres \
     psql -U starter_user starter_db_staging -c "SELECT COUNT(*) FROM orders;"
   ```

3. **Restore from backup**

   ```bash
   # Find latest backup
   ssh ubuntu@staging.ccw-erp.com
   ls -lh /var/backups/ccw-erp/*.sql | tail -5

   # Restore
   ./deployment/scripts/rollback.sh --backup backup_YYYYMMDD_HHMMSS.sql
   ```

4. **Document**
   - What data was lost
   - Time range affected
   - Recovery actions taken

### Security Breach

1. **IMMEDIATE ACTIONS**

   ```bash
   # Rotate all secrets
   # - JWT_SECRET_KEY
   # - STRIPE_SECRET_KEY
   # - Database passwords
   # - API keys

   # Force all users to logout (invalidate all tokens)
   # Change JWT_SECRET_KEY in .env and redeploy
   ```

2. **Investigate**
   - Check access logs
   - Review Sentry errors
   - Check database audit logs

3. **Notify**
   - Security team
   - Legal team
   - Affected users (if required)

---

## Maintenance Windows

**Scheduled Maintenance:**

- Day: Sunday
- Time: 2:00 AM - 6:00 AM UTC
- Frequency: Monthly
- Notification: 48 hours advance

**Emergency Maintenance:**

- Approval: Team Lead
- Notification: Immediate
- Duration: As needed

---

## Contact Information

**On-Call Rotation:**

- Week 1: Developer A (phone, email)
- Week 2: Developer B (phone, email)
- Escalation: Team Lead (phone, email)

**Notification Channels:**

- Slack: #ccw-erp-critical
- Email: ops@ccw-erp.com
- PagerDuty: (if configured)

---

**Last Updated:** February 3, 2026
**Document Owner:** DevOps Team
**Review Frequency:** Monthly
**Next Review:** March 3, 2026
