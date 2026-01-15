"""Alert management service for critical system notifications."""

import structlog
from datetime import UTC, datetime
from typing import Any

logger = structlog.get_logger(__name__)


class AlertManager:
    """Manages system alerts and notifications."""

    def __init__(self) -> None:
        """Initialize the alert manager."""
        self._alerts: list[dict[str, Any]] = []

    async def create_alert(
        self,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create a new alert.

        Args:
            alert_type: Type of alert (e.g., "backorder", "low_stock", "system_error")
            severity: Severity level ("info", "warning", "error", "critical")
            title: Alert title
            message: Alert message
            metadata: Additional metadata

        Returns:
            The created alert
        """
        alert = {
            "id": len(self._alerts) + 1,
            "type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "metadata": metadata or {},
            "created_at": datetime.now(UTC),
            "acknowledged": False,
        }

        self._alerts.append(alert)

        logger.info(
            "Alert created",
            alert_type=alert_type,
            severity=severity,
            title=title,
        )

        return alert

    async def get_alerts(
        self,
        alert_type: str | None = None,
        severity: str | None = None,
        acknowledged: bool | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get alerts with optional filtering.

        Args:
            alert_type: Filter by alert type
            severity: Filter by severity
            acknowledged: Filter by acknowledged status

        Returns:
            List of matching alerts
        """
        alerts = self._alerts

        if alert_type:
            alerts = [a for a in alerts if a["type"] == alert_type]

        if severity:
            alerts = [a for a in alerts if a["severity"] == severity]

        if acknowledged is not None:
            alerts = [a for a in alerts if a["acknowledged"] == acknowledged]

        return alerts

    async def acknowledge_alert(self, alert_id: int) -> bool:
        """
        Acknowledge an alert.

        Args:
            alert_id: ID of the alert to acknowledge

        Returns:
            True if successful, False otherwise
        """
        for alert in self._alerts:
            if alert["id"] == alert_id:
                alert["acknowledged"] = True
                alert["acknowledged_at"] = datetime.now(UTC)
                logger.info("Alert acknowledged", alert_id=alert_id)
                return True

        return False

    async def clear_old_alerts(self, days: int = 30) -> int:
        """
        Clear alerts older than specified days.

        Args:
            days: Number of days to keep alerts

        Returns:
            Number of alerts cleared
        """
        from datetime import timedelta

        cutoff_date = datetime.now(UTC) - timedelta(days=days)
        initial_count = len(self._alerts)

        self._alerts = [
            a for a in self._alerts
            if a["created_at"] > cutoff_date
        ]

        cleared_count = initial_count - len(self._alerts)
        logger.info("Old alerts cleared", count=cleared_count, days=days)

        return cleared_count


# Global alert manager instance
_alert_manager: AlertManager | None = None


def get_alert_manager() -> AlertManager:
    """
    Get the global alert manager instance.

    Returns:
        The global AlertManager instance
    """
    global _alert_manager
    if _alert_manager is None:
        _alert_manager = AlertManager()
        logger.info("Alert manager initialized")
    return _alert_manager
