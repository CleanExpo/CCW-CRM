"""
Google Agent Payments Protocol (AP2) Configuration.

Settings for AP2 integration with dual-mode support (demo/live).
"""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AP2Settings(BaseSettings):
    """
    AP2 integration settings.

    Supports dual-mode operation:
    - demo: Mock responses for development/testing
    - live: Real Google AP2 API integration
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_prefix="AP2_",
    )

    # Mode configuration
    mode: Literal["demo", "live"] = Field(
        default="demo",
        description="AP2 mode: 'demo' for mock responses, 'live' for production",
    )

    # Google Cloud Project
    project_id: str | None = Field(
        default=None,
        description="Google Cloud Project ID",
    )

    # API Configuration
    api_key: str | None = Field(
        default=None,
        description="Google AP2 API key (for live mode)",
    )
    api_endpoint: str = Field(
        default="https://agentpayments.googleapis.com/v2",
        description="AP2 API endpoint",
    )
    api_timeout: int = Field(
        default=30,
        description="API request timeout in seconds",
    )

    # OAuth Configuration
    oauth_client_id: str | None = Field(
        default=None,
        description="OAuth 2.0 client ID",
    )
    oauth_client_secret: str | None = Field(
        default=None,
        description="OAuth 2.0 client secret",
    )
    oauth_redirect_uri: str = Field(
        default="http://localhost:8000/api/integrations/ap2/oauth/callback",
        description="OAuth redirect URI",
    )
    oauth_scopes: list[str] = Field(
        default=[
            "https://www.googleapis.com/auth/agentpayments",
            "https://www.googleapis.com/auth/userinfo.email",
        ],
        description="OAuth scopes required",
    )

    # Webhook Configuration
    webhook_secret: str | None = Field(
        default=None,
        description="Webhook signature verification secret",
    )
    webhook_url: str | None = Field(
        default=None,
        description="Public webhook URL for AP2 callbacks",
    )

    # Mandate Configuration
    mandate_ttl_seconds: int = Field(
        default=3600,
        description="Mandate time-to-live in seconds (default: 1 hour)",
    )
    signature_algorithm: str = Field(
        default="RS256",
        description="Signature algorithm for mandate verification",
    )

    # Voice Commerce Configuration
    voice_commerce_enabled: bool = Field(
        default=True,
        description="Enable voice commerce features",
    )
    voice_supported_assistants: list[str] = Field(
        default=["siri", "google_assistant"],
        description="Supported voice assistants",
    )
    voice_session_timeout_seconds: int = Field(
        default=300,
        description="Voice session timeout in seconds (default: 5 minutes)",
    )

    # Agent-to-Agent Commerce Configuration
    agent_commerce_enabled: bool = Field(
        default=True,
        description="Enable agent-to-agent commerce",
    )
    agent_verification_required: bool = Field(
        default=True,
        description="Require agent identity verification",
    )

    # Payment Configuration
    default_currency: str = Field(
        default="AUD",
        description="Default currency code (ISO 4217)",
    )
    min_payment_amount: float = Field(
        default=1.00,
        description="Minimum payment amount",
    )
    max_payment_amount: float = Field(
        default=100000.00,
        description="Maximum payment amount",
    )

    # Security Configuration
    rate_limit_per_hour: int = Field(
        default=1000,
        description="Maximum API calls per hour per connection",
    )
    signature_verification_enabled: bool = Field(
        default=True,
        description="Enable webhook signature verification",
    )

    # Retry Configuration
    max_retries: int = Field(
        default=3,
        description="Maximum retry attempts for failed requests",
    )
    retry_delay_seconds: int = Field(
        default=5,
        description="Delay between retry attempts in seconds",
    )

    # Logging Configuration
    log_requests: bool = Field(
        default=True,
        description="Log all API requests (for debugging)",
    )
    log_webhooks: bool = Field(
        default=True,
        description="Log all webhook events",
    )
    log_sensitive_data: bool = Field(
        default=False,
        description="Log sensitive data (tokens, signatures) - USE WITH CAUTION",
    )

    # Demo Mode Configuration
    demo_simulate_delays: bool = Field(
        default=True,
        description="Simulate API delays in demo mode",
    )
    demo_delay_ms: int = Field(
        default=200,
        description="Simulated delay in milliseconds (demo mode)",
    )
    demo_failure_rate: float = Field(
        default=0.0,
        description="Simulated failure rate (0.0-1.0, demo mode)",
    )

    def is_configured(self) -> bool:
        """Check if AP2 is properly configured for live mode."""
        if self.mode == "demo":
            return True

        required_fields = [
            self.api_key,
            self.oauth_client_id,
            self.oauth_client_secret,
            self.webhook_secret,
        ]

        return all(field is not None for field in required_fields)

    def get_oauth_authorization_url(self, state: str) -> str:
        """Generate OAuth authorization URL."""
        scopes = " ".join(self.oauth_scopes)
        return (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={self.oauth_client_id}"
            f"&redirect_uri={self.oauth_redirect_uri}"
            f"&response_type=code"
            f"&scope={scopes}"
            f"&state={state}"
            f"&access_type=offline"
            f"&prompt=consent"
        )


# Global settings instance
_ap2_settings: AP2Settings | None = None


def get_ap2_settings() -> AP2Settings:
    """
    Get AP2 settings singleton.

    Returns:
        AP2Settings instance
    """
    global _ap2_settings
    if _ap2_settings is None:
        _ap2_settings = AP2Settings()
    return _ap2_settings
