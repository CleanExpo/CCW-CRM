"""Tests for Cin7 event dispatcher — PO and invoice event mappings.

Covers the bug fix for missing purchase_order and invoice event type
constants, builder functions, and dispatch routing in event_dispatcher.py,
and the corresponding webhook event map entries in cin7_webhooks.py.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.integrations.cin7.event_dispatcher import (
    ALL_CIN7_EVENTS,
    CIN7_EVENT_INVOICE_CHANGED,
    CIN7_EVENT_PURCHASE_ORDER_CHANGED,
    Cin7EventDispatcher,
    build_invoice_event,
    build_purchase_order_event,
)
from src.api.routes.integrations.cin7_webhooks import (
    CIN7_WEBHOOK_EVENT_MAP,
    route_webhook_event,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestEventConstants:
    """ALL_CIN7_EVENTS must include PO and invoice types."""

    def test_purchase_order_constant_value(self) -> None:
        assert CIN7_EVENT_PURCHASE_ORDER_CHANGED == "cin7.purchase_order.changed"

    def test_invoice_constant_value(self) -> None:
        assert CIN7_EVENT_INVOICE_CHANGED == "cin7.invoice.changed"

    def test_all_events_includes_purchase_order(self) -> None:
        assert CIN7_EVENT_PURCHASE_ORDER_CHANGED in ALL_CIN7_EVENTS

    def test_all_events_includes_invoice(self) -> None:
        assert CIN7_EVENT_INVOICE_CHANGED in ALL_CIN7_EVENTS


# ---------------------------------------------------------------------------
# Builder functions
# ---------------------------------------------------------------------------


class TestBuildPurchaseOrderEvent:
    """build_purchase_order_event() returns correct shape."""

    def test_happy_path_full_payload(self) -> None:
        po_data: dict[str, Any] = {
            "entity_id": "PO-001",
            "reference": "REF-001",
            "status": "Ordered",
            "supplier": "Acme Corp",
        }
        event = build_purchase_order_event(po_data, source="core", action="created")

        assert event["event_type"] == CIN7_EVENT_PURCHASE_ORDER_CHANGED
        assert event["entity_type"] == "purchase_order"
        assert event["entity_id"] == "PO-001"
        assert event["reference"] == "REF-001"
        assert event["status"] == "Ordered"
        assert event["supplier"] == "Acme Corp"
        assert event["action"] == "created"
        assert event["source"] == "core"
        assert "timestamp" in event

    def test_happy_path_default_action_is_updated(self) -> None:
        event = build_purchase_order_event({}, source="omni")
        assert event["action"] == "updated"

    def test_edge_case_missing_optional_fields(self) -> None:
        """Should not raise when optional fields are absent."""
        event = build_purchase_order_event({}, source="core")
        assert event["entity_id"] == "unknown"
        assert event["reference"] == ""
        assert event["status"] == ""
        assert event["supplier"] == ""

    def test_omni_source(self) -> None:
        event = build_purchase_order_event({"entity_id": "PO-002"}, source="omni")
        assert event["source"] == "omni"


class TestBuildInvoiceEvent:
    """build_invoice_event() returns correct shape."""

    def test_happy_path_full_payload(self) -> None:
        invoice_data: dict[str, Any] = {
            "entity_id": "INV-001",
            "reference": "INV-2024-001",
            "status": "Paid",
            "total": 1500.00,
        }
        event = build_invoice_event(invoice_data, source="omni", action="paid")

        assert event["event_type"] == CIN7_EVENT_INVOICE_CHANGED
        assert event["entity_type"] == "invoice"
        assert event["entity_id"] == "INV-001"
        assert event["reference"] == "INV-2024-001"
        assert event["status"] == "Paid"
        assert event["total"] == 1500.00
        assert event["action"] == "paid"
        assert event["source"] == "omni"
        assert "timestamp" in event

    def test_happy_path_default_action_is_updated(self) -> None:
        event = build_invoice_event({}, source="core")
        assert event["action"] == "updated"

    def test_edge_case_missing_optional_fields(self) -> None:
        """Should not raise when optional fields are absent."""
        event = build_invoice_event({}, source="core")
        assert event["entity_id"] == "unknown"
        assert event["reference"] == ""
        assert event["status"] == ""
        assert event["total"] == 0

    def test_zero_total_is_valid(self) -> None:
        event = build_invoice_event({"total": 0}, source="core")
        assert event["total"] == 0


# ---------------------------------------------------------------------------
# Dispatcher routing
# ---------------------------------------------------------------------------


class TestCin7EventDispatcherRouting:
    """dispatch_change_events() routes PO and invoice entity types correctly."""

    @pytest.mark.asyncio
    async def test_dispatch_purchase_order_entity(self) -> None:
        sse_service = MagicMock()
        sse_service.publish = AsyncMock()
        dispatcher = Cin7EventDispatcher(sse_service=sse_service)

        events = [
            {
                "entity_type": "purchase_order",
                "entity_id": "PO-100",
                "reference": "REF-100",
                "source": "core",
                "action": "created",
            }
        ]
        count = await dispatcher.dispatch_change_events(events)

        assert count == 1
        sse_service.publish.assert_awaited_once()
        published_event = sse_service.publish.call_args[0][1]
        assert published_event["event_type"] == CIN7_EVENT_PURCHASE_ORDER_CHANGED
        assert published_event["entity_type"] == "purchase_order"

    @pytest.mark.asyncio
    async def test_dispatch_invoice_entity(self) -> None:
        sse_service = MagicMock()
        sse_service.publish = AsyncMock()
        dispatcher = Cin7EventDispatcher(sse_service=sse_service)

        events = [
            {
                "entity_type": "invoice",
                "entity_id": "INV-200",
                "reference": "INV-2024-002",
                "total": 750.50,
                "source": "omni",
                "action": "paid",
            }
        ]
        count = await dispatcher.dispatch_change_events(events)

        assert count == 1
        sse_service.publish.assert_awaited_once()
        published_event = sse_service.publish.call_args[0][1]
        assert published_event["event_type"] == CIN7_EVENT_INVOICE_CHANGED
        assert published_event["entity_type"] == "invoice"

    @pytest.mark.asyncio
    async def test_dispatch_mixed_batch_counts_all(self) -> None:
        """A batch with PO, invoice, and product events all dispatch."""
        sse_service = MagicMock()
        sse_service.publish = AsyncMock()
        dispatcher = Cin7EventDispatcher(sse_service=sse_service)

        events = [
            {"entity_type": "product", "entity_id": "P1", "source": "core"},
            {"entity_type": "purchase_order", "entity_id": "PO1", "source": "core"},
            {"entity_type": "invoice", "entity_id": "INV1", "source": "omni"},
        ]
        count = await dispatcher.dispatch_change_events(events)

        assert count == 3
        assert sse_service.publish.await_count == 3

    @pytest.mark.asyncio
    async def test_dispatch_unknown_entity_falls_through_without_crash(self) -> None:
        """Unknown entity types pass through as-is without crashing."""
        sse_service = MagicMock()
        sse_service.publish = AsyncMock()
        dispatcher = Cin7EventDispatcher(sse_service=sse_service)

        events = [{"entity_type": "shipment", "entity_id": "SHP-1", "source": "core"}]
        count = await dispatcher.dispatch_change_events(events)

        assert count == 1
        sse_service.publish.assert_awaited_once()


# ---------------------------------------------------------------------------
# Webhook event map
# ---------------------------------------------------------------------------


class TestCin7WebhookEventMap:
    """CIN7_WEBHOOK_EVENT_MAP must include all PO and invoice event types."""

    @pytest.mark.parametrize(
        "webhook_type,expected_internal",
        [
            ("purchase_order.created", CIN7_EVENT_PURCHASE_ORDER_CHANGED),
            ("purchase_order.updated", CIN7_EVENT_PURCHASE_ORDER_CHANGED),
            ("purchase_order.received", CIN7_EVENT_PURCHASE_ORDER_CHANGED),
            ("invoice.created", CIN7_EVENT_INVOICE_CHANGED),
            ("invoice.updated", CIN7_EVENT_INVOICE_CHANGED),
            ("invoice.paid", CIN7_EVENT_INVOICE_CHANGED),
        ],
    )
    def test_po_and_invoice_types_are_mapped(
        self, webhook_type: str, expected_internal: str
    ) -> None:
        assert CIN7_WEBHOOK_EVENT_MAP.get(webhook_type) == expected_internal

    @pytest.mark.parametrize(
        "webhook_type,expected_internal",
        [
            ("purchase_order.created", CIN7_EVENT_PURCHASE_ORDER_CHANGED),
            ("purchase_order.updated", CIN7_EVENT_PURCHASE_ORDER_CHANGED),
            ("purchase_order.received", CIN7_EVENT_PURCHASE_ORDER_CHANGED),
            ("invoice.created", CIN7_EVENT_INVOICE_CHANGED),
            ("invoice.updated", CIN7_EVENT_INVOICE_CHANGED),
            ("invoice.paid", CIN7_EVENT_INVOICE_CHANGED),
        ],
    )
    def test_route_webhook_event_returns_correct_internal(
        self, webhook_type: str, expected_internal: str
    ) -> None:
        assert route_webhook_event(webhook_type) == expected_internal

    def test_unknown_webhook_type_returns_none(self) -> None:
        assert route_webhook_event("shipment.dispatched") is None

    def test_all_registered_types_return_non_null(self) -> None:
        for event_type in CIN7_WEBHOOK_EVENT_MAP:
            assert route_webhook_event(event_type) is not None, (
                f"route_webhook_event('{event_type}') returned None"
            )
