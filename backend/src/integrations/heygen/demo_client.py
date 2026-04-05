"""HeyGen demo client — returns mock data without making real API calls."""

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

DEMO_AVATARS = [
    {"avatar_id": "Daisy-inskirt-20220818", "avatar_name": "Daisy", "gender": "female"},
    {"avatar_id": "josh_lite3_20230714", "avatar_name": "Josh", "gender": "male"},
    {"avatar_id": "Anna_public_3_20240108", "avatar_name": "Anna", "gender": "female"},
]

DEMO_VOICES = [
    {"voice_id": "1bd001e7e50f421d891986aad5158bc8", "name": "Sarah", "language": "English", "gender": "Female"},
    {"voice_id": "2d5b0e6cf36f460aa7fc47e3eee4ba54", "name": "James", "language": "English", "gender": "Male"},
]


class HeyGenDemoClient:
    """Mock HeyGen client for development and testing."""

    async def generate_video(
        self,
        script: str,
        avatar_id: str,
        voice_id: str,
        title: str | None = None,
        width: int = 1280,
        height: int = 720,
    ) -> dict[str, Any]:
        """Generate a mock video job."""
        video_id = f"demo_{uuid.uuid4().hex[:12]}"
        logger.info(
            "heygen_demo_generate_video",
            video_id=video_id,
            avatar_id=avatar_id,
            script_length=len(script),
        )
        return {
            "video_id": video_id,
            "status": "processing",
            "title": title or "Demo Video",
            "created_at": datetime.now(UTC).isoformat(),
            "demo_mode": True,
        }

    async def get_video_status(self, video_id: str) -> dict[str, Any]:
        """Return mock completed status for any video_id."""
        logger.info("heygen_demo_get_status", video_id=video_id)
        return {
            "video_id": video_id,
            "status": "completed",
            "video_url": f"https://demo.heygen.com/videos/{video_id}.mp4",
            "thumbnail_url": f"https://demo.heygen.com/thumbnails/{video_id}.jpg",
            "duration": 30.0,
            "demo_mode": True,
        }

    async def list_avatars(self) -> dict[str, Any]:
        """Return demo avatar list."""
        return {"avatars": DEMO_AVATARS, "demo_mode": True}

    async def list_voices(self) -> dict[str, Any]:
        """Return demo voice list."""
        return {"voices": DEMO_VOICES, "demo_mode": True}

    async def get_remaining_quota(self) -> dict[str, Any]:
        """Return mock quota."""
        return {"remaining_quota": 999, "unit": "credits", "demo_mode": True}
