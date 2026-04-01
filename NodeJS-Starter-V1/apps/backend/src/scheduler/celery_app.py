"""
Celery application for background job scheduling.

Handles periodic tasks like:
- Syncing CIN7 stock levels every 15 minutes
- Syncing CIN7 products every hour
- Syncing Shopify orders every 5 minutes
- Running StockTrim forecasts daily
- Running autonomous agents on schedule
- Health checks
"""

from celery import Celery
from celery.schedules import crontab

from src.config.settings import get_settings

settings = get_settings()

# Create Celery app
celery_app = Celery(
    "ccw_erp",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "src.scheduler.tasks",
    ],
)

# Celery configuration
celery_app.conf.update(
    # Task execution
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task routing
    task_routes={
        "src.scheduler.tasks.sync_*": {"queue": "integrations"},
        "src.scheduler.tasks.run_agent_*": {"queue": "agents"},
        "src.scheduler.tasks.health_check": {"queue": "monitoring"},
    },
    # Task retry
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Worker
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    # Results
    result_expires=3600,  # 1 hour
    result_extended=True,
)

# Periodic task schedule
celery_app.conf.beat_schedule = {
    # CIN7 Integration - Stock Sync (Every 15 minutes)
    "sync-cin7-stock-every-15-minutes": {
        "task": "src.scheduler.tasks.sync_cin7_stock",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "integrations"},
    },
    # CIN7 Integration - Product Sync (Every hour)
    "sync-cin7-products-every-hour": {
        "task": "src.scheduler.tasks.sync_cin7_products",
        "schedule": crontab(minute=0),
        "options": {"queue": "integrations"},
    },
    # CIN7 Integration - Purchase Orders Sync (Every 2 hours)
    "sync-cin7-purchase-orders-every-2-hours": {
        "task": "src.scheduler.tasks.sync_cin7_purchase_orders",
        "schedule": crontab(minute=0, hour="*/2"),
        "options": {"queue": "integrations"},
    },
    # Shopify Integration - Order Sync (Every 5 minutes)
    "sync-shopify-orders-every-5-minutes": {
        "task": "src.scheduler.tasks.sync_shopify_orders",
        "schedule": crontab(minute="*/5"),
        "options": {"queue": "integrations"},
    },
    # StockTrim Integration - Forecast Update (Daily at 1am UTC)
    "update-stocktrim-forecasts-daily": {
        "task": "src.scheduler.tasks.update_stocktrim_forecasts",
        "schedule": crontab(hour=1, minute=0),
        "options": {"queue": "integrations"},
    },
    # Autonomous Agents - Stock Checker (Every 6 hours)
    "run-stock-checker-agent-every-6-hours": {
        "task": "src.scheduler.tasks.run_agent_stock_checker",
        "schedule": crontab(minute=0, hour="*/6"),
        "options": {"queue": "agents"},
    },
    # Autonomous Agents - Backorder Manager (Daily at 9am UTC)
    "run-backorder-manager-agent-daily": {
        "task": "src.scheduler.tasks.run_agent_backorder_manager",
        "schedule": crontab(hour=9, minute=0),
        "options": {"queue": "agents"},
    },
    # Autonomous Agents - Container Tracker (Hourly)
    "run-container-tracker-agent-hourly": {
        "task": "src.scheduler.tasks.run_agent_container_tracker",
        "schedule": crontab(minute=0),
        "options": {"queue": "agents"},
    },
    # Autonomous Agents - Demand Forecaster (Daily at 2am UTC)
    "run-demand-forecaster-agent-daily": {
        "task": "src.scheduler.tasks.run_agent_demand_forecaster",
        "schedule": crontab(hour=2, minute=0),
        "options": {"queue": "agents"},
    },
    # Monitoring - Health Check (Every minute)
    "health-check-integrations-every-minute": {
        "task": "src.scheduler.tasks.health_check_integrations",
        "schedule": crontab(minute="*/1"),
        "options": {"queue": "monitoring"},
    },
    # Maintenance - Cleanup old logs (Weekly on Sunday at 2am UTC)
    "cleanup-old-logs-weekly": {
        "task": "src.scheduler.tasks.cleanup_old_logs",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
        "options": {"queue": "monitoring"},
    },
}

# Celery signals for logging
@celery_app.task(bind=True)
def debug_task(self):
    """Debug task to test Celery configuration."""
    print(f"Request: {self.request!r}")
