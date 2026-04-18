"""Tests for multi-carrier adapter abstraction (UNI-1822)."""
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

SAMPLE_FROM = Address(
    name="CCW Warehouse",
    street1="1 Industry Ave",
    city="Brisbane",
    state="QLD",
    postal_code="4000",
    country="AU",
)

SAMPLE_TO = Address(
    name="Test Customer",
    street1="42 Main St",
    city="Sydney",
    state="NSW",
    postal_code="2000",
    country="AU",
)

SAMPLE_REQUEST = ShipmentRequest(
    from_address=SAMPLE_FROM,
    to_address=SAMPLE_TO,
    weight_kg=Decimal("2.5"),
    service_type="express",
    reference="ORD-001",
)


# ---------------------------------------------------------------------------
# AustraliaPostAdapter tests
# ---------------------------------------------------------------------------


class TestAustraliaPostAdapter:
    """Tests for AustraliaPost adapter."""

    def setup_method(self):
        self.adapter = AustraliaPostAdapter(api_key="mock_key")

    def test_adapter_carrier_name(self):
        """Adapter reports correct carrier name."""
        assert self.adapter.carrier_name == "Australia Post"

    async def test_adapter_create_shipment_returns_tracking_number(self):
        """create_shipment returns a ShipmentResponse with AP-prefixed tracking number."""
        response = await self.adapter.create_shipment(SAMPLE_REQUEST)
        assert response.tracking_number.startswith("AP")
        assert response.carrier_name == "Australia Post"
        assert response.service_type == "express"
        assert response.label_url is not None

    async def test_adapter_create_shipment_express_cost(self):
        """Express service has higher cost than standard."""
        express_req = SAMPLE_REQUEST.model_copy(update={"service_type": "express"})
        standard_req = SAMPLE_REQUEST.model_copy(update={"service_type": "standard"})
        express = await self.adapter.create_shipment(express_req)
        standard = await self.adapter.create_shipment(standard_req)
        assert express.cost > standard.cost

    async def test_adapter_track_shipment(self):
        """track_shipment returns a TrackingStatus with events."""
        status = await self.adapter.track_shipment("AP20260417000001AU")
        assert status.status in {"pending", "in_transit", "out_for_delivery", "delivered", "exception"}
        assert isinstance(status.events, list)

    async def test_adapter_get_rates_returns_list(self):
        """get_rates returns a non-empty list of rate options."""
        rates = await self.adapter.get_rates(SAMPLE_REQUEST)
        assert len(rates) >= 1
        for rate in rates:
            assert "service" in rate
            assert "cost" in rate

    async def test_adapter_cancel_shipment(self):
        """cancel_shipment returns True."""
        result = await self.adapter.cancel_shipment("AP20260417000001AU")
        assert result is True


# ---------------------------------------------------------------------------
# TNTAdapter tests
# ---------------------------------------------------------------------------


class TestTNTAdapter:
    """Tests for TNT Express adapter."""

    def setup_method(self):
        self.adapter = TNTAdapter(api_key="mock_key")

    def test_adapter_carrier_name(self):
        """Adapter reports correct carrier name."""
        assert self.adapter.carrier_name == "TNT"

    async def test_adapter_create_shipment_returns_tracking_number(self):
        """create_shipment returns a ShipmentResponse with TN-prefixed tracking number."""
        response = await self.adapter.create_shipment(SAMPLE_REQUEST)
        assert response.tracking_number.startswith("TN")
        assert response.carrier_name == "TNT"
        assert response.label_url is not None

    async def test_adapter_create_shipment_cost_set(self):
        """create_shipment returns a positive cost."""
        response = await self.adapter.create_shipment(SAMPLE_REQUEST)
        assert response.cost is not None
        assert response.cost > Decimal("0")

    async def test_adapter_track_shipment(self):
        """track_shipment returns a valid TrackingStatus."""
        status = await self.adapter.track_shipment("TN20260417000001")
        assert status.status in {"pending", "in_transit", "out_for_delivery", "delivered", "exception"}
        assert isinstance(status.events, list)
        assert len(status.events) >= 1

    async def test_adapter_get_rates_returns_tnt_rates(self):
        """get_rates returns TNT-specific rates."""
        rates = await self.adapter.get_rates(SAMPLE_REQUEST)
        assert len(rates) >= 1
        carriers = {r.get("carrier") for r in rates}
        assert "TNT" in carriers

    async def test_adapter_cancel_shipment(self):
        """cancel_shipment returns True."""
        result = await self.adapter.cancel_shipment("TN20260417000001")
        assert result is True


# ---------------------------------------------------------------------------
# FedExAdapter tests
# ---------------------------------------------------------------------------


class TestFedExAdapter:
    """Tests for FedEx adapter."""

    def setup_method(self):
        self.adapter = FedExAdapter(api_key="mock_key")

    def test_adapter_carrier_name(self):
        """Adapter reports correct carrier name."""
        assert self.adapter.carrier_name == "FedEx"

    async def test_adapter_create_shipment_returns_tracking_number(self):
        """create_shipment returns a ShipmentResponse with FX-prefixed tracking number."""
        response = await self.adapter.create_shipment(SAMPLE_REQUEST)
        assert response.tracking_number.startswith("FX")
        assert response.carrier_name == "FedEx"
        assert response.label_url is not None

    async def test_adapter_create_shipment_cost_set(self):
        """create_shipment returns a positive cost."""
        response = await self.adapter.create_shipment(SAMPLE_REQUEST)
        assert response.cost is not None
        assert response.cost > Decimal("0")

    async def test_adapter_track_shipment(self):
        """track_shipment returns a valid TrackingStatus."""
        status = await self.adapter.track_shipment("FX20260417000001")
        assert status.status in {"pending", "in_transit", "out_for_delivery", "delivered", "exception"}
        assert isinstance(status.events, list)

    async def test_adapter_get_rates_returns_multiple_services(self):
        """get_rates returns multiple FedEx service tiers."""
        rates = await self.adapter.get_rates(SAMPLE_REQUEST)
        assert len(rates) >= 2
        carriers = {r.get("carrier") for r in rates}
        assert "FedEx" in carriers

    async def test_adapter_cancel_shipment(self):
        """cancel_shipment returns True."""
        result = await self.adapter.cancel_shipment("FX20260417000001")
        assert result is True


# ---------------------------------------------------------------------------
# CarrierService routing tests
# ---------------------------------------------------------------------------


class TestCarrierServiceAdapter:
    """Tests for CarrierService adapter selection and routing."""

    def setup_method(self):
        self.service = CarrierService()

    def test_adapter_list_available_carriers_includes_defaults(self):
        """Service initialises with at least australia_post, tnt, fedex in sandbox mode."""
        carriers = self.service.list_available_carriers()
        assert len(carriers) >= 1
        # In sandbox (no env keys) defaults are australia_post + tnt + fedex
        assert "australia_post" in carriers
        assert "tnt" in carriers
        assert "fedex" in carriers

    def test_adapter_get_adapter_by_name(self):
        """get_adapter returns the correct adapter for a known carrier key."""
        adapter = self.service.get_adapter("australia_post")
        assert adapter.carrier_name == "Australia Post"

    def test_adapter_get_adapter_tnt(self):
        """get_adapter returns TNTAdapter for 'tnt'."""
        adapter = self.service.get_adapter("tnt")
        assert adapter.carrier_name == "TNT"

    def test_adapter_get_adapter_fedex(self):
        """get_adapter returns FedExAdapter for 'fedex'."""
        adapter = self.service.get_adapter("fedex")
        assert adapter.carrier_name == "FedEx"

    def test_adapter_get_adapter_unknown_raises(self):
        """get_adapter raises ValueError for unconfigured carrier."""
        with pytest.raises(ValueError, match="not configured"):
            self.service.get_adapter("unknown_carrier_xyz")

    def test_adapter_get_default_adapter(self):
        """get_adapter with no argument returns first available adapter."""
        adapter = self.service.get_adapter()
        assert adapter.carrier_name is not None

    async def test_adapter_get_rates_all_carriers(self):
        """get_rates with no carrier returns rates from all configured adapters."""
        rates = await self.service.get_rates(
            from_address=SAMPLE_FROM,
            to_address=SAMPLE_TO,
            weight_kg=Decimal("1.0"),
        )
        assert len(rates) >= 3  # at least one rate per default adapter

    async def test_adapter_get_rates_single_carrier(self):
        """get_rates with carrier='tnt' returns only TNT rates."""
        rates = await self.service.get_rates(
            from_address=SAMPLE_FROM,
            to_address=SAMPLE_TO,
            weight_kg=Decimal("1.0"),
            carrier_name="tnt",
        )
        assert len(rates) >= 1
        for rate in rates:
            assert rate.get("carrier") == "TNT"

    async def test_adapter_track_tnt_prefix_auto_detect(self):
        """track_shipment auto-detects TNT from TN-prefixed tracking number."""
        status = await self.service.track_shipment("TN20260417000001")
        assert status.status is not None

    async def test_adapter_track_fedex_prefix_auto_detect(self):
        """track_shipment auto-detects FedEx from FX-prefixed tracking number."""
        status = await self.service.track_shipment("FX20260417000001")
        assert status.status is not None

    async def test_adapter_create_shipment_routes_to_correct_carrier(self):
        """create_shipment with carrier_name='tnt' routes to TNT adapter."""
        response = await self.service.create_shipment(
            from_address=SAMPLE_FROM,
            to_address=SAMPLE_TO,
            weight_kg=Decimal("2.0"),
            service_type="express",
            carrier_name="tnt",
        )
        assert response.carrier_name == "TNT"
        assert response.tracking_number.startswith("TN")


# ---------------------------------------------------------------------------
# Singleton get_carrier_service tests
# ---------------------------------------------------------------------------


class TestGetCarrierService:
    """Tests for the singleton factory function."""

    def test_adapter_singleton_returns_same_instance(self):
        """get_carrier_service returns the same CarrierService instance on repeated calls."""
        svc1 = get_carrier_service()
        svc2 = get_carrier_service()
        assert svc1 is svc2

    def test_adapter_singleton_is_carrier_service_instance(self):
        """get_carrier_service returns a CarrierService."""
        svc = get_carrier_service()
        assert isinstance(svc, CarrierService)
