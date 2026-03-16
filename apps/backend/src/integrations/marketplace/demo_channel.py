"""Demo marketplace channel implementation.

Provides realistic mock data for all three channels (Shopify, eBay, Facebook)
without making real API calls. Used for testing and demo mode.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import structlog

from .base import BaseMarketplaceChannel, ChannelOrder, ChannelProduct, ConnectionResult
from .registry import register_channel

logger = structlog.get_logger(__name__)

# Demo product catalog — realistic Australian cleaning equipment
_DEMO_PRODUCTS: list[dict] = [
    {
        "id": "demo-001",
        "title": "Steamaster Truckmount 47HP",
        "sku": "TM-47HP-001",
        "price": 42500.00,
        "quantity": 3,
        "category": "Truckmounts",
        "description": "Professional 47HP truckmount carpet cleaning system with dual wand capability.",
    },
    {
        "id": "demo-002",
        "title": "Mytee Lite III Hot Water Extractor",
        "sku": "EXT-MLITE3-001",
        "price": 2895.00,
        "quantity": 12,
        "category": "Extractors",
        "description": "Heated portable extractor with 11L solution tank. Ideal for small jobs.",
    },
    {
        "id": "demo-003",
        "title": "Pro-Chem Prespray 20L",
        "sku": "CHEM-PP20-001",
        "price": 89.95,
        "quantity": 145,
        "category": "Chemicals",
        "description": "Professional-grade alkaline prespray for heavily soiled commercial carpet.",
    },
    {
        "id": "demo-004",
        "title": "Westpak 12\" Truckmount Wand",
        "sku": "ACC-WND12-001",
        "price": 645.00,
        "quantity": 24,
        "category": "Accessories",
        "description": "12-inch stainless steel truckmount wand with titanium glides.",
    },
    {
        "id": "demo-005",
        "title": "Powr-Flite 17\" Floor Machine",
        "sku": "FM-PF17-001",
        "price": 1250.00,
        "quantity": 8,
        "category": "Floor Machines",
        "description": "17-inch rotary floor machine for hard floor cleaning and polishing.",
    },
]

_DEMO_ORDERS: list[dict] = [
    {
        "id": "order-demo-001",
        "number": "#1042",
        "customer": "Brisbane Carpet Care",
        "email": "orders@brisbanecarpetcare.com.au",
        "total": 2895.00,
        "status": "confirmed",
        "items": [{"sku": "EXT-MLITE3-001", "title": "Mytee Lite III", "qty": 1, "price": 2895.00}],
    },
    {
        "id": "order-demo-002",
        "number": "#1043",
        "customer": "Gold Coast Cleaning Supplies",
        "email": "info@gccleaning.com.au",
        "total": 179.90,
        "status": "pending",
        "items": [{"sku": "CHEM-PP20-001", "title": "Pro-Chem Prespray 20L", "qty": 2, "price": 89.95}],
    },
    {
        "id": "order-demo-003",
        "number": "#1044",
        "customer": "Melbourne Steam Clean",
        "email": "procurement@melbsteam.com.au",
        "total": 43145.00,
        "status": "processing",
        "items": [
            {"sku": "TM-47HP-001", "title": "Steamaster Truckmount 47HP", "qty": 1, "price": 42500.00},
            {"sku": "ACC-WND12-001", "title": "Westpak 12\" Truckmount Wand", "qty": 1, "price": 645.00},
        ],
    },
]


def _make_channel_product(p: dict, channel_type: str) -> ChannelProduct:
    """Convert a demo product dict to a ChannelProduct."""
    return ChannelProduct(
        external_id=f"{channel_type}-{p['id']}",
        title=p["title"],
        sku=p.get("sku"),
        description=p.get("description"),
        price=p["price"],
        currency="AUD",
        quantity=p["quantity"],
        status="active",
        category=p.get("category"),
        raw_data=p,
    )


def _make_channel_order(o: dict, channel_type: str) -> ChannelOrder:
    """Convert a demo order dict to a ChannelOrder."""
    return ChannelOrder(
        external_id=f"{channel_type}-{o['id']}",
        external_order_number=o["number"],
        customer_name=o["customer"],
        customer_email=o["email"],
        total_amount=o["total"],
        currency="AUD",
        status=o["status"],
        line_items=o["items"],
        shipping_address={"country": "AU", "state": "QLD", "postcode": "4000"},
        ordered_at=datetime.now(UTC) - timedelta(hours=2),
        raw_data=o,
    )


class _BaseDemoChannel(BaseMarketplaceChannel):
    """Shared demo logic for all channels."""

    _connected: bool = False

    async def connect(self, credentials: dict) -> ConnectionResult:
        self._connected = True
        logger.info("demo_channel_connected", channel=self.channel_type)
        return ConnectionResult(
            success=True,
            channel_type=self.channel_type,
            message=f"Connected to {self.display_name} (demo mode)",
            metadata={"mode": "demo", "channel": self.channel_type},
        )

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("demo_channel_disconnected", channel=self.channel_type)

    async def test_connection(self) -> ConnectionResult:
        return ConnectionResult(
            success=self._connected,
            channel_type=self.channel_type,
            message="Demo connection active" if self._connected else "Not connected",
            metadata={"mode": "demo"},
        )

    async def list_products(self, limit: int = 50, offset: int = 0) -> list[ChannelProduct]:
        products = _DEMO_PRODUCTS[offset:offset + limit]
        return [_make_channel_product(p, self.channel_type) for p in products]

    async def push_product(self, product: dict) -> str:
        ext_id = f"{self.channel_type}-{product.get('sku', uuid4().hex[:8])}"
        logger.info("demo_product_pushed", channel=self.channel_type, external_id=ext_id)
        return ext_id

    async def update_product(self, external_id: str, product: dict) -> None:
        logger.info("demo_product_updated", channel=self.channel_type, external_id=external_id)

    async def delete_product(self, external_id: str) -> None:
        logger.info("demo_product_deleted", channel=self.channel_type, external_id=external_id)

    async def sync_inventory(self, external_id: str, quantity: int) -> None:
        logger.info(
            "demo_inventory_synced",
            channel=self.channel_type,
            external_id=external_id,
            quantity=quantity,
        )

    async def pull_orders(self, since: datetime | None = None) -> list[ChannelOrder]:
        return [_make_channel_order(o, self.channel_type) for o in _DEMO_ORDERS]

    async def update_order_status(self, external_id: str, status: str) -> None:
        logger.info(
            "demo_order_status_updated",
            channel=self.channel_type,
            external_id=external_id,
            status=status,
        )


@register_channel
class ShopifyDemoChannel(_BaseDemoChannel):
    """Demo Shopify channel."""

    channel_type = "shopify"
    display_name = "Shopify"

    def get_setup_fields(self) -> list[dict]:
        return [
            {"key": "shop_domain", "label": "Shop Domain", "type": "text", "required": True, "placeholder": "your-store.myshopify.com"},
            {"key": "api_key", "label": "API Key", "type": "text", "required": True, "placeholder": "Shopify Admin API key"},
            {"key": "api_secret", "label": "API Secret", "type": "password", "required": True, "placeholder": "Shopify API secret key"},
            {"key": "access_token", "label": "Access Token", "type": "password", "required": True, "placeholder": "Admin API access token"},
        ]


@register_channel
class EbayDemoChannel(_BaseDemoChannel):
    """Demo eBay channel."""

    channel_type = "ebay"
    display_name = "eBay"

    def get_setup_fields(self) -> list[dict]:
        return [
            {"key": "client_id", "label": "Client ID (App ID)", "type": "text", "required": True, "placeholder": "eBay Developer App ID"},
            {"key": "client_secret", "label": "Client Secret (Cert ID)", "type": "password", "required": True, "placeholder": "eBay Developer Cert ID"},
            {"key": "refresh_token", "label": "Refresh Token", "type": "password", "required": True, "placeholder": "OAuth refresh token"},
            {"key": "environment", "label": "Environment", "type": "text", "required": False, "placeholder": "sandbox or production"},
        ]


@register_channel
class FacebookDemoChannel(_BaseDemoChannel):
    """Demo Facebook Marketplace channel."""

    channel_type = "facebook"
    display_name = "Facebook Marketplace"

    def get_setup_fields(self) -> list[dict]:
        return [
            {"key": "app_id", "label": "App ID", "type": "text", "required": True, "placeholder": "Facebook App ID"},
            {"key": "app_secret", "label": "App Secret", "type": "password", "required": True, "placeholder": "Facebook App Secret"},
            {"key": "access_token", "label": "Page Access Token", "type": "password", "required": True, "placeholder": "Long-lived page access token"},
            {"key": "catalog_id", "label": "Catalog ID", "type": "text", "required": True, "placeholder": "Facebook Commerce catalog ID"},
        ]
