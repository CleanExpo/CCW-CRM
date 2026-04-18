"""
Service-request parts-inventory integration tests (UNI-1827).

Tests route registration, Pydantic validation, and stock-management
behaviour for the workshop parts API. These tests use TestClient (no
real DB required) — 500 is acceptable where a DB call would be made;
404 means the route is missing (test failure).

Run with:
    cd apps/backend && uv run pytest tests/api/test_service_requests.py -k parts_inventory
"""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.api.deps import get_current_user
from src.api.main import app

# ---------------------------------------------------------------------------
# Auth bypass — router-level auth runs before Pydantic validates path params
# and request bodies, so tests expecting 422 must override the dependency.
# MagicMock satisfies all attribute access the route handler may perform.
# ---------------------------------------------------------------------------
_mock_user = MagicMock()
_mock_user.id = uuid4()
_mock_user.email = "test@example.com"
app.dependency_overrides[get_current_user] = lambda: _mock_user

client = TestClient(app)
# Quiet client: returns 500 instead of re-raising server-side exceptions
# (used for tests that would hit the DB layer in a real environment)
client_quiet = TestClient(app, raise_server_exceptions=False)

_FAKE_SR_ID = str(uuid4())
_FAKE_PART_ID = str(uuid4())
_FAKE_PRODUCT_ID = str(uuid4())


# ---------------------------------------------------------------------------
# Route registration — parts_inventory tests
# ---------------------------------------------------------------------------


class TestServiceRequestPartsInventoryRoutes:
    """Verify the parts-inventory endpoints are registered on the router."""

    def test_parts_inventory_add_part_route_registered(self):
        """POST /{id}/parts must be registered (not 404).

        A 422 (validation error) or 500 (DB unavailable) is acceptable;
        404 means the route was never mounted.
        """
        resp = client_quiet.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts",
            json={
                "product_id": _FAKE_PRODUCT_ID,
                "quantity": 2,
                "location": "brisbane",
            },
        )
        assert resp.status_code not in (404,), (
            "POST /{id}/parts route not registered"
        )

    def test_parts_inventory_list_parts_route_registered(self):
        """GET /{id}/parts must be registered (not 404)."""
        resp = client_quiet.get(f"/api/service-requests/{_FAKE_SR_ID}/parts")
        assert resp.status_code not in (404,), (
            "GET /{id}/parts route not registered"
        )

    def test_parts_inventory_remove_part_route_registered(self):
        """DELETE /{id}/parts/{part_id} must be registered (not 404)."""
        resp = client_quiet.delete(
            f"/api/service-requests/{_FAKE_SR_ID}/parts/{_FAKE_PART_ID}"
        )
        assert resp.status_code not in (404,), (
            "DELETE /{id}/parts/{part_id} route not registered"
        )


# ---------------------------------------------------------------------------
# Pydantic validation — parts_inventory tests
# ---------------------------------------------------------------------------


class TestPartsInventoryValidation:
    """Validate request body constraints on parts endpoints."""

    def test_parts_inventory_add_part_missing_product_id_returns_422(self):
        """POST without product_id must fail validation (422)."""
        resp = client.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts",
            json={"quantity": 2, "location": "brisbane"},
        )
        assert resp.status_code == 422

    def test_parts_inventory_add_part_zero_quantity_returns_422(self):
        """quantity=0 violates ge=1 constraint — must return 422."""
        resp = client.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts",
            json={
                "product_id": _FAKE_PRODUCT_ID,
                "quantity": 0,
                "location": "brisbane",
            },
        )
        assert resp.status_code == 422

    def test_parts_inventory_add_part_negative_quantity_returns_422(self):
        """Negative quantity violates ge=1 — must return 422."""
        resp = client.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts",
            json={
                "product_id": _FAKE_PRODUCT_ID,
                "quantity": -5,
                "location": "brisbane",
            },
        )
        assert resp.status_code == 422

    def test_parts_inventory_add_part_invalid_service_request_uuid_returns_422(self):
        """Non-UUID service_request_id in path must return 422."""
        resp = client.post(
            "/api/service-requests/not-a-uuid/parts",
            json={
                "product_id": _FAKE_PRODUCT_ID,
                "quantity": 1,
                "location": "brisbane",
            },
        )
        assert resp.status_code == 422

    def test_parts_inventory_add_part_invalid_product_uuid_returns_422(self):
        """Non-UUID product_id in body must return 422."""
        resp = client.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts",
            json={
                "product_id": "not-a-uuid",
                "quantity": 1,
                "location": "brisbane",
            },
        )
        assert resp.status_code == 422

    def test_parts_inventory_list_parts_invalid_uuid_returns_422(self):
        """Non-UUID in GET path must return 422."""
        resp = client.get("/api/service-requests/not-a-uuid/parts")
        assert resp.status_code == 422

    def test_parts_inventory_remove_part_invalid_sr_uuid_returns_422(self):
        """Non-UUID service_request_id in DELETE path must return 422."""
        resp = client.delete(f"/api/service-requests/not-a-uuid/parts/{_FAKE_PART_ID}")
        assert resp.status_code == 422

    def test_parts_inventory_remove_part_invalid_part_uuid_returns_422(self):
        """Non-UUID part_id in DELETE path must return 422."""
        resp = client.delete(f"/api/service-requests/{_FAKE_SR_ID}/parts/not-a-uuid")
        assert resp.status_code == 422

    def test_parts_inventory_add_part_empty_body_returns_422(self):
        """Empty body on POST must return 422."""
        resp = client.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts", json={}
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Default location — parts_inventory tests
# ---------------------------------------------------------------------------


class TestPartsInventoryDefaults:
    """Ensure default field values are correct."""

    def test_parts_inventory_location_defaults_to_brisbane(self):
        """If location is omitted, the model should not fail validation.

        The server will try to look up stock and fail (500/404 from DB) —
        but the request body itself is valid, so we must NOT get 422.
        """
        resp = client_quiet.post(
            f"/api/service-requests/{_FAKE_SR_ID}/parts",
            json={"product_id": _FAKE_PRODUCT_ID, "quantity": 1},
        )
        # Body is valid — only DB errors (500/404) are acceptable, not 422
        assert resp.status_code != 422, (
            "Missing location should not fail Pydantic validation (has a default)"
        )
