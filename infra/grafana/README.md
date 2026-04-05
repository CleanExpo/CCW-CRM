# Grafana Dashboard for Autonomous Development Framework

> Real-time monitoring and visualization for the Phase 5 autonomous development system.

## Overview

This Grafana dashboard provides comprehensive monitoring of the autonomous development framework, including:

- System health status
- Auto-merge success rates
- Error rates and anomaly detection
- PR activity over time
- Audit log viewer
- Risk distribution analysis
- Violation tracking

## Prerequisites

- **Grafana**: Version 9.0 or later
- **Backend API**: Running on `http://localhost:8000` (or configure URL)
- **JSON API Plugin**: Grafana's built-in JSON API datasource

## Quick Start

### 1. Install Grafana

**macOS (Homebrew)**:

```bash
brew install grafana
brew services start grafana
```

**Ubuntu/Debian**:

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
sudo apt-get update
sudo apt-get install grafana
sudo systemctl start grafana-server
```

**Windows (Chocolatey)**:

```powershell
choco install grafana
```

**Docker**:

```bash
docker run -d -p 3000:3000 --name=grafana grafana/grafana-oss
```

### 2. Access Grafana

1. Open browser: `http://localhost:3000`
2. Default credentials:
   - Username: `admin`
   - Password: `admin`
3. Change password when prompted

### 3. Add JSON API Datasource

1. Navigate to **Configuration** → **Data Sources**
2. Click **Add data source**
3. Search for **JSON API**
4. Configure:
   - **Name**: `Autonomy Metrics`
   - **URL**: `http://localhost:8000` (or your backend URL)
   - **Access**: Server (default)
5. Click **Save & Test**

### 4. Import Dashboard

**Option A: Via UI**

1. Navigate to **Dashboards** → **Import**
2. Click **Upload JSON file**
3. Select `grafana/dashboards/autonomy-dashboard.json`
4. Select datasource: `Autonomy Metrics`
5. Click **Import**

**Option B: Via API**

```bash
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @grafana/dashboards/autonomy-dashboard.json
```

**Option C: Provisioning** (Automatic)

```bash
# Copy dashboard to Grafana provisioning directory
cp grafana/dashboards/autonomy-dashboard.json /etc/grafana/provisioning/dashboards/

# Restart Grafana
sudo systemctl restart grafana-server
```

## Dashboard Panels

### System Overview Row

**1. System Health**

- Current health status (Healthy/Degraded/Unhealthy)
- Color-coded indicator
- Updates every 30 seconds
- Endpoint: `/api/autonomy/health`

**2. Auto-Merge Success Rate (24h)**

- Percentage of PRs successfully auto-merged
- Green: >95%, Yellow: 80-95%, Red: <80%
- Includes trend line
- Endpoint: `/api/autonomy/metrics?window_hours=24`

**3. Error Rate (24h)**

- Percentage of failures and reversions
- Green: <5%, Yellow: 5-10%, Red: >10%
- Includes trend line
- Endpoint: `/api/autonomy/metrics?window_hours=24`

**4. Active Anomalies**

- Number of detected anomalies
- Green: 0, Yellow: 1-2, Red: 3+
- Endpoint: `/api/autonomy/anomalies?window_hours=24`

### Activity Row

**5. PR Activity Over Time**

- Line chart showing PR creation, auto-merge, rejection trends
- 24-hour time series
- Stacked view option

**6. PR Outcomes (24h)**

- Pie chart of auto-merged vs rejected vs blocked
- Shows distribution of outcomes

### Audit Log Row

**7. Recent Audit Log**

- Table of last 20 autonomous actions
- Columns: timestamp, action, result, PR number, files changed
- Color-coded results (green=success, red=failure, yellow=blocked)
- Sortable by timestamp
- Endpoint: `/api/autonomy/audit/recent?limit=20`

### Metrics Row

**8-11. Key Metrics (24h)**

- Total PRs Created
- Auto-Merged Count
- Rejected Count
- Protected File Violations

### Analysis Row

**12. Risk Distribution (24h)**

- Bar gauge showing distribution of risk levels (LOW, MEDIUM, HIGH)
- Helps identify what types of changes are being attempted

**13. Anomalies Table**

- List of detected anomalies with descriptions
- Real-time alerts for issues requiring attention

## API Endpoints Used

| Panel              | Endpoint                                      | Refresh Rate |
| ------------------ | --------------------------------------------- | ------------ |
| System Health      | `GET /api/autonomy/health?window_hours=1`     | 30s          |
| Metrics            | `GET /api/autonomy/metrics?window_hours=24`   | 30s          |
| Audit Log          | `GET /api/autonomy/audit/recent?limit=20`     | 30s          |
| Anomalies          | `GET /api/autonomy/anomalies?window_hours=24` | 30s          |
| Prometheus Metrics | `GET /api/autonomy/metrics/prometheus`        | 30s          |

## Configuration

### Update API URL

If your backend is not on `http://localhost:8000`, update the datasource URL:

1. Go to **Configuration** → **Data Sources**
2. Select **Autonomy Metrics**
3. Update **URL** field
4. Click **Save & Test**

### Change Refresh Rate

Default: 30 seconds

To change:

1. Open dashboard
2. Click ⚙️ (Dashboard settings)
3. Go to **General** tab
4. Update **Auto refresh** dropdown
5. Click **Save dashboard**

### Add Alerts

Grafana supports alerting on thresholds:

**Example: Alert on High Error Rate**

1. Edit the "Error Rate" panel
2. Go to **Alert** tab
3. Create alert rule:
   - Condition: `WHEN avg() OF query(A, 5m, now) IS ABOVE 0.1`
   - Alert: "High error rate detected"
   - Notifications: Configure channel (email, Slack, etc.)

## Prometheus Integration (Optional)

If you're using Prometheus for metrics scraping:

### 1. Add Prometheus Scrape Config

Edit `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'autonomy_metrics'
    scrape_interval: 30s
    metrics_path: '/api/autonomy/metrics/prometheus'
    static_configs:
      - targets: ['localhost:8000']
```

### 2. Add Prometheus Datasource in Grafana

1. **Configuration** → **Data Sources** → **Add data source**
2. Select **Prometheus**
3. URL: `http://localhost:9090`
4. Click **Save & Test**

### 3. Update Dashboard Queries

Change panel queries from JSON API to PromQL:

**Example: Success Rate**

```promql
autonomy_auto_merge_success_rate
```

**Example: Error Rate**

```promql
autonomy_error_rate
```

## Troubleshooting

### Dashboard Shows "No Data"

**Check backend is running:**

```bash
curl http://localhost:8000/api/autonomy/health
```

**Check datasource connection:**

1. Go to **Data Sources** → **Autonomy Metrics**
2. Click **Save & Test**
3. Should see "Data source is working"

**Check CORS settings:**
If backend and Grafana are on different domains, ensure CORS is configured:

```python
# apps/backend/src/api/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add Grafana URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Panels Show Errors

**Check API endpoint manually:**

```bash
curl http://localhost:8000/api/autonomy/metrics?window_hours=24
```

**Verify JSON structure:**
Ensure response matches expected format in dashboard queries

**Check browser console:**
Open browser DevTools (F12) → Console tab for errors

### Data Not Updating

**Verify refresh rate:**

- Top-right corner should show auto-refresh interval (30s default)
- Click dropdown to change or manually refresh

**Check time range:**

- Top-right shows time range (default: "Last 24 hours")
- Adjust if needed

## Performance Optimization

### Reduce API Load

**Increase refresh rate:**

- Dashboard settings → Auto refresh → 1m or 5m

**Cache responses:**

```python
# Add caching to metrics endpoints
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

@router.get("/metrics")
@cache(expire=30)  # Cache for 30 seconds
async def get_metrics(...):
    ...
```

### Optimize Queries

**Use smaller time windows for high-frequency panels:**

- Health check: 1 hour window
- Metrics: 24 hour window
- Historical: 7 day window

## Advanced Features

### Annotations

Add annotations for deployments, incidents, etc.:

1. Click on graph
2. Click **Add annotation**
3. Enter description
4. Save

### Variables

Create dashboard variables for dynamic filtering:

1. Dashboard settings → Variables → Add variable
2. Name: `autonomy_level`
3. Type: Custom
4. Values: `NONE,DOCUMENTATION,TESTS,LOW_RISK,FULL`
5. Use in queries: `&level=$autonomy_level`

### Templating

Create multiple dashboard instances for different environments:

- Development: `http://localhost:8000`
- Staging: `https://staging-api.example.com`
- Production: `https://api.example.com`

## Monitoring Best Practices

### Key Metrics to Watch

1. **Success Rate**: Should stay >95%
   - Alert threshold: <90%

2. **Error Rate**: Should stay <5%
   - Alert threshold: >10%

3. **Anomalies**: Should be 0
   - Alert threshold: >0

4. **Protected File Violations**: Must be 0
   - Alert threshold: >0

### Response Procedures

**High Error Rate:**

1. Check recent audit log for patterns
2. Review rejected PRs
3. Consider lowering autonomy level
4. Investigate root cause

**Protected File Violations:**

1. Immediate investigation required
2. Review agent logic
3. Update protected file patterns if needed

**Circuit Breaker Trips:**

1. System auto-disabled
2. Fix underlying issues
3. Manually reset circuit breaker
4. Gradually re-enable

## Support

For issues or questions:

- Check [Phase 5 Documentation](../docs/phase-5/README.md)
- Review [Troubleshooting Guide](../docs/phase-5/week-3-autonomous-framework.md#troubleshooting)
- Open GitHub issue

---

**Dashboard Version**: 1.0.0
**Last Updated**: February 4, 2026
**Grafana Compatibility**: 9.0+
