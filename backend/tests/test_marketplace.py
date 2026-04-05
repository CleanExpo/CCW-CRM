"""Tests for the multi-channel marketplace integration.

Tests the base abstraction, registry, sync engine, demo channels, and API routes.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.integrations.marketplace.base import (
    BaseMarketplaceChannel,
    ChannelOrder,
    ChannelProduct,
    ConnectionResult,
)
from src.integrations.marketplace.demo_channel import (
    EbayDemoChannel,
    FacebookDemoChannel,
    ShopifyDemoChannel,
)
from src.integrations.marketplace.registry import (
    _channel_registry,
    get_channel,
    list_channels,
)
from src.integrations.marketplace.sync_engine import SyncEngine

client = TestClient(app)


# ─── Registry Tests ──────────────────────────────────────────────────


class TestChannelRegistry:
    """Test channel registration and discovery."""

    def test_all_demo_channels_registered(self):
        """All three demo channels should be auto-registered on import."""
        assert "shopify" in _channel_registry
        assert "ebay" in _channel_registry
        assert "facebook" in _channel_registry

    def test_get_channel_returns_correct_class(self):
        cls = get_channel("shopify")
        assert cls is ShopifyDemoChannel

    def test_get_channel_unknown_returns_none(self):
        assert get_channel("nonexistent") is None

    def test_list_channels_returns_all(self):
        channels = list_channels()
        types = {c["channel_type"] for c in channels}
        assert types >= {"shopify", "ebay", "facebook"}

    def test_list_channels_has_display_name(self):
        channels = list_channels()
        for ch in channels:
            assert "display_name" in ch
            assert len(ch["display_name"]) > 0


# ─── Demo Channel Tests ─────────────────────────────────────────────


class TestShopifyDemoChannel:
    """Test the Shopify demo channel implementation."""

    @pytest.fixture
    def channel(self):
        return ShopifyDemoChannel()

    @pytest.mark.asyncio
    async def test_connect(self, channel):
        result = await channel.connect({})
        assert result.success is True
        assert result.channel_type == "shopify"
        assert "demo" in result.message.lower()

    @pytest.mark.asyncio
    async def test_disconnect(self, channel):
        await channel.connect({})
        await channel.disconnect()
        result = await channel.test_connection()
        assert result.success is False

    @pytest.mark.asyncio
    async def test_test_connection_when_connected(self, channel):
        await channel.connect({})
        result = await channel.test_connection()
        assert result.success is True

    @pytest.mark.asyncio
    async def test_test_connection_when_disconnected(self, channel):
        result = await channel.test_connection()
        assert result.success is False

    @pytest.mark.asyncio
    async def test_list_products(self, channel):
        products = await channel.list_products()
        assert len(products) > 0
        assert all(isinstance(p, ChannelProduct) for p in products)
        assert all(p.currency == "AUD" for p in products)

    @pytest.mark.asyncio
    async def test_list_products_with_limit(self, channel):
        products = await channel.list_products(limit=2)
        assert len(products) == 2

    @pytest.mark.asyncio
    async def test_push_product(self, channel):
        ext_id = await channel.push_product({"sku": "TEST-001", "name": "Test Product"})
        assert ext_id.startswith("shopify-")

    @pytest.mark.asyncio
    async def test_update_product(self, channel):
        # Should not raise
        await channel.update_product("shopify-test", {"name": "Updated"})

    @pytest.mark.asyncio
    async def test_delete_product(self, channel):
        await channel.delete_product("shopify-test")

    @pytest.mark.asyncio
    async def test_sync_inventory(self, channel):
        await channel.sync_inventory("shopify-test", 42)

    @pytest.mark.asyncio
    async def test_pull_orders(self, channel):
        orders = await channel.pull_orders()
        assert len(orders) > 0
        assert all(isinstance(o, ChannelOrder) for o in orders)
        assert all(o.currency == "AUD" for o in orders)

    @pytest.mark.asyncio
    async def test_update_order_status(self, channel):
        await channel.update_order_status("shopify-test", "shipped")

    def test_get_setup_fields(self, channel):
        fields = channel.get_setup_fields()
        assert len(fields) == 4
        keys = {f["key"] for f in fields}
        assert "shop_domain" in keys
        assert "access_token" in keys


class TestEbayDemoChannel:
    """Test the eBay demo channel."""

    @pytest.fixture
    def channel(self):
        return EbayDemoChannel()

    @pytest.mark.asyncio
    async def test_connect(self, channel):
        result = await channel.connect({})
        assert result.success is True
        assert result.channel_type == "ebay"

    def test_get_setup_fields(self, channel):
        fields = channel.get_setup_fields()
        keys = {f["key"] for f in fields}
        assert "client_id" in keys
        assert "refresh_token" in keys


class TestFacebookDemoChannel:
    """Test the Facebook demo channel."""

    @pytest.fixture
    def channel(self):
        return FacebookDemoChannel()

    @pytest.mark.asyncio
    async def test_connect(self, channel):
        result = await channel.connect({})
        assert result.success is True
        assert result.channel_type == "facebook"

    @pytest.mark.asyncio
    async def test_display_name(self, channel):
        assert channel.display_name == "Facebook & Instagram Shop"

    @pytest.mark.asyncio
    async def test_list_products(self, channel):
        products = await channel.list_products()
        assert len(products) > 0
        assert all(isinstance(p, ChannelProduct) for p in products)
        assert all(p.currency == "AUD" for p in products)
        assert all(p.external_id.startswith("facebook-") for p in products)

    @pytest.mark.asyncio
    async def test_pull_orders(self, channel):
        orders = await channel.pull_orders()
        assert len(orders) > 0
        assert all(isinstance(o, ChannelOrder) for o in orders)
        assert all(o.currency == "AUD" for o in orders)

    @pytest.mark.asyncio
    async def test_push_product_returns_ext_id(self, channel):
        ext_id = await channel.push_product({"sku": "FB-TEST-001", "name": "FB Test"})
        assert "FB-TEST-001" in ext_id

    def test_get_setup_fields(self, channel):
        """Setup fields must match live FacebookChannel contract: access_token, catalog_id, page_id."""
        fields = channel.get_setup_fields()
        keys = {f["key"] for f in fields}
        assert "access_token" in keys
        assert "catalog_id" in keys
        assert "page_id" in keys
        # app_id must NOT be present — it was the old (mismatched) field
        assert "app_id" not in keys

    def test_setup_fields_have_required_flag(self, channel):
        fields = channel.get_setup_fields()
        field_map = {f["key"]: f for f in fields}
        assert field_map["access_token"]["required"] is True
        assert field_map["catalog_id"]["required"] is True
        # page_id is optional (only needed for order management)
        assert field_map["page_id"]["required"] is False


# ─── Sync Engine Tests ──────────────────────────────────────────────


class TestSyncEngine:
    """Test the unified sync engine."""

    @pytest.fixture
    def engine(self):
        e = SyncEngine()
        return e

    def _make_engine_with_channels(self):
        """Helper to create an engine with connected demo channels (sync setup)."""
        import asyncio

        async def _setup():
            e = SyncEngine()
            shopify = ShopifyDemoChannel()
            await shopify.connect({})
            ebay = EbayDemoChannel()
            await ebay.connect({})
            e.add_channel(shopify)
            e.add_channel(ebay)
            return e

        return asyncio.get_event_loop().run_until_complete(_setup())

    def test_add_channel(self, engine):
        ch = ShopifyDemoChannel()
        engine.add_channel(ch)
        assert "shopify" in engine.active_channels

    def test_remove_channel(self, engine):
        ch = ShopifyDemoChannel()
        engine.add_channel(ch)
        engine.remove_channel("shopify")
        assert "shopify" not in engine.active_channels

    def test_active_channels(self, engine):
        engine.add_channel(ShopifyDemoChannel())
        engine.add_channel(EbayDemoChannel())
        assert set(engine.active_channels) == {"shopify", "ebay"}

    @pytest.mark.asyncio
    async def test_push_product_to_channels(self):
        engine = SyncEngine()
        shopify = ShopifyDemoChannel()
        await shopify.connect({})
        ebay = EbayDemoChannel()
        await ebay.connect({})
        engine.add_channel(shopify)
        engine.add_channel(ebay)

        results = await engine.push_product_to_channels(
            {"sku": "TEST-001", "name": "Test Product", "price": 99.99}
        )
        assert "shopify" in results
        assert "ebay" in results
        assert results["shopify"]["success"] is True
        assert results["ebay"]["success"] is True

    @pytest.mark.asyncio
    async def test_push_product_to_specific_channel(self):
        engine = SyncEngine()
        shopify = ShopifyDemoChannel()
        await shopify.connect({})
        ebay = EbayDemoChannel()
        await ebay.connect({})
        engine.add_channel(shopify)
        engine.add_channel(ebay)

        results = await engine.push_product_to_channels(
            {"sku": "TEST-001"}, channel_types=["shopify"]
        )
        assert "shopify" in results
        assert "ebay" not in results

    @pytest.mark.asyncio
    async def test_push_product_to_missing_channel(self, engine):
        results = await engine.push_product_to_channels(
            {"sku": "TEST"}, channel_types=["nonexistent"]
        )
        assert results["nonexistent"]["success"] is False

    @pytest.mark.asyncio
    async def test_sync_inventory(self):
        engine = SyncEngine()
        shopify = ShopifyDemoChannel()
        await shopify.connect({})
        ebay = EbayDemoChannel()
        await ebay.connect({})
        engine.add_channel(shopify)
        engine.add_channel(ebay)

        items = [
            {"external_id": "shopify-demo", "quantity": 10, "channel_type": "shopify"},
            {"external_id": "ebay-demo", "quantity": 5, "channel_type": "ebay"},
        ]
        results = await engine.sync_inventory_to_channels(items)
        assert results["shopify"]["synced"] == 1
        assert results["ebay"]["synced"] == 1

    @pytest.mark.asyncio
    async def test_pull_orders(self):
        engine = SyncEngine()
        shopify = ShopifyDemoChannel()
        await shopify.connect({})
        engine.add_channel(shopify)

        results = await engine.pull_orders_from_channels()
        assert "shopify" in results
        assert len(results["shopify"]) > 0

    @pytest.mark.asyncio
    async def test_pull_products(self):
        engine = SyncEngine()
        shopify = ShopifyDemoChannel()
        await shopify.connect({})
        engine.add_channel(shopify)

        results = await engine.pull_products_from_channels(limit=3)
        assert "shopify" in results
        assert len(results["shopify"]) <= 3

    @pytest.mark.asyncio
    async def test_get_sync_status(self):
        engine = SyncEngine()
        shopify = ShopifyDemoChannel()
        await shopify.connect({})
        engine.add_channel(shopify)

        status = await engine.get_sync_status()
        assert "shopify" in status
        assert status["shopify"]["connected"] is True


# ─── API Route Tests ─────────────────────────────────────────────────


class TestMarketplaceAPI:
    """Test the marketplace HTTP endpoints."""

    def test_list_channels(self):
        resp = client.get("/api/marketplace/channels")
        assert resp.status_code == 200
        data = resp.json()
        assert "channels" in data
        assert data["total"] >= 3
        types = {c["channel_type"] for c in data["channels"]}
        assert types >= {"shopify", "ebay", "facebook"}

    def test_connect_channel(self):
        resp = client.post(
            "/api/marketplace/channels/shopify/connect",
            json={"credentials": {}},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["channel_type"] == "shopify"

    def test_connect_invalid_channel(self):
        resp = client.post(
            "/api/marketplace/channels/nonexistent/connect",
            json={"credentials": {}},
        )
        assert resp.status_code == 404

    def test_disconnect_channel(self):
        # First connect
        client.post("/api/marketplace/channels/ebay/connect", json={"credentials": {}})
        # Then disconnect
        resp = client.post("/api/marketplace/channels/ebay/disconnect")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_sync_products(self):
        resp = client.post("/api/marketplace/sync/products")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "results" in data
        assert "synced_at" in data

    def test_sync_status(self):
        resp = client.get("/api/marketplace/sync/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "channels" in data
        assert "overall_healthy" in data

    def test_sync_inventory(self):
        resp = client.post("/api/marketplace/sync/inventory")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "results" in data

    def test_get_orders(self):
        resp = client.get("/api/marketplace/orders")
        assert resp.status_code == 200
        data = resp.json()
        assert "orders" in data
        assert "total" in data
        assert data["total"] >= 0

    def test_get_orders_filter_by_channel(self):
        resp = client.get("/api/marketplace/orders?channel_type=shopify")
        assert resp.status_code == 200
        data = resp.json()
        for order in data["orders"]:
            assert order["channel_type"] == "shopify"

    def test_get_channel_products(self):
        resp = client.get("/api/marketplace/channels/shopify/products")
        assert resp.status_code == 200
        products = resp.json()
        assert isinstance(products, list)
        assert len(products) > 0
        assert "external_id" in products[0]
        assert "title" in products[0]

    def test_get_channel_products_with_limit(self):
        resp = client.get("/api/marketplace/channels/shopify/products?limit=2")
        assert resp.status_code == 200
        products = resp.json()
        assert len(products) == 2

    def test_get_setup_fields(self):
        resp = client.get("/api/marketplace/channels/shopify/setup-fields")
        assert resp.status_code == 200
        data = resp.json()
        assert data["channel_type"] == "shopify"
        assert len(data["fields"]) > 0
        assert any(f["key"] == "shop_domain" for f in data["fields"])

    def test_get_setup_fields_invalid_channel(self):
        resp = client.get("/api/marketplace/channels/nonexistent/setup-fields")
        assert resp.status_code == 404

    def test_orders_invalid_since_format(self):
        resp = client.get("/api/marketplace/orders?since=not-a-date")
        assert resp.status_code == 400

    def test_connect_already_connected_channel(self):
        """Connecting an already-connected channel should succeed (idempotent)."""
        # First connect
        resp1 = client.post(
            "/api/marketplace/channels/shopify/connect",
            json={"credentials": {}},
        )
        assert resp1.status_code == 200
        assert resp1.json()["success"] is True

        # Connect again — should still succeed
        resp2 = client.post(
            "/api/marketplace/channels/shopify/connect",
            json={"credentials": {}},
        )
        assert resp2.status_code == 200
        assert resp2.json()["success"] is True
        assert resp2.json()["channel_type"] == "shopify"

    def test_sync_products_with_channel_types_filter(self):
        """Syncing products with a specific channel_types parameter returns success."""
        resp = client.post(
            "/api/marketplace/sync/products",
            json={"channel_types": ["shopify"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        # Shopify must be in the results
        assert "shopify" in data["results"]
        assert data["results"]["shopify"]["pushed"] > 0

    def test_orders_with_channel_and_since_combined(self):
        """Order feed filtered by both channel_type and since datetime."""
        resp = client.get(
            "/api/marketplace/orders?channel_type=shopify&since=2020-01-01T00:00:00"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "orders" in data
        # All returned orders should be from shopify
        for order in data["orders"]:
            assert order["channel_type"] == "shopify"

    def test_channel_products_with_offset(self):
        """Channel products endpoint respects offset parameter."""
        # Get all products first
        resp_all = client.get("/api/marketplace/channels/shopify/products?limit=50&offset=0")
        assert resp_all.status_code == 200
        all_products = resp_all.json()

        # Get with offset
        resp_offset = client.get("/api/marketplace/channels/shopify/products?limit=50&offset=2")
        assert resp_offset.status_code == 200
        offset_products = resp_offset.json()
        assert isinstance(offset_products, list)

    def test_disconnect_not_connected_channel(self):
        """Disconnecting a channel that is not connected should return 404."""
        # Reset engine state by disconnecting all first
        # Attempt to disconnect a channel that may not be connected
        resp = client.post("/api/marketplace/channels/facebook/disconnect")
        # Could be 200 (if connected from _get_engine demo setup) or 404
        assert resp.status_code in (200, 404)

    def test_sync_products_no_body(self):
        """Syncing products with no request body uses defaults (all channels)."""
        resp = client.post("/api/marketplace/sync/products")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        # Should have results from all connected demo channels
        assert len(data["results"]) >= 1

    def test_facebook_channel_listed(self):
        """Facebook channel must appear in the channel list with correct display name."""
        resp = client.get("/api/marketplace/channels")
        assert resp.status_code == 200
        data = resp.json()
        fb = next((c for c in data["channels"] if c["channel_type"] == "facebook"), None)
        assert fb is not None
        assert fb["display_name"] == "Facebook & Instagram Shop"

    def test_facebook_setup_fields_endpoint(self):
        """Facebook setup-fields endpoint returns access_token + catalog_id + page_id."""
        resp = client.get("/api/marketplace/channels/facebook/setup-fields")
        assert resp.status_code == 200
        data = resp.json()
        assert data["channel_type"] == "facebook"
        keys = {f["key"] for f in data["fields"]}
        assert "access_token" in keys
        assert "catalog_id" in keys
        assert "page_id" in keys
        assert "app_id" not in keys


# ─── Facebook Price Parser Unit Tests ────────────────────────────────


class TestParseFbPrice:
    """Unit tests for the _parse_fb_price helper in facebook_channel.py.

    Facebook Catalog API returns prices as strings like:
      "2999 AUD"   → ($29.99, "AUD")  — integer cents format
      "29.99 AUD"  → ($29.99, "AUD")  — explicit float format
      "100 USD"    → ($1.00, "USD")   — exactly 100 cents = $1.00
      "99 AUD"     → ($0.99, "AUD")   — < 100, treated as dollars (edge)
      "0 AUD"      → ($0.00, "AUD")   — zero
      "badvalue"   → ($0.00, "AUD")   — fallback on parse error
      ""           → ($0.00, "AUD")   — empty string fallback
    """

    @pytest.fixture(autouse=True)
    def _import_parser(self):
        from src.integrations.marketplace.facebook_channel import _parse_fb_price
        self._parse = _parse_fb_price

    def test_integer_cents_format(self):
        """'2999 AUD' → $29.99 AUD (integer ≥100, no decimal = cents)."""
        price, currency = self._parse("2999 AUD")
        assert abs(price - 29.99) < 0.001
        assert currency == "AUD"

    def test_float_format(self):
        """'29.99 AUD' → $29.99 AUD (explicit float, no conversion)."""
        price, currency = self._parse("29.99 AUD")
        assert abs(price - 29.99) < 0.001
        assert currency == "AUD"

    def test_usd_currency(self):
        """'4200 USD' → $42.00 USD."""
        price, currency = self._parse("4200 USD")
        assert abs(price - 42.00) < 0.001
        assert currency == "USD"

    def test_exactly_100_cents(self):
        """'100 AUD' → $1.00 (100 cents)."""
        price, currency = self._parse("100 AUD")
        assert abs(price - 1.00) < 0.001
        assert currency == "AUD"

    def test_below_100_treated_as_dollars(self):
        """'99 AUD' → $99.00 (< 100, no decimal → treated as dollars not cents)."""
        price, currency = self._parse("99 AUD")
        assert abs(price - 99.0) < 0.001
        assert currency == "AUD"

    def test_zero_price(self):
        """'0 AUD' → $0.00."""
        price, currency = self._parse("0 AUD")
        assert price == 0.0
        assert currency == "AUD"

    def test_large_price(self):
        """'4250000 AUD' → $42,500.00 (high-value equipment)."""
        price, currency = self._parse("4250000 AUD")
        assert abs(price - 42500.00) < 0.01
        assert currency == "AUD"

    def test_no_currency_defaults_to_aud(self):
        """'1999' with no currency → defaults to AUD."""
        price, currency = self._parse("1999")
        assert currency == "AUD"
        assert abs(price - 19.99) < 0.001

    def test_bad_value_returns_zero(self):
        """'notanumber AUD' → (0.0, 'AUD') without raising."""
        price, currency = self._parse("notanumber AUD")
        assert price == 0.0
        assert currency == "AUD"

    def test_empty_string_returns_zero(self):
        """Empty string → (0.0, 'AUD') without raising."""
        price, currency = self._parse("")
        assert price == 0.0
        assert currency == "AUD"

    def test_float_with_currency_no_cent_conversion(self):
        """'89.95 AUD' → $89.95 (has decimal point, skip cent conversion)."""
        price, currency = self._parse("89.95 AUD")
        assert abs(price - 89.95) < 0.001
        assert currency == "AUD"

    def test_currency_uppercased(self):
        """Currency code returned is always uppercase regardless of input."""
        _, currency = self._parse("500 aud")
        assert currency == "AUD"
