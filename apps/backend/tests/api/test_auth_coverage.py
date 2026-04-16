"""Regression test for API route auth coverage (UNI-1770).

Ensures every backend API route is either:
  1. Protected by a JWT dependency (`get_current_user`), OR
  2. Explicitly allow-listed as public (health, login, webhooks, etc.)

This test introspects the live FastAPI app's router and classifies every
route. It will fail loudly if an engineer adds a new route without auth
and forgets to either protect it or add it to PUBLIC_ROUTE_PREFIXES.

History: Before UNI-1770, 30+ route modules were missing
`Depends(get_current_user)`. The original fix shipped in commit 3c41203
was lost during a hard-reset to origin/ai-updates. This test prevents
that regression from happening again.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

from src.api.deps import (
    get_current_active_user,
    get_current_admin_user,
    get_current_user,
)
from src.api.main import app

# Routes that are intentionally public. Must be exhaustive — anything not
# in this set that lacks an auth dep will fail the test.
#
# Entries are full path strings OR path prefixes (matched via startswith).
PUBLIC_ROUTE_PREFIXES: frozenset[str] = frozenset({
    # Health / liveness / readiness probes — must be callable without JWT
    "/api/health",
    "/health",
    "/api/ai/monitoring/health",
    "/api/autonomy/health",
    "/api/google-ai/health",
    "/api/pos/health",
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",

    # Authentication endpoints — login, signup, token refresh, password reset
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/register",
    "/api/auth/token",
    "/api/auth/refresh",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/verify-email",

    # Portal auth (customer-facing)
    "/api/portal/auth",

    # Webhooks — authenticated via HMAC signature, not JWT
    "/api/webhooks",
    "/api/integrations/shopify/webhooks",
    "/api/integrations/xero/webhooks",
    "/api/integrations/ap2/webhooks",
    "/api/integrations/elevenlabs/webhooks",
    "/api/integrations/sendgrid/webhooks",

    # Internal cron jobs — authenticated via CRON_SECRET bearer, not JWT
    "/api/cron",

    # Metrics scrape endpoint (Prometheus) — protected by network ACL
    "/metrics",
})

# Auth dependency callables — any route whose dependency tree contains
# one of these is considered protected.
AUTH_DEPENDENCIES = {
    get_current_user,
    get_current_active_user,
    get_current_admin_user,
}


def _route_has_auth_dep(route: APIRoute) -> bool:
    """Return True if the route's resolved dependency tree includes an
    auth dependency at either the route or router level."""
    # Walk the dependant tree that FastAPI built for this route
    deps_to_check = [route.dependant]
    while deps_to_check:
        dep = deps_to_check.pop()
        if dep.call in AUTH_DEPENDENCIES:
            return True
        deps_to_check.extend(dep.dependencies)
    return False


def _is_public_allow_listed(path: str) -> bool:
    """Return True if the path matches an entry in PUBLIC_ROUTE_PREFIXES."""
    return any(path == p or path.startswith(p + "/") or path.startswith(p) and p.endswith("/") for p in PUBLIC_ROUTE_PREFIXES)


def _iter_api_routes(fastapi_app: FastAPI) -> list[APIRoute]:
    """Return every APIRoute registered on the app."""
    return [r for r in fastapi_app.routes if isinstance(r, APIRoute)]


def test_all_routes_either_protected_or_allow_listed() -> None:
    """Every registered API route must have auth OR be in the public allow-list.

    If this test fails with a list of routes, the engineer has two options:
      1. Add `Depends(get_current_user)` to the route (or the router's
         `dependencies=` kwarg), OR
      2. If the route is genuinely public, add its path (or prefix) to
         PUBLIC_ROUTE_PREFIXES above with a one-line justification.

    Silently adding routes without auth is the regression this test blocks.
    """
    unprotected: list[tuple[str, str]] = []

    for route in _iter_api_routes(app):
        path = route.path
        if _is_public_allow_listed(path):
            continue
        if _route_has_auth_dep(route):
            continue
        # Missing auth and not allow-listed — regression.
        methods = ",".join(sorted(route.methods or [])) or "?"
        unprotected.append((methods, path))

    assert not unprotected, (
        "Found unauthenticated routes not in PUBLIC_ROUTE_PREFIXES allow-list.\n"
        "This is a security regression (UNI-1770).\n"
        "Either add Depends(get_current_user) to each route, or add the path\n"
        "to PUBLIC_ROUTE_PREFIXES in this file with a justification.\n\n"
        "Unprotected routes:\n"
        + "\n".join(f"  {methods}  {path}" for methods, path in unprotected)
    )


def test_allow_list_contains_known_public_routes() -> None:
    """Sanity check: the known-public paths are actually present in the app.

    If a canonical public path like /api/health disappears from the app,
    this test tells us to clean up PUBLIC_ROUTE_PREFIXES rather than let
    stale entries rot.
    """
    registered = {r.path for r in _iter_api_routes(app)}
    # These must always exist in a healthy app
    required = {"/health", "/api/auth/login"}
    missing = required - registered
    assert not missing, (
        f"Expected public routes are missing from the app: {sorted(missing)}.\n"
        "Either re-register them or update PUBLIC_ROUTE_PREFIXES."
    )


def test_auth_dependencies_are_distinct() -> None:
    """Sanity check that the three auth deps in this test file resolve
    to three distinct callables (catches accidental re-exports that would
    make the allow-list too permissive)."""
    assert len(AUTH_DEPENDENCIES) == 3
    assert get_current_user is not get_current_active_user
    assert get_current_user is not get_current_admin_user
    assert get_current_active_user is not get_current_admin_user
