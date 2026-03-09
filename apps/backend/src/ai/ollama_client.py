"""Ollama client singleton for LLM interactions."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from typing import Any

import structlog

try:
    from ollama import AsyncClient
except ImportError:
    AsyncClient = None  # type: ignore[assignment, misc]

from src.config import get_settings

logger = structlog.get_logger(__name__)


class OllamaClient:
    """
    Singleton wrapper for Ollama client.

    Provides connection management, retries, and streaming support for
    interacting with local Ollama models.
    """

    _instance: OllamaClient | None = None
    _client: Any = None
    _lock = asyncio.Lock()

    def __new__(cls) -> OllamaClient:
        """Ensure only one instance exists."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        """Initialize connection settings from config."""
        if self._client is None:
            settings = get_settings()
            self.base_url = settings.ollama_base_url
            self.model = settings.ollama_model
            self.embedding_model = settings.ollama_embedding_model
            self._client = AsyncClient(host=self.base_url)
            logger.info(
                "Ollama client initialized",
                base_url=self.base_url,
                model=self.model,
            )

    async def check_connection(self) -> bool:
        """
        Check if Ollama service is accessible.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            models = await self._client.list()
            logger.info("Ollama connection successful", model_count=len(models.get("models", [])))
            return True
        except Exception as e:
            logger.error("Ollama connection failed", error=str(e))
            return False

    async def check_model_exists(self, model_name: str | None = None) -> bool:
        """
        Check if a specific model is available.

        Args:
            model_name: Model to check, defaults to configured model

        Returns:
            True if model exists, False otherwise
        """
        target_model = model_name or self.model
        try:
            models = await self._client.list()
            model_names = [m["name"] for m in models.get("models", [])]
            exists = target_model in model_names
            if not exists:
                logger.warning(
                    "Model not found",
                    model=target_model,
                    available_models=model_names,
                )
            return exists
        except Exception as e:
            logger.error("Failed to list models", error=str(e))
            return False

    async def generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """
        Generate a response from the LLM.

        Args:
            prompt: User prompt/message
            model: Model to use, defaults to configured model
            system: System prompt for context
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated response text
        """
        target_model = model or self.model

        try:
            options = {"temperature": temperature}
            if max_tokens:
                options["num_predict"] = max_tokens

            response = await self._client.generate(
                model=target_model,
                prompt=prompt,
                system=system,
                options=options,
            )

            return response["response"]

        except Exception as e:
            logger.error(
                "Generation failed",
                error=str(e),
                model=target_model,
                prompt_length=len(prompt),
            )
            raise

    async def stream_generate(
        self,
        prompt: str,
        model: str | None = None,
        system: str | None = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a response from the LLM.

        Args:
            prompt: User prompt/message
            model: Model to use, defaults to configured model
            system: System prompt for context
            temperature: Sampling temperature (0-1)

        Yields:
            Response text chunks
        """
        target_model = model or self.model

        try:
            stream = await self._client.generate(
                model=target_model,
                prompt=prompt,
                system=system,
                options={"temperature": temperature},
                stream=True,
            )

            async for chunk in stream:
                if "response" in chunk:
                    yield chunk["response"]

        except Exception as e:
            logger.error(
                "Streaming failed",
                error=str(e),
                model=target_model,
            )
            raise

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """
        Chat completion with conversation history.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use, defaults to configured model
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens to generate

        Returns:
            Assistant response text
        """
        target_model = model or self.model

        try:
            options = {"temperature": temperature}
            if max_tokens:
                options["num_predict"] = max_tokens

            response = await self._client.chat(
                model=target_model,
                messages=messages,
                options=options,
            )

            return response["message"]["content"]

        except Exception as e:
            logger.error(
                "Chat failed",
                error=str(e),
                model=target_model,
                message_count=len(messages),
            )
            raise

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion.

        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use, defaults to configured model
            temperature: Sampling temperature (0-1)

        Yields:
            Response text chunks
        """
        target_model = model or self.model

        try:
            stream = await self._client.chat(
                model=target_model,
                messages=messages,
                options={"temperature": temperature},
                stream=True,
            )

            async for chunk in stream:
                if "message" in chunk and "content" in chunk["message"]:
                    yield chunk["message"]["content"]

        except Exception as e:
            logger.error(
                "Chat streaming failed",
                error=str(e),
                model=target_model,
            )
            raise

    async def create_embeddings(self, text: str, model: str | None = None) -> list[float]:
        """
        Generate embeddings for text.

        Args:
            text: Text to embed
            model: Embedding model to use, defaults to configured embedding model

        Returns:
            Embedding vector
        """
        target_model = model or self.embedding_model

        try:
            response = await self._client.embeddings(
                model=target_model,
                prompt=text,
            )

            return response["embedding"]

        except Exception as e:
            logger.error(
                "Embedding generation failed",
                error=str(e),
                model=target_model,
                text_length=len(text),
            )
            raise


# Singleton instance
_ollama_client_instance: OllamaClient | None = None


def get_ollama_client() -> OllamaClient:
    """
    Get the singleton Ollama client instance.

    Returns:
        OllamaClient instance
    """
    global _ollama_client_instance
    if _ollama_client_instance is None:
        _ollama_client_instance = OllamaClient()
    return _ollama_client_instance
