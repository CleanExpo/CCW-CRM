"""Cin7 event dispatcher.

Routes Cin7 change events (from polling or webhooks) to SSE channels
and the alert manager. Provides standardized event building functions
for consistent payloads across all Cin7 event types.
"""

from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Event type constants
# ---------------------------------------------------------------------------

CIN7_EVENT_PRODUCT_CHANGED = "cin7.product.changed"
CIN7_EVENT_CUSTOMER_CHANGED = "cin7.customer.changed"
CIN7_EVENT_SALES_CHANGED = "cin7.sales.changed"
CIN7_EVENT_INVENTORY_CHANGED = "cin7.inventory.changed"
CIN7_EVENT_PURCHASE_ORDER_CHANGED = "cin7.purchase_order.changed"
CIN7_EVENT_INVOICE_CHANGED = "cin7.invoice.changed"
CIN7_EVENT_SYNC_COMPLETED = "cin7.sync.completed"
CIN7_EVENT_SYNC_FAILED = "cin7.sync.failed"
CIN7_EVENT_POLL_COMPLETED = "cin7.poll.completed"

ALL_CIN7_EVENTS = [
    CIN7_EVENT_PRODUCT_CHANGED,
    CIN7_EVENT_CUSTOMER_CHANGED,
    CIN7_EVENT_SALES_CHANGED,
    CIN7_EVENT_INVENTORY_CHANGED,
    CIN7_EVENT_PURCHASE_ORDER_CHANGED,
    CIN7_EVENT_INVOICE_CHANGED,
    CIN7_EVENT_SYNC_COMPLETED,
    CIN7_EVENT_SYNC_FAILED,
    CIN7_EVENT_POLL_COMPLETED,
]

# SSE channel name
CIN7_SSE_CHANNEL = "cin7-sync"


# ---------------------------------------------------------------------------
# Pure functions — event building (testable without async)
# ---------------------------------------------------------------------------


def build_product_event(
    product_data: dict[str, Any], source: str, action: str = "updated"
) -> dict[str, Any]:
    """Build a standardized product change event dict.

    Args:
        product_data: Raw product data from change detection.
        source: "core" or "omni".
        action: "created", "updated", or "deleted".

    Returns:
        Standardized event dict with ``event_type``, ``timestamp``, etc.
    """
    return {
        "event_type": CIN7_EVENT_PRODUCT_CHANGED,
        "entity_type": "product",
        "entity_id": product_data.get("entity_id", "unknown"),
        "name": product_data.get("name", ""),
        "action": action,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def build_customer_event(
    customer_data: dict[str, Any], source: str, action: str = "updated"
) -> dict[str, Any]:
    """Build a standardized customer change event dict."""
    return {
        "event_type": CIN7_EVENT_CUSTOMER_CHANGED,
        "entity_type": "customer",
        "entity_id": customer_data.get("entity_id", "unknown"),
        "name": customer_data.get("name", ""),
        "action": action,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def build_sales_event(
    sales_data: dict[str, Any], source: str, action: str = "updated"
) -> dict[str, Any]:
    """Build a standardized sales change event dict."""
    return {
        "event_type": CIN7_EVENT_SALES_CHANGED,
        "entity_type": "sales",
        "entity_id": sales_data.get("entity_id", "unknown"),
        "reference": sales_data.get("reference", ""),
        "status": sales_data.get("status", ""),
        "action": action,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def build_inventory_event(
    inventory_data: dict[str, Any], source: str, action: str = "stock_changed"
) -> dict[str, Any]:
    """Build a standardized inventory change event dict."""
    return {
        "event_type": CIN7_EVENT_INVENTORY_CHANGED,
        "entity_type": "inventory",
        "entity_id": inventory_data.get("entity_id", "unknown"),
        "location": inventory_data.get("location", ""),
        "available": inventory_data.get("available", 0),
        "action": action,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def build_sync_result_event(
    sync_type: str,
    status: str,
    records: int,
    error: str | None = None,
) -> dict[str, Any]:
    """Build a sync result event for SSE.

    Args:
        sync_type: "products", "customers", "sales", "inventory".
        status: "completed", "failed", "partial".
        records: Number of records processed.
        error: Error message if failed.
    """
    event_type = (
        CIN7_EVENT_SYNC_COMPLETED if status != "failed" else CIN7_EVENT_SYNC_FAILED
    )
    result: dict[str, Any] = {
        "event_type": event_type,
        "sync_type": sync_type,
        "status": status,
        "records_processed": records,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if error:
        result["error"] = error
    return result


def build_purchase_order_event(
    po_data: dict[str, Any], source: str, action: str = "updated"
) -> dict[str, Any]:
    """Build a standardized purchase order change event dict.

    Args:
        po_data: Raw purchase order data from change detection or webhook.
        source: "core" or "omni".
        action: "created", "updated", or "received".

    Returns:
        Standardized event dict with ``event_type``, ``timestamp``, etc.
    """
    return {
        "event_type": CIN7_EVENT_PURCHASE_ORDER_CHANGED,
        "entity_type": "purchase_order",
        "entity_id": po_data.get("entity_id", "unknown"),
        "reference": po_data.get("reference", ""),
        "status": po_data.get("status", ""),
        "supplier": po_data.get("supplier", ""),
        "action": action,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def build_invoice_event(
    invoice_data: dict[str, Any], source: str, action: str = "updated"
) -> dict[str, Any]:
    """Build a standardized invoice change event dict.

    Args:
        invoice_data: Raw invoice data from change detection or webhook.
        source: "core" or "omni".
        action: "created", "updated", or "paid".

    Returns:
        Standardized event dict with ``event_type``, ``timestamp``, etc.
    """
    return {
        "event_type": CIN7_EVENT_INVOICE_CHANGED,
        "entity_type": "invoice",
        "entity_id": invoice_data.get("entity_id", "unknown"),
        "reference": invoice_data.get("reference", ""),
        "status": invoice_data.get("status", ""),
        "total": invoice_data.get("total", 0),
        "action": action,
        "source": source,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def build_poll_summary_event(
    entity_types: list[str],
    changes_detected: int,
    duration_ms: int,
) -> dict[str, Any]:
    """Build a poll summary event for SSE.

    Args:
        entity_types: List of entity types polled.
        changes_detected: Total changes detected across all types.
        duration_ms: Polling duration in milliseconds.
    """
    return {
        "event_type": CIN7_EVENT_POLL_COMPLETED,
        "entity_types": entity_types,
        "changes_detected": changes_detected,
        "duration_ms": duration_ms,
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ---------------------------------------------------------------------------
# Cin7EventDispatcher class
# ---------------------------------------------------------------------------


class Cin7EventDispatcher:
    """Routes Cin7 events to SSE channels and the alert manager.

    Receives events from the change detector or webhook handler and:
    1. Publishes them to the ``cin7-sync`` SSE channel for real-time UI
    2. Creates alerts via AlertManager on failures
    """

    def __init__(self, sse_service: Any, alert_manager: Any | None = None) -> None:
        self.sse_service = sse_service
        self.alert_manager = alert_manager

    async def dispatch_change_events(
        self, events: list[dict[str, Any]]
    ) -> int:
        """Publish a batch of change events to the SSE channel.

        Returns the number of events dispatched.
        """
        for event in events:
            entity_type = event.get("entity_type", "unknown")
            # Map entity type to event builder
            if entity_type == "product":
                sse_event = build_product_event(event, event.get("source", "core"))
            elif entity_type == "customer":
                sse_event = build_customer_event(event, event.get("source", "core"))
            elif entity_type == "sales":
                sse_event = build_sales_event(event, event.get("source", "core"))
            elif entity_type == "inventory":
                sse_event = build_inventory_event(event, event.get("source", "core"))
            elif entity_type == "purchase_order":
                sse_event = build_purchase_order_event(event, event.get("source", "core"))
            elif entity_type == "invoice":
                sse_event = build_invoice_event(event, event.get("source", "core"))
            else:
                sse_event = event

            await self.sse_service.publish(CIN7_SSE_CHANNEL, sse_event)

        logger.info(
            "cin7_events_dispatched",
            count=len(events),
            channel=CIN7_SSE_CHANNEL,
        )
        return len(events)

    async def dispatch_sync_result(
        self,
        sync_type: str,
        status: str,
        records: int,
        error: str | None = None,
    ) -> None:
        """Publish a sync result event to SSE."""
        event = build_sync_result_event(sync_type, status, records, error)
        await self.sse_service.publish(CIN7_SSE_CHANNEL, event)

        if status == "failed" and self.alert_manager:
            await self.dispatch_failure_alert(sync_type, error or "Unknown error")

    async def dispatch_poll_summary(
        self,
        entity_types: list[str],
        changes: int,
        duration_ms: int,
    ) -> None:
        """Publish a poll summary event to SSE."""
        event = build_poll_summary_event(entity_types, changes, duration_ms)
        await self.sse_service.publish(CIN7_SSE_CHANNEL, event)

    async def dispatch_failure_alert(
        self,
        sync_type: str,
        error: str,
        severity: str = "warning",
    ) -> None:
        """Create an alert via AlertManager for a sync failure."""
        if self.alert_manager is None:
            logger.warning("cin7_no_alert_manager", msg="AlertManager not available")
            return

        await self.alert_manager.create_alert(
            alert_type=f"cin7_{sync_type}_sync_failed",
            severity=severity,
            title=f"Cin7 {sync_type} sync failed",
            message=f"Cin7 {sync_type} synchronization failed: {error}",
            metadata={"sync_type": sync_type, "error": error},
            send_notification=severity in ("error", "critical"),
        )
