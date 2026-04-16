"""Cin7 API Clients.

Provides unified interface for both Cin7 Core (DEAR) and Cin7 Omni APIs.
Automatically routes to demo or live client based on configuration.

Authentication:
- Cin7 Core: api-auth-accountid + api-auth-applicationkey headers
- Cin7 Omni: HTTP Basic Auth (username:api_key)
"""

import base64
from typing import Any

import httpx
import structlog

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.integrations.cin7.demo_client import Cin7CoreDemoClient, Cin7OmniDemoClient


class ConfigurationError(Exception):
    """Raised when a required integration credential is missing or invalid."""

logger = structlog.get_logger(__name__)


class Cin7APIError(Exception):
    """Exception raised for Cin7 API errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        api: str = "unknown",
    ):
        self.message = message
        self.status_code = status_code
        self.api = api
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Cin7 Core (DEAR Inventory) Live Client
# ---------------------------------------------------------------------------


class Cin7CoreLiveClient:
    """Live client for Cin7 Core (DEAR Inventory) API.

    Auth: Custom headers — api-auth-accountid + api-auth-applicationkey
    Base URL: https://inventory.dearsystems.com/ExternalApi/v2/
    Rate limit: 60 requests/minute
    """

    def __init__(self, settings: Cin7Settings) -> None:
        self.settings = settings
        self.base_url = settings.core_api_url
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "api-auth-accountid": settings.core_account_id,
                "api-auth-applicationkey": settings.core_application_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=float(settings.api_timeout),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Make authenticated request to Cin7 Core API."""
        try:
            response = await self.client.request(
                method,
                endpoint,
                params=params,
                json=json,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text
            logger.error(
                "cin7_core_api_error",
                status_code=e.response.status_code,
                endpoint=endpoint,
                detail=error_detail[:500],
            )
            raise Cin7APIError(
                f"Cin7 Core API error ({e.response.status_code}): {error_detail}",
                status_code=e.response.status_code,
                api="core",
            ) from e
        except httpx.RequestError as e:
            logger.error("cin7_core_request_failed", endpoint=endpoint, error=str(e))
            raise Cin7APIError(
                f"Cin7 Core API request failed: {e!s}",
                api="core",
            ) from e

    async def get_me(self) -> dict[str, Any]:
        """Get account info — used to test connectivity."""
        return await self._request("GET", "/me")

    async def get_products(
        self,
        page: int = 1,
        limit: int = 100,
        modified_since: str | None = None,
    ) -> dict[str, Any]:
        """Get products with pagination."""
        params: dict[str, Any] = {"Page": page, "Limit": limit}
        if modified_since:
            params["ModifiedSince"] = modified_since
        return await self._request("GET", "/product", params=params)

    async def get_customers(
        self,
        page: int = 1,
        limit: int = 100,
        modified_since: str | None = None,
    ) -> dict[str, Any]:
        """Get customers with pagination."""
        params: dict[str, Any] = {"Page": page, "Limit": limit}
        if modified_since:
            params["ModifiedSince"] = modified_since
        return await self._request("GET", "/customer", params=params)

    async def get_suppliers(
        self,
        page: int = 1,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get suppliers with pagination."""
        return await self._request(
            "GET", "/supplier", params={"Page": page, "Limit": limit}
        )

    async def get_sale_list(
        self,
        page: int = 1,
        limit: int = 100,
        modified_since: str | None = None,
    ) -> dict[str, Any]:
        """Get sales list with pagination."""
        params: dict[str, Any] = {"Page": page, "Limit": limit}
        if modified_since:
            params["ModifiedSince"] = modified_since
        return await self._request("GET", "/saleList", params=params)

    async def get_purchase_list(
        self,
        page: int = 1,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Get purchase orders list with pagination."""
        return await self._request(
            "GET", "/purchaseList", params={"Page": page, "Limit": limit}
        )

    async def get_product_availability(
        self,
        sku: str | None = None,
    ) -> dict[str, Any]:
        """Get product availability (stock levels by location)."""
        params: dict[str, Any] = {}
        if sku:
            params["SKU"] = sku
        return await self._request("GET", "/ref/productavailability", params=params)

    async def get_locations(self) -> dict[str, Any]:
        """Get warehouse locations."""
        return await self._request("GET", "/ref/location")

    async def get_product_categories(self) -> dict[str, Any]:
        """Get product categories."""
        return await self._request("GET", "/ref/category")

    async def get_product_brands(self) -> dict[str, Any]:
        """Get product brands."""
        return await self._request("GET", "/ref/brand")

    async def post_sales_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a sales order in Cin7 Core (DEAR).

        Endpoint: POST /sale
        Required payload keys: ``SaleOrderNumber``, ``Status``, ``Customer``
        (object with ``Name``), ``Lines`` (list of line items with
        ``SKU``, ``Quantity``, ``Price``).

        Returns the created sale record including the Cin7 ``SaleID``.

        Raises:
            ConfigurationError: if Core credentials are demo placeholders.
            Cin7APIError: on HTTP errors from the Cin7 API.
        """
        if (
            self.settings.core_account_id == "demo_account_id"
            or self.settings.core_application_key == "demo_application_key"
        ):
            raise ConfigurationError(
                "Cin7 Core credentials are not configured. "
                "Set CIN7_CORE_ACCOUNT_ID and CIN7_CORE_APPLICATION_KEY "
                "environment variables."
            )
        return await self._request("POST", "/sale", json=payload)

    async def post_purchase_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a purchase order in Cin7 Core (DEAR).

        Endpoint: POST /purchase
        Required payload keys: ``SupplierName`` (str), ``OrderDate`` (YYYY-MM-DD
        str), ``Lines`` (list of line items with ``SKU``, ``Quantity``,
        ``Price``).

        Returns the created purchase record including the Cin7 ``PurchaseID``.

        Raises:
            ConfigurationError: if Core credentials are demo placeholders.
            Cin7APIError: on HTTP errors from the Cin7 API.
        """
        if (
            self.settings.core_account_id == "demo_account_id"
            or self.settings.core_application_key == "demo_application_key"
        ):
            raise ConfigurationError(
                "Cin7 Core credentials are not configured. "
                "Set CIN7_CORE_ACCOUNT_ID and CIN7_CORE_APPLICATION_KEY "
                "environment variables."
            )
        return await self._request("POST", "/purchase", json=payload)


# ---------------------------------------------------------------------------
# Cin7 Omni Live Client
# ---------------------------------------------------------------------------


class Cin7OmniLiveClient:
    """Live client for Cin7 Omni API.

    Auth: HTTP Basic Auth (username:api_key)
    Base URL: https://api.cin7.com/api/v1/
    Rate limit: 3/sec, 60/min, 5000/day
    """

    def __init__(self, settings: Cin7Settings) -> None:
        self.settings = settings
        self.base_url = settings.omni_api_url
        credentials = f"{settings.omni_username}:{settings.omni_api_key}"
        encoded = base64.b64encode(credentials.encode()).decode()
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=float(settings.api_timeout),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        """Make authenticated request to Cin7 Omni API."""
        try:
            response = await self.client.request(
                method,
                endpoint,
                params=params,
                json=json,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text
            logger.error(
                "cin7_omni_api_error",
                status_code=e.response.status_code,
                endpoint=endpoint,
                detail=error_detail[:500],
            )
            raise Cin7APIError(
                f"Cin7 Omni API error ({e.response.status_code}): {error_detail}",
                status_code=e.response.status_code,
                api="omni",
            ) from e
        except httpx.RequestError as e:
            logger.error("cin7_omni_request_failed", endpoint=endpoint, error=str(e))
            raise Cin7APIError(
                f"Cin7 Omni API request failed: {e!s}",
                api="omni",
            ) from e

    async def get_products(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Get products with pagination."""
        return await self._request(
            "GET", "/Products", params={"page": page, "rows": rows}
        )

    async def get_contacts(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Get contacts (customers/suppliers)."""
        return await self._request(
            "GET", "/Contacts", params={"page": page, "rows": rows}
        )

    async def get_sales_orders(
        self,
        page: int = 1,
        rows: int = 50,
        modified_since: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get sales orders with pagination."""
        params: dict[str, Any] = {"page": page, "rows": rows}
        if modified_since:
            params["modifiedSince"] = modified_since
        return await self._request("GET", "/SalesOrders", params=params)

    async def get_purchase_orders(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Get purchase orders with pagination."""
        return await self._request(
            "GET", "/PurchaseOrders", params={"page": page, "rows": rows}
        )

    async def get_quotes(
        self,
        page: int = 1,
        rows: int = 50,
    ) -> list[dict[str, Any]]:
        """Get quotes with pagination."""
        return await self._request(
            "GET", "/Quotes", params={"page": page, "rows": rows}
        )

    async def get_stock(
        self,
        sku: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get stock levels."""
        params: dict[str, Any] = {}
        if sku:
            params["StyleCode"] = sku
        return await self._request("GET", "/Stock", params=params)

    async def get_branches(self) -> list[dict[str, Any]]:
        """Get branch/warehouse locations."""
        return await self._request("GET", "/Branches")

    async def get_product_categories(self) -> list[dict[str, Any]]:
        """Get product categories."""
        return await self._request("GET", "/ProductCategories")

    async def post_sales_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a sales order in Cin7 Omni.

        Endpoint: POST /v1/SalesOrders
        Required payload keys: ``LineItems`` (list), ``Contact`` (object with
        ``Name``), ``OrderDate`` (ISO 8601 string), ``Status`` (e.g. ``"DRAFT"``).

        Returns the created sales order object including the Cin7 order ``id``.

        Raises:
            ConfigurationError: if Omni credentials are demo placeholders.
            Cin7APIError: on HTTP errors from the Cin7 API.
        """
        if (
            self.settings.omni_username == "demo_omni_username"
            or self.settings.omni_api_key == "demo_omni_api_key"
        ):
            raise ConfigurationError(
                "Cin7 Omni credentials are not configured. "
                "Set CIN7_OMNI_USERNAME and CIN7_OMNI_API_KEY "
                "environment variables."
            )
        return await self._request("POST", "/SalesOrders", json=payload)

    async def post_purchase_order(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a purchase order in Cin7 Omni.

        Endpoint: POST /v1/PurchaseOrders
        Required payload keys: ``LineItems`` (list), ``Supplier`` (object with
        ``Name``), ``OrderDate`` (ISO 8601 string).

        Returns the created purchase order object including the Cin7 PO ``id``.

        Raises:
            ConfigurationError: if Omni credentials are demo placeholders.
            Cin7APIError: on HTTP errors from the Cin7 API.
        """
        if (
            self.settings.omni_username == "demo_omni_username"
            or self.settings.omni_api_key == "demo_omni_api_key"
        ):
            raise ConfigurationError(
                "Cin7 Omni credentials are not configured. "
                "Set CIN7_OMNI_USERNAME and CIN7_OMNI_API_KEY "
                "environment variables."
            )
        return await self._request("POST", "/PurchaseOrders", json=payload)


# ---------------------------------------------------------------------------
# Unified Cin7 Client (routes to Core/Omni/Demo based on settings)
# ---------------------------------------------------------------------------


class Cin7Client:
    """Unified Cin7 client providing access to both Core and Omni APIs.

    In demo mode, routes to demo clients. In live mode, routes to live clients.
    Access the individual APIs via .core and .omni properties.
    """

    def __init__(self, settings: Cin7Settings | None = None) -> None:
        self.settings = settings or get_cin7_settings()

        if self.settings.is_demo_mode:
            self._core: Cin7CoreLiveClient | Cin7CoreDemoClient = Cin7CoreDemoClient()
            self._omni: Cin7OmniLiveClient | Cin7OmniDemoClient = Cin7OmniDemoClient()
            logger.info("cin7_client_initialized", mode="demo")
        else:
            self._core = Cin7CoreLiveClient(self.settings)
            self._omni = Cin7OmniLiveClient(self.settings)
            logger.info("cin7_client_initialized", mode="live")

    async def __aenter__(self):
        if hasattr(self._core, "__aenter__"):
            await self._core.__aenter__()
        if hasattr(self._omni, "__aenter__"):
            await self._omni.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if hasattr(self._core, "__aexit__"):
            await self._core.__aexit__(exc_type, exc_val, exc_tb)
        if hasattr(self._omni, "__aexit__"):
            await self._omni.__aexit__(exc_type, exc_val, exc_tb)

    @property
    def core(self) -> Cin7CoreLiveClient | Cin7CoreDemoClient:
        """Access Cin7 Core (DEAR) API client."""
        return self._core

    @property
    def omni(self) -> Cin7OmniLiveClient | Cin7OmniDemoClient:
        """Access Cin7 Omni API client."""
        return self._omni

    @property
    def is_demo_mode(self) -> bool:
        return self.settings.is_demo_mode

    async def test_connection(self) -> dict[str, Any]:
        """Test connectivity to both Cin7 APIs.

        Returns status for each API (core + omni).
        """
        results: dict[str, Any] = {"mode": self.settings.mode}

        # Test Core API
        try:
            me = await self._core.get_me()
            results["core"] = {
                "status": "connected",
                "company": me.get("Company", "Unknown"),
            }
        except Exception as e:
            results["core"] = {"status": "error", "message": str(e)}

        # Test Omni API
        try:
            branches = await self._omni.get_branches()
            branch_count = len(branches) if isinstance(branches, list) else 0
            results["omni"] = {
                "status": "connected",
                "branches": branch_count,
            }
        except Exception as e:
            results["omni"] = {"status": "error", "message": str(e)}

        return results


def get_cin7_client(settings: Cin7Settings | None = None) -> Cin7Client:
    """Factory function to get Cin7 client instance."""
    return Cin7Client(settings)
