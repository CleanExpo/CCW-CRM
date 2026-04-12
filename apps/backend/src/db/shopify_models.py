"""Shopify integration database models.

Models for storing Shopify connection details and sync state.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base  # Use existing Base class


class ShopifyConnection(Base):
    """Shopify store connection configuration.

    Stores OAuth credentials and connection state for Shopify integration.
    """

    __tablename__ = "shopify_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    shop_domain: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    shop_name: Mapped[str] = mapped_column(String(255))
    access_token: Mapped[str] = mapped_column(Text)  # Encrypted in production
    api_key: Mapped[str] = mapped_column(String(255))
    api_secret: Mapped[str] = mapped_column(Text)  # Encrypted in production
    webhook_secret: Mapped[str] = mapped_column(Text)  # Encrypted in production
    api_version: Mapped[str] = mapped_column(String(50), default="2024-01")

    # Connection state
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_order_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_inventory_sync: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    last_product_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Shopify shop metadata
    shop_id: Mapped[int | None] = mapped_column(Integer)  # Shopify shop ID
    currency: Mapped[str | None] = mapped_column(String(10))
    timezone: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))

    # Sync settings (JSONB)
    sync_settings: Mapped[dict | None] = mapped_column(JSONB)
    # Example: {"auto_import_orders": true, "auto_sync_inventory": true, "inventory_location_id": 123}  # noqa: E501

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<ShopifyConnection(shop_domain='{self.shop_domain}', active={self.is_active})>"


class ShopifyProductMapping(Base):
    """Mapping between ERP products and Shopify products.

    Links local products to Shopify product/variant IDs for sync operations.
    """

    __tablename__ = "shopify_product_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ERP product reference
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        index=True,
    )  # FK to products table

    # Shopify IDs
    shopify_product_id: Mapped[int] = mapped_column(Integer, index=True)
    shopify_variant_id: Mapped[int] = mapped_column(Integer, index=True)
    shopify_inventory_item_id: Mapped[int | None] = mapped_column(Integer)

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
    )  # pending, synced, failed
    sync_error: Mapped[str | None] = mapped_column(Text)
    sync_direction: Mapped[str | None] = mapped_column(
        String(20)
    )  # to_shopify, from_shopify

    # Shopify data snapshot (for comparison)
    shopify_data: Mapped[dict | None] = mapped_column(JSONB)
    # Example: {"title": "...", "price": "99.99", "inventory_quantity": 10}

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<ShopifyProductMapping(product_id='{self.product_id}', "
            f"shopify_product_id={self.shopify_product_id})>"
        )


class ShopifyOrderMapping(Base):
    """Mapping between ERP orders and Shopify orders.

    Links imported Shopify orders to local order records.
    """

    __tablename__ = "shopify_order_mappings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ERP order reference
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        index=True,
    )  # FK to orders table

    # Shopify IDs
    shopify_order_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    shopify_order_number: Mapped[int] = mapped_column(Integer)
    shopify_order_name: Mapped[str] = mapped_column(String(50))  # e.g., "#1001"

    # Import metadata
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    import_status: Mapped[str] = mapped_column(
        String(50),
        default="imported",
    )  # imported, synced, failed

    # Shopify financial/fulfillment status
    financial_status: Mapped[str | None] = mapped_column(String(50))
    # paid, pending, refunded, voided, etc.
    fulfillment_status: Mapped[str | None] = mapped_column(String(50))
    # fulfilled, partial, null, etc.

    # Shopify data snapshot
    shopify_data: Mapped[dict | None] = mapped_column(JSONB)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<ShopifyOrderMapping(order_id='{self.order_id}', "
            f"shopify_order_id={self.shopify_order_id})>"
        )


class ShopifyWebhookLog(Base):
    """Log of received Shopify webhooks for debugging and replay.

    Stores webhook payloads for audit trail and error recovery.
    """

    __tablename__ = "shopify_webhook_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Webhook metadata
    topic: Mapped[str] = mapped_column(String(100), index=True)
    # e.g., "orders/create", "products/update", "inventory_levels/update"
    shopify_webhook_id: Mapped[str | None] = mapped_column(String(255))
    shop_domain: Mapped[str] = mapped_column(String(255), index=True)

    # Request details
    payload: Mapped[dict] = mapped_column(JSONB)
    headers: Mapped[dict | None] = mapped_column(JSONB)

    # Processing state
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processing_error: Mapped[str | None] = mapped_column(Text)

    # Timestamps
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<ShopifyWebhookLog(topic='{self.topic}', "
            f"processed={self.processed}, received_at={self.received_at})>"
        )


class ShopifyProductSyncLog(Base):
    """Log of product sync operations for ISS-009 (Bidirectional Product Sync).

    Tracks every sync operation between ERP and Shopify for audit and debugging.
    """

    __tablename__ = "shopify_product_sync_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Product references
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        index=True,
    )  # FK to products table
    shopify_product_id: Mapped[int | None] = mapped_column(Integer, index=True)

    # Sync operation details
    sync_direction: Mapped[str] = mapped_column(
        String(20),
        index=True,
    )  # to_shopify, from_shopify
    sync_action: Mapped[str] = mapped_column(
        String(50)
    )  # created, updated, deleted, conflict, failed
    sync_status: Mapped[str] = mapped_column(String(50))  # success, failed, conflict

    # Error details (if failed)
    error_message: Mapped[str | None] = mapped_column(Text)

    # Timestamp
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        index=True,
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<ShopifyProductSyncLog(product_id='{self.product_id}', "
            f"direction='{self.sync_direction}', status='{self.sync_status}')>"
        )
