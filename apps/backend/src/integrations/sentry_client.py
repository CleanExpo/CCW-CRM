"""
Sentry integration for error tracking and performance monitoring.

Provides:
- Automatic error capture and reporting
- Performance monitoring (transactions and spans)
- Release tracking
- User context tracking
- Environment tagging

Usage:
    # Initialize Sentry on app startup
    from src.integrations.sentry_client import initialize_sentry
    initialize_sentry()

    # Sentry will automatically capture exceptions
    # For manual tracking:
    import sentry_sdk
    sentry_sdk.capture_exception(exception)
"""

import os

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from src.config.settings import get_settings


def initialize_sentry():
    """
    Initialize Sentry SDK with FastAPI integration.

    Configuration via environment variables:
    - SENTRY_DSN: Sentry project DSN
    - ENVIRONMENT: production, staging, development
    - SENTRY_TRACES_SAMPLE_RATE: Performance monitoring sample rate (0.0-1.0)
    - SENTRY_PROFILES_SAMPLE_RATE: Profiling sample rate (0.0-1.0)
    """
    settings = get_settings()

    sentry_dsn = os.getenv("SENTRY_DSN")

    # Only initialize Sentry if DSN is configured
    if not sentry_dsn:
        print("⚠️  Sentry DSN not configured, skipping initialization")
        return

    # Determine environment
    environment = settings.environment or "development"

    # Sample rates (lower in production to reduce costs)
    traces_sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    profiles_sample_rate = float(os.getenv("SENTRY_PROFILES_SAMPLE_RATE", "0.1"))

    # Initialize Sentry
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=environment,
        # Release tracking (use git commit hash or version)
        release=os.getenv("SENTRY_RELEASE", "ccw-erp@1.0.0"),
        # Integrations
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            RedisIntegration(),
            LoggingIntegration(
                level=None,  # Capture all levels
                event_level=None,  # Send all events
            ),
        ],
        # Performance monitoring
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        # Error sampling
        sample_rate=1.0,  # Capture 100% of errors
        # Maximum breadcrumbs
        max_breadcrumbs=50,
        # Attach stack locals to errors (useful for debugging)
        attach_stacktrace=True,
        # Send default PII (user info)
        send_default_pii=True,
        # Custom tags
        _experiments={
            "profiles_sample_rate": profiles_sample_rate,
        },
    )

    print(f"✅ Sentry initialized (environment: {environment}, traces: {traces_sample_rate})")


def set_user_context(user_id: str, email: str, organization_id: str):
    """
    Set user context for Sentry error tracking.

    This helps identify which users are experiencing errors.

    Args:
        user_id: User UUID
        email: User email address
        organization_id: Organization UUID
    """
    sentry_sdk.set_user({
        "id": user_id,
        "email": email,
        "organization_id": organization_id,
    })


def set_transaction_context(transaction_name: str, **kwargs):
    """
    Set transaction context for performance monitoring.

    Args:
        transaction_name: Name of the transaction (e.g., "GET /api/products")
        **kwargs: Additional context data
    """
    with sentry_sdk.configure_scope() as scope:
        scope.set_transaction_name(transaction_name)
        for key, value in kwargs.items():
            scope.set_tag(key, value)


def capture_exception_with_context(exception: Exception, **context):
    """
    Capture an exception with additional context.

    Args:
        exception: The exception to capture
        **context: Additional context data
    """
    with sentry_sdk.push_scope() as scope:
        for key, value in context.items():
            scope.set_context(key, value)
        sentry_sdk.capture_exception(exception)


def capture_message(message: str, level: str = "info", **context):
    """
    Capture a message (non-error event).

    Args:
        message: Message to capture
        level: Message level (debug, info, warning, error, fatal)
        **context: Additional context data
    """
    with sentry_sdk.push_scope() as scope:
        for key, value in context.items():
            scope.set_tag(key, value)
        sentry_sdk.capture_message(message, level=level)


# Middleware for automatic user context
class SentryContextMiddleware:
    """
    Middleware to automatically set Sentry context from request.

    Usage:
        app.add_middleware(SentryContextMiddleware)
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Extract user info from request if available
        if scope["type"] == "http":
            # Get user from auth token (if authenticated)
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode()

            if auth_header.startswith("Bearer "):
                try:
                    from src.auth.jwt import decode_access_token

                    token = auth_header.split(" ")[1]
                    payload = decode_access_token(token)

                    if payload:
                        set_user_context(
                            user_id=payload.get("user_id", "unknown"),
                            email=payload.get("email", "unknown"),
                            organization_id=payload.get("organization_id", "unknown"),
                        )
                except Exception:
                    pass  # Ignore auth errors in context middleware

        await self.app(scope, receive, send)
