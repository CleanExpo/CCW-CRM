"""Integration tests for Sprint 4 Customer Portal endpoints.

Tests:
  GET  /api/portal/profile
  GET  /api/portal/orders
  GET  /api/portal/orders/{order_id}
  GET  /api/portal/invoices
  GET  /api/portal/invoices/{invoice_id}
  GET  /api/portal/certifications
  POST /api/portal/service-requests
  GET  /api/portal/service-requests

All tests run in demo mode (no external auth required).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestPortalProfile:
    """Tests for GET /api/portal/profile."""

    async def test_profile_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/profile", headers=auth_headers)
        assert resp.status_code == 200

    async def test_profile_has_required_fields(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/profile", headers=auth_headers)
        body = resp.json()
        for field in ("customer_id", "company_name", "contact_name", "email", "pricing_tier"):
            assert field in body, f"Missing field: {field}"

    async def test_profile_has_australian_content(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/profile", headers=auth_headers)
        body = resp.json()
        # Demo data is an Australian company
        assert "Pty Ltd" in body["company_name"] or "Pty" in body["company_name"]


@pytest.mark.asyncio
class TestPortalOrders:
    """Tests for GET /api/portal/orders and /api/portal/orders/{order_id}."""

    async def test_orders_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders", headers=auth_headers)
        assert resp.status_code == 200

    async def test_orders_response_shape(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders", headers=auth_headers)
        body = resp.json()
        for field in ("customer_id", "total", "orders"):
            assert field in body, f"Missing field: {field}"
        assert isinstance(body["orders"], list)

    async def test_orders_demo_has_items(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders", headers=auth_headers)
        body = resp.json()
        assert body["total"] > 0
        assert len(body["orders"]) > 0

    async def test_each_order_has_required_fields(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders", headers=auth_headers)
        orders = resp.json()["orders"]
        for order in orders:
            for field in ("order_id", "order_number", "date", "status", "total", "items"):
                assert field in order, f"Order missing field: {field}"

    async def test_order_detail_returns_200(self, client: AsyncClient, auth_headers: dict):
        # Get first order ID
        orders_resp = await client.get("/api/portal/orders", headers=auth_headers)
        order_id = orders_resp.json()["orders"][0]["order_id"]
        resp = await client.get(f"/api/portal/orders/{order_id}", headers=auth_headers)
        assert resp.status_code == 200

    async def test_order_detail_has_line_items(self, client: AsyncClient, auth_headers: dict):
        orders_resp = await client.get("/api/portal/orders", headers=auth_headers)
        order_id = orders_resp.json()["orders"][0]["order_id"]
        resp = await client.get(f"/api/portal/orders/{order_id}", headers=auth_headers)
        body = resp.json()
        assert "items" in body
        assert len(body["items"]) > 0

    async def test_order_not_found_returns_404(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    async def test_orders_status_filter(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders?status=delivered", headers=auth_headers)
        body = resp.json()
        assert resp.status_code == 200
        for order in body["orders"]:
            assert order["status"] == "delivered"

    async def test_orders_pagination(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/orders?page=1&page_size=1", headers=auth_headers)
        body = resp.json()
        assert resp.status_code == 200
        assert len(body["orders"]) <= 1


@pytest.mark.asyncio
class TestPortalInvoices:
    """Tests for GET /api/portal/invoices and /api/portal/invoices/{id}."""

    async def test_invoices_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/invoices", headers=auth_headers)
        assert resp.status_code == 200

    async def test_invoices_response_shape(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/invoices", headers=auth_headers)
        body = resp.json()
        for field in ("customer_id", "total", "total_outstanding", "invoices"):
            assert field in body, f"Missing field: {field}"

    async def test_invoices_demo_has_items(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/invoices", headers=auth_headers)
        body = resp.json()
        assert body["total"] > 0

    async def test_each_invoice_has_gst(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/invoices", headers=auth_headers)
        for inv in resp.json()["invoices"]:
            assert "gst" in inv
            assert inv["gst"] > 0, "Demo invoices should have GST"

    async def test_invoice_detail_returns_200(self, client: AsyncClient, auth_headers: dict):
        invoices_resp = await client.get("/api/portal/invoices", headers=auth_headers)
        inv_id = invoices_resp.json()["invoices"][0]["invoice_id"]
        resp = await client.get(f"/api/portal/invoices/{inv_id}", headers=auth_headers)
        assert resp.status_code == 200

    async def test_invoice_not_found_returns_404(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/invoices/bad-id", headers=auth_headers)
        assert resp.status_code == 404

    async def test_invoice_status_filter(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/invoices?status=paid", headers=auth_headers)
        for inv in resp.json()["invoices"]:
            assert inv["status"] == "paid"


@pytest.mark.asyncio
class TestPortalCertifications:
    """Tests for GET /api/portal/certifications."""

    async def test_certifications_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/certifications", headers=auth_headers)
        assert resp.status_code == 200

    async def test_certifications_response_shape(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/portal/certifications", headers=auth_headers)
        body = resp.json()
        for field in (
            "customer_id",
            "total",
            "active_count",
            "expired_count",
            "expiring_soon_count",
            "certifications",
        ):
            assert field in body, f"Missing field: {field}"

    async def test_certifications_demo_has_iicrc_data(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/portal/certifications", headers=auth_headers)
        body = resp.json()
        assert body["total"] > 0
        certs = body["certifications"]
        # Demo should include IICRC cert types
        cert_types = [c["cert_type"] for c in certs]
        assert any("IICRC" in ct for ct in cert_types)

    async def test_certifications_have_expiry_dates(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get("/api/portal/certifications", headers=auth_headers)
        for cert in resp.json()["certifications"]:
            assert "expiry_date" in cert
            assert "days_until_expiry" in cert


@pytest.mark.asyncio
class TestPortalServiceRequests:
    """Tests for POST and GET /api/portal/service-requests."""

    async def test_create_service_request_returns_201(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/portal/service-requests",
            json={
                "request_type": "warranty_claim",
                "description": "TruckMount Pro 570 — water pump failed after 3 months",
                "order_id": "ord-demo-001",
                "product_sku": "TM-PRO-570",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_create_service_request_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/portal/service-requests",
            json={"request_type": "service_booking", "description": "Annual service due"},
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("request_id", "reference_number", "status", "message", "created_at"):
            assert field in body, f"Missing field: {field}"

    async def test_create_service_request_invalid_type_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/portal/service-requests",
            json={"request_type": "invalid_type", "description": "Something"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_list_service_requests_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ):
        # Seed a request first
        await client.post(
            "/api/portal/service-requests",
            json={"request_type": "general_inquiry", "description": "Stock availability question"},
            headers=auth_headers,
        )
        resp = await client.get("/api/portal/service-requests", headers=auth_headers)
        assert resp.status_code == 200

    async def test_list_service_requests_contains_created(
        self, client: AsyncClient, auth_headers: dict
    ):
        await client.post(
            "/api/portal/service-requests",
            json={"request_type": "warranty_claim", "description": "Unique test request XYZ"},
            headers=auth_headers,
        )
        resp = await client.get("/api/portal/service-requests", headers=auth_headers)
        body = resp.json()
        assert body["total"] >= 1
        descriptions = [r["description"] for r in body["requests"]]
        assert any("Unique test request XYZ" in d for d in descriptions)
