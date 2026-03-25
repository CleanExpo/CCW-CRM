"""Unified marketplace integration API routes.

Provides endpoints for managing multi-channel marketplace connections,
product sync, inventory sync, and unified order feed.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from src.api.middleware.rate_limit import RateLimits, limiter
from src.config.marketplace_settings import get_marketplace_settings
from src.integrations.marketplace.demo_channel import (
    EbayDemoChannel,
    FacebookDemoChannel,
    ShopifyDemoChannel,
)
from src.integrations.marketplace.registry import get_channel, list_channels
from src.integrations.marketplace.sync_engine import SyncEngine

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])


def _validate_channel_type(channel_type: str) -> None:
    """Validate channel_type is a known registered channel. Raises 404 if not found."""
    ch_cls = get_channel(channel_type)
    if not ch_cls:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_type}' not found")

# Per-request sync engine — in production this would use DB-backed channel instances
_engines: dict[str, SyncEngine] = {}


def _get_engine() -> SyncEngine:
    """Get or create the marketplace sync engine with connected channels."""
    settings = get_marketplace_settings()
    if "default" not in _engines:
        engine = SyncEngine()
        if settings.is_demo_mode:
            # Auto-connect demo channels
            shopify = ShopifyDemoChannel()
            shopify._connected = True
            ebay = EbayDemoChannel()
            ebay._connected = True
            facebook = FacebookDemoChannel()
            facebook._connected = True
            engine.add_channel(shopify)
            engine.add_channel(ebay)
            engine.add_channel(facebook)
        _engines["default"] = engine
    return _engines["default"]


# ─── Pydantic response models ──────────────────────────────────────

class ChannelInfo(BaseModel):
    channel_type: str
    display_name: str
    connected: bool = False
    mode: str = "demo"
    status: str = "disconnected"
    last_product_sync: str | None = None
    last_inventory_sync: str | None = None
    last_order_sync: str | None = None
    setup_fields: list[dict] = Field(default_factory=list)


class ChannelListResponse(BaseModel):
    channels: list[ChannelInfo]
    total: int


class ConnectRequest(BaseModel):
    credentials: dict = Field(default_factory=dict)


class ConnectResponse(BaseModel):
    success: bool
    channel_type: str
    message: str
    mode: str = "demo"


class ProductListingResponse(BaseModel):
    external_id: str
    title: str
    sku: str | None = None
    price: float = 0.0
    currency: str = "AUD"
    quantity: int = 0
    status: str = "active"
    category: str | None = None
    url: str | None = None


class SyncProductsRequest(BaseModel):
    product_ids: list[str] = Field(default_factory=list, description="ERP product IDs to sync. Empty = all.")
    channel_types: list[str] | None = Field(default=None, description="Channels to sync to. None = all connected.")


class SyncProductsResponse(BaseModel):
    success: bool
    results: dict  # channel_type -> per-product results
    synced_at: str


class SyncStatusResponse(BaseModel):
    channels: dict  # channel_type -> status dict
    overall_healthy: bool
    checked_at: str


class SyncInventoryRequest(BaseModel):
    items: list[dict] = Field(
        default_factory=list,
        description="List of {external_id, quantity, channel_type} to sync.",
    )
    channel_types: list[str] | None = None


class SyncInventoryResponse(BaseModel):
    success: bool
    results: dict  # channel_type -> {synced, failed, errors}
    synced_at: str


class MarketplaceOrderResponse(BaseModel):
    external_id: str
    external_order_number: str | None = None
    channel_type: str
    customer_name: str | None = None
    customer_email: str | None = None
    total_amount: float = 0.0
    currency: str = "AUD"
    status: str = "pending"
    line_items: list[dict] = Field(default_factory=list)
    ordered_at: str | None = None


class OrderFeedResponse(BaseModel):
    orders: list[MarketplaceOrderResponse]
    total: int
    channels: list[str]


class SetupFieldsResponse(BaseModel):
    channel_type: str
    display_name: str
    fields: list[dict] = Field(default_factory=list)


# ─── Endpoints ──────────────────────────────────────────────────────

@router.get("/channels", response_model=ChannelListResponse)
@limiter.limit(RateLimits.READ)
async def list_marketplace_channels(request: Request):
    """List all available marketplace channels with connection status."""
    settings = get_marketplace_settings()
    engine = _get_engine()
    registered = list_channels()

    channels: list[ChannelInfo] = []
    for ch in registered:
        ch_type = ch["channel_type"]
        ch_cls = get_channel(ch_type)
        setup_fields: list[dict] = []
        if ch_cls:
            try:
                instance = ch_cls()
                setup_fields = instance.get_setup_fields()
            except Exception as exc:
                logger.debug("channel_setup_fields_error", channel_type=ch_type, error=str(exc))

        connected = ch_type in engine.active_channels
        channels.append(
            ChannelInfo(
                channel_type=ch_type,
                display_name=ch["display_name"],
                connected=connected,
                mode=settings.mode,
                status="connected" if connected else "disconnected",
                setup_fields=setup_fields,
            )
        )

    return ChannelListResponse(channels=channels, total=len(channels))


@router.post("/channels/{channel_type}/connect", response_model=ConnectResponse)
@limiter.limit(RateLimits.WRITE)
async def connect_channel(request: Request, channel_type: str, body: ConnectRequest | None = None):
    """Connect to a marketplace channel with credentials."""
    _validate_channel_type(channel_type)
    settings = get_marketplace_settings()
    engine = _get_engine()
    ch_cls = get_channel(channel_type)

    # ch_cls is guaranteed non-None by _validate_channel_type above
    instance = ch_cls()  # type: ignore[misc]
    creds = body.credentials if body else {}

    try:
        result = await instance.connect(creds)
    except Exception as e:
        logger.error("channel_connect_failed", channel=channel_type, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to {channel_type}. Check credentials and try again.",
        )

    if result.success:
        engine.add_channel(instance)

    return ConnectResponse(
        success=result.success,
        channel_type=channel_type,
        message=result.message,
        mode=settings.mode,
    )


@router.post("/channels/{channel_type}/disconnect", response_model=ConnectResponse)
@limiter.limit(RateLimits.WRITE)
async def disconnect_channel(request: Request, channel_type: str):
    """Disconnect from a marketplace channel."""
    engine = _get_engine()

    if channel_type not in engine.active_channels:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_type}' is not connected")

    engine.remove_channel(channel_type)

    return ConnectResponse(
        success=True,
        channel_type=channel_type,
        message=f"Disconnected from {channel_type}",
        mode=get_marketplace_settings().mode,
    )


@router.get("/channels/{channel_type}/products", response_model=list[ProductListingResponse])
@limiter.limit(RateLimits.READ)
async def list_channel_products(
    request: Request,
    channel_type: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List products from a specific marketplace channel."""
    _validate_channel_type(channel_type)
    engine = _get_engine()
    results = await engine.pull_products_from_channels(limit=limit, channel_types=[channel_type])
    products = results.get(channel_type, [])

    return [
        ProductListingResponse(
            external_id=p.external_id,
            title=p.title,
            sku=p.sku,
            price=p.price,
            currency=p.currency,
            quantity=p.quantity,
            status=p.status,
            category=p.category,
            url=p.url,
        )
        for p in products
    ]


@router.post("/sync/products", response_model=SyncProductsResponse)
@limiter.limit(RateLimits.WRITE)
async def sync_products(request: Request, body: SyncProductsRequest | None = None):
    """Sync products to all connected marketplace channels.

    In demo mode, generates realistic mock sync results.
    """
    engine = _get_engine()
    channel_types = body.channel_types if body else None

    # In demo mode, we push demo products to channels
    demo_products = [
        {"sku": "TM-47HP-001", "name": "Steamaster Truckmount 47HP", "price": 42500.00, "stock": 3},
        {"sku": "EXT-MLITE3-001", "name": "Mytee Lite III", "price": 2895.00, "stock": 12},
        {"sku": "CHEM-PP20-001", "name": "Pro-Chem Prespray 20L", "price": 89.95, "stock": 145},
    ]

    all_results: dict = {}
    for product in demo_products:
        result = await engine.push_product_to_channels(product, channel_types=channel_types)
        for ch, r in result.items():
            if ch not in all_results:
                all_results[ch] = {"pushed": 0, "failed": 0, "products": []}
            if r["success"]:
                all_results[ch]["pushed"] += 1
            else:
                all_results[ch]["failed"] += 1
            all_results[ch]["products"].append({
                "sku": product["sku"],
                "external_id": r.get("external_id"),
                "success": r["success"],
                "error": r.get("error"),
            })

    return SyncProductsResponse(
        success=True,
        results=all_results,
        synced_at=datetime.now(UTC).isoformat(),
    )


@router.get("/sync/status", response_model=SyncStatusResponse)
@limiter.limit(RateLimits.READ)
async def get_sync_status(request: Request):
    """Get sync status for all connected marketplace channels."""
    engine = _get_engine()
    channels = await engine.get_sync_status()

    return SyncStatusResponse(
        channels=channels,
        overall_healthy=all(ch.get("connected", False) for ch in channels.values()),
        checked_at=datetime.now(UTC).isoformat(),
    )


@router.post("/sync/inventory", response_model=SyncInventoryResponse)
@limiter.limit(RateLimits.WRITE)
async def sync_inventory(request: Request, body: SyncInventoryRequest | None = None):
    """Push inventory levels to connected marketplace channels.

    In demo mode, simulates inventory sync with mock data.
    """
    engine = _get_engine()

    items = body.items if body and body.items else [
        {"external_id": "shopify-demo-001", "quantity": 3, "channel_type": "shopify"},
        {"external_id": "ebay-demo-002", "quantity": 12, "channel_type": "ebay"},
        {"external_id": "facebook-demo-003", "quantity": 145, "channel_type": "facebook"},
    ]
    channel_types = body.channel_types if body else None

    results = await engine.sync_inventory_to_channels(items, channel_types=channel_types)

    return SyncInventoryResponse(
        success=True,
        results=results,
        synced_at=datetime.now(UTC).isoformat(),
    )


@router.get("/orders", response_model=OrderFeedResponse)
@limiter.limit(RateLimits.READ)
async def get_marketplace_orders(
    request: Request,
    channel_type: str | None = Query(None, description="Filter by channel type"),
    since: str | None = Query(None, description="ISO 8601 datetime to filter orders"),
):
    """Get unified order feed from all connected marketplace channels."""
    engine = _get_engine()

    # Validate channel_type filter if provided
    if channel_type is not None:
        _validate_channel_type(channel_type)

    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid 'since' datetime format")

    channel_types = [channel_type] if channel_type else None
    channel_orders = await engine.pull_orders_from_channels(
        since=since_dt, channel_types=channel_types
    )

    all_orders: list[MarketplaceOrderResponse] = []
    channels_found: list[str] = []

    for ch_type, orders in channel_orders.items():
        channels_found.append(ch_type)
        for order in orders:
            all_orders.append(
                MarketplaceOrderResponse(
                    external_id=order.external_id,
                    external_order_number=order.external_order_number,
                    channel_type=ch_type,
                    customer_name=order.customer_name,
                    customer_email=order.customer_email,
                    total_amount=order.total_amount,
                    currency=order.currency,
                    status=order.status,
                    line_items=order.line_items,
                    ordered_at=order.ordered_at.isoformat() if order.ordered_at else None,
                )
            )

    # Sort by ordered_at descending
    all_orders.sort(key=lambda o: o.ordered_at or "", reverse=True)

    return OrderFeedResponse(
        orders=all_orders,
        total=len(all_orders),
        channels=channels_found,
    )


@router.get("/channels/{channel_type}/setup-fields", response_model=SetupFieldsResponse)
@limiter.limit(RateLimits.READ)
async def get_channel_setup_fields(request: Request, channel_type: str):
    """Get the credential fields required for a specific channel's setup wizard."""
    _validate_channel_type(channel_type)
    ch_cls = get_channel(channel_type)

    instance = ch_cls()
    return SetupFieldsResponse(
        channel_type=channel_type,
        display_name=instance.display_name,
        fields=instance.get_setup_fields(),
    )
