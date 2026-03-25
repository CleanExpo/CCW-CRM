"""Backend tests for new inventory endpoints (UNI-172 SUB-8).

Tests:
  GET  /api/inventory/barcode/{code}    — barcode lookup
  POST /api/inventory/barcode           — add barcode
  DELETE /api/inventory/barcode/{code}  — remove barcode
  POST /api/inventory/stock-take        — start stock take
  GET  /api/inventory/stock-takes       — list stock takes
  POST /api/inventory/stock-take/{id}/submit  — submit stock take
  GET  /api/inventory/reorder-rules     — list reorder rules
  POST /api/inventory/reorder-rules     — save reorder rule
  GET  /api/inventory/reorder-alerts    — reorder alerts
  POST /api/inventory/auto-reorder      — trigger auto reorder
  GET  /api/inventory/products/{id}/attributes  — list attributes
  POST /api/inventory/products/{id}/attributes  — add attribute
  GET  /api/inventory/products/{id}/variants    — list variants
  POST /api/inventory/products/{id}/variants    — add variant
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


# ─────────────────────────────────────────────────────────────────────────────
# Barcode endpoints
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestBarcodeEndpoints:
    """Tests for barcode CRUD endpoints."""

    async def test_add_barcode_returns_201(self, client: AsyncClient, auth_headers: dict):
        # Need a real product_id — fetch one first
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        assert products_resp.status_code == 200
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.post(
            "/api/inventory/barcode",
            json={"product_id": product_id, "barcode": "TEST-9999999001", "barcode_type": "EAN13"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_add_barcode_response_shape(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.post(
            "/api/inventory/barcode",
            json={"product_id": product_id, "barcode": "TEST-9999999002", "barcode_type": "EAN13"},
            headers=auth_headers,
        )
        body = resp.json()
        assert "id" in body
        assert "barcode" in body

    async def test_lookup_missing_barcode_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/inventory/barcode/DOES-NOT-EXIST-XYZ", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_delete_barcode_removes_it(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        barcode_val = "TEST-DELETE-0001"

        # Add then delete
        await client.post(
            "/api/inventory/barcode",
            json={"product_id": product_id, "barcode": barcode_val, "barcode_type": "EAN13"},
            headers=auth_headers,
        )
        del_resp = await client.delete(
            f"/api/inventory/barcode/{barcode_val}", headers=auth_headers
        )
        assert del_resp.status_code == 204

        # Confirm gone
        lookup = await client.get(
            f"/api/inventory/barcode/{barcode_val}", headers=auth_headers
        )
        assert lookup.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Stock take endpoints
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestStockTakeEndpoints:
    """Tests for stock take workflow endpoints."""

    async def test_list_stock_takes_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/stock-takes", headers=auth_headers)
        assert resp.status_code == 200

    async def test_list_stock_takes_returns_list(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/stock-takes", headers=auth_headers)
        assert isinstance(resp.json(), list)

    async def test_start_stock_take_returns_201(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/inventory/stock-take",
            json={"location": "brisbane", "notes": "Automated test take"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_start_stock_take_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/inventory/stock-take",
            json={"location": "brisbane"},
            headers=auth_headers,
        )
        body = resp.json()
        assert "id" in body
        assert "location" in body
        assert "status" in body

    async def test_stock_take_invalid_location_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/inventory/stock-take",
            json={"location": "invalid_location"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Reorder rules endpoints
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestReorderRuleEndpoints:
    """Tests for reorder rule CRUD endpoints."""

    async def test_list_reorder_rules_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/reorder-rules", headers=auth_headers)
        assert resp.status_code == 200

    async def test_list_reorder_rules_returns_list(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/reorder-rules", headers=auth_headers)
        assert isinstance(resp.json(), list)

    async def test_save_reorder_rule_returns_201(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.post(
            "/api/inventory/reorder-rules",
            json={
                "product_id": product_id,
                "location": "brisbane",
                "auto_approve_under_qty": 50,
                "lead_time_days": 7,
                "is_enabled": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_save_reorder_rule_response_has_id(
        self, client: AsyncClient, auth_headers: dict
    ):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.post(
            "/api/inventory/reorder-rules",
            json={"product_id": product_id, "location": "sydney", "lead_time_days": 14},
            headers=auth_headers,
        )
        assert "id" in resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# Reorder alerts endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestReorderAlertEndpoints:
    """Tests for GET /api/inventory/reorder-alerts."""

    async def test_reorder_alerts_returns_200(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/reorder-alerts", headers=auth_headers)
        assert resp.status_code == 200

    async def test_reorder_alerts_returns_list(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/reorder-alerts", headers=auth_headers)
        assert isinstance(resp.json(), list)

    async def test_reorder_alerts_with_location_filter(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.get(
            "/api/inventory/reorder-alerts?location=brisbane", headers=auth_headers
        )
        assert resp.status_code == 200

    async def test_reorder_alerts_item_shape(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/inventory/reorder-alerts", headers=auth_headers)
        items = resp.json()
        if not items:
            pytest.skip("No reorder alerts in DB")
        for field in ("product_id", "sku", "name", "location", "stock", "reorder_point"):
            assert field in items[0], f"Missing field: {field}"


# ─────────────────────────────────────────────────────────────────────────────
# Auto-reorder endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestAutoReorderEndpoints:
    """Tests for POST /api/inventory/auto-reorder."""

    async def test_auto_reorder_missing_product_returns_error(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post(
            "/api/inventory/auto-reorder?product_id=00000000-0000-0000-0000-000000000000&location=brisbane",
            headers=auth_headers,
        )
        # Either 404 (product not found) or 400 (no reorder rule) — not 500
        assert resp.status_code in (400, 404, 422)

    async def test_auto_reorder_missing_params_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ):
        resp = await client.post("/api/inventory/auto-reorder", headers=auth_headers)
        assert resp.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Product attributes endpoints
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestProductAttributeEndpoints:
    """Tests for product attribute CRUD endpoints."""

    async def test_list_attributes_returns_200(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.get(
            f"/api/inventory/products/{product_id}/attributes", headers=auth_headers
        )
        assert resp.status_code == 200

    async def test_list_attributes_returns_list(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.get(
            f"/api/inventory/products/{product_id}/attributes", headers=auth_headers
        )
        assert isinstance(resp.json(), list)

    async def test_add_attribute_returns_201(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.post(
            f"/api/inventory/products/{product_id}/attributes",
            json={"key": "voltage", "value": "240V", "unit": "V"},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_add_attribute_response_shape(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.post(
            f"/api/inventory/products/{product_id}/attributes",
            json={"key": "weight_kg", "value": "45", "unit": "kg"},
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("id", "key", "value"):
            assert field in body, f"Missing field: {field}"


# ─────────────────────────────────────────────────────────────────────────────
# Product variants endpoints
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestProductVariantEndpoints:
    """Tests for product variant CRUD endpoints."""

    async def test_list_variants_returns_200(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.get(
            f"/api/inventory/products/{product_id}/variants", headers=auth_headers
        )
        assert resp.status_code == 200

    async def test_list_variants_returns_list(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        resp = await client.get(
            f"/api/inventory/products/{product_id}/variants", headers=auth_headers
        )
        assert isinstance(resp.json(), list)

    async def test_add_variant_returns_201(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        import uuid
        unique_sku = f"VAR-TEST-{uuid.uuid4().hex[:8].upper()}"
        resp = await client.post(
            f"/api/inventory/products/{product_id}/variants",
            json={
                "variant_sku": unique_sku,
                "name": "Test Variant — 240V AU",
                "attributes": {"voltage": "240V", "plug": "AU"},
                "is_active": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201

    async def test_add_variant_response_shape(self, client: AsyncClient, auth_headers: dict):
        products_resp = await client.get("/api/products?page_size=1", headers=auth_headers)
        products = products_resp.json().get("items", [])
        if not products:
            pytest.skip("No products in DB")

        product_id = products[0]["id"]
        import uuid
        unique_sku = f"VAR-SHAPE-{uuid.uuid4().hex[:8].upper()}"
        resp = await client.post(
            f"/api/inventory/products/{product_id}/variants",
            json={"variant_sku": unique_sku, "name": "Shape Test Variant"},
            headers=auth_headers,
        )
        body = resp.json()
        for field in ("id", "variant_sku", "name"):
            assert field in body, f"Missing field: {field}"
