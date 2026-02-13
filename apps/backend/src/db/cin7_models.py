"""Cin7 integration database models.

Models for storing Cin7 connection details, product mappings, and sync audit logs.
Supports both Cin7 Core (DEAR) and Cin7 Omni connections.
"""

import enum
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class SyncDirection(str, enum.Enum):
    """Direction of data sync."""

    CIN7_TO_ERP = "cin7_to_erp"
    ERP_TO_CIN7 = "erp_to_cin7"
    BIDIRECTIONAL = "bidirectional"


class SyncStatus(str, enum.Enum):
    """Status of a sync operation."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class Cin7Connection(Base):
    """Cin7 integration connection configuration.

    Stores credentials and sync state for Cin7 Core and/or Omni connections.
    """

    __tablename__ = "cin7_connections"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    organization_id: Mapped[str | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
    )

    # Connection identity
    account_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    connection_type: Mapped[str] = mapped_column(
        String(20), default="both"
    )  # "core", "omni", "both"

    # Cin7 Core credentials (encrypted in production)
    core_account_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    core_application_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cin7 Omni credentials (encrypted in production)
    omni_username: Mapped[str | None] = mapped_column(Text, nullable=True)
    omni_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Connection state
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_product_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_customer_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_inventory_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Flexible sync configuration
    sync_settings: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

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
        return f"<Cin7Connection(account={self.account_name}, type={self.connection_type}, active={self.is_active})>"


class Cin7ProductMapping(Base):
    """Mapping between ERP products and Cin7 products.

    Tracks which local product corresponds to which Cin7 product ID/SKU
    across both Core and Omni systems.
    """

    __tablename__ = "cin7_product_mappings"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # ERP product reference
    product_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        index=True,
    )

    # Cin7 Core identifiers
    cin7_core_product_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Cin7 Omni identifiers
    cin7_omni_product_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Shared SKU (should be same across both systems)
    cin7_sku: Mapped[str] = mapped_column(String(100), index=True)

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")

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
        return f"<Cin7ProductMapping(product={self.product_id}, sku={self.cin7_sku})>"


class Cin7CustomerMapping(Base):
    """Mapping between ERP customers and Cin7 customers/contacts.

    Tracks which local customer corresponds to which Cin7 customer ID
    across both Core and Omni systems.
    """

    __tablename__ = "cin7_customer_mappings"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # ERP customer reference
    customer_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        index=True,
    )

    # Cin7 Core identifier
    cin7_core_customer_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Cin7 Omni identifier
    cin7_omni_contact_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Cin7 customer name (for quick lookup / display)
    cin7_customer_name: Mapped[str] = mapped_column(String(255))

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")

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
        return f"<Cin7CustomerMapping(customer={self.customer_id}, name={self.cin7_customer_name})>"


class Cin7OrderMapping(Base):
    """Mapping between ERP orders and Cin7 sales orders.

    Tracks which local order corresponds to which Cin7 sale ID
    across both Core and Omni systems.
    """

    __tablename__ = "cin7_order_mappings"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # ERP order reference
    order_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        index=True,
    )

    # Cin7 Core identifier
    cin7_core_sale_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Cin7 Omni identifier
    cin7_omni_order_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Cin7 order/sale number
    cin7_order_number: Mapped[str] = mapped_column(String(100))

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")

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
        return f"<Cin7OrderMapping(order={self.order_id}, number={self.cin7_order_number})>"


class Cin7QuoteMapping(Base):
    """Mapping between ERP quotes and Cin7 Omni quotes.

    Cin7 Core does not expose a quotes endpoint, so this only
    tracks Omni quote IDs.
    """

    __tablename__ = "cin7_quote_mappings"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # ERP quote reference
    quote_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        index=True,
    )

    # Cin7 Omni identifier (quotes are Omni-only)
    cin7_omni_quote_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Cin7 quote reference number
    cin7_quote_reference: Mapped[str] = mapped_column(String(100))

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")

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
        return f"<Cin7QuoteMapping(quote={self.quote_id}, ref={self.cin7_quote_reference})>"


class Cin7SupplierMapping(Base):
    """Mapping between ERP suppliers and Cin7 suppliers.

    Tracks which local supplier corresponds to which Cin7 supplier ID.
    Note: Cin7 Omni has no dedicated supplier API — suppliers are embedded
    in purchase order records.
    """

    __tablename__ = "cin7_supplier_mappings"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # ERP supplier reference
    supplier_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        index=True,
    )

    # Cin7 Core identifier
    cin7_core_supplier_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Cin7 Omni identifier (no dedicated API, but may appear in POs)
    cin7_omni_supplier_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Cin7 supplier name (for quick lookup / display)
    cin7_supplier_name: Mapped[str] = mapped_column(String(255))

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")

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
        return f"<Cin7SupplierMapping(supplier={self.supplier_id}, name={self.cin7_supplier_name})>"


class Cin7PurchaseOrderMapping(Base):
    """Mapping between ERP purchase orders and Cin7 purchase orders.

    Tracks which local PO corresponds to which Cin7 purchase ID
    across both Core and Omni systems.
    """

    __tablename__ = "cin7_purchase_order_mappings"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # ERP purchase order reference
    purchase_order_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        index=True,
    )

    # Cin7 Core identifier
    cin7_core_purchase_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Cin7 Omni identifier
    cin7_omni_po_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )

    # Cin7 PO number/reference
    cin7_po_number: Mapped[str] = mapped_column(String(100))

    # Sync state
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(String(50), default="pending")

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
        return f"<Cin7PurchaseOrderMapping(po={self.purchase_order_id}, number={self.cin7_po_number})>"


class Cin7SyncLog(Base):
    """Audit trail for Cin7 sync operations.

    Records every sync attempt with results for debugging and monitoring.
    """

    __tablename__ = "cin7_sync_logs"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    connection_id: Mapped[str | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Sync metadata
    sync_type: Mapped[str] = mapped_column(
        String(50)
    )  # "products", "customers", "sales", "inventory"
    direction: Mapped[str] = mapped_column(
        String(20), default=SyncDirection.CIN7_TO_ERP.value
    )
    api_source: Mapped[str] = mapped_column(
        String(10), default="core"
    )  # "core" or "omni"

    # Results
    status: Mapped[str] = mapped_column(
        String(20), default=SyncStatus.PENDING.value
    )
    records_processed: Mapped[int] = mapped_column(Integer, default=0)
    records_created: Mapped[int] = mapped_column(Integer, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, default=0)
    records_failed: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Detailed results (JSON for flexibility)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Timestamps
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Cin7SyncLog(type={self.sync_type}, status={self.status}, processed={self.records_processed})>"
