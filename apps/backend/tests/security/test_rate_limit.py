"""
Security Tests — API Rate Limiting (UNI-1861).

Verifies that:
- The SlowAPI limiter is configured and exported correctly
- Rate limit exceeded returns HTTP 429 with Retry-After header
- RateLimits constants match expected tiers
- Per-route limits work via @limiter.limit() decorator

These tests use a minimal self-contained FastAPI app so they are isolated
from the conftest RATE_LIMIT_ENABLED=false override.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address


# ---------------------------------------------------------------------------
# Unit tests — limiter module
# ---------------------------------------------------------------------------


class TestRateLimitConfig:
    """Verify the shared limiter module exports are well-formed."""

    def test_limiter_instance_exported(self) -> None:
        """limiter must be a Limiter instance importable from the middleware module."""
        from src.api.middleware.rate_limit import limiter

        assert isinstance(limiter, Limiter)

    def test_rate_limits_login_is_restrictive(self) -> None:
        """LOGIN limit must be more restrictive than default READ limit."""
        from src.api.middleware.rate_limit import RateLimits

        login_per_minute = int(RateLimits.LOGIN.split("/")[0])
        read_per_minute = int(RateLimits.READ.split("/")[0])
        assert login_per_minute < read_per_minute, (
            "Login limit should be more restrictive than read limit to protect against brute force"
        )

    def test_rate_limits_tiers_defined(self) -> None:
        """All standard rate limit tiers must be present."""
        from src.api.middleware.rate_limit import RateLimits

        assert RateLimits.LOGIN
        assert RateLimits.READ
        assert RateLimits.WRITE
        assert RateLimits.DELETE
        assert RateLimits.PUBLIC

    def test_rate_limit_key_func_returns_ip_for_anonymous(self) -> None:
        """get_rate_limit_key must fall back to IP key for unauthenticated requests."""
        from src.api.middleware.rate_limit import get_rate_limit_key
        from unittest.mock import MagicMock

        mock_request = MagicMock()
        mock_request.cookies = {}
        mock_request.client = MagicMock()
        mock_request.client.host = "127.0.0.1"
        mock_request.headers = {}

        key = get_rate_limit_key(mock_request)
        assert key.startswith("ip:"), f"Expected IP-based key, got: {key}"


# ---------------------------------------------------------------------------
# Integration tests — 429 behaviour via minimal test app
# ---------------------------------------------------------------------------


def _build_test_app(limit: str = "3/minute") -> tuple[FastAPI, TestClient]:
    """Return a minimal FastAPI app + sync TestClient with rate limiting active."""
    test_limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[limit],
        storage_uri="memory://",
        enabled=True,
    )

    mini_app = FastAPI()
    mini_app.state.limiter = test_limiter
    mini_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    mini_app.add_middleware(SlowAPIMiddleware)

    @mini_app.get("/ping")
    async def ping(request: Request) -> dict:  # noqa: ARG001
        return {"status": "ok"}

    @mini_app.get("/strict")
    @test_limiter.limit("1/minute")
    async def strict(request: Request) -> dict:  # noqa: ARG001
        return {"status": "strict ok"}

    client = TestClient(mini_app, raise_server_exceptions=False)
    return mini_app, client


class TestRateLimitBehaviour:
    """Integration tests — 429 returned after limit exceeded."""

    def test_requests_within_limit_succeed(self) -> None:
        """Requests within the limit must return 200."""
        _, client = _build_test_app("5/minute")
        for _ in range(3):
            resp = client.get("/ping")
            assert resp.status_code == 200

    def test_requests_over_limit_return_429(self) -> None:
        """Requests exceeding the limit must return HTTP 429."""
        _, client = _build_test_app("2/minute")
        # First two should succeed
        client.get("/ping")
        client.get("/ping")
        # Third must be rate limited
        resp = client.get("/ping")
        assert resp.status_code == 429, (
            f"Expected 429 after limit exceeded, got {resp.status_code}"
        )

    def test_429_response_has_retry_after_header(self) -> None:
        """429 responses must include Retry-After header (RFC 6585)."""
        _, client = _build_test_app("2/minute")
        client.get("/ping")
        client.get("/ping")
        resp = client.get("/ping")
        assert resp.status_code == 429
        # SlowAPI injects X-RateLimit-* and Retry-After headers
        assert "retry-after" in resp.headers, (
            "429 response must include Retry-After header"
        )

    def test_429_response_body_is_json(self) -> None:
        """429 responses must be JSON (not HTML) to keep API contract consistent."""
        _, client = _build_test_app("2/minute")
        client.get("/ping")
        client.get("/ping")
        resp = client.get("/ping")
        assert resp.status_code == 429
        body = resp.json()
        assert "error" in body or "detail" in body, (
            f"429 body must contain error/detail field; got: {body}"
        )

    def test_per_route_limit_decorator(self) -> None:
        """Per-route @limiter.limit() must override the default limit."""
        _, client = _build_test_app("100/minute")  # high default
        # /strict has 1/minute — second request must be 429
        resp1 = client.get("/strict")
        assert resp1.status_code == 200
        resp2 = client.get("/strict")
        assert resp2.status_code == 429, (
            f"Per-route 1/minute limit should trigger 429 on second request; got {resp2.status_code}"
        )


# ---------------------------------------------------------------------------
# App-wiring test — verify SlowAPIMiddleware is registered in real app
# ---------------------------------------------------------------------------


class TestMainAppRateLimitWiring:
    """Verify the production app has the rate limit middleware wired up."""

    def test_limiter_on_app_state(self) -> None:
        """app.state.limiter must be a Limiter instance."""
        import os
        os.environ.setdefault("RATE_LIMIT_ENABLED", "false")  # keep tests fast
        from src.api.main import app as main_app

        assert hasattr(main_app.state, "limiter"), "app.state.limiter not set"
        assert isinstance(main_app.state.limiter, Limiter)

    def test_rate_limit_exceeded_handler_registered(self) -> None:
        """RateLimitExceeded exception handler must be registered on the app."""
        from src.api.main import app as main_app

        handlers = main_app.exception_handlers
        assert RateLimitExceeded in handlers, (
            "RateLimitExceeded handler must be registered so 429 responses are JSON"
        )

    def test_slowapi_middleware_present(self) -> None:
        """SlowAPIMiddleware must be in the middleware stack."""
        from src.api.main import app as main_app

        has_slowapi = any(
            (hasattr(m, "cls") and m.cls is SlowAPIMiddleware)
            or m is SlowAPIMiddleware
            for m in main_app.user_middleware
        )
        assert has_slowapi, (
            f"SlowAPIMiddleware not found in middleware stack. "
            f"Found: {[getattr(m, 'cls', type(m)).__name__ for m in main_app.user_middleware]}"
        )
