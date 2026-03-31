"""HeyGen client wrapper — switches between demo and live modes."""

from typing import Any

import structlog

from src.config.heygen_settings import HeyGenSettings, heygen_settings

from .demo_client import HeyGenDemoClient
from .live_client import HeyGenLiveClient

logger = structlog.get_logger(__name__)


def get_heygen_client(
    settings: HeyGenSettings | None = None,
) -> HeyGenDemoClient | HeyGenLiveClient:
    """Get demo or live HeyGen client based on configuration."""
    if settings is None:
        settings = heygen_settings

    if settings.is_demo_mode:
        logger.info("using_heygen_demo_client")
        return HeyGenDemoClient()
    else:
        logger.info("using_heygen_live_client")
        return HeyGenLiveClient(
            api_key=settings.api_key,
            api_base_url=settings.api_base_url,
            timeout=settings.timeout,
        )


class HeyGenClient:
    """Unified HeyGen client wrapper."""

    def __init__(self, settings: HeyGenSettings | None = None) -> None:
        self.settings = settings or heygen_settings
        self.client = get_heygen_client(self.settings)
        logger.info("heygen_client_initialized", mode=self.settings.mode)

    async def generate_video(
        self,
        script: str,
        avatar_id: str | None = None,
        voice_id: str | None = None,
        title: str | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> dict[str, Any]:
        """Submit async video generation. Returns video_id for polling."""
        dim = self.settings.get_dimension()
        return await self.client.generate_video(
            script=script,
            avatar_id=avatar_id or self.settings.default_avatar_id,
            voice_id=voice_id or self.settings.default_voice_id,
            title=title,
            width=width or dim["width"],
            height=height or dim["height"],
        )

    async def get_video_status(self, video_id: str) -> dict[str, Any]:
        """Poll for video status by video_id."""
        return await self.client.get_video_status(video_id)

    async def list_avatars(self) -> dict[str, Any]:
        """List available HeyGen avatars."""
        return await self.client.list_avatars()

    async def list_voices(self) -> dict[str, Any]:
        """List available HeyGen voices."""
        return await self.client.list_voices()

    async def get_remaining_quota(self) -> dict[str, Any]:
        """Get remaining API quota."""
        return await self.client.get_remaining_quota()

    def estimate_cost_usd(self, duration_seconds: float) -> float:
        """Estimate cost in USD for a given video duration."""
        return (duration_seconds / 60) * self.settings.cost_per_minute_usd
