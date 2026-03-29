"""Shopify marketplace channel implementation.

Wraps the existing Shopify integration into the BaseMarketplaceChannel abstraction,
enabling unified multi-channel sync via the SyncEngine and registry.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
import structlog

from .base import BaseMarketplaceChannel, ChannelOrder, ChannelProduct, ConnectionResult
from .registry import register_channel

logger = structlog.get_logger(__name__)


@register_channel
class ShopifyChannel(BaseMarketplaceChannel):
    """Shopify marketplace channel backed by the Shopify Admin REST API.

    Credentials expected in connect():
        shop_domain  — e.g. "mystore.myshopify.com"
        access_token — Shopify Admin API access token
    """

    channel_type = "shopify"
    display_name = "Shopify"

    def __init__(self) -> None:
        self._shop_domain: str | None = None
        self._access_token: str | None = None
        self._connected: bool = False
        self._client: httpx.AsyncClient | None = None

    # ── helpers ──────────────────────────────────────────────────────────

    def _make_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=f"https://{self._shop_domain}/admin/api/2024-01",
            headers={
                "X-Shopify-Access-Token": self._access_token or "",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("ShopifyChannel not connected")
        r = await self._client.get(path, params=params or {})
        r.raise_for_status()
        return dict(r.json())

    async def _post(self, path: str, json: dict) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("ShopifyChannel not connected")
        r = await self._client.post(path, json=json)
        r.raise_for_status()
        return dict(r.json())

    async def _put(self, path: str, json: dict) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("ShopifyChannel not connected")
        r = await self._client.put(path, json=json)
        r.raise_for_status()
        return dict(r.json())

    async def _delete(self, path: str) -> None:
        if not self._client:
            raise RuntimeError("ShopifyChannel not connected")
        r = await self._client.delete(path)
        r.raise_for_status()

    # ── BaseMarketplaceChannel interface ─────────────────────────────────

    async def connect(self, credentials: dict) -> ConnectionResult:
        shop_domain = credentials.get("shop_domain", "").strip().rstrip("/")
        access_token = credentials.get("access_token", "").strip()

        if not shop_domain or not access_token:
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message="shop_domain and access_token are required",
            )

        self._shop_domain = shop_domain
        self._access_token = access_token
        self._client = self._make_client()

        result = await self.test_connection()
        if result.success:
            self._connected = True
        return result

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
        self._connected = False
        self._shop_domain = None
        self._access_token = None

    async def test_connection(self) -> ConnectionResult:
        try:
            data = await self._get("/shop.json")
            shop = data.get("shop", {})
            return ConnectionResult(
                success=True,
                channel_type=self.channel_type,
                message=f"Connected to {shop.get('name', self._shop_domain)}",
                metadata={
                    "shop_name": shop.get("name"),
                    "shop_email": shop.get("email"),
                    "currency": shop.get("currency", "AUD"),
                    "plan": shop.get("plan_display_name"),
                },
            )
        except Exception as exc:
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message=f"Connection failed: {exc}",
            )

    async def list_products(self, limit: int = 50, offset: int = 0) -> list[ChannelProduct]:
        page = (offset // limit) + 1 if limit else 1
        data = await self._get("/products.json", params={"limit": min(limit, 250), "page": page})
        products: list[ChannelProduct] = []
        for p in data.get("products", []):
            variant = p.get("variants", [{}])[0] if p.get("variants") else {}
            images = [img.get("src", "") for img in p.get("images", []) if img.get("src")]
            products.append(
                ChannelProduct(
                    external_id=str(p["id"]),
                    title=p.get("title", ""),
                    sku=variant.get("sku"),
                    description=p.get("body_html"),
                    price=float(variant.get("price", 0)),
                    currency="AUD",
                    quantity=int(variant.get("inventory_quantity", 0)),
                    images=images,
                    url=f"https://{self._shop_domain}/products/{p.get('handle', '')}",
                    status=p.get("status", "active"),
                    category=p.get("product_type"),
                    variant_id=str(variant.get("id", "")),
                    raw_data=p,
                )
            )
        return products

    async def push_product(self, product: dict) -> str:
        payload = {
            "product": {
                "title": product.get("name", product.get("title", "")),
                "body_html": product.get("description", ""),
                "product_type": product.get("category", ""),
                "status": "active",
                "variants": [
                    {
                        "sku": product.get("sku", ""),
                        "price": str(product.get("price", 0)),
                        "inventory_quantity": product.get("quantity", 0),
                        "inventory_management": "shopify",
                    }
                ],
            }
        }
        data = await self._post("/products.json", json=payload)
        return str(data["product"]["id"])

    async def update_product(self, external_id: str, product: dict) -> None:
        payload = {
            "product": {
                "id": external_id,
                "title": product.get("name", product.get("title", "")),
                "body_html": product.get("description", ""),
                "variants": [
                    {
                        "sku": product.get("sku", ""),
                        "price": str(product.get("price", 0)),
                    }
                ],
            }
        }
        await self._put(f"/products/{external_id}.json", json=payload)

    async def delete_product(self, external_id: str) -> None:
        await self._delete(f"/products/{external_id}.json")

    async def sync_inventory(self, external_id: str, quantity: int) -> None:
        # Get the inventory item ID from the product variant
        try:
            data = await self._get(f"/products/{external_id}.json")
            variants = data.get("product", {}).get("variants", [])
            if not variants:
                logger.warning("shopify_sync_inventory_no_variants", product_id=external_id)
                return
            inventory_item_id = variants[0].get("inventory_item_id")
            if not inventory_item_id:
                return

            # Get location ID
            locations = await self._get("/locations.json")
            location_id = locations.get("locations", [{}])[0].get("id") if locations.get("locations") else None
            if not location_id:
                logger.warning("shopify_sync_inventory_no_location", product_id=external_id)
                return

            # Set inventory level
            await self._post(
                "/inventory_levels/set.json",
                json={
                    "location_id": location_id,
                    "inventory_item_id": inventory_item_id,
                    "available": quantity,
                },
            )
        except Exception as exc:
            logger.error("shopify_sync_inventory_failed", product_id=external_id, error=str(exc))

    async def pull_orders(self, since: datetime | None = None) -> list[ChannelOrder]:
        params: dict = {"status": "any", "limit": 50}
        if since:
            params["created_at_min"] = since.isoformat()

        data = await self._get("/orders.json", params=params)
        orders: list[ChannelOrder] = []
        for o in data.get("orders", []):
            customer = o.get("customer") or {}
            name = " ".join(
                filter(None, [customer.get("first_name"), customer.get("last_name")])
            ) or o.get("contact_email", "")
            line_items = [
                {
                    "title": li.get("title", ""),
                    "sku": li.get("sku"),
                    "quantity": li.get("quantity", 1),
                    "price": float(li.get("price", 0)),
                }
                for li in o.get("line_items", [])
            ]
            shipping = o.get("shipping_address") or {}
            created_str = o.get("created_at")
            ordered_at = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if created_str else None

            orders.append(
                ChannelOrder(
                    external_id=str(o["id"]),
                    external_order_number=o.get("order_number") and str(o["order_number"]),
                    customer_name=name or None,
                    customer_email=o.get("email") or customer.get("email"),
                    total_amount=float(o.get("total_price", 0)),
                    currency=o.get("currency", "AUD"),
                    status=o.get("financial_status", "pending"),
                    line_items=line_items,
                    shipping_address={
                        "name": shipping.get("name"),
                        "address1": shipping.get("address1"),
                        "city": shipping.get("city"),
                        "province": shipping.get("province"),
                        "zip": shipping.get("zip"),
                        "country": shipping.get("country_code"),
                    },
                    ordered_at=ordered_at,
                    raw_data=o,
                )
            )
        return orders

    async def update_order_status(self, external_id: str, status: str) -> None:
        # Map generic statuses to Shopify fulfillment actions
        if status in ("shipped", "fulfilled"):
            await self._post(
                f"/orders/{external_id}/fulfillments.json",
                json={"fulfillment": {"notify_customer": False}},
            )
        elif status == "cancelled":
            await self._post(
                f"/orders/{external_id}/cancel.json",
                json={},
            )
        else:
            logger.info(
                "shopify_update_order_status_skipped",
                order_id=external_id,
                status=status,
            )

    def get_setup_fields(self) -> list[dict]:
        return [
            {
                "key": "shop_domain",
                "label": "Shop Domain",
                "type": "text",
                "required": True,
                "placeholder": "mystore.myshopify.com",
            },
            {
                "key": "access_token",
                "label": "Admin API Access Token",
                "type": "password",
                "required": True,
                "placeholder": "shpat_...",
            },
        ]
