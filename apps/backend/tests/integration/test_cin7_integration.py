"""Integration tests for Cin7 API clients and endpoints.

Tests demo mode functionality, client routing, and API endpoint responses.
"""

import pytest
from httpx import AsyncClient

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.integrations.cin7.client import Cin7Client, get_cin7_client
from src.integrations.cin7.demo_client import Cin7CoreDemoClient, Cin7OmniDemoClient


class TestCin7Settings:
    """Test Cin7 settings configuration."""

    def test_default_settings_are_demo_mode(self):
        """Settings default to demo mode."""
        settings = Cin7Settings()
        assert settings.is_demo_mode is True
        assert settings.is_live_mode is False

    def test_settings_factory_returns_instance(self):
        """Factory function returns a settings instance."""
        settings = get_cin7_settings()
        assert isinstance(settings, Cin7Settings)

    def test_core_api_url_strips_trailing_slash(self):
        """Core API URL property strips trailing slashes."""
        settings = Cin7Settings()
        assert not settings.core_api_url.endswith("/")

    def test_omni_api_url_strips_trailing_slash(self):
        """Omni API URL property strips trailing slashes."""
        settings = Cin7Settings()
        assert not settings.omni_api_url.endswith("/")

    def test_sync_toggles_default_true(self):
        """All sync toggles default to True."""
        settings = Cin7Settings()
        assert settings.sync_products is True
        assert settings.sync_customers is True
        assert settings.sync_sales is True
        assert settings.sync_inventory is True


class TestCin7CoreDemoClient:
    """Test Cin7 Core demo client mock responses."""

    @pytest.fixture
    def client(self):
        return Cin7CoreDemoClient()

    @pytest.mark.asyncio
    async def test_get_me(self, client):
        """get_me returns company info."""
        data = await client.get_me()
        assert "Company" in data
        assert data["Currency"] == "AUD"

    @pytest.mark.asyncio
    async def test_get_products(self, client):
        """get_products returns paginated product list."""
        data = await client.get_products(page=1, limit=10)
        assert "Products" in data
        assert "Total" in data
        assert len(data["Products"]) > 0
        product = data["Products"][0]
        assert "SKU" in product
        assert "Name" in product
        assert "PriceTier1" in product

    @pytest.mark.asyncio
    async def test_get_customers(self, client):
        """get_customers returns customer list with contacts."""
        data = await client.get_customers()
        assert "CustomerList" in data
        assert len(data["CustomerList"]) > 0
        customer = data["CustomerList"][0]
        assert "Name" in customer
        assert "Contacts" in customer
        assert len(customer["Contacts"]) > 0

    @pytest.mark.asyncio
    async def test_get_suppliers(self, client):
        """get_suppliers returns supplier list."""
        data = await client.get_suppliers()
        assert "SupplierList" in data
        assert len(data["SupplierList"]) > 0

    @pytest.mark.asyncio
    async def test_get_locations(self, client):
        """get_locations returns warehouse locations."""
        data = await client.get_locations()
        assert "LocationList" in data
        locations = data["LocationList"]
        assert len(locations) == 3
        assert locations[0]["Name"] == "Brisbane Warehouse"

    @pytest.mark.asyncio
    async def test_get_product_availability(self, client):
        """get_product_availability returns stock levels."""
        data = await client.get_product_availability()
        assert "ProductAvailabilityList" in data
        avail = data["ProductAvailabilityList"][0]
        assert "OnHand" in avail
        assert "Available" in avail
        assert "OnOrder" in avail


class TestCin7OmniDemoClient:
    """Test Cin7 Omni demo client mock responses."""

    @pytest.fixture
    def client(self):
        return Cin7OmniDemoClient()

    @pytest.mark.asyncio
    async def test_get_products(self, client):
        """get_products returns product array."""
        data = await client.get_products()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "styleCode" in data[0]
        assert "retailPrice" in data[0]

    @pytest.mark.asyncio
    async def test_get_contacts(self, client):
        """get_contacts returns contact array."""
        data = await client.get_contacts()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "company" in data[0]
        assert "email" in data[0]

    @pytest.mark.asyncio
    async def test_get_sales_orders(self, client):
        """get_sales_orders returns order array."""
        data = await client.get_sales_orders()
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.asyncio
    async def test_get_branches(self, client):
        """get_branches returns branch locations."""
        data = await client.get_branches()
        assert isinstance(data, list)
        assert len(data) == 3
        assert data[0]["name"] == "Brisbane Warehouse"

    @pytest.mark.asyncio
    async def test_get_stock(self, client):
        """get_stock returns stock level array."""
        data = await client.get_stock()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "stockAvailable" in data[0]
        assert "stockOnHand" in data[0]


class TestCin7UnifiedClient:
    """Test unified Cin7 client routing."""

    @pytest.mark.asyncio
    async def test_demo_mode_uses_demo_clients(self):
        """In demo mode, client routes to demo implementations."""
        settings = Cin7Settings(mode="demo")
        client = Cin7Client(settings)
        assert client.is_demo_mode is True
        assert isinstance(client.core, Cin7CoreDemoClient)
        assert isinstance(client.omni, Cin7OmniDemoClient)

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Client works as async context manager."""
        settings = Cin7Settings(mode="demo")
        async with Cin7Client(settings) as client:
            data = await client.core.get_me()
            assert "Company" in data

    @pytest.mark.asyncio
    async def test_test_connection(self):
        """test_connection returns status for both APIs."""
        settings = Cin7Settings(mode="demo")
        async with Cin7Client(settings) as client:
            result = await client.test_connection()
            assert result["mode"] == "demo"
            assert result["core"]["status"] == "connected"
            assert result["omni"]["status"] == "connected"

    def test_factory_function(self):
        """get_cin7_client factory returns Cin7Client."""
        client = get_cin7_client()
        assert isinstance(client, Cin7Client)


class TestCin7APIEndpoints:
    """Test Cin7 API route endpoints (requires running app)."""

    @pytest.mark.asyncio
    async def test_cin7_test_endpoint(self, client: AsyncClient, auth_token: str):
        """GET /api/integrations/cin7/test returns connection status."""
        response = await client.get(
            "/api/integrations/cin7/test",
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["mode"] == "demo"

    @pytest.mark.asyncio
    async def test_cin7_status_endpoint(self, client: AsyncClient, auth_token: str):
        """GET /api/integrations/cin7/status returns config."""
        response = await client.get(
            "/api/integrations/cin7/status",
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "demo"
        assert "sync_config" in data

    @pytest.mark.asyncio
    async def test_cin7_locations_endpoint(self, client: AsyncClient, auth_token: str):
        """GET /api/integrations/cin7/locations returns location data."""
        response = await client.get(
            "/api/integrations/cin7/locations",
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "core_locations" in data
        assert "omni_branches" in data

    @pytest.mark.asyncio
    async def test_cin7_products_preview_core(
        self, client: AsyncClient, auth_token: str
    ):
        """GET /api/integrations/cin7/products/preview returns products from Core."""
        response = await client.get(
            "/api/integrations/cin7/products/preview",
            params={"source": "core", "limit": 5},
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "cin7_core"
        assert "products" in data
        assert len(data["products"]) > 0

    @pytest.mark.asyncio
    async def test_cin7_products_preview_omni(
        self, client: AsyncClient, auth_token: str
    ):
        """GET /api/integrations/cin7/products/preview returns products from Omni."""
        response = await client.get(
            "/api/integrations/cin7/products/preview",
            params={"source": "omni", "limit": 5},
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "cin7_omni"
        assert "products" in data

    @pytest.mark.asyncio
    async def test_cin7_products_preview_invalid_source(
        self, client: AsyncClient, auth_token: str
    ):
        """GET /api/integrations/cin7/products/preview rejects invalid source."""
        response = await client.get(
            "/api/integrations/cin7/products/preview",
            params={"source": "invalid"},
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_cin7_customers_preview(
        self, client: AsyncClient, auth_token: str
    ):
        """GET /api/integrations/cin7/customers/preview returns customer data."""
        response = await client.get(
            "/api/integrations/cin7/customers/preview",
            params={"source": "core"},
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "cin7_core"
        assert "customers" in data

    @pytest.mark.asyncio
    async def test_cin7_inventory_preview(
        self, client: AsyncClient, auth_token: str
    ):
        """GET /api/integrations/cin7/inventory/preview returns stock data."""
        response = await client.get(
            "/api/integrations/cin7/inventory/preview",
            params={"source": "core"},
            cookies={"auth_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["source"] == "cin7_core"
        assert "availability" in data
