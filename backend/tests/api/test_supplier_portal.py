"""Integration tests for Sprint 4 Supplier Portal endpoints.

Tests:
  GET  /api/supplier-portal/profile
  GET  /api/supplier-portal/purchase-orders
  GET  /api/supplier-portal/purchase-orders/{po_id}
  PUT  /api/supplier-portal/purchase-orders/{po_id}/confirm
  GET  /api/supplier-portal/payment-history

All tests run in demo mode.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestSupplierProfile:
    """Tests for GET /api/supplier-portal/profile."""

    async def test_profile_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/profile", headers=auth_headers)
        assert resp.status_code == 200

    async def test_profile_has_required_fields(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/profile", headers=auth_headers)
        body = resp.json()
        for field in ("supplier_id", "company_name", "contact_name", "email", "payment_terms"):
            assert field in body, f"Missing field: {field}"

    async def test_profile_payment_terms_is_string(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/profile", headers=auth_headers)
        assert isinstance(resp.json()["payment_terms"], str)


@pytest.mark.asyncio
class TestSupplierPurchaseOrders:
    """Tests for purchase order listing and detail."""

    async def test_list_pos_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/purchase-orders", headers=auth_headers)
        assert resp.status_code == 200

    async def test_list_pos_response_shape(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/purchase-orders", headers=auth_headers)
        body = resp.json()
        for field in ("supplier_id", "total", "purchase_orders"):
            assert field in body, f"Missing field: {field}"
        assert isinstance(body["purchase_orders"], list)

    async def test_list_pos_demo_has_items(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/purchase-orders", headers=auth_headers)
        body = resp.json()
        assert body["total"] > 0
        assert len(body["purchase_orders"]) > 0

    async def test_each_po_has_required_fields(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/purchase-orders", headers=auth_headers)
        for po in resp.json()["purchase_orders"]:
            for field in ("po_id", "po_number", "status", "total", "line_items", "required_by"):
                assert field in po, f"PO missing field: {field}"

    async def test_po_has_line_items(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/purchase-orders", headers=auth_headers)
        for po in resp.json()["purchase_orders"]:
            assert len(po["line_items"]) > 0

    async def test_po_detail_returns_200(self, client: AsyncClient, auth_headers: dict):
        list_resp = await client.get("/api/supplier-portal/purchase-orders", headers=auth_headers)
        po_id = list_resp.json()["purchase_orders"][0]["po_id"]
        resp = await client.get(
            f"/api/supplier-portal/purchase-orders/{po_id}", headers=auth_headers
        )
        assert resp.status_code == 200

    async def test_po_detail_not_found_returns_404(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            "/api/supplier-portal/purchase-orders/bad-id", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_status_filter_pending(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            "/api/supplier-portal/purchase-orders?status=pending_confirmation",
            headers=auth_headers,
        )
        body = resp.json()
        assert resp.status_code == 200
        for po in body["purchase_orders"]:
            assert po["status"] == "pending_confirmation"

    async def test_pagination(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            "/api/supplier-portal/purchase-orders?page=1&page_size=1", headers=auth_headers
        )
        body = resp.json()
        assert resp.status_code == 200
        assert len(body["purchase_orders"]) <= 1


@pytest.mark.asyncio
class TestSupplierConfirmDelivery:
    """Tests for PUT /api/supplier-portal/purchase-orders/{id}/confirm."""

    async def _get_pending_po_id(self, client: AsyncClient, auth_headers: dict) -> str:
        resp = await client.get(
            "/api/supplier-portal/purchase-orders?status=pending_confirmation",
            headers=auth_headers,
        )
        orders = resp.json()["purchase_orders"]
        assert orders, "Expected at least one pending_confirmation PO in demo mode"
        return orders[0]["po_id"]

    async def test_confirm_returns_200(self, client: AsyncClient, auth_headers: dict):
        po_id = await self._get_pending_po_id(client, auth_headers)
        resp = await client.put(
            f"/api/supplier-portal/purchase-orders/{po_id}/confirm",
            json={"confirmed_delivery_date": "2026-04-10"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    async def test_confirm_response_has_fields(self, client: AsyncClient, auth_headers: dict):
        po_id = await self._get_pending_po_id(client, auth_headers)
        resp = await client.put(
            f"/api/supplier-portal/purchase-orders/{po_id}/confirm",
            json={"confirmed_delivery_date": "2026-04-10"},
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("po_id", "confirmed_delivery_date", "status", "message"):
            assert field in body, f"Missing field: {field}"

    async def test_confirm_sets_status_confirmed(self, client: AsyncClient, auth_headers: dict):
        po_id = await self._get_pending_po_id(client, auth_headers)
        resp = await client.put(
            f"/api/supplier-portal/purchase-orders/{po_id}/confirm",
            json={"confirmed_delivery_date": "2026-04-15"},
            headers=auth_headers,
        )
        assert resp.json()["status"] == "confirmed"

    async def test_confirm_nonexistent_returns_404(self, client: AsyncClient, auth_headers: dict):
        resp = await client.put(
            "/api/supplier-portal/purchase-orders/bad-id/confirm",
            json={"confirmed_delivery_date": "2026-04-15"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_confirm_delivered_po_returns_400(self, client: AsyncClient, auth_headers: dict):
        # Find a delivered PO
        list_resp = await client.get(
            "/api/supplier-portal/purchase-orders?status=delivered", headers=auth_headers
        )
        orders = list_resp.json()["purchase_orders"]
        if not orders:
            pytest.skip("No delivered POs in demo data")
        delivered_id = orders[0]["po_id"]
        resp = await client.put(
            f"/api/supplier-portal/purchase-orders/{delivered_id}/confirm",
            json={"confirmed_delivery_date": "2026-04-01"},
            headers=auth_headers,
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
class TestSupplierPaymentHistory:
    """Tests for GET /api/supplier-portal/payment-history."""

    async def test_payment_history_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/payment-history", headers=auth_headers)
        assert resp.status_code == 200

    async def test_payment_history_response_shape(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/payment-history", headers=auth_headers)
        body = resp.json()
        for field in ("supplier_id", "total", "total_paid_ytd", "payments"):
            assert field in body, f"Missing field: {field}"

    async def test_payment_history_demo_has_items(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/supplier-portal/payment-history", headers=auth_headers)
        body = resp.json()
        assert body["total"] > 0
        assert body["total_paid_ytd"] > 0

    async def test_each_payment_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/supplier-portal/payment-history", headers=auth_headers)
        for payment in resp.json()["payments"]:
            for field in ("payment_id", "po_number", "amount", "paid_date", "method"):
                assert field in payment, f"Payment missing field: {field}"
