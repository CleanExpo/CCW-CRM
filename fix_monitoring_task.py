"""Fix the monitoring task to remove Prometheus/Grafana references."""
import csv
from pathlib import Path

csv_path = Path(__file__).parent / "docs" / "linear-import-updated-2026-01-28.csv"

with open(csv_path, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Update monitoring task
for row in rows:
    if row["Title"] == "Setup Production Monitoring and Alerts":
        row["Description"] = '''READY TO START: Enhance existing internal monitoring system

**Current State:**
- Internal metrics collection (prometheus_client format)
- AlertManager service for system alerts
- AI agent monitoring endpoints
- Health monitoring for agents

**What's Missing:**
- Email/Slack notifications for alerts
- Consolidated monitoring dashboard UI
- Business metrics tracking (POS, reconciliation, orders)
- API performance monitoring (response times, error rates)
- Database connection pool monitoring
- Scheduled alert checks

**Deliverables:**
- Email/Slack notification service for alerts
- Monitoring dashboard UI (using existing internal endpoints)
- Business metrics endpoints (POS volume, reconciliation rate, order throughput)
- API performance middleware (track response times, error rates)
- Database pool metrics collection
- Scheduled jobs for alert generation
- Alert acknowledgement workflow

**Metrics to Track:**
- Request rate (req/sec)
- Error rate (%)
- Response time (p50, p95, p99)
- Database connection pool usage
- POS transaction volume by location
- Bank reconciliation success rate
- Top 10 slowest endpoints
- AI agent execution success rates

**Alert Conditions:**
- p95 response time > 2s for 5 minutes
- Error rate > 1% for 5 minutes
- Database connection pool > 90% for 2 minutes
- Bank reconciliation failures > 5/hour
- POS payment failures > 3/hour
- AI agent failure rate > 20%

**Acceptance Criteria:**
- Email notifications working for critical alerts
- Slack webhooks configured (optional)
- Monitoring dashboard accessible at /monitoring
- All business metrics tracked
- Alert acknowledgement workflow functional
- Documentation updated

**Business Value:** Proactive issue detection, reduce downtime, improve SLA

**Priority:** Medium - Important for production stability

**Note:** Uses existing internal monitoring infrastructure (no external Prometheus/Grafana)'''
        print(f"[OK] Updated: {row['Title']}")
        break

# Write back
with open(csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"\n[OK] CSV updated: {csv_path}")
