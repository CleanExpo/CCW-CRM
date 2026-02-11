"""Application settings and configuration."""

from decimal import Decimal
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
    skip_auth_enforcement: bool = Field(
        default=False,
        description="Skip authentication enforcement (ONLY for local testing, NEVER in production)",
    )
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

    # Redis Cache
    redis_host: str = Field(default="localhost", description="Redis host")
    redis_port: int = Field(default=6379, description="Redis port")
    redis_db: int = Field(default=0, description="Redis database number")
    cache_enabled: bool = Field(default=True, description="Enable Redis caching")
    cache_ttl: int = Field(default=300, description="Default cache TTL in seconds (5 minutes)")

    # JWT Authentication
    jwt_secret_key: str = Field(
        default="",
        description="Secret key for JWT token signing (loaded from AWS Secrets Manager in production)",
    )
    jwt_expire_minutes: int = Field(
        default=480, description="JWT access token expiration in minutes (8 hours)"
    )  # noqa: E501
    jwt_refresh_expire_days: int = Field(
        default=30, description="JWT refresh token expiration in days"
    )  # noqa: E501

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

    # Email (SendGrid for password reset, etc.)
    sendgrid_api_key: str = Field(
        default="", description="SendGrid API key for transactional emails"
    )  # noqa: E501
    sendgrid_from_email: str = Field(
        default="noreply@ccw-erp.com", description="From email address"
    )  # noqa: E501
    sendgrid_from_name: str = Field(default="CCW ERP", description="From name for emails")

    # System Alert Notifications (for monitoring/ops team)
    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP host for alert emails")
    smtp_port: int = Field(default=587, description="SMTP port")
    smtp_user: str = Field(default="", description="SMTP username")
    smtp_password: str = Field(default="", description="SMTP password")
    alert_email_to: str = Field(default="", description="Email address to send system alerts")
    slack_webhook_url: str = Field(default="", description="Slack webhook URL for system alerts")

    # Monitoring Configuration
    alert_check_interval_minutes: int = Field(
        default=5, description="Alert check interval in minutes"
    )
    metrics_retention_hours: int = Field(
        default=24, description="Performance metrics retention in hours"
    )

    # Sentry Error Tracking
    sentry_dsn: str = Field(
        default="",
        description="Sentry DSN for error tracking (get from https://sentry.io/settings/[org]/projects/[project]/keys/)",
    )
    sentry_traces_sample_rate: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Sentry performance traces sample rate (0.0-1.0, 0.1 = 10%)",
    )
    sentry_profiles_sample_rate: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Sentry profiling sample rate (0.0-1.0, 0.1 = 10%)",
    )
    sentry_release: str = Field(
        default="",
        description="Sentry release identifier (defaults to ccw-erp@1.0.0 if not set)",
    )

    # Business Configuration
    tax_rate: str = Field(
        default="0.10", description="Tax rate (GST) as decimal (e.g., 0.10 for 10%)"
    )  # noqa: E501
    tax_name: str = Field(default="GST", description="Tax name displayed in UI")
    quote_validity_days: int = Field(
        default=30, description="Default quote validity period in days"
    )  # noqa: E501

    # Stocktrim Integration
    stocktrim_api_url: str = Field(
        default="https://api.stocktrim.com", description="Stocktrim API base URL"
    )  # noqa: E501
    stocktrim_api_key: str = Field(default="", description="Stocktrim API key for stock management")
    stocktrim_enabled: bool = Field(default=True, description="Enable Stocktrim integration")
    stocktrim_fallback_to_local: bool = Field(
        default=True, description="Fallback to local stock check if Stocktrim unavailable"
    )

    # Webhook Configuration
    webhook_secret: str = Field(
        default="",
        description="Secret key for webhook signature verification (loaded from AWS Secrets Manager in production)",
    )
    webhook_contact_form_url: str | None = Field(
        default=None, description="External URL to POST contact form events"
    )
    webhook_demo_request_url: str | None = Field(
        default=None, description="External URL to POST demo request events"
    )

    # MCP Tools
    exa_api_key: str = Field(default="")
    ref_tools_api_key: str = Field(default="")

    # Model defaults
    default_model: str = Field(default="claude-opus-4-6")
    max_tokens: int = Field(default=4096)
    temperature: float = Field(default=0.4)

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def should_use_secure_cookies(self) -> bool:
        """Determine if secure cookies should be used (True in production or if explicitly enabled)."""  # noqa: E501
        return self.is_production or self.secure_cookies

    @property
    def tax_rate_decimal(self) -> Decimal:
        """Get tax rate as Decimal for precise calculations."""
        return Decimal(self.tax_rate)

    def get_jwt_secret_secure(self) -> str:
        """
        Get JWT secret from AWS Secrets Manager (production) or environment (development).

        Returns:
            JWT secret key

        Raises:
            ValueError: If secret not configured in production
        """
        if self.is_production:
            from src.integrations.secrets_manager import get_jwt_secret

            return get_jwt_secret()
        else:
            # Development: allow default from env or settings
            return self.jwt_secret_key or "dev-jwt-secret-not-for-production"

    def get_webhook_secret_secure(self) -> str:
        """
        Get webhook secret from AWS Secrets Manager (production) or environment (development).

        Returns:
            Webhook signature verification secret

        Raises:
            ValueError: If secret not configured in production
        """
        if self.is_production:
            from src.integrations.secrets_manager import get_webhook_secret

            return get_webhook_secret()
        else:
            # Development: allow default from env or settings
            return self.webhook_secret or "dev-webhook-secret-not-for-production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
