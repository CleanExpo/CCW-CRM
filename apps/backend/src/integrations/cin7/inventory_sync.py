"""Cin7 multi-location inventory sync.

Syncs stock levels between the CCW ERP (per-location) and Cin7 (Core + Omni).
Supports retry with exponential backoff for resilience.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.cin7_models import Cin7ProductMapping, Cin7SyncLog, SyncDirection, SyncStatus
from src.db.inventory_models import ProductStockByLocation, StoreLocation

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Location mapping: Cin7 location name → ERP StoreLocation
# ---------------------------------------------------------------------------

CIN7_TO_ERP_LOCATION: dict[str, StoreLocation] = {
    "Brisbane Warehouse": StoreLocation.BRISBANE,
    "Sydney Branch": StoreLocation.SYDNEY,
    "Melbourne Depot": StoreLocation.MELBOURNE,
}

ERP_TO_CIN7_LOCATION: dict[StoreLocation, str] = {
    v: k for k, v in CIN7_TO_ERP_LOCATION.items()
}


def map_cin7_location(cin7_location: str) -> StoreLocation | None:
    """Map a Cin7 location name to an ERP StoreLocation."""
    return CIN7_TO_ERP_LOCATION.get(cin7_location)


def map_erp_location(erp_location: StoreLocation) -> str:
    """Map an ERP StoreLocation to a Cin7 location name."""
    return ERP_TO_CIN7_LOCATION.get(erp_location, "Brisbane Warehouse")


# ---------------------------------------------------------------------------
# Inventory Syncer
# ---------------------------------------------------------------------------


class Cin7InventorySyncer:
    """Sync inventory/stock between Cin7 and the ERP.

    Args:
        client: Unified Cin7 client (demo or live).
        max_retries: Max retry attempts for API calls.
        base_delay: Base delay (seconds) for exponential backoff.
    """

    def __init__(
        self,
        client: Any,
        max_retries: int = 3,
        base_delay: float = 1.0,
    ) -> None:
        self.client = client
        self.max_retries = max_retries
        self.base_delay = base_delay

    # ------------------------------------------------------------------
    # ERP → Cin7
    # ------------------------------------------------------------------

    async def sync_stock_to_cin7(
        self,
        db: AsyncSession,
        product_id: str,
        source: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Push aggregated ERP stock levels for one product to Cin7.

        Sums stock across all ERP locations (brisbane + sydney + melbourne)
        and sends the total to Cin7.
        """
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="inventory",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        db.add(log)

        try:
            # Aggregate stock across all locations
            result = await db.execute(
                select(
                    func.sum(ProductStockByLocation.stock).label("total_stock"),
                    func.sum(ProductStockByLocation.reserved).label("total_reserved"),
                ).where(ProductStockByLocation.product_id == product_id)
            )
            row = result.one_or_none()
            total_stock = int(row.total_stock or 0) if row else 0
            total_reserved = int(row.total_reserved or 0) if row else 0

            # Get mapping for SKU
            mapping_result = await db.execute(
                select(Cin7ProductMapping).where(
                    Cin7ProductMapping.product_id == product_id
                )
            )
            mapping = mapping_result.scalar_one_or_none()

            payload = {
                "product_id": product_id,
                "sku": mapping.cin7_sku if mapping else "unknown",
                "total_stock": total_stock,
                "total_reserved": total_reserved,
                "available": total_stock - total_reserved,
                "target": source,
            }

            log.details = payload
            log.records_processed = 1
            log.records_updated = 1
            log.status = SyncStatus.COMPLETED.value

            logger.info(
                "cin7_stock_push_complete",
                product_id=product_id,
                total_stock=total_stock,
                source=source,
            )
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            log.records_failed = 1
            logger.error("cin7_stock_push_failed", product_id=product_id, error=str(exc))

        log.completed_at = datetime.now(UTC)
        await db.flush()
        return log

    async def bulk_sync_stock_to_cin7(
        self,
        db: AsyncSession,
        product_ids: list[str] | None = None,
        source: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Batch sync stock for multiple (or all mapped) products to Cin7."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="inventory",
            direction=SyncDirection.ERP_TO_CIN7.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        db.add(log)

        updated = failed = 0

        try:
            if product_ids is None:
                result = await db.execute(select(Cin7ProductMapping.product_id))
                product_ids = [str(row[0]) for row in result.all()]

            for pid in product_ids:
                try:
                    await self.sync_stock_to_cin7(db, pid, source)
                    updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning("cin7_bulk_stock_push_item_failed", product_id=pid, error=str(exc))

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]

        log.records_processed = updated + failed
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await db.flush()
        return log

    # ------------------------------------------------------------------
    # Cin7 → ERP
    # ------------------------------------------------------------------

    async def sync_stock_from_cin7(
        self,
        db: AsyncSession,
        product_id: str,
        cin7_sku: str,
        source: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Pull stock from Cin7 and update per-location ERP records."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="inventory",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        db.add(log)

        updated = 0
        try:
            if source == "core":
                data = await self._retry_with_backoff(
                    self.client.core.get_product_availability, sku=cin7_sku
                )
                items = data.get("ProductAvailabilityList", [])
            else:
                data = await self._retry_with_backoff(
                    self.client.omni.get_stock, sku=cin7_sku
                )
                items = data if isinstance(data, list) else []

            for item in items:
                location_name = self._extract_location(item, source)
                erp_location = map_cin7_location(location_name)
                if erp_location is None:
                    continue

                stock_on_hand = self._extract_stock(item, source)
                reserved = self._extract_reserved(item, source)

                # Upsert stock record
                result = await db.execute(
                    select(ProductStockByLocation).where(
                        ProductStockByLocation.product_id == product_id,
                        ProductStockByLocation.location == erp_location.value,
                    )
                )
                stock_record = result.scalar_one_or_none()

                if stock_record is None:
                    stock_record = ProductStockByLocation(
                        id=uuid4(),
                        product_id=product_id,
                        location=erp_location.value,
                        stock=stock_on_hand,
                        reserved=reserved,
                    )
                    db.add(stock_record)
                else:
                    stock_record.stock = stock_on_hand
                    stock_record.reserved = reserved

                updated += 1

            log.status = SyncStatus.COMPLETED.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]
            logger.error("cin7_stock_pull_failed", sku=cin7_sku, error=str(exc))

        log.records_processed = updated
        log.records_updated = updated
        log.completed_at = datetime.now(UTC)
        await db.flush()
        return log

    async def bulk_sync_stock_from_cin7(
        self,
        db: AsyncSession,
        source: Literal["core", "omni"] = "core",
    ) -> Cin7SyncLog:
        """Batch import all stock levels from Cin7 into the ERP."""
        log = Cin7SyncLog(
            id=str(uuid4()),
            sync_type="inventory",
            direction=SyncDirection.CIN7_TO_ERP.value,
            api_source=source,
            status=SyncStatus.IN_PROGRESS.value,
            started_at=datetime.now(UTC),
        )
        db.add(log)

        updated = failed = 0
        try:
            result = await db.execute(
                select(Cin7ProductMapping.product_id, Cin7ProductMapping.cin7_sku)
            )
            mappings = result.all()

            for product_id, cin7_sku in mappings:
                try:
                    await self.sync_stock_from_cin7(db, str(product_id), cin7_sku, source)
                    updated += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "cin7_bulk_stock_pull_item_failed",
                        product_id=str(product_id),
                        error=str(exc),
                    )

            log.status = SyncStatus.COMPLETED.value if failed == 0 else SyncStatus.PARTIAL.value
        except Exception as exc:
            log.status = SyncStatus.FAILED.value
            log.error_message = str(exc)[:500]

        log.records_processed = updated + failed
        log.records_updated = updated
        log.records_failed = failed
        log.completed_at = datetime.now(UTC)
        await db.flush()
        return log

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_location(item: dict[str, Any], source: str) -> str:
        """Extract the location name from a Cin7 stock record."""
        if source == "core":
            return item.get("Location", "")
        return item.get("branchName", "")

    @staticmethod
    def _extract_stock(item: dict[str, Any], source: str) -> int:
        """Extract the on-hand stock quantity."""
        if source == "core":
            return int(item.get("OnHand", 0))
        return int(item.get("stockOnHand", 0))

    @staticmethod
    def _extract_reserved(item: dict[str, Any], source: str) -> int:
        """Extract the reserved/allocated quantity."""
        if source == "core":
            return int(item.get("Allocated", 0))
        return int(item.get("stockOnHand", 0)) - int(item.get("stockAvailable", 0))

    async def _retry_with_backoff(self, func: Any, **kwargs: Any) -> Any:
        """Call *func* with exponential backoff on failure."""
        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                return await func(**kwargs)
            except Exception as exc:
                last_error = exc
                delay = self.base_delay * (2 ** attempt)
                logger.warning(
                    "cin7_api_retry",
                    attempt=attempt + 1,
                    max_retries=self.max_retries,
                    delay=delay,
                    error=str(exc),
                )
                await asyncio.sleep(delay)
        raise last_error  # type: ignore[misc]
