"""Xero integration settings.

Loads Xero configuration from environment variables with validation.
"""

import os
from typing import Literal

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class XeroSettings(BaseSettings):
    """Xero integration configuration."""

    model_config = ConfigDict(extra="ignore", env_file=".env", case_sensitive=False)

    # Mode: "demo" for testing without real API calls, "live" for production
    mode: Literal["demo", "live"] = Field(default="demo", alias="XERO_MODE")

    # OAuth2 credentials
    client_id: str = Field(default="demo_client_id_12345", alias="XERO_CLIENT_ID")
    client_secret: str = Field(default="demo_client_secret_67890", alias="XERO_CLIENT_SECRET")
    redirect_uri: str = Field(
        default="http://localhost:8000/api/integrations/xero/callback",
        alias="XERO_REDIRECT_URI",
    )

    # Scopes
    scopes: str = Field(
        default="accounting.transactions accounting.contacts accounting.settings.read",
        alias="XERO_SCOPES",
    )

    # Webhook key for signature verification
    webhook_key: str = Field(default="demo_webhook_key_abcdef", alias="XERO_WEBHOOK_KEY")

    @property
    def scopes_list(self) -> list[str]:
        """Get scopes as list."""
        return self.scopes.split()

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    @property
    def is_live_mode(self) -> bool:
        """Check if running in live mode."""
        return self.mode == "live"


# Global settings instance
xero_settings = XeroSettings()


def get_xero_settings() -> XeroSettings:
    """Get Xero settings instance (for dependency injection)."""
    return xero_settings
