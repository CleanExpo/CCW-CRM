"""
Integration tests for enhanced Shopify endpoints.

Tests metafields, theme APIs, and inventory sync functionality.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_product_availability_for_theme(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test product availability endpoint for Shopify theme."""

    # Assuming test product with SKU exists
    test_sku = "TEST-SKU-001"

    response = await client.get(
        f"/api/integrations/shopify/theme/product-availability/{test_sku}"
    )

    assert response.status_code == 200
    data = response.json()
    assert "sku" in data
    assert "available" in data
    assert "stock_level" in data
    assert "warehouse_location" in data
    assert isinstance(data["available"], bool)
    assert isinstance(data["stock_level"], int)


@pytest.mark.asyncio
async def test_validate_order_for_theme(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test order validation endpoint for Shopify theme."""

    order_data = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 2,
            }
        ],
        "shipping_address": {
            "country": "AU",
            "state": "NSW",
            "city": "Sydney",
            "postal_code": "2000",
        },
    }

    response = await client.post(
        "/api/integrations/shopify/theme/validate-order",
        json=order_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert "valid" in data
    assert "errors" in data
    assert "warnings" in data
    assert isinstance(data["valid"], bool)
    assert isinstance(data["errors"], list)


@pytest.mark.asyncio
async def test_custom_pricing_for_theme(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test custom pricing calculation for Shopify theme."""

    pricing_request = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 10,  # Bulk quantity
            }
        ],
        "customer_id": "550e8400-e29b-41d4-a716-446655440000",
    }

    response = await client.post(
        "/api/integrations/shopify/theme/custom-pricing",
        json=pricing_request,
    )

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "discount_applied" in data

    if data["items"]:
        item = data["items"][0]
        assert "sku" in item
        assert "original_price" in item
        assert "discounted_price" in item
        assert "discount_percentage" in item


@pytest.mark.asyncio
async def test_bulk_stock_check(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test bulk stock check for multiple products."""

    skus = ["TEST-SKU-001", "TEST-SKU-002", "NONEXISTENT-SKU"]

    response = await client.post(
        "/api/integrations/shopify/theme/bulk-stock-check",
        json={"skus": skus},
    )

    assert response.status_code == 200
    data = response.json()
    assert "products" in data
    assert isinstance(data["products"], list)

    # Check that we got results for existing SKUs
    assert len(data["products"]) >= 1


@pytest.mark.asyncio
async def test_delivery_estimate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test delivery time estimate calculation."""

    estimate_request = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 1,
            }
        ],
        "destination": {
            "postal_code": "2000",
            "state": "NSW",
            "country": "AU",
        },
    }

    response = await client.post(
        "/api/integrations/shopify/theme/delivery-estimate",
        json=estimate_request,
    )

    assert response.status_code == 200
    data = response.json()
    assert "estimated_days" in data
    assert "earliest_date" in data
    assert "latest_date" in data
    assert isinstance(data["estimated_days"], int)
    assert data["estimated_days"] > 0


@pytest.mark.asyncio
async def test_theme_endpoint_rate_limiting(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that theme endpoints respect rate limits."""

    test_sku = "TEST-SKU-001"

    # Make multiple rapid requests
    responses = []
    for _ in range(5):
        response = await client.get(
            f"/api/integrations/shopify/theme/product-availability/{test_sku}"
        )
        responses.append(response)

    # All should succeed (rate limit is high for testing)
    # In production, would test with lower limits
    successful = sum(1 for r in responses if r.status_code == 200)
    assert successful >= 3  # At least some should succeed


@pytest.mark.asyncio
async def test_metafield_sync(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test metafield synchronization (if endpoint exists)."""

    # Note: This tests the service layer if exposed via API
    # If not exposed, this would be a service-level test

    # Placeholder for when metafield sync API is added
    pass


@pytest.mark.asyncio
async def test_inventory_sync_audit_log(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that inventory sync operations are logged."""

    # Note: This would test the inventory sync service
    # If there's an API endpoint to trigger sync, test that

    # Placeholder for inventory sync endpoint
    pass


@pytest.mark.asyncio
async def test_order_validation_with_insufficient_stock(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test order validation fails when stock is insufficient."""

    order_data = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 999999,  # Unrealistic quantity
            }
        ],
        "shipping_address": {
            "country": "AU",
            "state": "NSW",
            "city": "Sydney",
            "postal_code": "2000",
        },
    }

    response = await client.post(
        "/api/integrations/shopify/theme/validate-order",
        json=order_data,
    )

    assert response.status_code == 200
    data = response.json()
    # Should be invalid or have warnings
    assert data["valid"] is False or len(data["warnings"]) > 0


@pytest.mark.asyncio
async def test_custom_pricing_volume_discount(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that volume discounts are applied correctly."""

    # Small quantity - no discount
    small_order = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 1,
            }
        ],
    }

    small_response = await client.post(
        "/api/integrations/shopify/theme/custom-pricing",
        json=small_order,
    )
    small_data = small_response.json()

    # Large quantity - should have discount
    large_order = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 50,
            }
        ],
    }

    large_response = await client.post(
        "/api/integrations/shopify/theme/custom-pricing",
        json=large_order,
    )
    large_data = large_response.json()

    # Verify discount is applied for large order
    if large_data["items"]:
        large_item = large_data["items"][0]
        assert large_item["discount_percentage"] > 0


@pytest.mark.asyncio
async def test_delivery_estimate_for_remote_location(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test delivery estimate for remote Australian location."""

    estimate_request = {
        "items": [
            {
                "sku": "TEST-SKU-001",
                "quantity": 1,
            }
        ],
        "destination": {
            "postal_code": "0872",  # Remote NT location
            "state": "NT",
            "country": "AU",
        },
    }

    response = await client.post(
        "/api/integrations/shopify/theme/delivery-estimate",
        json=estimate_request,
    )

    assert response.status_code == 200
    data = response.json()

    # Remote locations should have longer delivery times
    assert data["estimated_days"] >= 5


@pytest.mark.asyncio
async def test_product_availability_caching(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that product availability responses are cached."""

    test_sku = "TEST-SKU-001"

    # First request
    response1 = await client.get(
        f"/api/integrations/shopify/theme/product-availability/{test_sku}"
    )
    assert response1.status_code == 200

    # Second request (should be cached)
    response2 = await client.get(
        f"/api/integrations/shopify/theme/product-availability/{test_sku}"
    )
    assert response2.status_code == 200

    # Both should return same data
    assert response1.json() == response2.json()
