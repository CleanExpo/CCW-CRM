"""Facebook Commerce marketplace channel implementation.

Uses the Facebook Graph API (v19.0) and Catalog Batch API for product sync,
and the Commerce Orders API for order management.

Supports Instagram Shopping cross-listing via the same catalog.

Credentials expected in connect():
    access_token — Facebook System User Access Token (long-lived)
    catalog_id   — Facebook Commerce Catalog ID
    page_id      — Facebook Page ID associated with the shop

Reference:
    https://developers.facebook.com/docs/marketing-api/catalog/
    https://developers.facebook.com/docs/commerce-platform/order-management/
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
import structlog

from .base import BaseMarketplaceChannel, ChannelOrder, ChannelProduct, ConnectionResult
from .registry import register_channel

logger = structlog.get_logger(__name__)

_GRAPH_BASE = "https://graph.facebook.com/v19.0"

# Facebook Commerce order status mapping → normalised status
_FB_STATUS_MAP: dict[str, str] = {
    "CREATED": "pending",
    "IN_PROGRESS": "processing",
    "FB_PROCESSING": "processing",
    "COMPLETED": "fulfilled",
    "CANCELLED": "cancelled",
    "REFUNDED": "refunded",
}


@register_channel
class FacebookChannel(BaseMarketplaceChannel):
    """Facebook Commerce channel using Graph API + Catalog Batch API.

    Products are synced to a Facebook Commerce Catalog and made available
    on Facebook Shop and Instagram Shopping simultaneously.

    Authentication uses a long-lived System User Access Token (never expires)
    rather than short-lived user tokens.
    """

    channel_type = "facebook"
    display_name = "Facebook & Instagram Shop"

    def __init__(self) -> None:
        self._access_token: str | None = None
        self._catalog_id: str | None = None
        self._page_id: str | None = None
        self._connected: bool = False
        self._client: httpx.AsyncClient | None = None

    # ── HTTP helpers ───────────────────────────────────────────────────

    def _make_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=_GRAPH_BASE, timeout=30.0)

    def _auth_params(self) -> dict[str, str]:
        return {"access_token": self._access_token or ""}

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("FacebookChannel not connected")
        merged = {**(params or {}), **self._auth_params()}
        r = await self._client.get(path, params=merged)
        r.raise_for_status()
        return r.json() if r.content else {}

    async def _post(self, path: str, json: dict | None = None, data: dict | None = None) -> dict[str, Any]:
        if not self._client:
            raise RuntimeError("FacebookChannel not connected")
        kwargs: dict[str, Any] = {"params": self._auth_params()}
        if json is not None:
            kwargs["json"] = json
        elif data is not None:
            kwargs["data"] = data
        r = await self._client.post(path, **kwargs)
        r.raise_for_status()
        return r.json() if r.content else {}

    async def _delete(self, path: str) -> None:
        if not self._client:
            raise RuntimeError("FacebookChannel not connected")
        r = await self._client.delete(path, params=self._auth_params())
        r.raise_for_status()

    # ── BaseMarketplaceChannel interface ──────────────────────────────

    async def connect(self, credentials: dict) -> ConnectionResult:
        access_token = credentials.get("access_token", "").strip()
        catalog_id = credentials.get("catalog_id", "").strip()
        page_id = credentials.get("page_id", "").strip()

        if not access_token or not catalog_id:
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message="access_token and catalog_id are required",
            )

        self._access_token = access_token
        self._catalog_id = catalog_id
        self._page_id = page_id or None
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
        """Verify credentials by fetching catalog metadata."""
        try:
            data = await self._get(
                f"/{self._catalog_id}",
                params={"fields": "id,name,product_count"},
            )
            catalog_name = data.get("name", self._catalog_id)
            product_count = data.get("product_count", 0)
            return ConnectionResult(
                success=True,
                channel_type=self.channel_type,
                message=f"Connected to Facebook catalog '{catalog_name}'",
                metadata={
                    "catalog_id": self._catalog_id,
                    "catalog_name": catalog_name,
                    "product_count": product_count,
                    "page_id": self._page_id,
                },
            )
        except httpx.HTTPStatusError as exc:
            error_body: dict[str, Any] = {}
            try:
                error_body = exc.response.json()
            except Exception:
                pass
            fb_error = error_body.get("error", {})
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message=f"Facebook connection failed: {fb_error.get('message', str(exc))}",
            )
        except Exception as exc:
            return ConnectionResult(
                success=False,
                channel_type=self.channel_type,
                message=f"Facebook connection failed: {exc}",
            )

    async def list_products(self, limit: int = 50, offset: int = 0) -> list[ChannelProduct]:
        """List products in the Facebook Commerce catalog."""
        fields = "id,title,description,price,currency,availability,condition,url,image_url,retailer_id"
        try:
            data = await self._get(
                f"/{self._catalog_id}/products",
                params={
                    "fields": fields,
                    "limit": min(limit, 200),
                    "after": str(offset) if offset else None,
                },
            )
        except Exception as exc:
            logger.error("facebook_list_products_failed", error=str(exc))
            return []

        products: list[ChannelProduct] = []
        for item in data.get("data", []):
            # Facebook prices are strings like "2999 AUD" or "29.99 AUD"
            price_raw = item.get("price", "0 AUD")
            price, currency = _parse_fb_price(price_raw)

            availability = item.get("availability", "out of stock")
            status = "active" if availability == "in stock" else "inactive"

            products.append(
                ChannelProduct(
                    external_id=item.get("id", ""),
                    title=item.get("title", ""),
                    sku=item.get("retailer_id"),
                    description=item.get("description"),
                    price=price,
                    currency=currency,
                    quantity=0,  # FB catalog doesn't expose quantity directly
                    images=[item["image_url"]] if item.get("image_url") else [],
                    url=item.get("url"),
                    status=status,
                    category=item.get("google_product_category"),
                    raw_data=item,
                )
            )
        return products

    async def push_product(self, product: dict) -> str:
        """Create or update a product in the Facebook Commerce Catalog via Batch API.

        Returns the retailer_id (SKU) as the external reference — Facebook assigns
        its own product item IDs internally but the retailer_id is the stable key.
        """
        sku = product.get("sku", "").strip() or f"SKU-{product.get('id', 'unknown')}"
        price_cents = int(float(product.get("price", 0)) * 100)
        currency = product.get("currency", "AUD")

        requests_payload = [
            {
                "method": "CREATE",
                "retailer_id": sku,
                "data": {
                    "title": product.get("name", product.get("title", "")),
                    "description": product.get("description", ""),
                    "price": price_cents,
                    "currency": currency,
                    "availability": (
                        "in stock" if int(product.get("quantity", product.get("stock", 0))) > 0
                        else "out of stock"
                    ),
                    "condition": "new",
                    "url": product.get("url", f"https://ccwclean.com.au/products/{sku}"),
                    "image_url": (product.get("images") or [""])[0],
                    "retailer_id": sku,
                },
            }
        ]

        await self._post(
            f"/{self._catalog_id}/batch",
            json={"requests": requests_payload},
        )
        return sku

    async def update_product(self, external_id: str, product: dict) -> None:
        """Update a product in the Facebook catalog via Batch API (UPDATE method)."""
        price_cents = int(float(product.get("price", 0)) * 100)
        currency = product.get("currency", "AUD")

        requests_payload = [
            {
                "method": "UPDATE",
                "retailer_id": external_id,
                "data": {
                    "title": product.get("name", product.get("title", "")),
                    "description": product.get("description", ""),
                    "price": price_cents,
                    "currency": currency,
                    "availability": (
                        "in stock" if int(product.get("quantity", product.get("stock", 0))) > 0
                        else "out of stock"
                    ),
                },
            }
        ]

        try:
            await self._post(
                f"/{self._catalog_id}/batch",
                json={"requests": requests_payload},
            )
        except Exception as exc:
            logger.error("facebook_update_product_failed", retailer_id=external_id, error=str(exc))

    async def delete_product(self, external_id: str) -> None:
        """Remove a product from the Facebook catalog via Batch API (DELETE method)."""
        requests_payload = [
            {
                "method": "DELETE",
                "retailer_id": external_id,
            }
        ]
        try:
            await self._post(
                f"/{self._catalog_id}/batch",
                json={"requests": requests_payload},
            )
        except Exception as exc:
            logger.error("facebook_delete_product_failed", retailer_id=external_id, error=str(exc))

    async def sync_inventory(self, external_id: str, quantity: int) -> None:
        """Update availability flag in Facebook catalog based on stock level."""
        availability = "in stock" if quantity > 0 else "out of stock"
        requests_payload = [
            {
                "method": "UPDATE",
                "retailer_id": external_id,
                "data": {"availability": availability},
            }
        ]
        try:
            await self._post(
                f"/{self._catalog_id}/batch",
                json={"requests": requests_payload},
            )
        except Exception as exc:
            logger.error(
                "facebook_sync_inventory_failed",
                retailer_id=external_id,
                quantity=quantity,
                error=str(exc),
            )

    async def pull_orders(self, since: datetime | None = None) -> list[ChannelOrder]:
        """Pull Commerce orders from the connected Facebook Page."""
        if not self._page_id:
            logger.warning("facebook_pull_orders_skipped", reason="no page_id configured")
            return []

        params: dict[str, Any] = {
            "fields": (
                "id,order_status,created,last_updated,ship_by_date,"
                "merchant_order_id,channel,estimated_payment_details,"
                "items{retailer_id,quantity,price_per_unit,retailer_product_id},"
                "shipping_address,buyer_details"
            ),
            "state": "CREATED,IN_PROGRESS",
        }
        if since:
            params["updated_after"] = int(since.timestamp())

        try:
            data = await self._get(f"/{self._page_id}/commerce_orders", params=params)
        except Exception as exc:
            logger.error("facebook_pull_orders_failed", error=str(exc))
            return []

        orders: list[ChannelOrder] = []
        for o in data.get("data", []):
            fb_status = o.get("order_status", {}).get("state", "CREATED")
            status = _FB_STATUS_MAP.get(fb_status, "pending")

            payment = o.get("estimated_payment_details", {})
            subtotal = payment.get("subtotal", {})
            price_raw = subtotal.get("amount", "0")
            currency = subtotal.get("currency", "AUD")

            line_items = []
            for item in o.get("items", {}).get("data", []):
                unit_price = item.get("price_per_unit", {})
                line_items.append({
                    "sku": item.get("retailer_id"),
                    "quantity": item.get("quantity", 1),
                    "price": float(unit_price.get("amount", 0)),
                })

            shipping = o.get("shipping_address", {})
            buyer = o.get("buyer_details", {})

            created_str = o.get("created")
            ordered_at: datetime | None = None
            if created_str:
                try:
                    ordered_at = datetime.fromtimestamp(int(created_str), tz=UTC)
                except (ValueError, TypeError):
                    pass

            orders.append(
                ChannelOrder(
                    external_id=o.get("id", ""),
                    external_order_number=o.get("merchant_order_id") or o.get("id", ""),
                    customer_name=buyer.get("name"),
                    customer_email=buyer.get("email"),
                    total_amount=float(price_raw),
                    currency=currency,
                    status=status,
                    line_items=line_items,
                    shipping_address={
                        "name": shipping.get("name"),
                        "address1": shipping.get("street1"),
                        "address2": shipping.get("street2"),
                        "city": shipping.get("city"),
                        "province": shipping.get("state"),
                        "zip": shipping.get("postal_code"),
                        "country": shipping.get("country"),
                    },
                    ordered_at=ordered_at,
                    raw_data=o,
                )
            )
        return orders

    async def update_order_status(self, external_id: str, status: str) -> None:
        """Acknowledge or ship an order on Facebook Commerce.

        Facebook Commerce supports MERCHANT_MARKED_SHIPPED and CANCELLED transitions.
        Other status updates are logged but not sent to Facebook.
        """
        if not self._page_id:
            return

        if status in ("shipped", "fulfilled"):
            try:
                await self._post(
                    f"/{external_id}/shipments",
                    data={
                        "tracking_info": "[]",
                        "should_use_default_fulfillment_location": "true",
                    },
                )
            except Exception as exc:
                logger.error(
                    "facebook_update_order_status_failed",
                    order_id=external_id,
                    status=status,
                    error=str(exc),
                )
        elif status == "cancelled":
            try:
                await self._post(
                    f"/{external_id}/cancellations",
                    data={"cancel_reason": "CUSTOMER_REQUESTED"},
                )
            except Exception as exc:
                logger.error(
                    "facebook_cancel_order_failed",
                    order_id=external_id,
                    error=str(exc),
                )
        else:
            logger.info(
                "facebook_update_order_status_skipped",
                order_id=external_id,
                status=status,
            )

    def get_setup_fields(self) -> list[dict]:
        return [
            {
                "key": "access_token",
                "label": "System User Access Token",
                "type": "password",
                "required": True,
                "placeholder": "EAABxx... (long-lived system user token)",
            },
            {
                "key": "catalog_id",
                "label": "Commerce Catalog ID",
                "type": "text",
                "required": True,
                "placeholder": "123456789012345",
            },
            {
                "key": "page_id",
                "label": "Facebook Page ID (required for order management)",
                "type": "text",
                "required": False,
                "placeholder": "987654321098765",
            },
        ]


# ── Helpers ────────────────────────────────────────────────────────────────────


def _parse_fb_price(price_raw: str) -> tuple[float, str]:
    """Parse a Facebook price string like '2999 AUD' or '29.99 AUD'.

    Facebook Catalog API returns prices as integer cent strings (e.g. '2999 AUD'
    means $29.99) or float strings depending on endpoint version.

    Returns:
        (price_float, currency_code)
    """
    parts = str(price_raw).strip().split()
    currency = "AUD"
    if len(parts) >= 2:
        currency = parts[-1].upper()
    try:
        raw_value = float(parts[0])
        # If the value looks like cents (>= 100 and no decimal point in original)
        if "." not in parts[0] and raw_value >= 100:
            return raw_value / 100, currency
        return raw_value, currency
    except (ValueError, IndexError):
        return 0.0, currency
