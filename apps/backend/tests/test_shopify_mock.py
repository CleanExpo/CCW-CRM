"""
Test suite for Shopify API Mock Framework.

Tests the mock client behavior, failure simulation, and call tracking.
Part of Phase 5 (Autonomous Development Framework) - Week 2 tests.
"""

import asyncio

import pytest

from src.testing.shopify_mock import (
    ShopifyMockClient,
    ShopifyMockConfig,
    ShopifyMockMode,
    create_shopify_mock,
)


# ============================================================
# BASIC FUNCTIONALITY TESTS
# ============================================================


class TestShopifyMockBasics:
    """Test basic Shopify mock functionality."""

    @pytest.mark.asyncio
    async def test_mock_client_initialization(self):
        """Test mock client initializes correctly."""
        client = create_shopify_mock()

        assert client.config.mode == ShopifyMockMode.SUCCESS
        assert len(client.call_history) == 0
        assert client._call_count == 0

    @pytest.mark.asyncio
    async def test_get_shop_info_success(self, shopify_mock):
        """Test getting shop info in SUCCESS mode."""
        result = await shopify_mock.get_shop_info()

        assert "shop" in result
        assert result["shop"]["name"] == "Mock Equipment Store"
        assert result["shop"]["currency"] == "AUD"

    @pytest.mark.asyncio
    async def test_get_orders_success(self, shopify_mock):
        """Test getting orders in SUCCESS mode."""
        result = await shopify_mock.get_orders(limit=3)

        assert "orders" in result
        assert len(result["orders"]) <= 3
        assert result["orders"][0]["currency"] == "AUD"

    @pytest.mark.asyncio
    async def test_get_order_success(self, shopify_mock):
        """Test getting single order in SUCCESS mode."""
        result = await shopify_mock.get_order(1001)

        assert "order" in result
        assert result["order"]["id"] == 1001
        assert result["order"]["financial_status"] == "paid"

    @pytest.mark.asyncio
    async def test_get_products_success(self, shopify_mock):
        """Test getting products in SUCCESS mode."""
        result = await shopify_mock.get_products(limit=3)

        assert "products" in result
        assert len(result["products"]) <= 3
        assert "variants" in result["products"][0]

    @pytest.mark.asyncio
    async def test_get_product_success(self, shopify_mock):
        """Test getting single product in SUCCESS mode."""
        result = await shopify_mock.get_product(5000)

        assert "product" in result
        assert result["product"]["id"] == 5000
        assert "variants" in result["product"]

    @pytest.mark.asyncio
    async def test_update_inventory_level_success(self, shopify_mock):
        """Test updating inventory level in SUCCESS mode."""
        result = await shopify_mock.update_inventory_level(
            inventory_item_id=1001,
            location_id=2001,
            available=50,
        )

        assert "inventory_level" in result
        assert result["inventory_level"]["available"] == 50

    @pytest.mark.asyncio
    async def test_create_webhook_success(self, shopify_mock):
        """Test creating webhook in SUCCESS mode."""
        result = await shopify_mock.create_webhook(
            topic="orders/create",
            address="https://example.com/webhook",
        )

        assert "webhook" in result
        assert result["webhook"]["topic"] == "orders/create"


# ============================================================
# FAILURE SIMULATION TESTS
# ============================================================


class TestShopifyMockFailures:
    """Test Shopify mock failure simulation."""

    @pytest.mark.asyncio
    async def test_rate_limit_error(self, shopify_mock_rate_limit):
        """Test rate limit simulation."""
        with pytest.raises(Exception, match="rate limit exceeded"):
            await shopify_mock_rate_limit.get_orders()

    @pytest.mark.asyncio
    async def test_timeout_error(self, shopify_mock_timeout):
        """Test timeout simulation."""
        with pytest.raises(TimeoutError, match="timed out"):
            await shopify_mock_timeout.get_orders()

    @pytest.mark.asyncio
    async def test_server_error(self, shopify_mock_server_error):
        """Test server error simulation."""
        with pytest.raises(Exception, match="server error"):
            await shopify_mock_server_error.get_orders()

    @pytest.mark.asyncio
    async def test_not_found_error(self):
        """Test not found error simulation."""
        client = create_shopify_mock(mode=ShopifyMockMode.NOT_FOUND)

        with pytest.raises(Exception, match="not found"):
            await client.get_order(9999)

    @pytest.mark.asyncio
    async def test_unauthorized_error(self):
        """Test unauthorized error simulation."""
        client = create_shopify_mock(mode=ShopifyMockMode.UNAUTHORIZED)

        with pytest.raises(Exception, match="authentication failed"):
            await client.get_shop_info()

    @pytest.mark.asyncio
    async def test_intermittent_failures(self, shopify_mock_intermittent):
        """Test intermittent failure mode."""
        success_count = 0
        failure_count = 0

        # Make 20 calls
        for _ in range(20):
            try:
                await shopify_mock_intermittent.get_orders()
                success_count += 1
            except Exception:
                failure_count += 1

        # Should have both successes and failures
        assert success_count > 0
        assert failure_count > 0


# ============================================================
# CALL TRACKING TESTS
# ============================================================


class TestShopifyMockTracking:
    """Test Shopify mock call tracking."""

    @pytest.mark.asyncio
    async def test_call_tracking_enabled(self, shopify_mock_with_tracking):
        """Test call tracking records calls."""
        await shopify_mock_with_tracking.get_orders()
        await shopify_mock_with_tracking.get_products()

        assert len(shopify_mock_with_tracking.call_history) == 2
        assert shopify_mock_with_tracking.call_history[0].method == "get_orders"
        assert shopify_mock_with_tracking.call_history[1].method == "get_products"

    @pytest.mark.asyncio
    async def test_get_call_count(self, shopify_mock_with_tracking):
        """Test getting call count."""
        await shopify_mock_with_tracking.get_orders()
        await shopify_mock_with_tracking.get_orders()
        await shopify_mock_with_tracking.get_products()

        total_count = shopify_mock_with_tracking.get_call_count()
        orders_count = shopify_mock_with_tracking.get_call_count("get_orders")
        products_count = shopify_mock_with_tracking.get_call_count("get_products")

        assert total_count == 3
        assert orders_count == 2
        assert products_count == 1

    @pytest.mark.asyncio
    async def test_clear_call_history(self, shopify_mock_with_tracking):
        """Test clearing call history."""
        await shopify_mock_with_tracking.get_orders()
        assert len(shopify_mock_with_tracking.call_history) == 1

        shopify_mock_with_tracking.clear_call_history()

        assert len(shopify_mock_with_tracking.call_history) == 0
        assert shopify_mock_with_tracking._call_count == 0

    @pytest.mark.asyncio
    async def test_call_tracking_records_args(self, shopify_mock_with_tracking):
        """Test call tracking records arguments."""
        await shopify_mock_with_tracking.get_orders(status="open", limit=10)

        call = shopify_mock_with_tracking.call_history[0]
        assert call.kwargs["status"] == "open"
        assert call.kwargs["limit"] == 10

    @pytest.mark.asyncio
    async def test_call_tracking_records_response(self, shopify_mock_with_tracking):
        """Test call tracking records response."""
        await shopify_mock_with_tracking.get_shop_info()

        call = shopify_mock_with_tracking.call_history[0]
        assert call.response is not None
        assert "shop" in call.response

    @pytest.mark.asyncio
    async def test_call_tracking_records_errors(self):
        """Test call tracking records errors."""
        client = create_shopify_mock(
            mode=ShopifyMockMode.SERVER_ERROR,
            call_tracking=True,
        )

        try:
            await client.get_orders()
        except Exception:
            pass

        call = client.call_history[0]
        assert call.error is not None


# ============================================================
# CUSTOM RESPONSE TESTS
# ============================================================


class TestShopifyMockCustomResponses:
    """Test custom response configuration."""

    @pytest.mark.asyncio
    async def test_set_custom_response(self, shopify_mock):
        """Test setting custom response for a method."""

        def custom_shop_info():
            return {"shop": {"name": "Custom Shop", "id": 999}}

        shopify_mock.set_custom_response("get_shop_info", custom_shop_info)

        result = await shopify_mock.get_shop_info()

        assert result["shop"]["name"] == "Custom Shop"
        assert result["shop"]["id"] == 999

    @pytest.mark.asyncio
    async def test_custom_response_with_args(self, shopify_mock):
        """Test custom response that uses arguments."""

        def custom_get_order(order_id):
            return {"order": {"id": order_id, "custom": True}}

        shopify_mock.set_custom_response("get_order", custom_get_order)

        result = await shopify_mock.get_order(12345)

        assert result["order"]["id"] == 12345
        assert result["order"]["custom"] is True

    @pytest.mark.asyncio
    async def test_custom_response_with_kwargs(self, shopify_mock):
        """Test custom response that uses keyword arguments."""

        def custom_get_orders(status="any", limit=50, **kwargs):
            return {
                "orders": [
                    {"id": i, "status": status} for i in range(min(limit, 3))
                ]
            }

        shopify_mock.set_custom_response("get_orders", custom_get_orders)

        result = await shopify_mock.get_orders(status="open", limit=2)

        assert len(result["orders"]) == 2
        assert all(order["status"] == "open" for order in result["orders"])


# ============================================================
# NETWORK SIMULATION TESTS
# ============================================================


class TestShopifyMockNetworkSimulation:
    """Test network behavior simulation."""

    @pytest.mark.asyncio
    async def test_response_delay(self, shopify_mock_slow):
        """Test response delay simulation."""
        import time

        start = time.time()
        await shopify_mock_slow.get_orders()
        elapsed = time.time() - start

        # Should take at least 100ms
        assert elapsed >= 0.1

    @pytest.mark.asyncio
    async def test_rate_limit_delay(self):
        """Test rate limit delay."""
        client = create_shopify_mock(
            mode=ShopifyMockMode.RATE_LIMIT,
            rate_limit_delay_ms=500,
        )

        import time

        start = time.time()
        try:
            await client.get_orders()
        except Exception:
            pass
        elapsed = time.time() - start

        # Should take at least 500ms
        assert elapsed >= 0.5


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestShopifyMockIntegration:
    """Integration tests for Shopify mock with circuit breakers."""

    @pytest.mark.asyncio
    async def test_mock_with_circuit_breaker(self):
        """Test Shopify mock with circuit breaker protection."""
        from src.services.circuit_breaker import CircuitBreakerManager

        manager = CircuitBreakerManager()
        manager.reset_all()

        # Create client that always fails
        client = create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)

        # Make 5 calls through circuit breaker
        failures = 0
        for _ in range(5):
            try:
                await manager.protect("shopify-api", client.get_orders)
            except Exception:
                failures += 1

        # All calls should have failed
        assert failures == 5

        # Circuit should be open
        breaker = manager.get_breaker("shopify-api")
        from src.services.circuit_breaker import CircuitState

        assert breaker.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_mock_with_retry_logic(self):
        """Test Shopify mock with retry logic."""
        client = create_shopify_mock(
            mode=ShopifyMockMode.INTERMITTENT,
            failure_rate=0.3,  # 30% failure rate for better test reliability
        )

        # Retry up to 10 times (with 30% failure, very likely to succeed within 10 tries)
        max_retries = 10
        success = False
        for attempt in range(max_retries):
            try:
                result = await client.get_orders()
                # Success!
                assert "orders" in result
                success = True
                break
            except Exception:
                # Retry
                await asyncio.sleep(0.01)

        # Should eventually succeed
        assert success, "Should have succeeded within retries"

    @pytest.mark.asyncio
    async def test_mock_call_count_verification(self, shopify_mock_with_tracking):
        """Test verifying number of API calls made."""
        # Simulate a workflow
        await shopify_mock_with_tracking.get_shop_info()
        await shopify_mock_with_tracking.get_products(limit=10)
        await shopify_mock_with_tracking.get_orders(limit=5)

        # Verify expected calls were made
        assert shopify_mock_with_tracking.get_call_count() == 3
        assert shopify_mock_with_tracking.get_call_count("get_shop_info") == 1
        assert shopify_mock_with_tracking.get_call_count("get_products") == 1
        assert shopify_mock_with_tracking.get_call_count("get_orders") == 1

    @pytest.mark.asyncio
    async def test_mock_with_deployment_scenario(self):
        """Test Shopify mock in deployment scenario."""
        # Deployment starts with inventory sync
        client = create_shopify_mock(call_tracking=True)

        # Step 1: Get products
        products = await client.get_products()
        assert len(products["products"]) > 0

        # Step 2: Update inventory for each product
        for product in products["products"][:3]:
            await client.update_inventory_level(
                inventory_item_id=product["id"],
                location_id=1,
                available=100,
            )

        # Step 3: Verify webhook
        await client.create_webhook(
            topic="inventory_levels/update",
            address="https://erp.ccw.com.au/webhooks/shopify",
        )

        # Verify all operations were tracked
        assert client.get_call_count() == 5  # 1 get_products + 3 updates + 1 webhook
        assert client.get_call_count("update_inventory_level") == 3
