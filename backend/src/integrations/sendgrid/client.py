"""Unified SendGrid client that switches between demo and live modes."""

from typing import Any

from src.config.sendgrid_settings import SendGridSettings, sendgrid_settings
from src.integrations.sendgrid.demo_client import SendGridDemoClient
from src.integrations.sendgrid.live_client import SendGridLiveClient


def get_sendgrid_client(
    settings: SendGridSettings | None = None,
) -> SendGridDemoClient | SendGridLiveClient:
    """Get appropriate SendGrid client based on configuration.

    Args:
        settings: SendGrid settings (optional, uses global if not provided)

    Returns:
        SendGridDemoClient or SendGridLiveClient based on mode
    """
    if settings is None:
        settings = sendgrid_settings

    if settings.is_demo_mode:
        return SendGridDemoClient()
    else:
        return SendGridLiveClient(
            api_key=settings.api_key,
            from_email=settings.from_email,
            from_name=settings.from_name,
        )


class SendGridClient:
    """Wrapper class for SendGrid operations.

    Provides a consistent interface regardless of demo/live mode.
    """

    def __init__(self, settings: SendGridSettings | None = None) -> None:
        """Initialize SendGrid client wrapper.

        Args:
            settings: SendGrid settings (optional)
        """
        self.settings = settings or sendgrid_settings
        self.client = get_sendgrid_client(self.settings)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send an email.

        Args:
            to_email: Recipient email
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body (optional)
            **kwargs: Additional arguments passed to client

        Returns:
            Response dict with message_id and status
        """
        return await self.client.send_email(
            to_email=to_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            **kwargs,
        )

    async def send_bulk_email(
        self,
        recipients: list[dict[str, str]],
        subject: str,
        body_text: str,
        body_html: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send bulk email.

        Args:
            recipients: List of {email, name} dicts
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body (optional)
            **kwargs: Additional arguments

        Returns:
            Response dict with message_ids and sent_count
        """
        return await self.client.send_bulk_email(
            recipients=recipients,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            **kwargs,
        )

    async def get_email_status(self, message_id: str) -> dict[str, Any]:
        """Get email delivery status.

        Args:
            message_id: SendGrid message ID

        Returns:
            Status dict
        """
        return await self.client.get_email_status(message_id)

    def is_demo_mode(self) -> bool:
        """Check if running in demo mode.

        Returns:
            True if demo mode, False if live
        """
        return self.settings.is_demo_mode
