"""Alert management service for critical system notifications."""

from datetime import UTC, datetime
from typing import Any

import structlog

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
        send_notification: bool = True,
    ) -> dict[str, Any]:
        """
        Create a new alert.

        Args:
            alert_type: Type of alert (e.g., "backorder", "low_stock", "system_error")
            severity: Severity level ("info", "warning", "error", "critical")
            title: Alert title
            message: Alert message
            metadata: Additional metadata
            send_notification: Whether to send email/Slack notification

        Returns:
            The created alert
        """
        # Check for duplicate alerts
        if self.check_duplicate_alert(alert_type):
            logger.info(
                "Duplicate alert suppressed",
                alert_type=alert_type,
                severity=severity,
            )
            return {
                "id": 0,
                "suppressed": True,
                "reason": "Duplicate alert within 1 hour",
            }

        alert = {
            "id": len(self._alerts) + 1,
            "type": alert_type,
            "severity": severity,
            "title": title,
            "message": message,
            "metadata": metadata or {},
            "created_at": datetime.now(UTC),
            "acknowledged": False,
            "resolved": False,
        }

        self._alerts.append(alert)

        logger.info(
            "Alert created",
            alert_type=alert_type,
            severity=severity,
            title=title,
        )

        # Send notification if requested and severity is high enough
        if send_notification and severity in ["error", "critical"]:
            await self.trigger_notification(alert)

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

    async def resolve_alert(self, alert_id: int) -> bool:
        """
        Resolve an alert.

        Args:
            alert_id: ID of the alert to resolve

        Returns:
            True if successful, False otherwise
        """
        for alert in self._alerts:
            if alert["id"] == alert_id:
                alert["resolved"] = True
                alert["resolved_at"] = datetime.now(UTC)
                logger.info("Alert resolved", alert_id=alert_id)
                return True

        return False

    async def trigger_notification(self, alert: dict[str, Any]) -> dict[str, bool]:
        """
        Trigger notification for an alert via email/Slack.

        Args:
            alert: Alert dictionary

        Returns:
            Dict with notification results
        """
        try:
            from src.services.system_alert_service import get_system_alert_service

            service = get_system_alert_service()
            results = await service.send_alert_notification(
                alert_type=alert["type"],
                severity=alert["severity"],
                title=alert["title"],
                message=alert["message"],
                metadata=alert.get("metadata"),
            )

            logger.info(
                "Alert notification sent",
                alert_id=alert["id"],
                email_sent=results["email"],
                slack_sent=results["slack"],
            )

            return results

        except Exception as e:
            logger.error("Failed to trigger notification", error=str(e))
            return {"email": False, "slack": False}

    def check_duplicate_alert(self, alert_type: str, hours: int = 1) -> bool:
        """
        Check if a duplicate alert of this type exists in the last N hours.

        Args:
            alert_type: Alert type to check
            hours: Hours to look back

        Returns:
            True if duplicate found, False otherwise
        """
        cutoff = datetime.now(UTC) - timedelta(hours=hours)
        for alert in self._alerts:
            if (
                alert["type"] == alert_type
                and alert["created_at"] > cutoff
                and not alert.get("resolved", False)
            ):
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
