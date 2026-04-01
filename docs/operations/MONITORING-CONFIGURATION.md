# Monitoring Configuration Guide

## Overview

This guide provides comprehensive monitoring configuration for the CCW Online ERP system, ensuring high availability, performance, and rapid incident response.

**Monitoring Stack**:
- Health Checks: Built-in FastAPI endpoints
- Error Tracking: Sentry
- Uptime Monitoring: UptimeRobot/Pingdom
- Log Aggregation: Papertrail/Logtail
- Metrics: Prometheus + Grafana (recommended)
- Alerts: PagerDuty/OpsGenie

---

## 1. Application Health Checks

### Built-In Health Endpoint

**Location**: `apps/backend/src/api/routes/health.py`

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ollama": "healthy",
    "openai": "healthy"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

**Health Check Logic**:
```python
async def health_check():
    """Comprehensive health check."""
    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "ollama": await check_ollama(),
        "openai": await check_openai(),
    }

    all_healthy = all(v == "healthy" for v in checks.values())

    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": checks,
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.version,
    }
```

### Uptime Monitoring

**Service**: UptimeRobot (https://uptimerobot.com)

**Configuration**:
1. Create monitor:
   - Type: HTTP(s)
   - URL: https://api.ccw-erp.example.com/health
   - Interval: 5 minutes
   - Method: GET
   - Expected Status: 200

2. Alert Contacts:
   - Email: ops@ccw-example.com
   - SMS: +1-XXX-XXX-XXXX
   - Slack: #alerts channel
   - PagerDuty: Integration key

3. Alert Rules:
   - Down: Immediate alert (1 failure)
   - Slow: Alert if response > 5s
   - Maintenance: Pause monitoring during windows

---

## 2. Error Tracking (Sentry)

### Backend Integration

**Install**:
```bash
cd apps/backend
pip install sentry-sdk[fastapi]
```

**Configuration** (`apps/backend/src/api/main.py`):
```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=settings.sentry_dsn,
    environment=settings.environment,
    traces_sample_rate=0.1,  # 10% of transactions
    profiles_sample_rate=0.1,  # 10% for profiling
    integrations=[
        FastApiIntegration(),
        SqlalchemyIntegration(),
    ],
    before_send=filter_sensitive_data,
)

def filter_sensitive_data(event, hint):
    """Remove sensitive data from error reports."""
    # Remove password fields
    if "request" in event and "data" in event["request"]:
        if "password" in event["request"]["data"]:
            event["request"]["data"]["password"] = "[REDACTED]"

    return event
```

### Frontend Integration

**Install**:
```bash
cd apps/web
pnpm add @sentry/nextjs
```

**Configuration** (`sentry.client.config.ts`):
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request?.data?.password) {
      event.request.data.password = "[REDACTED]";
    }
    return event;
  },
});
```

### Alert Rules

**Critical Errors**:
- Trigger: >10 errors/minute
- Notify: PagerDuty (page on-call)
- Escalate: After 5 minutes

**High Volume**:
- Trigger: >100 errors/hour
- Notify: Slack #alerts
- Escalate: After 30 minutes

**New Error Types**:
- Trigger: First occurrence
- Notify: Slack #alerts
- Review: Within 24 hours

---

## 3. Log Aggregation

### Structured Logging

**Backend** (`apps/backend/src/utils/logging.py`):
```python
import structlog

def setup_logging(debug: bool = False):
    """Configure structured logging."""
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

logger = structlog.get_logger(__name__)
logger.info("user_login", user_id="123", email="user@example.com")
```

### Log Service Configuration

**Option A: Papertrail**

1. Sign up at https://papertrailapp.com
2. Get endpoint: `logs.papertrailapp.com:12345`
3. Configure Docker:

```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logs.papertrailapp.com:12345"
        tag: "ccw-erp-backend-{{.ID}}"
        syslog-format: "rfc5424micro"
```

**Option B: Logtail (Better.Stack)**

```bash
# Install Vector agent
curl -sSfL https://sh.vector.dev | bash

# Configure Vector
cat > /etc/vector/vector.toml <<EOF
[sources.docker]
type = "docker_logs"

[sinks.logtail]
type = "http"
inputs = ["docker"]
uri = "https://in.logtail.com"
encoding.codec = "json"
request.headers.Authorization = "Bearer YOUR_SOURCE_TOKEN"
EOF

# Start Vector
systemctl start vector
```

### Log Query Examples

**Search for errors**:
```
level:error AND service:backend
```

**Search for slow queries**:
```
query_time_ms:>500 AND endpoint:/api/search/*
```

**Search for failed logins**:
```
event:login_failed AND (time:>1h)
```

---

## 4. Metrics (Prometheus + Grafana)

### Prometheus Setup

**Install**:
```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v prometheus-config:/etc/prometheus \
  -v prometheus-data:/prometheus \
  prom/prometheus
```

**Configuration** (`prometheus.yml`):
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'ccw-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Backend Metrics Endpoint

**Install**:
```bash
pip install prometheus-fastapi-instrumentator
```

**Configuration** (`apps/backend/src/api/main.py`):
```python
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(...)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

**Metrics Exposed**:
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Total requests by endpoint and status
- `http_requests_in_progress` - Current requests in flight
- Custom metrics (database queries, search latency, etc.)

### Custom Metrics

```python
from prometheus_client import Counter, Histogram

# Counters
search_requests = Counter(
    'search_requests_total',
    'Total search requests',
    ['search_type', 'language']
)

# Histograms
search_duration = Histogram(
    'search_duration_seconds',
    'Search request duration',
    ['search_type'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)

# Usage
@router.get("/search/semantic")
async def semantic_search(query: str, language: str):
    search_requests.labels(search_type="semantic", language=language).inc()

    with search_duration.labels(search_type="semantic").time():
        results = await search_service.search(query, language)

    return results
```

### Grafana Setup

**Install**:
```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  grafana/grafana
```

**Access**: http://localhost:3000 (admin/admin)

**Add Data Source**:
1. Configuration → Data Sources
2. Add Prometheus
3. URL: http://prometheus:9090
4. Save & Test

### Pre-Built Dashboards

**Import these dashboards**:
- FastAPI Instrumentation: Dashboard ID 17293
- PostgreSQL: Dashboard ID 9628
- Redis: Dashboard ID 11835
- Node Exporter: Dashboard ID 1860

**Custom Dashboard Panels**:

1. **Request Rate**:
```promql
rate(http_requests_total[5m])
```

2. **Error Rate**:
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

3. **p95 Latency**:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

4. **Database Connections**:
```promql
pg_stat_activity_count
```

5. **Redis Memory**:
```promql
redis_memory_used_bytes
```

---

## 5. Alert Configuration

### Alert Rules (Prometheus)

**File**: `prometheus-alerts.yml`

```yaml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanize }} requests/sec"

      # Slow API responses
      - alert: SlowApiResponse
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "API response time is slow"
          description: "p95 latency is {{ $value | humanize }}s"

      # High database connections
      - alert: HighDbConnections
        expr: pg_stat_activity_count > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "{{ $value }} active connections"

      # Service down
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} has been down for 2 minutes"
```

### Alertmanager Configuration

**File**: `alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: pagerduty
      continue: true
    - match:
        severity: warning
      receiver: slack
      continue: true

receivers:
  - name: 'default'
    email_configs:
      - to: 'ops@ccw-example.com'
        from: 'alerts@ccw-example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@ccw-example.com'
        auth_password: 'PASSWORD'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
        severity: '{{ .CommonLabels.severity }}'

  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: '{{ .CommonLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 6. Performance Monitoring

### Application Performance Monitoring (APM)

**Option A: Sentry Performance**

Already configured with `traces_sample_rate`:
- Tracks slow transactions
- Database query performance
- External API calls
- User flow tracking

**Option B: DataDog APM**

```python
from ddtrace import patch_all, tracer

patch_all()

tracer.configure(
    hostname='datadog-agent',
    port=8126,
    service_name='ccw-erp-backend',
)
```

### Database Query Monitoring

**Enable pg_stat_statements**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT
  substring(query for 100) as query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Auto-export to Prometheus**:
```bash
docker run -d \
  --name postgres-exporter \
  -p 9187:9187 \
  -e DATA_SOURCE_NAME="postgresql://user:pass@host:5432/db" \
  quay.io/prometheuscommunity/postgres-exporter
```

---

## 7. Monitoring Dashboard

### Key Metrics Dashboard

**Panel 1: System Health**
- Service uptime (%)
- Error rate (errors/minute)
- Request rate (requests/second)
- p95 latency (ms)

**Panel 2: Database**
- Active connections
- Query duration (p95)
- Cache hit rate
- Table sizes

**Panel 3: AI Features**
- Search requests (semantic/hybrid)
- Search latency (p95)
- Recommendation requests
- Embedding generation rate

**Panel 4: Business Metrics**
- Orders created (per hour)
- Revenue (daily)
- Active users (concurrent)
- Conversion rate

### Sample Dashboard JSON

Create `grafana-dashboard.json`:
```json
{
  "dashboard": {
    "title": "CCW ERP - Production Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

---

## 8. On-Call Procedures

### Incident Response Workflow

**1. Alert Received** (PagerDuty/Slack)
   - Acknowledge alert
   - Check dashboard for context
   - Review recent deployments

**2. Initial Assessment** (5 minutes)
   - Is service down? → Follow service restoration
   - Is service slow? → Follow performance troubleshooting
   - Is service degraded? → Follow degradation investigation

**3. Mitigation** (15-30 minutes)
   - Apply hotfix if available
   - Rollback if recent deployment
   - Scale resources if capacity issue
   - Enable maintenance mode if needed

**4. Resolution** (1-4 hours)
   - Fix root cause
   - Deploy fix
   - Verify resolution
   - Update stakeholders

**5. Post-Incident** (Next day)
   - Write post-mortem
   - Create action items
   - Update runbooks
   - Schedule retrospective

### Common Incident Playbooks

#### High Error Rate

```bash
# 1. Check recent deployments
git log --oneline -n 10

# 2. Check error logs
docker logs backend --tail=100 | grep ERROR

# 3. Check database
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 4. Rollback if recent deployment
vercel rollback (for frontend)
render rollback (for backend)

# 5. Monitor error rate decreasing
```

#### Slow API Response

```bash
# 1. Check database query performance
psql $DATABASE_URL -c "SELECT pid, now() - query_start as duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10;"

# 2. Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Check Redis
redis-cli -h $REDIS_HOST INFO stats

# 4. Scale if needed
docker-compose up -d --scale backend=3

# 5. Monitor latency decreasing
```

#### Database Connection Pool Exhausted

```bash
# 1. Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND now() - state_change > interval '10 minutes';"

# 2. Increase pool size temporarily
# Edit docker-compose.yml: increase DB_POOL_SIZE

# 3. Restart backend
docker-compose restart backend

# 4. Monitor connections
watch -n 5 'psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"'
```

---

## 9. Monitoring Checklist

### Daily Checks

- [ ] Review error rate (should be <0.1%)
- [ ] Check p95 latency (should be <500ms)
- [ ] Review new error types in Sentry
- [ ] Check disk space (should be <80%)
- [ ] Review slow queries

### Weekly Checks

- [ ] Review Grafana dashboards
- [ ] Check backup success rate
- [ ] Review security alerts
- [ ] Check dependency vulnerabilities
- [ ] Update monitoring documentation

### Monthly Checks

- [ ] Review alert thresholds (adjust if needed)
- [ ] Audit access logs
- [ ] Review capacity planning
- [ ] Update runbooks
- [ ] Test disaster recovery procedures

---

## 10. Contact Information

### Escalation Path

1. **Level 1**: On-call engineer (5 min response)
2. **Level 2**: Engineering manager (15 min response)
3. **Level 3**: CTO (30 min response)

### Service Providers

- **Sentry**: support@sentry.io
- **Vercel**: support@vercel.com
- **Supabase**: support@supabase.com
- **PagerDuty**: support@pagerduty.com

---

## Resources

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [FastAPI Monitoring](https://fastapi.tiangolo.com/advanced/middleware/)
