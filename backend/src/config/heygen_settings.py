"""HeyGen avatar video generation integration settings."""

from typing import Literal

import structlog
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = structlog.get_logger(__name__)


class HeyGenSettings(BaseSettings):
    """
    HeyGen API configuration.

    Supports two modes:
    - demo: Returns mock video data for testing without API calls
    - live: Makes real API calls to HeyGen API
    """

    model_config = SettingsConfigDict(
        extra="ignore",
        env_file=".env",
        case_sensitive=False,
    )

    # Mode configuration
    mode: Literal["demo", "live"] = Field(
        default="demo",
        alias="HEYGEN_MODE",
        description="Operating mode: 'demo' for testing, 'live' for production",
    )

    # API credentials
    api_key: str = Field(
        default="demo_heygen_api_key",
        alias="HEYGEN_API_KEY",
        description="HeyGen API key",
    )

    # API configuration
    api_base_url: str = Field(
        default="https://api.heygen.com",
        alias="HEYGEN_API_BASE_URL",
        description="HeyGen API base URL",
    )

    timeout: int = Field(
        default=60,
        alias="HEYGEN_TIMEOUT",
        description="Request timeout in seconds",
    )

    # Default video settings
    default_avatar_id: str = Field(
        default="Daisy-inskirt-20220818",
        alias="HEYGEN_DEFAULT_AVATAR_ID",
        description="Default HeyGen avatar ID",
    )

    default_voice_id: str = Field(
        default="1bd001e7e50f421d891986aad5158bc8",
        alias="HEYGEN_DEFAULT_VOICE_ID",
        description="Default HeyGen voice ID",
    )

    default_width: int = Field(
        default=1280,
        alias="HEYGEN_DEFAULT_WIDTH",
        description="Default video width in pixels",
    )

    default_height: int = Field(
        default=720,
        alias="HEYGEN_DEFAULT_HEIGHT",
        description="Default video height in pixels",
    )

    # Cost tracking (USD per minute of generated video)
    cost_per_minute_usd: float = Field(
        default=0.07,
        alias="HEYGEN_COST_PER_MINUTE_USD",
        description="Estimated cost per minute of generated video",
    )

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    def get_dimension(self) -> dict[str, int]:
        """Get default video dimension."""
        return {"width": self.default_width, "height": self.default_height}


# Global singleton
heygen_settings = HeyGenSettings()
logger.info("heygen_settings_loaded", mode=heygen_settings.mode)
