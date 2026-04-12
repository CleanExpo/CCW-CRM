"""ElevenLabs voice generation integration settings."""

from typing import Literal

import structlog
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = structlog.get_logger(__name__)


class ElevenLabsSettings(BaseSettings):
    """
    ElevenLabs API configuration.

    Supports two modes:
    - demo: Returns mock audio data for testing without API calls
    - live: Makes real API calls to ElevenLabs API
    """

    model_config = SettingsConfigDict(
        extra="ignore",
        env_file=".env",
        case_sensitive=False,
    )

    # Mode configuration
    mode: Literal["demo", "live"] = Field(
        default="demo",
        alias="ELEVENLABS_MODE",
        description="Operating mode: 'demo' for testing, 'live' for production",
    )

    # API credentials
    api_key: str = Field(
        default="demo_elevenlabs_api_key",
        alias="ELEVENLABS_API_KEY",
        description="ElevenLabs API key",
    )

    # Voice settings
    default_voice_id: str = Field(
        default="21m00Tcm4TlvDq8ikWAM",  # Rachel (default ElevenLabs voice)
        alias="ELEVENLABS_DEFAULT_VOICE_ID",
        description="Default voice ID to use for generation",
    )

    default_model_id: str = Field(
        default="eleven_monolingual_v1",
        alias="ELEVENLABS_MODEL_ID",
        description="Default model ID (eleven_monolingual_v1, eleven_multilingual_v2, etc.)",
    )

    # Voice quality settings
    stability: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        alias="ELEVENLABS_STABILITY",
        description="Voice stability (0.0-1.0, higher = more consistent)",
    )

    similarity_boost: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        alias="ELEVENLABS_SIMILARITY_BOOST",
        description="Similarity boost (0.0-1.0, higher = closer to original voice)",
    )

    style: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        alias="ELEVENLABS_STYLE",
        description="Style exaggeration (0.0-1.0, 0 = neutral)",
    )

    use_speaker_boost: bool = Field(
        default=True,
        alias="ELEVENLABS_USE_SPEAKER_BOOST",
        description="Enable speaker boost for better audio quality",
    )

    # Output settings
    output_format: str = Field(
        default="mp3_44100_128",
        alias="ELEVENLABS_OUTPUT_FORMAT",
        description="Audio output format (mp3_44100_128, mp3_44100_192, pcm_16000, etc.)",
    )

    # API settings
    api_base_url: str = Field(
        default="https://api.elevenlabs.io/v1",
        alias="ELEVENLABS_API_BASE_URL",
        description="ElevenLabs API base URL",
    )

    timeout: int = Field(
        default=30,
        ge=5,
        le=120,
        alias="ELEVENLABS_TIMEOUT",
        description="API request timeout in seconds",
    )

    # Storage settings
    save_audio_files: bool = Field(
        default=True,
        alias="ELEVENLABS_SAVE_AUDIO",
        description="Save generated audio files to disk",
    )

    audio_storage_path: str = Field(
        default="./storage/audio",
        alias="ELEVENLABS_STORAGE_PATH",
        description="Path to store generated audio files",
    )

    # Feature flags
    enable_streaming: bool = Field(
        default=True,
        alias="ELEVENLABS_ENABLE_STREAMING",
        description="Enable streaming audio generation",
    )

    enable_voice_cloning: bool = Field(
        default=False,
        alias="ELEVENLABS_ENABLE_VOICE_CLONING",
        description="Enable voice cloning features (requires higher tier)",
    )

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.mode == "demo"

    @property
    def is_live_mode(self) -> bool:
        """Check if running in live mode."""
        return self.mode == "live"

    def get_voice_settings(self) -> dict:
        """
        Get voice settings as a dictionary.

        Returns:
            Voice settings dict for API requests
        """
        return {
            "stability": self.stability,
            "similarity_boost": self.similarity_boost,
            "style": self.style,
            "use_speaker_boost": self.use_speaker_boost,
        }


# Global settings instance
elevenlabs_settings = ElevenLabsSettings()

# Log initialization
logger.info(
    "ElevenLabs settings initialized",
    mode=elevenlabs_settings.mode,
    default_voice=elevenlabs_settings.default_voice_id,
    model=elevenlabs_settings.default_model_id,
)


def get_elevenlabs_settings() -> ElevenLabsSettings:
    """Get ElevenLabs settings instance (for dependency injection)."""
    return elevenlabs_settings
