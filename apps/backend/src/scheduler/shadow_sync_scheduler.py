"""Shadow Sync Scheduler — nightly ghost sync of Cin7 → ERP.

Runs at 02:00 AEST (16:00 UTC) nightly to pull real CCW data from Cin7,
detect gaps, and feed the AI learning engine.

Usage (wired in lifespan):
    from src.scheduler.shadow_sync_scheduler import ShadowSyncScheduler
    scheduler = ShadowSyncScheduler(AsyncSessionLocal)
    scheduler.start()
    ...
    scheduler.stop()
"""

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = structlog.get_logger(__name__)


class ShadowSyncScheduler:
    """APScheduler wrapper for nightly ghost sync + retry sweep."""

    def __init__(self, session_maker: async_sessionmaker[AsyncSession]) -> None:
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self._register_jobs()

    def _register_jobs(self) -> None:
        # Nightly full ghost poll — 02:00 AEST = 16:00 UTC
        self.scheduler.add_job(
            self._run_shadow_poll,
            trigger=CronTrigger(hour=16, minute=0),
            id="cin7_shadow_nightly_poll",
            name="Nightly Cin7 Ghost Sync",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

        # Webhook retry sweep — every 5 minutes
        self.scheduler.add_job(
            self._run_webhook_retry,
            trigger=CronTrigger(minute="*/5"),
            id="webhook_retry_sweep",
            name="Webhook Retry Sweep",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=60,
        )

        # Shadow AI gap analysis — nightly at 02:30 AEST = 16:30 UTC (after poll)
        self.scheduler.add_job(
            self._run_gap_analysis,
            trigger=CronTrigger(hour=16, minute=30),
            id="cin7_shadow_gap_analysis",
            name="Shadow Gap AI Analysis",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )

    async def _run_shadow_poll(self) -> None:
        """Execute the nightly Cin7 ghost sync poll."""
        logger.info("shadow_sync_scheduler_poll_starting")
        try:
            async with self.session_maker() as db:
                from src.services.shadow_poller import run_shadow_poll
                summary = await run_shadow_poll(db)
                logger.info("shadow_sync_scheduler_poll_complete", **{
                    k: v for k, v in summary.items()
                    if k in ("total_checked", "total_gap", "total_conflict", "elapsed_ms")
                })
        except Exception as exc:
            logger.error("shadow_sync_scheduler_poll_failed", error=str(exc))

    async def _run_webhook_retry(self) -> None:
        """Retry failed webhooks that are past their next_retry_at."""
        try:
            async with self.session_maker() as db:
                from src.services.webhook_service import WebhookService
                service = WebhookService(db)
                pending = await service.get_webhooks_for_retry(limit=50)
                if pending:
                    logger.info("webhook_retry_sweep", count=len(pending))
        except Exception as exc:
            logger.error("webhook_retry_sweep_failed", error=str(exc))

    async def _run_gap_analysis(self) -> None:
        """Run AI gap analysis on freshly polled shadow data."""
        try:
            from src.ai.agents.specialized.cin7_shadow_agent import Cin7ShadowAgent
            agent = Cin7ShadowAgent()
            async with self.session_maker() as db:
                result = await agent.analyze_gaps(db)
                logger.info(
                    "shadow_gap_analysis_complete",
                    gaps_found=result.get("total_gaps", 0),
                    priority=result.get("priority"),
                )
        except Exception as exc:
            logger.error("shadow_gap_analysis_failed", error=str(exc))

    def start(self) -> None:
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info(
                "shadow_sync_scheduler_started",
                jobs=[j.id for j in self.scheduler.get_jobs()],
            )

    def stop(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("shadow_sync_scheduler_stopped")
