"""HeyGen avatar video generation API routes."""

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.config.heygen_settings import HeyGenSettings, heygen_settings
from src.integrations.heygen.client import HeyGenClient
from src.integrations.heygen.live_client import HeyGenAPIError

router = APIRouter(prefix="/api/integrations/heygen", tags=["HeyGen Integration"])
logger = structlog.get_logger(__name__)


# ── Pydantic models ──────────────────────────────────────────────────────────

class GenerateVideoRequest(BaseModel):
    """Request model for video generation."""

    script: str = Field(description="Spoken text for the avatar", min_length=1, max_length=5000)
    avatar_id: str | None = Field(default=None, description="HeyGen avatar ID (uses default if omitted)")
    voice_id: str | None = Field(default=None, description="HeyGen voice ID (uses default if omitted)")
    title: str | None = Field(default=None, description="Video title label")
    width: int | None = Field(default=None, description="Video width in pixels (default 1280)")
    height: int | None = Field(default=None, description="Video height in pixels (default 720)")


class GenerateVideoResponse(BaseModel):
    """Response model for video generation submission."""

    success: bool
    video_id: str
    status: str
    title: str | None = None
    mode: str


class VideoStatusResponse(BaseModel):
    """Response model for video status poll."""

    success: bool
    video_id: str
    status: str
    video_url: str | None = None
    thumbnail_url: str | None = None
    duration: float | None = None
    error: str | None = None
    estimated_cost_usd: float | None = None
    mode: str


class AvatarListResponse(BaseModel):
    """Response model for avatar list."""

    success: bool
    avatars: list[dict[str, Any]]
    mode: str


class VoiceListResponse(BaseModel):
    """Response model for voice list."""

    success: bool
    voices: list[dict[str, Any]]
    mode: str


class QuotaResponse(BaseModel):
    """Response model for remaining quota."""

    success: bool
    remaining_quota: int | None = None
    unit: str | None = None
    mode: str


# ── Dependency ───────────────────────────────────────────────────────────────

def get_client(settings: HeyGenSettings = Depends(lambda: heygen_settings)) -> HeyGenClient:
    return HeyGenClient(settings=settings)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateVideoResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_video(
    request: GenerateVideoRequest,
    client: Annotated[HeyGenClient, Depends(get_client)],
) -> GenerateVideoResponse:
    """
    Submit an async HeyGen video generation job.
    Returns a video_id — poll /status/{video_id} to check completion.
    """
    try:
        result = await client.generate_video(
            script=request.script,
            avatar_id=request.avatar_id,
            voice_id=request.voice_id,
            title=request.title,
            width=request.width,
            height=request.height,
        )
        logger.info("heygen_video_submitted", video_id=result.get("video_id"))
        return GenerateVideoResponse(
            success=True,
            video_id=result["video_id"],
            status=result.get("status", "processing"),
            title=request.title,
            mode=client.settings.mode,
        )
    except HeyGenAPIError as e:
        logger.error("heygen_generate_failed", error=str(e))
        raise HTTPException(
            status_code=e.status_code or status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except Exception as e:
        logger.error("heygen_generate_unexpected_error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/status/{video_id}", response_model=VideoStatusResponse)
async def get_video_status(
    video_id: str,
    client: Annotated[HeyGenClient, Depends(get_client)],
) -> VideoStatusResponse:
    """Poll HeyGen for video generation status."""
    try:
        result = await client.get_video_status(video_id)
        duration = result.get("duration")
        cost = client.estimate_cost_usd(duration) if duration else None
        return VideoStatusResponse(
            success=True,
            video_id=video_id,
            status=result.get("status", "unknown"),
            video_url=result.get("video_url"),
            thumbnail_url=result.get("thumbnail_url"),
            duration=duration,
            error=result.get("error"),
            estimated_cost_usd=cost,
            mode=client.settings.mode,
        )
    except HeyGenAPIError as e:
        raise HTTPException(
            status_code=e.status_code or status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/avatars", response_model=AvatarListResponse)
async def list_avatars(
    client: Annotated[HeyGenClient, Depends(get_client)],
) -> AvatarListResponse:
    """List available HeyGen avatars."""
    result = await client.list_avatars()
    return AvatarListResponse(
        success=True,
        avatars=result.get("avatars", []),
        mode=client.settings.mode,
    )


@router.get("/voices", response_model=VoiceListResponse)
async def list_voices(
    client: Annotated[HeyGenClient, Depends(get_client)],
) -> VoiceListResponse:
    """List available HeyGen voices."""
    result = await client.list_voices()
    return VoiceListResponse(
        success=True,
        voices=result.get("voices", []),
        mode=client.settings.mode,
    )


@router.get("/quota", response_model=QuotaResponse)
async def get_quota(
    client: Annotated[HeyGenClient, Depends(get_client)],
) -> QuotaResponse:
    """Get remaining HeyGen API quota."""
    result = await client.get_remaining_quota()
    return QuotaResponse(
        success=True,
        remaining_quota=result.get("remaining_quota"),
        unit=result.get("unit"),
        mode=client.settings.mode,
    )
