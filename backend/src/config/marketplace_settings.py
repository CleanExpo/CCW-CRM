"""Marketplace integration settings.

Loads marketplace configuration from environment variables with validation.
Supports multi-channel marketplace sync (Shopify, eBay, Facebook).
"""

from typing import Literal

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class MarketplaceSettings(BaseSettings):
    """Marketplace integration configuration."""

    model_config = ConfigDict(extra="ignore", env_file=".env", case_sensitive=False)

    # Mode: "demo" for testing without real API calls, "live" for production
    mode: Literal["demo", "live"] = Field(default="demo", alias="MARKETPLACE_MODE")

    # Sync interval in seconds (how often to poll channels for changes)
    sync_interval_seconds: int = Field(default=300, alias="MARKETPLACE_SYNC_INTERVAL")

    # Maximum products per sync batch
    batch_size: int = Field(default=50, alias="MARKETPLACE_BATCH_SIZE")

    # Rate limit: max API calls per minute per channel
    rate_limit_per_minute: int = Field(default=40, alias="MARKETPLACE_RATE_LIMIT")

    # Enable inventory sync across channels
    sync_inventory: bool = Field(default=True, alias="MARKETPLACE_SYNC_INVENTORY")

    # Default currency for marketplace listings
    default_currency: str = Field(default="AUD", alias="MARKETPLACE_DEFAULT_CURRENCY")

    # Default shipping origin (Australian postcode)
    shipping_origin_postcode: str = Field(default="4000", alias="MARKETPLACE_SHIPPING_POSTCODE")

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    @property
    def is_live_mode(self) -> bool:
        """Check if running in live mode."""
        return self.mode == "live"


# Global settings instance
marketplace_settings = MarketplaceSettings()


def get_marketplace_settings() -> MarketplaceSettings:
    """Get marketplace settings instance (for dependency injection)."""
    return marketplace_settings
