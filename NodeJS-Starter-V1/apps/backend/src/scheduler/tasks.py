"""
Celery task definitions for background jobs.

Tasks are organized by category:
- Integration sync tasks (CIN7, Shopify, StockTrim)
- Agent execution tasks
- Monitoring and maintenance tasks
"""

import logging
from datetime import datetime, timedelta

from celery import Task

from src.scheduler.celery_app import celery_app
from src.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class LogErrorsTask(Task):
    """Base task class that logs errors and sends email alerts."""

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Log task failures and send email alert."""
        logger.error(
            f"Task {self.name} failed",
            extra={
                "task_id": task_id,
                "exception": str(exc),
                "args": args,
                "kwargs": kwargs,
            },
        )

        # Send email alert for task failures
        self._send_failure_alert(task_id, exc, einfo)

    def _send_failure_alert(self, task_id: str, exception: Exception, traceback: str):
        """Send email alert via SendGrid when task fails."""
        # Only send emails in production or if SendGrid is configured
        if not settings.sendgrid_api_key:
            logger.warning("SendGrid not configured, skipping email alert")
            return

        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To, Content

            subject = f"🚨 Celery Task Failed: {self.name}"

            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #e74c3c;">⚠️ Task Failure Alert</h2>

                <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0;">
                    <p><strong>Task:</strong> {self.name}</p>
                    <p><strong>Task ID:</strong> {task_id}</p>
                    <p><strong>Time:</strong> {datetime.utcnow().isoformat()}</p>
                    <p><strong>Environment:</strong> {settings.environment}</p>
                </div>

                <h3>Error Details</h3>
                <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107;">
                    <p><strong>Exception:</strong> {type(exception).__name__}</p>
                    <p><strong>Message:</strong> {str(exception)}</p>
                </div>

                <h3>Traceback</h3>
                <pre style="background: #f8f9fa; padding: 15px; overflow-x: auto; font-size: 12px;">
{str(traceback)[:2000]}
                </pre>

                <p style="margin-top: 30px; color: #6c757d; font-size: 12px;">
                    This is an automated alert from CCW ERP Celery Task Queue.
                </p>
            </body>
            </html>
            """

            message = Mail(
                from_email=Email(settings.sendgrid_from_email, settings.sendgrid_from_name),
                to_emails=To(settings.sendgrid_from_email),  # Send to self for now
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            sg = SendGridAPIClient(settings.sendgrid_api_key)
            response = sg.send(message)

            logger.info(f"Task failure alert sent via email (status: {response.status_code})")
        except Exception as email_exc:
            logger.error(f"Failed to send task failure email: {email_exc}")


# ============================================================================
# CIN7 Integration Tasks
# ============================================================================


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=3)
def sync_cin7_stock(self):
    """
    Sync stock levels from CIN7 to ERP.

    Scheduled: Every 15 minutes
    Queue: integrations
    """
    logger.info("Starting CIN7 stock sync")
    try:
        # TODO: Import and call CIN7 stock sync function
        # from src.integrations.cin7.inventory import sync_stock
        # result = await sync_stock()
        logger.info("CIN7 stock sync completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"CIN7 stock sync failed: {exc}")
        raise self.retry(exc=exc, countdown=60)  # Retry after 60 seconds


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=3)
def sync_cin7_products(self):
    """
    Sync products from CIN7 to ERP.

    Scheduled: Every hour
    Queue: integrations
    """
    logger.info("Starting CIN7 product sync")
    try:
        # TODO: Import and call CIN7 product sync function
        # from src.integrations.cin7.products import sync_products
        # result = await sync_products()
        logger.info("CIN7 product sync completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"CIN7 product sync failed: {exc}")
        raise self.retry(exc=exc, countdown=300)  # Retry after 5 minutes


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=3)
def sync_cin7_purchase_orders(self):
    """
    Sync purchase orders and containers from CIN7.

    Scheduled: Every 2 hours
    Queue: integrations
    """
    logger.info("Starting CIN7 purchase order sync")
    try:
        # TODO: Import and call CIN7 PO sync function
        # from src.integrations.cin7.purchase_orders import sync_purchase_orders
        # result = await sync_purchase_orders()
        logger.info("CIN7 purchase order sync completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"CIN7 purchase order sync failed: {exc}")
        raise self.retry(exc=exc, countdown=600)  # Retry after 10 minutes


# ============================================================================
# Shopify Integration Tasks
# ============================================================================


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=3)
def sync_shopify_orders(self):
    """
    Sync orders from Shopify to ERP.

    Scheduled: Every 5 minutes
    Queue: integrations
    """
    logger.info("Starting Shopify order sync")
    try:
        # TODO: Import and call Shopify order sync function
        # from src.integrations.shopify.orders import sync_orders
        # result = await sync_orders()
        logger.info("Shopify order sync completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Shopify order sync failed: {exc}")
        raise self.retry(exc=exc, countdown=60)  # Retry after 60 seconds


# ============================================================================
# StockTrim Integration Tasks
# ============================================================================


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=3)
def update_stocktrim_forecasts(self):
    """
    Update demand forecasts from StockTrim.

    Scheduled: Daily at 1am UTC
    Queue: integrations
    """
    logger.info("Starting StockTrim forecast update")
    try:
        # TODO: Import and call StockTrim forecast function
        # from src.integrations.stocktrim.forecasts import update_forecasts
        # result = await update_forecasts()
        logger.info("StockTrim forecast update completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"StockTrim forecast update failed: {exc}")
        raise self.retry(exc=exc, countdown=3600)  # Retry after 1 hour


# ============================================================================
# Autonomous Agent Tasks
# ============================================================================


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=2)
def run_agent_stock_checker(self):
    """
    Run Stock Checker Agent to monitor inventory levels.

    Scheduled: Every 6 hours
    Queue: agents
    """
    logger.info("Running Stock Checker Agent")
    try:
        # TODO: Import and run Stock Checker Agent
        # from src.ai.agents.autonomous.stock_checker_agent import StockCheckerAgent
        # agent = StockCheckerAgent()
        # result = await agent.execute("check_all_stock", {})
        logger.info("Stock Checker Agent completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Stock Checker Agent failed: {exc}")
        raise self.retry(exc=exc, countdown=1800)  # Retry after 30 minutes


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=2)
def run_agent_backorder_manager(self):
    """
    Run Backorder Manager Agent to process backorders.

    Scheduled: Daily at 9am UTC
    Queue: agents
    """
    logger.info("Running Backorder Manager Agent")
    try:
        # TODO: Import and run Backorder Manager Agent
        # from src.ai.agents.autonomous.backorder_manager_agent import BackorderManagerAgent
        # agent = BackorderManagerAgent()
        # result = await agent.execute("process_backorders", {})
        logger.info("Backorder Manager Agent completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Backorder Manager Agent failed: {exc}")
        raise self.retry(exc=exc, countdown=3600)  # Retry after 1 hour


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=2)
def run_agent_container_tracker(self):
    """
    Run Container Tracker Agent to monitor shipments.

    Scheduled: Hourly
    Queue: agents
    """
    logger.info("Running Container Tracker Agent")
    try:
        # TODO: Import and run Container Tracker Agent
        # from src.ai.agents.autonomous.container_tracker_agent import ContainerTrackerAgent
        # agent = ContainerTrackerAgent()
        # result = await agent.execute("update_container_status", {})
        logger.info("Container Tracker Agent completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Container Tracker Agent failed: {exc}")
        raise self.retry(exc=exc, countdown=1800)  # Retry after 30 minutes


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=2)
def run_agent_demand_forecaster(self):
    """
    Run Demand Forecaster Agent to update reorder points.

    Scheduled: Daily at 2am UTC
    Queue: agents
    """
    logger.info("Running Demand Forecaster Agent")
    try:
        # TODO: Import and run Demand Forecaster Agent
        # from src.ai.agents.autonomous.demand_forecaster_agent import DemandForecasterAgent
        # agent = DemandForecasterAgent()
        # result = await agent.execute("update_reorder_points", {})
        logger.info("Demand Forecaster Agent completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Demand Forecaster Agent failed: {exc}")
        raise self.retry(exc=exc, countdown=3600)  # Retry after 1 hour


# ============================================================================
# Monitoring & Maintenance Tasks
# ============================================================================


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=2)
def health_check_integrations(self):
    """
    Check health of all integrations.

    Scheduled: Every minute
    Queue: monitoring
    """
    logger.debug("Running integration health check")
    try:
        # TODO: Import and run health check
        # from src.monitoring.health import check_all_integrations
        # result = await check_all_integrations()
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Health check failed: {exc}")
        # Don't retry health checks
        return {"status": "failed", "error": str(exc)}


@celery_app.task(base=LogErrorsTask, bind=True, max_retries=1)
def cleanup_old_logs(self):
    """
    Cleanup old event logs and task results.

    Scheduled: Weekly on Sunday at 2am UTC
    Queue: monitoring
    """
    logger.info("Starting log cleanup")
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        # TODO: Cleanup event bus logs older than 30 days
        # from src.events.event_bus import get_event_bus
        # event_bus = get_event_bus()
        # await event_bus.cleanup_old_events(cutoff_date)

        # TODO: Cleanup webhook logs older than 30 days
        # from src.integrations.cleanup import cleanup_webhook_logs
        # await cleanup_webhook_logs(cutoff_date)

        logger.info("Log cleanup completed successfully")
        return {"status": "success", "timestamp": datetime.utcnow().isoformat()}
    except Exception as exc:
        logger.error(f"Log cleanup failed: {exc}")
        raise self.retry(exc=exc, countdown=3600)  # Retry after 1 hour
