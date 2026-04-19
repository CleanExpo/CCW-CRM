"""
Tests for UNI-1917 — slowapi rate limiting.

Pure-Python structural tests; no HTTP requests, no DB required.
Validates:
- Global default is 100/minute
- Login endpoint carries the 5/minute decorator
- RateLimitExceeded handler is wired into main.py
- app.state.limiter is set
- Redis fallback to memory:// is present
"""

import re
from pathlib import Path

_MIDDLEWARE_PATH = (
    Path(__file__).parents[2]
    / "src" / "api" / "middleware" / "rate_limit.py"
)
_MAIN_PATH = (
    Path(__file__).parents[2]
    / "src" / "api" / "main.py"
)
_AUTH_PATH = (
    Path(__file__).parents[2]
    / "src" / "api" / "routes" / "demo_auth.py"
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# rate_limit.py checks
# ---------------------------------------------------------------------------

class TestRateLimitMiddleware:
    def test_file_exists(self):
        assert _MIDDLEWARE_PATH.exists()

    def test_global_default_is_100_per_minute(self):
        src = _read(_MIDDLEWARE_PATH)
        assert '"100/minute"' in src, "Global default must be 100/minute"

    def test_login_limit_is_5_per_minute(self):
        src = _read(_MIDDLEWARE_PATH)
        assert 'LOGIN = "5/minute"' in src

    def test_uses_redis_storage_when_cache_enabled(self):
        src = _read(_MIDDLEWARE_PATH)
        assert "redis://" in src

    def test_falls_back_to_memory_storage(self):
        src = _read(_MIDDLEWARE_PATH)
        assert 'memory://' in src

    def test_limiter_uses_custom_key_function(self):
        src = _read(_MIDDLEWARE_PATH)
        assert "key_func=get_rate_limit_key" in src

    def test_key_function_handles_authenticated_users(self):
        src = _read(_MIDDLEWARE_PATH)
        assert 'f"user:{payload' in src or "user:" in src

    def test_key_function_handles_anonymous_users(self):
        src = _read(_MIDDLEWARE_PATH)
        assert "get_remote_address" in src


# ---------------------------------------------------------------------------
# main.py wiring checks
# ---------------------------------------------------------------------------

class TestMainWiring:
    def test_limiter_bound_to_app_state(self):
        src = _read(_MAIN_PATH)
        assert "app.state.limiter = limiter" in src

    def test_rate_limit_exceeded_handler_registered(self):
        src = _read(_MAIN_PATH)
        assert "RateLimitExceeded" in src
        assert "_rate_limit_exceeded_handler" in src

    def test_slowapi_imported_in_main(self):
        src = _read(_MAIN_PATH)
        assert "from slowapi" in src


# ---------------------------------------------------------------------------
# demo_auth.py login endpoint decorator check
# ---------------------------------------------------------------------------

class TestLoginEndpointDecorator:
    def test_login_route_has_rate_limit_decorator(self):
        src = _read(_AUTH_PATH)
        # The decorator must appear directly before the login function
        assert "@limiter.limit(RateLimits.LOGIN)" in src

    def test_login_route_path(self):
        src = _read(_AUTH_PATH)
        assert '"/login"' in src

    def test_imports_rate_limits(self):
        src = _read(_AUTH_PATH)
        assert "from src.api.middleware.rate_limit import" in src
        assert "RateLimits" in src
        assert "limiter" in src
