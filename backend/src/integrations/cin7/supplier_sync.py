"""Cin7 bidirectional supplier sync.

Syncs suppliers between the CCW ERP and Cin7 Core.
Note: Cin7 Omni has no dedicated supplier API — suppliers are embedded
in purchase order records as ``supplierName``.
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.cin7_models import Cin7SupplierMapping, Cin7SyncLog, SyncDirection, SyncStatus
from src.db.inventory_models import Supplier
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Field extraction helpers
# ---------------------------------------------------------------------------


def extract_core_supplier_fields(cin7_supplier: dict[str, Any]) -> dict[str, Any]:
    """Extract ERP-compatible fields from a Cin7 Core supplier dict."""
    return {
        "company_name": cin7_supplier.get("Name", ""),
        "payment_terms": cin7_supplier.get("PaymentTerm"),
        "is_active": cin7_supplier.get("Status") == "Active",
    }


def generate_supplier_code(cin7_id: str, source: str) -> str:
    """Generate a unique supplier_code from a Cin7 supplier ID.

    Format: CIN7-S-{first 8 chars of id}
    """
    short_id = str(cin7_id)[:8]
    return f"CIN7-S-{short_id}"


def map_erp_supplier_to_core(supplier: Any) -> dict[str, Any]:
    """Map an ERP Supplier to a Cin7 Core API payload."""
    return {
        "Name": supplier.company_name,
        "Currency": "AUD",
        "PaymentTerm": supplier.payment_terms or "30 days",
        "TaxRule": "GST on Purchases",
        "Status": "Active" if supplier.is_active else "Inactive",
    }


def map_erp_supplier_to_omni(supplier: Any) -> dict[str, Any]:
    """Map an ERP Supplier to a Cin7 Omni-compatible dict.

    Note: Omni has no dedicated supplier API. Suppliers appear
    embedded in PO payloads as ``supplierName``.
    """
    return {
        "name": supplier.company_name,
        "isActive": supplier.is_active,
    }


# ---------------------------------------------------------------------------
# Supplier Syncer
# ---------------------------------------------------------------------------


class Cin7SupplierSyncer:
    """Bidirectional supplier sync between Cin7 and the ERP."""

    def __init__(
        self,
        db: AsyncSession,
        client: Cin7Client,
        conflict_strategy: Literal["erp_wins", "cin7_wins"] = "erp_wins",
    ) -> None:
        self.db = db
        self.client = client
        self.conflict_strategy = conflict_strategy

    # ------------------------------------------------------------------
    # Cin7 → ERP
    # ------------------------------------------------------------------

    async def sync_suppliers_from_cin7(
        self,
        source: Literal["core", "omni"] = "core",
        page: int = 1,
        limit: int = 100,
    ) -> Cin7SyncLog:
        """Fetch suppliers from Cin7 and create/update in the ERP."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="suppliers",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        created = updated = failed = 0

        try:
            if source == "core":
                data = await self.client.core.get_suppliers(page=page, limit=limit)
                suppliers = data.get("SupplierList", [])
            else:
                # Omni has no dedicated supplier API
                suppliers = []
                logger.info("cin7_omni_no_supplier_api", msg="Omni has no dedicated supplier endpoint")

            for cin7_supplier in suppliers:
                try:
                    cin7_id = self._extract_id(cin7_supplier, source)
                    if not cin7_id:
                        failed += 1
                        continue

                    mapping = await self._find_mapping(cin7_id, source)

                    if mapping is None:
                        await self._create_erp_supplier_from_cin7(cin7_supplier, source)
                        created += 1
                    else:
                        await self._update_erp_supplier_from_cin7(mapping, cin7_supplier, source)
                        updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_supplier_sync_item_failed",
                        cin7_id=self._extract_id(cin7_supplier, source),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            logger.error("cin7_supplier_sync_failed", source=source, error=str(exc))

        log.records_processed = created + updated + failed
        log.records_created = created
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await self.db.flush()
        return log

    async def _create_erp_supplier_from_cin7(
        self,
        cin7_supplier: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> Supplier:
        """Create a new ERP Supplier + mapping from a Cin7 record."""
        cin7_id = self._extract_id(cin7_supplier, source)

        fields = extract_core_supplier_fields(cin7_supplier)
        mapping_kwargs: dict[str, Any] = {"cin7_core_supplier_id": cin7_id}

        supplier = Supplier(
            id=uuid4(),
            supplier_code=generate_supplier_code(cin7_id, source),
            **fields,
        )

        name = fields.get("company_name", cin7_id)
        mapping = Cin7SupplierMapping(
            id=str(uuid4()),
            supplier_id=str(supplier.id),
            cin7_supplier_name=name,
            sync_status="synced",
            last_synced_at=datetime.now(UTC),
            **mapping_kwargs,
        )

        self.db.add(supplier)
        self.db.add(mapping)
        return supplier

    async def _update_erp_supplier_from_cin7(
        self,
        mapping: Cin7SupplierMapping,
        cin7_supplier: dict[str, Any],
        source: Literal["core", "omni"],
    ) -> None:
        """Update an existing ERP Supplier from a Cin7 record."""
        if self.conflict_strategy == "erp_wins":
            mapping.last_synced_at = datetime.now(UTC)
            mapping.sync_status = "synced"
            return

        result = await self.db.execute(
            select(Supplier).where(Supplier.id == mapping.supplier_id)
        )
        supplier = result.scalar_one_or_none()
        if supplier is None:
            return

        fields = extract_core_supplier_fields(cin7_supplier)
        for key, value in fields.items():
            setattr(supplier, key, value)

        mapping.last_synced_at = datetime.now(UTC)
        mapping.sync_status = "synced"

    # ------------------------------------------------------------------
    # ERP → Cin7
    # ------------------------------------------------------------------

    async def sync_supplier_to_cin7(
        self,
        supplier_id: str,
        target: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Push a single ERP supplier to Cin7."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="suppliers",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=target,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        self.db.add(log)

        try:
            result = await self.db.execute(
                select(Supplier).where(Supplier.id == supplier_id)
            )
            supplier = result.scalar_one_or_none()
            if supplier is None:
                log.status = SyncStatus.FAILED.value
                log.error_message = f"Supplier {supplier_id} not found"
                log.completed_at = datetime.now(UTC)
                await self.db.flush()
                return log

            if target == "core":
                payload = map_erp_supplier_to_core(supplier)
            else:
                payload = map_erp_supplier_to_omni(supplier)

            log.details = {"payload": payload, "target": target}
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

            # Update or create mapping
            mapping = await self._find_mapping_by_supplier_id(supplier_id)
            if mapping is None:
                mapping = Cin7SupplierMapping(
                    id=str(uuid4()),
                    supplier_id=supplier_id,
                    cin7_supplier_name=supplier.company_name,
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
    def _extract_id(cin7_supplier: dict[str, Any], source: str) -> str | None:
        """Extract the primary identifier from a Cin7 supplier."""
        if source == "core":
            return cin7_supplier.get("ID")
        # Omni: no dedicated supplier API
        name = cin7_supplier.get("supplierName")
        return name if name else None

    async def _find_mapping(
        self, cin7_id: str, source: str
    ) -> Cin7SupplierMapping | None:
        """Look up an existing supplier mapping by Cin7 ID."""
        if source == "core":
            result = await self.db.execute(
                select(Cin7SupplierMapping).where(
                    Cin7SupplierMapping.cin7_core_supplier_id == cin7_id
                )
            )
        else:
            # Omni: look up by name since there's no dedicated supplier ID
            result = await self.db.execute(
                select(Cin7SupplierMapping).where(
                    Cin7SupplierMapping.cin7_supplier_name == cin7_id
                )
            )
        return result.scalar_one_or_none()

    async def _find_mapping_by_supplier_id(
        self, supplier_id: str
    ) -> Cin7SupplierMapping | None:
        """Look up an existing supplier mapping by ERP supplier ID."""
        result = await self.db.execute(
            select(Cin7SupplierMapping).where(
                Cin7SupplierMapping.supplier_id == supplier_id
            )
        )
        return result.scalar_one_or_none()
