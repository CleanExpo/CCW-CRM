"""
UNI-172 SUB-8: Backend tests for new inventory endpoints.

Covers barcode, stock-take, reorder rules/alerts, product attributes/variants,
auto-reorder, bulk-adjust, active stock-takes, and cycle-count endpoints.

Tests are structural/smoke tests — they do NOT require a live database connection.
Pattern: send invalid/missing body to trigger 422 before DB is touched, or check
that endpoints exist (not 404) accepting that DB-bound GETs may return 5xx.
"""
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes.inventory import router as inventory_router

# Create minimal test app with only the inventory router
test_app = FastAPI()
test_app.include_router(inventory_router)

client = TestClient(test_app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _uid() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# Class 1: Endpoint Existence
# ---------------------------------------------------------------------------


class TestUNI172EndpointExistence:
    """All 21 UNI-172 inventory endpoints must exist (must not return 404)."""

    def test_summary_endpoint_exists(self):
        """GET /api/inventory/summary exists."""
        response = client.get("/api/inventory/summary")
        assert response.status_code != 404, "summary endpoint missing"

    def test_reorder_settings_endpoint_exists(self):
        """PATCH /api/inventory/reorder-settings/{product_id}/{location} exists."""
        openapi = client.get("/openapi.json").json()
        paths = openapi.get("paths", {})
        assert "/api/inventory/reorder-settings/{product_id}/{location}" in paths, "reorder-settings endpoint missing"
        assert "patch" in paths["/api/inventory/reorder-settings/{product_id}/{location}"]

    def test_barcode_lookup_endpoint_exists(self):
        """GET /api/inventory/barcode/{code} exists."""
        openapi = client.get("/openapi.json").json()
        paths = openapi.get("paths", {})
        assert "/api/inventory/barcode/{code}" in paths, "barcode lookup endpoint missing"
        assert "get" in paths["/api/inventory/barcode/{code}"]

    def test_barcode_create_endpoint_exists(self):
        """POST /api/inventory/barcode exists."""
        response = client.post("/api/inventory/barcode", json={})
        assert response.status_code != 404, "barcode create endpoint missing"

    def test_barcode_delete_endpoint_exists(self):
        """DELETE /api/inventory/barcode/{code} exists."""
        openapi = client.get("/openapi.json").json()
        paths = openapi.get("paths", {})
        assert "/api/inventory/barcode/{code}" in paths, "barcode delete endpoint missing"
        assert "delete" in paths["/api/inventory/barcode/{code}"]

    def test_stock_take_create_endpoint_exists(self):
        """POST /api/inventory/stock-take exists."""
        response = client.post("/api/inventory/stock-take", json={})
        assert response.status_code != 404, "stock-take create endpoint missing"

    def test_stock_takes_list_endpoint_exists(self):
        """GET /api/inventory/stock-takes exists."""
        response = client.get("/api/inventory/stock-takes")
        assert response.status_code != 404, "stock-takes list endpoint missing"

    def test_stock_take_submit_endpoint_exists(self):
        """POST /api/inventory/stock-take/{take_id}/submit exists."""
        response = client.post(
            f"/api/inventory/stock-take/{_uid()}/submit",
            json={},
        )
        assert response.status_code != 404, "stock-take submit endpoint missing"

    def test_reorder_rules_list_endpoint_exists(self):
        """GET /api/inventory/reorder-rules exists."""
        response = client.get("/api/inventory/reorder-rules")
        assert response.status_code != 404, "reorder-rules list endpoint missing"

    def test_reorder_rules_create_endpoint_exists(self):
        """POST /api/inventory/reorder-rules exists."""
        response = client.post("/api/inventory/reorder-rules", json={})
        assert response.status_code != 404, "reorder-rules create endpoint missing"

    def test_reorder_alerts_endpoint_exists(self):
        """GET /api/inventory/reorder-alerts exists."""
        response = client.get("/api/inventory/reorder-alerts")
        assert response.status_code != 404, "reorder-alerts endpoint missing"

    def test_product_attributes_list_endpoint_exists(self):
        """GET /api/inventory/products/{product_id}/attributes exists."""
        response = client.get(f"/api/inventory/products/{_uid()}/attributes")
        assert response.status_code != 404, "product attributes list endpoint missing"

    def test_product_attributes_create_endpoint_exists(self):
        """POST /api/inventory/products/{product_id}/attributes exists."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/attributes", json={}
        )
        assert response.status_code != 404, "product attributes create endpoint missing"

    def test_product_attributes_delete_endpoint_exists(self):
        """DELETE /api/inventory/products/{product_id}/attributes/{attribute_id} exists."""
        response = client.delete(
            f"/api/inventory/products/{_uid()}/attributes/{_uid()}"
        )
        assert response.status_code != 404, "product attributes delete endpoint missing"

    def test_product_variants_list_endpoint_exists(self):
        """GET /api/inventory/products/{product_id}/variants exists."""
        response = client.get(f"/api/inventory/products/{_uid()}/variants")
        assert response.status_code != 404, "product variants list endpoint missing"

    def test_product_variants_create_endpoint_exists(self):
        """POST /api/inventory/products/{product_id}/variants exists."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/variants", json={}
        )
        assert response.status_code != 404, "product variants create endpoint missing"

    def test_product_variants_delete_endpoint_exists(self):
        """DELETE /api/inventory/products/{product_id}/variants/{variant_id} exists."""
        response = client.delete(
            f"/api/inventory/products/{_uid()}/variants/{_uid()}"
        )
        assert response.status_code != 404, "product variants delete endpoint missing"

    def test_auto_reorder_endpoint_exists(self):
        """POST /api/inventory/auto-reorder exists."""
        response = client.post("/api/inventory/auto-reorder", json={})
        assert response.status_code != 404, "auto-reorder endpoint missing"

    def test_bulk_adjust_endpoint_exists(self):
        """POST /api/inventory/bulk-adjust exists."""
        response = client.post("/api/inventory/bulk-adjust", json={})
        assert response.status_code != 404, "bulk-adjust endpoint missing"

    def test_stock_takes_active_endpoint_exists(self):
        """GET /api/inventory/stock-takes/active exists."""
        response = client.get("/api/inventory/stock-takes/active")
        assert response.status_code != 404, "stock-takes/active endpoint missing"

    def test_cycle_count_generate_endpoint_exists(self):
        """POST /api/inventory/cycle-count/generate exists."""
        response = client.post("/api/inventory/cycle-count/generate", json={})
        assert response.status_code != 404, "cycle-count/generate endpoint missing"


# ---------------------------------------------------------------------------
# Class 2: Parameter Validation (no DB needed — 422 before DB access)
# ---------------------------------------------------------------------------


class TestUNI172ParameterValidation:
    """Endpoints must return 422 when required fields are missing."""

    def test_reorder_settings_requires_reorder_point(self):
        """PATCH reorder-settings requires reorder_point."""
        response = client.patch(
            f"/api/inventory/reorder-settings/{_uid()}/brisbane",
            json={"reorder_quantity": 20},  # missing reorder_point
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("reorder_point" in f for f in fields)

    def test_reorder_settings_requires_reorder_quantity(self):
        """PATCH reorder-settings requires reorder_quantity."""
        response = client.patch(
            f"/api/inventory/reorder-settings/{_uid()}/brisbane",
            json={"reorder_point": 5},  # missing reorder_quantity
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("reorder_quantity" in f for f in fields)

    def test_barcode_create_requires_product_id(self):
        """POST /barcode requires product_id."""
        response = client.post(
            "/api/inventory/barcode",
            json={"barcode": "1234567890"},  # missing product_id
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("product_id" in f for f in fields)

    def test_barcode_create_requires_barcode_value(self):
        """POST /barcode requires barcode field."""
        response = client.post(
            "/api/inventory/barcode",
            json={"product_id": _uid()},  # missing barcode
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("barcode" in f for f in fields)

    def test_stock_take_create_requires_location(self):
        """POST /stock-take requires location."""
        response = client.post("/api/inventory/stock-take", json={})
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("location" in f for f in fields)

    def test_stock_take_submit_requires_items(self):
        """POST /stock-take/{take_id}/submit requires items list."""
        response = client.post(
            f"/api/inventory/stock-take/{_uid()}/submit", json={}
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("items" in f for f in fields)

    def test_reorder_rules_create_requires_product_id(self):
        """POST /reorder-rules requires product_id."""
        response = client.post(
            "/api/inventory/reorder-rules",
            json={"location": "brisbane"},  # missing product_id
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("product_id" in f for f in fields)

    def test_reorder_rules_create_requires_location(self):
        """POST /reorder-rules requires location."""
        response = client.post(
            "/api/inventory/reorder-rules",
            json={"product_id": _uid()},  # missing location
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("location" in f for f in fields)

    def test_product_attributes_create_requires_key(self):
        """POST /products/{id}/attributes requires key."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/attributes",
            json={"value": "blue"},  # missing key
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("key" in f for f in fields)

    def test_product_attributes_create_requires_value(self):
        """POST /products/{id}/attributes requires value."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/attributes",
            json={"key": "colour"},  # missing value
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("value" in f for f in fields)

    def test_product_variants_create_requires_variant_sku(self):
        """POST /products/{id}/variants requires variant_sku."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/variants",
            json={"name": "Blue Medium"},  # missing variant_sku
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("variant_sku" in f for f in fields)

    def test_product_variants_create_requires_name(self):
        """POST /products/{id}/variants requires name."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/variants",
            json={"variant_sku": "SKU-BLUE-M"},  # missing name
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("name" in f for f in fields)

    def test_auto_reorder_requires_organization_id(self):
        """POST /auto-reorder requires organization_id."""
        response = client.post("/api/inventory/auto-reorder", json={})
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("organization_id" in f for f in fields)

    def test_bulk_adjust_requires_organization_id(self):
        """POST /bulk-adjust requires organization_id."""
        response = client.post("/api/inventory/bulk-adjust", json={})
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("organization_id" in f for f in fields)

    def test_bulk_adjust_requires_adjustments(self):
        """POST /bulk-adjust requires adjustments list."""
        response = client.post(
            "/api/inventory/bulk-adjust",
            json={"organization_id": _uid()},  # missing adjustments
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("adjustments" in f for f in fields)

    def test_stock_takes_active_requires_organization_id(self):
        """GET /stock-takes/active requires organization_id query param."""
        response = client.get("/api/inventory/stock-takes/active")
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("organization_id" in f for f in fields)

    def test_cycle_count_generate_requires_organization_id(self):
        """POST /cycle-count/generate requires organization_id."""
        response = client.post(
            "/api/inventory/cycle-count/generate",
            json={"start_date": "2026-01-01T00:00:00Z"},  # missing organization_id
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("organization_id" in f for f in fields)

    def test_cycle_count_generate_requires_start_date(self):
        """POST /cycle-count/generate requires start_date."""
        response = client.post(
            "/api/inventory/cycle-count/generate",
            json={"organization_id": _uid()},  # missing start_date
        )
        assert response.status_code == 422
        fields = [str(e) for e in response.json()["detail"]]
        assert any("start_date" in f for f in fields)


# ---------------------------------------------------------------------------
# Class 3: Response Model Structure (OpenAPI schema — no DB needed)
# ---------------------------------------------------------------------------


class TestUNI172ResponseModels:
    """Verify response model fields via OpenAPI schema."""

    @pytest.fixture(scope="class")
    def schema(self):
        return test_app.openapi()

    def test_inventory_summary_response_model(self, schema):
        """InventorySummaryResponse has all required fields."""
        model_def = schema["components"]["schemas"]["InventorySummaryResponse"]
        required = model_def.get("required", [])
        assert "total_skus" in required
        assert "total_stock_value" in required
        assert "below_reorder_point" in required
        assert "active_reservations" in required

    def test_auto_reorder_response_model(self, schema):
        """AutoReorderResponse has items, counts, and total_value."""
        model_def = schema["components"]["schemas"]["AutoReorderResponse"]
        required = model_def.get("required", [])
        assert "items" in required
        assert "total_products_checked" in required
        assert "total_pos_created" in required
        assert "total_value" in required

    def test_bulk_adjust_response_model(self, schema):
        """BulkAdjustResponse has results and counts."""
        model_def = schema["components"]["schemas"]["BulkAdjustResponse"]
        required = model_def.get("required", [])
        assert "results" in required
        assert "total_adjusted" in required
        assert "total_failed" in required

    def test_active_stock_takes_response_model(self, schema):
        """ActiveStockTakesResponse has stock_takes list and total."""
        model_def = schema["components"]["schemas"]["ActiveStockTakesResponse"]
        required = model_def.get("required", [])
        assert "stock_takes" in required
        assert "total" in required

    def test_cycle_count_generate_response_model(self, schema):
        """CycleCountGenerateResponse has schedule and ABC counts."""
        model_def = schema["components"]["schemas"]["CycleCountGenerateResponse"]
        required = model_def.get("required", [])
        assert "schedule" in required
        assert "total_products" in required
        assert "a_count" in required
        assert "b_count" in required
        assert "c_count" in required

    def test_active_stock_take_nested_model(self, schema):
        """ActiveStockTake has progress tracking fields."""
        model_def = schema["components"]["schemas"]["ActiveStockTake"]
        required = model_def.get("required", [])
        assert "id" in required
        assert "name" in required
        assert "items_counted" in required
        assert "total_items" in required
        assert "progress_percentage" in required

    def test_auto_reorder_item_model(self, schema):
        """AutoReorderItem has product info and PO creation status."""
        model_def = schema["components"]["schemas"]["AutoReorderItem"]
        required = model_def.get("required", [])
        assert "product_id" in required
        assert "product_name" in required
        assert "current_stock" in required
        assert "reorder_point" in required
        assert "reorder_quantity" in required
        assert "po_created" in required


# ---------------------------------------------------------------------------
# Class 4: Input Validation Boundary Tests
# ---------------------------------------------------------------------------


class TestUNI172InputBoundaryValidation:
    """Validate field-level constraints (min/max, ge/le) for key request models."""

    def test_reorder_settings_point_cannot_be_negative(self):
        """reorder_point must be >= 0."""
        response = client.patch(
            f"/api/inventory/reorder-settings/{_uid()}/brisbane",
            json={"reorder_point": -1, "reorder_quantity": 10},
        )
        assert response.status_code == 422

    def test_reorder_settings_quantity_must_be_at_least_one(self):
        """reorder_quantity must be >= 1."""
        response = client.patch(
            f"/api/inventory/reorder-settings/{_uid()}/brisbane",
            json={"reorder_point": 5, "reorder_quantity": 0},
        )
        assert response.status_code == 422

    def test_stock_take_item_counted_qty_cannot_be_negative(self):
        """StockTakeItemInput.counted_qty must be >= 0."""
        response = client.post(
            f"/api/inventory/stock-take/{_uid()}/submit",
            json={"items": [{"product_id": _uid(), "counted_qty": -5}]},
        )
        assert response.status_code == 422

    def test_product_attribute_key_cannot_be_empty(self):
        """ProductAttributeCreateRequest.key min_length=1."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/attributes",
            json={"key": "", "value": "some value"},
        )
        assert response.status_code == 422

    def test_product_attribute_value_cannot_be_empty(self):
        """ProductAttributeCreateRequest.value min_length=1."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/attributes",
            json={"key": "colour", "value": ""},
        )
        assert response.status_code == 422

    def test_product_variant_sku_cannot_be_empty(self):
        """ProductVariantCreateRequest.variant_sku min_length=1."""
        response = client.post(
            f"/api/inventory/products/{_uid()}/variants",
            json={"variant_sku": "", "name": "Blue"},
        )
        assert response.status_code == 422

    def test_reorder_rule_auto_approve_under_qty_cannot_be_negative(self):
        """ReorderRuleCreateRequest.auto_approve_under_qty ge=0."""
        response = client.post(
            "/api/inventory/reorder-rules",
            json={
                "product_id": _uid(),
                "location": "brisbane",
                "auto_approve_under_qty": -1,
            },
        )
        assert response.status_code == 422

    def test_reorder_rule_lead_time_days_cannot_be_negative(self):
        """ReorderRuleCreateRequest.lead_time_days ge=0."""
        response = client.post(
            "/api/inventory/reorder-rules",
            json={
                "product_id": _uid(),
                "location": "brisbane",
                "lead_time_days": -1,
            },
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Class 5: Summary
# ---------------------------------------------------------------------------


class TestUNI172Summary:
    """Confirm all 21 UNI-172 inventory endpoints are registered."""

    def test_all_uni172_endpoints_registered(self):
        """All 21 UNI-172 inventory endpoints exist in the router OpenAPI schema."""
        openapi = client.get("/openapi.json").json()
        paths = openapi.get("paths", {})

        # (method, path_template) — uses OpenAPI path parameter placeholders
        expected = [
            ("get", "/api/inventory/summary"),
            ("patch", "/api/inventory/reorder-settings/{product_id}/{location}"),
            ("get", "/api/inventory/barcode/{code}"),
            ("post", "/api/inventory/barcode"),
            ("delete", "/api/inventory/barcode/{code}"),
            ("post", "/api/inventory/stock-take"),
            ("get", "/api/inventory/stock-takes"),
            ("post", "/api/inventory/stock-take/{take_id}/submit"),
            ("get", "/api/inventory/reorder-rules"),
            ("post", "/api/inventory/reorder-rules"),
            ("get", "/api/inventory/reorder-alerts"),
            ("get", "/api/inventory/products/{product_id}/attributes"),
            ("post", "/api/inventory/products/{product_id}/attributes"),
            ("delete", "/api/inventory/products/{product_id}/attributes/{attribute_id}"),
            ("get", "/api/inventory/products/{product_id}/variants"),
            ("post", "/api/inventory/products/{product_id}/variants"),
            ("delete", "/api/inventory/products/{product_id}/variants/{variant_id}"),
            ("post", "/api/inventory/auto-reorder"),
            ("post", "/api/inventory/bulk-adjust"),
            ("get", "/api/inventory/stock-takes/active"),
            ("post", "/api/inventory/cycle-count/generate"),
        ]

        missing = []
        for method, path_template in expected:
            if path_template not in paths:
                missing.append(f"{method.upper()} {path_template} (path not found)")
            elif method not in paths[path_template]:
                missing.append(f"{method.upper()} {path_template} (method not registered)")

        assert not missing, f"Missing endpoints: {missing}"
        print(f"All {len(expected)} UNI-172 inventory endpoints are registered.")
