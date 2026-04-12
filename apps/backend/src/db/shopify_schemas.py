"""Pydantic schemas for Shopify integration API.

This module provides comprehensive Pydantic schemas for all Shopify integration models,
including validation, serialization, and security considerations.

Models covered:
- ShopifyConnection: Store connection configuration and OAuth credentials
- ShopifyProductMapping: Product sync mapping between ERP and Shopify
- ShopifyOrderMapping: Order import mapping from Shopify
- ShopifyWebhookLog: Webhook payload logging for audit/debugging
- ShopifyProductSyncLog: Product sync operation logging

Usage:
    from src.db.shopify_schemas import (
        ShopifyConnectionCreate,
        ShopifyConnectionInDB,
        ShopifyProductMappingCreate,
        # ... etc
    )

Security Notes:
- Sensitive fields (access_token, api_secret, webhook_secret) are excluded from responses
- Use ShopifyConnectionCreate for storing credentials, ShopifyConnectionInDB for responses
- All __repr__ methods mask sensitive data
"""

import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_serializer,
    field_validator,
)

# =============================================================================
# ENUMS / LITERAL TYPES
# =============================================================================

SyncStatus = Literal["pending", "synced", "failed"]
"""Status of a sync operation: pending (not yet synced), synced (successful), failed (error)."""

SyncDirection = Literal["to_shopify", "from_shopify"]
"""Direction of sync operation: to_shopify (ERP -> Shopify), from_shopify (Shopify -> ERP)."""

ImportStatus = Literal["imported", "synced", "failed"]
"""Status of an import operation: imported (initial), synced (updated), failed (error)."""

SyncAction = Literal["created", "updated", "deleted", "conflict", "failed"]
"""Type of sync action performed: created, updated, deleted, conflict (needs resolution), failed."""

SyncResultStatus = Literal["success", "failed", "conflict"]
"""Result status of a sync operation: success, failed, conflict."""

WebhookTopic = Literal[
    "orders/create",
    "orders/updated",
    "orders/cancelled",
    "orders/fulfilled",
    "orders/paid",
    "products/create",
    "products/update",
    "products/delete",
    "inventory_levels/update",
    "inventory_levels/connect",
    "customers/create",
    "customers/update",
    "app/uninstalled",
]
"""Shopify webhook topics that can be received."""


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

SHOPIFY_DOMAIN_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$")
"""Pattern for validating Shopify shop domains."""

SHOPIFY_API_VERSION_PATTERN = re.compile(r"^20\d{2}-(0[1-9]|1[0-2])$")
"""Pattern for validating Shopify API versions (e.g., 2024-01)."""


def validate_shopify_domain(domain: str) -> str:
    """Validate and normalize a Shopify shop domain.

    Args:
        domain: The shop domain to validate (e.g., 'mystore.myshopify.com')

    Returns:
        The validated and lowercased domain.

    Raises:
        ValueError: If the domain is not a valid Shopify domain.
    """
    domain = domain.lower().strip()

    # Remove protocol if present
    if domain.startswith("https://"):
        domain = domain[8:]
    elif domain.startswith("http://"):
        domain = domain[7:]

    # Remove trailing slash
    domain = domain.rstrip("/")

    if not SHOPIFY_DOMAIN_PATTERN.match(domain):
        raise ValueError(
            f"Invalid Shopify domain '{domain}'. Must be in format: storename.myshopify.com"
        )

    return domain


def validate_api_version(version: str) -> str:
    """Validate Shopify API version format.

    Args:
        version: The API version to validate (e.g., '2024-01')

    Returns:
        The validated version string.

    Raises:
        ValueError: If the version format is invalid.
    """
    if not SHOPIFY_API_VERSION_PATTERN.match(version):
        raise ValueError(
            f"Invalid API version '{version}'. Must be in format: YYYY-MM (e.g., 2024-01)"
        )
    return version


# =============================================================================
# SHOPIFY CONNECTION SCHEMAS
# =============================================================================


class ShopifyConnectionBase(BaseModel):
    """Base schema for ShopifyConnection with shared fields.

    Contains common fields used for both creation and responses,
    excluding sensitive credentials.
    """

    shop_domain: str = Field(
        ...,
        description="Shopify shop domain (e.g., 'mystore.myshopify.com')",
        min_length=1,
        max_length=255,
        examples=["mystore.myshopify.com"],
    )
    shop_name: str = Field(
        ...,
        description="Display name of the Shopify store",
        min_length=1,
        max_length=255,
        examples=["My Store"],
    )
    api_version: str = Field(
        default="2024-01",
        description="Shopify API version to use",
        examples=["2024-01", "2024-04", "2024-07"],
    )
    is_active: bool = Field(
        default=True,
        description="Whether this connection is active and should be used for sync",
    )

    # Shop metadata (optional)
    shop_id: int | None = Field(
        default=None,
        description="Shopify's internal shop ID",
        ge=1,
    )
    currency: str | None = Field(
        default=None,
        description="Shop's default currency code (e.g., 'AUD', 'USD')",
        max_length=10,
        examples=["AUD", "USD", "GBP"],
    )
    timezone: str | None = Field(
        default=None,
        description="Shop's timezone (e.g., 'Australia/Brisbane')",
        max_length=100,
        examples=["Australia/Brisbane", "America/New_York"],
    )
    email: EmailStr | None = Field(
        default=None,
        description="Shop owner's email address",
    )
    phone: str | None = Field(
        default=None,
        description="Shop contact phone number",
        max_length=50,
    )

    # Sync settings (JSON)
    sync_settings: dict[str, Any] | None = Field(
        default=None,
        description="JSON object with sync configuration options",
        examples=[
            {
                "auto_import_orders": True,
                "auto_sync_inventory": True,
                "inventory_location_id": 12345,
            }
        ],
    )

    @field_validator("shop_domain", mode="before")
    @classmethod
    def validate_shop_domain(cls, v: str) -> str:
        """Validate and normalize shop domain."""
        if not v:
            raise ValueError("shop_domain is required")
        return validate_shopify_domain(v)

    @field_validator("api_version", mode="before")
    @classmethod
    def validate_api_version(cls, v: str) -> str:
        """Validate API version format."""
        if not v:
            return "2024-01"  # Default
        return validate_api_version(v)

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, v: str | None) -> str | None:
        """Normalize currency code to uppercase."""
        if v:
            return v.upper().strip()
        return v

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )


class ShopifyConnectionCreate(ShopifyConnectionBase):
    """Schema for creating a new Shopify connection.

    Includes sensitive credentials that will be encrypted before storage.

    Example:
        connection_data = ShopifyConnectionCreate(
            shop_domain="mystore.myshopify.com",
            shop_name="My Store",
            access_token="shpat_xxxxx",
            api_key="xxxxx",
            api_secret="xxxxx",
            webhook_secret="xxxxx",
        )
    """

    access_token: str = Field(
        ...,
        description="Shopify Admin API access token (will be encrypted)",
        min_length=1,
    )
    api_key: str = Field(
        ...,
        description="Shopify app API key",
        min_length=1,
        max_length=255,
    )
    api_secret: str = Field(
        ...,
        description="Shopify app API secret (will be encrypted)",
        min_length=1,
    )
    webhook_secret: str = Field(
        ...,
        description="Webhook HMAC verification secret (will be encrypted)",
        min_length=1,
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "shop_domain": "mystore.myshopify.com",
                "shop_name": "My Store",
                "access_token": "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                "api_key": "your-api-key",
                "api_secret": "your-api-secret",
                "webhook_secret": "your-webhook-secret",
                "api_version": "2024-01",
                "is_active": True,
                "sync_settings": {
                    "auto_import_orders": True,
                    "auto_sync_inventory": True,
                },
            }
        },
    )

    def __repr__(self) -> str:
        """Mask sensitive data in string representation."""
        return (
            f"ShopifyConnectionCreate(shop_domain='{self.shop_domain}', "
            f"access_token='***MASKED***', api_key='{self.api_key[:4]}...***')"
        )


class ShopifyConnectionUpdate(BaseModel):
    """Schema for updating a Shopify connection.

    All fields are optional. Only provided fields will be updated.
    Credentials can be updated separately for security rotation.

    Example:
        update_data = ShopifyConnectionUpdate(
            shop_name="My Updated Store",
            is_active=False,
        )
    """

    shop_name: str | None = Field(
        default=None,
        description="Display name of the Shopify store",
        min_length=1,
        max_length=255,
    )
    api_version: str | None = Field(
        default=None,
        description="Shopify API version to use",
    )
    is_active: bool | None = Field(
        default=None,
        description="Whether this connection is active",
    )

    # Credentials (for rotation)
    access_token: str | None = Field(
        default=None,
        description="New access token (for rotation)",
    )
    api_key: str | None = Field(
        default=None,
        description="New API key",
        max_length=255,
    )
    api_secret: str | None = Field(
        default=None,
        description="New API secret (for rotation)",
    )
    webhook_secret: str | None = Field(
        default=None,
        description="New webhook secret (for rotation)",
    )

    # Shop metadata
    shop_id: int | None = Field(default=None, ge=1)
    currency: str | None = Field(default=None, max_length=10)
    timezone: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)

    # Sync settings
    sync_settings: dict[str, Any] | None = None

    # Sync timestamps (updated by system)
    last_order_sync: datetime | None = None
    last_inventory_sync: datetime | None = None
    last_product_sync: datetime | None = None

    @field_validator("api_version", mode="before")
    @classmethod
    def validate_api_version(cls, v: str | None) -> str | None:
        """Validate API version format if provided."""
        if v:
            return validate_api_version(v)
        return v

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, v: str | None) -> str | None:
        """Normalize currency code to uppercase."""
        if v:
            return v.upper().strip()
        return v

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "shop_name": "My Updated Store",
                "is_active": True,
                "sync_settings": {"auto_import_orders": False},
            }
        },
    )


class ShopifyConnectionInDB(ShopifyConnectionBase):
    """Schema for Shopify connection response (from database).

    SECURITY: Sensitive fields (access_token, api_secret, webhook_secret)
    are excluded from serialization to prevent credential leakage.

    Example:
        # From ORM model
        connection = ShopifyConnectionInDB.model_validate(db_connection)
    """

    id: UUID = Field(..., description="Unique identifier")

    # Sensitive fields - excluded from responses
    access_token: str = Field(..., exclude=True)
    api_key: str = Field(..., description="API key (first 4 chars shown)")
    api_secret: str = Field(..., exclude=True)
    webhook_secret: str = Field(..., exclude=True)

    # Sync timestamps
    last_order_sync: datetime | None = Field(
        default=None,
        description="Last successful order sync timestamp",
    )
    last_inventory_sync: datetime | None = Field(
        default=None,
        description="Last successful inventory sync timestamp",
    )
    last_product_sync: datetime | None = Field(
        default=None,
        description="Last successful product sync timestamp",
    )

    # Timestamps
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @field_serializer("api_key")
    def mask_api_key(self, v: str) -> str:
        """Mask API key to show only first 4 characters."""
        if v and len(v) > 4:
            return f"{v[:4]}...***"
        return "***"

    @field_serializer(
        "created_at", "updated_at", "last_order_sync",
        "last_inventory_sync", "last_product_sync",
    )
    def serialize_datetime(self, v: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        if v:
            return v.isoformat()
        return None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "shop_domain": "mystore.myshopify.com",
                "shop_name": "My Store",
                "api_key": "abc1...***",
                "api_version": "2024-01",
                "is_active": True,
                "shop_id": 12345678,
                "currency": "AUD",
                "timezone": "Australia/Brisbane",
                "email": "owner@mystore.com",
                "last_order_sync": "2024-01-15T10:30:00Z",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-15T10:30:00Z",
            }
        },
    )

    def __repr__(self) -> str:
        """Mask sensitive data in string representation."""
        return (
            f"ShopifyConnectionInDB(id='{self.id}', "
            f"shop_domain='{self.shop_domain}', is_active={self.is_active})"
        )


# =============================================================================
# SHOPIFY PRODUCT MAPPING SCHEMAS
# =============================================================================


class ShopifyProductMappingBase(BaseModel):
    """Base schema for ShopifyProductMapping with shared fields.

    Links ERP products to Shopify product/variant IDs for sync operations.
    """

    product_id: UUID = Field(
        ...,
        description="UUID of the ERP product",
    )
    shopify_product_id: int = Field(
        ...,
        description="Shopify product ID",
        gt=0,
    )
    shopify_variant_id: int = Field(
        ...,
        description="Shopify variant ID (default variant for simple products)",
        gt=0,
    )
    shopify_inventory_item_id: int | None = Field(
        default=None,
        description="Shopify inventory item ID for stock management",
        gt=0,
    )
    sync_direction: SyncDirection | None = Field(
        default=None,
        description="Direction of last sync operation",
    )

    # Shopify data snapshot (for comparison and conflict detection)
    shopify_data: dict[str, Any] | None = Field(
        default=None,
        description="Snapshot of Shopify product data for change detection",
        examples=[{"title": "Product Name", "price": "99.99", "inventory_quantity": 10}],
    )


class ShopifyProductMappingCreate(ShopifyProductMappingBase):
    """Schema for creating a new product mapping.

    Example:
        mapping = ShopifyProductMappingCreate(
            product_id="550e8400-e29b-41d4-a716-446655440000",
            shopify_product_id=12345678,
            shopify_variant_id=87654321,
            shopify_inventory_item_id=11111111,
        )
    """

    sync_status: SyncStatus = Field(
        default="pending",
        description="Initial sync status",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "product_id": "550e8400-e29b-41d4-a716-446655440000",
                "shopify_product_id": 12345678901,
                "shopify_variant_id": 98765432101,
                "shopify_inventory_item_id": 11111111111,
                "sync_status": "pending",
                "sync_direction": "to_shopify",
            }
        },
    )


class ShopifyProductMappingUpdate(BaseModel):
    """Schema for updating a product mapping.

    All fields are optional. Used primarily for updating sync status
    after sync operations.
    """

    shopify_product_id: int | None = Field(default=None, gt=0)
    shopify_variant_id: int | None = Field(default=None, gt=0)
    shopify_inventory_item_id: int | None = Field(default=None, gt=0)
    sync_status: SyncStatus | None = None
    sync_error: str | None = Field(
        default=None,
        description="Error message if sync failed",
    )
    sync_direction: SyncDirection | None = None
    shopify_data: dict[str, Any] | None = None
    last_synced_at: datetime | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sync_status": "synced",
                "last_synced_at": "2024-01-15T10:30:00Z",
            }
        },
    )


class ShopifyProductMappingInDB(ShopifyProductMappingBase):
    """Schema for product mapping response (from database).

    Example:
        mapping = ShopifyProductMappingInDB.model_validate(db_mapping)
    """

    id: UUID = Field(..., description="Unique identifier")
    sync_status: SyncStatus = Field(..., description="Current sync status")
    sync_error: str | None = Field(
        default=None,
        description="Error message if sync failed",
    )
    last_synced_at: datetime | None = Field(
        default=None,
        description="Timestamp of last successful sync",
    )
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @field_serializer("created_at", "updated_at", "last_synced_at")
    def serialize_datetime(self, v: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        if v:
            return v.isoformat()
        return None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "product_id": "550e8400-e29b-41d4-a716-446655440000",
                "shopify_product_id": 12345678901,
                "shopify_variant_id": 98765432101,
                "shopify_inventory_item_id": 11111111111,
                "sync_status": "synced",
                "sync_direction": "to_shopify",
                "last_synced_at": "2024-01-15T10:30:00Z",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-15T10:30:00Z",
            }
        },
    )


# =============================================================================
# SHOPIFY ORDER MAPPING SCHEMAS
# =============================================================================


class ShopifyOrderMappingBase(BaseModel):
    """Base schema for ShopifyOrderMapping with shared fields.

    Links imported Shopify orders to local ERP order records.
    """

    order_id: UUID = Field(
        ...,
        description="UUID of the ERP order",
    )
    shopify_order_id: int = Field(
        ...,
        description="Shopify order ID (numeric)",
        gt=0,
    )
    shopify_order_number: int = Field(
        ...,
        description="Shopify order number (displayed to customer)",
        gt=0,
    )
    shopify_order_name: str = Field(
        ...,
        description="Shopify order name (e.g., '#1001')",
        min_length=1,
        max_length=50,
        examples=["#1001", "#1234"],
    )

    # Shopify status fields
    financial_status: str | None = Field(
        default=None,
        description="Shopify financial status (paid, pending, refunded, etc.)",
        max_length=50,
        examples=["paid", "pending", "refunded", "voided", "partially_refunded"],
    )
    fulfillment_status: str | None = Field(
        default=None,
        description="Shopify fulfillment status (fulfilled, partial, null)",
        max_length=50,
        examples=["fulfilled", "partial", None],
    )

    # Shopify data snapshot
    shopify_data: dict[str, Any] | None = Field(
        default=None,
        description="Snapshot of Shopify order data",
    )


class ShopifyOrderMappingCreate(ShopifyOrderMappingBase):
    """Schema for creating a new order mapping.

    Example:
        mapping = ShopifyOrderMappingCreate(
            order_id="550e8400-e29b-41d4-a716-446655440000",
            shopify_order_id=9876543210,
            shopify_order_number=1001,
            shopify_order_name="#1001",
            financial_status="paid",
        )
    """

    import_status: ImportStatus = Field(
        default="imported",
        description="Initial import status",
    )

    @field_validator("shopify_order_name", mode="before")
    @classmethod
    def normalize_order_name(cls, v: str) -> str:
        """Ensure order name starts with # if it's numeric."""
        v = v.strip()
        if v.isdigit():
            return f"#{v}"
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "order_id": "550e8400-e29b-41d4-a716-446655440000",
                "shopify_order_id": 9876543210123,
                "shopify_order_number": 1001,
                "shopify_order_name": "#1001",
                "financial_status": "paid",
                "fulfillment_status": None,
                "import_status": "imported",
            }
        },
    )


class ShopifyOrderMappingUpdate(BaseModel):
    """Schema for updating an order mapping.

    All fields are optional. Primarily used for updating status
    after sync operations or Shopify updates.
    """

    import_status: ImportStatus | None = None
    financial_status: str | None = Field(default=None, max_length=50)
    fulfillment_status: str | None = Field(default=None, max_length=50)
    shopify_data: dict[str, Any] | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "import_status": "synced",
                "fulfillment_status": "fulfilled",
            }
        },
    )


class ShopifyOrderMappingInDB(ShopifyOrderMappingBase):
    """Schema for order mapping response (from database).

    Example:
        mapping = ShopifyOrderMappingInDB.model_validate(db_mapping)
    """

    id: UUID = Field(..., description="Unique identifier")
    import_status: ImportStatus = Field(..., description="Current import status")
    imported_at: datetime = Field(..., description="Timestamp when order was imported")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @field_serializer("imported_at", "created_at", "updated_at")
    def serialize_datetime(self, v: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        if v:
            return v.isoformat()
        return None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "order_id": "550e8400-e29b-41d4-a716-446655440000",
                "shopify_order_id": 9876543210123,
                "shopify_order_number": 1001,
                "shopify_order_name": "#1001",
                "financial_status": "paid",
                "fulfillment_status": "fulfilled",
                "import_status": "synced",
                "imported_at": "2024-01-15T10:30:00Z",
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T12:00:00Z",
            }
        },
    )


# =============================================================================
# SHOPIFY WEBHOOK LOG SCHEMAS
# =============================================================================


class ShopifyWebhookLogBase(BaseModel):
    """Base schema for ShopifyWebhookLog with shared fields.

    Logs received Shopify webhooks for debugging and replay capability.
    """

    topic: str = Field(
        ...,
        description="Webhook topic (e.g., 'orders/create', 'products/update')",
        min_length=1,
        max_length=100,
        examples=["orders/create", "products/update", "inventory_levels/update"],
    )
    shop_domain: str = Field(
        ...,
        description="Shop domain that sent the webhook",
        min_length=1,
        max_length=255,
    )
    shopify_webhook_id: str | None = Field(
        default=None,
        description="Shopify's webhook delivery ID",
        max_length=255,
    )


class ShopifyWebhookLogCreate(ShopifyWebhookLogBase):
    """Schema for creating a new webhook log entry.

    Example:
        log = ShopifyWebhookLogCreate(
            topic="orders/create",
            shop_domain="mystore.myshopify.com",
            payload={"id": 12345, "email": "customer@example.com"},
            headers={"X-Shopify-Topic": "orders/create"},
        )
    """

    payload: dict[str, Any] = Field(
        ...,
        description="Webhook payload (JSON body)",
    )
    headers: dict[str, Any] | None = Field(
        default=None,
        description="Request headers for debugging",
    )

    @field_validator("shop_domain", mode="before")
    @classmethod
    def validate_shop_domain(cls, v: str) -> str:
        """Validate and normalize shop domain."""
        return validate_shopify_domain(v)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "orders/create",
                "shop_domain": "mystore.myshopify.com",
                "shopify_webhook_id": "b54557e4-bdd9-4b37-8a5f-5c5c5c5c5c5c",
                "payload": {
                    "id": 9876543210123,
                    "order_number": 1001,
                    "email": "customer@example.com",
                    "total_price": "99.99",
                },
                "headers": {
                    "X-Shopify-Topic": "orders/create",
                    "X-Shopify-Hmac-Sha256": "***",
                    "X-Shopify-Shop-Domain": "mystore.myshopify.com",
                },
            }
        },
    )


class ShopifyWebhookLogUpdate(BaseModel):
    """Schema for updating a webhook log entry.

    Used primarily for marking webhooks as processed or recording errors.
    """

    processed: bool | None = None
    processed_at: datetime | None = None
    processing_error: str | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "processed": True,
                "processed_at": "2024-01-15T10:30:05Z",
            }
        },
    )


class ShopifyWebhookLogInDB(ShopifyWebhookLogBase):
    """Schema for webhook log response (from database).

    Example:
        log = ShopifyWebhookLogInDB.model_validate(db_log)
    """

    id: UUID = Field(..., description="Unique identifier")
    payload: dict[str, Any] = Field(..., description="Webhook payload")
    headers: dict[str, Any] | None = Field(
        default=None,
        description="Request headers",
    )
    processed: bool = Field(..., description="Whether webhook has been processed")
    processed_at: datetime | None = Field(
        default=None,
        description="When the webhook was processed",
    )
    processing_error: str | None = Field(
        default=None,
        description="Error message if processing failed",
    )
    received_at: datetime = Field(..., description="When the webhook was received")

    @field_serializer("received_at", "processed_at")
    def serialize_datetime(self, v: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        if v:
            return v.isoformat()
        return None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "topic": "orders/create",
                "shop_domain": "mystore.myshopify.com",
                "shopify_webhook_id": "b54557e4-bdd9-4b37-8a5f-5c5c5c5c5c5c",
                "payload": {"id": 9876543210123, "order_number": 1001},
                "headers": {"X-Shopify-Topic": "orders/create"},
                "processed": True,
                "processed_at": "2024-01-15T10:30:05Z",
                "processing_error": None,
                "received_at": "2024-01-15T10:30:00Z",
            }
        },
    )


# =============================================================================
# SHOPIFY PRODUCT SYNC LOG SCHEMAS
# =============================================================================


class ShopifyProductSyncLogBase(BaseModel):
    """Base schema for ShopifyProductSyncLog with shared fields.

    Tracks every sync operation between ERP and Shopify for audit and debugging.
    """

    product_id: UUID = Field(
        ...,
        description="UUID of the ERP product",
    )
    shopify_product_id: int | None = Field(
        default=None,
        description="Shopify product ID (if exists)",
        gt=0,
    )
    sync_direction: SyncDirection = Field(
        ...,
        description="Direction of sync operation",
    )
    sync_action: SyncAction = Field(
        ...,
        description="Type of sync action performed",
    )
    sync_status: SyncResultStatus = Field(
        ...,
        description="Result status of the sync operation",
    )


class ShopifyProductSyncLogCreate(ShopifyProductSyncLogBase):
    """Schema for creating a new sync log entry.

    Example:
        log = ShopifyProductSyncLogCreate(
            product_id="550e8400-e29b-41d4-a716-446655440000",
            shopify_product_id=12345678901,
            sync_direction="to_shopify",
            sync_action="updated",
            sync_status="success",
        )
    """

    error_message: str | None = Field(
        default=None,
        description="Error message if sync failed",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "product_id": "550e8400-e29b-41d4-a716-446655440000",
                "shopify_product_id": 12345678901,
                "sync_direction": "to_shopify",
                "sync_action": "updated",
                "sync_status": "success",
            }
        },
    )


class ShopifyProductSyncLogInDB(ShopifyProductSyncLogBase):
    """Schema for sync log response (from database).

    Example:
        log = ShopifyProductSyncLogInDB.model_validate(db_log)
    """

    id: UUID = Field(..., description="Unique identifier")
    error_message: str | None = Field(
        default=None,
        description="Error message if sync failed",
    )
    synced_at: datetime = Field(..., description="When the sync occurred")

    @field_serializer("synced_at")
    def serialize_datetime(self, v: datetime) -> str:
        """Serialize datetime to ISO format."""
        return v.isoformat()

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "product_id": "550e8400-e29b-41d4-a716-446655440000",
                "shopify_product_id": 12345678901,
                "sync_direction": "to_shopify",
                "sync_action": "updated",
                "sync_status": "success",
                "error_message": None,
                "synced_at": "2024-01-15T10:30:00Z",
            }
        },
    )


# =============================================================================
# PAGINATION & BULK OPERATION SCHEMAS
# =============================================================================


class PaginatedShopifyConnections(BaseModel):
    """Paginated response for Shopify connections."""

    data: list[ShopifyConnectionInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedProductMappings(BaseModel):
    """Paginated response for product mappings."""

    data: list[ShopifyProductMappingInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedOrderMappings(BaseModel):
    """Paginated response for order mappings."""

    data: list[ShopifyOrderMappingInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedWebhookLogs(BaseModel):
    """Paginated response for webhook logs."""

    data: list[ShopifyWebhookLogInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedSyncLogs(BaseModel):
    """Paginated response for sync logs."""

    data: list[ShopifyProductSyncLogInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


class BulkSyncRequest(BaseModel):
    """Request for bulk sync operations."""

    product_ids: list[UUID] = Field(
        ...,
        description="List of product IDs to sync",
        min_length=1,
        max_length=100,
    )
    direction: SyncDirection = Field(
        default="to_shopify",
        description="Direction of sync",
    )
    force: bool = Field(
        default=False,
        description="Force sync even if already synced",
    )


class BulkSyncResult(BaseModel):
    """Result of a bulk sync operation."""

    total: int = Field(..., description="Total products processed")
    success: int = Field(..., description="Successfully synced")
    failed: int = Field(..., description="Failed to sync")
    skipped: int = Field(..., description="Skipped (already synced)")
    errors: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Error details for failed syncs",
    )


# =============================================================================
# SYNC STATUS SUMMARY SCHEMAS
# =============================================================================


class ShopifySyncSummary(BaseModel):
    """Summary of Shopify sync status for dashboard display."""

    connection_active: bool = Field(..., description="Whether connection is active")
    last_order_sync: datetime | None = None
    last_product_sync: datetime | None = None
    last_inventory_sync: datetime | None = None

    # Product mapping stats
    total_mapped_products: int = Field(default=0)
    synced_products: int = Field(default=0)
    pending_products: int = Field(default=0)
    failed_products: int = Field(default=0)

    # Order mapping stats
    total_imported_orders: int = Field(default=0)
    orders_pending_sync: int = Field(default=0)

    # Recent webhook activity
    webhooks_last_24h: int = Field(default=0)
    webhooks_failed_last_24h: int = Field(default=0)

    @field_serializer("last_order_sync", "last_product_sync", "last_inventory_sync")
    def serialize_datetime(self, v: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        if v:
            return v.isoformat()
        return None
