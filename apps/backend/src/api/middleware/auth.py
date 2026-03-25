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
    PUBLIC_PATHS = {
        "/",
        "/health",
        "/ready",
        "/api/auth/login",
        "/api/auth/signup",
        "/api/auth/refresh",
        "/api/auth/logout",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/public/stats",  # Landing page showcase data (aggregate counts only)
    }

    # Path prefixes that don't require authentication
    PUBLIC_PATH_PREFIXES = (
        "/api/guest/",   # Guest order approval portal (token-secured, no JWT)
        "/api/public/",  # Public stats endpoints
    )

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        """Process the request and validate authentication."""
        # Always allow OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip auth for public paths (exact match)
        if request.url.path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Skip auth for public path prefixes
        if any(request.url.path.startswith(prefix) for prefix in self.PUBLIC_PATH_PREFIXES):
            return await call_next(request)

        # Check for JWT token in cookie (HttpOnly auth_token from login)
        auth_token_cookie = request.cookies.get("auth_token")
        if auth_token_cookie:
            # Validate JWT token from cookie
            try:
                from src.auth.jwt import decode_access_token
                payload = decode_access_token(auth_token_cookie)
                request.state.user_id = payload.get("user_id")
                request.state.organization_id = payload.get("organization_id")
                request.state.auth_type = "jwt_cookie"
                logger.debug(f"JWT cookie auth successful for user {payload.get('user_id')}")
                return await call_next(request)
            except Exception as e:
                logger.warning(f"Invalid JWT cookie: {e}")
                # Continue to check other auth methods
        else:
            logger.debug("No auth_token cookie found")

        # Check for JWT Bearer token or API key in Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "").strip()

            # First, try to validate as JWT token
            try:
                from src.auth.jwt import decode_access_token
                payload = decode_access_token(token)
                request.state.user_id = payload.get("user_id")
                request.state.email = payload.get("sub")
                request.state.organization_id = payload.get("organization_id")
                request.state.auth_type = "jwt_bearer"
                logger.debug(
                    f"JWT Bearer auth successful for user {payload.get('user_id')}"
                )
                return await call_next(request)
            except Exception as e:
                logger.debug(f"JWT Bearer validation failed: {e}")
                # Not a valid JWT, check if it's a fixed API key

            # If JWT validation failed, check if it's the fixed API key
            if token == settings.backend_api_key and settings.backend_api_key:
                # API key authentication successful
                request.state.auth_type = "api_key"
                logger.debug("API key auth successful")
                return await call_next(request)

        # Only skip auth if explicitly enabled via environment variable
        if settings.skip_auth_enforcement:
            logger.warning(
                "WARNING: Authentication enforcement DISABLED via SKIP_AUTH_ENFORCEMENT flag. "
                "This should ONLY be used for local testing."
            )
            return await call_next(request)

        # In production, reject unauthenticated requests
        return Response(
            content='{"error": "Unauthorized"}',
            status_code=401,
            media_type="application/json",
        )
