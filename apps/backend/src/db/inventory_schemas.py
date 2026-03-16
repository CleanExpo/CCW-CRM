"""Pydantic schemas for inventory management models.

Comprehensive validation, serialization, and type safety for:
- ProductStockByLocation
- StockTransfer
- StockReservation
- StockAdjustment
- Supplier
- PurchaseOrder
- PurchaseOrderItem
- InboundShipment
- OutboundShipment
- CarrierConfiguration
"""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_serializer,
    field_validator,
    model_validator,
)

# =============================================================================
# ENUMS (as Literal types for Pydantic compatibility)
# =============================================================================

StoreLocation = Literal["brisbane", "sydney", "melbourne"]
"""Store location options for multi-location inventory."""

TransferStatus = Literal["pending", "in_transit", "completed", "cancelled"]
"""Status options for stock transfers between locations."""

ReservationStatus = Literal["active", "fulfilled", "cancelled", "expired"]
"""Status options for stock reservations."""

AdjustmentType = Literal[
    "stock_count", "damage", "theft", "correction", "transfer", "sale", "return"
]
"""Types of stock adjustments for audit trail."""

PurchaseOrderStatus = Literal[
    "draft", "pending_approval", "approved", "ordered", "in_transit", "received", "cancelled"
]
"""Status options for purchase orders."""

InboundShipmentStatus = Literal[
    "pending", "in_transit", "out_for_delivery", "delivered", "exception", "cancelled"
]
"""Status options for inbound shipments from suppliers."""

OutboundShipmentStatus = Literal[
    "pending", "in_transit", "out_for_delivery", "delivered", "exception", "cancelled", "returned"
]
"""Status options for outbound shipments to customers."""


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

ABN_PATTERN = re.compile(r"^\d{11}$")
"""Australian Business Number pattern (11 digits)."""

PO_NUMBER_PATTERN = re.compile(r"^PO-\d{4}-\d{4,}$")
"""Purchase order number pattern: PO-YYYY-NNNN."""

SHIPMENT_NUMBER_PATTERN = re.compile(r"^SHIP-\d{8}-\d{4,}$")
"""Shipment number pattern: SHIP-YYYYMMDD-NNNN."""


def validate_abn(abn: str | None) -> str | None:
    """Validate Australian Business Number format.

    Args:
        abn: The ABN string to validate (11 digits).

    Returns:
        The validated ABN or None.

    Raises:
        ValueError: If ABN format is invalid.
    """
    if abn is None:
        return None
    # Remove any whitespace or dashes
    cleaned = abn.replace(" ", "").replace("-", "")
    if not ABN_PATTERN.match(cleaned):
        raise ValueError("ABN must be exactly 11 digits")
    return cleaned


def validate_po_number(po_number: str) -> str:
    """Validate purchase order number format.

    Args:
        po_number: The PO number to validate.

    Returns:
        The validated PO number.

    Raises:
        ValueError: If PO number format is invalid.
    """
    if not PO_NUMBER_PATTERN.match(po_number):
        raise ValueError("PO number must match format PO-YYYY-NNNN (e.g., PO-2024-0001)")
    return po_number


def validate_shipment_number(shipment_number: str) -> str:
    """Validate shipment number format.

    Args:
        shipment_number: The shipment number to validate.

    Returns:
        The validated shipment number.

    Raises:
        ValueError: If shipment number format is invalid.
    """
    if not SHIPMENT_NUMBER_PATTERN.match(shipment_number):
        raise ValueError(
            "Shipment number must match format SHIP-YYYYMMDD-NNNN (e.g., SHIP-20240115-0001)"
        )
    return shipment_number


# =============================================================================
# PRODUCT STOCK BY LOCATION SCHEMAS
# =============================================================================


class ProductStockByLocationBase(BaseModel):
    """Base schema for product stock by location.

    Contains shared fields for create and update operations.
    """

    location: StoreLocation = Field(..., description="Store location (brisbane, sydney, melbourne)")
    stock: int = Field(ge=0, default=0, description="Total stock quantity")
    reserved: int = Field(ge=0, default=0, description="Reserved stock quantity")
    reorder_point: int | None = Field(None, ge=0, description="Stock level to trigger reorder")
    reorder_quantity: int | None = Field(None, ge=0, description="Quantity to reorder when triggered")

    @field_validator("stock", "reserved")
    @classmethod
    def validate_non_negative(cls, v: int) -> int:
        """Ensure stock values are non-negative."""
        if v < 0:
            raise ValueError("Stock values cannot be negative")
        return v

    @model_validator(mode="after")
    def validate_reserved_not_exceeds_stock(self) -> ProductStockByLocationBase:
        """Validate that reserved does not exceed total stock."""
        if self.reserved > self.stock:
            raise ValueError("Reserved quantity cannot exceed total stock")
        return self

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "location": "brisbane",
                "stock": 100,
                "reserved": 10,
                "reorder_point": 20,
                "reorder_quantity": 50,
            }
        },
    )


class ProductStockByLocationCreate(ProductStockByLocationBase):
    """Schema for creating product stock by location."""

    product_id: UUID = Field(..., description="Product ID reference")


class ProductStockByLocationUpdate(BaseModel):
    """Schema for updating product stock by location.

    All fields are optional for partial updates.
    """

    stock: int | None = Field(None, ge=0, description="Updated stock quantity")
    reserved: int | None = Field(None, ge=0, description="Updated reserved quantity")
    reorder_point: int | None = Field(None, ge=0, description="Updated reorder point")
    reorder_quantity: int | None = Field(None, ge=0, description="Updated reorder quantity")
    last_counted_at: datetime | None = Field(None, description="Last stock count timestamp")
    last_counted_by: UUID | None = Field(None, description="User who performed last count")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class ProductStockByLocationInDB(ProductStockByLocationBase):
    """Schema for product stock by location from database.

    Includes computed fields and timestamps.
    """

    id: UUID = Field(..., description="Unique identifier")
    product_id: UUID = Field(..., description="Product ID reference")
    last_counted_at: datetime | None = Field(None, description="Last stock count timestamp")
    last_counted_by: UUID | None = Field(None, description="User who performed last count")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def available(self) -> int:
        """Compute available stock (stock - reserved)."""
        return max(0, self.stock - self.reserved)

    @computed_field
    @property
    def below_reorder_point(self) -> bool:
        """Check if current stock is below reorder point."""
        if self.reorder_point is None:
            return False
        return self.available < self.reorder_point

    @field_serializer("created_at", "updated_at", "last_counted_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "product_id", "last_counted_by")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedProductStock(BaseModel):
    """Paginated response for product stock queries."""

    data: list[ProductStockByLocationInDB] = Field(..., description="List of stock records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# STOCK TRANSFER SCHEMAS
# =============================================================================


class StockTransferBase(BaseModel):
    """Base schema for stock transfers between locations."""

    from_location: StoreLocation = Field(..., description="Source location")
    to_location: StoreLocation = Field(..., description="Destination location")
    quantity: int = Field(..., gt=0, description="Quantity to transfer")
    reason: str | None = Field(None, max_length=500, description="Transfer reason")
    notes: str | None = Field(None, max_length=1000, description="Additional notes")

    @model_validator(mode="after")
    def validate_different_locations(self) -> StockTransferBase:
        """Ensure source and destination locations are different."""
        if self.from_location == self.to_location:
            raise ValueError("Source and destination locations must be different")
        return self

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "from_location": "brisbane",
                "to_location": "sydney",
                "quantity": 25,
                "reason": "Stock balancing",
                "notes": "Priority transfer for customer order",
            }
        },
    )


class StockTransferCreate(StockTransferBase):
    """Schema for creating a stock transfer."""

    product_id: UUID = Field(..., description="Product ID to transfer")
    initiated_by: UUID | None = Field(None, description="User initiating transfer")


class StockTransferUpdate(BaseModel):
    """Schema for updating a stock transfer.

    Limited updates allowed based on status.
    """

    status: TransferStatus | None = Field(None, description="Updated transfer status")
    notes: str | None = Field(None, max_length=1000, description="Updated notes")
    completed_by: UUID | None = Field(None, description="User completing transfer")
    completed_at: datetime | None = Field(None, description="Completion timestamp")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class StockTransferInDB(StockTransferBase):
    """Schema for stock transfer from database."""

    id: UUID = Field(..., description="Unique identifier")
    product_id: UUID = Field(..., description="Product ID reference")
    status: TransferStatus = Field(default="pending", description="Transfer status")
    initiated_by: UUID | None = Field(None, description="User who initiated transfer")
    completed_by: UUID | None = Field(None, description="User who completed transfer")
    initiated_at: datetime = Field(..., description="Transfer initiation timestamp")
    completed_at: datetime | None = Field(None, description="Transfer completion timestamp")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def is_pending(self) -> bool:
        """Check if transfer is still pending."""
        return self.status == "pending"

    @computed_field
    @property
    def is_completed(self) -> bool:
        """Check if transfer has been completed."""
        return self.status == "completed"

    @field_serializer("created_at", "updated_at", "initiated_at", "completed_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "product_id", "initiated_by", "completed_by")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedStockTransfer(BaseModel):
    """Paginated response for stock transfer queries."""

    data: list[StockTransferInDB] = Field(..., description="List of transfer records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# STOCK RESERVATION SCHEMAS
# =============================================================================


class StockReservationBase(BaseModel):
    """Base schema for stock reservations."""

    location: StoreLocation = Field(..., description="Reservation location")
    quantity: int = Field(..., gt=0, description="Quantity to reserve")
    expires_at: datetime | None = Field(None, description="Reservation expiration timestamp")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "location": "sydney",
                "quantity": 5,
                "expires_at": "2024-12-31T23:59:59Z",
            }
        },
    )


class StockReservationCreate(StockReservationBase):
    """Schema for creating a stock reservation."""

    product_id: UUID = Field(..., description="Product ID to reserve")
    order_id: UUID = Field(..., description="Order ID for reservation")


class StockReservationUpdate(BaseModel):
    """Schema for updating a stock reservation."""

    status: ReservationStatus | None = Field(None, description="Updated reservation status")
    quantity: int | None = Field(None, gt=0, description="Updated quantity")
    expires_at: datetime | None = Field(None, description="Updated expiration timestamp")
    fulfilled_at: datetime | None = Field(None, description="Fulfillment timestamp")
    cancelled_at: datetime | None = Field(None, description="Cancellation timestamp")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class StockReservationInDB(StockReservationBase):
    """Schema for stock reservation from database."""

    id: UUID = Field(..., description="Unique identifier")
    product_id: UUID = Field(..., description="Product ID reference")
    order_id: UUID = Field(..., description="Order ID reference")
    status: ReservationStatus = Field(default="active", description="Reservation status")
    reserved_at: datetime = Field(..., description="Reservation creation timestamp")
    fulfilled_at: datetime | None = Field(None, description="Fulfillment timestamp")
    cancelled_at: datetime | None = Field(None, description="Cancellation timestamp")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")

    @computed_field
    @property
    def is_active(self) -> bool:
        """Check if reservation is still active."""
        return self.status == "active"

    @computed_field
    @property
    def is_expired(self) -> bool:
        """Check if reservation has expired."""
        if self.expires_at is None:
            return False
        return datetime.now(self.expires_at.tzinfo) > self.expires_at and self.status == "active"

    @field_serializer(
        "created_at", "updated_at", "reserved_at", "fulfilled_at", "cancelled_at", "expires_at"
    )
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "product_id", "order_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedStockReservation(BaseModel):
    """Paginated response for stock reservation queries."""

    data: list[StockReservationInDB] = Field(..., description="List of reservation records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# STOCK ADJUSTMENT SCHEMAS
# =============================================================================


class StockAdjustmentBase(BaseModel):
    """Base schema for stock adjustments."""

    location: StoreLocation = Field(..., description="Adjustment location")
    quantity_change: int = Field(..., description="Quantity change (can be negative)")
    adjustment_type: AdjustmentType = Field(..., description="Type of adjustment")
    reason: str | None = Field(None, max_length=500, description="Adjustment reason")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "location": "melbourne",
                "quantity_change": -5,
                "adjustment_type": "damage",
                "reason": "Items damaged during handling",
            }
        },
    )


class StockAdjustmentCreate(StockAdjustmentBase):
    """Schema for creating a stock adjustment."""

    product_id: UUID = Field(..., description="Product ID to adjust")
    previous_quantity: int = Field(..., ge=0, description="Stock before adjustment")
    new_quantity: int = Field(..., ge=0, description="Stock after adjustment")
    reference_id: UUID | None = Field(None, description="Related entity ID (order, transfer, etc.)")
    adjusted_by: UUID | None = Field(None, description="User making adjustment")

    @model_validator(mode="after")
    def validate_quantity_consistency(self) -> StockAdjustmentCreate:
        """Validate that quantity change matches previous/new quantities."""
        expected_new = self.previous_quantity + self.quantity_change
        if expected_new != self.new_quantity:
            raise ValueError(
                f"Quantity inconsistency: {self.previous_quantity} + {self.quantity_change} "
                f"should equal {expected_new}, not {self.new_quantity}"
            )
        if self.new_quantity < 0:
            raise ValueError("New quantity cannot be negative")
        return self


class StockAdjustmentInDB(StockAdjustmentBase):
    """Schema for stock adjustment from database."""

    id: UUID = Field(..., description="Unique identifier")
    product_id: UUID = Field(..., description="Product ID reference")
    previous_quantity: int = Field(..., ge=0, description="Stock before adjustment")
    new_quantity: int = Field(..., ge=0, description="Stock after adjustment")
    reference_id: UUID | None = Field(None, description="Related entity ID")
    adjusted_by: UUID | None = Field(None, description="User who made adjustment")
    adjusted_at: datetime = Field(..., description="Adjustment timestamp")
    created_at: datetime = Field(..., description="Record creation timestamp")

    @computed_field
    @property
    def is_increase(self) -> bool:
        """Check if this adjustment increased stock."""
        return self.quantity_change > 0

    @computed_field
    @property
    def is_decrease(self) -> bool:
        """Check if this adjustment decreased stock."""
        return self.quantity_change < 0

    @field_serializer("created_at", "adjusted_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "product_id", "reference_id", "adjusted_by")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedStockAdjustment(BaseModel):
    """Paginated response for stock adjustment queries."""

    data: list[StockAdjustmentInDB] = Field(..., description="List of adjustment records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# SUPPLIER SCHEMAS
# =============================================================================


class SupplierBase(BaseModel):
    """Base schema for suppliers."""

    supplier_code: str = Field(..., min_length=1, max_length=50, description="Unique supplier code")
    company_name: str = Field(..., min_length=1, max_length=255, description="Company name")
    contact_name: str | None = Field(None, max_length=255, description="Primary contact name")
    email: EmailStr | None = Field(None, description="Contact email address")
    phone: str | None = Field(None, max_length=50, description="Contact phone number")
    abn: str | None = Field(None, description="Australian Business Number (11 digits)")
    address: str | None = Field(None, description="Street address")
    city: str | None = Field(None, max_length=100, description="City")
    state: str | None = Field(None, max_length=50, description="State/Province")
    postal_code: str | None = Field(None, max_length=20, description="Postal code")
    country: str = Field(default="AU", min_length=2, max_length=2, description="ISO country code")
    payment_terms: str | None = Field(None, max_length=100, description="Payment terms (e.g., Net 30)")
    preferred_carrier: str | None = Field(None, max_length=100, description="Preferred shipping carrier")
    is_active: bool = Field(default=True, description="Whether supplier is active")
    notes: str | None = Field(None, description="Additional notes")

    @field_validator("abn")
    @classmethod
    def validate_abn_format(cls, v: str | None) -> str | None:
        """Validate ABN format."""
        return validate_abn(v)

    @field_validator("country")
    @classmethod
    def validate_country_code(cls, v: str) -> str:
        """Ensure country code is uppercase."""
        return v.upper()

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "supplier_code": "SUP-001",
                "company_name": "Acme Industrial Supplies",
                "contact_name": "John Smith",
                "email": "john@acme.com.au",
                "phone": "+61 2 9876 5432",
                "abn": "12345678901",
                "address": "123 Industrial Way",
                "city": "Sydney",
                "state": "NSW",
                "postal_code": "2000",
                "country": "AU",
                "payment_terms": "Net 30",
                "preferred_carrier": "Australia Post",
                "is_active": True,
            }
        },
    )


class SupplierCreate(SupplierBase):
    """Schema for creating a supplier."""

    pass


class SupplierUpdate(BaseModel):
    """Schema for updating a supplier."""

    supplier_code: str | None = Field(None, min_length=1, max_length=50)
    company_name: str | None = Field(None, min_length=1, max_length=255)
    contact_name: str | None = Field(None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50)
    abn: str | None = None
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=50)
    postal_code: str | None = Field(None, max_length=20)
    country: str | None = Field(None, min_length=2, max_length=2)
    payment_terms: str | None = Field(None, max_length=100)
    preferred_carrier: str | None = Field(None, max_length=100)
    xero_contact_id: str | None = Field(None, max_length=255)
    is_active: bool | None = None
    notes: str | None = None

    @field_validator("abn")
    @classmethod
    def validate_abn_format(cls, v: str | None) -> str | None:
        """Validate ABN format."""
        return validate_abn(v)

    @field_validator("country")
    @classmethod
    def validate_country_code(cls, v: str | None) -> str | None:
        """Ensure country code is uppercase."""
        return v.upper() if v else None

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class SupplierInDB(SupplierBase):
    """Schema for supplier from database."""

    id: UUID = Field(..., description="Unique identifier")
    xero_contact_id: str | None = Field(None, description="Xero contact ID for sync")
    xero_synced_at: datetime | None = Field(None, description="Last Xero sync timestamp")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime | None = Field(None, description="Record last update timestamp")

    @computed_field
    @property
    def full_address(self) -> str | None:
        """Compute full formatted address."""
        parts = [self.address, self.city, self.state, self.postal_code, self.country]
        filtered = [p for p in parts if p]
        return ", ".join(filtered) if filtered else None

    @field_serializer("created_at", "updated_at", "xero_synced_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedSupplier(BaseModel):
    """Paginated response for supplier queries."""

    data: list[SupplierInDB] = Field(..., description="List of supplier records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# PURCHASE ORDER SCHEMAS
# =============================================================================


class PurchaseOrderBase(BaseModel):
    """Base schema for purchase orders."""

    delivery_location: StoreLocation = Field(..., description="Delivery destination location")
    order_date: datetime | None = Field(None, description="Date order was placed")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery date")
    subtotal: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, description="Subtotal before tax")
    tax: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, description="Tax amount")
    shipping_cost: Decimal | None = Field(None, ge=0, decimal_places=2, description="Shipping cost")
    total: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2, description="Total amount")
    notes: str | None = Field(None, description="Order notes")

    @model_validator(mode="after")
    def validate_total_calculation(self) -> PurchaseOrderBase:
        """Validate that total equals subtotal + tax + shipping."""
        expected = self.subtotal + self.tax + (self.shipping_cost or Decimal("0.00"))
        # Allow small floating point differences
        if abs(expected - self.total) > Decimal("0.01"):
            raise ValueError(
                f"Total ({self.total}) should equal subtotal ({self.subtotal}) + "
                f"tax ({self.tax}) + shipping ({self.shipping_cost or 0})"
            )
        return self

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "delivery_location": "brisbane",
                "order_date": "2024-01-15T09:00:00Z",
                "expected_delivery_date": "2024-01-25T09:00:00Z",
                "subtotal": "1000.00",
                "tax": "100.00",
                "shipping_cost": "50.00",
                "total": "1150.00",
                "notes": "Rush order - high priority",
            }
        },
    )


class PurchaseOrderCreate(BaseModel):
    """Schema for creating a purchase order."""

    po_number: str = Field(..., min_length=1, max_length=50, description="Purchase order number")
    supplier_id: UUID = Field(..., description="Supplier ID reference")
    delivery_location: StoreLocation = Field(..., description="Delivery destination")
    status: PurchaseOrderStatus = Field(default="draft", description="Order status")
    order_date: datetime | None = Field(None, description="Order date")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery")
    subtotal: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    tax: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    shipping_cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    total: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    notes: str | None = None
    created_by_id: UUID | None = Field(None, description="User creating the order")

    @field_validator("po_number")
    @classmethod
    def validate_po_number_format(cls, v: str) -> str:
        """Validate PO number format."""
        return validate_po_number(v)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PurchaseOrderUpdate(BaseModel):
    """Schema for updating a purchase order."""

    status: PurchaseOrderStatus | None = None
    order_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    actual_delivery_date: datetime | None = None
    subtotal: Decimal | None = Field(None, ge=0, decimal_places=2)
    tax: Decimal | None = Field(None, ge=0, decimal_places=2)
    shipping_cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    total: Decimal | None = Field(None, ge=0, decimal_places=2)
    notes: str | None = None
    xero_purchase_order_id: str | None = Field(None, max_length=255)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PurchaseOrderInDB(BaseModel):
    """Schema for purchase order from database."""

    id: UUID = Field(..., description="Unique identifier")
    po_number: str = Field(..., description="Purchase order number")
    supplier_id: UUID = Field(..., description="Supplier ID reference")
    delivery_location: StoreLocation = Field(..., description="Delivery destination")
    status: PurchaseOrderStatus = Field(..., description="Order status")
    order_date: datetime | None = Field(None, description="Date order was placed")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery date")
    actual_delivery_date: datetime | None = Field(None, description="Actual delivery date")
    subtotal: Decimal = Field(..., description="Subtotal before tax")
    tax: Decimal = Field(..., description="Tax amount")
    shipping_cost: Decimal | None = Field(None, description="Shipping cost")
    total: Decimal = Field(..., description="Total amount")
    notes: str | None = Field(None, description="Order notes")
    xero_purchase_order_id: str | None = Field(None, description="Xero PO ID for sync")
    xero_synced_at: datetime | None = Field(None, description="Last Xero sync timestamp")
    created_by_id: UUID | None = Field(None, description="User who created order")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime | None = Field(None, description="Record last update timestamp")

    # Nested relationships (optional - populated when joined)
    items: list[PurchaseOrderItemInDB] | None = Field(None, description="Order line items")

    @computed_field
    @property
    def is_fully_received(self) -> bool:
        """Check if all items have been received."""
        if not self.items:
            return False
        return all(item.quantity_received >= item.quantity for item in self.items)

    @computed_field
    @property
    def is_overdue(self) -> bool:
        """Check if order is overdue for delivery."""
        if self.status in ("received", "cancelled"):
            return False
        if self.expected_delivery_date is None:
            return False
        return datetime.now(self.expected_delivery_date.tzinfo) > self.expected_delivery_date

    @field_serializer("subtotal", "tax", "shipping_cost", "total")
    def serialize_decimal(self, val: Decimal | None) -> str | None:
        """Serialize Decimal to string with 2 decimal places."""
        return f"{val:.2f}" if val is not None else None

    @field_serializer(
        "created_at", "updated_at", "order_date", "expected_delivery_date",
        "actual_delivery_date", "xero_synced_at"
    )
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "supplier_id", "created_by_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedPurchaseOrder(BaseModel):
    """Paginated response for purchase order queries."""

    data: list[PurchaseOrderInDB] = Field(..., description="List of PO records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# PURCHASE ORDER ITEM SCHEMAS
# =============================================================================


class PurchaseOrderItemBase(BaseModel):
    """Base schema for purchase order items."""

    quantity: int = Field(..., gt=0, description="Quantity ordered")
    unit_cost: Decimal = Field(..., ge=0, decimal_places=2, description="Cost per unit")
    subtotal: Decimal = Field(..., ge=0, decimal_places=2, description="Line subtotal")

    @model_validator(mode="after")
    def validate_subtotal(self) -> PurchaseOrderItemBase:
        """Validate subtotal equals quantity * unit_cost."""
        expected = Decimal(str(self.quantity)) * self.unit_cost
        if abs(expected - self.subtotal) > Decimal("0.01"):
            raise ValueError(
                f"Subtotal ({self.subtotal}) should equal quantity ({self.quantity}) "
                f"x unit_cost ({self.unit_cost})"
            )
        return self

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "quantity": 10,
                "unit_cost": "25.00",
                "subtotal": "250.00",
            }
        },
    )


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    """Schema for creating a purchase order item."""

    purchase_order_id: UUID = Field(..., description="Parent PO ID")
    product_id: UUID = Field(..., description="Product ID reference")
    quantity_received: int = Field(default=0, ge=0, description="Quantity received so far")


class PurchaseOrderItemUpdate(BaseModel):
    """Schema for updating a purchase order item."""

    quantity: int | None = Field(None, gt=0)
    quantity_received: int | None = Field(None, ge=0)
    unit_cost: Decimal | None = Field(None, ge=0, decimal_places=2)
    subtotal: Decimal | None = Field(None, ge=0, decimal_places=2)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PurchaseOrderItemInDB(PurchaseOrderItemBase):
    """Schema for purchase order item from database."""

    id: UUID = Field(..., description="Unique identifier")
    purchase_order_id: UUID = Field(..., description="Parent PO ID")
    product_id: UUID = Field(..., description="Product ID reference")
    quantity_received: int = Field(default=0, ge=0, description="Quantity received")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime | None = Field(None, description="Record last update timestamp")

    @computed_field
    @property
    def remaining_quantity(self) -> int:
        """Calculate remaining quantity to receive."""
        return max(0, self.quantity - self.quantity_received)

    @computed_field
    @property
    def is_fully_received(self) -> bool:
        """Check if item is fully received."""
        return self.quantity_received >= self.quantity

    @computed_field
    @property
    def receipt_percentage(self) -> float:
        """Calculate percentage of quantity received."""
        if self.quantity == 0:
            return 100.0
        return round((self.quantity_received / self.quantity) * 100, 2)

    @field_serializer("unit_cost", "subtotal")
    def serialize_decimal(self, val: Decimal | None) -> str | None:
        """Serialize Decimal to string with 2 decimal places."""
        return f"{val:.2f}" if val is not None else None

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "purchase_order_id", "product_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


# =============================================================================
# INBOUND SHIPMENT SCHEMAS
# =============================================================================


class InboundShipmentBase(BaseModel):
    """Base schema for inbound shipments."""

    carrier_name: str | None = Field(None, max_length=100, description="Carrier name")
    carrier_service: str | None = Field(None, max_length=100, description="Service type")
    tracking_number: str | None = Field(None, max_length=100, description="Tracking number")
    origin_address: str | None = Field(None, description="Origin address")
    destination_location: StoreLocation = Field(..., description="Destination warehouse")
    shipped_date: datetime | None = Field(None, description="Ship date")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery")
    notes: str | None = Field(None, description="Shipment notes")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "carrier_name": "Australia Post",
                "carrier_service": "Express",
                "tracking_number": "AP123456789AU",
                "origin_address": "123 Supplier St, Melbourne VIC 3000",
                "destination_location": "brisbane",
                "shipped_date": "2024-01-15T09:00:00Z",
                "expected_delivery_date": "2024-01-18T09:00:00Z",
            }
        },
    )


class InboundShipmentCreate(InboundShipmentBase):
    """Schema for creating an inbound shipment."""

    shipment_number: str = Field(..., min_length=1, max_length=50, description="Shipment number")
    purchase_order_id: UUID | None = Field(None, description="Related PO ID")
    supplier_id: UUID = Field(..., description="Supplier ID reference")
    status: InboundShipmentStatus = Field(default="pending", description="Shipment status")
    tracking_events: dict[str, Any] | None = Field(None, description="Tracking event history")

    @field_validator("shipment_number")
    @classmethod
    def validate_shipment_number_format(cls, v: str) -> str:
        """Validate shipment number format."""
        return validate_shipment_number(v)


class InboundShipmentUpdate(BaseModel):
    """Schema for updating an inbound shipment."""

    status: InboundShipmentStatus | None = None
    carrier_name: str | None = Field(None, max_length=100)
    carrier_service: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    shipped_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    actual_delivery_date: datetime | None = None
    tracking_events: dict[str, Any] | None = None
    last_tracking_update: datetime | None = None
    notes: str | None = None

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class InboundShipmentInDB(InboundShipmentBase):
    """Schema for inbound shipment from database."""

    id: UUID = Field(..., description="Unique identifier")
    shipment_number: str = Field(..., description="Shipment number")
    purchase_order_id: UUID | None = Field(None, description="Related PO ID")
    supplier_id: UUID = Field(..., description="Supplier ID reference")
    status: InboundShipmentStatus = Field(..., description="Shipment status")
    actual_delivery_date: datetime | None = Field(None, description="Actual delivery date")
    tracking_events: dict[str, Any] | None = Field(None, description="Tracking event history")
    last_tracking_update: datetime | None = Field(None, description="Last tracking update")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime | None = Field(None, description="Record last update timestamp")

    @computed_field
    @property
    def is_delivered(self) -> bool:
        """Check if shipment has been delivered."""
        return self.status == "delivered"

    @computed_field
    @property
    def is_in_transit(self) -> bool:
        """Check if shipment is in transit."""
        return self.status in ("in_transit", "out_for_delivery")

    @field_serializer(
        "created_at", "updated_at", "shipped_date", "expected_delivery_date",
        "actual_delivery_date", "last_tracking_update"
    )
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "purchase_order_id", "supplier_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedInboundShipment(BaseModel):
    """Paginated response for inbound shipment queries."""

    data: list[InboundShipmentInDB] = Field(..., description="List of shipment records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# OUTBOUND SHIPMENT SCHEMAS
# =============================================================================


class OutboundShipmentBase(BaseModel):
    """Base schema for outbound shipments."""

    carrier_name: str | None = Field(None, max_length=100, description="Carrier name")
    carrier_service: str | None = Field(None, max_length=100, description="Service type")
    tracking_number: str | None = Field(None, max_length=100, description="Tracking number")
    origin_location: StoreLocation = Field(..., description="Origin warehouse")
    destination_address: str | None = Field(None, description="Delivery address")
    shipped_date: datetime | None = Field(None, description="Ship date")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery")
    notes: str | None = Field(None, description="Shipment notes")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "carrier_name": "StarTrack",
                "carrier_service": "Premium",
                "tracking_number": "ST123456789AU",
                "origin_location": "sydney",
                "destination_address": "456 Customer Ave, Brisbane QLD 4000",
                "shipped_date": "2024-01-15T09:00:00Z",
                "expected_delivery_date": "2024-01-17T17:00:00Z",
            }
        },
    )


class OutboundShipmentCreate(OutboundShipmentBase):
    """Schema for creating an outbound shipment."""

    shipment_number: str = Field(..., min_length=1, max_length=50, description="Shipment number")
    order_id: UUID = Field(..., description="Related order ID")
    status: OutboundShipmentStatus = Field(default="pending", description="Shipment status")
    tracking_events: dict[str, Any] | None = Field(None, description="Tracking event history")

    @field_validator("shipment_number")
    @classmethod
    def validate_shipment_number_format(cls, v: str) -> str:
        """Validate shipment number format."""
        return validate_shipment_number(v)


class OutboundShipmentUpdate(BaseModel):
    """Schema for updating an outbound shipment."""

    status: OutboundShipmentStatus | None = None
    carrier_name: str | None = Field(None, max_length=100)
    carrier_service: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    shipped_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    actual_delivery_date: datetime | None = None
    tracking_events: dict[str, Any] | None = None
    last_tracking_update: datetime | None = None
    notes: str | None = None

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class OutboundShipmentInDB(OutboundShipmentBase):
    """Schema for outbound shipment from database."""

    id: UUID = Field(..., description="Unique identifier")
    shipment_number: str = Field(..., description="Shipment number")
    order_id: UUID = Field(..., description="Related order ID")
    status: OutboundShipmentStatus = Field(..., description="Shipment status")
    actual_delivery_date: datetime | None = Field(None, description="Actual delivery date")
    tracking_events: dict[str, Any] | None = Field(None, description="Tracking event history")
    last_tracking_update: datetime | None = Field(None, description="Last tracking update")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime | None = Field(None, description="Record last update timestamp")

    @computed_field
    @property
    def is_delivered(self) -> bool:
        """Check if shipment has been delivered."""
        return self.status == "delivered"

    @computed_field
    @property
    def is_in_transit(self) -> bool:
        """Check if shipment is in transit."""
        return self.status in ("in_transit", "out_for_delivery")

    @computed_field
    @property
    def is_returned(self) -> bool:
        """Check if shipment was returned."""
        return self.status == "returned"

    @field_serializer(
        "created_at", "updated_at", "shipped_date", "expected_delivery_date",
        "actual_delivery_date", "last_tracking_update"
    )
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id", "order_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedOutboundShipment(BaseModel):
    """Paginated response for outbound shipment queries."""

    data: list[OutboundShipmentInDB] = Field(..., description="List of shipment records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# CARRIER CONFIGURATION SCHEMAS
# =============================================================================


class CarrierConfigurationBase(BaseModel):
    """Base schema for carrier configurations.

    Note: Sensitive fields (api_key_encrypted, webhook_secret) are excluded
    from responses for security.
    """

    carrier_name: str = Field(..., min_length=1, max_length=100, description="Carrier name")
    api_endpoint: str | None = Field(None, max_length=255, description="API endpoint URL")
    is_active: bool = Field(default=True, description="Whether carrier is active")
    supported_services: dict[str, Any] | None = Field(None, description="Supported service types")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            "example": {
                "carrier_name": "Australia Post",
                "api_endpoint": "https://api.auspost.com.au/v1",
                "is_active": True,
                "supported_services": {
                    "express": {"name": "Express Post", "days": "1-2"},
                    "standard": {"name": "Standard", "days": "2-5"},
                },
            }
        },
    )


class CarrierConfigurationCreate(CarrierConfigurationBase):
    """Schema for creating a carrier configuration.

    Includes sensitive fields for initial setup.
    """

    api_key_encrypted: str | None = Field(None, description="Encrypted API key")
    webhook_secret: str | None = Field(None, max_length=255, description="Webhook secret")


class CarrierConfigurationUpdate(BaseModel):
    """Schema for updating a carrier configuration."""

    carrier_name: str | None = Field(None, min_length=1, max_length=100)
    api_key_encrypted: str | None = None
    api_endpoint: str | None = Field(None, max_length=255)
    is_active: bool | None = None
    supported_services: dict[str, Any] | None = None
    webhook_secret: str | None = Field(None, max_length=255)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class CarrierConfigurationInDB(CarrierConfigurationBase):
    """Schema for carrier configuration from database.

    Sensitive fields are excluded from serialization.
    """

    id: UUID = Field(..., description="Unique identifier")
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime | None = Field(None, description="Record last update timestamp")

    # Sensitive fields - excluded from responses
    api_key_encrypted: str | None = Field(None, exclude=True)
    webhook_secret: str | None = Field(None, exclude=True)

    @computed_field
    @property
    def has_api_key(self) -> bool:
        """Indicate if API key is configured (without exposing the value)."""
        return self.api_key_encrypted is not None and len(self.api_key_encrypted) > 0

    @computed_field
    @property
    def has_webhook_secret(self) -> bool:
        """Indicate if webhook secret is configured (without exposing the value)."""
        return self.webhook_secret is not None and len(self.webhook_secret) > 0

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime | None) -> str | None:
        """Serialize datetime to ISO format."""
        return dt.isoformat() if dt else None

    @field_serializer("id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    def __repr__(self) -> str:
        """Override repr to mask sensitive data in logs."""
        return (
            f"<CarrierConfigurationInDB(id={self.id}, carrier={self.carrier_name}, "
            f"active={self.is_active}, has_api_key={self.has_api_key})>"
        )

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )


class PaginatedCarrierConfiguration(BaseModel):
    """Paginated response for carrier configuration queries."""

    data: list[CarrierConfigurationInDB] = Field(..., description="List of carrier records")
    total: int = Field(..., ge=0, description="Total number of records")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=100, description="Number of records per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# DASHBOARD / REPORT SCHEMAS
# =============================================================================


class InventorySummary(BaseModel):
    """Dashboard inventory summary across all locations."""

    total_stock_value: Decimal = Field(..., description="Total value of all stock")
    total_items: int = Field(..., ge=0, description="Total number of stock items")
    low_stock_items: int = Field(..., ge=0, description="Items below reorder point")
    out_of_stock_items: int = Field(..., ge=0, description="Items with zero stock")
    locations: dict[str, int] = Field(
        ..., description="Stock count per location (brisbane, sydney, melbourne)"
    )
    pending_transfers: int = Field(..., ge=0, description="Number of pending transfers")
    active_reservations: int = Field(..., ge=0, description="Number of active reservations")

    @field_serializer("total_stock_value")
    def serialize_decimal(self, val: Decimal) -> str:
        """Serialize Decimal to string with 2 decimal places."""
        return f"{val:.2f}"

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "total_stock_value": "1250000.00",
                "total_items": 5432,
                "low_stock_items": 23,
                "out_of_stock_items": 5,
                "locations": {"brisbane": 2100, "sydney": 1832, "melbourne": 1500},
                "pending_transfers": 8,
                "active_reservations": 45,
            }
        },
    )


class PurchaseOrderSummary(BaseModel):
    """Dashboard purchase order summary."""

    total_orders: int = Field(..., ge=0, description="Total number of purchase orders")
    by_status: dict[str, int] = Field(..., description="Order count by status")
    total_value: Decimal = Field(..., description="Total value of all POs")
    pending_value: Decimal = Field(..., description="Value of pending/ordered POs")
    overdue_orders: int = Field(..., ge=0, description="Orders past expected delivery")
    orders_this_month: int = Field(..., ge=0, description="Orders created this month")

    @field_serializer("total_value", "pending_value")
    def serialize_decimal(self, val: Decimal) -> str:
        """Serialize Decimal to string with 2 decimal places."""
        return f"{val:.2f}"

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "total_orders": 156,
                "by_status": {
                    "draft": 5,
                    "pending_approval": 3,
                    "approved": 8,
                    "ordered": 12,
                    "in_transit": 7,
                    "received": 118,
                    "cancelled": 3,
                },
                "total_value": "892340.00",
                "pending_value": "125000.00",
                "overdue_orders": 2,
                "orders_this_month": 14,
            }
        },
    )


class ShipmentSummary(BaseModel):
    """Dashboard shipment summary for inbound and outbound."""

    inbound_total: int = Field(..., ge=0, description="Total inbound shipments")
    inbound_by_status: dict[str, int] = Field(..., description="Inbound count by status")
    inbound_in_transit: int = Field(..., ge=0, description="Inbound shipments in transit")
    outbound_total: int = Field(..., ge=0, description="Total outbound shipments")
    outbound_by_status: dict[str, int] = Field(..., description="Outbound count by status")
    outbound_in_transit: int = Field(..., ge=0, description="Outbound shipments in transit")
    deliveries_today: int = Field(..., ge=0, description="Expected deliveries today")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "inbound_total": 89,
                "inbound_by_status": {
                    "pending": 5,
                    "in_transit": 12,
                    "out_for_delivery": 3,
                    "delivered": 68,
                    "exception": 1,
                },
                "inbound_in_transit": 15,
                "outbound_total": 342,
                "outbound_by_status": {
                    "pending": 15,
                    "in_transit": 28,
                    "out_for_delivery": 12,
                    "delivered": 280,
                    "returned": 7,
                },
                "outbound_in_transit": 40,
                "deliveries_today": 8,
            }
        },
    )


class StockMovementReport(BaseModel):
    """Stock movement report for audit purposes."""

    product_id: UUID = Field(..., description="Product ID")
    product_sku: str | None = Field(None, description="Product SKU")
    product_name: str | None = Field(None, description="Product name")
    location: StoreLocation = Field(..., description="Location")
    period_start: datetime = Field(..., description="Report period start")
    period_end: datetime = Field(..., description="Report period end")
    opening_stock: int = Field(..., ge=0, description="Stock at period start")
    closing_stock: int = Field(..., ge=0, description="Stock at period end")
    total_in: int = Field(..., ge=0, description="Total stock received")
    total_out: int = Field(..., ge=0, description="Total stock dispatched")
    adjustments: int = Field(..., description="Net adjustments (can be negative)")
    transfers_in: int = Field(..., ge=0, description="Stock transferred in")
    transfers_out: int = Field(..., ge=0, description="Stock transferred out")

    @field_serializer("period_start", "period_end")
    def serialize_datetime(self, dt: datetime) -> str:
        """Serialize datetime to ISO format."""
        return dt.isoformat()

    @field_serializer("product_id")
    def serialize_uuid(self, uuid_val: UUID) -> str:
        """Serialize UUID to string."""
        return str(uuid_val)

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# BULK OPERATION SCHEMAS
# =============================================================================


class BulkStockAdjustment(BaseModel):
    """Request schema for bulk stock adjustments."""

    adjustments: list[StockAdjustmentCreate] = Field(
        ..., min_length=1, max_length=100, description="List of adjustments to apply"
    )
    dry_run: bool = Field(
        default=False, description="If true, validate but don't apply changes"
    )

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "adjustments": [
                    {
                        "product_id": "123e4567-e89b-12d3-a456-426614174000",
                        "location": "brisbane",
                        "quantity_change": 10,
                        "previous_quantity": 90,
                        "new_quantity": 100,
                        "adjustment_type": "stock_count",
                        "reason": "Physical count correction",
                    }
                ],
                "dry_run": False,
            }
        },
    )


class BulkStockAdjustmentResult(BaseModel):
    """Response schema for bulk stock adjustment operation."""

    succeeded: int = Field(..., ge=0, description="Number of successful adjustments")
    failed: int = Field(..., ge=0, description="Number of failed adjustments")
    errors: list[str] = Field(default_factory=list, description="Error messages for failures")
    adjustment_ids: list[UUID] = Field(
        default_factory=list, description="IDs of created adjustment records"
    )

    @field_serializer("adjustment_ids")
    def serialize_uuids(self, uuids: list[UUID]) -> list[str]:
        """Serialize UUID list to string list."""
        return [str(u) for u in uuids]

    model_config = ConfigDict(from_attributes=True)


class BulkTransferRequest(BaseModel):
    """Request schema for bulk stock transfers."""

    transfers: list[StockTransferCreate] = Field(
        ..., min_length=1, max_length=50, description="List of transfers to create"
    )

    model_config = ConfigDict(str_strip_whitespace=True)


class BulkTransferResult(BaseModel):
    """Response schema for bulk transfer operation."""

    succeeded: int = Field(..., ge=0, description="Number of successful transfers")
    failed: int = Field(..., ge=0, description="Number of failed transfers")
    errors: list[str] = Field(default_factory=list, description="Error messages for failures")
    transfer_ids: list[UUID] = Field(
        default_factory=list, description="IDs of created transfer records"
    )

    @field_serializer("transfer_ids")
    def serialize_uuids(self, uuids: list[UUID]) -> list[str]:
        """Serialize UUID list to string list."""
        return [str(u) for u in uuids]

    model_config = ConfigDict(from_attributes=True)


class StockCountRequest(BaseModel):
    """Request schema for recording a stock count."""

    product_id: UUID = Field(..., description="Product to count")
    location: StoreLocation = Field(..., description="Location of count")
    counted_quantity: int = Field(..., ge=0, description="Physical count result")
    counted_by: UUID | None = Field(None, description="User performing count")
    notes: str | None = Field(None, max_length=500, description="Count notes")

    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "product_id": "123e4567-e89b-12d3-a456-426614174000",
                "location": "sydney",
                "counted_quantity": 47,
                "notes": "Annual stocktake - shelf C3",
            }
        },
    )


class StockCountResult(BaseModel):
    """Response schema for stock count operation."""

    product_id: UUID = Field(..., description="Product ID")
    location: StoreLocation = Field(..., description="Location")
    previous_quantity: int = Field(..., ge=0, description="Stock before count")
    counted_quantity: int = Field(..., ge=0, description="Physical count")
    variance: int = Field(..., description="Difference (counted - previous)")
    adjustment_id: UUID | None = Field(None, description="Adjustment record ID if created")
    counted_at: datetime = Field(..., description="Timestamp of count")

    @field_serializer("product_id", "adjustment_id")
    def serialize_uuid(self, uuid_val: UUID | None) -> str | None:
        """Serialize UUID to string."""
        return str(uuid_val) if uuid_val else None

    @field_serializer("counted_at")
    def serialize_datetime(self, dt: datetime) -> str:
        """Serialize datetime to ISO format."""
        return dt.isoformat()

    model_config = ConfigDict(from_attributes=True)
