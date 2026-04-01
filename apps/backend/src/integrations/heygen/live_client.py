"""HeyGen live client — makes real API calls to HeyGen v2 API."""

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

HEYGEN_API_BASE = "https://api.heygen.com"


class HeyGenAPIError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class HeyGenLiveClient:
    """Live HeyGen client using httpx.AsyncClient."""

    def __init__(self, api_key: str, api_base_url: str = HEYGEN_API_BASE, timeout: int = 60) -> None:
        self._api_key = api_key
        self._base_url = api_base_url.rstrip("/")
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "X-Api-Key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.request(method, url, headers=self._headers(), **kwargs)
            if not response.is_success:
                error_msg = f"HeyGen API error {response.status_code}"
                try:
                    body = response.json()
                    error_msg = body.get("message") or body.get("error") or error_msg
                except Exception:
                    pass
                logger.error("heygen_api_error", status=response.status_code, url=url)
                raise HeyGenAPIError(error_msg, response.status_code)
            data = response.json()
            # HeyGen wraps responses in {"data": {...}}
            return data.get("data") or data  # type: ignore[return-value]

    async def generate_video(
        self,
        script: str,
        avatar_id: str,
        voice_id: str,
        title: str | None = None,
        width: int = 1280,
        height: int = 720,
    ) -> dict[str, Any]:
        """Submit async video generation job to HeyGen v2 API."""
        payload = {
            "video_inputs": [
                {
                    "character": {"type": "avatar", "avatar_id": avatar_id, "avatar_style": "normal"},
                    "voice": {"type": "text", "voice_id": voice_id, "input_text": script},
                    "background": {"type": "color", "value": "#FFFFFF"},
                }
            ],
            "dimension": {"width": width, "height": height},
        }
        if title:
            payload["title"] = title

        logger.info("heygen_generate_video", avatar_id=avatar_id, script_length=len(script))
        return await self._request("POST", "/v2/video/generate", json=payload)

    async def get_video_status(self, video_id: str) -> dict[str, Any]:
        """Poll for video generation status."""
        logger.info("heygen_get_status", video_id=video_id)
        return await self._request("GET", f"/v1/video_status.get?video_id={video_id}")

    async def list_avatars(self) -> dict[str, Any]:
        """List available avatars."""
        return await self._request("GET", "/v2/avatars")

    async def list_voices(self) -> dict[str, Any]:
        """List available voices."""
        return await self._request("GET", "/v2/voices")

    async def get_remaining_quota(self) -> dict[str, Any]:
        """Get remaining API quota."""
        return await self._request("GET", "/v1/user/remaining_quota")
