"""Pydantic schemas for invoicing module."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, computed_field

# ============================================================================
# Tax Rate Schemas
# ============================================================================

class TaxRateBase(BaseModel):
    """Base tax rate schema."""

    name: str = Field(..., max_length=50)
    rate: Decimal = Field(..., ge=0, le=100, decimal_places=2)
    country: str | None = Field(None, max_length=2)
    is_default: bool = False
    is_active: bool = True


class TaxRateCreate(TaxRateBase):
    """Create tax rate request."""

    pass


class TaxRateUpdate(BaseModel):
    """Update tax rate request."""

    name: str | None = Field(None, max_length=50)
    rate: Decimal | None = Field(None, ge=0, le=100, decimal_places=2)
    country: str | None = Field(None, max_length=2)
    is_default: bool | None = None
    is_active: bool | None = None


class TaxRateResponse(TaxRateBase):
    """Tax rate response."""

    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Invoice Item Schemas
# ============================================================================

class InvoiceItemBase(BaseModel):
    """Base invoice item schema."""

    product_id: UUID | None = None
    description: str = Field(..., min_length=1)
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0, decimal_places=2)
    tax_rate: Decimal = Field(default=Decimal("10.00"), ge=0, le=100, decimal_places=2)


class InvoiceItemCreate(InvoiceItemBase):
    """Create invoice item request."""

    @computed_field
    @property
    def subtotal(self) -> Decimal:
        """Calculate subtotal."""
        return Decimal(str(self.quantity)) * self.unit_price

    @computed_field
    @property
    def tax_amount(self) -> Decimal:
        """Calculate tax amount."""
        return self.subtotal * (self.tax_rate / Decimal("100"))

    @computed_field
    @property
    def total(self) -> Decimal:
        """Calculate total."""
        return self.subtotal + self.tax_amount


class InvoiceItemUpdate(BaseModel):
    """Update invoice item request."""

    product_id: UUID | None = None
    description: str | None = Field(None, min_length=1)
    quantity: int | None = Field(None, gt=0)
    unit_price: Decimal | None = Field(None, ge=0, decimal_places=2)
    tax_rate: Decimal | None = Field(None, ge=0, le=100, decimal_places=2)


class InvoiceItemResponse(InvoiceItemBase):
    """Invoice item response."""

    id: UUID
    invoice_id: UUID
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Invoice Schemas
# ============================================================================

class InvoiceBase(BaseModel):
    """Base invoice schema."""

    customer_id: UUID
    order_id: UUID | None = None
    invoice_date: date = Field(default_factory=date.today)
    due_date: date
    notes: str | None = None
    payment_terms: str = "Net 30"
    tax_rate: Decimal = Field(default=Decimal("10.00"), ge=0, le=100, decimal_places=2)


class InvoiceCreate(InvoiceBase):
    """Create invoice request."""

    items: list[InvoiceItemCreate] = Field(..., min_length=1)

    @computed_field
    @property
    def subtotal(self) -> Decimal:
        """Calculate subtotal from all items."""
        return sum(item.subtotal for item in self.items)

    @computed_field
    @property
    def tax_amount(self) -> Decimal:
        """Calculate tax amount from all items."""
        return sum(item.tax_amount for item in self.items)

    @computed_field
    @property
    def total(self) -> Decimal:
        """Calculate total from all items."""
        return self.subtotal + self.tax_amount

    @computed_field
    @property
    def amount_due(self) -> Decimal:
        """Initial amount due equals total."""
        return self.total


class InvoiceUpdate(BaseModel):
    """Update invoice request."""

    customer_id: UUID | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    notes: str | None = None
    payment_terms: str | None = None
    status: str | None = Field(None, pattern="^(draft|sent|partial|paid|overdue|cancelled)$")


class InvoiceResponse(InvoiceBase):
    """Invoice response."""

    id: UUID
    invoice_number: str
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    created_at: datetime
    updated_at: datetime
    created_by: UUID | None = None
    items: list[InvoiceItemResponse] = []

    model_config = {"from_attributes": True}


class InvoiceSummary(BaseModel):
    """Invoice summary (for list views)."""

    id: UUID
    invoice_number: str
    customer_id: UUID
    customer_name: str | None = None
    invoice_date: date
    due_date: date
    status: str
    total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Payment Schemas
# ============================================================================

class InvoicePaymentBase(BaseModel):
    """Base invoice payment schema."""

    amount: Decimal = Field(..., gt=0, decimal_places=2)
    payment_method: str = Field(..., pattern="^(cash|card|account|bank_transfer|credit_card|check|other)$")
    payment_date: date = Field(default_factory=date.today)
    reference_number: str | None = Field(None, max_length=100)
    notes: str | None = None


class InvoicePaymentCreate(InvoicePaymentBase):
    """Create payment request."""

    pass


class InvoicePaymentUpdate(BaseModel):
    """Update payment request."""

    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    payment_method: str | None = Field(None, pattern="^(cash|card|account|bank_transfer|credit_card|check|other)$")
    payment_date: date | None = None
    reference_number: str | None = Field(None, max_length=100)
    notes: str | None = None


class InvoicePaymentResponse(InvoicePaymentBase):
    """Payment response."""

    id: UUID
    invoice_id: UUID
    created_at: datetime
    created_by: UUID | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# Financial Report Schemas
# ============================================================================

class RevenueSummary(BaseModel):
    """Revenue summary report."""

    total_revenue: Decimal
    total_outstanding: Decimal
    total_overdue: Decimal
    invoice_count: int
    paid_invoice_count: int
    overdue_invoice_count: int
    period_start: date | None = None
    period_end: date | None = None


class OutstandingInvoice(BaseModel):
    """Outstanding invoice for reporting."""

    invoice_number: str
    customer_name: str
    invoice_date: date
    due_date: date
    days_overdue: int
    total: Decimal
    amount_due: Decimal


class TaxByRate(BaseModel):
    """Tax breakdown for a single tax rate."""

    tax_rate: Decimal
    total_tax: Decimal
    invoice_count: int


class TaxSummary(BaseModel):
    """Tax collected summary — aggregate across all rates."""

    total_tax_collected: Decimal
    tax_by_rate: list[TaxByRate]


# ============================================================================
# Pagination Schemas
# ============================================================================

class InvoiceListResponse(BaseModel):
    """Paginated invoice list response."""

    items: list[InvoiceSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaymentListResponse(BaseModel):
    """Paginated payment list response."""

    items: list[InvoicePaymentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
