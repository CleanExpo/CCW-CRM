# Monitoring Stack

Prometheus + Grafana monitoring for CCW-Online ERP.

## Quick Deploy

**Linux/Mac:**
```bash
./scripts/deploy-monitoring.sh
```

**Windows:**
```powershell
.\scripts\deploy-monitoring.ps1
```

## What's Deployed

### Core Stack
- **Prometheus**: Metrics collection and storage (20GB PVC)
- **Grafana**: Visualization and dashboards (10GB PVC)
- **Ingress**: HTTPS access via cert-manager

### Exporters (Optional)
- **PostgreSQL Exporter**: Database metrics
- **Redis Exporter**: Cache metrics

### Dashboards (Pre-configured)
1. Application Performance
2. Infrastructure Health
3. Business Metrics
4. AI Agent Performance

### Alerts (15+ Rules)
- High error rate
- High response time
- Service down
- Database connection issues
- Celery queue backlog
- High CPU/memory usage
- Pod restart loops
- HPA maxed out

## Access

**Production (via Ingress):**
- Prometheus: https://prometheus.your-domain.com
- Grafana: https://grafana.your-domain.com

**Local (via port-forward):**
```bash
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

**Default Credentials:**
- Username: `admin`
- Password: `admin` (⚠️ CHANGE IMMEDIATELY!)

## Configuration

### 1. Update Domain Names

Edit `ingress.yaml`:
```yaml
spec:
  tls:
    - hosts:
        - prometheus.your-domain.com  # ← Change
        - grafana.your-domain.com     # ← Change
```

### 2. Change Grafana Password

```bash
kubectl create secret generic grafana-secret \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=NEW_PASSWORD \
  --namespace=monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/grafana -n monitoring
```

### 3. Deploy Exporters (Optional)

```bash
kubectl apply -f exporters/postgres-exporter.yaml
kubectl apply -f exporters/redis-exporter.yaml
```

## Verification

```bash
# Check deployment status
kubectl get pods -n monitoring

# Check services
kubectl get svc -n monitoring

# View logs
kubectl logs -f deployment/prometheus -n monitoring
kubectl logs -f deployment/grafana -n monitoring

# Test metrics endpoint
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp
curl http://localhost:8000/metrics
```

## File Structure

```
monitoring/
├── namespace.yaml                    # Monitoring namespace
├── prometheus-config.yaml            # Prometheus configuration
├── prometheus-deployment.yaml        # Prometheus deployment + RBAC
├── grafana-deployment.yaml           # Grafana deployment
├── grafana-dashboards.yaml           # Pre-configured dashboards
├── ingress.yaml                      # Ingress for Prometheus + Grafana
├── exporters/
│   ├── postgres-exporter.yaml        # PostgreSQL metrics exporter
│   └── redis-exporter.yaml           # Redis metrics exporter
└── README.md                         # This file
```

## Metrics Endpoints

All CCW-ERP services expose metrics at `/metrics`:
- Backend: `http://backend-service:8000/metrics`
- Frontend: `http://frontend-service:3000/metrics` (if instrumented)
- PostgreSQL: `http://postgres-exporter:9187/metrics`
- Redis: `http://redis-exporter:9121/metrics`

## Example Queries

**Request rate:**
```promql
rate(http_requests_total{namespace="ccw-erp"}[5m])
```

**95th percentile latency:**
```promql
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket{namespace="ccw-erp"}[5m])
)
```

**Error rate:**
```promql
(rate(http_requests_total{namespace="ccw-erp",status=~"5.."}[5m]) /
 rate(http_requests_total{namespace="ccw-erp"}[5m])) * 100
```

**CPU usage:**
```promql
rate(container_cpu_usage_seconds_total{namespace="ccw-erp"}[5m]) * 100
```

**Memory usage:**
```promql
container_memory_working_set_bytes{namespace="ccw-erp"} / 1024 / 1024
```

## Troubleshooting

### Prometheus not scraping targets

**Check annotations:**
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

### Grafana not showing data

1. Check datasource: Grafana → Configuration → Data Sources → Test
2. Verify time range includes data
3. Check Grafana logs: `kubectl logs -f deployment/grafana -n monitoring`

### High memory usage

1. Reduce retention: `--storage.tsdb.retention.time=15d`
2. Increase memory limits: `memory: 8Gi`
3. Reduce scrape intervals: `scrape_interval: 30s`

## Cleanup

```bash
# Delete monitoring stack
kubectl delete namespace monitoring

# Or use script
./scripts/deploy-monitoring.sh --delete
```

## Next Steps

1. Update domain names in `ingress.yaml`
2. Change Grafana admin password
3. Configure alert notification channels
4. Import additional dashboards from grafana.com
5. Set up backup procedures

## Documentation

See [docs/MONITORING-SETUP.md](../../docs/MONITORING-SETUP.md) for comprehensive documentation including:
- Architecture overview
- Detailed configuration
- Alert rules reference
- Metrics reference
- Troubleshooting guide
- Best practices

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
