"""Background health monitoring for AI agents."""

import asyncio
from datetime import UTC, datetime

from src.ai.orchestration import AgentStatus, get_agent_registry
from src.utils import get_logger

from .metrics_collector import get_metrics_collector

logger = get_logger(__name__)


class HealthMonitor:
    """Background task for monitoring agent health."""

    def __init__(self, check_interval_seconds: int = 60):
        """Initialize health monitor.

        Args:
            check_interval_seconds: Interval between health checks (default: 60)
        """
        self.check_interval = check_interval_seconds
        self.is_running = False
        self._task: asyncio.Task | None = None
        self.registry = get_agent_registry()
        self.metrics_collector = get_metrics_collector()
        logger.info(
            "Health monitor initialized",
            check_interval_seconds=check_interval_seconds,
        )

    async def start(self) -> None:
        """Start the health monitoring background task."""
        if self.is_running:
            logger.warning("Health monitor already running")
            return

        self.is_running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Health monitor started")

    async def stop(self) -> None:
        """Stop the health monitoring background task."""
        if not self.is_running:
            logger.warning("Health monitor not running")
            return

        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Health monitor stopped")

    async def _monitor_loop(self) -> None:
        """Main monitoring loop that runs continuously."""
        while self.is_running:
            try:
                await self._perform_health_checks()
            except Exception as e:
                logger.error("Health check failed", error=str(e))

            # Wait for next check interval
            await asyncio.sleep(self.check_interval)

    async def _perform_health_checks(self) -> None:
        """Perform health checks on all registered agents."""
        all_agents = self.registry.get_all_agents()
        agent_ids = [agent_id for agent_id, _, _ in all_agents]
        timestamp = datetime.now(UTC).isoformat()

        logger.debug("Performing health checks", agent_count=len(agent_ids))

        for agent_id in agent_ids:
            try:
                agent = self.registry.get_agent(agent_id)
                if not agent:
                    logger.warning("Agent not found in registry", agent_id=agent_id)
                    continue

                # Perform health check
                start_time = datetime.now(UTC)
                health_report = await agent.health_check()
                end_time = datetime.now(UTC)

                duration_ms = int((end_time - start_time).total_seconds() * 1000)

                # Record health check as a metric
                self.metrics_collector.record_execution(
                    execution_id=f"health-{agent_id}-{timestamp}",
                    agent_id=agent_id,
                    agent_name=agent.name,
                    task="health_check",
                    status="completed" if health_report.status == AgentStatus.ACTIVE else "degraded",
                    started_at=start_time.isoformat(),
                    completed_at=end_time.isoformat(),
                    duration_ms=duration_ms,
                    metadata={
                        "health_status": health_report.status.value,
                        "response_time_ms": health_report.response_time_ms,
                        "checks_passed": health_report.checks_passed,
                        "checks_failed": health_report.checks_failed,
                        "error": health_report.error,
                    },
                )

                # Log degraded agents
                if health_report.status != AgentStatus.ACTIVE:
                    logger.warning(
                        "Agent health degraded",
                        agent_id=agent_id,
                        status=health_report.status.value,
                        checks_passed=health_report.checks_passed,
                        checks_failed=health_report.checks_failed,
                        error=health_report.error,
                    )

            except Exception as e:
                logger.error(
                    "Agent health check failed",
                    agent_id=agent_id,
                    error=str(e),
                )

                # Record failed health check
                self.metrics_collector.record_execution(
                    execution_id=f"health-{agent_id}-{timestamp}",
                    agent_id=agent_id,
                    agent_name=agent_id,
                    task="health_check",
                    status="failed",
                    started_at=timestamp,
                    error=str(e),
                )

    async def get_status(self) -> dict:
        """Get current status of the health monitor.

        Returns:
            dict: Monitor status including running state and last check time
        """
        all_agents = self.registry.get_all_agents()
        return {
            "is_running": self.is_running,
            "check_interval_seconds": self.check_interval,
            "monitored_agents": len(all_agents),
        }


# Global health monitor instance
_health_monitor: HealthMonitor | None = None


def get_health_monitor() -> HealthMonitor:
    """Get or create health monitor singleton.

    Returns:
        HealthMonitor: The global health monitor instance
    """
    global _health_monitor
    if _health_monitor is None:
        _health_monitor = HealthMonitor()
    return _health_monitor
