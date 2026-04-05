"""
Pytest fixtures for Shopify API testing.

Provides reusable mock clients and test data.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""

import pytest

from src.testing.shopify_mock import (
    ShopifyMockClient,
    ShopifyMockConfig,
    ShopifyMockMode,
    create_shopify_mock,
)


@pytest.fixture
def shopify_mock():
    """Basic Shopify mock client in SUCCESS mode."""
    return create_shopify_mock(mode=ShopifyMockMode.SUCCESS)


@pytest.fixture
def shopify_mock_rate_limit():
    """Shopify mock client that simulates rate limiting."""
    return create_shopify_mock(mode=ShopifyMockMode.RATE_LIMIT)


@pytest.fixture
def shopify_mock_timeout():
    """Shopify mock client that simulates timeouts."""
    return create_shopify_mock(mode=ShopifyMockMode.TIMEOUT)


@pytest.fixture
def shopify_mock_server_error():
    """Shopify mock client that simulates server errors."""
    return create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)


@pytest.fixture
def shopify_mock_intermittent():
    """Shopify mock client with intermittent failures."""
    return create_shopify_mock(
        mode=ShopifyMockMode.INTERMITTENT,
        failure_rate=0.5,  # 50% failure rate
    )


@pytest.fixture
def shopify_mock_slow():
    """Shopify mock client with simulated network latency."""
    return create_shopify_mock(
        mode=ShopifyMockMode.SUCCESS,
        response_delay_ms=100,  # 100ms delay
    )


@pytest.fixture
def shopify_mock_with_tracking():
    """Shopify mock client with call tracking enabled."""
    return create_shopify_mock(
        mode=ShopifyMockMode.SUCCESS,
        call_tracking=True,
    )


# Sample test data
@pytest.fixture
def sample_order_data():
    """Sample Shopify order data."""
    return {
        "id": 1001,
        "order_number": 1000,
        "name": "#1000",
        "financial_status": "paid",
        "fulfillment_status": "fulfilled",
        "total_price": "219.98",
        "currency": "AUD",
    }


@pytest.fixture
def sample_product_data():
    """Sample Shopify product data."""
    return {
        "id": 5000,
        "title": "Test Product",
        "handle": "test-product",
        "status": "active",
        "variants": [
            {
                "id": 50000,
                "product_id": 5000,
                "title": "Default",
                "price": "99.99",
                "sku": "TEST-SKU-001",
                "inventory_quantity": 100,
            }
        ],
    }


@pytest.fixture
def sample_shop_data():
    """Sample Shopify shop data."""
    return {
        "id": 123456789,
        "name": "Test Equipment Store",
        "domain": "test-store.myshopify.com",
        "email": "test@ccw.com.au",
        "currency": "AUD",
        "timezone": "Australia/Brisbane",
    }
