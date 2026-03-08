"""Application settings and configuration.

Supports multiple secret loading methods:
1. Environment variables (development)
2. Docker secrets via _FILE suffix (staging/production containers)
3. AWS Secrets Manager (production)
"""

import os
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Literal

import structlog
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = structlog.get_logger(__name__)


def read_secret_file(file_path: str | None) -> str | None:
    """
    Read a secret from a Docker secret file.

    Docker secrets are mounted as files at /run/secrets/<secret_name>
    This function reads the content of the file and strips whitespace.

    Args:
        file_path: Path to the secret file

    Returns:
        Secret value or None if file doesn't exist
    """
    if not file_path:
        return None

    path = Path(file_path)
    if path.exists() and path.is_file():
        try:
            content = path.read_text(encoding="utf-8").strip()
            logger.debug("Secret loaded from file", file_path=file_path)
            return content
        except (OSError, PermissionError) as e:
            logger.warning("Failed to read secret file", file_path=file_path, error=str(e))
            return None

    return None


def get_secret_value(
    env_var: str,
    file_env_var: str | None = None,
    default: str = "",
) -> str:
    """
    Get secret value from multiple sources with priority:
    1. Docker secret file (via _FILE env var)
    2. Direct environment variable
    3. Default value

    Args:
        env_var: Name of the environment variable
        file_env_var: Name of the environment variable pointing to secret file
                     Defaults to {env_var}_FILE
        default: Default value if not found

    Returns:
        Secret value
    """
    file_env_var = file_env_var or f"{env_var}_FILE"

    # Priority 1: Docker secret file
    file_path = os.getenv(file_env_var)
    if file_path:
        secret = read_secret_file(file_path)
        if secret:
            return secret

    # Priority 2: Direct environment variable
    env_value = os.getenv(env_var)
    if env_value:
        return env_value

    # Priority 3: Default
    return default


class Settings(BaseSettings):
    """Application settings loaded from environment variables or Docker secrets."""

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
    # Can be loaded from: JWT_SECRET_KEY env var, JWT_SECRET_KEY_FILE (Docker secret), or AWS SM
    jwt_secret_key: str = Field(
        default="",
        description="Secret key for JWT token signing (supports Docker secrets via JWT_SECRET_KEY_FILE)",
    )
    jwt_expire_minutes: int = Field(
        default=480, description="JWT access token expiration in minutes (8 hours)"
    )
    jwt_refresh_expire_days: int = Field(
        default=30, description="JWT refresh token expiration in days"
    )

    # Database password for Docker secrets (separate from DATABASE_URL)
    database_host: str = Field(default="localhost", description="Database host")
    database_port: int = Field(default=5432, description="Database port")
    database_name: str = Field(default="starter_db", description="Database name")
    database_user: str = Field(default="starter_user", description="Database user")
    database_password: str = Field(default="", description="Database password (supports Docker secrets)")

    # Redis password for Docker secrets
    redis_password: str = Field(default="", description="Redis password (supports Docker secrets)")

    # Encryption key for sensitive data
    encryption_key: str = Field(
        default="",
        description="Encryption key for sensitive data (supports Docker secrets via ENCRYPTION_KEY_FILE)",
    )

    @model_validator(mode="after")
    def reject_skip_auth_in_production(self) -> "Settings":
        """Raise immediately if SKIP_AUTH_ENFORCEMENT is enabled in production/staging (CCW-SEC-003)."""
        if self.skip_auth_enforcement and self.environment in ("production", "staging"):
            raise ValueError(
                "SKIP_AUTH_ENFORCEMENT=true is not allowed in production or staging. "
                "This bypasses all authentication. Unset this variable and restart."
            )
        return self

    @model_validator(mode="after")
    def load_secrets_from_files(self) -> "Settings":
        """Load secrets from Docker secret files if environment variables point to them."""
        # Load JWT secret from file if JWT_SECRET_KEY_FILE is set
        jwt_from_file = get_secret_value("JWT_SECRET_KEY")
        if jwt_from_file and not self.jwt_secret_key:
            object.__setattr__(self, "jwt_secret_key", jwt_from_file)

        # Load database password from file if DATABASE_PASSWORD_FILE is set
        db_pass_from_file = get_secret_value("DATABASE_PASSWORD")
        if db_pass_from_file and not self.database_password:
            object.__setattr__(self, "database_password", db_pass_from_file)

        # Load Redis password from file if REDIS_PASSWORD_FILE is set
        redis_pass_from_file = get_secret_value("REDIS_PASSWORD")
        if redis_pass_from_file and not self.redis_password:
            object.__setattr__(self, "redis_password", redis_pass_from_file)

        # Load encryption key from file if ENCRYPTION_KEY_FILE is set
        enc_key_from_file = get_secret_value("ENCRYPTION_KEY")
        if enc_key_from_file and not self.encryption_key:
            object.__setattr__(self, "encryption_key", enc_key_from_file)

        return self

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
    def is_staging(self) -> bool:
        """Check if running in staging environment."""
        return self.environment == "staging"

    @property
    def should_use_secure_cookies(self) -> bool:
        """Determine if secure cookies should be used (True in production/staging or if explicitly enabled)."""
        return self.is_production or self.is_staging or self.secure_cookies

    @property
    def tax_rate_decimal(self) -> Decimal:
        """Get tax rate as Decimal for precise calculations."""
        return Decimal(self.tax_rate)

    def get_database_url_secure(self) -> str:
        """
        Build database URL from components, supporting Docker secrets for password.

        Returns:
            PostgreSQL async connection URL

        Note:
            Uses database_url if set, otherwise builds from components.
            Password can come from DATABASE_PASSWORD or DATABASE_PASSWORD_FILE.
        """
        # If DATABASE_URL is set directly, use it
        if self.database_url and "localhost" not in self.database_url:
            return self.database_url

        # Build from components (useful with Docker secrets)
        if self.database_password:
            return (
                f"postgresql+asyncpg://{self.database_user}:{self.database_password}"
                f"@{self.database_host}:{self.database_port}/{self.database_name}"
            )

        # Fallback to default DATABASE_URL
        return self.database_url

    def get_redis_url_secure(self) -> str:
        """
        Build Redis URL, supporting Docker secrets for password.

        Returns:
            Redis connection URL
        """
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    def get_jwt_secret_secure(self) -> str:
        """
        Get JWT secret from multiple sources with priority:
        1. Docker secret file (JWT_SECRET_KEY_FILE)
        2. Environment variable (JWT_SECRET_KEY)
        3. AWS Secrets Manager (production only)
        4. Development default (non-production only)

        Returns:
            JWT secret key

        Raises:
            ValueError: If secret not configured in production
        """
        # Check if already loaded (from env var or Docker secret via validator)
        if self.jwt_secret_key:
            return self.jwt_secret_key

        # Production: require AWS Secrets Manager or Docker secret
        if self.is_production:
            from src.integrations.secrets_manager import get_jwt_secret

            return get_jwt_secret()

        # Development/Staging: allow default
        return "dev-jwt-secret-not-for-production"

    def get_encryption_key_secure(self) -> str:
        """
        Get encryption key from multiple sources.

        Returns:
            Encryption key for sensitive data

        Raises:
            ValueError: If key not configured in production
        """
        # Check if already loaded
        if self.encryption_key:
            return self.encryption_key

        # Production: require proper configuration
        if self.is_production:
            from src.integrations.secrets_manager import get_encryption_key

            return get_encryption_key()

        # Development/Staging: warn but allow empty
        logger.warning("Encryption key not configured - sensitive data will not be encrypted")
        return ""

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

    def validate_production_secrets(self) -> list[str]:
        """
        Validate that all required secrets are configured for production.

        Returns:
            List of missing/invalid secrets (empty if all valid)
        """
        issues = []

        if self.is_production or self.is_staging:
            # Reject SKIP_AUTH_ENFORCEMENT in non-development environments (CCW-SEC-003)
            if self.skip_auth_enforcement:
                issues.append(
                    "SKIP_AUTH_ENFORCEMENT must not be enabled in production or staging. "
                    "This flag bypasses all authentication and is ONLY for local development."
                )

            # Check JWT secret
            if not self.jwt_secret_key or len(self.jwt_secret_key) < 32:
                issues.append("JWT_SECRET_KEY must be at least 32 characters")

            # Check database password
            if not self.database_password and "local_dev_password" in self.database_url:
                issues.append("DATABASE_PASSWORD must be set (not using dev password)")

            # Check encryption key (Fernet keys are 44 chars base64)
            if self.encryption_key and len(self.encryption_key) not in (43, 44):
                issues.append("ENCRYPTION_KEY should be a valid Fernet key (44 characters)")

        return issues


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
