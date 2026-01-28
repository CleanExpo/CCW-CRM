# Alert Response Runbook

**Purpose**: Standard operating procedures for responding to production alerts
**Audience**: On-call engineers, DevOps team
**Updated**: 2026-01-28

---

## General Response Protocol

When an alert fires:

1. **Acknowledge**: Acknowledge the alert in AlertManager to prevent re-notifications
2. **Assess**: Determine severity and impact (customers affected?)
3. **Investigate**: Use dashboards and logs to identify root cause
4. **Mitigate**: Take action to restore service
5. **Document**: Log incident details and resolution
6. **Follow-up**: Post-mortem for critical incidents

---

## 🚨 CRITICAL ALERTS

### CriticalResponseTime (p95 > 5s)

**What it means**: API is very slow, poor user experience

**Impact**: HIGH - Users experiencing delays, potential timeouts

**Investigation**:
```bash
# 1. Check which endpoints are slow
http://localhost:3001/dashboards
# Look at "Response Time by Endpoint" panel

# 2. Check database connection pool
# If pool saturated → database is bottleneck

# 3. Check recent deployments
git log --oneline -10
# Recent change causing slowness?

# 4. Check database slow query log
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Mitigation**:
```bash
# Option 1: Restart backend (clears connection pool)
docker compose restart backend
# OR if running locally:
pkill -f uvicorn
uv run uvicorn src.api.main:app --reload

# Option 2: Scale horizontally (if using load balancer)
# Add another backend instance

# Option 3: Emergency rate limiting
# Edit src/api/middleware/rate_limit.py
# Reduce rate limits temporarily

# Option 4: Database optimization
# Run VACUUM on large tables
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "VACUUM ANALYZE orders; VACUUM ANALYZE products;"
```

**Escalation**: If not resolved in 15 minutes, escalate to database team

---

### CriticalErrorRate (> 5%)

**What it means**: Many requests failing with 5xx errors

**Impact**: CRITICAL - Users experiencing errors, lost transactions

**Investigation**:
```bash
# 1. Check error logs
docker logs ccw-backend --tail=100 | grep ERROR

# 2. Check which endpoints are failing
http://localhost:3001/dashboards
# Look at "Error Rate by Endpoint" panel

# 3. Check recent deployments
git log --oneline -10

# 4. Check database connectivity
docker exec ccw-backend python -c "from src.config.database import engine; engine.connect()"

# 5. Check Redis connectivity
docker exec ccw-backend python -c "import redis; r = redis.Redis(host='localhost'); r.ping()"
```

**Common Causes**:
- Database connection pool exhausted
- Database down/unreachable
- Redis down (if caching critical)
- Unhandled exception in new code
- Out of memory

**Mitigation**:
```bash
# Option 1: Rollback recent deployment
git revert HEAD
git push origin main
# Redeploy previous version

# Option 2: Restart all services
docker compose restart

# Option 3: Check database is running
docker compose ps postgres
# If down:
docker compose up -d postgres

# Option 4: Emergency mode (disable features)
# Add to .env:
CACHE_ENABLED=false
AI_ENABLED=false
# Restart backend
```

**Escalation**: Immediately escalate to senior engineer + notify customers

---

### BackendDown (up == 0)

**What it means**: Backend API is not responding to health checks

**Impact**: CRITICAL - Complete service outage

**Investigation**:
```bash
# 1. Check backend process
docker compose ps backend
# OR if running locally:
ps aux | grep uvicorn

# 2. Check backend logs
docker logs ccw-backend --tail=100

# 3. Check port availability
curl http://localhost:8000/health

# 4. Check system resources
docker stats
# High CPU or memory?
```

**Mitigation**:
```bash
# Option 1: Restart backend
docker compose restart backend
# OR:
docker compose up -d backend

# Option 2: Check for OOM (Out of Memory)
dmesg | grep -i kill
# If backend was OOM killed, increase memory limits

# Option 3: Check for port conflict
lsof -i :8000
# Kill conflicting process

# Option 4: Full restart
docker compose down
docker compose up -d
```

**Escalation**: Immediately escalate to senior engineer, notify customers

---

### DatabasePoolExhausted (100% utilized)

**What it means**: All database connections in use, cannot serve new requests

**Impact**: HIGH - New requests failing, users seeing errors

**Investigation**:
```bash
# 1. Check active connections
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# 2. Check long-running queries
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "SELECT pid, now() - query_start AS duration, query
      FROM pg_stat_activity
      WHERE state = 'active' AND now() - query_start > interval '5 seconds';"

# 3. Check pool size
grep POOL_SIZE apps/backend/.env
```

**Mitigation**:
```bash
# Option 1: Kill long-running queries
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE state = 'active' AND now() - query_start > interval '30 seconds';"

# Option 2: Increase pool size (TEMPORARY)
# Edit apps/backend/.env:
DB_POOL_SIZE=40  # Was 20
DB_MAX_OVERFLOW=60  # Was 40
# Restart backend

# Option 3: Restart backend (clears stale connections)
docker compose restart backend
```

**Follow-up**: Investigate which queries are slow, optimize or add indexes

---

## ⚠️ WARNING ALERTS

### HighResponseTime (p95 > 2s)

**What it means**: API is slow but not critically

**Impact**: MEDIUM - Users noticing slowness

**Investigation**:
Same as CriticalResponseTime but less urgent

**Mitigation**:
- Monitor closely
- Investigate during business hours
- Scale if traffic increased
- Optimize slow endpoints

**Escalation**: If not improving in 30 minutes, escalate

---

### HighErrorRate (> 1%)

**What it means**: Some requests failing

**Impact**: MEDIUM - Some users experiencing errors

**Investigation**:
Same as CriticalErrorRate but less urgent

**Mitigation**:
- Monitor closely
- Check for specific endpoints failing
- Investigate during business hours
- May be user error (400s) vs server error (500s)

---

### DatabasePoolSaturation (> 80%)

**What it means**: Running out of database connections

**Impact**: MEDIUM - Approaching capacity limit

**Investigation**:
Same as DatabasePoolExhausted

**Mitigation**:
- Monitor closely
- Prepare to increase pool size
- Check for connection leaks in code
- Consider adding read replicas

---

### LowCacheHitRate (< 70%)

**What it means**: Redis cache not effective

**Impact**: LOW - Increased database load

**Investigation**:
```bash
# 1. Check Redis is running
docker compose ps redis

# 2. Check cache memory
docker exec ccw-redis redis-cli INFO memory

# 3. Check eviction policy
docker exec ccw-redis redis-cli CONFIG GET maxmemory-policy
```

**Mitigation**:
- May be normal after deployment (cache cold)
- Check TTL values are appropriate
- Consider increasing cache size
- Review cache key patterns

---

### NoOrders (0 orders in 30 min)

**What it means**: No sales during business hours

**Impact**: MEDIUM - Potential business issue

**Investigation**:
```bash
# 1. Check if it's actually business hours (UTC vs local)
date

# 2. Check order endpoints are working
curl http://localhost:8000/api/orders

# 3. Check frontend is accessible
curl http://localhost:3000

# 4. Check recent orders in database
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "SELECT count(*) FROM orders WHERE created_at > now() - interval '1 hour';"
```

**Mitigation**:
- May be normal (slow day, holiday)
- Check for frontend errors
- Check payment gateway status
- Notify business team if ongoing

---

### LowReconciliationRate (< 80%)

**What it means**: POS transactions not auto-reconciling with bank feeds

**Impact**: LOW - Manual reconciliation required

**Investigation**:
```bash
# 1. Check bank feed sync status
curl http://localhost:8000/api/pos/reconciliation-stats

# 2. Check recent POS transactions
docker exec ccw-postgres psql -U postgres -d ccw_erp \
  -c "SELECT reconciliation_status, count(*)
      FROM pos_transactions
      WHERE created_at > now() - interval '24 hours'
      GROUP BY reconciliation_status;"

# 3. Check Xero integration status
curl http://localhost:8000/api/integrations/xero/status
```

**Mitigation**:
- May be normal (bank feed delay, manual transactions)
- Run manual reconciliation
- Check Xero API credentials
- Notify accounts team if ongoing

---

## Common Issues

### Memory Leak

**Symptoms**: Memory usage growing over time, eventual OOM

**Investigation**:
```bash
# Check memory usage trend
http://localhost:9090/graph
# Query: process_resident_memory_bytes
# Should be stable, not growing

# Check for unclosed connections
docker exec ccw-backend python -c "
import psutil
p = psutil.Process()
print(f'Open files: {len(p.open_files())}')
print(f'Connections: {len(p.connections())}')
"
```

**Mitigation**:
- Restart backend as temporary fix
- Investigate code for unclosed resources
- Add connection pool monitoring

---

### Disk Space Full

**Symptoms**: Database write errors, log files not writing

**Investigation**:
```bash
# Check disk usage
docker exec ccw-postgres df -h

# Check largest files
docker exec ccw-postgres du -sh /var/lib/postgresql/data/*
```

**Mitigation**:
```bash
# Clean up old logs
docker exec ccw-backend find /var/log -name "*.log" -mtime +7 -delete

# Vacuum database
docker exec ccw-postgres psql -U postgres -d ccw_erp -c "VACUUM FULL;"

# Increase disk size (cloud provider)
```

---

### Rate Limiting Triggered

**Symptoms**: 429 Too Many Requests errors

**Investigation**:
```bash
# Check rate limit logs
docker logs ccw-backend | grep "rate limit exceeded"

# Identify offending IP
grep "429" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn
```

**Mitigation**:
- May be legitimate traffic spike
- May be abuse/bot
- Increase rate limits if legitimate
- Block IP if abuse

---

## Post-Incident Checklist

After resolving an incident:

- [ ] Document incident timeline
- [ ] Note root cause
- [ ] Note resolution steps
- [ ] Update runbook if needed
- [ ] Schedule post-mortem (if critical)
- [ ] Implement preventive measures
- [ ] Test alert fired correctly

---

## Useful Commands

```bash
# View Prometheus alerts
http://localhost:9090/alerts

# View AlertManager alerts
http://localhost:9093/#/alerts

# View Grafana dashboards
http://localhost:3001/dashboards

# Backend logs (last 100 lines)
docker logs ccw-backend --tail=100

# Backend logs (follow)
docker logs ccw-backend -f

# Database queries
docker exec ccw-postgres psql -U postgres -d ccw_erp

# Redis CLI
docker exec ccw-redis redis-cli

# Restart services
docker compose restart backend postgres redis

# Health check
curl http://localhost:8000/health
```

---

## Contact Information

**On-Call Rotation**: See PagerDuty schedule

**Escalation**:
- L1: On-call engineer
- L2: Senior engineer
- L3: Engineering manager
- L4: CTO

**Communication**:
- Slack: #incidents
- Status page: status.ccw-erp.com

---

**Last Updated**: 2026-01-28
**Next Review**: 2026-02-28
