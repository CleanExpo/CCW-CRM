"""
Shopify API Mock Framework for Testing.

Provides configurable mock responses for Shopify API calls with failure simulation.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable
from unittest.mock import AsyncMock

import structlog

logger = structlog.get_logger(__name__)


class ShopifyMockMode(str, Enum):
    """Mock behavior modes."""

    SUCCESS = "success"  # Always return successful responses
    RATE_LIMIT = "rate_limit"  # Simulate rate limiting (429)
    TIMEOUT = "timeout"  # Simulate request timeouts
    SERVER_ERROR = "server_error"  # Simulate server errors (500)
    NOT_FOUND = "not_found"  # Simulate resource not found (404)
    UNAUTHORIZED = "unauthorized"  # Simulate authentication errors (401)
    INTERMITTENT = "intermittent"  # Randomly fail/succeed


@dataclass
class ShopifyMockConfig:
    """Configuration for Shopify mock behavior."""

    mode: ShopifyMockMode = ShopifyMockMode.SUCCESS
    failure_rate: float = 0.3  # For INTERMITTENT mode (0.0-1.0)
    response_delay_ms: int = 0  # Simulated network latency
    rate_limit_delay_ms: int = 1000  # Delay for rate limit responses
    call_tracking: bool = True  # Track API calls for verification


@dataclass
class ShopifyMockCall:
    """Record of a mocked API call."""

    timestamp: datetime
    method: str  # get_orders, get_products, etc.
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    response: Any = None
    error: Exception | None = None


class ShopifyMockClient:
    """
    Mock Shopify API client for testing.

    Features:
    - Configurable success/failure modes
    - Realistic demo data generation
    - API call tracking and verification
    - Failure scenario simulation (rate limits, timeouts, errors)
    - Response customization for specific tests
    """

    def __init__(self, config: ShopifyMockConfig | None = None):
        """
        Initialize mock client.

        Args:
            config: Mock configuration (defaults to SUCCESS mode)
        """
        self.config = config or ShopifyMockConfig()
        self.call_history: list[ShopifyMockCall] = []
        self._call_count = 0
        self._custom_responses: dict[str, Callable] = {}

        logger.info(
            "Shopify mock client initialized",
            mode=self.config.mode.value,
            tracking=self.config.call_tracking,
        )

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        pass

    async def _simulate_network(self) -> None:
        """Simulate network latency."""
        if self.config.response_delay_ms > 0:
            await asyncio.sleep(self.config.response_delay_ms / 1000.0)

    async def _check_mode(self, method_name: str) -> None:
        """
        Check mock mode and raise appropriate exceptions.

        Args:
            method_name: Name of the API method being called

        Raises:
            Exception: Based on configured mode
        """
        self._call_count += 1

        # Store original mode for intermittent
        original_mode = self.config.mode

        # Intermittent failures
        if self.config.mode == ShopifyMockMode.INTERMITTENT:
            import random

            if random.random() < self.config.failure_rate:
                # Randomly choose an error type
                error_mode = random.choice(
                    [
                        ShopifyMockMode.RATE_LIMIT,
                        ShopifyMockMode.TIMEOUT,
                        ShopifyMockMode.SERVER_ERROR,
                    ]
                )
                # Temporarily use error mode
                current_mode = error_mode
            else:
                current_mode = ShopifyMockMode.SUCCESS
        else:
            current_mode = self.config.mode

        # Specific failure modes
        if current_mode == ShopifyMockMode.RATE_LIMIT:
            await asyncio.sleep(self.config.rate_limit_delay_ms / 1000.0)
            error = Exception("Shopify API rate limit exceeded (429)")
            # Track before raising
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == ShopifyMockMode.TIMEOUT:
            await asyncio.sleep(0.1)  # Reduced timeout for testing
            error = TimeoutError("Shopify API request timed out")
            # Track before raising
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == ShopifyMockMode.SERVER_ERROR:
            error = Exception("Shopify API server error (500)")
            # Track before raising
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == ShopifyMockMode.NOT_FOUND:
            error = Exception("Shopify resource not found (404)")
            # Track before raising
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == ShopifyMockMode.UNAUTHORIZED:
            error = Exception("Shopify API authentication failed (401)")
            # Track before raising
            await self._track_call(method_name, (), {}, error=error)
            raise error

    async def _track_call(
        self,
        method: str,
        args: tuple,
        kwargs: dict,
        response: Any = None,
        error: Exception | None = None,
    ) -> None:
        """Track API call for verification."""
        if self.config.call_tracking:
            call = ShopifyMockCall(
                timestamp=datetime.now(),
                method=method,
                args=args,
                kwargs=kwargs,
                response=response,
                error=error,
            )
            self.call_history.append(call)

    def set_custom_response(self, method: str, response_func: Callable) -> None:
        """
        Set custom response for a specific method.

        Args:
            method: Method name (e.g., "get_orders")
            response_func: Function that returns custom response
        """
        self._custom_responses[method] = response_func
        logger.debug("Custom response set", method=method)

    def clear_call_history(self) -> None:
        """Clear call history."""
        self.call_history.clear()
        self._call_count = 0
        logger.debug("Call history cleared")

    def get_call_count(self, method: str | None = None) -> int:
        """
        Get number of calls made.

        Args:
            method: Filter by method name (optional)

        Returns:
            Number of calls
        """
        if method is None:
            return len(self.call_history)
        return sum(1 for call in self.call_history if call.method == method)

    # ============================================================
    # SHOPIFY API METHODS
    # ============================================================

    async def get_shop_info(self) -> dict[str, Any]:
        """Get shop information."""
        await self._simulate_network()
        await self._check_mode("get_shop_info")

        # Check for custom response
        if "get_shop_info" in self._custom_responses:
            response = self._custom_responses["get_shop_info"]()
            await self._track_call("get_shop_info", (), {}, response)
            return response

        # Default mock response
        response = {
            "shop": {
                "id": 123456789,
                "name": "Mock Equipment Store",
                "domain": "mock-store.myshopify.com",
                "email": "mock@ccw.com.au",
                "currency": "AUD",
                "timezone": "Australia/Brisbane",
                "created_at": "2024-01-01T00:00:00+10:00",
            }
        }

        await self._track_call("get_shop_info", (), {}, response)
        return response

    async def get_orders(
        self,
        status: str = "any",
        limit: int = 50,
        since_id: int | None = None,
        created_at_min: str | None = None,
    ) -> dict[str, Any]:
        """Get orders from Shopify."""
        await self._simulate_network()
        await self._check_mode("get_orders")

        kwargs = {
            "status": status,
            "limit": limit,
            "since_id": since_id,
            "created_at_min": created_at_min,
        }

        # Check for custom response
        if "get_orders" in self._custom_responses:
            response = self._custom_responses["get_orders"](**kwargs)
            await self._track_call("get_orders", (), kwargs, response)
            return response

        # Generate mock orders
        orders = []
        for i in range(min(limit, 5)):
            order_id = 1001 + i
            created_at = (datetime.now() - timedelta(days=i)).isoformat()

            orders.append(
                {
                    "id": order_id,
                    "order_number": 1000 + i,
                    "name": f"#{1000 + i}",
                    "created_at": created_at,
                    "financial_status": "paid",
                    "fulfillment_status": "fulfilled",
                    "total_price": f"{219.98 + (i * 22):.2f}",
                    "currency": "AUD",
                }
            )

        response = {"orders": orders}
        await self._track_call("get_orders", (), kwargs, response)
        return response

    async def get_order(self, order_id: int) -> dict[str, Any]:
        """Get single order by ID."""
        await self._simulate_network()
        await self._check_mode("get_order")

        kwargs = {"order_id": order_id}

        # Check for custom response
        if "get_order" in self._custom_responses:
            response = self._custom_responses["get_order"](order_id)
            await self._track_call("get_order", (order_id,), {}, response)
            return response

        # Mock single order
        response = {
            "order": {
                "id": order_id,
                "order_number": order_id,
                "name": f"#{order_id}",
                "created_at": datetime.now().isoformat(),
                "financial_status": "paid",
                "fulfillment_status": "fulfilled",
                "total_price": "219.98",
                "currency": "AUD",
            }
        }

        await self._track_call("get_order", (order_id,), {}, response)
        return response

    async def get_products(
        self,
        limit: int = 50,
        since_id: int | None = None,
        published_status: str = "any",
    ) -> dict[str, Any]:
        """Get products from Shopify."""
        await self._simulate_network()
        await self._check_mode("get_products")

        kwargs = {
            "limit": limit,
            "since_id": since_id,
            "published_status": published_status,
        }

        # Check for custom response
        if "get_products" in self._custom_responses:
            response = self._custom_responses["get_products"](**kwargs)
            await self._track_call("get_products", (), kwargs, response)
            return response

        # Generate mock products
        products = []
        for i in range(min(limit, 5)):
            product_id = 5000 + i

            products.append(
                {
                    "id": product_id,
                    "title": f"Mock Product {i}",
                    "handle": f"mock-product-{i}",
                    "status": "active",
                    "published_at": datetime.now().isoformat(),
                    "created_at": datetime.now().isoformat(),
                    "variants": [
                        {
                            "id": 50000 + i,
                            "product_id": product_id,
                            "title": "Default",
                            "price": f"{99.99 + (i * 10):.2f}",
                            "sku": f"MOCK-SKU-{i:03d}",
                            "inventory_quantity": 100 + i,
                        }
                    ],
                }
            )

        response = {"products": products}
        await self._track_call("get_products", (), kwargs, response)
        return response

    async def get_product(self, product_id: int) -> dict[str, Any]:
        """Get single product by ID."""
        await self._simulate_network()
        await self._check_mode("get_product")

        # Check for custom response
        if "get_product" in self._custom_responses:
            response = self._custom_responses["get_product"](product_id)
            await self._track_call("get_product", (product_id,), {}, response)
            return response

        # Mock single product
        response = {
            "product": {
                "id": product_id,
                "title": f"Mock Product {product_id}",
                "handle": f"mock-product-{product_id}",
                "status": "active",
                "variants": [
                    {
                        "id": 50000 + product_id,
                        "product_id": product_id,
                        "title": "Default",
                        "price": "99.99",
                        "sku": f"MOCK-SKU-{product_id}",
                        "inventory_quantity": 100,
                    }
                ],
            }
        }

        await self._track_call("get_product", (product_id,), {}, response)
        return response

    async def update_inventory_level(
        self,
        inventory_item_id: int,
        location_id: int,
        available: int,
    ) -> dict[str, Any]:
        """Update inventory level."""
        await self._simulate_network()
        await self._check_mode("update_inventory_level")

        kwargs = {
            "inventory_item_id": inventory_item_id,
            "location_id": location_id,
            "available": available,
        }

        # Check for custom response
        if "update_inventory_level" in self._custom_responses:
            response = self._custom_responses["update_inventory_level"](**kwargs)
            await self._track_call("update_inventory_level", (), kwargs, response)
            return response

        # Mock update response
        response = {
            "inventory_level": {
                "inventory_item_id": inventory_item_id,
                "location_id": location_id,
                "available": available,
                "updated_at": datetime.now().isoformat(),
            }
        }

        await self._track_call("update_inventory_level", (), kwargs, response)
        return response

    async def create_webhook(
        self,
        topic: str,
        address: str,
        format: str = "json",
    ) -> dict[str, Any]:
        """Create webhook."""
        await self._simulate_network()
        await self._check_mode("create_webhook")

        kwargs = {"topic": topic, "address": address, "format": format}

        # Check for custom response
        if "create_webhook" in self._custom_responses:
            response = self._custom_responses["create_webhook"](**kwargs)
            await self._track_call("create_webhook", (), kwargs, response)
            return response

        # Mock webhook creation
        response = {
            "webhook": {
                "id": 100 + self._call_count,
                "topic": topic,
                "address": address,
                "format": format,
                "created_at": datetime.now().isoformat(),
            }
        }

        await self._track_call("create_webhook", (), kwargs, response)
        return response


# Factory function for creating mock clients
def create_shopify_mock(
    mode: ShopifyMockMode = ShopifyMockMode.SUCCESS,
    **config_kwargs: Any,
) -> ShopifyMockClient:
    """
    Create a configured Shopify mock client.

    Args:
        mode: Mock behavior mode
        **config_kwargs: Additional config parameters

    Returns:
        Configured ShopifyMockClient
    """
    config = ShopifyMockConfig(mode=mode, **config_kwargs)
    return ShopifyMockClient(config)
