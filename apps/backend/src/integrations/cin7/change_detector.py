"""Cin7 change detection via polling.

Cin7 Core has NO native webhook support. This module polls Cin7 APIs
using ``modified_since`` parameters to detect changes and emit events.
The ChangeDetector tracks last-polled timestamps per entity type and
returns lists of change events for downstream dispatch.
"""

from datetime import UTC, datetime
from typing import Any, Literal

import structlog

from src.config.cin7_settings import Cin7Settings
from src.integrations.cin7.client import Cin7Client

logger = structlog.get_logger(__name__)


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


# Cin7 Core status values that indicate a PO has reached a billing milestone.
_BILLED_STATUSES = frozenset({"Billed", "PartlyBilled"})


def detect_purchase_order_changes(
    purchase_orders: list[dict[str, Any]], source: Literal["core", "omni"]
) -> list[dict[str, Any]]:
    """Extract change events from a purchase-order poll result.

    Emits two event types per PO:

    - ``entity_type="purchase_order"`` — always emitted for every changed PO.
    - ``entity_type="invoice"`` — emitted additionally when the PO status
      indicates a supplier invoice has been raised (Cin7 Core surfaces invoices
      as POs in "Billed" or "PartlyBilled" status because there is no dedicated
      supplier-invoice endpoint).

    Returns:
        List of event dicts with ``entity_type``, ``entity_id``, ``action``,
        ``source``, ``reference``, ``status``, and ``data``.
    """
    events: list[dict[str, Any]] = []
    for po in purchase_orders:
        if source == "core":
            entity_id = po.get("PurchaseOrderID") or po.get("ID", "unknown")
            ref = po.get("OrderNumber", "")
            status = po.get("Status", "")
        else:
            entity_id = str(po.get("id", "unknown"))
            ref = po.get("reference", "")
            status = po.get("status", "")

        # Determine action from status
        if status in _BILLED_STATUSES:
            po_action = "invoiced"
        elif status == "Received":
            po_action = "received"
        else:
            po_action = "updated"

        base = {
            "entity_id": str(entity_id),
            "action": po_action,
            "source": source,
            "reference": ref,
            "status": status,
            "data": po,
        }

        # Always emit a purchase_order event
        events.append({**base, "entity_type": "purchase_order"})

        # Emit an invoice event when billing status is reached
        if status in _BILLED_STATUSES:
            invoice_action = (
                "partly_invoiced" if status == "PartlyBilled" else "invoiced"
            )
            events.append({
                **base,
                "entity_type": "invoice",
                "action": invoice_action,
            })

    return events


# ---------------------------------------------------------------------------
# Cin7ChangeDetector class
# ---------------------------------------------------------------------------


class Cin7ChangeDetector:
    """Polls Cin7 APIs for changes using ``modified_since`` parameter.

    Tracks last-polled timestamps per entity type in memory.  Call
    :meth:`seed_from_connection` before polling to restore watermarks from the
    database, and :meth:`get_updated_watermarks` afterwards to obtain the new
    timestamps ready to be written back to ``Cin7Connection``.

    Typical caller pattern::

        detector = Cin7ChangeDetector(client, settings)
        detector.seed_from_connection(connection)
        results = await detector.poll_all(source)
        watermarks = detector.get_updated_watermarks()
        connection.last_product_sync_at = watermarks.get("products")
        connection.last_customer_sync_at = watermarks.get("customers")
        connection.last_sales_sync_at = watermarks.get("sales")
        connection.last_inventory_sync_at = watermarks.get("inventory")
        await db.commit()
    """

    ENTITY_TYPES = ("products", "customers", "sales", "inventory", "purchase_orders")

    # Mapping from detector entity key → Cin7Connection column name
    _CONNECTION_ATTR: dict[str, str] = {
        "products": "last_product_sync_at",
        "customers": "last_customer_sync_at",
        "sales": "last_sales_sync_at",
        "inventory": "last_inventory_sync_at",
        "purchase_orders": "last_purchase_order_sync_at",
    }

    def __init__(self, client: Cin7Client, settings: Cin7Settings) -> None:
        self.client = client
        self.settings = settings
        self._last_polled: dict[str, datetime] = {}

    # ------------------------------------------------------------------
    # Watermark persistence helpers
    # ------------------------------------------------------------------

    def seed_from_connection(self, connection: Any) -> None:
        """Seed in-memory watermarks from a ``Cin7Connection`` DB row.

        Call this *before* polling so that ``modified_since`` picks up from
        where the last successful poll finished rather than from the epoch.

        Args:
            connection: A ``Cin7Connection`` SQLAlchemy model instance.
        """
        for entity, attr in self._CONNECTION_ATTR.items():
            value: datetime | None = getattr(connection, attr, None)
            if value is not None:
                self._last_polled[entity] = value
                logger.debug(
                    "cin7_watermark_loaded",
                    entity=entity,
                    last_polled=value.isoformat(),
                )

    def get_updated_watermarks(self) -> dict[str, datetime]:
        """Return current in-memory watermarks keyed by entity type.

        The caller is responsible for writing these back to the
        ``Cin7Connection`` row and committing the session::

            watermarks = detector.get_updated_watermarks()
            connection.last_product_sync_at = watermarks.get("products")
            connection.last_sales_sync_at = watermarks.get("sales")
            ...
            await db.commit()

        Returns:
            Dict mapping entity type → last polled datetime.
        """
        return dict(self._last_polled)

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

        if self.settings.sync_purchase_orders:
            changes = await self.poll_purchase_orders(source)
            results["purchase_orders"] = changes
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

            self._update_last_polled("products")
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

            self._update_last_polled("customers")
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

            self._update_last_polled("sales")
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

            self._update_last_polled("inventory")
            return detect_inventory_changes(items, source)
        except Exception as exc:
            logger.error("cin7_poll_inventory_failed", source=source, error=str(exc))
            return []

    async def poll_purchase_orders(
        self, source: Literal["core", "omni"] = "core"
    ) -> list[dict[str, Any]]:
        """Poll purchase orders endpoint with modified_since.

        Emits both ``purchase_order`` and ``invoice`` events (see
        :func:`detect_purchase_order_changes` for the dual-event logic).
        Only Cin7 Core is supported; Omni purchase order polling does not
        support a ``modified_since`` filter so we return an empty list for
        that source to avoid full-catalogue noise on every poll cycle.
        """
        if source != "core":
            logger.debug(
                "cin7_poll_purchase_orders_skipped",
                reason="omni_no_modified_since",
            )
            return []

        modified_since = self._last_polled.get("purchase_orders")
        kwargs: dict[str, Any] = {"page": 1, "limit": 100}
        if modified_since:
            kwargs["modified_since"] = format_modified_since(modified_since)

        try:
            data = await self.client.core.get_purchase_list(**kwargs)
            purchase_orders = data.get("PurchaseOrderList", [])
            if not isinstance(purchase_orders, list):
                purchase_orders = []

            self._update_last_polled("purchase_orders")
            return detect_purchase_order_changes(purchase_orders, source)
        except Exception as exc:
            logger.error(
                "cin7_poll_purchase_orders_failed", source=source, error=str(exc)
            )
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

    def _update_last_polled(self, entity_type: str) -> None:
        """Update the last-polled timestamp for an entity type."""
        self._last_polled[entity_type] = datetime.now(UTC)
