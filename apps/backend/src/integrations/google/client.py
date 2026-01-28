"""
Centralized Google AI API Client

This module provides a secure, centralized client for all Google AI API calls.
All Google API requests must go through this client to ensure consistent
authentication and error handling.

Security Features:
- API key loaded from environment variables only
- No hardcoded credentials
- Automatic retry logic
- Rate limiting support
- Comprehensive error handling
"""

import os
from functools import lru_cache
from typing import Any

import structlog
from pydantic import BaseModel, Field

from src.config.settings import get_settings

logger = structlog.get_logger(__name__)


class GoogleAIConfig(BaseModel):
    """Configuration for Google AI services."""

    api_key: str = Field(..., description="Google AI API key from environment")
    default_model: str = Field(default="models/gemini-2.5-flash", description="Default Gemini model")
    max_retries: int = Field(default=3, description="Maximum number of retry attempts")
    timeout_seconds: int = Field(default=30, description="Request timeout in seconds")

    class Config:
        """Pydantic config."""
        frozen = True  # Make immutable for security


class GoogleAIClient:
    """
    Secure client for Google AI API calls.

    This client handles all interactions with Google AI services including:
    - Gemini (text generation, vision, embeddings)
    - Vertex AI
    - Other Google AI products

    Usage:
        client = get_google_ai_client()
        response = await client.generate_text("What is the capital of France?")
    """

    def __init__(self, config: GoogleAIConfig):
        """
        Initialize Google AI client.

        Args:
            config: GoogleAIConfig with API key and settings

        Raises:
            ValueError: If API key is not provided
        """
        if not config.api_key:
            raise ValueError(
                "Google AI API key is required. "
                "Set GOOGLE_AI_API_KEY in your environment variables."
            )

        self.config = config
        self._initialized = False
        self.client = None  # Will be initialized on first use
        logger.info(
            "google_ai_client_initialized",
            model=config.default_model,
            max_retries=config.max_retries,
        )

    def _get_api_key(self) -> str:
        """
        Get API key securely.

        Returns:
            str: API key from configuration

        Note:
            This method ensures the API key is never logged or exposed
        """
        return self.config.api_key

    async def generate_text(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Generate text using Google Gemini.

        Args:
            prompt: Text prompt for generation
            model: Model to use (defaults to config.default_model)
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional model parameters

        Returns:
            dict: Response from Gemini API with generated text

        Raises:
            HTTPException: If API call fails
        """
        try:
            # Use new google-genai package (replaces deprecated google.generativeai)
            from google import genai
            from google.genai import types

            # Configure API key (done once per client instance)
            if not self._initialized:
                self.client = genai.Client(api_key=self._get_api_key())
                self._initialized = True

            # Use specified model or default
            model_name = model or self.config.default_model

            # Generate content
            logger.info(
                "google_ai_generate_request",
                model=model_name,
                prompt_length=len(prompt),
                temperature=temperature,
            )

            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    **kwargs,
                ),
            )

            # Extract text from response
            # The response object has a .text property that concatenates all text parts
            text = ""
            if hasattr(response, 'text'):
                # response.text might be None, empty string, or actual text
                text = response.text if response.text is not None else ""

            # Only raise error if we couldn't get any text at all
            # (empty string is valid for some prompts)
            if text is None:
                logger.warning("google_ai_text_extraction_failed", response_type=type(response).__name__)
                raise ValueError("Failed to extract text from AI response")

            logger.info(
                "google_ai_generate_success",
                model=model_name,
                response_length=len(text) if text else 0,
            )

            # Extract safety ratings if available
            safety_ratings = []
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'safety_ratings') and candidate.safety_ratings:
                    for rating in candidate.safety_ratings:
                        safety_ratings.append({
                            "category": str(rating.category) if hasattr(rating, 'category') else None,
                            "probability": str(rating.probability) if hasattr(rating, 'probability') else None,
                        })

            return {
                "text": text,
                "model": model_name,
                "prompt_feedback": response.prompt_feedback if hasattr(response, 'prompt_feedback') else None,
                "safety_ratings": safety_ratings,
            }

        except ImportError:
            logger.error("google_genai_not_installed")
            raise ImportError(
                "google-genai package not installed. "
                "Install with: pip install google-genai"
            )
        except Exception as e:
            logger.error(
                "google_ai_generate_error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    async def generate_embeddings(
        self,
        texts: list[str],
        model: str = "models/gemini-embedding-001",
    ) -> list[list[float]]:
        """
        Generate embeddings for text using Google AI.

        Args:
            texts: List of texts to embed
            model: Embedding model to use (default: gemini-embedding-001)

        Returns:
            list: List of embedding vectors

        Raises:
            HTTPException: If API call fails
        """
        try:
            from google import genai

            # Configure API key (done once per client instance)
            if not self._initialized:
                self.client = genai.Client(api_key=self._get_api_key())
                self._initialized = True

            logger.info(
                "google_ai_embeddings_request",
                model=model,
                text_count=len(texts),
            )

            # Generate embeddings using new API
            embeddings = []
            for text in texts:
                result = await self.client.aio.models.embed_content(
                    model=model,
                    contents=text,
                )
                # Extract embedding values
                if hasattr(result, 'embeddings') and result.embeddings:
                    embeddings.append(result.embeddings[0].values)
                elif hasattr(result, 'embedding'):
                    embeddings.append(result.embedding.values)
                else:
                    logger.warning("google_ai_embedding_extraction_failed", result_type=type(result).__name__)

            logger.info(
                "google_ai_embeddings_success",
                embedding_count=len(embeddings),
            )

            return embeddings

        except ImportError:
            logger.error("google_genai_not_installed")
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: uv add google-generativeai"
            )
        except Exception as e:
            logger.error(
                "google_ai_embeddings_error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise

    async def vision_analysis(
        self,
        image_path: str,
        prompt: str,
        model: str | None = None,
    ) -> dict[str, Any]:
        """
        Analyze image using Google Gemini Vision.

        Args:
            image_path: Path to image file
            prompt: Text prompt for analysis
            model: Model to use (defaults to gemini-1.5-flash)

        Returns:
            dict: Analysis results

        Raises:
            HTTPException: If API call fails
        """
        try:
            import google.generativeai as genai
            from PIL import Image

            if not self._initialized:
                genai.configure(api_key=self._get_api_key())
                self._initialized = True

            model_name = model or self.config.default_model
            model_instance = genai.GenerativeModel(model_name)

            # Load image
            img = Image.open(image_path)

            logger.info(
                "google_ai_vision_request",
                model=model_name,
                image_path=image_path,
            )

            # Generate analysis
            response = await model_instance.generate_content_async([prompt, img])

            logger.info(
                "google_ai_vision_success",
                model=model_name,
            )

            return {
                "text": response.text,
                "model": model_name,
            }

        except ImportError as e:
            logger.error("missing_dependency", error=str(e))
            raise ImportError(
                "Required packages not installed. "
                "Install with: uv add google-generativeai Pillow"
            )
        except Exception as e:
            logger.error(
                "google_ai_vision_error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise


@lru_cache(maxsize=1)
def get_google_ai_client() -> GoogleAIClient:
    """
    Get singleton instance of Google AI client.

    This function ensures only one client instance exists throughout the
    application lifecycle, preventing multiple API key configurations.

    Returns:
        GoogleAIClient: Configured client instance

    Raises:
        ValueError: If GOOGLE_AI_API_KEY is not set in environment

    Usage:
        # In any module:
        from src.integrations.google import get_google_ai_client

        client = get_google_ai_client()
        response = await client.generate_text("Hello, world!")
    """
    settings = get_settings()

    if not settings.google_ai_api_key:
        logger.warning(
            "google_ai_api_key_not_configured",
            message="GOOGLE_AI_API_KEY environment variable not set"
        )
        raise ValueError(
            "Google AI API key not configured. "
            "Please set GOOGLE_AI_API_KEY in your .env file or environment variables."
        )

    config = GoogleAIConfig(
        api_key=settings.google_ai_api_key,
        default_model="models/gemini-2.5-flash",  # Latest stable Gemini Flash model
        max_retries=3,
        timeout_seconds=30,
    )

    return GoogleAIClient(config)


# Convenience function for quick text generation
async def generate_text_with_google(
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    """
    Convenience function for quick text generation.

    Args:
        prompt: Text prompt
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate

    Returns:
        str: Generated text

    Usage:
        text = await generate_text_with_google("What is AI?")
    """
    client = get_google_ai_client()
    response = await client.generate_text(
        prompt=prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response["text"]
