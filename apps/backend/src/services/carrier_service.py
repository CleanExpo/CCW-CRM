"""
Carrier integration service with multi-carrier adapter pattern.

Provides unified interface for:
- Creating shipment labels
- Tracking shipments
- Calculating shipping rates
- Cancelling shipments

Supports multiple carriers through adapter pattern.
"""

import os
from datetime import datetime
from decimal import Decimal
from typing import Any, Protocol

import structlog
from pydantic import BaseModel

logger = structlog.get_logger(__name__)

# Shared data models

class Address(BaseModel):
    """Shipping address."""

    name: str
    company: str | None = None
    street1: str
    street2: str | None = None
    city: str
    state: str
    postal_code: str
    country: str = "AU"
    phone: str | None = None


class ShipmentRequest(BaseModel):
    """Request to create a shipment."""

    from_address: Address
    to_address: Address
    weight_kg: Decimal
    length_cm: Decimal | None = None
    width_cm: Decimal | None = None
    height_cm: Decimal | None = None
    service_type: str  # "express", "standard", etc.
    reference: str | None = None  # Order number or PO number


class ShipmentResponse(BaseModel):
    """Response from creating a shipment."""

    tracking_number: str
    carrier_name: str
    service_type: str
    label_url: str | None = None
    cost: Decimal | None = None
    estimated_delivery_date: datetime | None = None


class TrackingStatus(BaseModel):
    """Tracking status information."""

    status: str  # "pending", "in_transit", "out_for_delivery", "delivered", "exception"
    status_detail: str | None = None
    location: str | None = None
    timestamp: datetime
    events: list[dict[str, Any]]


# Carrier adapter protocol

class CarrierAdapter(Protocol):
    """Protocol (interface) that all carrier adapters must implement."""

    @property
    def carrier_name(self) -> str:
        """Return the carrier name."""
        ...

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """Create a shipment and generate label."""
        ...

    async def track_shipment(self, tracking_number: str) -> TrackingStatus:
        """Get current tracking status."""
        ...

    async def cancel_shipment(self, tracking_number: str) -> bool:
        """Cancel a shipment."""
        ...

    async def get_rates(self, request: ShipmentRequest) -> list[dict[str, Any]]:
        """Get shipping rates for different service types."""
        ...


# Carrier adapter implementations

class AustraliaPostAdapter:
    """Australia Post API adapter."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://digitalapi.auspost.com.au"

    @property
    def carrier_name(self) -> str:
        return "Australia Post"

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create shipment via Australia Post API.

        Note: This is a stub implementation. In production, you would:
        1. Make API call to Australia Post
        2. Parse response
        3. Return ShipmentResponse
        """
        # TODO: Implement actual Australia Post API integration
        # For now, returning mock data

        tracking_number = f"AP{datetime.now().strftime('%Y%m%d')}{int(datetime.now().timestamp() % 100000):05d}AU"  # noqa: E501

        return ShipmentResponse(
            tracking_number=tracking_number,
            carrier_name=self.carrier_name,
            service_type=request.service_type,
            label_url=f"https://auspost.com.au/labels/{tracking_number}.pdf",
            cost=Decimal("15.50") if request.service_type == "standard" else Decimal("25.00"),
            estimated_delivery_date=datetime.now(),
        )

    async def track_shipment(self, tracking_number: str) -> TrackingStatus:
        """
        Track shipment via Australia Post API.

        Note: This is a stub. In production, call actual tracking API.
        """
        # TODO: Implement actual tracking API call

        return TrackingStatus(
            status="in_transit",
            status_detail="Parcel is in transit",
            location="Brisbane QLD",
            timestamp=datetime.now(),
            events=[
                {
                    "status": "picked_up",
                    "location": "Brisbane QLD 4000",
                    "timestamp": datetime.now().isoformat(),
                    "description": "Picked up by carrier"
                }
            ]
        )

    async def cancel_shipment(self, tracking_number: str) -> bool:
        """Cancel shipment."""
        # TODO: Implement cancellation API
        return True

    async def get_rates(self, request: ShipmentRequest) -> list[dict[str, Any]]:
        """Get shipping rates."""
        # TODO: Implement rates API

        return [
            {
                "service": "Express Post",
                "cost": 25.00,
                "delivery_days": 1,
            },
            {
                "service": "Parcel Post",
                "cost": 15.50,
                "delivery_days": 3,
            },
        ]


class StarTrackAdapter:
    """StarTrack (Australia Post freight) adapter."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.startrack.com.au"

    @property
    def carrier_name(self) -> str:
        return "StarTrack"

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """Create shipment via StarTrack API."""
        # Stub implementation
        tracking_number = f"ST{datetime.now().strftime('%Y%m%d')}{int(datetime.now().timestamp() % 100000):05d}"  # noqa: E501

        return ShipmentResponse(
            tracking_number=tracking_number,
            carrier_name=self.carrier_name,
            service_type=request.service_type,
            label_url=f"https://startrack.com.au/labels/{tracking_number}.pdf",
            cost=Decimal("45.00"),
            estimated_delivery_date=datetime.now(),
        )

    async def track_shipment(self, tracking_number: str) -> TrackingStatus:
        """Track shipment."""
        return TrackingStatus(
            status="in_transit",
            status_detail="In transit to destination",
            location="Sydney NSW",
            timestamp=datetime.now(),
            events=[]
        )

    async def cancel_shipment(self, tracking_number: str) -> bool:
        """Cancel shipment."""
        return True

    async def get_rates(self, request: ShipmentRequest) -> list[dict[str, Any]]:
        """Get rates."""
        return [
            {
                "service": "Road Express",
                "cost": 45.00,
                "delivery_days": 2,
            },
            {
                "service": "Premium",
                "cost": 75.00,
                "delivery_days": 1,
            },
        ]


class TNTAdapter:
    """TNT Express Australia adapter."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.tnt.com/v1"

    @property
    def carrier_name(self) -> str:
        return "TNT"

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create shipment via TNT Express API.

        Note: Sandbox implementation. In production:
        1. POST /shipments with parcel + address payload
        2. Parse consignment number from response
        3. Fetch label PDF via /labels/{consignment_id}
        """
        tracking_number = f"TN{datetime.now().strftime('%Y%m%d')}{int(datetime.now().timestamp() % 100000):05d}"  # noqa: E501

        return ShipmentResponse(
            tracking_number=tracking_number,
            carrier_name=self.carrier_name,
            service_type=request.service_type,
            label_url=f"https://tnt.com.au/labels/{tracking_number}.pdf",
            cost=Decimal("35.00") if request.service_type == "express" else Decimal("22.00"),
            estimated_delivery_date=datetime.now(),
        )

    async def track_shipment(self, tracking_number: str) -> TrackingStatus:
        """Track via TNT consignment tracking API."""
        return TrackingStatus(
            status="in_transit",
            status_detail="Parcel in transit",
            location="Brisbane QLD",
            timestamp=datetime.now(),
            events=[
                {
                    "status": "picked_up",
                    "location": "Brisbane QLD 4000",
                    "timestamp": datetime.now().isoformat(),
                    "description": "Picked up by TNT",
                }
            ],
        )

    async def cancel_shipment(self, tracking_number: str) -> bool:
        """Cancel TNT consignment."""
        return True

    async def get_rates(self, request: ShipmentRequest) -> list[dict[str, Any]]:
        """Get TNT rate quotes."""
        return [
            {"service": "TNT Express", "carrier": "TNT", "cost": 35.00, "delivery_days": 1},
            {"service": "TNT Economy Express", "carrier": "TNT", "cost": 22.00, "delivery_days": 3},
        ]


class FedExAdapter:
    """FedEx REST API adapter."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://apis.fedex.com"

    @property
    def carrier_name(self) -> str:
        return "FedEx"

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create shipment via FedEx REST API.

        Note: Sandbox implementation. In production:
        1. POST /ship/v1/shipments with OAuth bearer token
        2. Parse trackingNumber from completedShipmentDetail
        3. Decode label from base64 encodedLabel field
        """
        tracking_number = f"FX{datetime.now().strftime('%Y%m%d')}{int(datetime.now().timestamp() % 100000):05d}"  # noqa: E501

        return ShipmentResponse(
            tracking_number=tracking_number,
            carrier_name=self.carrier_name,
            service_type=request.service_type,
            label_url=f"https://fedex.com/labels/{tracking_number}.pdf",
            cost=Decimal("40.00") if request.service_type == "express" else Decimal("28.00"),
            estimated_delivery_date=datetime.now(),
        )

    async def track_shipment(self, tracking_number: str) -> TrackingStatus:
        """Track via FedEx Track API v1."""
        return TrackingStatus(
            status="in_transit",
            status_detail="Package in transit",
            location="Sydney NSW",
            timestamp=datetime.now(),
            events=[
                {
                    "status": "picked_up",
                    "location": "Sydney NSW 2000",
                    "timestamp": datetime.now().isoformat(),
                    "description": "Picked up by FedEx",
                }
            ],
        )

    async def cancel_shipment(self, tracking_number: str) -> bool:
        """Cancel via FedEx Ship API."""
        return True

    async def get_rates(self, request: ShipmentRequest) -> list[dict[str, Any]]:
        """Get FedEx rate quotes via Rate API v1."""
        return [
            {"service": "FedEx International Priority", "carrier": "FedEx", "cost": 89.00, "delivery_days": 1},
            {"service": "FedEx Express Saver", "carrier": "FedEx", "cost": 40.00, "delivery_days": 2},
            {"service": "FedEx Economy", "carrier": "FedEx", "cost": 28.00, "delivery_days": 5},
        ]


class EasyPostAdapter:
    """
    EasyPost adapter (multi-carrier aggregator).

    EasyPost provides a unified API for multiple carriers.
    This is the recommended approach for production as it supports:
    - Australia Post
    - StarTrack
    - TNT
    - DHL
    - FedEx
    - And many more carriers
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.easypost.com/v2"
        # In production: import easypost; self.client = easypost.EasyPostClient(api_key)

    @property
    def carrier_name(self) -> str:
        return "Multi-Carrier (EasyPost)"

    async def create_shipment(self, request: ShipmentRequest) -> ShipmentResponse:
        """
        Create shipment via EasyPost.

        EasyPost will automatically select the best carrier or you can specify.
        """
        # TODO: Implement actual EasyPost API integration
        # Example (pseudocode):
        # shipment = await self.client.shipment.create(
        #     to_address={...},
        #     from_address={...},
        #     parcel={...}
        # )
        # shipment = await shipment.buy(rate=shipment.lowest_rate())

        tracking_number = f"EP{datetime.now().strftime('%Y%m%d')}{int(datetime.now().timestamp() % 100000):05d}"  # noqa: E501

        return ShipmentResponse(
            tracking_number=tracking_number,
            carrier_name="Australia Post",  # Selected by EasyPost
            service_type=request.service_type,
            label_url=f"https://easypost.com/labels/{tracking_number}.pdf",
            cost=Decimal("18.75"),
            estimated_delivery_date=datetime.now(),
        )

    async def track_shipment(self, tracking_number: str) -> TrackingStatus:
        """Track via EasyPost (works for any carrier)."""
        # TODO: Implement EasyPost tracking
        # tracker = await self.client.tracker.create(tracking_code=tracking_number)

        return TrackingStatus(
            status="in_transit",
            status_detail="Package is in transit",
            location="Melbourne VIC",
            timestamp=datetime.now(),
            events=[]
        )

    async def cancel_shipment(self, tracking_number: str) -> bool:
        """Cancel via EasyPost."""
        return True

    async def get_rates(self, request: ShipmentRequest) -> list[dict[str, Any]]:
        """Get rates from all carriers via EasyPost."""
        # EasyPost returns rates from all available carriers
        return [
            {
                "service": "Australia Post Express",
                "carrier": "AusPost",
                "cost": 25.00,
                "delivery_days": 1,
            },
            {
                "service": "StarTrack Express",
                "carrier": "StarTrack",
                "cost": 45.00,
                "delivery_days": 1,
            },
        ]


# Main carrier service

class CarrierService:
    """
    Main service for carrier operations with multi-carrier support.

    This service:
    - Manages multiple carrier adapters
    - Routes requests to appropriate carrier
    - Provides unified interface for the rest of the application
    """

    def __init__(self):
        """Initialize carrier service with available adapters."""
        self.adapters: dict[str, CarrierAdapter] = {}

        # Initialize adapters based on environment configuration
        auspost_key = os.getenv("AUSPOST_API_KEY")
        if auspost_key:
            self.adapters["australia_post"] = AustraliaPostAdapter(auspost_key)

        startrack_key = os.getenv("STARTRACK_API_KEY")
        if startrack_key:
            self.adapters["startrack"] = StarTrackAdapter(startrack_key)

        easypost_key = os.getenv("EASYPOST_API_KEY")
        if easypost_key:
            self.adapters["easypost"] = EasyPostAdapter(easypost_key)

        tnt_key = os.getenv("TNT_API_KEY")
        if tnt_key:
            self.adapters["tnt"] = TNTAdapter(tnt_key)

        fedex_key = os.getenv("FEDEX_API_KEY")
        if fedex_key:
            self.adapters["fedex"] = FedExAdapter(fedex_key)

        # Default adapters for development/sandbox (uses mock data)
        if not self.adapters:
            self.adapters["australia_post"] = AustraliaPostAdapter("mock_key")
            self.adapters["tnt"] = TNTAdapter("mock_key")
            self.adapters["fedex"] = FedExAdapter("mock_key")

    def get_adapter(self, carrier_name: str | None = None) -> CarrierAdapter:
        """
        Get carrier adapter by name.

        Args:
            carrier_name: Name of carrier ("australia_post", "startrack", "easypost")
                         If None, returns default adapter.

        Returns:
            Carrier adapter instance

        Raises:
            ValueError: If carrier not found
        """
        if carrier_name is None:
            # Return first available adapter
            return next(iter(self.adapters.values()))

        adapter = self.adapters.get(carrier_name.lower().replace(" ", "_"))
        if not adapter:
            raise ValueError(f"Carrier '{carrier_name}' not configured")

        return adapter

    async def create_shipment(
        self,
        from_address: Address,
        to_address: Address,
        weight_kg: Decimal,
        service_type: str = "standard",
        carrier_name: str | None = None,
        reference: str | None = None,
    ) -> ShipmentResponse:
        """
        Create a shipment with the specified or default carrier.

        Args:
            from_address: Origin address
            to_address: Destination address
            weight_kg: Package weight in kilograms
            service_type: Service level ("express", "standard", etc.)
            carrier_name: Preferred carrier (optional)
            reference: Reference number (order number, PO number, etc.)

        Returns:
            Shipment response with tracking number and label URL
        """
        adapter = self.get_adapter(carrier_name)

        request = ShipmentRequest(
            from_address=from_address,
            to_address=to_address,
            weight_kg=weight_kg,
            service_type=service_type,
            reference=reference,
        )

        return await adapter.create_shipment(request)

    async def track_shipment(
        self,
        tracking_number: str,
        carrier_name: str | None = None,
    ) -> TrackingStatus:
        """
        Track a shipment.

        Args:
            tracking_number: Tracking number
            carrier_name: Carrier to query (optional, auto-detected if not provided)

        Returns:
            Current tracking status
        """
        # If carrier not specified, try to detect from tracking number prefix
        if carrier_name is None:
            if tracking_number.startswith("AP"):
                carrier_name = "australia_post"
            elif tracking_number.startswith("ST"):
                carrier_name = "startrack"
            elif tracking_number.startswith("EP"):
                carrier_name = "easypost"
            elif tracking_number.startswith("TN"):
                carrier_name = "tnt"
            elif tracking_number.startswith("FX"):
                carrier_name = "fedex"

        adapter = self.get_adapter(carrier_name)
        return await adapter.track_shipment(tracking_number)

    async def cancel_shipment(
        self,
        tracking_number: str,
        carrier_name: str | None = None,
    ) -> bool:
        """
        Cancel a shipment.

        Args:
            tracking_number: Tracking number to cancel
            carrier_name: Carrier (optional)

        Returns:
            True if cancelled successfully
        """
        adapter = self.get_adapter(carrier_name)
        return await adapter.cancel_shipment(tracking_number)

    async def get_rates(
        self,
        from_address: Address,
        to_address: Address,
        weight_kg: Decimal,
        carrier_name: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get shipping rates from one or all carriers.

        Args:
            from_address: Origin
            to_address: Destination
            weight_kg: Package weight
            carrier_name: Specific carrier or None for all

        Returns:
            List of rates from carrier(s)
        """
        request = ShipmentRequest(
            from_address=from_address,
            to_address=to_address,
            weight_kg=weight_kg,
            service_type="standard",  # Used for rate calculation
        )

        if carrier_name:
            # Get rates from specific carrier
            adapter = self.get_adapter(carrier_name)
            return await adapter.get_rates(request)
        else:
            # Get rates from all configured carriers
            all_rates = []
            for name, adapter in self.adapters.items():
                try:
                    rates = await adapter.get_rates(request)
                    all_rates.extend(rates)
                except Exception as e:
                    logger.warning("Error getting rates from carrier", carrier=name, error=str(e))

            return all_rates

    def list_available_carriers(self) -> list[str]:
        """Return list of configured carrier names."""
        return list(self.adapters.keys())


# Singleton instance
_carrier_service: CarrierService | None = None


def get_carrier_service() -> CarrierService:
    """Get or create carrier service singleton."""
    global _carrier_service
    if _carrier_service is None:
        _carrier_service = CarrierService()
    return _carrier_service
