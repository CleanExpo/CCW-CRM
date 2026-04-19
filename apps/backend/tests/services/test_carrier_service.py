"""
Unit tests for carrier_service.py — UNI-1822.

Covers:
- All five adapter classes (AusPost, StarTrack, EasyPost, TNT, FedEx)
- CarrierService routing, sandbox registration, and prefix auto-detection
- Rate aggregation across all carriers

Run:
    cd apps/backend && uv run pytest tests/services/test_carrier_service.py -k adapter -v
"""

from decimal import Decimal

import pytest

from src.services.carrier_service import (
    Address,
    AustraliaPostAdapter,
    CarrierService,
    EasyPostAdapter,
    FedExAdapter,
    ShipmentRequest,
    StarTrackAdapter,
    TNTAdapter,
    get_carrier_service,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def from_addr() -> Address:
    return Address(
        name="CCW Warehouse",
        street1="100 Eagle Street",
        city="Brisbane",
        state="QLD",
        postal_code="4000",
        country="AU",
    )


@pytest.fixture
def to_addr() -> Address:
    return Address(
        name="Customer",
        street1="1 Martin Place",
        city="Sydney",
        state="NSW",
        postal_code="2000",
        country="AU",
    )


@pytest.fixture
def shipment_request(from_addr: Address, to_addr: Address) -> ShipmentRequest:
    return ShipmentRequest(
        from_address=from_addr,
        to_address=to_addr,
        weight_kg=Decimal("2.5"),
        service_type="standard",
        reference="ORD-2026-001",
    )


@pytest.fixture
def express_request(from_addr: Address, to_addr: Address) -> ShipmentRequest:
    return ShipmentRequest(
        from_address=from_addr,
        to_address=to_addr,
        weight_kg=Decimal("1.0"),
        service_type="express",
        reference="ORD-2026-002",
    )


# ---------------------------------------------------------------------------
# AustraliaPostAdapter tests
# ---------------------------------------------------------------------------

class TestAustraliaPostAdapter:
    adapter = AustraliaPostAdapter("mock_key")

    def test_adapter_carrier_name(self):
        assert self.adapter.carrier_name == "Australia Post"

    @pytest.mark.asyncio
    async def test_adapter_create_shipment_returns_tracking_number(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.tracking_number.startswith("AP")
        assert resp.carrier_name == "Australia Post"

    @pytest.mark.asyncio
    async def test_adapter_create_shipment_express_cost(self, express_request):
        resp = await self.adapter.create_shipment(express_request)
        assert resp.cost == Decimal("25.00")

    @pytest.mark.asyncio
    async def test_adapter_create_shipment_standard_cost(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.cost == Decimal("15.50")

    @pytest.mark.asyncio
    async def test_adapter_track_shipment(self, shipment_request):
        status = await self.adapter.track_shipment("AP20260419001")
        assert status.status == "in_transit"
        assert isinstance(status.events, list)

    @pytest.mark.asyncio
    async def test_adapter_cancel_shipment(self):
        result = await self.adapter.cancel_shipment("AP20260419001")
        assert result is True

    @pytest.mark.asyncio
    async def test_adapter_get_rates(self, shipment_request):
        rates = await self.adapter.get_rates(shipment_request)
        assert len(rates) >= 2
        services = [r["service"] for r in rates]
        assert any("Express" in s for s in services)


# ---------------------------------------------------------------------------
# StarTrackAdapter tests
# ---------------------------------------------------------------------------

class TestStarTrackAdapter:
    adapter = StarTrackAdapter("mock_key")

    def test_adapter_carrier_name(self):
        assert self.adapter.carrier_name == "StarTrack"

    @pytest.mark.asyncio
    async def test_adapter_create_shipment_returns_tracking_number(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.tracking_number.startswith("ST")
        assert resp.carrier_name == "StarTrack"

    @pytest.mark.asyncio
    async def test_adapter_track_shipment(self):
        status = await self.adapter.track_shipment("ST20260419001")
        assert status.status in ("in_transit", "pending", "delivered")

    @pytest.mark.asyncio
    async def test_adapter_cancel_shipment(self):
        result = await self.adapter.cancel_shipment("ST20260419001")
        assert result is True

    @pytest.mark.asyncio
    async def test_adapter_get_rates(self, shipment_request):
        rates = await self.adapter.get_rates(shipment_request)
        assert len(rates) >= 1
        assert all("cost" in r for r in rates)


# ---------------------------------------------------------------------------
# TNTAdapter tests
# ---------------------------------------------------------------------------

class TestTNTAdapter:
    adapter = TNTAdapter(sandbox=True)

    def test_adapter_carrier_name(self):
        assert self.adapter.carrier_name == "TNT"

    def test_adapter_sandbox_flag(self):
        assert self.adapter.sandbox is True
        assert "sandbox" in self.adapter.base_url

    @pytest.mark.asyncio
    async def test_adapter_create_shipment_returns_tracking_number(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.tracking_number.startswith("TN")
        assert resp.carrier_name == "TNT"

    @pytest.mark.asyncio
    async def test_adapter_create_express_cost(self, express_request):
        resp = await self.adapter.create_shipment(express_request)
        assert resp.cost == Decimal("35.00")

    @pytest.mark.asyncio
    async def test_adapter_create_standard_cost(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.cost == Decimal("22.00")

    @pytest.mark.asyncio
    async def test_adapter_track_shipment(self):
        status = await self.adapter.track_shipment("TN20260419001")
        assert status.status == "in_transit"
        assert len(status.events) >= 1

    @pytest.mark.asyncio
    async def test_adapter_cancel_shipment(self):
        result = await self.adapter.cancel_shipment("TN20260419001")
        assert result is True

    @pytest.mark.asyncio
    async def test_adapter_get_rates_returns_two_services(self, shipment_request):
        rates = await self.adapter.get_rates(shipment_request)
        assert len(rates) == 2
        assert all(r["carrier"] == "TNT" for r in rates)

    @pytest.mark.asyncio
    async def test_adapter_get_rates_have_delivery_days(self, shipment_request):
        rates = await self.adapter.get_rates(shipment_request)
        assert all("delivery_days" in r for r in rates)


# ---------------------------------------------------------------------------
# FedExAdapter tests
# ---------------------------------------------------------------------------

class TestFedExAdapter:
    adapter = FedExAdapter(sandbox=True)

    def test_adapter_carrier_name(self):
        assert self.adapter.carrier_name == "FedEx"

    def test_adapter_sandbox_flag(self):
        assert self.adapter.sandbox is True
        assert "sandbox" in self.adapter.base_url

    @pytest.mark.asyncio
    async def test_adapter_create_shipment_returns_tracking_number(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.tracking_number.startswith("FX")
        assert resp.carrier_name == "FedEx"

    @pytest.mark.asyncio
    async def test_adapter_create_express_cost(self, express_request):
        resp = await self.adapter.create_shipment(express_request)
        assert resp.cost == Decimal("42.00")

    @pytest.mark.asyncio
    async def test_adapter_create_standard_cost(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.cost == Decimal("28.00")

    @pytest.mark.asyncio
    async def test_adapter_track_shipment(self):
        status = await self.adapter.track_shipment("FX20260419001")
        assert status.status == "in_transit"
        assert len(status.events) >= 1

    @pytest.mark.asyncio
    async def test_adapter_cancel_shipment(self):
        result = await self.adapter.cancel_shipment("FX20260419001")
        assert result is True

    @pytest.mark.asyncio
    async def test_adapter_get_rates_returns_two_services(self, shipment_request):
        rates = await self.adapter.get_rates(shipment_request)
        assert len(rates) == 2
        assert all(r["carrier"] == "FedEx" for r in rates)


# ---------------------------------------------------------------------------
# EasyPostAdapter tests
# ---------------------------------------------------------------------------

class TestEasyPostAdapter:
    adapter = EasyPostAdapter("mock_key")

    def test_adapter_carrier_name(self):
        assert "EasyPost" in self.adapter.carrier_name or "Multi" in self.adapter.carrier_name

    @pytest.mark.asyncio
    async def test_adapter_create_shipment(self, shipment_request):
        resp = await self.adapter.create_shipment(shipment_request)
        assert resp.tracking_number.startswith("EP")

    @pytest.mark.asyncio
    async def test_adapter_track_shipment(self):
        status = await self.adapter.track_shipment("EP20260419001")
        assert status.status in ("in_transit", "pending", "delivered")

    @pytest.mark.asyncio
    async def test_adapter_get_rates(self, shipment_request):
        rates = await self.adapter.get_rates(shipment_request)
        assert len(rates) >= 1


# ---------------------------------------------------------------------------
# CarrierService routing tests
# ---------------------------------------------------------------------------

class TestCarrierServiceRouting:
    """
    These tests verify CarrierService routing logic without touching real APIs.
    TNT and FedEx are always available in sandbox mode.
    """

    def test_tnt_always_registered(self):
        svc = CarrierService()
        assert "tnt" in svc.list_available_carriers()

    def test_fedex_always_registered(self):
        svc = CarrierService()
        assert "fedex" in svc.list_available_carriers()

    def test_auspost_registered_as_fallback(self):
        svc = CarrierService()
        assert "australia_post" in svc.list_available_carriers()

    def test_get_adapter_by_name_tnt(self):
        svc = CarrierService()
        adapter = svc.get_adapter("tnt")
        assert adapter.carrier_name == "TNT"

    def test_get_adapter_by_name_fedex(self):
        svc = CarrierService()
        adapter = svc.get_adapter("fedex")
        assert adapter.carrier_name == "FedEx"

    def test_get_adapter_unknown_raises(self):
        svc = CarrierService()
        with pytest.raises(ValueError, match="not configured"):
            svc.get_adapter("unknown_carrier_xyz")

    def test_get_adapter_default_returns_first(self):
        svc = CarrierService()
        adapter = svc.get_adapter()
        assert adapter is not None
        assert hasattr(adapter, "carrier_name")

    @pytest.mark.asyncio
    async def test_track_shipment_auto_detects_tnt_prefix(self, from_addr, to_addr):
        svc = CarrierService()
        status = await svc.track_shipment("TN20260419001")
        assert status.status in ("in_transit", "pending", "delivered")

    @pytest.mark.asyncio
    async def test_track_shipment_auto_detects_fedex_prefix(self, from_addr, to_addr):
        svc = CarrierService()
        status = await svc.track_shipment("FX20260419001")
        assert status.status in ("in_transit", "pending", "delivered")

    @pytest.mark.asyncio
    async def test_get_rates_all_carriers_returns_multiple(self, from_addr, to_addr):
        svc = CarrierService()
        rates = await svc.get_rates(
            from_address=from_addr,
            to_address=to_addr,
            weight_kg=Decimal("5.0"),
        )
        # At least 4 rates: 2 TNT + 2 FedEx
        assert len(rates) >= 4

    @pytest.mark.asyncio
    async def test_get_rates_single_carrier_tnt(self, from_addr, to_addr):
        svc = CarrierService()
        rates = await svc.get_rates(
            from_address=from_addr,
            to_address=to_addr,
            weight_kg=Decimal("5.0"),
            carrier_name="tnt",
        )
        assert all(r.get("carrier") == "TNT" for r in rates)

    @pytest.mark.asyncio
    async def test_get_rates_single_carrier_fedex(self, from_addr, to_addr):
        svc = CarrierService()
        rates = await svc.get_rates(
            from_address=from_addr,
            to_address=to_addr,
            weight_kg=Decimal("5.0"),
            carrier_name="fedex",
        )
        assert all(r.get("carrier") == "FedEx" for r in rates)

    @pytest.mark.asyncio
    async def test_create_shipment_routes_to_tnt(self, from_addr, to_addr):
        svc = CarrierService()
        resp = await svc.create_shipment(
            from_address=from_addr,
            to_address=to_addr,
            weight_kg=Decimal("3.0"),
            carrier_name="tnt",
        )
        assert resp.tracking_number.startswith("TN")
        assert resp.carrier_name == "TNT"

    @pytest.mark.asyncio
    async def test_create_shipment_routes_to_fedex(self, from_addr, to_addr):
        svc = CarrierService()
        resp = await svc.create_shipment(
            from_address=from_addr,
            to_address=to_addr,
            weight_kg=Decimal("3.0"),
            carrier_name="fedex",
        )
        assert resp.tracking_number.startswith("FX")
        assert resp.carrier_name == "FedEx"


# ---------------------------------------------------------------------------
# Singleton tests
# ---------------------------------------------------------------------------

def test_get_carrier_service_returns_singleton():
    svc1 = get_carrier_service()
    svc2 = get_carrier_service()
    assert svc1 is svc2


def test_get_carrier_service_has_tnt_and_fedex():
    svc = get_carrier_service()
    carriers = svc.list_available_carriers()
    assert "tnt" in carriers
    assert "fedex" in carriers
