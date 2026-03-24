"""Live ElevenLabs client for production API calls."""

import base64
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


class ElevenLabsLiveClient:
    """
    Real ElevenLabs API client for production use.

    Makes actual API calls to ElevenLabs service.
    """

    def __init__(
        self,
        api_key: str,
        api_base_url: str,
        timeout: int = 30,
    ) -> None:
        """
        Initialize live client.

        Args:
            api_key: ElevenLabs API key
            api_base_url: Base URL for ElevenLabs API
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.api_base_url = api_base_url.rstrip("/")
        self.timeout = timeout
        logger.info("elevenlabs_live_client_initialized", base_url=api_base_url)

    async def generate_audio(
        self,
        text: str,
        voice_id: str,
        model_id: str = "eleven_monolingual_v1",
        voice_settings: dict | None = None,
        output_format: str = "mp3_44100_128",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Generate audio from text using ElevenLabs API.

        Args:
            text: Text to convert to speech
            voice_id: Voice ID to use
            model_id: Model ID to use
            voice_settings: Voice configuration settings
            output_format: Audio output format
            **kwargs: Additional parameters

        Returns:
            Dict with audio_id, audio_data (base64), metadata

        Raises:
            HTTPError: If API request fails
        """
        url = f"{self.api_base_url}/text-to-speech/{voice_id}"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_settings
            or {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }

        # Add output format if specified
        params = {"output_format": output_format}

        logger.info(
            "generating_audio",
            text_length=len(text),
            voice_id=voice_id,
            model_id=model_id,
        )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
                params=params,
                timeout=self.timeout,
            )

            response.raise_for_status()

            # Get audio bytes
            audio_bytes = response.content

            # Get character count from headers
            character_count = int(response.headers.get("character-cost", len(text)))

            # Encode to base64 for JSON transport
            audio_data = base64.b64encode(audio_bytes).decode("utf-8")

            logger.info(
                "audio_generated",
                audio_size=len(audio_bytes),
                character_count=character_count,
            )

            return {
                "success": True,
                "audio_id": f"elevenlabs_{voice_id}",
                "audio_data": audio_data,
                "metadata": {
                    "text": text,
                    "voice_id": voice_id,
                    "model_id": model_id,
                    "character_count": character_count,
                    "audio_size_bytes": len(audio_bytes),
                    "output_format": output_format,
                },
            }

    async def stream_audio(
        self,
        text: str,
        voice_id: str,
        model_id: str = "eleven_monolingual_v1",
        voice_settings: dict | None = None,
        output_format: str = "mp3_44100_128",
        **kwargs: Any,
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream audio generation from ElevenLabs API.

        Args:
            text: Text to convert to speech
            voice_id: Voice ID to use
            model_id: Model ID to use
            voice_settings: Voice configuration settings
            output_format: Audio output format
            **kwargs: Additional parameters

        Yields:
            Audio data chunks
        """
        url = f"{self.api_base_url}/text-to-speech/{voice_id}/stream"

        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": voice_settings
            or {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }

        params = {"output_format": output_format}

        logger.info(
            "streaming_audio",
            text_length=len(text),
            voice_id=voice_id,
        )

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json=payload,
                params=params,
                timeout=self.timeout,
            ) as response:
                response.raise_for_status()

                async for chunk in response.aiter_bytes(chunk_size=4096):
                    yield chunk

        logger.info("audio_stream_complete")

    async def get_voices(self) -> dict[str, Any]:
        """
        Get available voices from ElevenLabs API.

        Returns:
            Dict with voices list

        Raises:
            HTTPError: If API request fails
        """
        url = f"{self.api_base_url}/voices"

        headers = {
            "xi-api-key": self.api_key,
        }

        logger.info("fetching_voices")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=headers,
                timeout=self.timeout,
            )

            response.raise_for_status()

            data = response.json()
            voices = data.get("voices", [])

            logger.info("voices_retrieved", voice_count=len(voices))

            return {
                "success": True,
                "voices": voices,
            }

    async def get_models(self) -> dict[str, Any]:
        """
        Get available models from ElevenLabs API.

        Returns:
            Dict with models list

        Raises:
            HTTPError: If API request fails
        """
        url = f"{self.api_base_url}/models"

        headers = {
            "xi-api-key": self.api_key,
        }

        logger.info("fetching_models")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=headers,
                timeout=self.timeout,
            )

            response.raise_for_status()

            data = response.json()

            logger.info("models_retrieved")

            return {
                "success": True,
                "models": data,
            }

    async def get_usage(self) -> dict[str, Any]:
        """
        Get API usage statistics from ElevenLabs API.

        Returns:
            Dict with usage statistics

        Raises:
            HTTPError: If API request fails
        """
        url = f"{self.api_base_url}/user/subscription"

        headers = {
            "xi-api-key": self.api_key,
        }

        logger.info("fetching_usage")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=headers,
                timeout=self.timeout,
            )

            response.raise_for_status()

            data = response.json()

            logger.info("usage_retrieved")

            return {
                "success": True,
                "character_count": data.get("character_count", 0),
                "character_limit": data.get("character_limit", 0),
                "characters_remaining": data.get("character_limit", 0)
                - data.get("character_count", 0),
                "reset_date": data.get("next_character_count_reset_unix"),
            }

    async def delete_voice(self, voice_id: str) -> dict[str, Any]:
        """
        Delete a cloned voice (requires voice cloning tier).

        Args:
            voice_id: Voice ID to delete

        Returns:
            Success message

        Raises:
            HTTPError: If API request fails
        """
        url = f"{self.api_base_url}/voices/{voice_id}"

        headers = {
            "xi-api-key": self.api_key,
        }

        logger.info("deleting_voice", voice_id=voice_id)

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                url,
                headers=headers,
                timeout=self.timeout,
            )

            response.raise_for_status()

            logger.info("voice_deleted", voice_id=voice_id)

            return {
                "success": True,
                "message": f"Voice {voice_id} deleted successfully",
            }
