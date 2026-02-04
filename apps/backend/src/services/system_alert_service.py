"""System alert notification service for monitoring and operations."""

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import structlog

from src.config import get_settings

logger = structlog.get_logger(__name__)


class SystemAlertService:
    """Service for sending system alert notifications to operations team."""

    def __init__(self) -> None:
        """Initialize the system alert service."""
        self.settings = get_settings()
        self._rate_limit_cache: dict[str, list[datetime]] = {}
        self._max_alerts_per_hour = 10

    async def send_alert_notification(
        self,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, bool]:
        """
        Send system alert notification via email and/or Slack.

        Args:
            alert_type: Type of alert (e.g., "high_error_rate", "low_stock")
            severity: Severity level ("info", "warning", "error", "critical")
            title: Alert title
            message: Alert message
            metadata: Additional metadata

        Returns:
            Dict with email and slack success status
        """
        # Check rate limiting
        if not self._check_rate_limit(alert_type):
            logger.warning(
                "Alert rate limit exceeded",
                alert_type=alert_type,
                max_per_hour=self._max_alerts_per_hour,
            )
            return {"email": False, "slack": False}

        # Record this alert for rate limiting
        self._record_alert(alert_type)

        results = {"email": False, "slack": False}

        # Send email if configured
        if self._is_email_configured():
            try:
                await self._send_email(severity, title, message, metadata)
                results["email"] = True
                logger.info("Email alert sent", alert_type=alert_type, severity=severity)
            except Exception as e:
                logger.error("Failed to send email alert", error=str(e), alert_type=alert_type)

        # Send Slack if configured
        if self._is_slack_configured():
            try:
                await self._send_slack(severity, title, message, metadata)
                results["slack"] = True
                logger.info("Slack alert sent", alert_type=alert_type, severity=severity)
            except Exception as e:
                logger.error("Failed to send Slack alert", error=str(e), alert_type=alert_type)

        # If neither worked, at least log it
        if not results["email"] and not results["slack"]:
            logger.warning(
                "System alert not sent (no channels configured)",
                alert_type=alert_type,
                severity=severity,
                title=title,
            )

        return results

    def _check_rate_limit(self, alert_type: str) -> bool:
        """
        Check if alert type is within rate limit.

        Args:
            alert_type: Type of alert

        Returns:
            True if within rate limit, False otherwise
        """
        now = datetime.now(UTC)
        one_hour_ago = now - timedelta(hours=1)

        # Get recent alerts of this type
        recent_alerts = self._rate_limit_cache.get(alert_type, [])

        # Filter to only alerts in the last hour
        recent_alerts = [ts for ts in recent_alerts if ts > one_hour_ago]

        # Update cache
        self._rate_limit_cache[alert_type] = recent_alerts

        # Check if under limit
        return len(recent_alerts) < self._max_alerts_per_hour

    def _record_alert(self, alert_type: str) -> None:
        """
        Record alert for rate limiting.

        Args:
            alert_type: Type of alert
        """
        now = datetime.now(UTC)
        if alert_type not in self._rate_limit_cache:
            self._rate_limit_cache[alert_type] = []
        self._rate_limit_cache[alert_type].append(now)

    def _is_email_configured(self) -> bool:
        """Check if email is configured."""
        return bool(
            self.settings.smtp_host
            and self.settings.smtp_user
            and self.settings.smtp_password
            and self.settings.alert_email_to
        )

    def _is_slack_configured(self) -> bool:
        """Check if Slack is configured."""
        return bool(self.settings.slack_webhook_url)

    async def _send_email(
        self,
        severity: str,
        title: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Send email notification using fastapi-mail.

        Args:
            severity: Alert severity
            title: Alert title
            message: Alert message
            metadata: Additional metadata
        """
        # Import here to avoid dependency if not using email
        from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

        # Email configuration
        conf = ConnectionConfig(
            MAIL_USERNAME=self.settings.smtp_user or "",
            MAIL_PASSWORD=self.settings.smtp_password or "",
            MAIL_FROM=self.settings.smtp_user or "",
            MAIL_PORT=self.settings.smtp_port,
            MAIL_SERVER=self.settings.smtp_host or "",
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
        )

        # Prepare email body
        html_body = self._get_email_template(severity, title, message, metadata)

        # Create message
        message_schema = MessageSchema(
            subject=f"[{severity.upper()}] CCW-ERP Alert: {title}",
            recipients=[self.settings.alert_email_to or ""],
            body=html_body,
            subtype=MessageType.html,
        )

        # Send email
        fm = FastMail(conf)
        await fm.send_message(message_schema)

    async def _send_slack(
        self,
        severity: str,
        title: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Send Slack notification via webhook.

        Args:
            severity: Alert severity
            title: Alert title
            message: Alert message
            metadata: Additional metadata
        """
        # Severity color mapping
        color_map = {
            "critical": "#dc2626",  # red-600
            "error": "#ea580c",  # orange-600
            "warning": "#ca8a04",  # yellow-600
            "info": "#0284c7",  # sky-600
        }

        # Severity emoji mapping
        emoji_map = {
            "critical": "🚨",
            "error": "❌",
            "warning": "⚠️",
            "info": "ℹ️",
        }

        color = color_map.get(severity, "#6b7280")  # gray-500
        emoji = emoji_map.get(severity, "📢")

        # Prepare Slack payload
        payload = {
            "attachments": [
                {
                    "color": color,
                    "blocks": [
                        {
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": f"{emoji} {title}",
                            },
                        },
                        {
                            "type": "section",
                            "fields": [
                                {
                                    "type": "mrkdwn",
                                    "text": f"*Severity:*\n{severity.upper()}",
                                },
                                {
                                    "type": "mrkdwn",
                                    "text": f"*Time:*\n{datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}",
                                },
                            ],
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": f"*Message:*\n{message}",
                            },
                        },
                    ],
                }
            ]
        }

        # Add metadata if present
        if metadata:
            metadata_text = "\n".join(
                [f"*{k}:* {v}" for k, v in metadata.items()]
            )
            payload["attachments"][0]["blocks"].append(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Details:*\n{metadata_text}",
                    },
                }
            )

        # Send to Slack
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.settings.slack_webhook_url or "",
                json=payload,
                timeout=10.0,
            )
            response.raise_for_status()

    def _get_email_template(
        self,
        severity: str,
        title: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Get HTML email template for system alerts.

        Args:
            severity: Alert severity
            title: Alert title
            message: Alert message
            metadata: Additional metadata

        Returns:
            HTML email body
        """
        # Severity color mapping
        color_map = {
            "critical": "#dc2626",
            "error": "#ea580c",
            "warning": "#ca8a04",
            "info": "#0284c7",
        }

        color = color_map.get(severity, "#6b7280")
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

        metadata_html = ""
        if metadata:
            metadata_rows = "\n".join(
                [
                    f"<tr><td style='padding: 8px; border-bottom: 1px solid #e5e7eb;'><strong>{k}:</strong></td>"
                    f"<td style='padding: 8px; border-bottom: 1px solid #e5e7eb;'>{v}</td></tr>"
                    for k, v in metadata.items()
                ]
            )
            metadata_html = f"""
            <h3 style='color: #374151; margin-top: 24px;'>Details</h3>
            <table style='width: 100%; border-collapse: collapse;'>
                {metadata_rows}
            </table>
            """

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;'>
            <div style='max-width: 600px; margin: 40px auto; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'>
                <div style='background-color: {color}; color: white; padding: 24px; border-radius: 8px 8px 0 0;'>
                    <h1 style='margin: 0; font-size: 24px;'>CCW-Online ERP System Alert</h1>
                    <p style='margin: 8px 0 0 0; opacity: 0.9;'>{severity.upper()}</p>
                </div>
                <div style='padding: 24px;'>
                    <h2 style='color: #111827; margin-top: 0;'>{title}</h2>
                    <p style='color: #6b7280; font-size: 14px; margin: 8px 0;'>{timestamp}</p>
                    <div style='background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin-top: 16px;'>
                        <p style='color: #374151; margin: 0;'>{message}</p>
                    </div>
                    {metadata_html}
                    <div style='margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;'>
                        <p style='color: #6b7280; font-size: 12px; margin: 0;'>
                            This is an automated system alert from CCW-Online ERP monitoring.
                            To view the monitoring dashboard, visit <a href="http://localhost:3000/monitoring" style='color: {color};'>Monitoring Dashboard</a>.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """


# Global system alert service instance
_system_alert_service: SystemAlertService | None = None


def get_system_alert_service() -> SystemAlertService:
    """
    Get the global system alert service instance.

    Returns:
        The global SystemAlertService instance
    """
    global _system_alert_service
    if _system_alert_service is None:
        _system_alert_service = SystemAlertService()
        logger.info("System alert service initialized")
    return _system_alert_service
