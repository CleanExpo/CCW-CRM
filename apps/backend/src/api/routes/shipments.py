"""
Shipment Tracking API endpoints.

Provides tracking and management for:
- Inbound shipments (from suppliers to warehouses)
- Outbound shipments (from warehouses to customers)
- Carrier webhook integration for tracking updates
"""

import os
from datetime import datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import Order
from src.db.inventory_models import InboundShipment, OutboundShipment, PurchaseOrder, Supplier
from src.security.webhook_verification import (
    get_fedex_verifier,
    get_ups_verifier,
    get_usps_verifier,
)

router = APIRouter(prefix="/api/shipments", tags=["Shipments"], dependencies=[Depends(get_current_user)])
logger = structlog.get_logger(__name__)


# Pydantic models
class InboundShipmentCreate(BaseModel):
    """Schema for creating an inbound shipment."""

    purchase_order_id: UUID | None = Field(None, description="Optional PO reference")
    supplier_id: UUID
    carrier_name: str | None = Field(None, max_length=100)
    carrier_service: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    origin_address: str | None = None
    destination_location: str = Field(..., pattern="^(brisbane|sydney|melbourne)$")
    shipped_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    notes: str | None = None


class InboundShipmentUpdate(BaseModel):
    """Schema for updating an inbound shipment."""

    carrier_name: str | None = Field(None, max_length=100)
    carrier_service: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    status: str | None = Field(None, pattern="^(pending|in_transit|out_for_delivery|delivered|exception|cancelled)$")  # noqa: E501
    shipped_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    actual_delivery_date: datetime | None = None
    notes: str | None = None


class OutboundShipmentCreate(BaseModel):
    """Schema for creating an outbound shipment."""

    order_id: UUID
    carrier_name: str | None = Field(None, max_length=100)
    carrier_service: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    origin_location: str = Field(..., pattern="^(brisbane|sydney|melbourne)$")
    destination_address: str | None = None
    shipped_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    notes: str | None = None


class OutboundShipmentUpdate(BaseModel):
    """Schema for updating an outbound shipment."""

    carrier_name: str | None = Field(None, max_length=100)
    carrier_service: str | None = Field(None, max_length=100)
    tracking_number: str | None = Field(None, max_length=100)
    status: str | None = Field(None, pattern="^(pending|in_transit|out_for_delivery|delivered|exception|returned)$")  # noqa: E501
    shipped_date: datetime | None = None
    expected_delivery_date: datetime | None = None
    actual_delivery_date: datetime | None = None
    notes: str | None = None


class InboundShipmentResponse(BaseModel):
    """Schema for inbound shipment response."""

    id: UUID
    shipment_number: str
    purchase_order_id: UUID | None
    supplier_id: UUID
    carrier_name: str | None
    carrier_service: str | None
    tracking_number: str | None
    origin_address: str | None
    destination_location: str
    status: str
    shipped_date: datetime | None
    expected_delivery_date: datetime | None
    actual_delivery_date: datetime | None
    tracking_events: dict | None
    last_tracking_update: datetime | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class OutboundShipmentResponse(BaseModel):
    """Schema for outbound shipment response."""

    id: UUID
    shipment_number: str
    order_id: UUID
    carrier_name: str | None
    carrier_service: str | None
    tracking_number: str | None
    origin_location: str
    destination_address: str | None
    status: str
    shipped_date: datetime | None
    expected_delivery_date: datetime | None
    actual_delivery_date: datetime | None
    tracking_events: dict | None
    last_tracking_update: datetime | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class TrackingWebhookPayload(BaseModel):
    """Schema for carrier tracking webhook data."""

    tracking_number: str
    status: str
    status_detail: str | None = None
    location: str | None = None
    timestamp: datetime
    carrier: str | None = None


class PaginatedInboundResponse(BaseModel):
    """Paginated response for inbound shipments."""

    data: list[InboundShipmentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedOutboundResponse(BaseModel):
    """Paginated response for outbound shipments."""

    data: list[OutboundShipmentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


def generate_shipment_number(shipment_type: str) -> str:
    """Generate shipment number (IN-YYYYMMDD-NNNN or OUT-YYYYMMDD-NNNN)."""
    import time
    date_str = datetime.now().strftime("%Y%m%d")
    seq = int(time.time() % 10000)
    return f"{shipment_type}-{date_str}-{seq:04d}"


# Inbound Shipment Endpoints

@router.get("/inbound", response_model=PaginatedInboundResponse)
async def list_inbound_shipments(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    location: str | None = Query(None, description="Filter by destination location"),
    status: str | None = Query(None, description="Filter by status"),
    supplier_id: UUID | None = Query(None, description="Filter by supplier"),
    tracking_number: str | None = Query(None, description="Search by tracking number"),
) -> PaginatedInboundResponse:
    """List inbound shipments with filters."""
    query = select(InboundShipment)

    if location:
        query = query.where(InboundShipment.destination_location == location)

    if status:
        query = query.where(InboundShipment.status == status)

    if supplier_id:
        query = query.where(InboundShipment.supplier_id == supplier_id)

    if tracking_number:
        query = query.where(InboundShipment.tracking_number.ilike(f"%{tracking_number}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(InboundShipment.created_at.desc()).limit(page_size).offset((page - 1) * page_size)  # noqa: E501

    result = await db.execute(query)
    shipments = result.scalars().all()

    return PaginatedInboundResponse(
        data=[InboundShipmentResponse.model_validate(s) for s in shipments],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/inbound/{shipment_id}", response_model=InboundShipmentResponse)
async def get_inbound_shipment(
    shipment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InboundShipmentResponse:
    """Get a single inbound shipment by ID."""
    result = await db.execute(select(InboundShipment).where(InboundShipment.id == shipment_id))
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")

    return InboundShipmentResponse.model_validate(shipment)


@router.post("/inbound", response_model=InboundShipmentResponse, status_code=201)
async def create_inbound_shipment(
    shipment_data: InboundShipmentCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InboundShipmentResponse:
    """Create a new inbound shipment."""
    # Validate supplier exists
    supplier_result = await db.execute(select(Supplier).where(Supplier.id == shipment_data.supplier_id))  # noqa: E501
    if not supplier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Supplier not found")

    # Validate PO if provided
    if shipment_data.purchase_order_id:
        po_result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == shipment_data.purchase_order_id))  # noqa: E501
        if not po_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Purchase order not found")

    # Create shipment
    shipment = InboundShipment(
        shipment_number=generate_shipment_number("IN"),
        **shipment_data.model_dump(),
        status="pending",
    )
    db.add(shipment)
    await db.commit()
    await db.refresh(shipment)

    return InboundShipmentResponse.model_validate(shipment)


@router.put("/inbound/{shipment_id}", response_model=InboundShipmentResponse)
async def update_inbound_shipment(
    shipment_id: UUID,
    shipment_data: InboundShipmentUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InboundShipmentResponse:
    """Update an inbound shipment."""
    result = await db.execute(select(InboundShipment).where(InboundShipment.id == shipment_id))
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Inbound shipment not found")

    # Update fields
    update_data = shipment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shipment, field, value)

    # If status changed to delivered, set actual_delivery_date
    if shipment_data.status == "delivered" and shipment.actual_delivery_date is None:
        shipment.actual_delivery_date = datetime.now()

    await db.commit()
    await db.refresh(shipment)

    return InboundShipmentResponse.model_validate(shipment)


# Outbound Shipment Endpoints

@router.get("/outbound", response_model=PaginatedOutboundResponse)
async def list_outbound_shipments(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    location: str | None = Query(None, description="Filter by origin location"),
    status: str | None = Query(None, description="Filter by status"),
    order_id: UUID | None = Query(None, description="Filter by order"),
    tracking_number: str | None = Query(None, description="Search by tracking number"),
) -> PaginatedOutboundResponse:
    """List outbound shipments with filters."""
    query = select(OutboundShipment)

    if location:
        query = query.where(OutboundShipment.origin_location == location)

    if status:
        query = query.where(OutboundShipment.status == status)

    if order_id:
        query = query.where(OutboundShipment.order_id == order_id)

    if tracking_number:
        query = query.where(OutboundShipment.tracking_number.ilike(f"%{tracking_number}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(OutboundShipment.created_at.desc()).limit(page_size).offset((page - 1) * page_size)  # noqa: E501

    result = await db.execute(query)
    shipments = result.scalars().all()

    return PaginatedOutboundResponse(
        data=[OutboundShipmentResponse.model_validate(s) for s in shipments],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/outbound/{shipment_id}", response_model=OutboundShipmentResponse)
async def get_outbound_shipment(
    shipment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> OutboundShipmentResponse:
    """Get a single outbound shipment by ID."""
    result = await db.execute(select(OutboundShipment).where(OutboundShipment.id == shipment_id))
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Outbound shipment not found")

    return OutboundShipmentResponse.model_validate(shipment)


@router.post("/outbound", response_model=OutboundShipmentResponse, status_code=201)
async def create_outbound_shipment(
    shipment_data: OutboundShipmentCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> OutboundShipmentResponse:
    """
    Create a new outbound shipment for a customer order.

    Also updates the order's tracking fields.
    """
    # Validate order exists
    order_result = await db.execute(select(Order).where(Order.id == shipment_data.order_id))
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=400, detail="Order not found")

    # Create shipment
    shipment = OutboundShipment(
        shipment_number=generate_shipment_number("OUT"),
        **shipment_data.model_dump(),
        status="pending",
    )
    db.add(shipment)
    await db.flush()

    # Update order tracking fields
    order.fulfillment_location = shipment_data.origin_location
    order.tracking_number = shipment_data.tracking_number
    order.carrier_name = shipment_data.carrier_name
    order.shipped_date = shipment_data.shipped_date
    order.estimated_delivery_date = shipment_data.expected_delivery_date

    await db.commit()
    await db.refresh(shipment)

    return OutboundShipmentResponse.model_validate(shipment)


@router.put("/outbound/{shipment_id}", response_model=OutboundShipmentResponse)
async def update_outbound_shipment(
    shipment_id: UUID,
    shipment_data: OutboundShipmentUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> OutboundShipmentResponse:
    """Update an outbound shipment."""
    result = await db.execute(select(OutboundShipment).where(OutboundShipment.id == shipment_id))
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Outbound shipment not found")

    # Update fields
    update_data = shipment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shipment, field, value)

    # If status changed to delivered, set actual_delivery_date
    if shipment_data.status == "delivered" and shipment.actual_delivery_date is None:
        shipment.actual_delivery_date = datetime.now()

        # Also update order status to delivered
        order_result = await db.execute(select(Order).where(Order.id == shipment.order_id))
        order = order_result.scalar_one_or_none()
        if order:
            order.status = "delivered"

    await db.commit()
    await db.refresh(shipment)

    return OutboundShipmentResponse.model_validate(shipment)


# Universal Tracking Endpoint

@router.get("/track/{tracking_number}")
async def track_by_number(
    tracking_number: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Universal tracking lookup - searches both inbound and outbound shipments.

    Returns shipment details regardless of type.
    """
    # Search inbound shipments
    inbound_result = await db.execute(
        select(InboundShipment).where(InboundShipment.tracking_number == tracking_number)
    )
    inbound = inbound_result.scalar_one_or_none()

    if inbound:
        return {
            "type": "inbound",
            "shipment": InboundShipmentResponse.model_validate(inbound),
        }

    # Search outbound shipments
    outbound_result = await db.execute(
        select(OutboundShipment).where(OutboundShipment.tracking_number == tracking_number)
    )
    outbound = outbound_result.scalar_one_or_none()

    if outbound:
        return {
            "type": "outbound",
            "shipment": OutboundShipmentResponse.model_validate(outbound),
        }

    raise HTTPException(status_code=404, detail="Tracking number not found")


# Carrier Webhook Endpoints

@router.post("/webhooks/inbound/{shipment_id}")
async def inbound_tracking_webhook(
    request: Request,
    shipment_id: UUID,
    webhook_data: TrackingWebhookPayload,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    x_fedex_signature: str | None = Header(None),
    x_fedex_timestamp: str | None = Header(None),
    x_ups_signature: str | None = Header(None),
    x_ups_timestamp: str | None = Header(None),
    x_usps_signature: str | None = Header(None),
    x_usps_timestamp: str | None = Header(None),
) -> dict:
    """
    Webhook endpoint for carrier tracking updates (inbound shipments).

    Carriers will POST tracking events here.
    Signature verification is enforced in production (USE_WEBHOOK_VERIFICATION=true).
    """
    # Verify webhook signature based on carrier
    verify_webhooks = os.getenv("USE_WEBHOOK_VERIFICATION", "false").lower() == "true"

    if verify_webhooks:
        body = await request.body()
        carrier = webhook_data.carrier.lower() if webhook_data.carrier else "unknown"

        if carrier == "fedex":
            try:
                verifier = get_fedex_verifier()
                if not verifier.verify_request(body, x_fedex_signature, x_fedex_timestamp):
                    logger.warning("FedEx webhook signature verification failed", shipment_id=str(shipment_id))
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            except ValueError as e:
                logger.error("FedEx verifier not configured", error=str(e))
                raise HTTPException(status_code=500, detail="Webhook verification not configured")

        elif carrier == "ups":
            try:
                verifier = get_ups_verifier()
                if not verifier.verify_request(body, x_ups_signature, x_ups_timestamp):
                    logger.warning("UPS webhook signature verification failed", shipment_id=str(shipment_id))
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            except ValueError as e:
                logger.error("UPS verifier not configured", error=str(e))
                raise HTTPException(status_code=500, detail="Webhook verification not configured")

        elif carrier == "usps":
            try:
                verifier = get_usps_verifier()
                if not verifier.verify_request(body, x_usps_signature, x_usps_timestamp):
                    logger.warning("USPS webhook signature verification failed", shipment_id=str(shipment_id))
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            except ValueError as e:
                logger.error("USPS verifier not configured", error=str(e))
                raise HTTPException(status_code=500, detail="Webhook verification not configured")
        else:
            logger.warning("Unknown carrier for webhook verification", carrier=carrier)

    result = await db.execute(select(InboundShipment).where(InboundShipment.id == shipment_id))
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Append tracking event to tracking_events JSON
    if shipment.tracking_events is None:
        shipment.tracking_events = []

    shipment.tracking_events.append({
        "status": webhook_data.status,
        "status_detail": webhook_data.status_detail,
        "location": webhook_data.location,
        "timestamp": webhook_data.timestamp.isoformat(),
        "carrier": webhook_data.carrier,
    })

    # Update shipment status based on tracking status
    status_mapping = {
        "in_transit": "in_transit",
        "out_for_delivery": "out_for_delivery",
        "delivered": "delivered",
        "exception": "exception",
    }
    if webhook_data.status in status_mapping:
        shipment.status = status_mapping[webhook_data.status]

    shipment.last_tracking_update = datetime.now()

    # If delivered, set actual_delivery_date
    if webhook_data.status == "delivered" and shipment.actual_delivery_date is None:
        shipment.actual_delivery_date = datetime.now()

    await db.commit()

    return {"status": "success", "message": "Tracking event recorded"}


@router.post("/webhooks/outbound/{shipment_id}")
async def outbound_tracking_webhook(
    request: Request,
    shipment_id: UUID,
    webhook_data: TrackingWebhookPayload,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    x_fedex_signature: str | None = Header(None),
    x_fedex_timestamp: str | None = Header(None),
    x_ups_signature: str | None = Header(None),
    x_ups_timestamp: str | None = Header(None),
    x_usps_signature: str | None = Header(None),
    x_usps_timestamp: str | None = Header(None),
) -> dict:
    """
    Webhook endpoint for carrier tracking updates (outbound shipments).

    Carriers will POST tracking events here.
    Signature verification is enforced in production (USE_WEBHOOK_VERIFICATION=true).
    """
    # Verify webhook signature based on carrier
    verify_webhooks = os.getenv("USE_WEBHOOK_VERIFICATION", "false").lower() == "true"

    if verify_webhooks:
        body = await request.body()
        carrier = webhook_data.carrier.lower() if webhook_data.carrier else "unknown"

        if carrier == "fedex":
            try:
                verifier = get_fedex_verifier()
                if not verifier.verify_request(body, x_fedex_signature, x_fedex_timestamp):
                    logger.warning("FedEx webhook signature verification failed", shipment_id=str(shipment_id))
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            except ValueError as e:
                logger.error("FedEx verifier not configured", error=str(e))
                raise HTTPException(status_code=500, detail="Webhook verification not configured")

        elif carrier == "ups":
            try:
                verifier = get_ups_verifier()
                if not verifier.verify_request(body, x_ups_signature, x_ups_timestamp):
                    logger.warning("UPS webhook signature verification failed", shipment_id=str(shipment_id))
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            except ValueError as e:
                logger.error("UPS verifier not configured", error=str(e))
                raise HTTPException(status_code=500, detail="Webhook verification not configured")

        elif carrier == "usps":
            try:
                verifier = get_usps_verifier()
                if not verifier.verify_request(body, x_usps_signature, x_usps_timestamp):
                    logger.warning("USPS webhook signature verification failed", shipment_id=str(shipment_id))
                    raise HTTPException(status_code=401, detail="Invalid webhook signature")
            except ValueError as e:
                logger.error("USPS verifier not configured", error=str(e))
                raise HTTPException(status_code=500, detail="Webhook verification not configured")
        else:
            logger.warning("Unknown carrier for webhook verification", carrier=carrier)
    result = await db.execute(select(OutboundShipment).where(OutboundShipment.id == shipment_id))
    shipment = result.scalar_one_or_none()

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Append tracking event
    if shipment.tracking_events is None:
        shipment.tracking_events = []

    shipment.tracking_events.append({
        "status": webhook_data.status,
        "status_detail": webhook_data.status_detail,
        "location": webhook_data.location,
        "timestamp": webhook_data.timestamp.isoformat(),
        "carrier": webhook_data.carrier,
    })

    # Update shipment status
    status_mapping = {
        "in_transit": "in_transit",
        "out_for_delivery": "out_for_delivery",
        "delivered": "delivered",
        "exception": "exception",
        "returned": "returned",
    }
    if webhook_data.status in status_mapping:
        shipment.status = status_mapping[webhook_data.status]

    shipment.last_tracking_update = datetime.now()

    # If delivered, set actual_delivery_date and update order status
    if webhook_data.status == "delivered" and shipment.actual_delivery_date is None:
        shipment.actual_delivery_date = datetime.now()

        order_result = await db.execute(select(Order).where(Order.id == shipment.order_id))
        order = order_result.scalar_one_or_none()
        if order:
            order.status = "delivered"

    await db.commit()

    return {"status": "success", "message": "Tracking event recorded"}
