"""AI module for LangGraph agents and Ollama integration."""
from __future__ import annotations

try:
    from .ollama_client import get_ollama_client
except ImportError:
    get_ollama_client = None  # type: ignore[assignment]

__all__ = ["get_ollama_client"]
