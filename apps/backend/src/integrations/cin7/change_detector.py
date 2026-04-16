"""Cin7 change detection via polling.

Cin7 Core has NO native webhook support. This module polls Cin7 APIs
using ``modified_since`` parameters to detect changes and emit events.
The ChangeDetector tracks last-polled timestamps per entity type and
returns lists of change events for downstream dispatch.

Watermarks (last-polled timestamps) are persisted to the
``integration_sync_state`` Supabase table so that a server restart does
not cause re-processing of already-seen records (UNI-1838).
"""

from datetime import UTC, datetime
from typing import Any, Literal

import structlog
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings
from src.db.cin7_models import IntegrationSyncState
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)

INTEGRATION_NAME = "cin7"


# ---------------------------------------------------------------------------
# Pure functions — date formatting
# ---------------------------------------------------------------------------


def format_modified_since(dt: datetime) -> str:
    """Format a datetime for the Cin7 Core ``modified_since`` parameter.

    Core expects ISO 8601 without timezone suffix: ``2025-11-15T08:00:00``.
    """
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def format_modified_since_omni(dt: datetime) -> str:
    """Format a datetime for the Cin7 Omni ``modifiedSince`` parameter.

    Omni expects ISO 8601 with Z suffix: ``2025-11-15T08:00:00Z``.
    """
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Pure functions — change extraction
# ---------------------------------------------------------------------------


def detect_product_changes(
    products: list[dict[str, Any]], source: Literal["core", "omni"]
) -> list[dict[str, Any]]:
    """Extract change events from a product poll result.

    Returns a list of event dicts with keys:
    ``entity_type``, ``entity_id``, ``action``, ``source``, ``data``.
    """
    events: list[dict[str, Any]] = []
    for product in products:
        if source == "core":
            entity_id = product.get("ID") or product.get("SKU", "unknown")
            name = product.get("Name", "")
        else:
            entity_id = str(product.get("id", "unknown"))
            name = product.get("description", "")

        events.append({
            "entity_type": "product",
            "entity_id": str(entity_id),
            "action": "updated",
            "source": source,
            "name": name,
            "data": product,
        })
    return events


def detect_customer_changes(
    customers: list[dict[str, Any]], source: Literal["core", "omni"]
) -> list[dict[str, Any]]:
    """Extract change events from a customer poll result."""
    events: list[dict[str, Any]] = []
    for customer in customers:
        if source == "core":
            entity_id = customer.get("ID", "unknown")
            name = customer.get("Name", "")
        else:
            entity_id = str(customer.get("id", "unknown"))
            name = customer.get("company", "") or customer.get("firstName", "")

        events.append({
            "entity_type": "customer",
            "entity_id": str(entity_id),
            "action": "updated",
            "source": source,
            "name": name,
            "data": customer,
        })
    return events


def detect_sales_changes(
    sales: list[dict[str, Any]], source: Literal["core", "omni"]
) -> list[dict[str, Any]]:
    """Extract change events from a sales poll result."""
    events: list[dict[str, Any]] = []
    for sale in sales:
        if source == "core":
            entity_id = sale.get("SaleID", "unknown")
            ref = sale.get("OrderNumber", "")
            status = sale.get("Status", "")
        else:
            entity_id = str(sale.get("id", "unknown"))
            ref = sale.get("reference", "")
            status = sale.get("status", "")

        events.append({
            "entity_type": "sales",
            "entity_id": str(entity_id),
            "action": "updated",
            "source": source,
            "reference": ref,
            "status": status,
            "data": sale,
        })
    return events


def detect_inventory_changes(
    inventory: list[dict[str, Any]], source: Literal["core", "omni"]
) -> list[dict[str, Any]]:
    """Extract change events from an inventory/stock poll result."""
    events: list[dict[str, Any]] = []
    for item in inventory:
        if source == "core":
            entity_id = item.get("ProductID") or item.get("SKU", "unknown")
            location = item.get("Location", "")
            available = item.get("Available", 0)
        else:
            entity_id = str(item.get("id", "unknown"))
            location = item.get("branchName", "")
            available = item.get("stockAvailable", 0)

        events.append({
            "entity_type": "inventory",
            "entity_id": str(entity_id),
            "action": "stock_changed",
            "source": source,
            "location": location,
            "available": available,
            "data": item,
        })
    return events


# ---------------------------------------------------------------------------
# Cin7ChangeDetector class
# ---------------------------------------------------------------------------


class Cin7ChangeDetector:
    """Polls Cin7 APIs for changes using ``modified_since`` parameter.

    Watermarks (last-polled timestamps) are stored both in memory (for
    fast access within a process) and in the ``integration_sync_state``
    Supabase table (for durability across restarts).

    Pass an ``AsyncSession`` via ``db`` to enable Supabase-backed
    watermarks.  When omitted the detector falls back to pure in-memory
    behaviour (useful in tests).
    """

    ENTITY_TYPES = ("products", "customers", "sales", "inventory")

    def __init__(
        self,
        client: Cin7Client,
        settings: Cin7Settings,
        db: AsyncSession | None = None,
    ) -> None:
        self.client = client
        self.settings = settings
        self.db = db
        self._last_polled: dict[str, datetime] = {}

    # ------------------------------------------------------------------
    # Watermark persistence (UNI-1838)
    # ------------------------------------------------------------------

    async def load_watermarks(self) -> None:
        """Seed in-memory watermarks from the Supabase ``integration_sync_state`` table.

        Call this once at startup (or before the first poll cycle) so that
        the detector resumes from where it left off rather than re-fetching
        all records since the beginning of time.
        """
        if self.db is None:
            return

        try:
            result = await self.db.execute(
                select(IntegrationSyncState).where(
                    IntegrationSyncState.integration == INTEGRATION_NAME
                )
            )
            rows = result.scalars().all()
            for row in rows:
                if row.last_synced is not None:
                    self._last_polled[row.entity_type] = row.last_synced

            logger.info(
                "cin7_watermarks_loaded",
                count=len(rows),
                entity_types=list(self._last_polled.keys()),
            )
        except Exception as exc:
            logger.warning("cin7_watermarks_load_failed", error=str(exc))

    async def _persist_watermark(self, entity_type: str, ts: datetime) -> None:
        """Upsert the watermark for *entity_type* to Supabase."""
        if self.db is None:
            return

        try:
            stmt = (
                pg_insert(IntegrationSyncState)
                .values(
                    integration=INTEGRATION_NAME,
                    entity_type=entity_type,
                    last_synced=ts,
                    updated_at=datetime.now(UTC),
                )
                .on_conflict_do_update(
                    index_elements=["integration", "entity_type"],
                    set_={
                        "last_synced": ts,
                        "updated_at": datetime.now(UTC),
                    },
                )
            )
            await self.db.execute(stmt)
            await self.db.flush()
        except Exception as exc:
            logger.warning(
                "cin7_watermark_persist_failed",
                entity_type=entity_type,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def poll_all(
        self, source: Literal["core", "omni"] = "core"
    ) -> dict[str, Any]:
        """Poll all enabled entity types and return a summary.

        Returns dict with keys: ``entity_type`` → list of change events,
        plus ``total_changes`` count.
        """
        results: dict[str, Any] = {}
        total_changes = 0

        if self.settings.sync_products:
            changes = await self.poll_products(source)
            results["products"] = changes
            total_changes += len(changes)

        if self.settings.sync_customers:
            changes = await self.poll_customers(source)
            results["customers"] = changes
            total_changes += len(changes)

        if self.settings.sync_sales:
            changes = await self.poll_sales(source)
            results["sales"] = changes
            total_changes += len(changes)

        if self.settings.sync_inventory:
            changes = await self.poll_inventory(source)
            results["inventory"] = changes
            total_changes += len(changes)

        results["total_changes"] = total_changes
        results["source"] = source
        results["polled_at"] = datetime.now(UTC).isoformat()

        logger.info(
            "cin7_poll_all_complete",
            source=source,
            total_changes=total_changes,
        )
        return results

    async def poll_products(
        self, source: Literal["core", "omni"] = "core"
    ) -> list[dict[str, Any]]:
        """Poll products endpoint with modified_since."""
        modified_since = self._last_polled.get("products")
        kwargs: dict[str, Any] = {"page": 1, "limit": 100}
        if modified_since:
            if source == "core":
                kwargs["modified_since"] = format_modified_since(modified_since)
            else:
                kwargs["modified_since"] = format_modified_since_omni(modified_since)

        try:
            if source == "core":
                data = await self.client.core.get_products(**kwargs)
                products = data.get("Products", [])
            else:
                products = await self.client.omni.get_products(**kwargs)
                if not isinstance(products, list):
                    products = []

            await self._update_last_polled("products")
            return detect_product_changes(products, source)
        except Exception as exc:
            logger.error("cin7_poll_products_failed", source=source, error=str(exc))
            return []

    async def poll_customers(
        self, source: Literal["core", "omni"] = "core"
    ) -> list[dict[str, Any]]:
        """Poll customers endpoint with modified_since."""
        modified_since = self._last_polled.get("customers")
        kwargs: dict[str, Any] = {"page": 1, "limit": 100}
        if modified_since:
            if source == "core":
                kwargs["modified_since"] = format_modified_since(modified_since)
            else:
                kwargs["modified_since"] = format_modified_since_omni(modified_since)

        try:
            if source == "core":
                data = await self.client.core.get_customers(**kwargs)
                customers = data.get("CustomerList", [])
            else:
                customers = await self.client.omni.get_contacts(**kwargs)
                if not isinstance(customers, list):
                    customers = []

            await self._update_last_polled("customers")
            return detect_customer_changes(customers, source)
        except Exception as exc:
            logger.error("cin7_poll_customers_failed", source=source, error=str(exc))
            return []

    async def poll_sales(
        self, source: Literal["core", "omni"] = "core"
    ) -> list[dict[str, Any]]:
        """Poll sales endpoint with modified_since."""
        modified_since = self._last_polled.get("sales")
        kwargs: dict[str, Any] = {"page": 1, "limit": 100}
        if modified_since:
            if source == "core":
                kwargs["modified_since"] = format_modified_since(modified_since)
            else:
                kwargs["modified_since"] = format_modified_since_omni(modified_since)

        try:
            if source == "core":
                data = await self.client.core.get_sale_list(**kwargs)
                sales = data.get("SaleList", [])
            else:
                sales = await self.client.omni.get_sales_orders(**kwargs)
                if not isinstance(sales, list):
                    sales = []

            await self._update_last_polled("sales")
            return detect_sales_changes(sales, source)
        except Exception as exc:
            logger.error("cin7_poll_sales_failed", source=source, error=str(exc))
            return []

    async def poll_inventory(
        self, source: Literal["core", "omni"] = "core"
    ) -> list[dict[str, Any]]:
        """Poll inventory/stock endpoint."""
        try:
            if source == "core":
                data = await self.client.core.get_product_availability()
                items = data.get("ProductAvailabilityList", [])
                if not isinstance(items, list):
                    items = []
            else:
                items = await self.client.omni.get_stock()
                if not isinstance(items, list):
                    items = []

            await self._update_last_polled("inventory")
            return detect_inventory_changes(items, source)
        except Exception as exc:
            logger.error("cin7_poll_inventory_failed", source=source, error=str(exc))
            return []

    def get_last_polled(self, entity_type: str) -> datetime | None:
        """Get the last polled timestamp for an entity type."""
        return self._last_polled.get(entity_type)

    def get_poll_status(self) -> dict[str, str | None]:
        """Get last-polled timestamps for all entity types."""
        return {
            et: self._last_polled[et].isoformat() if et in self._last_polled else None
            for et in self.ENTITY_TYPES
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _update_last_polled(self, entity_type: str) -> None:
        """Update the last-polled timestamp in memory and in Supabase."""
        ts = datetime.now(UTC)
        self._last_polled[entity_type] = ts
        await self._persist_watermark(entity_type, ts)
