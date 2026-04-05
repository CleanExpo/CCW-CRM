"""
Supabase Client for Backend

Handles database connections with Australian context:
- AEST timezone handling
- Australian data validation (ABN, mobile, suburbs)
- Type-safe queries with Pydantic models
"""

from supabase import Client, create_client

from src.config.settings import get_settings

settings = get_settings()


def get_supabase_client() -> Client:
    """
    Create and return Supabase client.

    Connects to Supabase PostgreSQL database with:
    - Row Level Security (RLS) enabled
    - Australian schema (contractors, availability_slots)
    - AEST timezone configuration
    """
    supabase_url = settings.supabase_url
    supabase_key = settings.supabase_anon_key

    if not supabase_url or not supabase_key:
        raise ValueError(
            "Supabase credentials not configured. "
            "Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
        )

    client: Client = create_client(supabase_url, supabase_key)
    return client


# Global client instance (reused across requests)
supabase: Client = get_supabase_client()
