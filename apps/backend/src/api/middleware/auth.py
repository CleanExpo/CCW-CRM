"""Authentication middleware for JWT validation."""

from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import get_settings
from src.utils import get_logger

settings = get_settings()
logger = get_logger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware for JWT authentication."""

    # Paths that don't require authentication
    PUBLIC_PATHS = {"/", "/health", "/ready", "/docs", "/openapi.json"}

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        """Process the request and validate authentication."""
        # Skip auth for public paths
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Check for API key authentication
        api_key = request.headers.get("Authorization", "").replace("Bearer ", "")

        if api_key == settings.backend_api_key and settings.backend_api_key:
            # API key authentication successful
            request.state.auth_type = "api_key"
            return await call_next(request)

        # Check for user ID header (set by frontend after Supabase auth)
        user_id = request.headers.get("X-User-Id")
        if user_id:
            request.state.user_id = user_id
            request.state.auth_type = "user"
            return await call_next(request)

        # In development, allow unauthenticated requests
        if settings.environment == "development":
            logger.warning("Unauthenticated request allowed in development mode")
            return await call_next(request)

        # In production, reject unauthenticated requests
        return Response(
            content='{"error": "Unauthorized"}',
            status_code=401,
            media_type="application/json",
        )
