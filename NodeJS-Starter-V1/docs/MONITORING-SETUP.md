# Prometheus + Grafana Monitoring Setup

Complete guide for deploying and configuring the monitoring stack for CCW-Online ERP.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Configuration](#configuration)
6. [Dashboards](#dashboards)
7. [Alerting](#alerting)
8. [Metrics Reference](#metrics-reference)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Overview

The monitoring stack provides comprehensive observability for the CCW-Online ERP system:

### What's Included

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Exporters**: PostgreSQL and Redis metrics
- **4 Pre-configured Dashboards**:
  - Application Performance
  - Infrastructure Health
  - Business Metrics
  - AI Agent Performance
- **Alert Rules**: 15+ pre-configured alerts
- **Custom Metrics**: 40+ application-specific metrics

### Key Features

- **Real-time Monitoring**: 15-second scrape intervals
- **30-Day Retention**: Historical data for trend analysis
- **Auto-Discovery**: Kubernetes service discovery
- **RBAC Enabled**: Secure cluster access
- **TLS Secured**: HTTPS access via Ingress
- **High Availability**: Can be scaled to multiple replicas

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring Namespace                          │
│                                                                   │
│  ┌──────────────┐           ┌──────────────┐                   │
│  │  Prometheus  │◄──────────│   Grafana    │                   │
│  │   Server     │   Query   │              │                   │
│  │              │           │  Dashboards  │                   │
│  └──────┬───────┘           └──────────────┘                   │
│         │                                                        │
│         │ Scrape Metrics                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Service Discovery (K8s API)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
                          │
                          │ Scrape via annotations
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CCW-ERP Namespace                           │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Backend  │  │ Frontend │  │  Celery  │  │PostgreSQL│       │
│  │  Pods    │  │   Pods   │  │  Workers │  │ Exporter │       │
│  │ /metrics │  │ /metrics │  │          │  │ /metrics │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                   │
│  ┌──────────┐                                                    │
│  │  Redis   │                                                    │
│  │ Exporter │                                                    │
│  │ /metrics │                                                    │
│  └──────────┘                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Metrics Flow

1. **Application Metrics**: Backend exposes `/metrics` endpoint (FastAPI middleware)
2. **Infrastructure Metrics**: Exporters expose PostgreSQL/Redis metrics
3. **Kubernetes Metrics**: Prometheus discovers services via K8s API
4. **Storage**: Prometheus stores time-series data (30-day retention)
5. **Visualization**: Grafana queries Prometheus and displays dashboards
6. **Alerting**: Prometheus evaluates alert rules and triggers notifications

---

## Prerequisites

### 1. Kubernetes Cluster

- Kubernetes 1.23+ (tested on 1.28+)
- Metrics Server installed (for HPA metrics)
- Ingress Controller (Nginx recommended)
- cert-manager (for TLS certificates)

### 2. Storage

- StorageClass with dynamic provisioning
- 20GB for Prometheus data
- 10GB for Grafana data

### 3. Tools

```bash
# Check prerequisites
kubectl version --short
kubectl get storageclass
kubectl get ingressclass
```

### 4. DNS Configuration

You'll need DNS records for:
- `prometheus.your-domain.com` → Ingress IP
- `grafana.your-domain.com` → Ingress IP

---

## Quick Start

### Automated Deployment

**Linux/Mac:**
```bash
# Dry run (preview changes)
./scripts/deploy-monitoring.sh --dry-run

# Deploy
./scripts/deploy-monitoring.sh
```

**Windows:**
```powershell
# Dry run
.\scripts\deploy-monitoring.ps1 -DryRun

# Deploy
.\scripts\deploy-monitoring.ps1
```

### Manual Deployment

```bash
# 1. Create namespace
kubectl apply -f k8s/monitoring/namespace.yaml

# 2. Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus-config.yaml
kubectl apply -f k8s/monitoring/prometheus-deployment.yaml

# 3. Deploy Grafana
kubectl apply -f k8s/monitoring/grafana-deployment.yaml
kubectl apply -f k8s/monitoring/grafana-dashboards.yaml

# 4. Deploy Exporters
kubectl apply -f k8s/monitoring/exporters/postgres-exporter.yaml
kubectl apply -f k8s/monitoring/exporters/redis-exporter.yaml

# 5. Deploy Ingress
kubectl apply -f k8s/monitoring/ingress.yaml

# 6. Verify deployment
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

### Access Monitoring Stack

**Option 1: Via Ingress (Production)**
- Prometheus: https://prometheus.your-domain.com
- Grafana: https://grafana.your-domain.com

**Option 2: Port Forwarding (Local)**
```bash
# Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Access: http://localhost:9090

# Grafana
kubectl port-forward svc/grafana 3000:3000 -n monitoring
# Access: http://localhost:3000
```

**Default Credentials:**
- Username: `admin`
- Password: `admin` (⚠️ CHANGE IMMEDIATELY!)

---

## Configuration

### Update Domain Names

Edit `k8s/monitoring/ingress.yaml`:
```yaml
spec:
  tls:
    - hosts:
        - prometheus.your-domain.com  # ← Change this
        - grafana.your-domain.com     # ← Change this
  rules:
    - host: prometheus.your-domain.com  # ← Change this
    - host: grafana.your-domain.com     # ← Change this
```

### Change Grafana Password

**Via UI:**
1. Login with admin/admin
2. Click user icon → Change Password
3. Enter new password

**Via kubectl:**
```bash
# Update secret
kubectl create secret generic grafana-secret \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=NEW_PASSWORD \
  --namespace=monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Grafana
kubectl rollout restart deployment/grafana -n monitoring
```

### Adjust Retention Period

Edit `k8s/monitoring/prometheus-deployment.yaml`:
```yaml
args:
  - '--storage.tsdb.retention.time=30d'  # ← Change retention period
  - '--storage.tsdb.retention.size=15GB' # ← Change max storage size
```

### Add Custom Alert Rules

Edit `k8s/monitoring/prometheus-config.yaml` in the `alerts.yml` section:
```yaml
- alert: CustomAlert
  expr: your_metric > threshold
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Custom alert triggered"
    description: "Details: {{ $value }}"
```

Apply changes:
```bash
kubectl apply -f k8s/monitoring/prometheus-config.yaml
# Reload Prometheus configuration
kubectl exec -it deployment/prometheus -n monitoring -- kill -HUP 1
```

---

## Dashboards

### Pre-configured Dashboards

#### 1. Application Performance Dashboard
**Metrics:**
- Request rate (req/s) by service
- Request latency (p50, p95, p99)
- Error rate (5xx responses)
- Active pods count
- WebSocket connections
- Celery queue length

**Use Cases:**
- Monitor API performance
- Identify slow endpoints
- Track error spikes
- Verify auto-scaling behavior

#### 2. Infrastructure Health Dashboard
**Metrics:**
- CPU usage by pod
- Memory usage by pod
- Pod restart count
- HPA status (current/desired replicas)
- Network I/O
- Disk I/O

**Use Cases:**
- Resource utilization analysis
- Identify resource bottlenecks
- Monitor pod stability
- Verify HPA triggers

#### 3. Business Metrics Dashboard
**Metrics:**
- Orders per hour
- Revenue per day
- Inventory turnover
- Customer satisfaction score
- Backorder fill rate
- Quote conversion rate

**Use Cases:**
- Track business KPIs
- Monitor operational efficiency
- Identify trends
- Generate reports

#### 4. AI Agent Performance Dashboard
**Metrics:**
- Agent decisions per minute
- Agent decision latency
- Auto-execution rate
- Human override rate
- Agent confidence scores
- Agent success rate

**Use Cases:**
- Monitor agent autonomy
- Identify learning opportunities
- Track agent reliability
- Optimize thresholds

### Import Additional Dashboards

Grafana has 1000+ community dashboards at grafana.com/dashboards.

**Recommended Dashboards:**
- **1860**: Node Exporter Full
- **3662**: Prometheus 2.0 Overview
- **6417**: Kubernetes Cluster Monitoring
- **9628**: PostgreSQL Database
- **763**: Redis Dashboard

**Import Steps:**
1. Go to Grafana → Dashboards → Import
2. Enter dashboard ID (e.g., 1860)
3. Select Prometheus datasource
4. Click Import

### Create Custom Dashboard

**Via UI:**
1. Grafana → Dashboards → New Dashboard
2. Add Panel → Select visualization type
3. Configure query (PromQL)
4. Save dashboard

**Example Query:**
```promql
# Request rate for backend service
rate(http_requests_total{service="backend"}[5m])

# 95th percentile latency
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[5m])
)

# Error rate percentage
(
  rate(http_requests_total{status=~"5.."}[5m]) /
  rate(http_requests_total[5m])
) * 100
```

---

## Alerting

### Alert Rules Included

**Application Alerts:**
1. **HighErrorRate**: Error rate > 5% for 5 minutes
2. **HighResponseTime**: p95 latency > 1 second for 5 minutes
3. **ServiceDown**: Service unreachable for 2 minutes
4. **DatabaseConnectionPoolExhausted**: Connection pool > 90% for 5 minutes
5. **CeleryQueueBacklog**: Queue length > 1000 for 10 minutes
6. **WebSocketConnectionSurge**: Connection rate > 100/sec for 5 minutes

**Infrastructure Alerts:**
7. **HighCPUUsage**: CPU > 80% for 5 minutes
8. **HighMemoryUsage**: Memory > 85% for 5 minutes
9. **PodRestartLoop**: Pod restarting frequently (> 0/15min)
10. **HPAMaxedOut**: HPA at max replicas for 15 minutes

### Configure Alert Notifications

#### Option 1: Grafana Alerting (Recommended)

**Email Notifications:**
1. Grafana → Alerting → Contact Points
2. New Contact Point → Email
3. Configure SMTP settings:
   ```yaml
   SMTP Host: smtp.gmail.com:587
   From Address: alerts@your-domain.com
   Username: your-email@gmail.com
   Password: app-password
   ```
4. Test and Save

**Slack Notifications:**
1. Create Slack Incoming Webhook
2. Grafana → Alerting → Contact Points
3. New Contact Point → Slack
4. Paste webhook URL
5. Test and Save

**PagerDuty Integration:**
1. Get PagerDuty integration key
2. Grafana → Alerting → Contact Points
3. New Contact Point → PagerDuty
4. Enter integration key
5. Test and Save

#### Option 2: Alertmanager (Advanced)

Deploy Alertmanager separately:
```bash
# Create Alertmanager configuration
kubectl apply -f k8s/monitoring/alertmanager-config.yaml
kubectl apply -f k8s/monitoring/alertmanager-deployment.yaml
```

Configure Prometheus to use Alertmanager:
```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Silence Alerts

**Temporary Silence (Maintenance Window):**
```bash
# Via Prometheus UI
# Go to Alerts → Select Alert → Silence
# Set duration and reason
```

**Permanent Disable:**
```yaml
# Comment out or remove alert rule in prometheus-config.yaml
# - alert: AlertName
#   expr: ...
```

---

## Metrics Reference

### HTTP Metrics

```promql
# Total requests
http_requests_total

# Request duration histogram
http_request_duration_seconds_bucket

# In-progress requests
http_requests_in_progress
```

**Labels:** `method`, `path`, `status`

### Database Metrics

```promql
# Connection pool size
db_pool_connections_total
db_pool_connections_used
db_pool_connections_available

# Query duration
db_query_duration_seconds
```

**Labels:** `query_type`

### Redis Metrics

```promql
# Total connections
redis_connections_total

# Commands executed
redis_commands_total

# Command duration
redis_command_duration_seconds
```

**Labels:** `command`

### Celery Metrics

```promql
# Task count
celery_tasks_total

# Task duration
celery_task_duration_seconds

# Queue length
celery_queue_length

# Active workers
celery_workers_total
```

**Labels:** `task_name`, `status`, `queue`

### WebSocket Metrics

```promql
# Active connections
websocket_connections_active

# Total connections
websocket_connections_total

# Messages
websocket_messages_total
```

**Labels:** `event`, `direction`

### Business Metrics

```promql
# Orders
business_orders_created_total
business_orders_fulfilled_total

# Revenue
business_revenue_total

# Quotes
business_quotes_created_total
business_quotes_converted_total

# Backorders
business_backorders_created_total
business_backorders_fulfilled_total

# Inventory
business_inventory_movements_total

# CSAT
business_customer_satisfaction_score
```

**Labels:** `currency`, `movement_type`

### AI Agent Metrics

```promql
# Decisions
agent_decisions_total
agent_decisions_auto_executed_total
agent_decisions_overridden_total
agent_decisions_successful_total

# Performance
agent_decision_duration_seconds
agent_decision_confidence
```

**Labels:** `agent_name`, `decision_type`

### Recording Metrics in Code

**Backend (Python):**
```python
from src.api.middleware.prometheus import (
    record_business_metric,
    record_agent_decision
)

# Record order creation
record_business_metric('order_created')

# Record revenue (in cents)
record_business_metric('revenue', value=10000, currency='USD')

# Record agent decision
record_agent_decision(
    agent_name='order_processing_agent',
    decision_type='auto_approve',
    duration=0.5,
    confidence=0.95,
    auto_executed=True,
    successful=True
)
```

---

## Troubleshooting

### Issue 1: Prometheus Not Scraping Targets

**Symptoms:**
- Targets show as "Down" in Prometheus UI
- No metrics appearing in Grafana

**Diagnosis:**
```bash
# Check Prometheus logs
kubectl logs -f deployment/prometheus -n monitoring

# Check target status
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Open http://localhost:9090/targets
```

**Solutions:**

**1. Check service annotations:**
```bash
kubectl get svc backend-service -n ccw-erp -o yaml | grep prometheus
```

Should have:
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8000"
  prometheus.io/path: "/metrics"
```

**2. Verify RBAC permissions:**
```bash
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus
# Should return "yes"
```

**3. Check network policies:**
```bash
# Ensure monitoring namespace can access ccw-erp namespace
kubectl get networkpolicy -n ccw-erp
```

### Issue 2: Grafana Not Showing Data

**Symptoms:**
- Dashboards show "No data"
- Queries timeout

**Diagnosis:**
```bash
# Check Grafana logs
kubectl logs -f deployment/grafana -n monitoring

# Verify datasource connection
# Go to Grafana → Configuration → Data Sources → Prometheus → Test
```

**Solutions:**

**1. Verify datasource URL:**
```yaml
# Should be: http://prometheus:9090
# NOT: http://prometheus.monitoring:9090 (if in same namespace)
```

**2. Check time range:**
- Ensure dashboard time range includes data
- Default: Last 6 hours

**3. Reload dashboards:**
```bash
kubectl rollout restart deployment/grafana -n monitoring
```

### Issue 3: High Prometheus Memory Usage

**Symptoms:**
- Prometheus pod OOMKilled
- Slow query performance

**Diagnosis:**
```bash
# Check memory usage
kubectl top pod -n monitoring
```

**Solutions:**

**1. Reduce retention:**
```yaml
args:
  - '--storage.tsdb.retention.time=15d'  # Reduced from 30d
  - '--storage.tsdb.retention.size=10GB' # Reduced from 15GB
```

**2. Increase memory limits:**
```yaml
resources:
  limits:
    memory: 8Gi  # Increased from 4Gi
```

**3. Reduce scrape intervals:**
```yaml
global:
  scrape_interval: 30s  # Increased from 15s
```

### Issue 4: Missing Metrics

**Symptoms:**
- Specific metrics not appearing
- Queries return empty results

**Diagnosis:**
```bash
# Check if backend is exposing metrics
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp
curl http://localhost:8000/metrics

# Check Prometheus targets
# Open http://localhost:9090/targets
```

**Solutions:**

**1. Ensure middleware is registered:**
```python
# In apps/backend/src/api/main.py
from src.api.middleware.prometheus import PrometheusMiddleware

app.add_middleware(PrometheusMiddleware)
```

**2. Add metrics endpoint:**
```python
from src.api.middleware.prometheus import metrics_endpoint

@app.get("/metrics")
async def metrics():
    return await metrics_endpoint(request)
```

### Issue 5: Alerts Not Firing

**Symptoms:**
- Alert conditions met but no notifications
- Alerts stuck in "Pending"

**Diagnosis:**
```bash
# Check alert rules status
# Prometheus UI → Alerts

# Check Grafana alert state
# Grafana → Alerting → Alert Rules
```

**Solutions:**

**1. Verify evaluation interval:**
```yaml
global:
  evaluation_interval: 15s  # Must be configured
```

**2. Check `for` duration:**
```yaml
for: 5m  # Alert must be true for 5 minutes
```

**3. Test contact points:**
```bash
# Grafana → Alerting → Contact Points → Test
```

---

## Best Practices

### 1. Security

**Change Default Passwords:**
```bash
# Grafana admin password
kubectl create secret generic grafana-secret \
  --from-literal=admin-password=STRONG_PASSWORD \
  -n monitoring --dry-run=client -o yaml | kubectl apply -f -
```

**Enable HTTPS:**
- Use cert-manager for TLS certificates
- Enforce HTTPS redirects in Ingress

**Restrict Access:**
- Enable basic auth for Prometheus (via Ingress annotations)
- Use Grafana's built-in authentication
- Configure RBAC for API access

### 2. Performance

**Optimize Queries:**
- Use recording rules for expensive queries
- Limit time ranges in dashboards
- Use rate() instead of increase() when possible

**Resource Limits:**
- Set appropriate CPU/memory limits
- Monitor actual usage and adjust
- Use VPA (Vertical Pod Autoscaler) for optimization

**Storage:**
- Use fast storage (SSD) for Prometheus
- Monitor disk usage regularly
- Set up automated backups

### 3. Reliability

**High Availability:**
```yaml
# Scale Prometheus to 2 replicas (requires Thanos or similar)
replicas: 2

# Scale Grafana to 2 replicas
replicas: 2
```

**Backups:**
```bash
# Backup Prometheus data
kubectl exec prometheus-0 -n monitoring -- tar czf /tmp/backup.tar.gz /prometheus

# Backup Grafana dashboards (export as JSON)
# Grafana UI → Dashboard → Share → Export
```

**Monitoring the Monitors:**
- Set up external health checks
- Use dead man's switch alert
- Monitor from multiple locations

### 4. Operational

**Regular Maintenance:**
- Review and update alert thresholds monthly
- Clean up old dashboards
- Update exporters and Prometheus regularly
- Review retention policies quarterly

**Documentation:**
- Document custom metrics
- Keep runbooks for common alerts
- Document alert response procedures
- Maintain contact point information

**Testing:**
- Test alert notifications regularly
- Verify backup restoration procedures
- Conduct failure scenario drills
- Load test monitoring stack

---

## Next Steps

1. **Week 8**: Production deployment and load testing
2. **Configure Alerting**: Set up notification channels
3. **Custom Dashboards**: Create team-specific views
4. **Advanced Features**:
   - Recording rules for complex queries
   - Distributed tracing (Jaeger/Tempo)
   - Log aggregation (Loki)
   - Service mesh monitoring (Istio)

---

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [Alert Rule Examples](https://awesome-prometheus-alerts.grep.to/)

---

*Last Updated: January 14, 2026*
*Version: 1.0*
