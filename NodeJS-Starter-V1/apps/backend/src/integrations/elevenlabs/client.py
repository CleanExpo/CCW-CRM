"""ElevenLabs client wrapper that switches between demo and live modes."""

from typing import Any, AsyncGenerator

import structlog

from src.config.elevenlabs_settings import ElevenLabsSettings, elevenlabs_settings

from .demo_client import ElevenLabsDemoClient
from .live_client import ElevenLabsLiveClient

logger = structlog.get_logger(__name__)


def get_elevenlabs_client(
    settings: ElevenLabsSettings | None = None,
) -> ElevenLabsDemoClient | ElevenLabsLiveClient:
    """
    Get appropriate ElevenLabs client based on configuration.

    Args:
        settings: Optional settings override

    Returns:
        Demo or Live client instance
    """
    if settings is None:
        settings = elevenlabs_settings

    if settings.is_demo_mode:
        logger.info("using_elevenlabs_demo_client")
        return ElevenLabsDemoClient()
    else:
        logger.info("using_elevenlabs_live_client")
        return ElevenLabsLiveClient(
            api_key=settings.api_key,
            api_base_url=settings.api_base_url,
            timeout=settings.timeout,
        )


class ElevenLabsClient:
    """
    Unified ElevenLabs client wrapper.

    Automatically uses demo or live client based on configuration.
    """

    def __init__(self, settings: ElevenLabsSettings | None = None) -> None:
        """
        Initialize client wrapper.

        Args:
            settings: Optional settings override
        """
        self.settings = settings or elevenlabs_settings
        self.client = get_elevenlabs_client(self.settings)
        logger.info("elevenlabs_client_initialized", mode=self.settings.mode)

    async def generate_audio(
        self,
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
        voice_settings: dict | None = None,
        output_format: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate audio from text.

        Args:
            text: Text to convert to speech
            voice_id: Voice ID (uses default if not specified)
            model_id: Model ID (uses default if not specified)
            voice_settings: Voice configuration (uses defaults if not specified)
            output_format: Audio format (uses default if not specified)

        Returns:
            Dict with audio_id, audio_data (base64), metadata
        """
        # Use defaults from settings if not specified
        voice_id = voice_id or self.settings.default_voice_id
        model_id = model_id or self.settings.default_model_id
        voice_settings = voice_settings or self.settings.get_voice_settings()
        output_format = output_format or self.settings.output_format

        logger.info(
            "generating_audio",
            text_length=len(text),
            voice_id=voice_id,
            model_id=model_id,
            mode=self.settings.mode,
        )

        return await self.client.generate_audio(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            voice_settings=voice_settings,
            output_format=output_format,
        )

    async def stream_audio(
        self,
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
        voice_settings: dict | None = None,
        output_format: str | None = None,
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream audio generation.

        Args:
            text: Text to convert to speech
            voice_id: Voice ID (uses default if not specified)
            model_id: Model ID (uses default if not specified)
            voice_settings: Voice configuration (uses defaults if not specified)
            output_format: Audio format (uses default if not specified)

        Yields:
            Audio data chunks
        """
        # Use defaults from settings if not specified
        voice_id = voice_id or self.settings.default_voice_id
        model_id = model_id or self.settings.default_model_id
        voice_settings = voice_settings or self.settings.get_voice_settings()
        output_format = output_format or self.settings.output_format

        logger.info(
            "streaming_audio",
            text_length=len(text),
            voice_id=voice_id,
            mode=self.settings.mode,
        )

        async for chunk in self.client.stream_audio(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            voice_settings=voice_settings,
            output_format=output_format,
        ):
            yield chunk

    async def get_voices(self) -> dict[str, Any]:
        """
        Get available voices.

        Returns:
            Dict with voices list
        """
        return await self.client.get_voices()

    async def get_models(self) -> dict[str, Any]:
        """
        Get available models.

        Returns:
            Dict with models list
        """
        return await self.client.get_models()

    async def get_usage(self) -> dict[str, Any]:
        """
        Get API usage statistics.

        Returns:
            Dict with usage statistics
        """
        return await self.client.get_usage()

    def get_voice_settings(self) -> dict[str, Any]:
        """
        Get current voice settings from configuration.

        Returns:
            Voice settings dict
        """
        return self.settings.get_voice_settings()
