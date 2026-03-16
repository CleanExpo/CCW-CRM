"""Marketplace integration database models.

Generic multi-channel models for storing connection details, product listings,
orders, and inventory sync state across Shopify, eBay, Facebook, etc.
"""

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class ChannelType(str, enum.Enum):
    """Supported marketplace channels."""

    SHOPIFY = "shopify"
    EBAY = "ebay"
    FACEBOOK = "facebook"


class ConnectionStatus(str, enum.Enum):
    """Channel connection status."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PENDING = "pending"


class ListingStatus(str, enum.Enum):
    """Product listing status on a channel."""

    ACTIVE = "active"
    DRAFT = "draft"
    INACTIVE = "inactive"
    ERROR = "error"
    PENDING = "pending"


class SyncStatus(str, enum.Enum):
    """Sync operation status."""

    SUCCESS = "success"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    PARTIAL = "partial"


class MarketplaceOrderStatus(str, enum.Enum):
    """Unified order status across channels."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class MarketplaceConnection(Base):
    """Marketplace channel connection configuration.

    Stores credentials and connection state for each marketplace channel.
    One row per channel type (e.g. one Shopify connection, one eBay connection).
    """

    __tablename__ = "marketplace_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    channel_type: Mapped[str] = mapped_column(
        Enum(ChannelType, name="marketplace_channel_type"),
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(255))

    # Connection state
    status: Mapped[str] = mapped_column(
        Enum(ConnectionStatus, name="marketplace_connection_status"),
        default=ConnectionStatus.DISCONNECTED,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    mode: Mapped[str] = mapped_column(String(10), default="demo")  # demo | live

    # Credentials (encrypted in production) — stored as JSON for flexibility
    credentials: Mapped[dict | None] = mapped_column(JSON)
    # Shopify: {"shop_domain", "access_token", "api_key", "api_secret"}
    # eBay: {"client_id", "client_secret", "refresh_token", "environment"}
    # Facebook: {"app_id", "app_secret", "access_token", "catalog_id"}

    # Channel-specific metadata
    channel_metadata: Mapped[dict | None] = mapped_column(JSON)
    # Shopify: {"shop_name", "currency", "api_version"}
    # eBay: {"marketplace_id", "seller_username", "site_id"}
    # Facebook: {"page_id", "page_name", "commerce_account_id"}

    # Sync configuration
    sync_settings: Mapped[dict | None] = mapped_column(JSON)
    # {"auto_sync_products": true, "auto_sync_inventory": true, "sync_interval": 300}

    # Sync state tracking
    last_product_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_inventory_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_order_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_sync_error: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return f"<MarketplaceConnection(channel={self.channel_type}, status={self.status})>"


class MarketplaceProductListing(Base):
    """Product listing on a marketplace channel.

    Links an ERP product to its listing on a specific channel.
    One product can have listings on multiple channels.
    """

    __tablename__ = "marketplace_product_listings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ERP product reference
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # Channel info
    channel_type: Mapped[str] = mapped_column(
        Enum(ChannelType, name="marketplace_channel_type", create_type=False),
        index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # External IDs on the channel
    external_product_id: Mapped[str | None] = mapped_column(String(255), index=True)
    external_variant_id: Mapped[str | None] = mapped_column(String(255))
    external_url: Mapped[str | None] = mapped_column(Text)

    # Listing details
    listed_title: Mapped[str | None] = mapped_column(String(500))
    listed_price: Mapped[float | None] = mapped_column(Float)
    listed_currency: Mapped[str] = mapped_column(String(10), default="AUD")
    listed_quantity: Mapped[int] = mapped_column(Integer, default=0)

    # Listing status
    status: Mapped[str] = mapped_column(
        Enum(ListingStatus, name="marketplace_listing_status"),
        default=ListingStatus.PENDING,
    )

    # Channel-specific data snapshot
    channel_data: Mapped[dict | None] = mapped_column(JSON)

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")
    sync_error: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<MarketplaceProductListing(product_id={self.product_id}, "
            f"channel={self.channel_type}, external_id={self.external_product_id})>"
        )


class MarketplaceOrder(Base):
    """Order from a marketplace channel.

    Stores orders pulled from connected channels for unified order management.
    """

    __tablename__ = "marketplace_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Channel info
    channel_type: Mapped[str] = mapped_column(
        Enum(ChannelType, name="marketplace_channel_type", create_type=False),
        index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # External order ID on the channel
    external_order_id: Mapped[str] = mapped_column(String(255), index=True)
    external_order_number: Mapped[str | None] = mapped_column(String(100))

    # Link to ERP order (if imported)
    erp_order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)

    # Order details
    status: Mapped[str] = mapped_column(
        Enum(MarketplaceOrderStatus, name="marketplace_order_status"),
        default=MarketplaceOrderStatus.PENDING,
    )
    customer_name: Mapped[str | None] = mapped_column(String(255))
    customer_email: Mapped[str | None] = mapped_column(String(255))
    total_amount: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="AUD")
    shipping_address: Mapped[dict | None] = mapped_column(JSON)

    # Line items snapshot
    line_items: Mapped[dict | None] = mapped_column(JSON)

    # Sync state
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")
    sync_error: Mapped[str | None] = mapped_column(Text)

    # Channel-specific data
    channel_data: Mapped[dict | None] = mapped_column(JSON)

    # When the order was placed on the channel
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<MarketplaceOrder(channel={self.channel_type}, "
            f"external_id={self.external_order_id}, status={self.status})>"
        )


class MarketplaceInventorySync(Base):
    """Inventory sync log across marketplace channels.

    Tracks inventory level synchronisation between the ERP and each channel.
    """

    __tablename__ = "marketplace_inventory_syncs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Product reference
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # Channel info
    channel_type: Mapped[str] = mapped_column(
        Enum(ChannelType, name="marketplace_channel_type", create_type=False),
        index=True,
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    # Stock levels
    local_quantity: Mapped[int] = mapped_column(Integer, default=0)
    remote_quantity: Mapped[int] = mapped_column(Integer, default=0)
    quantity_delta: Mapped[int] = mapped_column(Integer, default=0)

    # Sync result
    sync_status: Mapped[str] = mapped_column(
        Enum(SyncStatus, name="marketplace_sync_status"),
        default=SyncStatus.PENDING,
    )
    sync_direction: Mapped[str] = mapped_column(String(20), default="push")  # push | pull
    sync_error: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<MarketplaceInventorySync(product_id={self.product_id}, "
            f"channel={self.channel_type}, local={self.local_quantity}, remote={self.remote_quantity})>"
        )


class MarketplaceSyncLog(Base):
    """Audit log for all marketplace sync operations.

    One row per sync operation for debugging and monitoring.
    """

    __tablename__ = "marketplace_sync_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Channel info
    channel_type: Mapped[str] = mapped_column(
        Enum(ChannelType, name="marketplace_channel_type", create_type=False),
        index=True,
    )
    connection_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)

    # Operation details
    operation: Mapped[str] = mapped_column(String(50), index=True)
    # push_products, pull_orders, sync_inventory, connect, disconnect
    entity_type: Mapped[str | None] = mapped_column(String(50))
    # product, order, inventory
    entity_id: Mapped[str | None] = mapped_column(String(255))

    # Result
    status: Mapped[str] = mapped_column(
        Enum(SyncStatus, name="marketplace_sync_status", create_type=False),
        default=SyncStatus.PENDING,
    )
    items_processed: Mapped[int] = mapped_column(Integer, default=0)
    items_succeeded: Mapped[int] = mapped_column(Integer, default=0)
    items_failed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict | None] = mapped_column(JSON)

    # Duration
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<MarketplaceSyncLog(channel={self.channel_type}, "
            f"op={self.operation}, status={self.status})>"
        )
