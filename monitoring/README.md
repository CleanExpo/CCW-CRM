# Monitoring Infrastructure - CCW-Online ERP

Production monitoring stack with Prometheus, Grafana, Sentry, and Alertmanager.

## Overview

This monitoring infrastructure provides comprehensive observability for CCW-Online ERP:

### Components

| Component | Purpose | Access URL |
|-----------|---------|------------|
| **Prometheus** | Metrics collection & alerting | http://localhost:9090 |
| **Grafana** | Metrics visualization | http://localhost:3001 |
| **Alertmanager** | Alert routing & notifications | http://localhost:9093 |
| **Sentry** | Error tracking & performance | https://sentry.io |
| **Node Exporter** | System metrics | http://localhost:9100 |
| **Postgres Exporter** | Database metrics | http://localhost:9187 |
| **Redis Exporter** | Cache metrics | http://localhost:9121 |

### Key Metrics Tracked

**API Performance:**
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Active requests
- Success rate

**System Resources:**
- CPU usage
- Memory usage
- Disk I/O
- Network traffic

**Database:**
- Query performance
- Connection pool status
- Slow queries
- Database size

**Cache:**
- Hit/miss rate
- Memory usage
- Eviction rate
- Connection count

**Business Metrics:**
- Orders created
- Quotes generated
- Revenue
- Active subscriptions

---

## Quick Start

### 1. Configure Environment Variables

Create `.env` file in monitoring directory:

```bash
# Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_RELEASE=ccw-erp@1.0.0

# Grafana
GRAFANA_ADMIN_PASSWORD=secure-password-here

# Alertmanager - Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Alertmanager - Email
ALERT_EMAIL_TO=alerts@your-company.com
ALERT_EMAIL_FROM=noreply@ccw-erp.com
DB_TEAM_EMAIL=database-team@your-company.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 2. Start Monitoring Stack

```bash
cd monitoring

# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Check status
docker-compose -f docker-compose.monitoring.yml ps
```

### 3. Access Dashboards

**Grafana:**
```
URL: http://localhost:3001
Username: admin
Password: (from GRAFANA_ADMIN_PASSWORD env var or default: admin)
```

**Prometheus:**
```
URL: http://localhost:9090
Query examples:
  - rate(http_requests_total[5m])
  - histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Alertmanager:**
```
URL: http://localhost:9093
View active alerts and silences
```

### 4. Configure Sentry

1. Create Sentry account: https://sentry.io
2. Create new project for CCW-Online ERP
3. Copy DSN to environment variables
4. Restart backend application

---

## Grafana Dashboards

### Auto-Provisioned Dashboards

All dashboards are automatically loaded on Grafana startup via provisioning. No manual import required.

| Dashboard | UID | Description |
|-----------|-----|-------------|
| **System Overview** | `ccw-system-overview` | Service health, API rates, response times, error rates |
| **Database Performance** | `ccw-database-performance` | PostgreSQL connections, transactions, cache, locks |
| **Container Resources** | `ccw-container-resources` | CPU, memory, network, disk I/O per container |
| **Application Metrics** | `ccw-application-metrics` | Orders, quotes, auth, cache, background jobs |
| **Redis Metrics** | `redis-metrics` | Cache hit rate, memory, operations, evictions |
| **API Performance** | - | Request rates, response times by endpoint |
| **Business Metrics** | - | Orders, revenue, POS transactions, bank feeds |

### Dashboard Features

**System Overview Dashboard:**
- Service health status (Backend, PostgreSQL, Redis)
- Request rate by HTTP method
- Response time percentiles (P50, P95, P99)
- Error rates (4xx, 5xx)
- Slowest endpoints table
- Service uptime timeline

**Database Performance Dashboard:**
- Connection pool usage with max limit
- Transaction commit/rollback rates
- Row operations (insert/update/delete/fetch)
- Buffer cache hit rate
- Database locks over time
- Database size growth trend
- Connections by state (pie chart)

**Container Resources Dashboard:**
- Running container count
- Total CPU and memory usage
- Network Rx/Tx rates
- Per-container CPU and memory
- Container restart counts (24h)
- Memory limit utilization
- Host system CPU and memory

**Application Metrics Dashboard:**
- Orders and quotes created (24h)
- Quote conversion rate
- Authentication success rate
- Cache hit rate
- Background job queue depth
- API endpoint response times
- Cache hits vs misses
- Revenue tracking

### Dashboard File Locations

```
monitoring/grafana/
├── dashboards/                    # Dashboard JSON files
│   ├── system-overview.json
│   ├── postgresql_metrics.json
│   ├── container-resources.json
│   ├── application-metrics.json
│   ├── redis_metrics.json
│   ├── api-performance-dashboard.json
│   └── business_metrics.json
└── provisioning/
    ├── dashboards/
    │   └── dashboards.yml         # Dashboard provisioning config
    └── datasources/
        └── datasources.yml        # Prometheus datasource config
```

### Accessing Dashboards

After starting the monitoring stack, dashboards are available at:
- http://localhost:3001 (Grafana)
- Navigate to Dashboards → Browse → CCW ERP folder
- Or use direct links with dashboard UIDs:
  - System Overview: http://localhost:3001/d/ccw-system-overview
  - Database: http://localhost:3001/d/ccw-database-performance
  - Containers: http://localhost:3001/d/ccw-container-resources
  - Application: http://localhost:3001/d/ccw-application-metrics

### Creating Custom Dashboards

Example panel - Request Rate:
```
Query: rate(http_requests_total[5m])
Legend: {{method}} {{endpoint}}
Type: Graph
```

Example panel - p95 Response Time:
```
Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
Legend: p95
Type: Graph
Threshold: 0.5 (warning), 1.0 (critical)
```

---

## Alert Rules

### Production Alert Rules

All alert rules are defined in `prometheus/alert-rules-prod.yml`.

#### API Performance Alerts

**HighResponseTime**
- **Trigger:** p95 response time > 500ms for 5 minutes
- **Severity:** Warning
- **Action:** Investigate slow endpoints

**HighErrorRate**
- **Trigger:** Error rate > 5% for 5 minutes
- **Severity:** Critical
- **Action:** Immediate investigation required

#### System Resource Alerts

**HighCPUUsage**
- **Trigger:** CPU > 80% for 10 minutes
- **Severity:** Warning
- **Action:** Scale horizontally or optimize code

**HighMemoryUsage**
- **Trigger:** Memory > 85% for 10 minutes
- **Severity:** Warning
- **Action:** Investigate memory leaks or scale

#### Database Alerts

**PostgreSQLDown**
- **Trigger:** Database unreachable for 1 minute
- **Severity:** Critical
- **Action:** Immediate intervention required

**PostgreSQLSlowQueries**
- **Trigger:** Average query time > 10s for 5 minutes
- **Severity:** Warning
- **Action:** Review slow queries, add indexes

#### Cache Alerts

**RedisDown**
- **Trigger:** Redis unreachable for 1 minute
- **Severity:** Warning
- **Action:** Investigate cache failure (app continues with degraded performance)

**HighCacheMissRate**
- **Trigger:** Cache miss rate > 50% for 10 minutes
- **Severity:** Warning
- **Action:** Review cache strategy

### Notification Channels

Alerts are routed via Alertmanager to:

1. **Slack** (#ccw-erp-alerts, #ccw-erp-critical)
2. **Email** (critical alerts only)
3. **PagerDuty** (optional, for on-call)

### Testing Alerts

```bash
# Trigger high error rate alert (in development)
# Make 100 requests that return 500 errors
for i in {1..100}; do curl http://localhost:8000/api/trigger-error; done

# View pending alerts
curl http://localhost:9090/api/v1/alerts

# Silence an alert (1 hour)
curl -X POST http://localhost:9093/api/v1/silences \
  -d '{"matchers":[{"name":"alertname","value":"HighResponseTime"}],"startsAt":"2026-02-03T10:00:00Z","endsAt":"2026-02-03T11:00:00Z","comment":"Planned maintenance"}'
```

---

## Sentry Integration

### Backend Integration

Sentry is automatically initialized in `src/api/main.py`:

```python
from src.integrations.sentry_client import initialize_sentry

# Initialize on app startup
initialize_sentry()
```

### Frontend Integration

Add to `apps/web/app/layout.tsx`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Capturing Errors Manually

```python
# Backend
from src.integrations.sentry_client import capture_exception_with_context

try:
    risky_operation()
except Exception as e:
    capture_exception_with_context(e, user_id=user.id, operation="risky_op")
```

```typescript
// Frontend
import * as Sentry from "@sentry/nextjs";

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { operation: "risky_op" },
  });
}
```

### Release Tracking

Set release version via environment variable:

```bash
export SENTRY_RELEASE=$(git rev-parse HEAD)
```

Sentry will track errors per release, enabling:
- Release health monitoring
- Regression detection
- Source map uploads (frontend)

---

## Operations Runbook

### Common Tasks

#### Check System Health

```bash
# Prometheus targets status
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Grafana datasource health
curl -u admin:admin http://localhost:3001/api/datasources

# Alert status
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[]'
```

#### Restart Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml restart

# Or restart individual services
docker-compose -f docker-compose.monitoring.yml restart prometheus
docker-compose -f docker-compose.monitoring.yml restart grafana
```

#### Update Alert Rules

```bash
# Edit alert-rules-prod.yml
vim prometheus/alert-rules-prod.yml

# Reload Prometheus config (no downtime)
curl -X POST http://localhost:9090/-/reload
```

#### View Metrics in Terminal

```bash
# Request rate
curl -s 'http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])' | jq

# Response time p95
curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))' | jq

# CPU usage
curl -s 'http://localhost:9090/api/v1/query?query=100-(avg(irate(node_cpu_seconds_total{mode="idle"}[5m]))*100)' | jq
```

#### Export Grafana Dashboard

```bash
# Get dashboard UID
curl -u admin:admin http://localhost:3001/api/search | jq

# Export dashboard JSON
curl -u admin:admin http://localhost:3001/api/dashboards/uid/DASHBOARD_UID | jq > my-dashboard.json
```

---

## Troubleshooting

### Problem: Prometheus can't scrape backend metrics

**Solution:**
1. Check backend is running: `curl http://localhost:8000/api/health`
2. Check metrics endpoint: `curl http://localhost:8000/api/metrics`
3. Check Prometheus targets: http://localhost:9090/targets
4. Verify network connectivity between containers

### Problem: Grafana shows "No data"

**Solution:**
1. Check Prometheus datasource: Settings → Data Sources
2. Test connection: Should show "Data source is working"
3. Verify query syntax in panel
4. Check time range (default: Last 6 hours)

### Problem: Alerts not firing

**Solution:**
1. Check alert rules loaded: http://localhost:9090/rules
2. Verify alert condition: Run query in Prometheus
3. Check for duration (alert needs to be active for specified time)
4. Review Alertmanager logs: `docker logs ccw-alertmanager`

### Problem: Slack notifications not working

**Solution:**
1. Verify `SLACK_WEBHOOK_URL` is correct
2. Test webhook manually:
   ```bash
   curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test alert"}'
   ```
3. Check Alertmanager logs for errors
4. Verify channel exists and webhook has permissions

### Problem: Sentry not capturing errors

**Solution:**
1. Verify `SENTRY_DSN` is configured
2. Check Sentry initialization logs on startup
3. Trigger test error: `sentry_sdk.capture_message("Test")`
4. Check Sentry project settings (rate limits, filters)

---

## Performance Impact

Monitoring overhead:

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Prometheus | ~100MB | ~500MB | ~1GB/day (30-day retention) |
| Grafana | ~50MB | ~200MB | ~100MB |
| Alertmanager | ~20MB | ~50MB | ~10MB |
| Exporters | ~30MB | ~100MB | Minimal |
| **Total** | **~200MB** | **~850MB** | **~1GB/day** |

**Backend overhead:**
- Sentry SDK: <5% CPU, <50MB memory
- Metrics endpoint: <1ms per request

**Recommendation:** Run monitoring stack on same server for development, separate server for production.

---

## Maintenance

### Daily
- Check dashboard for anomalies
- Review error rate trends
- Verify backups running

### Weekly
- Review slow queries
- Check disk space (Prometheus data)
- Review Sentry error trends
- Test alert notifications

### Monthly
- Update Grafana dashboards
- Review and tune alert thresholds
- Clean up old Prometheus data
- Update documentation

### Quarterly
- Performance review (p95 trends)
- Capacity planning (scale up/out?)
- Security audit of monitoring stack
- Update monitoring tools (Prometheus, Grafana versions)

---

## Next Steps

1. **Configure Sentry** - Set up Sentry project and add DSN
2. **Create Slack Webhooks** - Set up channels and webhooks
3. **Import Dashboards** - Load pre-built Grafana dashboards
4. **Test Alerts** - Trigger test alerts and verify notifications
5. **Document Runbooks** - Add team-specific procedures
6. **Set Up On-Call** - Configure PagerDuty or similar
7. **Train Team** - Ensure everyone knows how to use dashboards

---

**Last Updated:** February 12, 2026
**Stack Version:** Prometheus 2.x, Grafana 10.x, Sentry Latest
**Maintenance:** Operations Team

---

## Changelog

### ISS-039: Grafana Dashboard Provisioning (2026-02-12)
- Added auto-provisioning for all dashboards (no manual import required)
- Created System Overview dashboard with service health and API metrics
- Enhanced Database Performance dashboard with comprehensive PostgreSQL metrics
- Created Container Resources dashboard for Docker container monitoring
- Created Application Metrics dashboard for business operations monitoring
- Fixed docker-compose volume mounts for proper provisioning
- All dashboards organized under "CCW ERP" folder in Grafana
