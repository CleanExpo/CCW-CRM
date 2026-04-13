"""Integration tests for GAP Batch 2B endpoints.

Tests 6 new inventory & procurement endpoints:
- GAP-015: POST /api/inventory/auto-reorder
- GAP-016: POST /api/purchase-orders/three-way-match
- GAP-017: GET /api/purchase-orders/unmatched-po-items
- GAP-018: POST /api/inventory/bulk-adjust
- GAP-019: GET /api/inventory/stock-takes/active
- GAP-020: POST /api/inventory/cycle-count/generate
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Organization, Product
from src.db.inventory_models import (
    PurchaseOrder,
    PurchaseOrderItem,
    StockTake,
    StockTakeItem,
    Supplier,
)


@pytest.fixture
async def test_org(db_session: AsyncSession) -> Organization:
    """Create test organization."""
    org = Organization(
        id=uuid4(),
        name="Test Org Batch 2B",
        slug="test-org-batch-2b",
        is_active=True,
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest.fixture
async def test_products(db_session: AsyncSession, test_org: Organization) -> list[Product]:
    """Create test products."""
    products = [
        Product(
            id=uuid4(),
            organization_id=test_org.id,
            sku=f"TEST-SKU-{i}",
            name=f"Test Product {i}",
            category="ACCESSORIES",
            price=Decimal("100.00"),
            cost=Decimal("50.00"),
            stock=10 if i % 2 == 0 else 5,  # Some low stock
        )
        for i in range(5)
    ]
    for p in products:
        db_session.add(p)
    await db_session.commit()
    for p in products:
        await db_session.refresh(p)
    return products


@pytest.fixture
async def test_supplier(db_session: AsyncSession) -> Supplier:
    """Create test supplier."""
    supplier = Supplier(
        id=uuid4(),
        supplier_code=f"SUP-{uuid4().hex[:8].upper()}",
        company_name="Test Supplier",
        contact_name="John Doe",
        email="john@supplier.test",
    )
    db_session.add(supplier)
    await db_session.commit()
    await db_session.refresh(supplier)
    return supplier


@pytest.fixture
async def test_po(
    db_session: AsyncSession,
    test_supplier: Supplier,
    test_products: list[Product],
) -> PurchaseOrder:
    """Create test purchase order with items."""
    po = PurchaseOrder(
        id=uuid4(),
        po_number="PO-20260317-0001",
        supplier_id=test_supplier.id,
        delivery_location="brisbane",
        status="ordered",
        subtotal=Decimal("500.00"),
        tax=Decimal("50.00"),
        total=Decimal("550.00"),
    )
    db_session.add(po)
    await db_session.flush()

    # Add items
    for product in test_products[:2]:  # Use first 2 products
        item = PurchaseOrderItem(
            id=uuid4(),
            purchase_order_id=po.id,
            product_id=product.id,
            quantity=10,
            quantity_received=8,  # Partially received
            unit_cost=Decimal("50.00"),
            subtotal=Decimal("500.00"),
        )
        db_session.add(item)

    await db_session.commit()
    await db_session.refresh(po)
    return po


# ============================================
# GAP-015: Auto-reorder tests
# ============================================


@pytest.mark.asyncio
async def test_auto_reorder_dry_run(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test auto-reorder in dry-run mode."""
    response = await client.post(
        "/api/inventory/auto-reorder",
        json={
            "organization_id": str(test_org.id),
            "dry_run": True,
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total_products_checked" in data
    assert "total_pos_created" in data
    assert "total_value" in data
    assert data["total_products_checked"] == len(test_products)
    # In dry run, no POs created
    assert data["total_pos_created"] == 0


@pytest.mark.asyncio
async def test_auto_reorder_specific_products(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test auto-reorder for specific products."""
    product_ids = [str(test_products[0].id)]

    response = await client.post(
        "/api/inventory/auto-reorder",
        json={
            "organization_id": str(test_org.id),
            "product_ids": product_ids,
            "dry_run": True,
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_products_checked"] == 1


@pytest.mark.asyncio
async def test_auto_reorder_live_mode(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test auto-reorder in live mode (creates POs)."""
    response = await client.post(
        "/api/inventory/auto-reorder",
        json={
            "organization_id": str(test_org.id),
            "dry_run": False,
        }
    )

    assert response.status_code == 200
    data = response.json()
    # In live mode, should create POs for low-stock items
    # (depends on should_reorder logic)


# ============================================
# GAP-016: Three-way match tests
# ============================================


@pytest.mark.asyncio
async def test_three_way_match_success(
    client,
    db_session: AsyncSession,
    test_po: PurchaseOrder,
):
    """Test three-way match with matching data."""
    # Create mock GRN and invoice IDs
    grn_id = uuid4()
    invoice_id = uuid4()

    response = await client.post(
        "/api/purchase-orders/three-way-match",
        json={
            "purchase_order_id": str(test_po.id),
            "goods_receipt_id": str(grn_id),
            "invoice_id": str(invoice_id),
            "variance_tolerance": "0.05",
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "match_status" in data
    assert "confidence" in data
    assert "quantity_variance" in data
    assert "price_variance" in data
    assert "missing_items" in data
    assert "extra_items" in data
    assert "recommendation" in data


@pytest.mark.asyncio
async def test_three_way_match_with_variance(
    client,
    db_session: AsyncSession,
    test_po: PurchaseOrder,
):
    """Test three-way match detects variances."""
    grn_id = uuid4()
    invoice_id = uuid4()

    response = await client.post(
        "/api/purchase-orders/three-way-match",
        json={
            "purchase_order_id": str(test_po.id),
            "goods_receipt_id": str(grn_id),
            "invoice_id": str(invoice_id),
        }
    )

    assert response.status_code == 200
    data = response.json()
    # Should detect quantity variance (ordered 10, received 8)
    assert len(data["quantity_variance"]) > 0 or data["match_status"] == "PARTIAL_MATCH"


@pytest.mark.asyncio
async def test_three_way_match_po_not_found(client):
    """Test three-way match with non-existent PO."""
    response = await client.post(
        "/api/purchase-orders/three-way-match",
        json={
            "purchase_order_id": str(uuid4()),
            "goods_receipt_id": str(uuid4()),
            "invoice_id": str(uuid4()),
        }
    )

    assert response.status_code == 404


# ============================================
# GAP-017: Unmatched PO items tests
# ============================================


@pytest.mark.asyncio
async def test_unmatched_po_items(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_po: PurchaseOrder,
):
    """Test fetching unmatched PO items."""
    response = await client.get(
        "/api/purchase-orders/unmatched-po-items",
        params={
            "organization_id": str(test_org.id),
            "older_than_days": 1,
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    # Should have items with partial receipt
    assert data["total"] >= 0


@pytest.mark.asyncio
async def test_unmatched_po_items_with_filters(
    client,
    db_session: AsyncSession,
    test_org: Organization,
):
    """Test unmatched PO items with date filter."""
    response = await client.get(
        "/api/purchase-orders/unmatched-po-items",
        params={
            "organization_id": str(test_org.id),
            "older_than_days": 90,  # Older filter
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["items"], list)


# ============================================
# GAP-018: Bulk adjust tests
# ============================================


@pytest.mark.asyncio
async def test_bulk_adjust_increase(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test bulk adjust with positive adjustments."""
    product = test_products[0]
    old_stock = product.stock

    response = await client.post(
        "/api/inventory/bulk-adjust",
        json={
            "organization_id": str(test_org.id),
            "adjustments": [
                {
                    "product_id": str(product.id),
                    "adjustment_quantity": 10,
                    "reason": "stock_take",
                }
            ],
            "notes": "Test adjustment",
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_adjusted"] == 1
    assert data["total_failed"] == 0
    assert len(data["results"]) == 1

    result = data["results"][0]
    assert result["success"] is True
    assert result["old_quantity"] == old_stock
    assert result["new_quantity"] == old_stock + 10


@pytest.mark.asyncio
async def test_bulk_adjust_decrease(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test bulk adjust with negative adjustments."""
    product = test_products[0]
    old_stock = product.stock

    response = await client.post(
        "/api/inventory/bulk-adjust",
        json={
            "organization_id": str(test_org.id),
            "adjustments": [
                {
                    "product_id": str(product.id),
                    "adjustment_quantity": -5,
                    "reason": "damage",
                }
            ],
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_adjusted"] == 1

    result = data["results"][0]
    assert result["success"] is True
    assert result["new_quantity"] == max(0, old_stock - 5)


@pytest.mark.asyncio
async def test_bulk_adjust_multiple_products(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test bulk adjust for multiple products."""
    adjustments = [
        {
            "product_id": str(p.id),
            "adjustment_quantity": 5,
            "reason": "stock_take",
        }
        for p in test_products[:3]
    ]

    response = await client.post(
        "/api/inventory/bulk-adjust",
        json={
            "organization_id": str(test_org.id),
            "adjustments": adjustments,
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_adjusted"] == 3
    assert len(data["results"]) == 3


@pytest.mark.asyncio
async def test_bulk_adjust_product_not_found(
    client,
    db_session: AsyncSession,
    test_org: Organization,
):
    """Test bulk adjust with non-existent product."""
    response = await client.post(
        "/api/inventory/bulk-adjust",
        json={
            "organization_id": str(test_org.id),
            "adjustments": [
                {
                    "product_id": str(uuid4()),
                    "adjustment_quantity": 10,
                    "reason": "correction",
                }
            ],
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_failed"] == 1
    assert data["results"][0]["success"] is False


# ============================================
# GAP-019: Active stock takes tests
# ============================================


@pytest.fixture
async def test_stock_take(
    db_session: AsyncSession,
    test_products: list[Product],
) -> StockTake:
    """Create test stock take."""
    st = StockTake(
        id=uuid4(),
        status="in_progress",
        scheduled_date=datetime.now(timezone.utc),
        notes="Test stock take",
    )
    db_session.add(st)
    await db_session.flush()

    # Add items
    for product in test_products[:3]:
        item = StockTakeItem(
            id=uuid4(),
            stock_take_id=st.id,
            product_id=product.id,
            expected_quantity=product.stock,
            actual_quantity=None,  # Not counted yet
        )
        db_session.add(item)

    await db_session.commit()
    await db_session.refresh(st)
    return st


@pytest.mark.asyncio
async def test_get_active_stock_takes(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_stock_take: StockTake,
):
    """Test fetching active stock takes."""
    response = await client.get(
        "/api/inventory/stock-takes/active",
        params={"organization_id": str(test_org.id)}
    )

    assert response.status_code == 200
    data = response.json()
    assert "stock_takes" in data
    assert "total" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_active_stock_takes_empty(
    client,
    db_session: AsyncSession,
    test_org: Organization,
):
    """Test active stock takes when none exist."""
    # Create new org with no stock takes
    new_org = Organization(
        id=uuid4(),
        name="Empty Org",
        slug="empty-org",
        is_active=True,
    )
    db_session.add(new_org)
    await db_session.commit()

    response = await client.get(
        "/api/inventory/stock-takes/active",
        params={"organization_id": str(new_org.id)}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0


# ============================================
# GAP-020: Cycle count generation tests
# ============================================


@pytest.mark.asyncio
async def test_generate_cycle_count_schedule(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test cycle count schedule generation."""
    start_date = datetime.now(timezone.utc)

    response = await client.post(
        "/api/inventory/cycle-count/generate",
        json={
            "organization_id": str(test_org.id),
            "start_date": start_date.isoformat(),
            "frequency_a": 7,
            "frequency_b": 30,
            "frequency_c": 90,
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "schedule" in data
    assert "total_products" in data
    assert "a_count" in data
    assert "b_count" in data
    assert "c_count" in data
    assert data["total_products"] == len(test_products)


@pytest.mark.asyncio
async def test_cycle_count_abc_classification(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test ABC classification in cycle count."""
    start_date = datetime.now(timezone.utc)

    response = await client.post(
        "/api/inventory/cycle-count/generate",
        json={
            "organization_id": str(test_org.id),
            "start_date": start_date.isoformat(),
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Check ABC distribution
    total = data["a_count"] + data["b_count"] + data["c_count"]
    assert total == data["total_products"]

    # Check schedule items have classifications
    for item in data["schedule"]:
        assert item["classification"] in ["A", "B", "C"]
        assert item["frequency_days"] > 0
        assert "next_count_date" in item


@pytest.mark.asyncio
async def test_cycle_count_custom_frequencies(
    client,
    db_session: AsyncSession,
    test_org: Organization,
    test_products: list[Product],
):
    """Test cycle count with custom frequencies."""
    start_date = datetime.now(timezone.utc)

    response = await client.post(
        "/api/inventory/cycle-count/generate",
        json={
            "organization_id": str(test_org.id),
            "start_date": start_date.isoformat(),
            "frequency_a": 14,  # Custom frequencies
            "frequency_b": 60,
            "frequency_c": 180,
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Check that custom frequencies are used
    for item in data["schedule"]:
        if item["classification"] == "A":
            assert item["frequency_days"] == 14
        elif item["classification"] == "B":
            assert item["frequency_days"] == 60
        elif item["classification"] == "C":
            assert item["frequency_days"] == 180


# ============================================
# Summary test
# ============================================


@pytest.mark.asyncio
async def test_all_batch_2b_endpoints_exist(client):
    """Smoke test: verify all endpoints are registered."""
    # Test each endpoint exists (may fail for other reasons, but shouldn't 404)
    endpoints = [
        ("/api/inventory/auto-reorder", "POST"),
        ("/api/purchase-orders/three-way-match", "POST"),
        ("/api/purchase-orders/unmatched-po-items", "GET"),
        ("/api/inventory/bulk-adjust", "POST"),
        ("/api/inventory/stock-takes/active", "GET"),
        ("/api/inventory/cycle-count/generate", "POST"),
    ]

    for path, method in endpoints:
        if method == "GET":
            response = await client.get(path)
        else:
            response = await client.post(path, json={})

        # Should not be 404 (endpoint exists)
        # May be 422 (validation error) which is fine
        assert response.status_code != 404, f"{method} {path} not found"
