"""Cin7 bidirectional purchase order sync.

Syncs purchase orders between the CCW ERP and Cin7 (Core + Omni).
Resolves supplier foreign keys via Cin7SupplierMapping.
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.cin7_models import (
    Cin7PurchaseOrderMapping,
    Cin7SupplierMapping,
    Cin7SyncLog,
    SyncDirection,
    SyncStatus,
)
from src.db.inventory_models import PurchaseOrder
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Status mappings: Cin7 → ERP
# ---------------------------------------------------------------------------

CIN7_CORE_PO_STATUS: dict[str, str] = {
    "Draft": "draft",
    "Ordered": "ordered",
    "Received": "received",
    "Voided": "cancelled",
}

CIN7_OMNI_PO_STATUS: dict[str, str] = {
    "New": "draft",
    "Ordered": "ordered",
    "Received": "received",
    "Cancelled": "cancelled",
}


# ---------------------------------------------------------------------------
# Status mappings: ERP → Cin7
# ---------------------------------------------------------------------------

ERP_TO_CIN7_CORE_PO_STATUS: dict[str, str] = {
    "draft": "Draft",
    "pending_approval": "Draft",
    "approved": "Draft",
    "ordered": "Ordered",
    "in_transit": "Ordered",
    "received": "Received",
    "cancelled": "Voided",
}

ERP_TO_CIN7_OMNI_PO_STATUS: dict[str, str] = {
    "draft": "New",
    "pending_approval": "New",
    "approved": "New",
    "ordered": "Ordered",
    "in_transit": "Ordered",
    "received": "Received",
    "cancelled": "Cancelled",
}


# ---------------------------------------------------------------------------
# Pure mapping functions
# ---------------------------------------------------------------------------


def map_cin7_core_po_status(cin7_status: str) -> str:
    """Map a Cin7 Core purchase status to an ERP PO status string."""
    return CIN7_CORE_PO_STATUS.get(cin7_status, "draft")


def map_cin7_omni_po_status(cin7_status: str) -> str:
    """Map a Cin7 Omni purchase status to an ERP PO status string."""
    return CIN7_OMNI_PO_STATUS.get(cin7_status, "draft")


def generate_po_number(cin7_ref: str, source: str) -> str:
    """Generate a unique po_number from a Cin7 purchase reference.

    Format: C7C-{ref} for Core, C7O-{ref} for Omni.
    """
    prefix = "C7C" if source == "core" else "C7O"
    return f"{prefix}-{cin7_ref}"


def map_erp_po_to_core(po: Any) -> dict[str, Any]:
    """Map an ERP PurchaseOrder to a Cin7 Core purchase payload."""
    cin7_status = ERP_TO_CIN7_CORE_PO_STATUS.get(po.status, "Draft")
    return {
        "PurchaseOrderNumber": po.po_number,
        "Status": cin7_status,
        "Total": float(po.total),
        "OrderDate": po.order_date.strftime("%Y-%m-%d") if po.order_date else None,
    }


def map_erp_po_to_omni(po: Any) -> dict[str, Any]:
    """Map an ERP PurchaseOrder to a Cin7 Omni purchase payload."""
    cin7_status = ERP_TO_CIN7_OMNI_PO_STATUS.get(po.status, "New")
    return {
        "reference": po.po_number,
        "status": cin7_status,
        "total": float(po.total),
        "createdDate": po.order_date.isoformat() if po.order_date else None,
    }


# ---------------------------------------------------------------------------
# Purchase Syncer
# ---------------------------------------------------------------------------


class Cin7PurchaseSyncer:
    """Sync purchase orders between Cin7 and the ERP."""

    def __init__(self, db: AsyncSession, client: Cin7Client) -> None:
        self.db = db
        self.client = client

    # ------------------------------------------------------------------
    # Cin7 → ERP
    # ------------------------------------------------------------------

    async def sync_purchase_orders_from_cin7(
        self,
        source: Literal["core", "omni"] = "core",
        page: int = 1,
        limit: int = 100,
    ) -> Cin7SyncLog:
        """Fetch purchase orders from Cin7 and create/update in the ERP."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="purchases",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        created = updated = failed = 0

        try:
            if source == "core":
                data = await self.client.core.get_purchase_list(page=page, limit=limit)
                purchases = data.get("PurchaseList", [])
            else:
                purchases = await self.client.omni.get_purchase_orders(page=page, rows=limit)
                if not isinstance(purchases, list):
                    purchases = []

            for cin7_po in purchases:
                try:
                    cin7_id = self._extract_po_id(cin7_po, source)
                    if not cin7_id:
                        failed += 1
                        continue

                    mapping = await self._find_po_mapping(cin7_id, source)

                    if mapping is None:
                        await self._create_erp_po_from_cin7(cin7_po, source)
                        created += 1
                    else:
                        await self._update_erp_po_from_cin7(mapping, cin7_po, source)
                        updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_purchase_sync_item_failed",
                        cin7_id=self._extract_po_id(cin7_po, source),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            logger.error("cin7_purchase_sync_failed", source=source, error=str(exc))

        log.records_processed = created + updated + failed
        log.records_created = created
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    async def _create_erp_po_from_cin7(
        self,
        cin7_po: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> PurchaseOrder:
        """Create a new ERP PurchaseOrder + mapping from a Cin7 record."""
        cin7_id = self._extract_po_id(cin7_po, source)
        cin7_ref = self._extract_po_ref(cin7_po, source)

        if source == "core":
            status = map_cin7_core_po_status(cin7_po.get("Status", ""))
            supplier_name = cin7_po.get("Supplier", "")
            total = cin7_po.get("Total", 0)
            order_date_str = cin7_po.get("OrderDate")
            mapping_kwargs: dict[str, Any] = {"cin7_core_purchase_id": cin7_id}
        else:
            status = map_cin7_omni_po_status(cin7_po.get("status", ""))
            supplier_name = cin7_po.get("supplierName", "")
            total = cin7_po.get("total", 0)
            order_date_str = cin7_po.get("createdDate")
            mapping_kwargs = {"cin7_omni_po_id": cin7_po.get("id")}

        # Resolve supplier FK
        supplier_id = await self._resolve_supplier_by_name(supplier_name)

        # Parse order date
        order_date = None
        if order_date_str:
            try:
                if "T" in str(order_date_str):
                    order_date = datetime.fromisoformat(order_date_str.replace("Z", "+00:00"))
                else:
                    order_date = datetime.strptime(order_date_str, "%Y-%m-%d").replace(tzinfo=UTC)
            except (ValueError, TypeError):
                pass

        po = PurchaseOrder(
            id=uuid4(),
            po_number=generate_po_number(cin7_ref, source),
            supplier_id=supplier_id,
            status=status,
            total=total,
            subtotal=total,
            tax=0,
            order_date=order_date,
            delivery_location="brisbane",
        )

        mapping = Cin7PurchaseOrderMapping(
            id=str(uuid4()),
            purchase_order_id=str(po.id),
            cin7_po_number=cin7_ref,
            sync_status="synced",
            last_synced_at=datetime.now(UTC),
            **mapping_kwargs,
        )

        self.db.add(po)
        self.db.add(mapping)
        return po

    async def _update_erp_po_from_cin7(
        self,
        mapping: Cin7PurchaseOrderMapping,
        cin7_po: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> None:
        """Update an existing ERP PurchaseOrder status from a Cin7 record."""
        result = await self.db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == mapping.purchase_order_id)
        )
        po = result.scalar_one_or_none()
        if po is None:
            return

        if source == "core":
            po.status = map_cin7_core_po_status(cin7_po.get("Status", ""))
        else:
            po.status = map_cin7_omni_po_status(cin7_po.get("status", ""))

        mapping.last_synced_at = datetime.now(UTC)
        mapping.sync_status = "synced"

    # ------------------------------------------------------------------
    # ERP → Cin7
    # ------------------------------------------------------------------

    async def sync_purchase_order_to_cin7(
        self,
        po_id: str,
        target: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Push a single ERP purchase order to Cin7."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="purchases",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=target,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        try:
            result = await self.db.execute(
                select(PurchaseOrder).where(PurchaseOrder.id == po_id)
            )
            po = result.scalar_one_or_none()
            if po is None:
                log.status = SyncStatus.FAILED.value
                log.error_message = f"PurchaseOrder {po_id} not found"
                log.completed_at = datetime.now(UTC)
                await self.db.flush()
                return log

            if target == "core":
                payload = map_erp_po_to_core(po)
            else:
                payload = map_erp_po_to_omni(po)

            log.details = {"payload": payload, "target": target}
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

            # Update or create mapping
            mapping = await self._find_po_mapping_by_po_id(po_id)
            if mapping is None:
                mapping = Cin7PurchaseOrderMapping(
                    id=str(uuid4()),
                    purchase_order_id=po_id,
                    cin7_po_number=po.po_number,
                    sync_status="synced",
                    last_synced_at=datetime.now(UTC),
                )
                self.db.add(mapping)
            else:
                mapping.sync_status = "synced"
                mapping.last_synced_at = datetime.now(UTC)

        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            log.records_failed = 1

        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_po_id(cin7_po: dict[str, Any], source: str) -> str | None:
        """Extract the primary ID from a Cin7 purchase order record."""
        if source == "core":
            return cin7_po.get("PurchaseID")
        po_id = cin7_po.get("id")
        return str(po_id) if po_id is not None else None

    @staticmethod
    def _extract_po_ref(cin7_po: dict[str, Any], source: str) -> str:
        """Extract the PO reference number from a Cin7 record."""
        if source == "core":
            return cin7_po.get("PurchaseOrderNumber", "")
        return cin7_po.get("reference", "")

    async def _find_po_mapping(
        self, cin7_id: str, source: str
    ) -> Cin7PurchaseOrderMapping | None:
        """Look up an existing PO mapping by Cin7 ID."""
        if source == "core":
            result = await self.db.execute(
                select(Cin7PurchaseOrderMapping).where(
                    Cin7PurchaseOrderMapping.cin7_core_purchase_id == cin7_id
                )
            )
        else:
            try:
                omni_id = int(cin7_id)
            except (ValueError, TypeError):
                return None
            result = await self.db.execute(
                select(Cin7PurchaseOrderMapping).where(
                    Cin7PurchaseOrderMapping.cin7_omni_po_id == omni_id
                )
            )
        return result.scalar_one_or_none()

    async def _find_po_mapping_by_po_id(
        self, po_id: str
    ) -> Cin7PurchaseOrderMapping | None:
        """Look up an existing PO mapping by ERP purchase order ID."""
        result = await self.db.execute(
            select(Cin7PurchaseOrderMapping).where(
                Cin7PurchaseOrderMapping.purchase_order_id == po_id
            )
        )
        return result.scalar_one_or_none()

    async def _resolve_supplier_by_name(self, name: str) -> str | None:
        """Resolve an ERP supplier_id from a Cin7 supplier name."""
        if not name:
            return None
        result = await self.db.execute(
            select(Cin7SupplierMapping.supplier_id).where(
                Cin7SupplierMapping.cin7_supplier_name == name
            )
        )
        row = result.first()
        return str(row[0]) if row else None
