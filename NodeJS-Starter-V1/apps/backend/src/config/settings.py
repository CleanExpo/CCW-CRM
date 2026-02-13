"""Application settings and configuration."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Project
    project_name: str = Field(default="AI Agent Orchestration")
    environment: Literal["development", "staging", "production"] = Field(default="development")
    debug: bool = Field(default=False)

    # API
    backend_api_key: str = Field(default="")
    cors_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3004",
            "http://localhost:3005",
        ],
        description="Allowed CORS origins (override in production with your domain)",
    )
    # Production domains should be added via environment variable:
    # CORS_ORIGINS='["https://your-domain.com","https://www.your-domain.com"]'

    # Database (PostgreSQL)
    database_url: str = Field(
        default="postgresql://starter_user:local_dev_password@localhost:5432/starter_db",
        description="PostgreSQL connection URL",
    )

    # JWT Authentication
    jwt_secret_key: str = Field(
        default="your-secret-key-change-in-production",
        description="Secret key for JWT token signing",
    )
    jwt_expire_minutes: int = Field(
        default=480, description="JWT access token expiration in minutes (8 hours)"
    )
    jwt_refresh_expire_days: int = Field(
        default=30, description="JWT refresh token expiration in days"
    )

    # Security
    secure_cookies: bool = Field(
        default=False,
        description="Enable secure flag on cookies (requires HTTPS, auto-enabled in production)",
    )
    rate_limit_enabled: bool = Field(default=True, description="Enable rate limiting")
    rate_limit_per_minute: int = Field(default=60, description="API rate limit per minute per user")

    # Legacy Supabase (deprecated - kept for migration compatibility)
    supabase_url: str = Field(default="", alias="NEXT_PUBLIC_SUPABASE_URL")
    supabase_anon_key: str = Field(default="", alias="NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(default="")
    supabase_jwt_secret: str = Field(default="")

    # AI Provider Configuration
    ai_provider: str = Field(
        default="ollama", description="AI provider: 'ollama' (local) or 'anthropic' (cloud)"
    )

    # Ollama (Local AI - No API key required)
    ollama_base_url: str = Field(default="http://localhost:11434", description="Ollama server URL")
    ollama_model: str = Field(default="llama3.1:8b", description="Ollama model for generation")
    ollama_embedding_model: str = Field(
        default="nomic-embed-text", description="Ollama model for embeddings"
    )

    # Cloud AI Models (Optional)
    anthropic_api_key: str = Field(default="", description="Anthropic API key (optional)")
    google_ai_api_key: str = Field(default="", description="Google AI API key (optional)")
    openrouter_api_key: str = Field(default="", description="OpenRouter API key (optional)")

    # Model defaults
    default_model: str = Field(default="claude-opus-4-6")
    max_tokens: int = Field(default=4096)
    temperature: float = Field(default=0.4)

    # Email (SendGrid for password reset, etc.)
    sendgrid_api_key: str = Field(
        default="", description="SendGrid API key for transactional emails"
    )
    sendgrid_from_email: str = Field(
        default="noreply@ccw-erp.com", description="From email address"
    )
    sendgrid_from_name: str = Field(default="CCW ERP", description="From name for emails")

    # Business Configuration
    tax_rate: str = Field(
        default="0.10", description="Tax rate (GST) as decimal (e.g., 0.10 for 10%)"
    )
    tax_name: str = Field(default="GST", description="Tax name displayed in UI")
    quote_validity_days: int = Field(
        default=30, description="Default quote validity period in days"
    )

    # Stocktrim Integration
    stocktrim_api_url: str = Field(
        default="https://api.stocktrim.com", description="Stocktrim API base URL"
    )
    stocktrim_api_key: str = Field(default="", description="Stocktrim API key for stock management")
    stocktrim_enabled: bool = Field(default=True, description="Enable Stocktrim integration")
    stocktrim_fallback_to_local: bool = Field(
        default=True, description="Fallback to local stock check if Stocktrim unavailable"
    )

    # Webhook Configuration
    webhook_secret: str = Field(
        default="change-this-webhook-secret-in-production",
        description="Secret key for webhook signature verification",
    )
    webhook_contact_form_url: str | None = Field(
        default=None, description="External URL to POST contact form events"
    )
    webhook_demo_request_url: str | None = Field(
        default=None, description="External URL to POST demo request events"
    )

    # Redis Configuration
    redis_url: str = Field(
        default="redis://localhost:6379",
        description="Redis connection URL for event bus, caching, and Celery",
    )
    redis_max_connections: int = Field(default=50, description="Maximum Redis connection pool size")

    # Celery Configuration
    celery_broker_url: str = Field(
        default="redis://localhost:6379/0", description="Celery broker URL (Redis)"
    )
    celery_result_backend: str = Field(
        default="redis://localhost:6379/0", description="Celery result backend URL"
    )

    # MCP Tools
    exa_api_key: str = Field(default="")
    ref_tools_api_key: str = Field(default="")

    # Model defaults
    default_model: str = Field(default="claude-sonnet-4-5-20250929")
    max_tokens: int = Field(default=4096)
    temperature: float = Field(default=0.7)

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def should_use_secure_cookies(self) -> bool:
        """Determine if secure cookies should be used (True in production or if explicitly enabled)."""
        return self.is_production or self.secure_cookies

    @property
    def tax_rate_decimal(self) -> "Decimal":
        """Get tax rate as Decimal for precise calculations."""
        from decimal import Decimal

        return Decimal(self.tax_rate)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
