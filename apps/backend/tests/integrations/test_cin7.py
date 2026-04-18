"""Tests for Cin7 event dispatcher.

Covers:
- purchase_order.received events dispatched correctly
- invoice.created events dispatched correctly
- Unknown event types are logged and ignored (no exception raised)
- Builder functions produce the expected event shapes
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.integrations.cin7.event_dispatcher import (
    CIN7_EVENT_INVOICE_CREATED,
    CIN7_EVENT_PURCHASE_ORDER_RECEIVED,
    CIN7_SSE_CHANNEL,
    Cin7EventDispatcher,
    build_invoice_event,
    build_purchase_order_event,
)


# ---------------------------------------------------------------------------
# Builder function tests (pure / synchronous)
# ---------------------------------------------------------------------------


class TestBuildPurchaseOrderEvent:
    """Tests for build_purchase_order_event."""

    def test_event_type_is_purchase_order_received(self):
        result = build_purchase_order_event({}, source="core")
        assert result["event_type"] == CIN7_EVENT_PURCHASE_ORDER_RECEIVED

    def test_entity_type_is_purchase_order(self):
        result = build_purchase_order_event({}, source="core")
        assert result["entity_type"] == "purchase_order"

    def test_fields_extracted_from_data(self):
        data = {
            "entity_id": "po-999",
            "po_number": "PO-001",
            "supplier": "Acme Supplies",
            "stock_location": "Main Warehouse",
        }
        result = build_purchase_order_event(data, source="omni", action="received")
        assert result["entity_id"] == "po-999"
        assert result["po_number"] == "PO-001"
        assert result["supplier"] == "Acme Supplies"
        assert result["stock_location"] == "Main Warehouse"
        assert result["action"] == "received"
        assert result["source"] == "omni"

    def test_defaults_when_data_empty(self):
        result = build_purchase_order_event({}, source="core")
        assert result["entity_id"] == "unknown"
        assert result["po_number"] == ""
        assert result["supplier"] == ""
        assert result["stock_location"] == ""
        assert result["action"] == "received"

    def test_timestamp_is_present(self):
        result = build_purchase_order_event({}, source="core")
        assert "timestamp" in result
        assert result["timestamp"]


class TestBuildInvoiceEvent:
    """Tests for build_invoice_event."""

    def test_event_type_is_invoice_created(self):
        result = build_invoice_event({}, source="core")
        assert result["event_type"] == CIN7_EVENT_INVOICE_CREATED

    def test_entity_type_is_invoice(self):
        result = build_invoice_event({}, source="core")
        assert result["entity_type"] == "invoice"

    def test_fields_extracted_from_data(self):
        data = {
            "entity_id": "inv-42",
            "invoice_number": "SI-0042",
            "supplier": "Parts R Us",
            "total": 1250.00,
        }
        result = build_invoice_event(data, source="core", action="created")
        assert result["entity_id"] == "inv-42"
        assert result["invoice_number"] == "SI-0042"
        assert result["supplier"] == "Parts R Us"
        assert result["total"] == 1250.00
        assert result["action"] == "created"
        assert result["source"] == "core"

    def test_defaults_when_data_empty(self):
        result = build_invoice_event({}, source="omni")
        assert result["entity_id"] == "unknown"
        assert result["invoice_number"] == ""
        assert result["supplier"] == ""
        assert result["total"] == 0

    def test_timestamp_is_present(self):
        result = build_invoice_event({}, source="omni")
        assert "timestamp" in result
        assert result["timestamp"]


# ---------------------------------------------------------------------------
# Dispatcher integration tests
# ---------------------------------------------------------------------------


class TestCin7EventDispatcherPurchaseOrder:
    """Tests for purchase_order events flowing through dispatch_change_events."""

    @pytest.fixture
    def dispatcher(self):
        sse = MagicMock()
        sse.publish = AsyncMock()
        return Cin7EventDispatcher(sse_service=sse)

    @pytest.mark.asyncio
    async def test_purchase_order_event_dispatched(self, dispatcher):
        """purchase_order entity type publishes a purchase_order.received event."""
        events = [
            {
                "entity_type": "purchase_order",
                "entity_id": "po-1",
                "po_number": "PO-001",
                "supplier": "Supplier A",
                "stock_location": "Warehouse 1",
                "source": "core",
            }
        ]
        count = await dispatcher.dispatch_change_events(events)
        assert count == 1
        dispatcher.sse_service.publish.assert_awaited_once()
        _, published_event = dispatcher.sse_service.publish.await_args.args
        assert published_event["event_type"] == CIN7_EVENT_PURCHASE_ORDER_RECEIVED
        assert published_event["entity_type"] == "purchase_order"
        assert published_event["po_number"] == "PO-001"
        assert published_event["source"] == "core"

    @pytest.mark.asyncio
    async def test_purchase_order_event_published_to_cin7_channel(self, dispatcher):
        """purchase_order event is published to the cin7-sync SSE channel."""
        events = [{"entity_type": "purchase_order", "source": "omni"}]
        await dispatcher.dispatch_change_events(events)
        channel_arg = dispatcher.sse_service.publish.await_args.args[0]
        assert channel_arg == CIN7_SSE_CHANNEL


class TestCin7EventDispatcherInvoice:
    """Tests for invoice events flowing through dispatch_change_events."""

    @pytest.fixture
    def dispatcher(self):
        sse = MagicMock()
        sse.publish = AsyncMock()
        return Cin7EventDispatcher(sse_service=sse)

    @pytest.mark.asyncio
    async def test_invoice_event_dispatched(self, dispatcher):
        """invoice entity type publishes an invoice.created event."""
        events = [
            {
                "entity_type": "invoice",
                "entity_id": "inv-7",
                "invoice_number": "SI-007",
                "supplier": "Supplier B",
                "total": 500.00,
                "source": "core",
            }
        ]
        count = await dispatcher.dispatch_change_events(events)
        assert count == 1
        dispatcher.sse_service.publish.assert_awaited_once()
        _, published_event = dispatcher.sse_service.publish.await_args.args
        assert published_event["event_type"] == CIN7_EVENT_INVOICE_CREATED
        assert published_event["entity_type"] == "invoice"
        assert published_event["invoice_number"] == "SI-007"
        assert published_event["total"] == 500.00
        assert published_event["source"] == "core"

    @pytest.mark.asyncio
    async def test_invoice_event_published_to_cin7_channel(self, dispatcher):
        """invoice event is published to the cin7-sync SSE channel."""
        events = [{"entity_type": "invoice", "source": "core"}]
        await dispatcher.dispatch_change_events(events)
        channel_arg = dispatcher.sse_service.publish.await_args.args[0]
        assert channel_arg == CIN7_SSE_CHANNEL


class TestCin7EventDispatcherUnknownEvent:
    """Tests that unknown event types are logged and ignored."""

    @pytest.fixture
    def dispatcher(self):
        sse = MagicMock()
        sse.publish = AsyncMock()
        return Cin7EventDispatcher(sse_service=sse)

    @pytest.mark.asyncio
    async def test_unknown_event_does_not_raise(self, dispatcher):
        """An unknown entity_type must not raise an exception."""
        events = [{"entity_type": "widget", "entity_id": "w-1", "source": "core"}]
        # Should complete without raising
        count = await dispatcher.dispatch_change_events(events)
        assert count == 1

    @pytest.mark.asyncio
    async def test_unknown_event_is_not_published(self, dispatcher):
        """An unknown entity_type must not be published to the SSE channel."""
        events = [{"entity_type": "widget", "source": "core"}]
        await dispatcher.dispatch_change_events(events)
        dispatcher.sse_service.publish.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unknown_event_is_logged(self, dispatcher):
        """An unknown entity_type must emit a structlog warning."""
        events = [{"entity_type": "mystery_type", "source": "core"}]
        with patch(
            "src.integrations.cin7.event_dispatcher.logger"
        ) as mock_logger:
            await dispatcher.dispatch_change_events(events)
            mock_logger.warning.assert_called_once()
            call_kwargs = mock_logger.warning.call_args
            # First positional arg is the log key
            assert call_kwargs.args[0] == "cin7_unknown_event_type"
            assert call_kwargs.kwargs.get("entity_type") == "mystery_type"

    @pytest.mark.asyncio
    async def test_mixed_events_skips_unknown_publishes_known(self, dispatcher):
        """Known events are published; unknown events are skipped in same batch."""
        events = [
            {"entity_type": "purchase_order", "source": "core"},
            {"entity_type": "unknown_entity", "source": "core"},
            {"entity_type": "invoice", "source": "core"},
        ]
        await dispatcher.dispatch_change_events(events)
        # Only the two known events should have been published
        assert dispatcher.sse_service.publish.await_count == 2
