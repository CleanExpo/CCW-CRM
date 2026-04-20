"""Cin7 integration settings.

Loads Cin7 Core and Cin7 Omni configuration from environment variables.
Cin7 has two separate products with different APIs:
- Cin7 Core (formerly DEAR Inventory): Header-based auth
- Cin7 Omni (formerly Cin7): Basic Auth
"""

from typing import Literal

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class Cin7Settings(BaseSettings):
    """Cin7 integration configuration for both Core and Omni APIs."""

    model_config = ConfigDict(extra="ignore", env_file=".env", case_sensitive=False)

    # Mode: "demo" for testing without real API calls, "live" for production
    mode: Literal["demo", "live"] = Field(default="demo", alias="CIN7_MODE")

    # --- Cin7 Core (DEAR Inventory) credentials ---
    core_account_id: str = Field(
        default="demo_account_id",
        alias="CIN7_CORE_ACCOUNT_ID",
    )
    core_application_key: str = Field(
        default="demo_application_key",
        alias="CIN7_CORE_APPLICATION_KEY",
    )
    core_base_url: str = Field(
        default="https://inventory.dearsystems.com/ExternalApi/v2",
        alias="CIN7_CORE_BASE_URL",
    )

    # --- Cin7 Omni credentials ---
    omni_username: str = Field(
        default="demo_omni_username",
        alias="CIN7_OMNI_USERNAME",
    )
    omni_api_key: str = Field(
        default="demo_omni_api_key",
        alias="CIN7_OMNI_API_KEY",
    )
    omni_base_url: str = Field(
        default="https://api.cin7.com/api/v1",
        alias="CIN7_OMNI_BASE_URL",
    )

    # Shared settings
    api_timeout: int = Field(default=30, alias="CIN7_API_TIMEOUT")
    webhook_secret: str = Field(
        default="demo_cin7_webhook_secret",
        alias="CIN7_WEBHOOK_SECRET",
    )

    # Sync toggles
    sync_products: bool = Field(default=True, alias="CIN7_SYNC_PRODUCTS")
    sync_customers: bool = Field(default=True, alias="CIN7_SYNC_CUSTOMERS")
    sync_sales: bool = Field(default=True, alias="CIN7_SYNC_SALES")
    sync_inventory: bool = Field(default=True, alias="CIN7_SYNC_INVENTORY")
    sync_purchase_orders: bool = Field(default=True, alias="CIN7_SYNC_PURCHASE_ORDERS")

    # Polling configuration (seconds) — Core has no webhooks, polling is primary
    polling_enabled: bool = Field(default=True, alias="CIN7_POLLING_ENABLED")
    poll_interval_products: int = Field(default=300, alias="CIN7_POLL_INTERVAL_PRODUCTS")
    poll_interval_customers: int = Field(default=300, alias="CIN7_POLL_INTERVAL_CUSTOMERS")
    poll_interval_sales: int = Field(default=120, alias="CIN7_POLL_INTERVAL_SALES")
    poll_interval_inventory: int = Field(default=60, alias="CIN7_POLL_INTERVAL_INVENTORY")
    poll_interval_purchase_orders: int = Field(default=300, alias="CIN7_POLL_INTERVAL_PURCHASE_ORDERS")

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    @property
    def is_live_mode(self) -> bool:
        """Check if running in live mode."""
        return self.mode == "live"

    @property
    def core_api_url(self) -> str:
        """Get Cin7 Core API base URL."""
        return self.core_base_url.rstrip("/")

    @property
    def omni_api_url(self) -> str:
        """Get Cin7 Omni API base URL."""
        return self.omni_base_url.rstrip("/")


# Global settings instance
cin7_settings = Cin7Settings()


def get_cin7_settings() -> Cin7Settings:
    """Get Cin7 settings instance (for dependency injection)."""
    return cin7_settings
