"""Shopify API Client.

Provides a unified interface for Shopify Admin API operations.
Automatically routes to demo or live client based on configuration.
"""

import hashlib
import hmac
from typing import Any

import httpx

from src.config.shopify_settings import ShopifySettings, get_shopify_settings
from src.integrations.shopify.demo_client import ShopifyDemoClient


class ShopifyLiveClient:
    """Live Shopify API client using httpx."""

    def __init__(self, settings: ShopifySettings) -> None:
        """Initialize live client with Shopify credentials."""
        self.settings = settings
        self.base_url = settings.admin_api_url

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "X-Shopify-Access-Token": settings.access_token,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.client.aclose()

    async def _request(
        self,
        method: str,
        endpoint: str,
        **kwargs,
    ) -> dict[str, Any]:
        """Make API request to Shopify."""
        try:
            response = await self.client.request(method, endpoint, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text
            raise ValueError(
                f"Shopify API error ({e.response.status_code}): {error_detail}"
            ) from e
        except httpx.RequestError as e:
            raise ValueError(f"Shopify API request failed: {str(e)}") from e

    async def get_shop_info(self) -> dict[str, Any]:
        """Get shop information."""
        return await self._request("GET", "/shop.json")

    async def get_orders(
        self,
        status: str = "any",
        limit: int = 50,
        since_id: int | None = None,
        created_at_min: str | None = None,
    ) -> dict[str, Any]:
        """Get orders from Shopify.

        Args:
            status: Order status filter (any, open, closed, cancelled)
            limit: Number of orders to retrieve (max 250)
            since_id: Restrict results to after specified ID
            created_at_min: Filter orders created after this date (ISO 8601)
        """
        params = {"status": status, "limit": min(limit, 250)}
        if since_id:
            params["since_id"] = since_id
        if created_at_min:
            params["created_at_min"] = created_at_min

        return await self._request("GET", "/orders.json", params=params)

    async def get_order(self, order_id: int) -> dict[str, Any]:
        """Get single order by ID."""
        return await self._request("GET", f"/orders/{order_id}.json")

    async def get_products(
        self,
        limit: int = 50,
        since_id: int | None = None,
        published_status: str = "any",
    ) -> dict[str, Any]:
        """Get products from Shopify.

        Args:
            limit: Number of products to retrieve (max 250)
            since_id: Restrict results to after specified ID
            published_status: Filter by published status (published, unpublished, any)
        """
        params = {"limit": min(limit, 250), "published_status": published_status}
        if since_id:
            params["since_id"] = since_id

        return await self._request("GET", "/products.json", params=params)

    async def create_product(self, product_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new product."""
        return await self._request(
            "POST",
            "/products.json",
            json={"product": product_data},
        )

    async def update_product(
        self,
        product_id: int,
        product_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing product."""
        return await self._request(
            "PUT",
            f"/products/{product_id}.json",
            json={"product": product_data},
        )

    async def get_inventory_levels(
        self,
        inventory_item_ids: list[int] | None = None,
        location_ids: list[int] | None = None,
    ) -> dict[str, Any]:
        """Get inventory levels for items at locations."""
        params = {}
        if inventory_item_ids:
            params["inventory_item_ids"] = ",".join(map(str, inventory_item_ids))
        if location_ids:
            params["location_ids"] = ",".join(map(str, location_ids))

        return await self._request("GET", "/inventory_levels.json", params=params)

    async def update_inventory(
        self,
        inventory_item_id: int,
        location_id: int,
        available: int,
    ) -> dict[str, Any]:
        """Update inventory level for an item at a location.

        Note: Uses the 'set' operation which sets absolute quantity.
        """
        return await self._request(
            "POST",
            "/inventory_levels/set.json",
            json={
                "inventory_item_id": inventory_item_id,
                "location_id": location_id,
                "available": available,
            },
        )

    async def get_locations(self) -> dict[str, Any]:
        """Get all store locations."""
        return await self._request("GET", "/locations.json")

    def verify_webhook(self, data: bytes, hmac_header: str) -> bool:
        """Verify webhook signature from Shopify.

        Args:
            data: Raw request body bytes
            hmac_header: HMAC header from X-Shopify-Hmac-SHA256

        Returns:
            True if signature is valid, False otherwise
        """
        secret = self.settings.webhook_secret.encode("utf-8")
        computed_hmac = hmac.new(secret, data, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed_hmac, hmac_header)

    async def graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute GraphQL query or mutation.

        PHASE 3: Multi-Language Product Sync - Task 3.1
        GraphQL API support for translations and other advanced features.

        Args:
            query: GraphQL query or mutation string
            variables: Optional variables for the query

        Returns:
            GraphQL response data

        Raises:
            ValueError: If GraphQL returns errors
        """
        # Shopify GraphQL endpoint
        graphql_url = f"{self.settings.shop_domain}/admin/api/{self.settings.api_version}/graphql.json"

        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        try:
            response = await self.client.post(
                graphql_url,
                json=payload,
                headers={
                    "X-Shopify-Access-Token": self.settings.access_token,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            result = response.json()

            # Check for GraphQL errors
            if "errors" in result:
                error_messages = [err.get("message", str(err)) for err in result["errors"]]
                raise ValueError(f"GraphQL errors: {', '.join(error_messages)}")

            return result.get("data", {})

        except httpx.HTTPStatusError as e:
            error_detail = e.response.text
            raise ValueError(
                f"Shopify GraphQL API error ({e.response.status_code}): {error_detail}"
            ) from e
        except httpx.RequestError as e:
            raise ValueError(f"Shopify GraphQL request failed: {str(e)}") from e


class ShopifyClient:
    """Unified Shopify client that routes to demo or live implementation."""

    def __init__(self, settings: ShopifySettings | None = None) -> None:
        """Initialize client based on mode setting."""
        self.settings = settings or get_shopify_settings()

        if self.settings.is_demo_mode:
            self._client = ShopifyDemoClient()
        else:
            self._client = ShopifyLiveClient(self.settings)

    async def __aenter__(self):
        """Async context manager entry."""
        if hasattr(self._client, "__aenter__"):
            await self._client.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if hasattr(self._client, "__aexit__"):
            await self._client.__aexit__(exc_type, exc_val, exc_tb)

    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return self.settings.is_demo_mode

    # Delegate all methods to the underlying client
    async def get_shop_info(self) -> dict[str, Any]:
        """Get shop information."""
        return await self._client.get_shop_info()

    async def get_orders(
        self,
        status: str = "any",
        limit: int = 50,
        since_id: int | None = None,
        created_at_min: str | None = None,
    ) -> dict[str, Any]:
        """Get orders."""
        return await self._client.get_orders(status, limit, since_id, created_at_min)

    async def get_order(self, order_id: int) -> dict[str, Any]:
        """Get single order by ID."""
        return await self._client.get_order(order_id)

    async def get_products(
        self,
        limit: int = 50,
        since_id: int | None = None,
        published_status: str = "any",
    ) -> dict[str, Any]:
        """Get products."""
        return await self._client.get_products(limit, since_id, published_status)

    async def create_product(self, product_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new product."""
        return await self._client.create_product(product_data)

    async def update_product(
        self,
        product_id: int,
        product_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing product."""
        return await self._client.update_product(product_id, product_data)

    async def get_inventory_levels(
        self,
        inventory_item_ids: list[int] | None = None,
        location_ids: list[int] | None = None,
    ) -> dict[str, Any]:
        """Get inventory levels."""
        return await self._client.get_inventory_levels(
            inventory_item_ids,
            location_ids,
        )

    async def update_inventory(
        self,
        inventory_item_id: int,
        location_id: int,
        available: int,
    ) -> dict[str, Any]:
        """Update inventory level."""
        return await self._client.update_inventory(
            inventory_item_id,
            location_id,
            available,
        )

    async def get_locations(self) -> dict[str, Any]:
        """Get all store locations."""
        return await self._client.get_locations()

    def verify_webhook(self, data: bytes, hmac_header: str) -> bool:
        """Verify webhook signature."""
        return self._client.verify_webhook(data, hmac_header)

    async def graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute GraphQL query or mutation.

        PHASE 3: Multi-Language Product Sync - Task 3.1
        """
        return await self._client.graphql(query, variables)


def get_shopify_client(settings: ShopifySettings | None = None) -> ShopifyClient:
    """Factory function to get Shopify client instance.

    Args:
        settings: Optional settings instance. Uses global settings if not provided.

    Returns:
        ShopifyClient instance configured for demo or live mode
    """
    return ShopifyClient(settings)
