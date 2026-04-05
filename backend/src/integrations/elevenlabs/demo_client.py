"""Demo ElevenLabs client for testing without API calls."""

import base64
from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import structlog

logger = structlog.get_logger(__name__)


class ElevenLabsDemoClient:
    """
    Mock ElevenLabs client for demo/testing.

    Returns realistic response structures without making real API calls.
    """

    def __init__(self) -> None:
        """Initialize demo client."""
        self.generated_audios: list[dict[str, Any]] = []
        logger.info("elevenlabs_demo_client_initialized")

    async def generate_audio(
        self,
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
        voice_settings: dict | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Generate audio from text (demo mode - returns mock data).

        Args:
            text: Text to convert to speech
            voice_id: Voice ID to use
            model_id: Model ID to use
            voice_settings: Voice configuration settings
            **kwargs: Additional parameters

        Returns:
            Dict with audio_id, audio_data (base64), metadata
        """
        audio_id = f"demo_audio_{uuid4().hex[:16]}"

        # Generate mock audio data (silent audio or simple tone)
        # In demo mode, we'll return a small base64-encoded "audio" placeholder
        mock_audio_data = self._generate_mock_audio(len(text))

        audio_record = {
            "audio_id": audio_id,
            "text": text,
            "voice_id": voice_id or "demo_voice",
            "model_id": model_id or "eleven_monolingual_v1",
            "voice_settings": voice_settings or {},
            "character_count": len(text),
            "duration_seconds": self._estimate_duration(text),
            "generated_at": "2026-01-09T07:45:00.000Z",
            "mode": "demo",
        }

        self.generated_audios.append(audio_record)

        logger.info(
            "demo_audio_generated",
            audio_id=audio_id,
            text_length=len(text),
            voice_id=voice_id,
        )

        return {
            "success": True,
            "audio_id": audio_id,
            "audio_data": mock_audio_data,
            "audio_url": f"/demo/audio/{audio_id}.mp3",
            "metadata": audio_record,
        }

    async def stream_audio(
        self,
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
        voice_settings: dict | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream audio generation (demo mode - yields mock chunks).

        Args:
            text: Text to convert to speech
            voice_id: Voice ID to use
            model_id: Model ID to use
            voice_settings: Voice configuration settings
            **kwargs: Additional parameters

        Yields:
            Audio data chunks
        """
        audio_id = f"demo_stream_{uuid4().hex[:16]}"

        logger.info(
            "demo_audio_streaming",
            audio_id=audio_id,
            text_length=len(text),
        )

        # Simulate streaming by yielding small chunks
        mock_audio = self._generate_mock_audio(len(text))
        chunk_size = 1024

        for i in range(0, len(mock_audio), chunk_size):
            chunk = mock_audio[i : i + chunk_size]
            yield chunk.encode("utf-8")

        logger.info("demo_audio_stream_complete", audio_id=audio_id)

    async def get_voices(self) -> dict[str, Any]:
        """
        Get available voices (demo mode - returns mock voices).

        Returns:
            Dict with voices list
        """
        demo_voices = [
            {
                "voice_id": "21m00Tcm4TlvDq8ikWAM",
                "name": "Rachel",
                "category": "premade",
                "description": "Young American female",
                "labels": {"accent": "american", "age": "young", "gender": "female"},
            },
            {
                "voice_id": "EXAVITQu4vr4xnSDxMaL",
                "name": "Sarah",
                "category": "premade",
                "description": "Soft American female",
                "labels": {"accent": "american", "age": "middle aged", "gender": "female"},
            },
            {
                "voice_id": "AZnzlk1XvdvUeBnXmlld",
                "name": "Domi",
                "category": "premade",
                "description": "Strong American female",
                "labels": {"accent": "american", "age": "young", "gender": "female"},
            },
            {
                "voice_id": "ErXwobaYiN019PkySvjV",
                "name": "Antoni",
                "category": "premade",
                "description": "Well-rounded American male",
                "labels": {"accent": "american", "age": "young", "gender": "male"},
            },
            {
                "voice_id": "VR6AewLTigWG4xSOukaG",
                "name": "Arnold",
                "category": "premade",
                "description": "Crisp American male",
                "labels": {"accent": "american", "age": "middle aged", "gender": "male"},
            },
        ]

        logger.info("demo_voices_retrieved", voice_count=len(demo_voices))

        return {
            "success": True,
            "voices": demo_voices,
            "mode": "demo",
        }

    async def get_models(self) -> dict[str, Any]:
        """
        Get available models (demo mode - returns mock models).

        Returns:
            Dict with models list
        """
        demo_models = [
            {
                "model_id": "eleven_monolingual_v1",
                "name": "Eleven Monolingual v1",
                "description": "English only, lowest latency",
                "languages": ["en"],
            },
            {
                "model_id": "eleven_multilingual_v2",
                "name": "Eleven Multilingual v2",
                "description": "Supports 28 languages",
                "languages": ["en", "es", "fr", "de", "it", "pt", "pl", "hi", "ja", "zh"],
            },
            {
                "model_id": "eleven_turbo_v2",
                "name": "Eleven Turbo v2",
                "description": "Optimized for low latency",
                "languages": ["en"],
            },
        ]

        logger.info("demo_models_retrieved", model_count=len(demo_models))

        return {
            "success": True,
            "models": demo_models,
            "mode": "demo",
        }

    async def get_usage(self) -> dict[str, Any]:
        """
        Get API usage stats (demo mode - returns mock stats).

        Returns:
            Dict with usage statistics
        """
        return {
            "success": True,
            "character_count": 10000,
            "character_limit": 10000,
            "characters_remaining": 0,
            "reset_date": "2026-02-01",
            "mode": "demo",
        }

    def _generate_mock_audio(self, text_length: int) -> str:
        """
        Generate mock audio data as base64 string.

        Args:
            text_length: Length of text to determine audio size

        Returns:
            Base64-encoded mock audio data
        """
        # Simple mock: return a base64 placeholder that scales with text length
        # In real usage, this would be actual audio bytes
        placeholder_size = min(text_length * 10, 1000)  # Rough estimate
        mock_bytes = b"MOCK_AUDIO_DATA" * (placeholder_size // 15 + 1)
        return base64.b64encode(mock_bytes[:placeholder_size]).decode("utf-8")

    def _estimate_duration(self, text: str) -> float:
        """
        Estimate audio duration based on text length.

        Rough estimate: ~150 words per minute, ~5 characters per word

        Args:
            text: Text to estimate duration for

        Returns:
            Estimated duration in seconds
        """
        words = len(text) / 5  # Rough word count
        minutes = words / 150
        return round(minutes * 60, 2)
