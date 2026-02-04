# ISS-020 VERIFICATION — Configure Alert Rules & Notifications

**Status**: ✅ COMPLETE
**Date**: February 2, 2026
**Related Issues**: ISS-019 (Prometheus/Grafana), ISS-021 (Sentry), ISS-022 (Uptime Monitoring)
**Related Documents**: [Prometheus Alerting](https://prometheus.io/docs/alerting/), [AlertManager Documentation](https://prometheus.io/docs/alerting/alertmanager/)

---

## Implementation Summary

ISS-020 validates comprehensive alert rules and notification configuration with Prometheus AlertManager for production monitoring. The system includes 24+ alert rules across 6 categories (API performance, system health, database, cache, infrastructure, business metrics) with severity-based routing to email, Slack, and PagerDuty channels.

**Alert Stack:**
- **Prometheus**: Alert rule evaluation every 15 seconds
- **AlertManager**: Notification routing and grouping
- **Email Notifications**: SMTP via Gmail with HTML templates
- **Slack Notifications**: Webhook integration (optional)
- **PagerDuty**: On-call escalation (optional)

**Alert Categories:**
- **API Performance**: Response time, error rate, request volume
- **System Health**: Memory usage, CPU usage, disk space
- **Database**: Connection pool, slow queries, replication lag
- **Cache**: Redis memory, hit ratio
- **Infrastructure**: Service availability (PostgreSQL, Redis)
- **Business Metrics**: Order processing, revenue anomalies

---

## Files Created/Enhanced

### NEW Files (2)
1. **scripts/verify-alert-rules.sh** (600+ lines)
   - Comprehensive alert configuration verification (15 categories)
   - Validates alert rules, AlertManager config, notifications
   - Tests Prometheus rules API and AlertManager status
   - Checks email, Slack, PagerDuty configuration
   - Exit codes: 0 (success/warnings), 1 (critical failures)

2. **docs/ISS-020-VERIFICATION.md** (this file)
   - Complete alert rules implementation summary
   - AlertManager configuration guide
   - Email/Slack/PagerDuty setup instructions
   - Alert testing procedures
   - Troubleshooting guide

### EXISTING Files Referenced
1. **monitoring/prometheus/alert_rules.yml** (265 lines)
   - 6 alert groups: api_performance, system_health, database, cache, infrastructure, business_metrics
   - 24+ comprehensive alert rules
   - Warning and critical severity levels
   - Alert annotations with summaries and descriptions

2. **monitoring/alertmanager/config.yml** (221 lines)
   - SMTP email configuration (Gmail)
   - Three receivers: default, critical-alerts, warning-alerts
   - Severity-based routing with different repeat intervals
   - HTML email templates
   - Slack configuration (commented out, ready to enable)
   - Inhibition rules to reduce alert noise

3. **monitoring/prometheus/prometheus.yml** (existing)
   - Alert rules file loaded: alert_rules.yml
   - AlertManager targets configured: alertmanager:9093
   - Evaluation interval: 15 seconds

4. **docker-compose.yml** (existing)
   - prometheus service: prom/prometheus:v2.48.0
   - alertmanager service: prom/alertmanager:v0.26.0

---

## Alert Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PROMETHEUS ALERTING ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐        ┌────────────────┐        ┌───────────────┐ │
│  │  PROMETHEUS    │        │  ALERTMANAGER  │        │  NOTIFICATION │ │
│  │  (EVALUATION)  │───────▶│  (ROUTING)     │───────▶│  CHANNELS     │ │
│  ├────────────────┤        ├────────────────┤        ├───────────────┤ │
│  │ • Scrape every │        │ • Group alerts │        │ • Email       │ │
│  │   15 seconds   │        │ • Route by     │        │ • Slack       │ │
│  │ • Evaluate     │        │   severity     │        │ • PagerDuty   │ │
│  │   rules every  │        │ • Inhibit      │        │ • Webhook     │ │
│  │   15 seconds   │        │   redundant    │        └───────────────┘ │
│  │ • 24+ rules    │        │ • Throttle     │                           │
│  │ • 6 groups     │        │   repeats      │                           │
│  └────────────────┘        └────────────────┘                           │
│           │                         │                                    │
│           ▼                         ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    ALERT FLOW                                     │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 1. Prometheus scrapes metrics from targets (15s interval)        │  │
│  │ 2. Prometheus evaluates alert rules (15s interval)               │  │
│  │ 3. Alert condition met (e.g., response time > 2s for 2m)         │  │
│  │ 4. Alert enters "pending" state (waits for "for" duration)       │  │
│  │ 5. Alert enters "firing" state → sent to AlertManager            │  │
│  │ 6. AlertManager groups alerts by [alertname, severity]           │  │
│  │ 7. AlertManager routes to receiver based on severity             │  │
│  │ 8. AlertManager inhibits redundant alerts                        │  │
│  │ 9. Notification sent to configured channels                      │  │
│  │ 10. AlertManager waits repeat_interval before re-sending         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              VERIFICATION CATEGORIES (15)                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 1. Alert Rules File           9. Routing Configuration           │  │
│  │ 2. Alert Groups               10. Inhibition Rules               │  │
│  │ 3. Required Alerts            11. AlertManager Status            │  │
│  │ 4. Alert Severity Levels      12. Alert Testing                  │  │
│  │ 5. Alert Annotations          13. Environment Variables          │  │
│  │ 6. Prometheus Rules API       14. Documentation                  │  │
│  │ 7. AlertManager Config        15. Production Readiness           │  │
│  │ 8. Notification Channels      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Features Implemented

### ✅ Alert Rules Configuration
- ✅ 6 alert groups defined (api_performance, system_health, database, cache, infrastructure, business_metrics)
- ✅ 24+ comprehensive alert rules
- ✅ Warning and critical severity levels
- ✅ Alert annotations with summaries and descriptions
- ✅ Proper "for" durations to reduce flapping
- ✅ Alert expressions using PromQL

### ✅ AlertManager Configuration
- ✅ Global SMTP configuration (Gmail)
- ✅ Three receivers: default, critical-alerts, warning-alerts
- ✅ Severity-based routing
- ✅ Different repeat intervals per severity (critical: 1h, warning: 3h)
- ✅ Alert grouping by [alertname, severity]
- ✅ HTML email templates with styled alerts
- ✅ Slack webhook configuration (commented out, ready to enable)
- ✅ Inhibition rules to reduce alert noise

### ✅ Critical Alert Rules (8 Required)
- ✅ HighResponseTime (response time > 2s for 2m)
- ✅ CriticalResponseTime (response time > 5s for 1m)
- ✅ HighErrorRate (error rate > 5% for 3m)
- ✅ CriticalErrorRate (error rate > 10% for 1m)
- ✅ BackendDown (backend unavailable for 1m)
- ✅ HighMemoryUsage (memory > 80% for 3m)
- ✅ PostgreSQLDown (PostgreSQL unavailable for 1m)
- ✅ RedisDown (Redis unavailable for 1m)

### ✅ Database Alert Rules
- ✅ DatabaseConnectionPoolSaturation (pool usage > 90%)
- ✅ DatabaseTooManyConnections (connections > 80% of max)
- ✅ DatabaseSlowQueries (query time > 1s)
- ✅ DatabaseReplicationLag (replication lag > 10s)

### ✅ Business Metrics Alert Rules
- ✅ NoOrdersPlaced (no orders in 1h during business hours)
- ✅ SlowOrderProcessing (order processing time > 5m)
- ✅ HighOrderFailureRate (order failure rate > 10%)

### ✅ Notification Channels
- ✅ Email notifications (SMTP via Gmail)
- ✅ HTML email templates with alert details
- ✅ Slack notifications (configured but commented out)
- ✅ PagerDuty integration (ready to configure)
- ✅ Webhook notifications (configurable)

### ✅ Alert Routing
- ✅ Severity-based routing (critical vs warning)
- ✅ Alert grouping by alertname and severity
- ✅ Group wait: 10s (wait for more alerts before sending)
- ✅ Group interval: 5m (wait before sending updates for same group)
- ✅ Repeat interval: 1h (critical), 3h (default)

### ✅ Inhibition Rules
- ✅ Suppress warnings if critical firing for same alert
- ✅ Suppress all alerts if BackendDown (root cause)
- ✅ Suppress DatabaseSlowQueries if DatabaseDown
- ✅ Suppress RedisDown if HighMemoryUsage (potential cause)

---

## Verification Script Details

### Location
`scripts/verify-alert-rules.sh`

### Usage

```bash
# Local verification
./scripts/verify-alert-rules.sh

# Production verification
PROMETHEUS_URL=https://prometheus.ccw-online.com \
ALERTMANAGER_URL=https://alertmanager.ccw-online.com \
./scripts/verify-alert-rules.sh

# Custom backend URL
BACKEND_URL=http://localhost:8001 ./scripts/verify-alert-rules.sh
```

### Verification Categories (15)

1. **Alert Rules File** - alert_rules.yml existence, YAML syntax validation
2. **Alert Groups** - Group count (6 groups), group names validation
3. **Required Alerts** - 8 critical alerts presence (HighResponseTime, HighErrorRate, BackendDown, etc.)
4. **Alert Severity Levels** - Warning and critical severity assignment
5. **Alert Annotations** - Summary and description annotations
6. **Prometheus Rules API** - /api/v1/rules endpoint accessibility, firing alerts detection
7. **AlertManager Configuration** - config.yml existence, receivers configuration
8. **Notification Channels** - Email, Slack, PagerDuty configuration validation
9. **Routing Configuration** - Severity-based routing, grouping, repeat intervals
10. **Inhibition Rules** - Inhibition rules presence, target/source matching
11. **AlertManager Status** - /api/v1/status endpoint accessibility, cluster status
12. **Alert Testing** - Instructions for creating test alerts
13. **Environment Variables** - SMTP_PASSWORD, SLACK_WEBHOOK_URL, PAGERDUTY_API_KEY
14. **Documentation** - Alert runbook, on-call schedule documentation
15. **Production Readiness** - Production deployment checklist

---

## Alert Rules Configuration

### api_performance Group

```yaml
- name: api_performance
  interval: 15s
  rules:
    - alert: HighResponseTime
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "High API response time detected"
        description: "95th percentile response time is {{ $value }}s (threshold: 2s)"

    - alert: CriticalResponseTime
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Critical API response time detected"
        description: "95th percentile response time is {{ $value }}s (threshold: 5s)"

    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
      for: 3m
      labels:
        severity: warning
      annotations:
        summary: "High API error rate detected"
        description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

    - alert: CriticalErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.10
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Critical API error rate detected"
        description: "Error rate is {{ $value | humanizePercentage }} (threshold: 10%)"
```

### system_health Group

```yaml
- name: system_health
  interval: 15s
  rules:
    - alert: HighMemoryUsage
      expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.80
      for: 3m
      labels:
        severity: warning
      annotations:
        summary: "High memory usage detected"
        description: "Memory usage is {{ $value | humanizePercentage }} (threshold: 80%)"

    - alert: CriticalMemoryUsage
      expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) > 0.90
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Critical memory usage detected"
        description: "Memory usage is {{ $value | humanizePercentage }} (threshold: 90%)"
```

### database Group

```yaml
- name: database
  interval: 30s
  rules:
    - alert: DatabaseConnectionPoolSaturation
      expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.90
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "Database connection pool near saturation"
        description: "Connection pool usage is {{ $value | humanizePercentage }} (threshold: 90%)"

    - alert: DatabaseTooManyConnections
      expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.80
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Database has too many connections"
        description: "Connection usage is {{ $value | humanizePercentage }} (threshold: 80%)"

    - alert: DatabaseSlowQueries
      expr: rate(pg_stat_statements_mean_exec_time[5m]) > 1000
      for: 3m
      labels:
        severity: warning
      annotations:
        summary: "Database slow queries detected"
        description: "Mean query execution time is {{ $value }}ms (threshold: 1000ms)"
```

### infrastructure Group

```yaml
- name: infrastructure
  interval: 15s
  rules:
    - alert: BackendDown
      expr: up{job="ccw-backend"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "CCW Backend is down"
        description: "Backend service has been unavailable for 1 minute"

    - alert: PostgreSQLDown
      expr: up{job="postgres"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "PostgreSQL is down"
        description: "PostgreSQL service has been unavailable for 1 minute"

    - alert: RedisDown
      expr: up{job="redis"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Redis is down"
        description: "Redis service has been unavailable for 1 minute"
```

---

## AlertManager Configuration

### Global SMTP Configuration

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@ccw-online.com'
  smtp_auth_username: 'alerts@ccw-online.com'
  smtp_auth_password: '${SMTP_PASSWORD}'
  smtp_require_tls: true
```

### Receivers

```yaml
receivers:
  - name: 'default'
    email_configs:
      - to: 'admin@ccw-online.com'
        html: |
          <h2>CCW-ERP Alert</h2>
          <p><strong>Alert:</strong> {{ .GroupLabels.alertname }}</p>
          <p><strong>Severity:</strong> {{ .GroupLabels.severity }}</p>
          <p><strong>Summary:</strong> {{ .CommonAnnotations.summary }}</p>
          <p><strong>Description:</strong> {{ .CommonAnnotations.description }}</p>

  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@ccw-online.com'
        html: |
          <h2 style="color: red;">🚨 CRITICAL ALERT</h2>
          <p><strong>Alert:</strong> {{ .GroupLabels.alertname }}</p>
          <p><strong>Severity:</strong> {{ .GroupLabels.severity }}</p>
          <p><strong>Summary:</strong> {{ .CommonAnnotations.summary }}</p>
          <p><strong>Description:</strong> {{ .CommonAnnotations.description }}</p>
    # Slack configuration (optional, uncomment to enable)
    # slack_configs:
    #   - api_url: '${SLACK_WEBHOOK_URL}'
    #     channel: '#alerts-critical'
    #     title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
    #     text: '{{ .CommonAnnotations.description }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'team@ccw-online.com'
        html: |
          <h2 style="color: orange;">⚠️ WARNING ALERT</h2>
          <p><strong>Alert:</strong> {{ .GroupLabels.alertname }}</p>
          <p><strong>Severity:</strong> {{ .GroupLabels.severity }}</p>
          <p><strong>Summary:</strong> {{ .CommonAnnotations.summary }}</p>
          <p><strong>Description:</strong> {{ .CommonAnnotations.description }}</p>
```

### Routing

```yaml
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 3h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
      repeat_interval: 1h
      continue: true

    - match:
        severity: warning
      receiver: 'warning-alerts'
      repeat_interval: 3h
```

### Inhibition Rules

```yaml
inhibit_rules:
  # Suppress warnings if critical is firing for the same alert
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname']

  # Suppress all alerts if the backend is down (root cause)
  - source_match:
      alertname: 'BackendDown'
    target_match_re:
      alertname: '.*'

  # Suppress DatabaseSlowQueries if DatabaseDown
  - source_match:
      alertname: 'PostgreSQLDown'
    target_match:
      alertname: 'DatabaseSlowQueries'

  # Suppress RedisDown if HighMemoryUsage (potential cause)
  - source_match:
      alertname: 'HighMemoryUsage'
    target_match:
      alertname: 'RedisDown'
```

---

## Success Criteria

### ✅ Alert Rules Configuration
- ✅ Alert rules file exists (monitoring/prometheus/alert_rules.yml)
- ✅ 6 alert groups defined
- ✅ 24+ comprehensive alert rules
- ✅ Warning and critical severity levels
- ✅ Alert annotations with summaries and descriptions
- ✅ Proper "for" durations to reduce flapping

### ✅ AlertManager Configuration
- ✅ AlertManager config file exists (monitoring/alertmanager/config.yml)
- ✅ SMTP email configuration (Gmail)
- ✅ Three receivers configured (default, critical-alerts, warning-alerts)
- ✅ Severity-based routing
- ✅ HTML email templates
- ✅ Inhibition rules to reduce alert noise

### ✅ Critical Alerts (8 Required)
- ✅ HighResponseTime alert defined
- ✅ HighErrorRate alert defined
- ✅ BackendDown alert defined
- ✅ HighMemoryUsage alert defined
- ✅ DatabaseConnectionPoolSaturation alert defined
- ✅ PostgreSQLDown alert defined
- ✅ RedisDown alert defined
- ✅ DatabaseSlowQueries alert defined

### ✅ Notification Channels
- ✅ Email notifications configured
- ✅ Slack configuration ready (commented out)
- ✅ PagerDuty integration ready (configurable)

### ⏳ Production Deployment (Pending)
- ⏳ SMTP credentials configured (SMTP_PASSWORD)
- ⏳ Email notifications tested
- ⏳ Slack webhook configured (SLACK_WEBHOOK_URL)
- ⏳ PagerDuty API key configured (PAGERDUTY_API_KEY)
- ⏳ On-call schedule defined
- ⏳ Alert runbook created

---

## Notification Setup Guide

### Email Notifications (Gmail)

1. **Create Gmail App Password**
   ```bash
   # Go to: https://myaccount.google.com/apppasswords
   # Generate app-specific password for "Mail"
   # Copy the 16-character password
   ```

2. **Configure Environment Variable**
   ```bash
   # Add to .env or docker-compose.yml
   export SMTP_PASSWORD="your-app-specific-password"
   ```

3. **Update AlertManager Config**
   ```yaml
   # monitoring/alertmanager/config.yml
   global:
     smtp_smarthost: 'smtp.gmail.com:587'
     smtp_from: 'alerts@ccw-online.com'  # Change to your email
     smtp_auth_username: 'alerts@ccw-online.com'
     smtp_auth_password: '${SMTP_PASSWORD}'
   ```

4. **Update Receiver Email Addresses**
   ```yaml
   receivers:
     - name: 'default'
       email_configs:
         - to: 'admin@ccw-online.com'  # Change to your email

     - name: 'critical-alerts'
       email_configs:
         - to: 'oncall@ccw-online.com'  # Change to your on-call email
   ```

5. **Restart AlertManager**
   ```bash
   docker-compose restart alertmanager
   ```

### Slack Notifications (Optional)

1. **Create Slack Incoming Webhook**
   ```bash
   # Go to: https://api.slack.com/apps
   # Create New App → Incoming Webhooks
   # Activate Incoming Webhooks
   # Add New Webhook to Workspace
   # Select channel (e.g., #alerts-critical)
   # Copy webhook URL
   ```

2. **Configure Environment Variable**
   ```bash
   # Add to .env or docker-compose.yml
   export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
   ```

3. **Uncomment Slack Configuration in AlertManager**
   ```yaml
   # monitoring/alertmanager/config.yml
   receivers:
     - name: 'critical-alerts'
       slack_configs:
         - api_url: '${SLACK_WEBHOOK_URL}'
           channel: '#alerts-critical'
           title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
           text: '{{ .CommonAnnotations.description }}'
   ```

4. **Restart AlertManager**
   ```bash
   docker-compose restart alertmanager
   ```

### PagerDuty Integration (Optional)

1. **Create PagerDuty Integration**
   ```bash
   # Go to: https://yourcompany.pagerduty.com/
   # Services → Select Service → Integrations → Add Integration
   # Integration Type: Prometheus (or Generic Events API v2)
   # Copy Integration Key
   ```

2. **Configure Environment Variable**
   ```bash
   # Add to .env or docker-compose.yml
   export PAGERDUTY_API_KEY="your-integration-key"
   ```

3. **Add PagerDuty Receiver to AlertManager**
   ```yaml
   # monitoring/alertmanager/config.yml
   receivers:
     - name: 'critical-alerts'
       pagerduty_configs:
         - service_key: '${PAGERDUTY_API_KEY}'
           description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
   ```

4. **Restart AlertManager**
   ```bash
   docker-compose restart alertmanager
   ```

---

## Testing Procedures

### Test Alert Creation

**Create a test alert manually:**

```bash
# Method 1: Using Prometheus amtool
docker exec ccw-alertmanager amtool alert add \
  alertname=TestAlert \
  severity=warning \
  summary="This is a test alert" \
  description="Testing AlertManager notification"

# Method 2: Using AlertManager API
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "This is a test alert",
      "description": "Testing AlertManager notification"
    }
  }]'
```

### Test Alert Rule Evaluation

**Trigger an alert by creating the condition:**

```bash
# Example: Trigger HighResponseTime alert
# Option 1: Generate load on the backend
ab -n 10000 -c 100 http://localhost:8000/api/products

# Option 2: Temporarily lower the threshold in alert_rules.yml
# Change: histogram_quantile(0.95, ...) > 2
# To:     histogram_quantile(0.95, ...) > 0.1
# Wait 2-3 minutes for Prometheus to evaluate

# Option 3: Trigger BackendDown alert
docker-compose stop backend
# Wait 1 minute for alert to fire
```

### Verify Alert Delivery

**Check AlertManager UI:**
```bash
# Open in browser
http://localhost:9093

# Check:
# - Alerts tab: See all active alerts
# - Silences tab: Manage alert silences
# - Status tab: Check receivers and routing
```

**Check email inbox:**
```bash
# Verify email received with alert details
# Check HTML formatting
# Verify correct severity and alert details
```

**Check Slack channel (if configured):**
```bash
# Verify message received in configured channel
# Check formatting and alert details
```

### Verify Inhibition Rules

**Test inhibition logic:**

```bash
# 1. Trigger a critical alert (e.g., CriticalResponseTime)
# 2. Verify related warning alert (HighResponseTime) is suppressed
# 3. Check AlertManager UI: Warning should show as "Inhibited"

# Example: Stop backend to trigger BackendDown
docker-compose stop backend
# Wait 1 minute
# Check AlertManager UI: All other alerts should be suppressed
```

---

## Troubleshooting

### Problem: Alerts Not Firing

**Solution:**
```bash
# Check Prometheus rules API
curl http://localhost:9090/api/v1/rules | jq

# Check if alert rules file is loaded
docker-compose logs prometheus | grep alert_rules.yml

# Verify alert expression syntax
docker exec ccw-prometheus promtool check rules /etc/prometheus/alert_rules.yml

# Check evaluation interval
curl http://localhost:9090/api/v1/status/config | jq '.data.yaml' | grep evaluation_interval
```

### Problem: AlertManager Not Receiving Alerts

**Solution:**
```bash
# Check AlertManager targets in Prometheus
curl http://localhost:9090/api/v1/alertmanagers | jq

# Check Prometheus logs for AlertManager errors
docker-compose logs prometheus | grep -i "alertmanager\|error"

# Verify AlertManager is accessible
curl http://localhost:9093/-/healthy

# Check AlertManager logs
docker-compose logs alertmanager
```

### Problem: Email Notifications Not Sent

**Solution:**
```bash
# Check AlertManager logs for SMTP errors
docker-compose logs alertmanager | grep -i "smtp\|email\|error"

# Verify SMTP credentials
echo $SMTP_PASSWORD  # Should not be empty

# Test SMTP connection manually
telnet smtp.gmail.com 587

# Verify AlertManager config syntax
docker exec ccw-alertmanager amtool check-config /etc/alertmanager/config.yml

# Check receiver configuration
curl http://localhost:9093/api/v1/status | jq '.data.config.receivers'
```

### Problem: Slack Notifications Not Sent

**Solution:**
```bash
# Check AlertManager logs for Slack errors
docker-compose logs alertmanager | grep -i "slack\|webhook\|error"

# Verify Slack webhook URL
echo $SLACK_WEBHOOK_URL  # Should start with https://hooks.slack.com/

# Test webhook manually
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message from AlertManager"}'

# Verify Slack configuration is uncommented in config.yml
cat monitoring/alertmanager/config.yml | grep -A5 "slack_configs"
```

### Problem: Too Many Alert Notifications

**Solution:**
```bash
# Increase repeat_interval to reduce notification frequency
# Edit monitoring/alertmanager/config.yml:
# repeat_interval: 3h  # Change from 1h to 3h

# Add more inhibition rules to suppress related alerts
# Edit monitoring/alertmanager/config.yml:
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname']

# Increase "for" duration in alert rules to reduce flapping
# Edit monitoring/prometheus/alert_rules.yml:
# for: 5m  # Change from 2m to 5m

# Restart AlertManager
docker-compose restart alertmanager
```

### Problem: Alerts Flapping (Firing and Resolving Repeatedly)

**Solution:**
```bash
# Increase "for" duration in alert rules
# Edit monitoring/prometheus/alert_rules.yml:
# for: 5m  # Increase from 2m

# Adjust alert thresholds
# Example: Change HighResponseTime from > 2s to > 3s

# Check if metrics are unstable
curl http://localhost:9090/api/v1/query?query=http_request_duration_seconds

# Add hysteresis by creating separate thresholds for firing and resolving
# (Requires custom recording rules)
```

---

## Next Steps

### Immediate
1. **Configure Email Notifications**
   ```bash
   # Generate Gmail app password
   # Add SMTP_PASSWORD to environment
   # Test email delivery with test alert
   ```

2. **Verify Alert Rules**
   ```bash
   ./scripts/verify-alert-rules.sh
   curl http://localhost:9090/api/v1/rules
   ```

3. **Create Alert Runbook**
   ```bash
   # Document response procedures for each alert
   # Create docs/ALERT_RUNBOOK.md
   # Include:
   # - Alert description
   # - Investigation steps
   # - Resolution steps
   # - Escalation contacts
   ```

### Short-term (Within 7 Days)
4. **Enable Slack Notifications** (if needed)
   - Create Slack webhook
   - Configure environment variable
   - Uncomment Slack configuration
   - Test delivery

5. **Configure On-Call Schedule**
   - Define on-call rotation
   - Update critical-alerts email address
   - Set up PagerDuty integration (if using)

6. **Tune Alert Thresholds**
   - Monitor alert frequency
   - Adjust thresholds based on baseline
   - Reduce false positives
   - Ensure critical alerts fire when needed

7. **Create Alert Dashboard**
   - Grafana dashboard showing alert status
   - Alert frequency metrics
   - Mean time to resolve (MTTR)
   - Alert trends

---

## Related Issues

### Prerequisites (Complete)
- ✅ **ISS-019**: Deploy Prometheus/Grafana - Monitoring infrastructure

### Current Issue
- ✅ **ISS-020**: Configure Alert Rules & Notifications - Production alerting

### Next Steps
- **ISS-021**: Integrate Sentry Error Tracking - Error monitoring
- **ISS-022**: Set Up Uptime Monitoring - External monitoring
- **ISS-023**: Create Operations Dashboards - Business metrics dashboards

---

## Sign-off

**Alert Rules & Notifications Configuration**: ✅ COMPLETE

**Date**: February 2, 2026

**Artifacts Delivered**:
1. ✅ scripts/verify-alert-rules.sh (600+ lines, 15 categories)
2. ✅ docs/ISS-020-VERIFICATION.md (this document)

**Alert Infrastructure**:
- ✅ 6 alert groups configured (api_performance, system_health, database, cache, infrastructure, business_metrics)
- ✅ 24+ comprehensive alert rules
- ✅ Warning and critical severity levels
- ✅ AlertManager configured with email notifications
- ✅ Severity-based routing (critical: 1h, warning: 3h)
- ✅ HTML email templates
- ✅ Slack configuration ready (commented out)
- ✅ Inhibition rules to reduce alert noise

**Testing Status**:
- ✅ Verification script tested
- ✅ Alert rules YAML syntax validated
- ✅ AlertManager config validated
- ⏳ Email notifications (pending SMTP credentials)
- ⏳ Slack notifications (pending webhook configuration)
- ⏳ PagerDuty integration (pending API key)
- ⏳ Test alerts sent and verified (pending email setup)

**Production Readiness**: ⏳ PENDING EMAIL CONFIGURATION
- Alert rules comprehensive and validated
- AlertManager routing configured
- Inhibition rules to reduce noise
- Awaiting SMTP credentials for email notifications
- Awaiting Slack webhook for Slack notifications (optional)
- Awaiting on-call schedule definition
- Awaiting alert runbook creation

**Approved by**: [Pending Review]

---

**End of ISS-020 Verification Document**
