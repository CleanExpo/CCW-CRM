"""
Extended Shopify Integration Database Models.

Additional tables for enhanced Shopify features:
- Custom metafields
- Inventory sync tracking
- Theme API endpoint tracking
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from src.db.models_base import Base


class ShopifyMetafield(Base):
    """
    Shopify custom metafields.

    Stores CCW-specific product metadata that syncs to Shopify metafields.
    Uses namespace 'ccw_custom' for all CCW fields.
    """

    __tablename__ = "shopify_metafields"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Product reference
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Shopify references
    shopify_product_id: str | None = Column(String(255), nullable=True, index=True)
    shopify_metafield_id: str | None = Column(String(255), nullable=True, unique=True, index=True)

    # Metafield details
    namespace: str = Column(String(100), nullable=False, default="ccw_custom")
    key: str = Column(String(100), nullable=False)
    value: str | None = Column(Text, nullable=True)
    value_type: str = Column(
        String(50), nullable=False, default="string"
    )  # string, integer, json, etc.

    # Sync status
    is_synced: bool = Column(Boolean, default=False, nullable=False)
    last_synced_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    sync_error: str | None = Column(Text, nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ShopifyMetafield(id={self.id}, key={self.namespace}.{self.key})>"


class ShopifyInventorySync(Base):
    """
    Shopify inventory sync audit log.

    Tracks all inventory synchronization events (bidirectional).
    """

    __tablename__ = "shopify_inventory_syncs"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Product reference
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Shopify reference
    shopify_product_id: str | None = Column(String(255), nullable=True, index=True)
    shopify_variant_id: str | None = Column(String(255), nullable=True)
    shopify_inventory_item_id: str | None = Column(String(255), nullable=True)

    # Sync details
    direction: str = Column(
        String(20), nullable=False, index=True
    )  # 'erp_to_shopify' or 'shopify_to_erp'
    sync_type: str = Column(String(50), nullable=False)  # 'stock_level', 'location_move'

    # Inventory changes
    old_quantity: int | None = Column(Integer, nullable=True)
    new_quantity: int | None = Column(Integer, nullable=True)
    quantity_delta: int | None = Column(Integer, nullable=True)

    old_location: str | None = Column(String(100), nullable=True)
    new_location: str | None = Column(String(100), nullable=True)

    # Status
    status: str = Column(String(50), nullable=False, default="pending")  # pending, completed, failed
    error_message: str | None = Column(Text, nullable=True)

    # Metadata
    triggered_by: str | None = Column(String(100), nullable=True)  # 'webhook', 'manual', 'scheduled'
    sync_metadata: dict | None = Column(JSONB, nullable=True)

    # Timestamps
    synced_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<ShopifyInventorySync(id={self.id}, product_id={self.product_id}, direction={self.direction})>"


class ShopifyThemeEndpoint(Base):
    """
    Shopify theme API endpoint tracking.

    Tracks custom API endpoints used by Shopify themes for dynamic content.
    """

    __tablename__ = "shopify_theme_endpoints"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Endpoint details
    endpoint_path: str = Column(String(255), nullable=False, unique=True)
    endpoint_type: str = Column(
        String(100), nullable=False
    )  # 'product_availability', 'validate_order', 'custom_pricing'
    description: str | None = Column(Text, nullable=True)

    # Shopify theme details
    shopify_theme_id: str | None = Column(String(255), nullable=True)
    shopify_store_domain: str | None = Column(String(255), nullable=True)

    # Usage tracking
    is_active: bool = Column(Boolean, default=True, nullable=False)
    request_count: int = Column(Integer, default=0, nullable=False)
    last_accessed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Rate limiting
    rate_limit_per_hour: int | None = Column(Integer, nullable=True, default=1000)

    # Caching
    cache_enabled: bool = Column(Boolean, default=True, nullable=False)
    cache_ttl_seconds: int | None = Column(Integer, nullable=True, default=60)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ShopifyThemeEndpoint(id={self.id}, path={self.endpoint_path})>"


class ShopifyProductTranslation(Base):
    """
    Shopify multi-language product sync tracking.

    Tracks which product translations have been synced to Shopify.
    """

    __tablename__ = "shopify_product_translations"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Product reference
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Translation reference
    language_code: str = Column(String(10), nullable=False, index=True)

    # Shopify references
    shopify_product_id: str | None = Column(String(255), nullable=True, index=True)
    shopify_translation_id: str | None = Column(String(255), nullable=True, unique=True)

    # Sync status
    is_synced: bool = Column(Boolean, default=False, nullable=False)
    last_synced_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    sync_error: str | None = Column(Text, nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ShopifyProductTranslation(id={self.id}, product_id={self.product_id}, language={self.language_code})>"


class ShopifyInventorySyncQueue(Base):
    """
    Shopify inventory sync retry queue.

    PHASE 2: Enhanced Shopify Integration - Task 2.3
    Tracks failed inventory syncs for automatic retry with exponential backoff.
    """

    __tablename__ = "shopify_inventory_sync_queue"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Product reference
    product_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Shopify references
    shopify_product_id: str = Column(String(255), nullable=False, index=True)
    shopify_inventory_item_id: str = Column(String(255), nullable=False)
    shopify_location_id: str = Column(String(255), nullable=False)

    # Sync details
    sync_direction: str = Column(
        String(20), nullable=False, index=True
    )  # 'erp_to_shopify' or 'shopify_to_erp'
    triggered_by: str = Column(String(100), nullable=True)  # Source of sync trigger

    # Retry tracking
    retry_count: int = Column(Integer, default=0, nullable=False)
    max_retries: int = Column(Integer, default=5, nullable=False)
    next_retry_at: datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    last_error: str | None = Column(Text, nullable=True)

    # Status
    status: str = Column(
        String(50), nullable=False, default="pending", index=True
    )  # pending, processing, completed, failed

    # Metadata
    sync_metadata: dict | None = Column(JSONB, nullable=True)
    # Example: {"quantity_delta": 10, "old_quantity": 50, "new_quantity": 60}

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<ShopifyInventorySyncQueue(id={self.id}, product_id={self.product_id}, "
            f"retry_count={self.retry_count}, status={self.status})>"
        )
