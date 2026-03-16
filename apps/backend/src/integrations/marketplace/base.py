"""Base marketplace channel abstraction.

Defines the interface that all marketplace channel implementations must follow.
Each channel (Shopify, eBay, Facebook) implements this ABC.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ConnectionResult:
    """Result of a channel connection attempt."""

    success: bool
    channel_type: str
    message: str
    metadata: dict = field(default_factory=dict)


@dataclass
class ChannelProduct:
    """Normalised product representation from a marketplace channel."""

    external_id: str
    title: str
    sku: str | None = None
    description: str | None = None
    price: float = 0.0
    currency: str = "AUD"
    quantity: int = 0
    images: list[str] = field(default_factory=list)
    url: str | None = None
    status: str = "active"
    category: str | None = None
    variant_id: str | None = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class ChannelOrder:
    """Normalised order representation from a marketplace channel."""

    external_id: str
    external_order_number: str | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    total_amount: float = 0.0
    currency: str = "AUD"
    status: str = "pending"
    line_items: list[dict] = field(default_factory=list)
    shipping_address: dict = field(default_factory=dict)
    ordered_at: datetime | None = None
    raw_data: dict = field(default_factory=dict)


class BaseMarketplaceChannel(ABC):
    """Abstract base class for marketplace channel implementations.

    Each marketplace (Shopify, eBay, Facebook) must implement all methods.
    The sync engine calls these methods uniformly regardless of channel.
    """

    channel_type: str  # "shopify", "ebay", "facebook"
    display_name: str  # "Shopify", "eBay", "Facebook Marketplace"

    @abstractmethod
    async def connect(self, credentials: dict) -> ConnectionResult:
        """Connect to the marketplace using provided credentials.

        Args:
            credentials: Channel-specific credential dict.

        Returns:
            ConnectionResult with success status and metadata.
        """

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the marketplace and clean up resources."""

    @abstractmethod
    async def test_connection(self) -> ConnectionResult:
        """Test that the current connection is valid.

        Returns:
            ConnectionResult indicating if the connection is healthy.
        """

    @abstractmethod
    async def list_products(self, limit: int = 50, offset: int = 0) -> list[ChannelProduct]:
        """List products from the marketplace channel.

        Args:
            limit: Max products to return.
            offset: Pagination offset.

        Returns:
            List of normalised ChannelProduct objects.
        """

    @abstractmethod
    async def push_product(self, product: dict) -> str:
        """Create or update a product on the marketplace.

        Args:
            product: ERP product data to push.

        Returns:
            External product ID on the channel.
        """

    @abstractmethod
    async def update_product(self, external_id: str, product: dict) -> None:
        """Update an existing product on the marketplace.

        Args:
            external_id: The product ID on the channel.
            product: Updated product data.
        """

    @abstractmethod
    async def delete_product(self, external_id: str) -> None:
        """Remove a product from the marketplace.

        Args:
            external_id: The product ID on the channel.
        """

    @abstractmethod
    async def sync_inventory(self, external_id: str, quantity: int) -> None:
        """Push inventory level for a product to the marketplace.

        Args:
            external_id: The product ID on the channel.
            quantity: New stock quantity.
        """

    @abstractmethod
    async def pull_orders(self, since: datetime | None = None) -> list[ChannelOrder]:
        """Pull orders from the marketplace since a given time.

        Args:
            since: Only return orders created after this time.
                   If None, returns recent orders (channel-specific default).

        Returns:
            List of normalised ChannelOrder objects.
        """

    @abstractmethod
    async def update_order_status(self, external_id: str, status: str) -> None:
        """Update order status on the marketplace.

        Args:
            external_id: The order ID on the channel.
            status: New status string (channel will map to its own statuses).
        """

    @abstractmethod
    def get_setup_fields(self) -> list[dict]:
        """Return the credential fields required for setup UI.

        Each field: {"key": str, "label": str, "type": "text"|"password"|"url", "required": bool, "placeholder": str}

        Returns:
            List of field descriptors for the frontend setup wizard.
        """
