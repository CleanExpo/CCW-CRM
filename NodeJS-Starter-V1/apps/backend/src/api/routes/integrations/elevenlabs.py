"""ElevenLabs voice generation API routes."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.config.elevenlabs_settings import ElevenLabsSettings, elevenlabs_settings
from src.integrations.elevenlabs.client import ElevenLabsClient

router = APIRouter(prefix="/api/integrations/elevenlabs", tags=["ElevenLabs Integration"])
logger = structlog.get_logger(__name__)


# Pydantic models for requests/responses
class GenerateAudioRequest(BaseModel):
    """Request model for audio generation."""

    text: str = Field(description="Text to convert to speech", min_length=1, max_length=5000)
    voice_id: str | None = Field(
        default=None, description="Voice ID (uses default if not specified)"
    )
    model_id: str | None = Field(
        default=None, description="Model ID (uses default if not specified)"
    )
    voice_settings: dict | None = Field(
        default=None, description="Voice settings override"
    )
    output_format: str | None = Field(
        default=None, description="Audio output format"
    )


class GenerateAudioResponse(BaseModel):
    """Response model for audio generation."""

    success: bool
    audio_id: str
    audio_data: str = Field(description="Base64-encoded audio data")
    audio_url: str | None = None
    metadata: dict
    mode: str


class VoiceModel(BaseModel):
    """Model for a voice."""

    voice_id: str
    name: str
    category: str
    description: str | None = None
    labels: dict | None = None


class VoicesResponse(BaseModel):
    """Response model for listing voices."""

    success: bool
    voices: list[dict]
    mode: str


class ModelsResponse(BaseModel):
    """Response model for listing models."""

    success: bool
    models: list[dict]
    mode: str


class UsageResponse(BaseModel):
    """Response model for usage statistics."""

    success: bool
    character_count: int
    character_limit: int
    characters_remaining: int
    reset_date: str | None
    mode: str


class ConnectionStatusResponse(BaseModel):
    """Response model for connection status."""

    connected: bool
    mode: str
    default_voice_id: str
    default_model_id: str
    voice_settings: dict
    output_format: str
    streaming_enabled: bool
    voice_cloning_enabled: bool


# Helper functions
def get_elevenlabs_settings() -> ElevenLabsSettings:
    """Get ElevenLabs settings dependency."""
    return elevenlabs_settings


@router.get("/status")
async def get_connection_status(
    settings: Annotated[ElevenLabsSettings, Depends(get_elevenlabs_settings)],
) -> ConnectionStatusResponse:
    """
    Get ElevenLabs connection status.

    Returns:
        Connection status and configuration details
    """
    logger.info("checking_elevenlabs_status")

    return ConnectionStatusResponse(
        connected=True,
        mode=settings.mode,
        default_voice_id=settings.default_voice_id,
        default_model_id=settings.default_model_id,
        voice_settings=settings.get_voice_settings(),
        output_format=settings.output_format,
        streaming_enabled=settings.enable_streaming,
        voice_cloning_enabled=settings.enable_voice_cloning,
    )


@router.post("/generate")
async def generate_audio(
    request: GenerateAudioRequest,
    settings: Annotated[ElevenLabsSettings, Depends(get_elevenlabs_settings)],
) -> GenerateAudioResponse:
    """
    Generate audio from text using ElevenLabs.

    Args:
        request: Audio generation request
        settings: ElevenLabs settings

    Returns:
        GenerateAudioResponse with audio data and metadata
    """
    logger.info(
        "generating_audio",
        text_length=len(request.text),
        voice_id=request.voice_id,
        mode=settings.mode,
    )

    client = ElevenLabsClient(settings)

    try:
        result = await client.generate_audio(
            text=request.text,
            voice_id=request.voice_id,
            model_id=request.model_id,
            voice_settings=request.voice_settings,
            output_format=request.output_format,
        )

        return GenerateAudioResponse(
            success=result["success"],
            audio_id=result["audio_id"],
            audio_data=result["audio_data"],
            audio_url=result.get("audio_url"),
            metadata=result.get("metadata", {}),
            mode=settings.mode,
        )

    except Exception as e:
        logger.error("failed_to_generate_audio", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audio: {str(e)}",
        ) from e


@router.post("/stream")
async def stream_audio(
    request: GenerateAudioRequest,
    settings: Annotated[ElevenLabsSettings, Depends(get_elevenlabs_settings)],
) -> StreamingResponse:
    """
    Stream audio generation from text.

    Args:
        request: Audio generation request
        settings: ElevenLabs settings

    Returns:
        StreamingResponse with audio data chunks
    """
    if not settings.enable_streaming:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Streaming is not enabled",
        )

    logger.info(
        "streaming_audio",
        text_length=len(request.text),
        voice_id=request.voice_id,
    )

    client = ElevenLabsClient(settings)

    async def generate():
        """Generate audio chunks."""
        try:
            async for chunk in client.stream_audio(
                text=request.text,
                voice_id=request.voice_id,
                model_id=request.model_id,
                voice_settings=request.voice_settings,
                output_format=request.output_format,
            ):
                yield chunk
        except Exception as e:
            logger.error("streaming_error", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Streaming failed: {str(e)}",
            ) from e

    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f"attachment; filename=audio_{request.voice_id}.mp3",
        },
    )


@router.get("/voices")
async def list_voices(
    settings: Annotated[ElevenLabsSettings, Depends(get_elevenlabs_settings)],
) -> VoicesResponse:
    """
    Get available voices.

    Args:
        settings: ElevenLabs settings

    Returns:
        VoicesResponse with list of available voices
    """
    logger.info("listing_voices")

    client = ElevenLabsClient(settings)

    try:
        result = await client.get_voices()

        return VoicesResponse(
            success=result["success"],
            voices=result["voices"],
            mode=settings.mode,
        )

    except Exception as e:
        logger.error("failed_to_list_voices", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list voices: {str(e)}",
        ) from e


@router.get("/models")
async def list_models(
    settings: Annotated[ElevenLabsSettings, Depends(get_elevenlabs_settings)],
) -> ModelsResponse:
    """
    Get available models.

    Args:
        settings: ElevenLabs settings

    Returns:
        ModelsResponse with list of available models
    """
    logger.info("listing_models")

    client = ElevenLabsClient(settings)

    try:
        result = await client.get_models()

        return ModelsResponse(
            success=result["success"],
            models=result.get("models", []),
            mode=settings.mode,
        )

    except Exception as e:
        logger.error("failed_to_list_models", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list models: {str(e)}",
        ) from e


@router.get("/usage")
async def get_usage_stats(
    settings: Annotated[ElevenLabsSettings, Depends(get_elevenlabs_settings)],
) -> UsageResponse:
    """
    Get API usage statistics.

    Args:
        settings: ElevenLabs settings

    Returns:
        UsageResponse with usage statistics
    """
    logger.info("getting_usage_stats")

    client = ElevenLabsClient(settings)

    try:
        result = await client.get_usage()

        return UsageResponse(
            success=result["success"],
            character_count=result.get("character_count", 0),
            character_limit=result.get("character_limit", 0),
            characters_remaining=result.get("characters_remaining", 0),
            reset_date=result.get("reset_date"),
            mode=settings.mode,
        )

    except Exception as e:
        logger.error("failed_to_get_usage", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get usage statistics: {str(e)}",
        ) from e


@router.post("/demo/generate")
async def demo_generate_audio(
    text: str = "Hello! This is a demo audio generation.",
    voice_id: str | None = None,
) -> GenerateAudioResponse:
    """
    Demo endpoint to test audio generation.

    Args:
        text: Text to convert to speech
        voice_id: Optional voice ID

    Returns:
        GenerateAudioResponse with demo audio
    """
    logger.info("demo_audio_generation", text_length=len(text))

    client = ElevenLabsClient()

    result = await client.generate_audio(
        text=text,
        voice_id=voice_id,
    )

    return GenerateAudioResponse(
        success=result["success"],
        audio_id=result["audio_id"],
        audio_data=result["audio_data"],
        audio_url=result.get("audio_url"),
        metadata=result.get("metadata", {}),
        mode="demo",
    )
