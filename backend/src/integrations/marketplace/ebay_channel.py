"""eBay marketplace channel implementation.

Uses eBay's Inventory API (v1) and Fulfillment API (v1) via OAuth 2.0 client credentials.
Supports sandbox and production environments.

Credentials expected in connect():
    client_id     — eBay App Client ID (Application ID)
    client_secret — eBay Cert ID (Client Secret)
    environment   — "sandbox" | "production" (default: "sandbox")
"""

from __future__ import annotations

import base64
from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

from .base import BaseMarketplaceChannel, ChannelOrder, ChannelProduct, ConnectionResult
from .registry import register_channel

logger = structlog.get_logger(__name__)

_SANDBOX_BASE = "https://api.sandbox.ebay.com"
_PRODUCTION_BASE = "https://api.ebay.com"

# eBay Marketplace ID for Australia
_MARKETPLACE_ID = "EBAY_AU"


@register_channel
class EbayChannel(BaseMarketplaceChannel):
    """eBay marketplace channel using eBay Inventory + Fulfillment APIs.

    Uses OAuth 2.0 Client Credentials flow for server-to-server auth.
    Supports both sandbox and production environments.
    """

    channel_type = "ebay"
    display_name = "eBay"

    def __init__(self) -> None:
        self._client_id: str | None = None
        self._client_secret: str | None = None
        self._base_url: str = _SANDBOX_BASE
        self._access_token: str | None = None
        self._token_expires_at: datetime | None = None
        self._connected: bool = False
        self._client: httpx.AsyncClient | None = None

    # ── OAuth helpers ─────────────────────────────────────────────────

    async def _get_access_token(self) -> str:
        """Fetch a new client credentials access token from eBay."""
        credentials = base64.b64encode(
            f"{self._client_id}:{self._client_secret}".encode()
        ).decode()

        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self._base_url}/identity/v1/oauth2/token",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": " ".join([
                        "https://api.ebay.com/oauth/api_scope",
                        "https://api.ebay.com/oauth/api_scope/sell.inventory",
                        "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
                    ]),
                },
                timeout=30.0,
            )
            r.raise_for_status()
            data = r.json()

        self._access_token = data["access_token"]
        expires_in = int(data.get("expires_in", 7200))
        self._token_expires_at = datetime.now(UTC).replace(
            second=datetime.now(UTC).second + expires_in - 60
        )
        return self._access_token

    async def _ensure_token(self) -> str:
        """Return a valid access token, refreshing if needed."""
        if (
            not self._access_token
            or not self._token_expires_at
            or datetime.now(UTC) >= self._token_expires_at
        ):
            return await self._get_access_token()
        return self._access_token

    def _make_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            timeout=30.0,
        )

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        token = await self._ensure_token()
        if not self._client:
            raise RuntimeError("EbayChannel not connected")
        r = await self._client.get(
            path,
            params=params or {},
            headers={
                "Authorization": f"Bearer {token}",
                "X-EBAY-C-MARKETPLACE-ID": _MARKETPLACE_ID,
            },
        )
        r.raise_for_status()
        return r.json() if r.content else {}

    async def _post(self, path: str, json: dict) -> dict[str, Any]:
        token = await self._ensure_token()
        if not self._client:
            raise RuntimeError("EbayChannel not connected")
        r = await self._client.post(
            path,
            json=json,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-EBAY-C-MARKETPLACE-ID": _MARKETPLACE_ID,
            },
        )
        r.raise_for_status()
        return r.json() if r.content else {}

    async def _put(self, path: str, json: dict) -> dict[str, Any]:
        token = await self._ensure_token()
        if not self._client:
            raise RuntimeError("EbayChannel not connected")
        r = await self._client.put(
            path,
            json=json,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-EBAY-C-MARKETPLACE-ID": _MARKETPLACE_ID,
            },
        )
        r.raise_for_status()
        return r.json() if r.content else {}

    async def _delete(self, path: str) -> None:
        token = await self._ensure_token()
        if not self._client:
            raise RuntimeError("EbayChannel not connected")
        r = await self._client.delete(
            path,
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()

    # ── BaseMarketplaceChannel interface ──────────────────────────────

    async def connect(self, credentials: dict) -> ConnectionResult:
        client_id = credentials.get("client_id", "").strip()
        client_secret = credentials.get("client_secret", "").strip()
        environment = credentials.get("environment", "sandbox").strip().lower()

        if not client_id or not client_secret:
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message="client_id and client_secret are required",
            )

        self._client_id = client_id
        self._client_secret = client_secret
        self._base_url = _PRODUCTION_BASE if environment == "production" else _SANDBOX_BASE
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
        self._access_token = None

    async def test_connection(self) -> ConnectionResult:
        try:
            await self._get_access_token()
            return ConnectionResult(
                success=True,
                channel_type=self.channel_type,
                message=f"Connected to eBay ({self._base_url.split('//')[1]})",
                metadata={
                    "environment": "production" if "sandbox" not in self._base_url else "sandbox",
                    "marketplace_id": _MARKETPLACE_ID,
                },
            )
        except Exception as exc:
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message=f"eBay connection failed: {exc}",
            )

    async def list_products(self, limit: int = 50, offset: int = 0) -> list[ChannelProduct]:
        try:
            data = await self._get(
                "/sell/inventory/v1/inventory_item",
                params={"limit": min(limit, 200), "offset": offset},
            )
        except Exception as exc:
            logger.error("ebay_list_products_failed", error=str(exc))
            return []

        products: list[ChannelProduct] = []
        for item in data.get("inventoryItems", []):
            product = item.get("product", {})
            avail = item.get("availability", {}).get("shipToLocationAvailability", {})
            qty = avail.get("quantity", 0)
            aspects = product.get("aspects", {})
            price_data = item.get("availability", {}).get("pickupAtLocationAvailability", [])
            price = 0.0
            images = product.get("imageUrls", [])

            products.append(
                ChannelProduct(
                    external_id=item.get("sku", ""),
                    title=product.get("title", ""),
                    sku=item.get("sku"),
                    description=product.get("description"),
                    price=price,
                    currency="AUD",
                    quantity=qty,
                    images=images,
                    status="active" if qty > 0 else "inactive",
                    category=str(aspects.get("Category", [""])[0]) if aspects.get("Category") else None,
                    raw_data=item,
                )
            )
        return products

    async def push_product(self, product: dict) -> str:
        sku = product.get("sku", "").strip() or f"SKU-{product.get('id', 'unknown')}"
        payload = {
            "product": {
                "title": product.get("name", product.get("title", "")),
                "description": product.get("description", ""),
                "aspects": {},
                "imageUrls": [],
            },
            "condition": "NEW",
            "availability": {
                "shipToLocationAvailability": {
                    "quantity": product.get("quantity", 0),
                }
            },
        }
        await self._put(f"/sell/inventory/v1/inventory_item/{sku}", json=payload)
        return sku

    async def update_product(self, external_id: str, product: dict) -> None:
        payload = {
            "product": {
                "title": product.get("name", product.get("title", "")),
                "description": product.get("description", ""),
            },
            "condition": "NEW",
            "availability": {
                "shipToLocationAvailability": {
                    "quantity": product.get("quantity", 0),
                }
            },
        }
        await self._put(f"/sell/inventory/v1/inventory_item/{external_id}", json=payload)

    async def delete_product(self, external_id: str) -> None:
        await self._delete(f"/sell/inventory/v1/inventory_item/{external_id}")

    async def sync_inventory(self, external_id: str, quantity: int) -> None:
        try:
            data = await self._get(f"/sell/inventory/v1/inventory_item/{external_id}")
            data.setdefault("availability", {}).setdefault("shipToLocationAvailability", {})
            data["availability"]["shipToLocationAvailability"]["quantity"] = quantity
            await self._put(
                f"/sell/inventory/v1/inventory_item/{external_id}",
                json=data,
            )
        except Exception as exc:
            logger.error("ebay_sync_inventory_failed", sku=external_id, error=str(exc))

    async def pull_orders(self, since: datetime | None = None) -> list[ChannelOrder]:
        params: dict = {"limit": 50, "ordersFulfillmentStatus": "NOT_STARTED"}
        if since:
            params["creationDateRangeFrom"] = since.isoformat()

        try:
            data = await self._get("/sell/fulfillment/v1/order", params=params)
        except Exception as exc:
            logger.error("ebay_pull_orders_failed", error=str(exc))
            return []

        orders: list[ChannelOrder] = []
        for o in data.get("orders", []):
            buyer = o.get("buyer", {})
            fulfillment = (o.get("fulfillmentStartInstructions") or [{}])[0]
            shipping = fulfillment.get("shippingStep", {}).get("shipTo", {})
            address = shipping.get("contactAddress", {})

            line_items = [
                {
                    "title": li.get("title", ""),
                    "sku": li.get("sku"),
                    "quantity": li.get("quantity", 1),
                    "price": float(li.get("lineItemCost", {}).get("value", 0)),
                }
                for li in o.get("lineItems", [])
            ]

            created_str = o.get("creationDate")
            ordered_at = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if created_str else None
            total = o.get("pricingSummary", {}).get("total", {})

            orders.append(
                ChannelOrder(
                    external_id=o.get("orderId", ""),
                    external_order_number=o.get("orderId", ""),
                    customer_name=shipping.get("fullName"),
                    customer_email=buyer.get("username"),
                    total_amount=float(total.get("value", 0)),
                    currency=total.get("currency", "AUD"),
                    status=o.get("orderFulfillmentStatus", "pending").lower(),
                    line_items=line_items,
                    shipping_address={
                        "name": shipping.get("fullName"),
                        "address1": address.get("addressLine1"),
                        "city": address.get("city"),
                        "province": address.get("stateOrProvince"),
                        "zip": address.get("postalCode"),
                        "country": address.get("countryCode"),
                    },
                    ordered_at=ordered_at,
                    raw_data=o,
                )
            )
        return orders

    async def update_order_status(self, external_id: str, status: str) -> None:
        if status in ("shipped", "fulfilled"):
            try:
                # Mark order as shipped via fulfillment
                await self._post(
                    f"/sell/fulfillment/v1/order/{external_id}/shipping_fulfillment",
                    json={
                        "lineItems": [],
                        "shippedDate": datetime.now(UTC).isoformat(),
                        "shippingCarrierCode": "Other",
                    },
                )
            except Exception as exc:
                logger.error("ebay_update_order_status_failed", order_id=external_id, error=str(exc))
        else:
            logger.info(
                "ebay_update_order_status_skipped",
                order_id=external_id,
                status=status,
            )

    def get_setup_fields(self) -> list[dict]:
        return [
            {
                "key": "client_id",
                "label": "App Client ID (Application ID)",
                "type": "text",
                "required": True,
                "placeholder": "YourApp-12345-6789a...",
            },
            {
                "key": "client_secret",
                "label": "Cert ID (Client Secret)",
                "type": "password",
                "required": True,
                "placeholder": "SBX-...",
            },
            {
                "key": "environment",
                "label": "Environment (sandbox or production)",
                "type": "text",
                "required": False,
                "placeholder": "sandbox",
            },
        ]
