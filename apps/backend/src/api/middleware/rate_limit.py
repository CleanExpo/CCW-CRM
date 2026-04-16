"""
Rate limiting middleware for API endpoints.

Prevents brute force attacks and abuse by limiting request rates.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.config.settings import get_settings

settings = get_settings()


def get_rate_limit_key(request) -> str:
    """
    Get rate limit key based on user authentication status.

    - Authenticated users: Rate limited by user_id
    - Anonymous users: Rate limited by IP address

    This ensures:
    - Legitimate users get higher limits
    - Attackers can't bypass IP limits by switching IPs
    - Each authenticated user has independent rate limits
    """
    # Try to get user_id from auth token
    auth_token = request.cookies.get("auth_token")

    if auth_token:
        from src.auth.jwt import decode_access_token
        payload = decode_access_token(auth_token)
        if payload and payload.get("user_id"):
            # Authenticated user - rate limit by user_id
            return f"user:{payload['user_id']}"

    # Anonymous user - rate limit by IP
    return f"ip:{get_remote_address(request)}"


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom 429 handler that returns a structured JSON error with retry information.

    Returns:
        429 JSON response with error message and reset time in seconds.
    """
    # Extract reset time from the rate limit error (slowapi stores it in the detail)
    reset_time = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=429,
        content={"error": f"Rate limit exceeded. Retry after {reset_time}s"},
        headers={"Retry-After": str(reset_time)},
    )


# Create limiter instance with Redis storage for multi-instance support
storage_uri = (
    f"redis://{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
    if settings.cache_enabled
    else "memory://"
)

limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=["100/minute"] if settings.rate_limit_enabled else [],
    storage_uri=storage_uri,
    enabled=settings.rate_limit_enabled,
)


# Rate limit configurations for different endpoint types
class RateLimits:
    """Predefined rate limits for different endpoint types."""

    # Authentication endpoints (more restrictive — 10/minute per spec UNI-1861)
    AUTH = "10/minute"           # 10 auth attempts per minute
    LOGIN = "5/minute"           # 5 login attempts per minute
    REGISTER = "3/hour"          # 3 registration attempts per hour
    PASSWORD_RESET = "3/hour"    # 3 password reset requests per hour
    CHANGE_PASSWORD = "5/hour"   # 5 password change attempts per hour
    REFRESH = "10/minute"        # 10 token refresh per minute

    # API endpoints (standard — 100/minute per spec UNI-1861)
    API = "100/minute"           # 100 requests per minute (standard)
    READ = "100/minute"          # 100 read operations per minute
    WRITE = "30/minute"          # 30 write operations per minute
    DELETE = "10/minute"         # 10 delete operations per minute

    # Public endpoints (most restrictive)
    PUBLIC = "20/minute"         # 20 requests per minute for unauthenticated users
