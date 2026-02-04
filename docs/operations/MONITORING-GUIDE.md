# Production Monitoring Guide

**Purpose**: Enable proactive detection of production issues before customer impact
**Stack**: Prometheus + Grafana + AlertManager
**Created**: 2026-01-28

---

## Quick Start

### 1. Start Monitoring Stack

```bash
# Start all monitoring services
docker compose up -d prometheus grafana alertmanager

# Verify services are running
docker compose ps

# Expected output:
# ccw-prometheus    Up    9090/tcp
# ccw-grafana       Up    3000/tcp
# ccw-alertmanager  Up    9093/tcp
```

### 2. Install Backend Dependencies

```bash
cd apps/backend
uv sync  # Installs prometheus-fastapi-instrumentator
```

### 3. Start Backend with Metrics

```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Backend now exposes /metrics endpoint
```

### 4. Access UIs

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://localhost:9090 | None |
| Grafana | http://localhost:3001 | admin/admin |
| AlertManager | http://localhost:9093 | None |

### 5. Configure Email Alerts (IMPORTANT)

**Enable email notifications for critical alerts:**

```bash
# 1. Get Gmail App Password (recommended for development)
# - Go to https://myaccount.google.com/apppasswords
# - Enable 2FA if not already enabled
# - Generate new App Password for "Mail"
# - Copy the 16-character password (no spaces)

# 2. Update .env file
cd apps/backend
nano .env  # or use your preferred editor

# Add this line:
SMTP_PASSWORD=your_16_character_app_password_here

# 3. Restart AlertManager to pick up environment variable
docker compose restart alertmanager

# 4. Test alert notification
cd ../..  # Return to project root
./scripts/test-alert.ps1  # Windows
# OR
./scripts/test-alert.sh   # Linux/Mac

# 5. Check your email (dev-team@ccw-erp.com)
# Should receive email within 30 seconds
```

**Alternative: SendGrid SMTP (recommended for production)**

```bash
# 1. Create SendGrid account (free tier: 100 emails/day)
# 2. Generate API key at https://app.sendgrid.com/settings/api_keys
# 3. Update .env:
SMTP_PASSWORD=your_sendgrid_api_key_here

# 4. Restart AlertManager
docker compose restart alertmanager
```

**Optional: Slack Notifications**

```bash
# 1. Create Slack App with Incoming Webhook
# 2. Get webhook URL from: https://api.slack.com/apps
# 3. Update .env:
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# 4. Restart AlertManager
docker compose restart alertmanager
```

**Verify Configuration**:
```bash
# Check AlertManager picked up environment variables
docker logs ccw-alertmanager | grep -i smtp

# Send test alert
./scripts/test-alert.ps1

# Check AlertManager UI for active alerts
# http://localhost:9093/#/alerts
```

---

## Architecture

```
┌──────────────┐
│   Backend    │
│   :8000      │──> /metrics endpoint (HTTP)
└──────┬───────┘
       │
       │ scrape every 15s
       ▼
┌──────────────┐
│  Prometheus  │
│   :9090      │──> Stores time-series data
└──────┬───────┘    Evaluates alert rules
       │
       ├──> Sends alerts ──┐
       │                   ▼
       │            ┌──────────────┐
       │            │ AlertManager │
       │            │   :9093      │──> Routes to email/Slack
       │            └──────────────┘
       │
       ▼
┌──────────────┐
│   Grafana    │
│   :3001      │──> Visualizes metrics
└──────────────┘    Dashboards
```

### Infrastructure Monitoring (Database + Cache)

The monitoring stack also includes exporters for PostgreSQL and Redis:

```
┌──────────────┐       ┌──────────────────┐
│  PostgreSQL  │──────>│ postgres-exporter│──> :9187/metrics
│   :5432      │       │                  │
└──────────────┘       └──────────────────┘
                              │
                              │ scrape
                              ▼
┌──────────────┐       ┌──────────────────┐
│    Redis     │──────>│  redis-exporter  │──> :9121/metrics
│   :6379      │       │                  │
└──────────────┘       └──────────────────┘
                              │
                              │ scrape
                              ▼
                       ┌──────────────┐
                       │  Prometheus  │
                       │   :9090      │
                       └──────────────┘
```

**What metrics are tracked:**
- **PostgreSQL**: connections, transactions/sec, database size, locks, row operations
- **Redis**: memory usage, cache hit rate, evictions, operations/sec, connected clients

**Dashboards available:**
- PostgreSQL Metrics (http://localhost:3001/d/postgresql-metrics)
- Redis Metrics (http://localhost:3001/d/redis-metrics)

---

## Dashboards

### API Performance Dashboard

**Panels**:
- Request Rate (req/sec) - Real-time traffic
- Response Time (p50, p95, p99) - Latency distribution
- Error Rate (%) - 5xx errors
- Active Requests - Concurrent requests
- Database Connection Pool - Pool utilization
- Cache Hit Rate (%) - Redis effectiveness

**How to Access**:
1. Navigate to http://localhost:3001
2. Login with admin/admin
3. Go to Dashboards → API Performance

**What to Look For**:
- ⚠️ p95 response time > 2s (warning)
- 🚨 p95 response time > 5s (critical)
- ⚠️ Error rate > 1% (warning)
- 🚨 Error rate > 5% (critical)
- ⚠️ DB pool > 80% (connection saturation)

### Business Metrics Dashboard

**Panels**:
- Orders per Hour - Order velocity
- Revenue per Hour (AUD) - Revenue trends
- POS Transactions per Day - Walk-in sales
- POS Reconciliation Rate - Auto-match success
- Quote Conversion Rate - Sales funnel efficiency
- Total Orders (24h) - Daily totals
- Total Revenue (24h) - Daily revenue
- POS Transactions (24h) - Daily POS activity

**How to Access**:
1. Navigate to http://localhost:3001
2. Go to Dashboards → Business Metrics

**What to Look For**:
- ⚠️ No orders in 30 minutes (during business hours)
- ⚠️ POS reconciliation rate < 80%
- 📊 Revenue trends (up/down)
- 📊 Quote conversion trends

---

## Alerts

### Configured Alert Rules

| Alert | Threshold | Severity | Duration | Description |
|-------|-----------|----------|----------|-------------|
| HighResponseTime | p95 > 2s | Warning | 2 min | API is slow |
| CriticalResponseTime | p95 > 5s | Critical | 1 min | API is very slow |
| HighErrorRate | > 1% | Warning | 2 min | Many errors |
| CriticalErrorRate | > 5% | Critical | 1 min | Very many errors |
| BackendDown | up == 0 | Critical | 1 min | Backend unreachable |
| DatabasePoolSaturation | > 80% | Warning | 2 min | Running out of connections |
| DatabasePoolExhausted | 100% | Critical | 1 min | No connections available |
| LowCacheHitRate | < 70% | Warning | 5 min | Cache ineffective |
| NoOrders | 0 orders/30min | Warning | 10 min | No sales (business hours) |
| LowReconciliationRate | < 80% | Warning | 1 hour | POS reconciliation failing |

### Alert Routing

```
All Alerts
    │
    ├─> severity:critical ──> Critical Alerts Receiver
    │                         ├─> Email: dev-team@ccw-erp.com
    │                         └─> Slack: #alerts-critical (optional)
    │
    └─> severity:warning ──> Warning Alerts Receiver
                              └─> Email: dev-team@ccw-erp.com
```

### Inhibition Rules

- **Critical suppresses Warning**: If a critical alert fires, warnings for the same issue are suppressed
- **BackendDown suppresses all**: If backend is down, all other alerts are suppressed (root cause)

---

## Metrics Reference

### Standard HTTP Metrics (Auto-instrumented)

These are automatically collected by `prometheus-fastapi-instrumentator`:

- `http_requests_total` - Total HTTP requests by method, path, status
- `http_request_duration_seconds` - Request duration histogram
- `http_requests_inprogress` - Active requests
- `process_resident_memory_bytes` - Memory usage
- `process_cpu_seconds_total` - CPU usage

### Custom Business Metrics

Defined in `apps/backend/src/monitoring/metrics.py`:

#### Orders
- `orders_created_total{status,location}` - Orders created count
- `orders_revenue_total{location}` - Revenue in AUD
- `orders_processing_seconds` - Processing time histogram

#### POS
- `pos_transactions_total{payment_method,location,status}` - POS transactions
- `pos_reconciliation_rate` - Reconciliation rate (0.0-1.0)
- `pos_transaction_amount_total{payment_method,location}` - Transaction amounts

#### Quotes
- `quotes_created_total{status}` - Quotes created
- `quotes_converted_total` - Quotes converted to orders
- `quotes_conversion_seconds` - Time to convert

#### Database
- `db_pool_size` - Connection pool size
- `db_pool_active_connections` - Active connections
- `db_pool_idle_connections` - Idle connections
- `db_query_duration_seconds{operation}` - Query execution time

#### Cache
- `cache_hits{key_pattern}` - Cache hits
- `cache_misses{key_pattern}` - Cache misses
- `cache_set_operations{key_pattern}` - Cache writes

#### AI
- `ai_requests_total{agent,status}` - AI requests
- `ai_response_seconds{agent}` - AI response time
- `ai_tokens_used_total{agent,model}` - Tokens consumed

#### Integrations
- `xero_api_calls_total{operation,status}` - Xero API calls
- `shopify_api_calls_total{operation,status}` - Shopify API calls
- `shopify_sync_duration_seconds{sync_type}` - Sync duration

---

## How to Use Metrics in Code

### Example: Increment Order Counter

```python
from src.monitoring.metrics import orders_created, orders_revenue

@router.post("/api/orders")
async def create_order(...):
    # ... create order logic

    # Increment counters
    orders_created.labels(
        status=order.status,
        location=order.fulfillment_location
    ).inc()

    orders_revenue.labels(
        location=order.fulfillment_location
    ).inc(float(order.total))

    return order
```

### Example: Track Processing Time

```python
from src.monitoring.metrics import orders_processing_time
import time

@router.post("/api/orders/{order_id}/confirm")
async def confirm_order(...):
    start_time = time.time()

    # ... processing logic

    duration = time.time() - start_time
    orders_processing_time.observe(duration)

    return order
```

### Example: Update Gauge

```python
from src.monitoring.metrics import pos_reconciliation_rate

async def update_reconciliation_rate():
    total = await db.execute(select(func.count()).select_from(POSTransaction))
    matched = await db.execute(
        select(func.count())
        .select_from(POSTransaction)
        .where(POSTransaction.reconciliation_status == "matched")
    )

    rate = matched / total if total > 0 else 0
    pos_reconciliation_rate.set(rate)
```

---

## Querying Prometheus

### Access Prometheus UI

http://localhost:9090/graph

### Example Queries

**Request rate by endpoint**:
```promql
rate(http_requests_total[5m])
```

**p95 response time**:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Error rate percentage**:
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
```

**Orders per hour**:
```promql
rate(orders_created_total[1h]) * 3600
```

**Revenue per day**:
```promql
increase(orders_revenue_total[24h])
```

**POS reconciliation rate**:
```promql
pos_reconciliation_rate * 100
```

---

## Troubleshooting

### Backend /metrics Endpoint Not Working

**Symptoms**: Prometheus shows target as down, `/metrics` returns 404

**Solution**:
```bash
# 1. Verify dependencies installed
cd apps/backend
uv sync

# 2. Restart backend
uv run uvicorn src.api.main:app --reload

# 3. Test metrics endpoint
curl http://localhost:8000/metrics

# Expected: Prometheus-formatted metrics text
```

### Prometheus Not Scraping Backend

**Symptoms**: "Backend is down" alert firing, no data in Grafana

**Solution**:
```bash
# 1. Check Prometheus targets
# Open http://localhost:9090/targets
# Look for ccw-backend target - should be UP

# 2. If using Docker for backend, update prometheus.yml:
# Change: host.docker.internal:8000
# To: backend:8000 (if backend is in docker-compose)

# 3. Reload Prometheus config
docker compose restart prometheus
```

### Grafana Shows "No Data"

**Symptoms**: Dashboards load but panels show "No data"

**Solution**:
```bash
# 1. Verify Prometheus datasource
# Grafana → Configuration → Data Sources → Prometheus
# Click "Save & Test" - should succeed

# 2. Verify metrics exist in Prometheus
# http://localhost:9090/graph
# Query: http_requests_total
# Should show data

# 3. Check time range in Grafana
# Top-right corner - change to "Last 1 hour"

# 4. Generate some traffic
cd apps/backend/tests/load
python run_quick_load_test.py
```

### Alerts Not Firing

**Symptoms**: Thresholds exceeded but no alert in AlertManager

**Solution**:
```bash
# 1. Check alert rules loaded
# http://localhost:9090/alerts
# All rules should be visible

# 2. Check alert status
# Look for "Firing" vs "Pending" vs "Inactive"

# 3. Check AlertManager status
# http://localhost:9093/#/alerts
# Should show active alerts

# 4. Verify alert_rules.yml syntax
docker logs ccw-prometheus
# Look for YAML parsing errors
```

---

## Production Configuration

### Email Alerts

Update `monitoring/alertmanager/config.yml`:

```yaml
receivers:
  - name: 'critical-alerts'
    email_configs:
      - to: 'dev-team@ccw-erp.com'
        from: 'alerts@ccw-erp.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@ccw-erp.com'
        auth_password: '${SMTP_PASSWORD}'  # Set in environment
        headers:
          Subject: '🚨 CRITICAL ALERT: {{ .GroupLabels.alertname }}'
```

**Environment Variable**:
```bash
# Add to .env or docker-compose.yml
SMTP_PASSWORD=your_smtp_password
```

### Slack Alerts

Update `monitoring/alertmanager/config.yml`:

```yaml
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

**Get Slack Webhook**:
1. Create Slack app at https://api.slack.com/apps
2. Enable "Incoming Webhooks"
3. Add webhook to workspace
4. Copy webhook URL to environment variable

---

## Maintenance

### Data Retention

**Prometheus**: 7 days (configured in docker-compose.yml)

To change retention:
```yaml
# docker-compose.yml
prometheus:
  command:
    - '--storage.tsdb.retention.time=30d'  # Change to 30 days
```

### Disk Usage

```bash
# Check Prometheus data size
docker exec ccw-prometheus du -sh /prometheus

# Check Grafana data size
docker exec ccw-grafana du -sh /var/lib/grafana
```

### Backup Dashboards

```bash
# Export dashboard JSON
# Grafana → Dashboard → Settings → JSON Model
# Copy JSON to monitoring/grafana/dashboards/
```

### Clean Up

```bash
# Stop monitoring services
docker compose stop prometheus grafana alertmanager

# Remove data (WARNING: Deletes all metrics)
docker volume rm ccw-online-erp_prometheus-data
docker volume rm ccw-online-erp_grafana-data

# Start fresh
docker compose up -d prometheus grafana alertmanager
```

---

## Email Alert Troubleshooting

### Email Not Received

**Issue**: Test alert sent but no email arrives

**Diagnosis**:
```bash
# 1. Check AlertManager logs
docker logs ccw-alertmanager --tail=50 | grep -i error

# 2. Verify SMTP_PASSWORD is set
docker exec ccw-alertmanager env | grep SMTP_PASSWORD
# Should show: SMTP_PASSWORD=your_password_here

# 3. Check alert was sent to AlertManager
curl -s http://localhost:9093/api/v2/alerts | grep TestAlert

# 4. Check AlertManager configuration
docker exec ccw-alertmanager cat /etc/alertmanager/config.yml | grep smtp
```

**Common Causes**:

1. **SMTP_PASSWORD not set or incorrect**
   ```bash
   # Solution: Update .env and restart
   echo "SMTP_PASSWORD=your_app_password_here" >> apps/backend/.env
   docker compose restart alertmanager
   ```

2. **Gmail App Password not generated**
   ```bash
   # Solution: Enable 2FA and generate App Password
   # https://myaccount.google.com/apppasswords
   # Use the 16-character password (no spaces)
   ```

3. **Email blocked by Gmail**
   ```bash
   # Check Gmail "Less secure app" setting
   # Or use SendGrid instead (recommended for production)
   ```

4. **Wrong email address in config.yml**
   ```bash
   # Verify email address in monitoring/alertmanager/config.yml
   grep "to:" monitoring/alertmanager/config.yml
   # Should show: to: 'dev-team@ccw-erp.com'
   ```

5. **Alert not routing to email receiver**
   ```bash
   # Check AlertManager UI
   # http://localhost:9093/#/alerts
   # Verify alert has severity label: critical or warning
   ```

### Slack Not Receiving Alerts

**Issue**: Slack webhook configured but no notifications

**Diagnosis**:
```bash
# 1. Verify SLACK_WEBHOOK_URL is set
docker exec ccw-alertmanager env | grep SLACK_WEBHOOK_URL

# 2. Test webhook manually
curl -X POST "${SLACK_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test from AlertManager"}'

# 3. Check AlertManager logs for webhook errors
docker logs ccw-alertmanager | grep -i slack
```

**Common Causes**:

1. **Webhook URL not set**
   ```bash
   # Add to .env:
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   docker compose restart alertmanager
   ```

2. **Invalid webhook URL**
   ```bash
   # Recreate webhook in Slack:
   # Slack App → Incoming Webhooks → Add New Webhook
   ```

3. **Slack workspace permissions**
   ```bash
   # Verify webhook has permission to post to channel
   # Check channel privacy settings
   ```

### Alerts Firing Too Frequently

**Issue**: Receiving duplicate emails for same alert

**Solution**:
```yaml
# Edit monitoring/alertmanager/config.yml
route:
  repeat_interval: 3h  # Only repeat after 3 hours

# Restart AlertManager
docker compose restart alertmanager
```

### HTML Email Not Rendering

**Issue**: Email received as plain text instead of HTML

**Cause**: Email client doesn't support HTML

**Solution**: Email templates include both HTML and plain text fallback. No action needed.

### Testing Different Alert Severities

```bash
# Test critical alert (email + Slack)
curl -X POST http://localhost:9093/api/v1/alerts -H "Content-Type: application/json" -d '[
  {
    "labels": {"alertname": "TestCritical", "severity": "critical"},
    "annotations": {"summary": "Critical test", "description": "This is a critical test alert"}
  }
]'

# Test warning alert (email only)
curl -X POST http://localhost:9093/api/v1/alerts -H "Content-Type: application/json" -d '[
  {
    "labels": {"alertname": "TestWarning", "severity": "warning"},
    "annotations": {"summary": "Warning test", "description": "This is a warning test alert"}
  }
]'
```

---

## Infrastructure Monitoring

### PostgreSQL Monitoring

**Exporter**: postgres_exporter (port 9187)
**Dashboard**: http://localhost:3001/d/postgresql-metrics

**Metrics Tracked**:
- **Connections**: Active connections vs max connections limit
- **Transaction Rate**: Commits/sec, rollbacks/sec
- **Database Size**: Total database size with warnings at 5GB, critical at 10GB
- **Row Operations**: Inserts/sec, updates/sec, deletes/sec
- **Locks**: Number of active database locks
- **Query Performance**: Long-running queries, slow queries

**Key Alerts**:

1. **PostgreSQLDown** (Critical)
   - Fires when: Postgres exporter unreachable for 1 minute
   - Action: Check database container status

2. **PostgreSQLTooManyConnections** (Critical)
   - Fires when: >90% of max connections in use for 2 minutes
   - Action: Investigate connection leaks, increase pool size

3. **PostgreSQLSlowQueries** (Warning)
   - Fires when: Long-running queries detected (>60s) for 5 minutes
   - Action: Review query performance, add indexes

4. **PostgreSQLDatabaseSizeHigh** (Warning)
   - Fires when: Database size >10GB for 5 minutes
   - Action: Review data retention policy, archive old data

**Useful Queries**:
```promql
# Connection pool utilization
sum(pg_stat_activity_count) / pg_settings_max_connections * 100

# Transaction rate
rate(pg_stat_database_xact_commit{datname="starter_db"}[5m])

# Database size growth rate
delta(pg_database_size_bytes{datname="starter_db"}[1h])

# Active locks
pg_locks_count
```

### Redis Monitoring

**Exporter**: redis_exporter (port 9121)
**Dashboard**: http://localhost:3001/d/redis-metrics

**Metrics Tracked**:
- **Memory Usage**: Used memory vs max memory limit
- **Cache Hit Rate**: Percentage of cache hits vs total requests
- **Evictions**: Keys evicted due to memory pressure
- **Operations**: Commands processed per second
- **Connections**: Connected clients
- **Network I/O**: Input/output bytes per second

**Key Alerts**:

1. **RedisDown** (Critical)
   - Fires when: Redis exporter unreachable for 1 minute
   - Action: Check Redis container status

2. **RedisMemoryCritical** (Critical)
   - Fires when: >95% of max memory in use for 2 minutes
   - Action: Increase max memory, review cache expiration policy

3. **RedisMemoryHigh** (Warning)
   - Fires when: >80% of max memory in use for 5 minutes
   - Action: Monitor memory growth, consider increasing limit

4. **RedisCacheHitRateLow** (Warning)
   - Fires when: Cache hit rate <70% for 10 minutes
   - Action: Review cache strategy, adjust TTL values

5. **RedisEvictingKeys** (Warning)
   - Fires when: >10 keys/sec being evicted for 5 minutes
   - Action: Increase max memory or review cache policy

6. **RedisTooManyConnections** (Warning)
   - Fires when: >100 client connections for 5 minutes
   - Action: Review connection pooling, check for leaks

**Useful Queries**:
```promql
# Cache hit rate percentage
rate(redis_keyspace_hits_total[5m]) / (rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m])) * 100

# Memory usage percentage
redis_memory_used_bytes / redis_memory_max_bytes * 100

# Eviction rate
rate(redis_evicted_keys_total[5m])

# Operations per second
rate(redis_commands_processed_total[5m])
```

### Troubleshooting Infrastructure Alerts

**PostgreSQL connection pool exhausted:**
```bash
# Check active connections
docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '5 minutes';"

# Increase max connections (edit docker-compose.yml)
# Add to postgres service:
# command: postgres -c max_connections=200
```

**Redis memory high:**
```bash
# Check memory usage
docker exec nodejs-starter-redis redis-cli INFO memory

# Check cache hit rate
docker exec nodejs-starter-redis redis-cli INFO stats | grep keyspace

# Flush all keys (CAUTION: Only in dev)
docker exec nodejs-starter-redis redis-cli FLUSHALL

# Increase max memory (edit docker-compose.yml)
# Add to redis service:
# command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

**Slow PostgreSQL queries:**
```bash
# View active queries
docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"

# Kill long-running query
docker exec nodejs-starter-postgres psql -U starter_user -d starter_db -c "SELECT pg_terminate_backend(PID);"
```

---

## Next Steps

1. ✅ **Configure Email/Slack**: Setup alert notifications for production
2. ✅ **Add Database/Redis Exporters**: Get deeper infrastructure metrics
3. **Add Custom Metrics**: Instrument critical business paths
4. **Create More Dashboards**: Add dashboards for specific features
5. **Setup Long-term Storage**: Add Thanos/VictoriaMetrics for >7 day retention
6. **Enable Distributed Tracing**: Add Jaeger/Tempo for request tracing

---

## Support

**Documentation**:
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/
- AlertManager: https://prometheus.io/docs/alerting/latest/alertmanager/

**Questions**: Contact dev team or check `docs/operations/ALERT-RUNBOOK.md`

---

**Last Updated**: 2026-01-29
**Maintained By**: CCW ERP Team
