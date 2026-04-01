"""Smoke tests for GAP Batch 2B endpoints (no database required).

Verifies:
1. All 6 endpoints are registered
2. Pydantic models are valid
3. Service integrations are correct
4. Imports work
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI

from src.api.main import app
from src.api.routes import inventory, purchase_orders


def test_endpoints_registered():
    """Verify all 6 GAP Batch 2B endpoints are registered in FastAPI."""
    all_routes = {r.path for r in app.routes}

    gap_endpoints = {
        "GAP-015": "/api/inventory/auto-reorder",
        "GAP-016": "/api/purchase-orders/three-way-match",
        "GAP-017": "/api/purchase-orders/unmatched-po-items",
        "GAP-018": "/api/inventory/bulk-adjust",
        "GAP-019": "/api/inventory/stock-takes/active",
        "GAP-020": "/api/inventory/cycle-count/generate",
    }

    for gap_id, path in gap_endpoints.items():
        assert path in all_routes, f"{gap_id} endpoint {path} not registered"


def test_inventory_routes_count():
    """Verify inventory router has expected number of routes."""
    routes = [r.path for r in inventory.router.routes]
    # Should have at least 4 new endpoints
    assert len(routes) >= 4, f"Expected at least 4 inventory routes, got {len(routes)}"


def test_purchase_orders_routes_count():
    """Verify purchase orders router has expected number of routes."""
    routes = [r.path for r in purchase_orders.router.routes]
    # Should have at least 2 new endpoints
    assert len(routes) >= 2, f"Expected at least 2 PO routes, got {len(routes)}"


def test_pydantic_models_import():
    """Verify all Pydantic request/response models are defined."""
    from src.api.routes.inventory import (
        ActiveStockTake,
        ActiveStockTakesResponse,
        AutoReorderItem,
        AutoReorderRequest,
        AutoReorderResponse,
        BulkAdjustItem,
        BulkAdjustRequest,
        BulkAdjustResponse,
        BulkAdjustResult,
        CycleCountGenerateRequest,
        CycleCountGenerateResponse,
        CycleCountSchedule,
    )
    from src.api.routes.purchase_orders import (
        ThreeWayMatchRequest,
        ThreeWayMatchResponse,
        UnmatchedPOItem,
        UnmatchedPOItemsResponse,
    )

    # If we got here, all models are valid
    assert True


def test_auto_reorder_service_import():
    """Verify auto_reorder service can be imported (GAP-015)."""
    from src.services.auto_reorder import (
        calculate_reorder_quantity,
        should_reorder,
    )

    # Verify pure functions exist
    assert callable(calculate_reorder_quantity)
    assert callable(should_reorder)


def test_procurement_matching_service_import():
    """Verify procurement_matching service can be imported (GAP-016)."""
    from src.services.procurement_matching import (
        GRNItem,
        InvoiceItemData,
        POItem,
        match_po_grn_invoice,
    )

    # Verify pure function and data classes exist
    assert callable(match_po_grn_invoice)


def test_auto_reorder_request_model():
    """Test AutoReorderRequest Pydantic model."""
    from uuid import uuid4

    from src.api.routes.inventory import AutoReorderRequest

    # Valid request
    request = AutoReorderRequest(
        organization_id=uuid4(),
        product_ids=None,
        dry_run=True,
    )
    assert request.dry_run is True
    assert request.product_ids is None

    # With product IDs
    product_id = uuid4()
    request2 = AutoReorderRequest(
        organization_id=uuid4(),
        product_ids=[product_id],
        dry_run=False,
    )
    assert len(request2.product_ids) == 1
    assert request2.dry_run is False


def test_bulk_adjust_request_model():
    """Test BulkAdjustRequest Pydantic model."""
    from uuid import uuid4

    from src.api.routes.inventory import BulkAdjustItem, BulkAdjustRequest

    item = BulkAdjustItem(
        product_id=uuid4(),
        adjustment_quantity=-10,
        reason="damage",
    )

    request = BulkAdjustRequest(
        organization_id=uuid4(),
        adjustments=[item],
        notes="Test adjustment",
    )

    assert len(request.adjustments) == 1
    assert request.adjustments[0].adjustment_quantity == -10
    assert request.adjustments[0].reason == "damage"


def test_three_way_match_request_model():
    """Test ThreeWayMatchRequest Pydantic model."""
    from decimal import Decimal
    from uuid import uuid4

    from src.api.routes.purchase_orders import ThreeWayMatchRequest

    request = ThreeWayMatchRequest(
        purchase_order_id=uuid4(),
        goods_receipt_id=uuid4(),
        invoice_id=uuid4(),
        variance_tolerance=Decimal("0.05"),
    )

    assert request.variance_tolerance == Decimal("0.05")


def test_cycle_count_generate_request_model():
    """Test CycleCountGenerateRequest Pydantic model."""
    from datetime import datetime, timezone
    from uuid import uuid4

    from src.api.routes.inventory import CycleCountGenerateRequest

    request = CycleCountGenerateRequest(
        organization_id=uuid4(),
        start_date=datetime.now(timezone.utc),
        frequency_a=7,
        frequency_b=30,
        frequency_c=90,
    )

    assert request.frequency_a == 7
    assert request.frequency_b == 30
    assert request.frequency_c == 90


def test_endpoint_methods():
    """Verify HTTP methods for each endpoint."""
    endpoints_methods = {
        "/api/inventory/auto-reorder": "POST",
        "/api/purchase-orders/three-way-match": "POST",
        "/api/purchase-orders/unmatched-po-items": "GET",
        "/api/inventory/bulk-adjust": "POST",
        "/api/inventory/stock-takes/active": "GET",
        "/api/inventory/cycle-count/generate": "POST",
    }

    for route in app.routes:
        if route.path in endpoints_methods:
            expected_method = endpoints_methods[route.path]
            assert expected_method in route.methods, \
                f"{route.path} should support {expected_method}, got {route.methods}"


def test_all_imports_work():
    """Comprehensive import test."""
    # Models
    from src.db.demo_models import Organization, Product
    from src.db.inventory_models import (
        PurchaseOrder,
        PurchaseOrderItem,
        StockTake,
        StockTakeItem,
        Supplier,
    )

    # Services
    from src.services.auto_reorder import (
        calculate_reorder_quantity,
        process_auto_reorder,
        should_reorder,
    )
    from src.services.procurement_matching import (
        match_po_grn_invoice,
        match_po_against_invoice,
    )

    # Route modules
    from src.api.routes import inventory, purchase_orders

    # If we got here, all imports succeeded
    assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
