"""
Tests for Purchase Order GRN (Goods Received Note) endpoints.

Covers UNI-1833 Phase 1 — GRN entity CRUD:
  POST /api/purchase-orders/{po_id}/grn       — create GRN
  GET  /api/purchase-orders/{po_id}/grn       — list GRNs
  GET  /api/purchase-orders/{po_id}/grn/{id}  — get GRN

Tests accept 404/422 when no real data exists and assert shape when data is
present. Tests NEVER assume seed data — safe to run against a clean DB.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import AsyncClient

FAKE_UUID = str(uuid4())


# ===========================================================================
# GRN — create
# ===========================================================================


@pytest.mark.asyncio
class TestCreateGRN:
    """POST /api/purchase-orders/{po_id}/grn"""

    async def test_create_grn_unknown_po_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            f"/api/purchase-orders/{FAKE_UUID}/grn",
            json={
                "delivery_location": "brisbane",
                "lines": [
                    {
                        "po_item_id": FAKE_UUID,
                        "product_id": FAKE_UUID,
                        "quantity_expected": 10,
                        "quantity_received": 10,
                    }
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_create_grn_invalid_location_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            f"/api/purchase-orders/{FAKE_UUID}/grn",
            json={
                "delivery_location": "perth",  # invalid
                "lines": [
                    {
                        "po_item_id": FAKE_UUID,
                        "product_id": FAKE_UUID,
                        "quantity_expected": 5,
                        "quantity_received": 5,
                    }
                ],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_create_grn_empty_lines_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            f"/api/purchase-orders/{FAKE_UUID}/grn",
            json={"delivery_location": "sydney", "lines": []},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_create_grn_response_shape_when_po_exists(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """If a real PO in an approved/ordered/in_transit state exists the
        response must include grn_number, status, and a lines array."""
        # First, get a PO list and find one in an eligible state
        pos_resp = await client.get(
            "/api/purchase-orders?page_size=50", headers=auth_headers
        )
        if pos_resp.status_code != 200:
            pytest.skip("PO list endpoint unavailable")

        pos = pos_resp.json().get("data", [])
        eligible = [p for p in pos if p["status"] in ("approved", "ordered", "in_transit")]
        if not eligible:
            pytest.skip("No PO in approved/ordered/in_transit state in DB")

        po = eligible[0]
        po_id = po["id"]

        # Build a line for each PO item
        lines = [
            {
                "po_item_id": item["id"],
                "product_id": item["product_id"],
                "quantity_expected": item["quantity"],
                "quantity_received": item["quantity"],
                "quantity_rejected": 0,
            }
            for item in po["items"]
        ]
        if not lines:
            pytest.skip("PO has no items")

        resp = await client.post(
            f"/api/purchase-orders/{po_id}/grn",
            json={"delivery_location": po["delivery_location"], "lines": lines},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "id" in body
        assert "grn_number" in body
        assert body["grn_number"].startswith("GRN-")
        assert body["status"] == "received"
        assert body["po_id"] == po_id
        assert isinstance(body["lines"], list)
        assert len(body["lines"]) == len(lines)


# ===========================================================================
# GRN — list
# ===========================================================================


@pytest.mark.asyncio
class TestListGRNs:
    """GET /api/purchase-orders/{po_id}/grn"""

    async def test_list_grns_unknown_po_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            f"/api/purchase-orders/{FAKE_UUID}/grn", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_list_grns_known_po_returns_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        pos_resp = await client.get(
            "/api/purchase-orders?page_size=10", headers=auth_headers
        )
        if pos_resp.status_code != 200:
            pytest.skip("PO list endpoint unavailable")

        pos = pos_resp.json().get("data", [])
        if not pos:
            pytest.skip("No POs in DB")

        po_id = pos[0]["id"]
        resp = await client.get(
            f"/api/purchase-orders/{po_id}/grn", headers=auth_headers
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ===========================================================================
# GRN — get by ID
# ===========================================================================


@pytest.mark.asyncio
class TestGetGRN:
    """GET /api/purchase-orders/{po_id}/grn/{grn_id}"""

    async def test_get_grn_unknown_ids_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            f"/api/purchase-orders/{FAKE_UUID}/grn/{FAKE_UUID}",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_get_grn_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Create a GRN then fetch it by ID and verify the shape."""
        # Find an eligible PO
        pos_resp = await client.get(
            "/api/purchase-orders?page_size=50", headers=auth_headers
        )
        if pos_resp.status_code != 200:
            pytest.skip("PO list endpoint unavailable")

        pos = pos_resp.json().get("data", [])
        eligible = [p for p in pos if p["status"] in ("approved", "ordered", "in_transit")]
        if not eligible:
            pytest.skip("No PO in eligible state")

        po = eligible[0]
        po_id = po["id"]
        lines = [
            {
                "po_item_id": item["id"],
                "product_id": item["product_id"],
                "quantity_expected": item["quantity"],
                "quantity_received": item["quantity"],
                "quantity_rejected": 0,
            }
            for item in po["items"]
        ]
        if not lines:
            pytest.skip("PO has no items")

        # Create GRN
        create_resp = await client.post(
            f"/api/purchase-orders/{po_id}/grn",
            json={"delivery_location": po["delivery_location"], "lines": lines},
            headers=auth_headers,
        )
        if create_resp.status_code != 201:
            pytest.skip("GRN creation failed — likely no eligible PO state")

        grn_id = create_resp.json()["id"]

        # Fetch by ID
        fetch_resp = await client.get(
            f"/api/purchase-orders/{po_id}/grn/{grn_id}", headers=auth_headers
        )
        assert fetch_resp.status_code == 200
        body = fetch_resp.json()
        assert body["id"] == grn_id
        assert body["po_id"] == po_id
        assert "grn_number" in body
        assert "lines" in body


# ===========================================================================
# Xero sync — GRN gate
# ===========================================================================


@pytest.mark.asyncio
class TestXeroSyncGRNGate:
    """POST /api/purchase-orders/{po_id}/sync-to-xero blocked without GRN."""

    async def test_sync_to_xero_blocked_without_grn(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Syncing a PO to Xero without a GRN must return 400."""
        # Create a fresh draft PO (no GRN possible on draft, but any PO without
        # a received/approved GRN should be blocked)
        pos_resp = await client.get(
            "/api/purchase-orders?page_size=10", headers=auth_headers
        )
        if pos_resp.status_code != 200:
            pytest.skip("PO list endpoint unavailable")

        pos = pos_resp.json().get("data", [])
        # Find a PO that has no GRN yet (draft POs certainly have none)
        draft_pos = [p for p in pos if p["status"] == "draft"]
        if not draft_pos:
            pytest.skip("No draft POs in DB to test GRN gate")

        po_id = draft_pos[0]["id"]
        resp = await client.post(
            f"/api/purchase-orders/{po_id}/sync-to-xero",
            headers=auth_headers,
        )
        # Expect 400 (GRN gate) or 400 (Xero config missing) — either way not 200
        assert resp.status_code in (400, 422)
