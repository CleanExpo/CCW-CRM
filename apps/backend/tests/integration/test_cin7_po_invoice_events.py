"""Tests for UNI-1830: Cin7 PO and invoice events in polling handler.

Covers:
- detect_purchase_order_changes() pure function
- Cin7EventDispatcher.dispatch_change_events() for purchase_order / invoice
- Cin7ChangeDetector.poll_purchase_orders() including Omni skip path
- ENTITY_TYPES / _CONNECTION_ATTR completeness
- build_purchase_order_event() / build_invoice_event() event builders
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.integrations.cin7.change_detector import (
    Cin7ChangeDetector,
    _BILLED_STATUSES,
    detect_purchase_order_changes,
    format_modified_since,
)
from src.integrations.cin7.event_dispatcher import (
    ALL_CIN7_EVENTS,
    CIN7_EVENT_INVOICE_CHANGED,
    CIN7_EVENT_PO_CHANGED,
    Cin7EventDispatcher,
    build_invoice_event,
    build_purchase_order_event,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_core_po(
    po_id: str = "PO-001",
    order_number: str = "ORD-9001",
    status: str = "Draft",
) -> dict:
    return {"PurchaseOrderID": po_id, "OrderNumber": order_number, "Status": status}


# ---------------------------------------------------------------------------
# Event builder tests
# ---------------------------------------------------------------------------


class TestBuildPurchaseOrderEvent:
    def test_event_type(self):
        event = build_purchase_order_event(
            {"entity_id": "123", "reference": "PO-1", "status": "Draft"},
            source="core",
        )
        assert event["event_type"] == CIN7_EVENT_PO_CHANGED

    def test_entity_type(self):
        event = build_purchase_order_event({}, source="core")
        assert event["entity_type"] == "purchase_order"

    def test_fields_populated(self):
        event = build_purchase_order_event(
            {"entity_id": "42", "reference": "PO-99", "status": "Billed"},
            source="core",
            action="invoiced",
        )
        assert event["entity_id"] == "42"
        assert event["reference"] == "PO-99"
        assert event["status"] == "Billed"
        assert event["action"] == "invoiced"
        assert event["source"] == "core"

    def test_timestamp_is_iso(self):
        event = build_purchase_order_event({}, source="core")
        # Should parse without raising
        datetime.fromisoformat(event["timestamp"])

    def test_unknown_defaults(self):
        event = build_purchase_order_event({}, source="omni")
        assert event["entity_id"] == "unknown"
        assert event["reference"] == ""
        assert event["status"] == ""


class TestBuildInvoiceEvent:
    def test_event_type(self):
        event = build_invoice_event({}, source="core")
        assert event["event_type"] == CIN7_EVENT_INVOICE_CHANGED

    def test_entity_type(self):
        event = build_invoice_event({}, source="core")
        assert event["entity_type"] == "invoice"

    def test_default_action(self):
        event = build_invoice_event({}, source="core")
        assert event["action"] == "invoiced"

    def test_partly_invoiced_action(self):
        event = build_invoice_event({}, source="core", action="partly_invoiced")
        assert event["action"] == "partly_invoiced"


class TestAllCin7Events:
    def test_po_in_all_events(self):
        assert CIN7_EVENT_PO_CHANGED in ALL_CIN7_EVENTS

    def test_invoice_in_all_events(self):
        assert CIN7_EVENT_INVOICE_CHANGED in ALL_CIN7_EVENTS


# ---------------------------------------------------------------------------
# detect_purchase_order_changes() pure function
# ---------------------------------------------------------------------------


class TestDetectPurchaseOrderChanges:
    def test_returns_po_event_for_draft_po(self):
        pos = [_make_core_po(status="Draft")]
        events = detect_purchase_order_changes(pos, source="core")
        assert len(events) == 1
        ev = events[0]
        assert ev["entity_type"] == "purchase_order"
        assert ev["action"] == "updated"
        assert ev["entity_id"] == "PO-001"

    def test_billed_emits_both_po_and_invoice_events(self):
        pos = [_make_core_po(status="Billed")]
        events = detect_purchase_order_changes(pos, source="core")
        assert len(events) == 2
        types = {e["entity_type"] for e in events}
        assert types == {"purchase_order", "invoice"}

    def test_partly_billed_emits_both_events(self):
        pos = [_make_core_po(status="PartlyBilled")]
        events = detect_purchase_order_changes(pos, source="core")
        assert len(events) == 2
        invoice_ev = next(e for e in events if e["entity_type"] == "invoice")
        assert invoice_ev["action"] == "partly_invoiced"

    def test_received_action(self):
        pos = [_make_core_po(status="Received")]
        events = detect_purchase_order_changes(pos, source="core")
        assert events[0]["action"] == "received"
        # No invoice event for received
        assert all(e["entity_type"] == "purchase_order" for e in events)

    def test_billed_po_action_is_invoiced(self):
        pos = [_make_core_po(status="Billed")]
        events = detect_purchase_order_changes(pos, source="core")
        po_ev = next(e for e in events if e["entity_type"] == "purchase_order")
        assert po_ev["action"] == "invoiced"

    def test_empty_list_returns_empty(self):
        assert detect_purchase_order_changes([], source="core") == []

    def test_multiple_pos_mixed_statuses(self):
        pos = [
            _make_core_po("A", status="Draft"),
            _make_core_po("B", status="Billed"),
            _make_core_po("C", status="PartlyBilled"),
        ]
        events = detect_purchase_order_changes(pos, source="core")
        # A → 1, B → 2, C → 2 = 5
        assert len(events) == 5

    def test_entity_id_from_id_fallback(self):
        po = {"ID": "fallback-id", "Status": "Draft"}
        events = detect_purchase_order_changes([po], source="core")
        assert events[0]["entity_id"] == "fallback-id"

    def test_omni_po_fields(self):
        po = {"id": 77, "reference": "REF-77", "status": "Billed"}
        events = detect_purchase_order_changes([po], source="omni")
        assert len(events) == 2
        po_ev = next(e for e in events if e["entity_type"] == "purchase_order")
        assert po_ev["entity_id"] == "77"
        assert po_ev["reference"] == "REF-77"

    def test_data_field_preserved(self):
        raw = {"PurchaseOrderID": "X", "Status": "Draft", "extra": "value"}
        events = detect_purchase_order_changes([raw], source="core")
        assert events[0]["data"] == raw

    def test_billed_statuses_constant(self):
        assert "Billed" in _BILLED_STATUSES
        assert "PartlyBilled" in _BILLED_STATUSES


# ---------------------------------------------------------------------------
# Cin7EventDispatcher — dispatch_change_events()
# ---------------------------------------------------------------------------


class TestDispatcherPOAndInvoiceRouting:
    @pytest.fixture()
    def mock_sse(self):
        svc = MagicMock()
        svc.publish = AsyncMock()
        return svc

    @pytest.fixture()
    def dispatcher(self, mock_sse):
        return Cin7EventDispatcher(sse_service=mock_sse)

    @pytest.mark.asyncio
    async def test_purchase_order_entity_dispatched(self, dispatcher, mock_sse):
        events = [
            {
                "entity_type": "purchase_order",
                "entity_id": "PO-1",
                "reference": "ORD-1",
                "status": "Draft",
                "action": "updated",
                "source": "core",
            }
        ]
        count = await dispatcher.dispatch_change_events(events)
        assert count == 1
        published = mock_sse.publish.call_args[0][1]
        assert published["event_type"] == CIN7_EVENT_PO_CHANGED

    @pytest.mark.asyncio
    async def test_invoice_entity_dispatched(self, dispatcher, mock_sse):
        events = [
            {
                "entity_type": "invoice",
                "entity_id": "PO-1",
                "reference": "ORD-1",
                "status": "Billed",
                "action": "invoiced",
                "source": "core",
            }
        ]
        count = await dispatcher.dispatch_change_events(events)
        assert count == 1
        published = mock_sse.publish.call_args[0][1]
        assert published["event_type"] == CIN7_EVENT_INVOICE_CHANGED

    @pytest.mark.asyncio
    async def test_mixed_batch_dispatches_all(self, dispatcher, mock_sse):
        events = [
            {"entity_type": "purchase_order", "entity_id": "A", "action": "updated", "source": "core"},
            {"entity_type": "invoice", "entity_id": "A", "action": "invoiced", "source": "core"},
            {"entity_type": "product", "entity_id": "P1", "action": "updated", "source": "core", "name": "Foo"},
        ]
        count = await dispatcher.dispatch_change_events(events)
        assert count == 3
        assert mock_sse.publish.call_count == 3

    @pytest.mark.asyncio
    async def test_unknown_entity_passthrough(self, dispatcher, mock_sse):
        raw = {"entity_type": "unknown_future_type", "data": "xyz"}
        await dispatcher.dispatch_change_events([raw])
        published = mock_sse.publish.call_args[0][1]
        assert published == raw


# ---------------------------------------------------------------------------
# Cin7ChangeDetector — poll_purchase_orders()
# ---------------------------------------------------------------------------


class TestPollPurchaseOrders:
    def _make_detector(self, purchase_orders: list[dict]) -> tuple[Cin7ChangeDetector, MagicMock]:
        mock_settings = MagicMock()
        mock_settings.sync_purchase_orders = True
        mock_settings.sync_products = False
        mock_settings.sync_customers = False
        mock_settings.sync_sales = False
        mock_settings.sync_inventory = False

        mock_client = MagicMock()
        mock_client.core = MagicMock()
        mock_client.core.get_purchase_list = AsyncMock(
            return_value={"PurchaseOrderList": purchase_orders}
        )

        detector = Cin7ChangeDetector(client=mock_client, settings=mock_settings)
        return detector, mock_client

    @pytest.mark.asyncio
    async def test_returns_events_for_changed_pos(self):
        pos = [_make_core_po("P1", status="Draft")]
        detector, _ = self._make_detector(pos)
        events = await detector.poll_purchase_orders(source="core")
        assert len(events) == 1
        assert events[0]["entity_type"] == "purchase_order"

    @pytest.mark.asyncio
    async def test_billed_po_emits_invoice_event_too(self):
        pos = [_make_core_po("P1", status="Billed")]
        detector, _ = self._make_detector(pos)
        events = await detector.poll_purchase_orders(source="core")
        assert len(events) == 2
        types = {e["entity_type"] for e in events}
        assert "invoice" in types

    @pytest.mark.asyncio
    async def test_watermark_updated_after_poll(self):
        detector, _ = self._make_detector([])
        assert detector.get_last_polled("purchase_orders") is None
        await detector.poll_purchase_orders(source="core")
        assert detector.get_last_polled("purchase_orders") is not None

    @pytest.mark.asyncio
    async def test_omni_source_skipped_returns_empty(self):
        detector, mock_client = self._make_detector([])
        events = await detector.poll_purchase_orders(source="omni")
        assert events == []
        mock_client.core.get_purchase_list.assert_not_called()

    @pytest.mark.asyncio
    async def test_modified_since_passed_when_watermark_set(self):
        detector, mock_client = self._make_detector([])
        # Seed a watermark
        seed_dt = datetime(2025, 11, 15, 8, 0, 0, tzinfo=UTC)
        detector._last_polled["purchase_orders"] = seed_dt
        await detector.poll_purchase_orders(source="core")
        call_kwargs = mock_client.core.get_purchase_list.call_args[1]
        assert call_kwargs["modified_since"] == format_modified_since(seed_dt)

    @pytest.mark.asyncio
    async def test_api_error_returns_empty_list(self):
        mock_settings = MagicMock()
        mock_settings.sync_purchase_orders = True
        mock_client = MagicMock()
        mock_client.core.get_purchase_list = AsyncMock(side_effect=Exception("API down"))
        detector = Cin7ChangeDetector(client=mock_client, settings=mock_settings)
        events = await detector.poll_purchase_orders(source="core")
        assert events == []

    @pytest.mark.asyncio
    async def test_poll_all_includes_purchase_orders(self):
        pos = [_make_core_po("P1", status="Draft")]
        detector, _ = self._make_detector(pos)
        results = await detector.poll_all(source="core")
        assert "purchase_orders" in results
        assert len(results["purchase_orders"]) == 1


# ---------------------------------------------------------------------------
# Cin7ChangeDetector — class-level completeness checks
# ---------------------------------------------------------------------------


class TestChangeDetectorEntityCompleteness:
    def test_purchase_orders_in_entity_types(self):
        assert "purchase_orders" in Cin7ChangeDetector.ENTITY_TYPES

    def test_purchase_orders_in_connection_attr_map(self):
        assert "purchase_orders" in Cin7ChangeDetector._CONNECTION_ATTR

    def test_connection_attr_maps_to_correct_column(self):
        assert (
            Cin7ChangeDetector._CONNECTION_ATTR["purchase_orders"]
            == "last_purchase_order_sync_at"
        )

    def test_seed_from_connection_loads_po_watermark(self):
        mock_conn = MagicMock()
        mock_conn.last_purchase_order_sync_at = datetime(2025, 1, 1, tzinfo=UTC)
        # Set other attrs to None to avoid leakage
        for attr in ["last_product_sync_at", "last_customer_sync_at",
                     "last_sales_sync_at", "last_inventory_sync_at"]:
            setattr(mock_conn, attr, None)

        detector = Cin7ChangeDetector(
            client=MagicMock(), settings=MagicMock()
        )
        detector.seed_from_connection(mock_conn)
        assert detector.get_last_polled("purchase_orders") == datetime(2025, 1, 1, tzinfo=UTC)

    def test_get_updated_watermarks_includes_po(self):
        detector = Cin7ChangeDetector(client=MagicMock(), settings=MagicMock())
        now = datetime.now(UTC)
        detector._last_polled["purchase_orders"] = now
        watermarks = detector.get_updated_watermarks()
        assert watermarks.get("purchase_orders") == now
