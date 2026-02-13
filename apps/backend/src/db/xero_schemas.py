"""Pydantic schemas for Xero integration API.

This module provides comprehensive Pydantic schemas for all Xero integration models,
including validation, serialization, and security considerations.

Models covered:
- XeroConnection: OAuth2 connection configuration and tokens
- Payment: Payment records synced from Xero

Usage:
    from src.db.xero_schemas import (
        XeroConnectionCreate,
        XeroConnectionInDB,
        PaymentCreate,
        PaymentInDB,
        # ... etc
    )

Security Notes:
- Sensitive fields (access_token, refresh_token) are excluded from responses
- Use XeroConnectionCreate for storing credentials, XeroConnectionInDB for responses
- All __repr__ methods mask sensitive data
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    field_validator,
    model_validator,
)

# =============================================================================
# ENUMS / LITERAL TYPES
# =============================================================================

PaymentMethod = Literal["card", "bank_transfer", "cash", "other"]
"""Payment method types: card, bank_transfer, cash, other."""

XeroSyncDirection = Literal["to_xero", "from_xero"]
"""Direction of sync operation: to_xero (ERP -> Xero), from_xero (Xero -> ERP)."""


# =============================================================================
# XERO CONNECTION SCHEMAS
# =============================================================================


class XeroConnectionBase(BaseModel):
    """Base schema for XeroConnection with shared fields.

    Contains common fields used for both creation and responses,
    excluding sensitive credentials.
    """

    tenant_id: str = Field(
        ...,
        description="Xero tenant (organization) ID",
        min_length=1,
        max_length=255,
        examples=["xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
    )
    tenant_name: str | None = Field(
        default=None,
        description="Display name of the Xero organization",
        max_length=255,
        examples=["My Company Pty Ltd"],
    )
    is_active: bool = Field(
        default=True,
        description="Whether this connection is active and should be used for sync",
    )

    # Scopes granted during OAuth
    scopes: list[str] = Field(
        default_factory=list,
        description="OAuth scopes granted for this connection",
        examples=[
            [
                "openid",
                "profile",
                "email",
                "accounting.transactions",
                "accounting.contacts",
            ]
        ],
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
    )


class XeroConnectionCreate(XeroConnectionBase):
    """Schema for creating a new Xero connection.

    Includes sensitive OAuth tokens that will be encrypted before storage.

    Example:
        connection_data = XeroConnectionCreate(
            tenant_id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            tenant_name="My Company",
            access_token="xxxxx",
            refresh_token="xxxxx",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
            scopes=["accounting.transactions", "accounting.contacts"],
        )
    """

    organization_id: UUID | None = Field(
        default=None,
        description="Optional ERP organization ID to link this connection",
    )
    access_token: str = Field(
        ...,
        description="Xero OAuth2 access token (will be encrypted)",
        min_length=1,
    )
    refresh_token: str = Field(
        ...,
        description="Xero OAuth2 refresh token (will be encrypted)",
        min_length=1,
    )
    expires_at: datetime = Field(
        ...,
        description="Token expiration timestamp",
    )

    @field_validator("expires_at", mode="before")
    @classmethod
    def normalize_expires_at(cls, v: datetime | str) -> datetime:
        """Ensure expires_at is timezone-aware."""
        if isinstance(v, str):
            # Parse ISO format string
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        else:
            dt = v

        # Ensure timezone aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)

        return dt

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "tenant_name": "My Company Pty Ltd",
                "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                "expires_at": "2024-01-15T11:00:00Z",
                "scopes": [
                    "openid",
                    "profile",
                    "accounting.transactions",
                    "accounting.contacts",
                ],
                "is_active": True,
            }
        },
    )

    def __repr__(self) -> str:
        """Mask sensitive data in string representation."""
        return (
            f"XeroConnectionCreate(tenant_id='{self.tenant_id}', "
            f"access_token='***MASKED***', refresh_token='***MASKED***')"
        )


class XeroConnectionUpdate(BaseModel):
    """Schema for updating a Xero connection.

    All fields are optional. Only provided fields will be updated.
    Tokens can be updated separately for refresh operations.

    Example:
        update_data = XeroConnectionUpdate(
            tenant_name="Updated Company Name",
            is_active=False,
        )
    """

    tenant_name: str | None = Field(
        default=None,
        description="Display name of the Xero organization",
        max_length=255,
    )
    is_active: bool | None = Field(
        default=None,
        description="Whether this connection is active",
    )

    # Token refresh (for OAuth token rotation)
    access_token: str | None = Field(
        default=None,
        description="New access token (from refresh)",
    )
    refresh_token: str | None = Field(
        default=None,
        description="New refresh token",
    )
    expires_at: datetime | None = Field(
        default=None,
        description="New token expiration timestamp",
    )

    # Scopes (may change on re-authorization)
    scopes: list[str] | None = Field(
        default=None,
        description="Updated OAuth scopes",
    )

    # Sync timestamp
    last_synced_at: datetime | None = Field(
        default=None,
        description="Timestamp of last sync operation",
    )

    @field_validator("expires_at", mode="before")
    @classmethod
    def normalize_expires_at(cls, v: datetime | str | None) -> datetime | None:
        """Ensure expires_at is timezone-aware if provided."""
        if v is None:
            return None

        if isinstance(v, str):
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        else:
            dt = v

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)

        return dt

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "tenant_name": "Updated Company Name",
                "is_active": True,
            }
        },
    )


class XeroConnectionInDB(XeroConnectionBase):
    """Schema for Xero connection response (from database).

    SECURITY: Sensitive fields (access_token, refresh_token) are excluded
    from serialization to prevent credential leakage.

    Example:
        connection = XeroConnectionInDB.model_validate(db_connection)
    """

    id: UUID = Field(..., description="Unique identifier")
    organization_id: UUID | None = Field(
        default=None,
        description="Linked ERP organization ID",
    )

    # Sensitive fields - excluded from responses
    access_token: str = Field(..., exclude=True)
    refresh_token: str = Field(..., exclude=True)

    # Token expiration (safe to show)
    expires_at: datetime = Field(..., description="Token expiration timestamp")

    # Computed property indicator
    is_token_expired: bool = Field(
        default=False,
        description="Whether the access token has expired",
    )

    # Sync timestamp
    last_synced_at: datetime | None = Field(
        default=None,
        description="Timestamp of last sync operation",
    )

    # Timestamps
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @model_validator(mode="after")
    def compute_token_expired(self) -> "XeroConnectionInDB":
        """Compute is_token_expired based on expires_at."""
        # Compare with current time
        now = datetime.now(UTC)
        # Ensure expires_at is timezone aware for comparison
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        self.is_token_expired = now >= expires_at
        return self

    @field_serializer(
        "expires_at", "last_synced_at", "created_at", "updated_at"
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
                "organization_id": "660e8400-e29b-41d4-a716-446655440000",
                "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "tenant_name": "My Company Pty Ltd",
                "scopes": ["accounting.transactions", "accounting.contacts"],
                "is_active": True,
                "expires_at": "2024-01-15T11:00:00Z",
                "is_token_expired": False,
                "last_synced_at": "2024-01-15T10:30:00Z",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-15T10:30:00Z",
            }
        },
    )

    def __repr__(self) -> str:
        """Mask sensitive data in string representation."""
        return (
            f"XeroConnectionInDB(id='{self.id}', "
            f"tenant_id='{self.tenant_id}', is_active={self.is_active})"
        )


# =============================================================================
# PAYMENT SCHEMAS
# =============================================================================


class PaymentBase(BaseModel):
    """Base schema for Payment with shared fields.

    Represents a payment record synced from Xero.
    """

    order_id: UUID = Field(
        ...,
        description="UUID of the related ERP order",
    )
    xero_payment_id: str = Field(
        ...,
        description="Xero payment ID (unique identifier in Xero)",
        min_length=1,
        max_length=255,
    )
    amount: float = Field(
        ...,
        description="Payment amount in order currency",
        gt=0,
    )
    payment_date: datetime = Field(
        ...,
        description="Date the payment was made",
    )
    payment_method: PaymentMethod = Field(
        default="other",
        description="Payment method used",
    )
    reference: str | None = Field(
        default=None,
        description="Payment reference number or note",
        max_length=255,
    )

    @field_validator("payment_date", mode="before")
    @classmethod
    def normalize_payment_date(cls, v: datetime | str) -> datetime:
        """Ensure payment_date is timezone-aware."""
        if isinstance(v, str):
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        else:
            dt = v

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)

        return dt

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v: float | int | str) -> float:
        """Ensure amount is a positive float."""
        if isinstance(v, str):
            v = float(v)
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return float(v)

    @field_validator("payment_method", mode="before")
    @classmethod
    def normalize_payment_method(cls, v: str) -> str:
        """Normalize payment method to lowercase."""
        if v:
            v = v.lower().strip()
            valid_methods = ["card", "bank_transfer", "cash", "other"]
            if v not in valid_methods:
                # Map common variations
                method_map = {
                    "credit_card": "card",
                    "creditcard": "card",
                    "debit_card": "card",
                    "debitcard": "card",
                    "bank": "bank_transfer",
                    "transfer": "bank_transfer",
                    "wire": "bank_transfer",
                    "eft": "bank_transfer",
                    "direct_debit": "bank_transfer",
                }
                v = method_map.get(v, "other")
        return v or "other"


class PaymentCreate(PaymentBase):
    """Schema for creating a new payment record.

    Example:
        payment = PaymentCreate(
            order_id="550e8400-e29b-41d4-a716-446655440000",
            xero_payment_id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            amount=150.00,
            payment_date=datetime.now(timezone.utc),
            payment_method="card",
            reference="INV-001",
        )
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "order_id": "550e8400-e29b-41d4-a716-446655440000",
                "xero_payment_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "amount": 150.00,
                "payment_date": "2024-01-15T10:30:00Z",
                "payment_method": "card",
                "reference": "INV-001 Payment",
            }
        },
    )


class PaymentUpdate(BaseModel):
    """Schema for updating a payment record.

    All fields are optional. Primarily used for reconciliation updates.
    Note: xero_payment_id should not be changed once set.
    """

    amount: float | None = Field(default=None, gt=0)
    payment_date: datetime | None = None
    payment_method: PaymentMethod | None = None
    reference: str | None = Field(default=None, max_length=255)

    @field_validator("payment_date", mode="before")
    @classmethod
    def normalize_payment_date(cls, v: datetime | str | None) -> datetime | None:
        """Ensure payment_date is timezone-aware if provided."""
        if v is None:
            return None

        if isinstance(v, str):
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        else:
            dt = v

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)

        return dt

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "payment_method": "bank_transfer",
                "reference": "Updated reference",
            }
        },
    )


class PaymentInDB(PaymentBase):
    """Schema for payment response (from database).

    Example:
        payment = PaymentInDB.model_validate(db_payment)
    """

    id: UUID = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Record creation timestamp")

    @field_serializer("payment_date", "created_at")
    def serialize_datetime(self, v: datetime) -> str:
        """Serialize datetime to ISO format."""
        return v.isoformat()

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "order_id": "550e8400-e29b-41d4-a716-446655440000",
                "xero_payment_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "amount": 150.00,
                "payment_date": "2024-01-15T10:30:00Z",
                "payment_method": "card",
                "reference": "INV-001 Payment",
                "created_at": "2024-01-15T10:35:00Z",
            }
        },
    )


# =============================================================================
# PAGINATION SCHEMAS
# =============================================================================


class PaginatedXeroConnections(BaseModel):
    """Paginated response for Xero connections."""

    data: list[XeroConnectionInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedPayments(BaseModel):
    """Paginated response for payments."""

    data: list[PaymentInDB]
    total: int
    page: int
    page_size: int
    total_pages: int


# =============================================================================
# XERO SYNC SCHEMAS
# =============================================================================


class XeroInvoiceCreate(BaseModel):
    """Schema for creating an invoice in Xero from an ERP order.

    Used when syncing orders to Xero as invoices.
    """

    order_id: UUID = Field(
        ...,
        description="UUID of the ERP order to create invoice for",
    )
    contact_id: str | None = Field(
        default=None,
        description="Xero contact ID (if already mapped)",
    )
    line_items: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Invoice line items",
    )
    due_date: datetime | None = Field(
        default=None,
        description="Invoice due date",
    )
    reference: str | None = Field(
        default=None,
        description="Invoice reference (e.g., order number)",
    )


class XeroInvoiceResult(BaseModel):
    """Result of creating an invoice in Xero."""

    success: bool = Field(..., description="Whether invoice creation succeeded")
    xero_invoice_id: str | None = Field(
        default=None,
        description="Xero invoice ID if successful",
    )
    xero_invoice_number: str | None = Field(
        default=None,
        description="Xero invoice number if successful",
    )
    error_message: str | None = Field(
        default=None,
        description="Error message if failed",
    )


class XeroContactCreate(BaseModel):
    """Schema for creating a contact in Xero from an ERP customer.

    Used when syncing customers to Xero as contacts.
    """

    customer_id: UUID = Field(
        ...,
        description="UUID of the ERP customer to create contact for",
    )
    name: str = Field(
        ...,
        description="Contact name (company name)",
        min_length=1,
        max_length=255,
    )
    email: str | None = Field(default=None, description="Contact email")
    phone: str | None = Field(default=None, description="Contact phone")
    addresses: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Contact addresses",
    )


class XeroContactResult(BaseModel):
    """Result of creating a contact in Xero."""

    success: bool = Field(..., description="Whether contact creation succeeded")
    xero_contact_id: str | None = Field(
        default=None,
        description="Xero contact ID if successful",
    )
    error_message: str | None = Field(
        default=None,
        description="Error message if failed",
    )


# =============================================================================
# XERO SYNC STATUS SUMMARY
# =============================================================================


class XeroSyncSummary(BaseModel):
    """Summary of Xero sync status for dashboard display."""

    connection_active: bool = Field(..., description="Whether connection is active")
    token_expired: bool = Field(..., description="Whether token needs refresh")
    last_synced_at: datetime | None = None

    # Invoice stats
    total_invoices_synced: int = Field(default=0)
    pending_invoices: int = Field(default=0)
    failed_invoices: int = Field(default=0)

    # Payment stats
    total_payments_synced: int = Field(default=0)
    payments_last_24h: int = Field(default=0)

    # Contact stats
    total_contacts_synced: int = Field(default=0)
    pending_contacts: int = Field(default=0)

    @field_serializer("last_synced_at")
    def serialize_datetime(self, v: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        if v:
            return v.isoformat()
        return None


class XeroOAuthCallback(BaseModel):
    """Schema for Xero OAuth callback data.

    Received after user authorizes the application.
    """

    code: str = Field(
        ...,
        description="Authorization code from Xero",
    )
    state: str | None = Field(
        default=None,
        description="State parameter for CSRF protection",
    )
    scope: str | None = Field(
        default=None,
        description="Granted scopes (space-separated)",
    )


class XeroTokenResponse(BaseModel):
    """Schema for Xero token exchange response.

    Received when exchanging authorization code for tokens.
    """

    access_token: str = Field(
        ...,
        description="OAuth2 access token",
    )
    refresh_token: str = Field(
        ...,
        description="OAuth2 refresh token",
    )
    expires_in: int = Field(
        ...,
        description="Token expiration time in seconds",
    )
    token_type: str = Field(
        default="Bearer",
        description="Token type (always Bearer)",
    )
    scope: str = Field(
        default="",
        description="Granted scopes (space-separated)",
    )

    def get_expires_at(self) -> datetime:
        """Calculate expiration datetime from expires_in."""
        return datetime.now(UTC).replace(
            microsecond=0
        ) + __import__("datetime").timedelta(seconds=self.expires_in)

    def get_scopes_list(self) -> list[str]:
        """Parse scope string into list."""
        if self.scope:
            return self.scope.split()
        return []


class XeroTenant(BaseModel):
    """Schema for Xero tenant (organization) information.

    Received when querying /connections endpoint.
    """

    tenant_id: str = Field(
        ...,
        alias="tenantId",
        description="Xero tenant (organization) ID",
    )
    tenant_name: str | None = Field(
        default=None,
        alias="tenantName",
        description="Organization display name",
    )
    tenant_type: str = Field(
        default="ORGANISATION",
        alias="tenantType",
        description="Type of tenant",
    )

    model_config = ConfigDict(
        populate_by_name=True,
    )
