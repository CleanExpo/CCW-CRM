"""SendGrid email integration settings.

This module manages SendGrid configuration for sending and receiving emails,
with support for Gmail and Microsoft 365 inbound email processing.
"""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class SendGridSettings(BaseSettings):
    """SendGrid integration configuration.

    Supports both demo mode (logs emails instead of sending) and live mode
    (actual email sending via SendGrid API).
    """

    model_config = SettingsConfigDict(
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Mode: demo or live
    mode: Literal["demo", "live"] = Field(
        default="demo",
        alias="SENDGRID_MODE",
        description="demo = log emails, live = send via SendGrid",
    )

    # SendGrid API credentials
    api_key: str = Field(
        default="demo_sendgrid_api_key",
        alias="SENDGRID_API_KEY",
        description="SendGrid API key for sending emails",
    )

    # Sender configuration
    from_email: str = Field(
        default="demo@ccwonline.com.au",
        alias="SENDGRID_FROM_EMAIL",
        description="Default sender email address",
    )

    from_name: str = Field(
        default="CCW Equipment Demo",
        alias="SENDGRID_FROM_NAME",
        description="Default sender name",
    )

    # Inbound email configuration
    inbound_webhook_secret: str = Field(
        default="demo_webhook_secret_12345",
        alias="SENDGRID_INBOUND_SECRET",
        description="Secret for validating inbound email webhooks",
    )

    # Email templates
    templates_enabled: bool = Field(
        default=True,
        alias="SENDGRID_TEMPLATES_ENABLED",
        description="Enable SendGrid dynamic templates",
    )

    # Template IDs (optional - for SendGrid dynamic templates)
    template_order_confirmation: str | None = Field(
        default=None,
        alias="SENDGRID_TEMPLATE_ORDER_CONFIRMATION",
        description="Template ID for order confirmation emails",
    )

    template_quote: str | None = Field(
        default=None,
        alias="SENDGRID_TEMPLATE_QUOTE",
        description="Template ID for quote emails",
    )

    template_invoice: str | None = Field(
        default=None,
        alias="SENDGRID_TEMPLATE_INVOICE",
        description="Template ID for invoice emails",
    )

    # AI response configuration
    ai_auto_response_enabled: bool = Field(
        default=True,
        alias="SENDGRID_AI_AUTO_RESPONSE",
        description="Enable AI-powered automatic email responses",
    )

    ai_confidence_threshold: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        alias="SENDGRID_AI_CONFIDENCE_THRESHOLD",
        description="Minimum confidence score for AI auto-response (0-1)",
    )

    # Rate limiting
    max_emails_per_hour: int = Field(
        default=100,
        ge=1,
        alias="SENDGRID_MAX_EMAILS_PER_HOUR",
        description="Maximum emails to send per hour (rate limit)",
    )

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    @property
    def is_live_mode(self) -> bool:
        """Check if running in live mode."""
        return self.mode == "live"


# Global settings instance
sendgrid_settings = SendGridSettings()


def get_sendgrid_settings() -> SendGridSettings:
    """Get SendGrid settings instance (for dependency injection)."""
    return sendgrid_settings
