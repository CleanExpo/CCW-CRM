"""Shopify Demo Client.

Mock Shopify API client for testing without making real API calls.
Returns realistic demo data for all operations.
"""

from datetime import datetime, timedelta
from typing import Any


class ShopifyDemoClient:
    """Demo implementation of Shopify API client.

    Returns realistic mock data for testing integration without real API calls.
    """

    def __init__(self) -> None:
        """Initialize demo client."""
        self.shop_domain = "demo-store.myshopify.com"
        self.api_version = "2024-01"

    async def get_shop_info(self) -> dict[str, Any]:
        """Get demo shop information."""
        return {
            "shop": {
                "id": 123456789,
                "name": "Demo Equipment Store",
                "domain": "demo-store.myshopify.com",
                "email": "demo@ccw.com.au",
                "currency": "AUD",
                "timezone": "Australia/Brisbane",
                "iana_timezone": "Australia/Brisbane",
                "phone": "+61 7 1234 5678",
                "address1": "123 Demo Street",
                "city": "Brisbane",
                "province": "Queensland",
                "country_name": "Australia",
                "created_at": "2024-01-01T00:00:00+10:00",
            }
        }

    async def get_orders(
        self,
        status: str = "any",
        limit: int = 50,
        since_id: int | None = None,
        created_at_min: str | None = None,
    ) -> dict[str, Any]:
        """Get demo orders."""
        orders = []
        base_id = 1001

        for i in range(min(limit, 5)):  # Return max 5 demo orders
            order_id = base_id + i
            order_number = 1000 + i
            created_at = (datetime.now() - timedelta(days=i)).isoformat()

            orders.append({
                "id": order_id,
                "admin_graphql_api_id": f"gid://shopify/Order/{order_id}",
                "app_id": None,
                "order_number": order_number,
                "name": f"#{order_number}",
                "created_at": created_at,
                "updated_at": created_at,
                "cancelled_at": None,
                "closed_at": None,
                "processed_at": created_at,
                "customer": {
                    "id": 100 + i,
                    "email": f"customer{i}@demo.com",
                    "first_name": "Customer",
                    "last_name": f"{i}",
                    "phone": f"+61 412 345 {i:03d}",
                },
                "email": f"customer{i}@demo.com",
                "phone": f"+61 412 345 {i:03d}",
                "financial_status": "paid" if i % 2 == 0 else "pending",
                "fulfillment_status": None if i % 3 == 0 else "fulfilled",
                "line_items": [
                    {
                        "id": order_id * 10 + j,
                        "product_id": 5000 + j,
                        "variant_id": 50000 + j,
                        "title": f"Demo Product {j}",
                        "sku": f"DEMO-SKU-{j:03d}",
                        "quantity": 1 + j,
                        "price": f"{99.99 + (j * 10):.2f}",
                        "fulfillment_status": None if i % 3 == 0 else "fulfilled",
                    }
                    for j in range(2)  # 2 line items per order
                ],
                "subtotal_price": f"{199.98 + (i * 20):.2f}",
                "total_tax": f"{20.00 + (i * 2):.2f}",
                "total_price": f"{219.98 + (i * 22):.2f}",
                "currency": "AUD",
                "shipping_address": {
                    "first_name": "Customer",
                    "last_name": f"{i}",
                    "address1": f"{10 + i} Demo Street",
                    "city": "Brisbane",
                    "province": "Queensland",
                    "country": "Australia",
                    "zip": f"400{i}",
                    "phone": f"+61 412 345 {i:03d}",
                },
                "billing_address": {
                    "first_name": "Customer",
                    "last_name": f"{i}",
                    "address1": f"{10 + i} Demo Street",
                    "city": "Brisbane",
                    "province": "Queensland",
                    "country": "Australia",
                    "zip": f"400{i}",
                    "phone": f"+61 412 345 {i:03d}",
                },
                "tags": "demo, online",
                "note": f"Demo order {i}" if i % 2 == 0 else None,
            })

        return {"orders": orders}

    async def get_order(self, order_id: int) -> dict[str, Any]:
        """Get demo order by ID."""
        orders = await self.get_orders(limit=1)
        if orders["orders"]:
            order = orders["orders"][0]
            order["id"] = order_id
            return {"order": order}
        return {"order": None}

    async def get_products(
        self,
        limit: int = 50,
        since_id: int | None = None,
        published_status: str = "any",
    ) -> dict[str, Any]:
        """Get demo products."""
        products = []
        base_id = 6000

        for i in range(min(limit, 10)):  # Return max 10 demo products
            product_id = base_id + i
            products.append({
                "id": product_id,
                "admin_graphql_api_id": f"gid://shopify/Product/{product_id}",
                "title": f"Demo Product {i}",
                "body_html": f"<p>Description for demo product {i}</p>",
                "vendor": "CCW Equipment",
                "product_type": "Equipment",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "published_at": datetime.now().isoformat(),
                "status": "active",
                "tags": "demo, equipment",
                "variants": [
                    {
                        "id": product_id * 10,
                        "product_id": product_id,
                        "title": "Default Title",
                        "sku": f"DEMO-SKU-{i:03d}",
                        "price": f"{99.99 + (i * 10):.2f}",
                        "compare_at_price": f"{119.99 + (i * 10):.2f}",
                        "inventory_management": "shopify",
                        "inventory_quantity": 10 + i,
                        "inventory_item_id": product_id * 100,
                        "weight": 1.5 + (i * 0.5),
                        "weight_unit": "kg",
                    }
                ],
                "options": [
                    {
                        "id": product_id * 5,
                        "product_id": product_id,
                        "name": "Title",
                        "position": 1,
                        "values": ["Default Title"],
                    }
                ],
                "images": [],
            })

        return {"products": products}

    async def update_inventory(
        self,
        inventory_item_id: int,
        location_id: int,
        available: int,
    ) -> dict[str, Any]:
        """Update demo inventory level."""
        return {
            "inventory_level": {
                "inventory_item_id": inventory_item_id,
                "location_id": location_id,
                "available": available,
                "updated_at": datetime.now().isoformat(),
            }
        }

    async def get_inventory_levels(
        self,
        inventory_item_ids: list[int] | None = None,
        location_ids: list[int] | None = None,
    ) -> dict[str, Any]:
        """Get demo inventory levels."""
        inventory_levels = []

        item_ids = inventory_item_ids or [600000, 600001, 600002]
        loc_ids = location_ids or [1]

        for item_id in item_ids:
            for loc_id in loc_ids:
                inventory_levels.append({
                    "inventory_item_id": item_id,
                    "location_id": loc_id,
                    "available": 10 + (item_id % 20),
                    "updated_at": datetime.now().isoformat(),
                })

        return {"inventory_levels": inventory_levels}

    async def get_locations(self) -> dict[str, Any]:
        """Get demo store locations."""
        return {
            "locations": [
                {
                    "id": 1,
                    "name": "Demo Warehouse - Brisbane",
                    "address1": "123 Demo Street",
                    "city": "Brisbane",
                    "province": "Queensland",
                    "country": "Australia",
                    "zip": "4000",
                    "active": True,
                }
            ]
        }

    async def create_product(self, product_data: dict[str, Any]) -> dict[str, Any]:
        """Create demo product."""
        new_id = 7000
        return {
            "product": {
                "id": new_id,
                "admin_graphql_api_id": f"gid://shopify/Product/{new_id}",
                "title": product_data.get("title", "New Product"),
                "body_html": product_data.get("body_html", ""),
                "vendor": product_data.get("vendor", "CCW Equipment"),
                "product_type": product_data.get("product_type", "Equipment"),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "status": "active",
                "variants": [
                    {
                        "id": new_id * 10,
                        "product_id": new_id,
                        "title": "Default Title",
                        "sku": product_data.get("sku", f"NEW-SKU-{new_id}"),
                        "price": product_data.get("price", "99.99"),
                        "inventory_item_id": new_id * 100,
                    }
                ],
            }
        }

    async def update_product(
        self,
        product_id: int,
        product_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update demo product."""
        return {
            "product": {
                "id": product_id,
                "title": product_data.get("title", "Updated Product"),
                "updated_at": datetime.now().isoformat(),
                **product_data,
            }
        }

    async def verify_webhook(self, data: bytes, hmac_header: str) -> bool:
        """Verify demo webhook signature (always returns True in demo mode)."""
        return True
