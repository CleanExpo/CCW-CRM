"""Supabase state storage helpers."""

from __future__ import annotations

from supabase import Client, create_client

from src.config import get_settings
from src.utils import get_logger

settings = get_settings()
logger = get_logger(__name__)


class SupabaseStateStore:
    """Supabase client wrapper for state storage."""

    def __init__(self) -> None:
        self._client: Client | None = None
        self._configured = bool(
            settings.supabase_url
            and (settings.supabase_service_role_key or settings.supabase_anon_key)
        )

    @property
    def is_configured(self) -> bool:
        """Return True when Supabase credentials are configured."""
        return self._configured

    @property
    def client(self) -> Client:
        """Return initialized Supabase client."""
        if not self._configured:
            raise RuntimeError(
                "Supabase credentials not configured. "
                "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
            )

        if self._client is None:
            key = settings.supabase_service_role_key or settings.supabase_anon_key
            self._client = create_client(settings.supabase_url, key)
            logger.debug("Supabase state store client initialized")

        return self._client
