# Celery Background Task System

Complete guide for running and monitoring the Celery task queue system in CCW-Online ERP.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Task Queues](#task-queues)
- [Scheduled Tasks](#scheduled-tasks)
- [Monitoring with Flower](#monitoring-with-flower)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What is Celery?

Celery is a distributed task queue system that handles:
- **Periodic tasks**: Scheduled jobs (integration syncs, health checks)
- **Background tasks**: Async operations (email sending, report generation)
- **Long-running tasks**: Agent execution, data processing

### Architecture

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   FastAPI    │────▶│    Redis    │◀────│Celery Worker │
│  (Producer)  │     │   (Broker)  │     │ (Consumer)   │
└──────────────┘     └─────────────┘     └──────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │Celery Beat  │
                     │ (Scheduler) │
                     └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   Flower    │
                     │ (Monitoring)│
                     └─────────────┘
```

### Components

1. **Celery Worker**: Executes tasks from the queue
2. **Celery Beat**: Scheduler for periodic tasks
3. **Redis**: Message broker and result backend
4. **Flower**: Web-based monitoring UI

---

## Quick Start

### Prerequisites

1. **Redis running**:
   ```bash
   docker ps | grep redis
   ```
   Should show: `nodejs-starter-redis` running on port 6379

2. **Dependencies installed**:
   ```bash
   cd apps/backend
   uv sync
   ```

### Start All Services (Development)

**Terminal 1 - Celery Worker:**
```bash
cd apps/backend
./scripts/start-celery-worker.bat
```

**Terminal 2 - Celery Beat (Scheduler):**
```bash
cd apps/backend
./scripts/start-celery-beat.bat
```

**Terminal 3 - Flower (Monitoring):**
```bash
cd apps/backend
./scripts/start-flower.bat
```

**Terminal 4 - FastAPI Backend:**
```bash
cd apps/backend
uv run uvicorn src.api.main:app --reload
```

### Verify It's Working

1. **Check Flower UI**: http://localhost:5555
2. **Check logs**: Should see "Connected to redis://localhost:6379/0"
3. **Test a task**:
   ```bash
   uv run python -c "from src.scheduler.tasks import health_check_integrations; health_check_integrations.delay()"
   ```

---

## Task Queues

### Queue Organization

Tasks are routed to specific queues for better resource management:

#### **integrations** Queue
- CIN7 stock sync (every 15 min)
- CIN7 product sync (every hour)
- Shopify order sync (every 5 min)
- StockTrim forecast update (daily)
- **Worker allocation**: 2 workers, medium priority

#### **agents** Queue
- Stock Checker Agent (every 6 hours)
- Backorder Manager Agent (daily at 9am)
- Container Tracker Agent (hourly)
- Demand Forecaster Agent (daily at 2am)
- **Worker allocation**: 1 worker, high priority

#### **monitoring** Queue
- Health check (every minute)
- Log cleanup (weekly)
- **Worker allocation**: 1 worker, low priority

### Running Specific Queues

```bash
# Run only integrations queue
uv run celery -A src.scheduler.celery_app worker --loglevel=info -Q integrations

# Run only agents queue
uv run celery -A src.scheduler.celery_app worker --loglevel=info -Q agents

# Run all queues
uv run celery -A src.scheduler.celery_app worker --loglevel=info
```

---

## Scheduled Tasks

### Task Schedule Overview

| Task | Schedule | Queue | Purpose |
|------|----------|-------|---------|
| CIN7 Stock Sync | */15 min | integrations | Keep inventory levels up-to-date |
| CIN7 Product Sync | Every hour | integrations | Sync product catalog changes |
| CIN7 PO Sync | Every 2 hours | integrations | Update purchase orders and containers |
| Shopify Order Sync | */5 min | integrations | Capture new orders immediately |
| StockTrim Forecast | Daily 1am UTC | integrations | Update demand forecasts |
| Stock Checker Agent | Every 6 hours | agents | Monitor low stock and reorder points |
| Backorder Manager | Daily 9am UTC | agents | Process and allocate backorders |
| Container Tracker | Every hour | agents | Update container ETAs and statuses |
| Demand Forecaster | Daily 2am UTC | agents | Recalculate reorder points |
| Health Check | Every minute | monitoring | Verify integration connectivity |
| Log Cleanup | Weekly Sun 2am | monitoring | Archive old logs (30+ days) |

### Customizing Schedules

Edit `apps/backend/src/scheduler/celery_app.py`:

```python
celery_app.conf.beat_schedule = {
    "sync-cin7-stock-every-15-minutes": {
        "task": "src.scheduler.tasks.sync_cin7_stock",
        "schedule": crontab(minute="*/15"),  # Change frequency here
        "options": {"queue": "integrations"},
    },
    # ... more tasks
}
```

**Crontab syntax examples:**
```python
crontab(minute="*/15")              # Every 15 minutes
crontab(hour=9, minute=0)           # Daily at 9:00 AM
crontab(hour="*/6", minute=0)       # Every 6 hours
crontab(hour=2, minute=0, day_of_week=0)  # Weekly Sunday 2:00 AM
```

---

## Monitoring with Flower

### Access Flower

**URL**: http://localhost:5555

### Features

1. **Dashboard**: Real-time task statistics
2. **Tasks**: View all tasks (pending, active, completed, failed)
3. **Workers**: Monitor worker status and performance
4. **Broker**: Redis connection status
5. **Monitor**: Live task execution graph

### Key Metrics

- **Success Rate**: % of tasks completed successfully
- **Throughput**: Tasks/second
- **Avg Task Time**: Average execution duration
- **Queue Length**: Number of pending tasks

### Flower API

Query stats programmatically:

```bash
# Get worker stats
curl http://localhost:5555/api/workers

# Get active tasks
curl http://localhost:5555/api/tasks

# Get task info
curl http://localhost:5555/api/task/info/{task_id}
```

---

## Production Deployment

### Systemd Service (Linux)

**File**: `/etc/systemd/system/celery-worker.service`

```ini
[Unit]
Description=Celery Worker for CCW ERP
After=network.target redis.service postgresql.service

[Service]
Type=forking
User=ccw-erp
Group=ccw-erp
WorkingDirectory=/opt/ccw-erp/apps/backend
Environment="PATH=/opt/ccw-erp/.venv/bin"
Environment="ENVIRONMENT=production"
ExecStart=/opt/ccw-erp/apps/backend/scripts/start-celery-worker.sh production
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

**File**: `/etc/systemd/system/celery-beat.service`

```ini
[Unit]
Description=Celery Beat Scheduler for CCW ERP
After=network.target redis.service

[Service]
Type=simple
User=ccw-erp
Group=ccw-erp
WorkingDirectory=/opt/ccw-erp/apps/backend
Environment="PATH=/opt/ccw-erp/.venv/bin"
Environment="ENVIRONMENT=production"
ExecStart=/opt/ccw-erp/apps/backend/scripts/start-celery-beat.sh production
Restart=always
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

### Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable celery-worker celery-beat
sudo systemctl start celery-worker celery-beat
sudo systemctl status celery-worker celery-beat
```

### Docker Compose (Development)

Add to `docker-compose.yml`:

```yaml
services:
  celery-worker:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    command: celery -A src.scheduler.celery_app worker --loglevel=info --concurrency=4
    environment:
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=postgresql://user:pass@postgres:5432/ccw_erp
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  celery-beat:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    command: celery -A src.scheduler.celery_app beat --loglevel=info
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    restart: unless-stopped

  flower:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    command: celery -A src.scheduler.celery_app flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    restart: unless-stopped
```

### Scaling Workers

**Horizontal scaling** (multiple worker processes):
```bash
# Run 3 separate worker processes
celery -A src.scheduler.celery_app worker --concurrency=4 --hostname=worker1@%h &
celery -A src.scheduler.celery_app worker --concurrency=4 --hostname=worker2@%h &
celery -A src.scheduler.celery_app worker --concurrency=4 --hostname=worker3@%h &
```

**Vertical scaling** (increase concurrency):
```bash
# Run with 8 concurrent tasks instead of 4
celery -A src.scheduler.celery_app worker --concurrency=8
```

**Queue-specific workers**:
```bash
# Dedicated worker for high-priority agents queue
celery -A src.scheduler.celery_app worker -Q agents --concurrency=2 --hostname=agents-worker@%h

# Dedicated worker for integrations
celery -A src.scheduler.celery_app worker -Q integrations --concurrency=4 --hostname=integrations-worker@%h
```

---

## Task Failure Alerting

### Email Alerts

All task failures automatically send email alerts via SendGrid when configured.

**Alert contains**:
- Task name and ID
- Timestamp
- Environment (dev/staging/prod)
- Exception type and message
- Full traceback (first 2000 chars)

**Configuration** (`.env`):
```bash
SENDGRID_API_KEY=your_api_key_here
SENDGRID_FROM_EMAIL=alerts@ccw-erp.com
SENDGRID_FROM_NAME=CCW ERP Alerts
```

**Test alert**:
```python
from src.scheduler.tasks import sync_cin7_stock

# This will fail and send an alert email
sync_cin7_stock.apply_async(countdown=5)
```

### Monitoring Integration

For production, integrate with monitoring systems:

**Prometheus metrics**:
```python
from prometheus_client import Counter, Histogram

task_failures = Counter('celery_task_failures_total', 'Total task failures', ['task_name'])
task_duration = Histogram('celery_task_duration_seconds', 'Task duration', ['task_name'])
```

**Sentry integration**:
```python
import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[CeleryIntegration()],
)
```

---

## Troubleshooting

### Worker Not Starting

**Symptom**: `celery: command not found`

**Solution**:
```bash
# Ensure dependencies installed
cd apps/backend
uv sync

# Verify celery is available
uv run celery --version
```

---

### Redis Connection Error

**Symptom**: `Error: Can't connect to Redis at localhost:6379`

**Solution**:
```bash
# Check if Redis is running
docker ps | grep redis

# If not running, start it
docker compose up -d redis

# Verify connection
redis-cli -h localhost -p 6379 ping
# Should respond: PONG
```

---

### Tasks Not Executing

**Symptom**: Tasks scheduled but never run

**Checklist**:
1. ✅ Celery worker running? Check `ps aux | grep celery`
2. ✅ Celery beat running? Beat is required for scheduled tasks
3. ✅ Redis accessible? `redis-cli ping`
4. ✅ Correct queue? Check task routing in `celery_app.py`
5. ✅ Inspect Flower: http://localhost:5555

**Debug**:
```bash
# Manually trigger a task
uv run python -c "from src.scheduler.tasks import health_check_integrations; result = health_check_integrations.apply_async(); print(result.id)"

# Check result
uv run python -c "from celery.result import AsyncResult; from src.scheduler.celery_app import celery_app; r = AsyncResult('task-id-here', app=celery_app); print(r.state, r.result)"
```

---

### High Memory Usage

**Symptom**: Worker memory grows over time

**Solution**:
```bash
# Restart worker periodically via max-tasks-per-child
celery -A src.scheduler.celery_app worker --max-tasks-per-child=1000

# Or restart manually
pkill -f "celery worker"
./scripts/start-celery-worker.bat
```

---

### Task Timeout

**Symptom**: `TimeLimitExceeded` error

**Solution**:
```bash
# Increase time limits (in seconds)
celery -A src.scheduler.celery_app worker \
    --time-limit=600 \
    --soft-time-limit=540
```

Or configure per-task in `celery_app.py`:
```python
@celery_app.task(time_limit=600, soft_time_limit=540)
def long_running_task():
    pass
```

---

### Stuck Tasks

**Symptom**: Tasks stuck in "PENDING" state forever

**Solution**:
```bash
# Purge all pending tasks
celery -A src.scheduler.celery_app purge

# Or purge specific queue
celery -A src.scheduler.celery_app purge -Q integrations
```

---

## Advanced Configuration

### Result Expiration

Results are kept for 1 hour by default. To change:

```python
# In celery_app.py
celery_app.conf.result_expires = 7200  # 2 hours
```

### Task Priority

```python
# High priority (processed first)
task.apply_async(priority=10)

# Low priority (processed last)
task.apply_async(priority=0)
```

### Task Retry Strategy

```python
@celery_app.task(
    bind=True,
    max_retries=5,
    default_retry_delay=60,  # seconds
    autoretry_for=(Exception,),
    retry_backoff=True,  # Exponential backoff
    retry_backoff_max=600,  # Max 10 minutes
)
def resilient_task(self):
    try:
        # Task logic
        pass
    except Exception as exc:
        raise self.retry(exc=exc)
```

---

## Performance Tuning

### Concurrency

**CPU-bound tasks**: `concurrency = CPU cores`
**I/O-bound tasks**: `concurrency = CPU cores * 2-4`

```bash
# Auto-detect optimal concurrency
celery -A src.scheduler.celery_app worker --autoscale=10,3

# Min 3 workers, max 10 based on load
```

### Prefetch Multiplier

Controls how many tasks each worker prefetches from queue:

```python
# In celery_app.py
celery_app.conf.worker_prefetch_multiplier = 4  # Default

# Lower for long tasks (prevents worker hoarding)
celery_app.conf.worker_prefetch_multiplier = 1

# Higher for many short tasks
celery_app.conf.worker_prefetch_multiplier = 8
```

---

## Useful Commands

```bash
# Check active workers
celery -A src.scheduler.celery_app inspect active

# Check scheduled tasks
celery -A src.scheduler.celery_app inspect scheduled

# Check registered tasks
celery -A src.scheduler.celery_app inspect registered

# Get worker stats
celery -A src.scheduler.celery_app inspect stats

# Restart all workers
celery -A src.scheduler.celery_app control pool_restart

# Gracefully shutdown workers
celery -A src.scheduler.celery_app control shutdown
```

---

## Next Steps

1. **Week 5**: Add real-time WebSocket updates triggered by Celery tasks
2. **Week 6**: Implement agent autonomy levels for semi-autonomous execution
3. **Week 7**: Kubernetes deployment with auto-scaling workers

---

**Questions?** Check the [main documentation](../README.md) or ask in Slack #ccw-erp-dev
