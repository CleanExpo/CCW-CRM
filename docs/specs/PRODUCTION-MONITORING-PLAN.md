# Production Monitoring & Alerting - Implementation Plan

**Priority**: P0 CRITICAL
**Effort**: 4 points (1 day)
**Status**: 🟡 READY - No blockers
**Objective**: Setup Prometheus + Grafana monitoring stack with FastAPI instrumentation and alert rules

---

## Files to Create/Modify

### Docker Configuration
- [ ] `docker-compose.yml` — Add Prometheus, Grafana, AlertManager services
- [ ] `monitoring/prometheus/prometheus.yml` — Prometheus configuration (NEW)
- [ ] `monitoring/prometheus/alert_rules.yml` — Alert rules (NEW)
- [ ] `monitoring/grafana/dashboards/api_performance.json` — API dashboard (NEW)
- [ ] `monitoring/grafana/dashboards/business_metrics.json` — Business dashboard (NEW)
- [ ] `monitoring/grafana/provisioning/datasources.yml` — Grafana datasource config (NEW)
- [ ] `monitoring/grafana/provisioning/dashboards.yml` — Grafana dashboard config (NEW)
- [ ] `monitoring/alertmanager/config.yml` — AlertManager configuration (NEW)

### Backend Code
- [ ] `apps/backend/pyproject.toml` — Add prometheus-fastapi-instrumentator
- [ ] `apps/backend/src/api/main.py` — Add Prometheus metrics middleware
- [ ] `apps/backend/src/monitoring/metrics.py` — Custom business metrics (NEW)
- [ ] `apps/backend/src/monitoring/health.py` — Enhanced health check (NEW)

### Documentation
- [ ] `docs/operations/MONITORING-GUIDE.md` — Monitoring setup guide (NEW)
- [ ] `docs/operations/ALERT-RUNBOOK.md` — Alert response runbook (NEW)

---

## Implementation Steps

### Step 1: Add Docker Services (20 mins)

**Add to `docker-compose.yml`:**

```yaml
services:
  # ... existing services (postgres, redis, backend, web)

  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: ccw-prometheus
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    networks:
      - ccw-network

  grafana:
    image: grafana/grafana:10.2.2
    container_name: ccw-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=http://localhost:3001
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana-data:/var/lib/grafana
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    networks:
      - ccw-network

  alertmanager:
    image: prom/alertmanager:v0.26.0
    container_name: ccw-alertmanager
    restart: unless-stopped
    volumes:
      - ./monitoring/alertmanager:/etc/alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    networks:
      - ccw-network

volumes:
  prometheus-data:
  grafana-data:
```

### Step 2: Configure Prometheus (15 mins)

**Create `monitoring/prometheus/prometheus.yml`:**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Load alert rules
rule_files:
  - 'alert_rules.yml'

# AlertManager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Scrape configurations
scrape_configs:
  # Backend API metrics
  - job_name: 'ccw-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # PostgreSQL exporter (optional - requires postgres_exporter)
  # - job_name: 'postgres'
  #   static_configs:
  #     - targets: ['postgres-exporter:9187']

  # Redis exporter (optional - requires redis_exporter)
  # - job_name: 'redis'
  #   static_configs:
  #     - targets: ['redis-exporter:9121']
```

**Create `monitoring/prometheus/alert_rules.yml`:**

```yaml
groups:
  - name: api_performance
    interval: 30s
    rules:
      # High response time (warning)
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High API response time (p95 > 2s)"
          description: "p95 response time is {{ $value }}s for {{ $labels.path }}"

      # Critical response time
      - alert: CriticalResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: API response time (p95 > 5s)"
          description: "p95 response time is {{ $value }}s for {{ $labels.path }}"

      # High error rate (warning)
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High API error rate (>1%)"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.path }}"

      # Critical error rate
      - alert: CriticalErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: API error rate (>5%)"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.path }}"

  - name: database
    interval: 30s
    rules:
      # Database connection pool saturation
      - alert: DatabasePoolSaturation
        expr: (db_pool_active_connections / db_pool_size) > 0.8
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool >80% utilized"
          description: "Connection pool is {{ $value | humanizePercentage }} full"

  - name: cache
    interval: 30s
    rules:
      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: rate(cache_hits[5m]) / (rate(cache_hits[5m]) + rate(cache_misses[5m])) < 0.7
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis cache hit rate <70%"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"

  - name: business_metrics
    interval: 1m
    rules:
      # No orders in last 30 minutes (business hours only)
      - alert: NoOrders
        expr: increase(orders_created_total[30m]) == 0 and hour() >= 9 and hour() <= 17
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "No orders created in last 30 minutes"
          description: "Zero orders created during business hours"

      # POS reconciliation rate dropped
      - alert: LowReconciliationRate
        expr: pos_reconciliation_rate < 0.8
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "POS reconciliation rate <80%"
          description: "Reconciliation rate is {{ $value | humanizePercentage }}"
```

### Step 3: Add FastAPI Instrumentation (10 mins)

**Update `apps/backend/pyproject.toml`:**

```toml
dependencies = [
    # ... existing dependencies
    "prometheus-fastapi-instrumentator>=7.0.0",
]
```

**Update `apps/backend/src/api/main.py`:**

```python
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(...)

# ... existing middleware

# Add Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

### Step 4: Add Custom Business Metrics (20 mins)

**Create `apps/backend/src/monitoring/metrics.py`:**

```python
"""Custom business metrics for Prometheus."""

from prometheus_client import Counter, Gauge, Histogram

# Order metrics
orders_created = Counter(
    'orders_created_total',
    'Total number of orders created',
    ['status', 'location']
)

orders_revenue = Counter(
    'orders_revenue_total',
    'Total revenue from orders (AUD)',
    ['location']
)

orders_processing_time = Histogram(
    'orders_processing_seconds',
    'Time spent processing orders',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

# POS metrics
pos_transactions = Counter(
    'pos_transactions_total',
    'Total POS transactions',
    ['payment_method', 'location', 'status']
)

pos_reconciliation_rate = Gauge(
    'pos_reconciliation_rate',
    'POS transaction reconciliation rate (0.0-1.0)'
)

# Quote metrics
quotes_created = Counter(
    'quotes_created_total',
    'Total quotes created',
    ['status']
)

quotes_converted = Counter(
    'quotes_converted_total',
    'Quotes converted to orders'
)

# Database metrics
db_pool_size = Gauge(
    'db_pool_size',
    'Database connection pool size'
)

db_pool_active_connections = Gauge(
    'db_pool_active_connections',
    'Active database connections'
)

# Cache metrics
cache_hits = Counter('cache_hits', 'Cache hits', ['key_pattern'])
cache_misses = Counter('cache_misses', 'Cache misses', ['key_pattern'])

# AI metrics
ai_requests = Counter(
    'ai_requests_total',
    'AI API requests',
    ['agent', 'status']
)

ai_response_time = Histogram(
    'ai_response_seconds',
    'AI response time',
    ['agent'],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0]
)
```

**Update business logic to increment metrics:**

```python
# Example: In orders.py
from src.monitoring.metrics import orders_created, orders_revenue

@router.post("/api/orders")
async def create_order(...):
    # ... create order logic
    orders_created.labels(status=order.status, location=order.fulfillment_location).inc()
    orders_revenue.labels(location=order.fulfillment_location).inc(float(order.total))
    return order
```

### Step 5: Configure Grafana Dashboards (30 mins)

**Create `monitoring/grafana/provisioning/datasources.yml`:**

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**Create `monitoring/grafana/provisioning/dashboards.yml`:**

```yaml
apiVersion: 1

providers:
  - name: 'CCW Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

**Create `monitoring/grafana/dashboards/api_performance.json`:**

(Grafana dashboard JSON for API metrics - will be generated via Grafana UI then exported)

**Panels to include**:
- Request rate (requests/sec)
- Response time (p50, p95, p99)
- Error rate by endpoint
- Active connections
- Database pool utilization
- Cache hit rate

**Create `monitoring/grafana/dashboards/business_metrics.json`:**

(Grafana dashboard JSON for business metrics - will be generated via Grafana UI then exported)

**Panels to include**:
- Orders per hour
- Revenue per hour
- POS transactions per day
- Reconciliation rate
- Quote conversion rate
- Active users

### Step 6: Configure AlertManager (15 mins)

**Create `monitoring/alertmanager/config.yml`:**

```yaml
global:
  resolve_timeout: 5m

# Alert routing
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'

  routes:
    # Critical alerts go to multiple channels
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

    # Warning alerts go to email only
    - match:
        severity: warning
      receiver: 'warning-alerts'

# Alert receivers
receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'  # Placeholder

  - name: 'critical-alerts'
    email_configs:
      - to: 'dev-team@ccw-erp.com'
        from: 'alerts@ccw-erp.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@ccw-erp.com'
        auth_password: '${SMTP_PASSWORD}'
        headers:
          Subject: '🚨 CRITICAL ALERT: {{ .GroupLabels.alertname }}'

    # Slack webhook (optional)
    # slack_configs:
    #   - api_url: '${SLACK_WEBHOOK_URL}'
    #     channel: '#alerts'
    #     title: '🚨 {{ .GroupLabels.alertname }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'dev-team@ccw-erp.com'
        from: 'alerts@ccw-erp.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@ccw-erp.com'
        auth_password: '${SMTP_PASSWORD}'
        headers:
          Subject: '⚠️ WARNING: {{ .GroupLabels.alertname }}'

# Inhibition rules (suppress alerts)
inhibit_rules:
  # Suppress warning if critical is firing for same alert
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname']
```

---

## Testing Strategy

### Step 1: Verify Services Start
```bash
docker compose up -d prometheus grafana alertmanager
docker compose ps  # All should be "Up"
```

### Step 2: Access UIs
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
- AlertManager: http://localhost:9093

### Step 3: Verify Metrics Collection
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check backend metrics endpoint
curl http://localhost:8000/metrics
```

### Step 4: Test Alert Rules
```bash
# Trigger test alert (simulate high response time)
# Run load test to generate traffic
cd apps/backend/tests/load
python run_quick_load_test.py

# Check alert status in Prometheus
# Open http://localhost:9090/alerts
```

### Step 5: Verify Grafana Dashboards
- Login to Grafana (admin/admin)
- Navigate to Dashboards
- Verify data is visible for last 1 hour
- Check all panels load without errors

---

## Success Criteria

- ✅ Prometheus scraping metrics from backend at `/metrics`
- ✅ Grafana accessible at http://localhost:3001
- ✅ API Performance dashboard shows real-time data
- ✅ Business Metrics dashboard shows orders/revenue
- ✅ Alert rules visible in Prometheus (/alerts)
- ✅ Test alert successfully fires when triggered
- ✅ AlertManager receives and routes alerts
- ✅ Email notification sent for test alert (optional for MVP)

---

## Breaking Changes

**None** - This is additive only:
- No existing code modified (except main.py for metrics)
- No database schema changes
- No API contract changes
- No dependency conflicts

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Docker resource usage | MEDIUM | MEDIUM | Limit Prometheus retention to 7 days |
| Metrics overhead | LOW | LOW | Instrumentator adds <5ms per request |
| AlertManager spam | MEDIUM | LOW | Use inhibition rules, reasonable thresholds |
| Grafana storage growth | LOW | LOW | Use ephemeral storage for dashboards |

---

## Post-Implementation

### Documentation
- [ ] Write monitoring setup guide (operations team)
- [ ] Write alert runbook (on-call engineers)
- [ ] Document custom metrics (developers)

### Operational
- [ ] Configure SMTP credentials for email alerts
- [ ] Setup Slack webhook (optional)
- [ ] Train team on Grafana dashboards
- [ ] Define on-call rotation (if not exists)

### Future Enhancements
- [ ] Add PostgreSQL exporter for DB-level metrics
- [ ] Add Redis exporter for cache-level metrics
- [ ] Setup long-term metrics storage (Thanos/VictoriaMetrics)
- [ ] Add distributed tracing (Jaeger/Tempo)

---

## Estimated Timeline

| Task | Time | Cumulative |
|------|------|------------|
| Docker services | 20 mins | 20 mins |
| Prometheus config | 15 mins | 35 mins |
| FastAPI instrumentation | 10 mins | 45 mins |
| Custom metrics | 20 mins | 65 mins |
| Grafana dashboards | 30 mins | 95 mins |
| AlertManager config | 15 mins | 110 mins |
| Testing & verification | 30 mins | 140 mins |
| Documentation | 20 mins | 160 mins |

**Total:** ~2.5 hours (conservative: 4 hours with breaks)

---

## Approval Required

This plan is ready for implementation. Awaiting user approval to proceed.

**Expected Outcome**: Production monitoring stack operational in <4 hours, enabling proactive issue detection before customer impact.

---

**Plan Created By**: Claude Sonnet 4.5
**Date**: 2026-01-28
