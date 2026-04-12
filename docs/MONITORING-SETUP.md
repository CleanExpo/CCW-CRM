# Monitoring Setup Guide

**Phase 5 - Week 2: Autonomous Development Monitoring**

This guide explains how to set up and use the Prometheus + Grafana monitoring stack for tracking autonomous development metrics.

---

## Overview

The monitoring stack consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Node Exporter**: System-level metrics
- **FastAPI `/metrics` endpoint**: Application metrics

---

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start Prometheus + Grafana + Node Exporter
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker ps | grep ccw
```

### 2. Access the Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin` (change on first login)

- **Prometheus**: http://localhost:9090

- **FastAPI Metrics**: http://localhost:8000/metrics

### 3. Import Dashboards

Dashboards are automatically provisioned on Grafana startup from:

- `grafana/dashboards/autonomous-execution-overview.json`
- `grafana/dashboards/risk-assessment-analytics.json`
- `grafana/dashboards/system-health.json`

Navigate to **Dashboards** → **Browse** → **Phase 5 - Autonomous Development**

---

## Dashboards

### 1. Autonomous Execution Overview

**Purpose**: Monitor auto-merge activity, deployments, and rollbacks

**Key Panels**:

- Auto-Merge Success Rate (24h gauge)
- Deployments (24h stat)
- Rollbacks (24h stat)
- Circuit Breaker Status
- Auto-Merge Activity by Risk Level (time series)
- Deployment Frequency by Environment (bar chart)
- Auto-Merge Duration (p50, p95)
- Rollback Reasons (pie chart)
- Deployment Duration by Environment

**Recommended Refresh**: 30 seconds

**Use Cases**:

- Daily standup review
- Incident response
- Performance optimization
- Capacity planning

---

### 2. Risk Assessment Analytics

**Purpose**: Understand risk assessment decisions and code change patterns

**Key Panels**:

- Risk Level Distribution (donut chart)
- Approval Policy Distribution (pie chart)
- Risk Assessments Over Time (stacked area)
- Risk Assessment Duration (p95 gauge)
- Total Risk Assessments (stat)
- Protected Files Modified (bar chart)
- Code Change Complexity (lines/files changed)
- Auto-Merge Eligibility Rate (gauge)

**Recommended Refresh**: 30 seconds

**Use Cases**:

- Risk profile analysis
- Protected file monitoring
- Approval policy tuning
- Code complexity trends

---

### 3. System Health

**Purpose**: Monitor test execution, agent performance, and system errors

**Key Panels**:

- Overall Test Coverage (gauge)
- Test Failures (24h stat)
- Agent Success Rate (24h gauge)
- System Errors (1h stat)
- Test Execution Duration by Suite (time series)
- Agent Task Execution Time (time series)
- Test Failures by Suite (stacked bars)
- Agent Task Failures (stacked bars)
- Deployment Failures by Stage (donut chart)
- System Errors by Component (pie chart)
- Test Coverage by Module (table)

**Recommended Refresh**: 30 seconds

**Use Cases**:

- Test performance monitoring
- Agent reliability tracking
- Error investigation
- Capacity planning

---

## Metrics Reference

### Risk Assessment Metrics

| Metric                             | Type      | Labels       | Description                           |
| ---------------------------------- | --------- | ------------ | ------------------------------------- |
| `risk_assessments_total`           | Counter   | `risk_level` | Total risk assessments performed      |
| `risk_assessment_duration_seconds` | Histogram | -            | Time spent performing risk assessment |
| `approval_decisions_total`         | Counter   | `policy`     | Approval policy decisions             |

### Auto-Merge Metrics

| Metric                         | Type      | Labels                         | Description               |
| ------------------------------ | --------- | ------------------------------ | ------------------------- |
| `auto_merges_attempted_total`  | Counter   | `risk_level`                   | Auto-merge attempts       |
| `auto_merges_successful_total` | Counter   | `risk_level`                   | Successful auto-merges    |
| `auto_merges_failed_total`     | Counter   | `risk_level`, `failure_reason` | Failed auto-merges        |
| `auto_merge_duration_seconds`  | Histogram | -                              | Time from commit to merge |

### Rollback Metrics

| Metric                       | Type      | Labels           | Description               |
| ---------------------------- | --------- | ---------------- | ------------------------- |
| `rollbacks_triggered_total`  | Counter   | `trigger_reason` | Rollbacks triggered       |
| `rollback_duration_seconds`  | Histogram | -                | Time to complete rollback |
| `rollbacks_successful_total` | Counter   | -                | Successful rollbacks      |
| `rollbacks_failed_total`     | Counter   | -                | Failed rollbacks          |

### Circuit Breaker Metrics

| Metric                         | Type    | Labels      | Description                                           |
| ------------------------------ | ------- | ----------- | ----------------------------------------------------- |
| `circuit_breaker_state`        | Gauge   | `component` | Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN) |
| `circuit_breaker_opens_total`  | Counter | `component` | Circuit breaker open events                           |
| `circuit_breaker_closes_total` | Counter | `component` | Circuit breaker close events                          |

### Test Execution Metrics

| Metric                            | Type      | Labels               | Description               |
| --------------------------------- | --------- | -------------------- | ------------------------- |
| `test_executions_total`           | Counter   | `suite`              | Test suite executions     |
| `test_failures_total`             | Counter   | `suite`, `test_name` | Test failures             |
| `test_execution_duration_seconds` | Histogram | `suite`              | Test suite execution time |
| `test_coverage_percentage`        | Gauge     | `module`             | Code coverage percentage  |

### Deployment Metrics

| Metric                        | Type      | Labels                 | Description                 |
| ----------------------------- | --------- | ---------------------- | --------------------------- |
| `deployments_total`           | Counter   | `environment`          | Total deployments           |
| `deployment_duration_seconds` | Histogram | `environment`          | Time to complete deployment |
| `deployment_failures_total`   | Counter   | `environment`, `stage` | Deployment failures         |

### Agent Performance Metrics

| Metric                              | Type      | Labels                                | Description                         |
| ----------------------------------- | --------- | ------------------------------------- | ----------------------------------- |
| `agent_task_execution_seconds`      | Histogram | `agent_id`, `task_type`               | Agent task execution time           |
| `agent_task_success_total`          | Counter   | `agent_id`, `task_type`               | Successful agent tasks              |
| `agent_task_failure_total`          | Counter   | `agent_id`, `task_type`, `error_type` | Failed agent tasks                  |
| `agent_verification_required_total` | Counter   | `agent_id`, `verification_reason`     | Tasks requiring manual verification |

### Code Quality Metrics

| Metric                           | Type      | Labels         | Description                      |
| -------------------------------- | --------- | -------------- | -------------------------------- |
| `code_lines_changed`             | Histogram | -              | Lines of code changed per commit |
| `code_files_changed`             | Histogram | -              | Files changed per commit         |
| `protected_files_modified_total` | Counter   | `file_pattern` | Protected files modified         |

### System Health Metrics

| Metric                           | Type    | Labels                    | Description                 |
| -------------------------------- | ------- | ------------------------- | --------------------------- |
| `autonomous_system_errors_total` | Counter | `component`, `error_type` | Errors in autonomous system |

---

## Alert Configuration (Coming in Week 2)

Recommended alert thresholds:

### Critical Alerts

- **Auto-Merge Success Rate < 85%** (24h window)
- **Circuit Breaker Opens** (immediate)
- **Rollback Failures > 0** (immediate)
- **Test Coverage < 40%** (any module)

### Warning Alerts

- **Auto-Merge Success Rate < 95%** (24h window)
- **Rollbacks > 3** (1h window)
- **Test Failures > 5** (1h window)
- **Agent Success Rate < 90%** (24h window)
- **Protected Files Modified** (immediate notification)

### Info Alerts

- **Deployments to Production** (notification)
- **Risk Assessment Duration > 3s** (p95)

---

## Troubleshooting

### Prometheus not scraping metrics

1. Check backend is running: `curl http://localhost:8000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify Docker network: `docker network inspect monitoring`

### Grafana dashboards not appearing

1. Check provisioning volumes are mounted:
   ```bash
   docker exec -it ccw-grafana ls /etc/grafana/dashboards
   ```
2. Check Grafana logs:
   ```bash
   docker logs ccw-grafana
   ```
3. Manually import dashboard JSON from `grafana/dashboards/`

### Metrics not updating

1. Verify FastAPI app is recording metrics (check `/metrics` endpoint)
2. Check Prometheus scrape interval in `prometheus.yml`
3. Verify metric names match dashboard queries

---

## Production Deployment

### Security Considerations

1. **Change default passwords**:

   ```yaml
   - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
   ```

2. **Enable HTTPS**:
   - Use reverse proxy (nginx, Traefik, Caddy)
   - Configure SSL certificates

3. **Restrict network access**:
   - Prometheus: Internal network only
   - Grafana: VPN or authentication gateway
   - Metrics endpoint: Internal only (do NOT expose publicly)

4. **Set up Prometheus authentication**:
   ```yaml
   - '--web.enable-admin-api=false'
   - '--web.enable-lifecycle=false'
   ```

### Scaling Considerations

1. **Prometheus retention**: Default 15 days

   ```yaml
   - '--storage.tsdb.retention.time=30d'
   ```

2. **Prometheus storage**: Monitor disk usage

   ```bash
   docker exec ccw-prometheus du -sh /prometheus
   ```

3. **Grafana performance**: Use query caching
   ```yaml
   - GF_CACHING_ENABLED=true
   ```

---

## Maintenance

### Backup Prometheus Data

```bash
# Create backup
docker run --rm -v prometheus-data:/data -v $(pwd):/backup ubuntu tar czf /backup/prometheus-backup.tar.gz /data

# Restore backup
docker run --rm -v prometheus-data:/data -v $(pwd):/backup ubuntu tar xzf /backup/prometheus-backup.tar.gz -C /
```

### Backup Grafana Dashboards

Dashboards are version-controlled in `grafana/dashboards/`, no separate backup needed.

### Update Monitoring Stack

```bash
# Pull latest images
docker-compose -f docker-compose.monitoring.yml pull

# Restart services
docker-compose -f docker-compose.monitoring.yml up -d
```

---

## Integration with Autonomous Development

The monitoring stack integrates with Phase 5 autonomous development components:

1. **Risk Assessor** → Records risk_assessments_total
2. **Auto-Merge System** → Records auto*merges*\* metrics
3. **Rollback Agent** → Records rollbacks\_\* metrics
4. **Circuit Breaker** → Records circuit_breaker_state
5. **Test Runner** → Records test\_\* metrics
6. **Deployment Service** → Records deployments\_\* metrics

All metrics are automatically exposed via the `/metrics` endpoint and scraped by Prometheus every 15 seconds.

---

## Support

For issues or questions:

1. Check Grafana logs: `docker logs ccw-grafana`
2. Check Prometheus logs: `docker logs ccw-prometheus`
3. Verify metrics endpoint: `curl http://localhost:8000/metrics`
4. Review this documentation
5. Create issue in project repository

---

**Last Updated**: February 3, 2026
**Author**: Phase 5 Autonomous Development Team
**Version**: 1.0
