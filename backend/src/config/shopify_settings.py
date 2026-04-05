"""Shopify integration settings.

Loads Shopify configuration from environment variables with validation.
"""

from typing import Literal

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class ShopifySettings(BaseSettings):
    """Shopify integration configuration."""

    model_config = ConfigDict(extra="ignore", env_file=".env", case_sensitive=False)

    # Mode: "demo" for testing without real API calls, "live" for production
    mode: Literal["demo", "live"] = Field(default="demo", alias="SHOPIFY_MODE")

    # Shopify store details
    shop_domain: str = Field(
        default="demo-store.myshopify.com",
        alias="SHOPIFY_SHOP_DOMAIN",
    )

    # API credentials (Admin API)
    api_key: str = Field(default="demo_api_key_12345", alias="SHOPIFY_API_KEY")
    api_secret: str = Field(default="demo_api_secret_67890", alias="SHOPIFY_API_SECRET")
    access_token: str = Field(
        default="demo_access_token_abcdef",
        alias="SHOPIFY_ACCESS_TOKEN",
    )

    # API version
    api_version: str = Field(default="2024-01", alias="SHOPIFY_API_VERSION")

    # Webhook configuration
    webhook_secret: str = Field(
        default="demo_webhook_secret_xyz",
        alias="SHOPIFY_WEBHOOK_SECRET",
    )

    # Inventory sync settings
    sync_inventory: bool = Field(default=True, alias="SHOPIFY_SYNC_INVENTORY")
    inventory_location_id: str | None = Field(
        default=None,
        alias="SHOPIFY_INVENTORY_LOCATION_ID",
    )

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    @property
    def is_live_mode(self) -> bool:
        """Check if running in live mode."""
        return self.mode == "live"

    @property
    def shop_url(self) -> str:
        """Get full shop URL."""
        return f"https://{self.shop_domain}"

    @property
    def admin_api_url(self) -> str:
        """Get Admin API base URL."""
        return f"https://{self.shop_domain}/admin/api/{self.api_version}"


# Global settings instance
shopify_settings = ShopifySettings()


def get_shopify_settings() -> ShopifySettings:
    """Get Shopify settings instance (for dependency injection)."""
    return shopify_settings
