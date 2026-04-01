"""
Mobile Photo-to-Order — Guest Order API

Endpoints:
- POST /api/mobile/photo-upload      Upload photo + trigger AI recognition
- POST /api/mobile/guest-orders      Create guest order from recognition
- GET  /api/mobile/guest-orders/{id} Get guest order summary (for tradesperson)
- GET  /api/guest/order/{token}      Public: Customer views their order (no auth)
- POST /api/guest/order/{token}/approve   Public: Customer approves
- POST /api/guest/order/{token}/decline   Public: Customer declines
- GET  /api/mobile/customer-links    List tradesperson's customer links
- POST /api/mobile/customer-links    Request new customer link
"""

import base64
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routes.demo_auth import get_current_user
from src.config.database import get_async_db
from src.config.settings import get_settings
from src.db.mobile_order_models import (
    GuestOrderStatus,
    GuestOrderToken,
    ProductRecognitionImage,
    RecognitionStatus,
    TradespersonCustomerLink,
)
from src.services.product_recognition_service import get_recognition_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api", tags=["Mobile Orders"])

# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class PhotoUploadResponse(BaseModel):
    image_id: str
    status: str
    matches: list[dict] = Field(default_factory=list)
    low_confidence_warning: bool = False
    context_description: str | None = None
    processing_time_ms: int


class CreateGuestOrderRequest(BaseModel):
    image_id: str | None = None
    customer_email: EmailStr
    customer_name: str
    customer_id: str | None = None
    items: list[dict] = Field(min_length=1)  # [{product_id, product_name, quantity, unit_price}]
    delivery_address: dict | None = None
    notes: str | None = None
    expires_hours: int = Field(default=72, ge=1, le=168)  # 1 hour to 7 days


class GuestOrderSummaryResponse(BaseModel):
    token: str
    status: str
    customer_email: str
    customer_name: str
    items: list[dict]
    total: float
    created_at: str
    expires_at: str
    approval_url: str


class CustomerOrderResponse(BaseModel):
    """Public response — no internal IDs exposed."""
    token: str
    status: str
    customer_name: str
    items: list[dict]
    subtotal: float
    tax: float
    total: float
    delivery_address: dict | None
    notes: str | None
    tradesperson_name: str
    expires_at: str
    is_expired: bool


class CustomerActionRequest(BaseModel):
    notes: str | None = None


class DeclineRequest(BaseModel):
    reason: str = Field(min_length=1, description="Reason for declining")


# ---------------------------------------------------------------------------
# Tradesperson Endpoints (authenticated)
# ---------------------------------------------------------------------------


@router.post("/mobile/photo-upload")
async def upload_product_photo(
    file: UploadFile,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: dict = Depends(get_current_user),
    context_notes: str | None = None,
) -> PhotoUploadResponse:
    """
    Upload a product photo and trigger AI recognition.

    Accepts JPEG/PNG images up to 10MB.
    Returns identified products with confidence scores.
    """
    # Validate file type
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP images are supported",
        )

    # Read and validate file size (10MB limit)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be < 10MB")

    # Convert to base64 for OpenAI Vision API
    image_base64 = base64.b64encode(content).decode("utf-8")

    # Create recognition record
    recognition_id = uuid4()
    recognition = ProductRecognitionImage(
        id=recognition_id,
        uploaded_by=UUID(current_user["id"]),
        original_filename=file.filename,
        storage_key=f"recognition/{recognition_id}/{file.filename or 'image.jpg'}",
        file_size_bytes=len(content),
        mime_type=file.content_type or "image/jpeg",
        status=RecognitionStatus.PROCESSING,
        context_notes=context_notes,
    )
    db.add(recognition)
    await db.flush()

    # Run AI recognition
    service = get_recognition_service()
    result = await service.recognise_products_from_base64(image_base64, context_notes)

    # Update recognition record with results
    recognition.status = RecognitionStatus.COMPLETED if result.status == "completed" else RecognitionStatus.FAILED
    recognition.recognition_results = [m.model_dump() for m in result.matches]
    recognition.top_confidence = max((m.confidence for m in result.matches), default=None)
    recognition.processing_time_ms = result.processing_time_ms
    recognition.ai_model_used = result.model_used
    recognition.raw_ai_response = {"context_description": result.context_description}
    recognition.processed_at = datetime.now(UTC)

    if result.error:
        recognition.error_message = result.error
        recognition.status = RecognitionStatus.FAILED

    await db.commit()

    logger.info(
        "photo_upload_complete",
        image_id=str(recognition_id),
        match_count=len(result.matches),
        status=recognition.status,
    )

    return PhotoUploadResponse(
        image_id=str(recognition_id),
        status=recognition.status,
        matches=[m.model_dump() for m in result.matches],
        low_confidence_warning=result.low_confidence_warning,
        context_description=result.context_description,
        processing_time_ms=result.processing_time_ms,
    )


@router.post("/mobile/guest-orders")
async def create_guest_order(
    request: CreateGuestOrderRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: dict = Depends(get_current_user),
) -> GuestOrderSummaryResponse:
    """
    Create a guest order and return a shareable approval link.

    The customer will receive a link to review and approve/decline.
    """
    # Calculate totals
    subtotal = sum(
        item.get("quantity", 1) * item.get("unit_price", 0)
        for item in request.items
    )
    tax = round(subtotal * 0.10, 2)  # 10% GST
    total = round(subtotal + tax, 2)

    order_summary = {
        "items": request.items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "delivery_address": request.delivery_address,
        "notes": request.notes,
        "tradesperson_name": current_user.get("full_name") or current_user.get("email", "Staff Member"),
    }

    # Create token
    expires_at = datetime.now(UTC) + timedelta(hours=request.expires_hours)
    token_record = GuestOrderToken(
        customer_email=request.customer_email,
        customer_name=request.customer_name,
        created_by_user_id=UUID(current_user["id"]),
        order_summary=order_summary,
        status=GuestOrderStatus.PENDING,
        expires_at=expires_at,
    )

    if request.image_id:
        token_record.recognition_image_id = request.image_id

    db.add(token_record)
    await db.commit()
    await db.refresh(token_record)

    settings = get_settings()
    approval_url = f"{settings.frontend_url}/guest/order/{token_record.token}"

    logger.info(
        "guest_order_created",
        token=token_record.token[:8],
        customer_email=request.customer_email,
        total=total,
        expires_at=expires_at.isoformat(),
    )

    return GuestOrderSummaryResponse(
        token=token_record.token,
        status=token_record.status,
        customer_email=token_record.customer_email,
        customer_name=token_record.customer_name,
        items=request.items,
        total=total,
        created_at=token_record.created_at.isoformat(),
        expires_at=expires_at.isoformat(),
        approval_url=approval_url,
    )


# ---------------------------------------------------------------------------
# Public Guest Endpoints (no authentication required)
# ---------------------------------------------------------------------------


@router.get("/guest/order/{token}")
async def get_guest_order(
    token: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CustomerOrderResponse:
    """
    Public endpoint: Customer views their pending order.
    No authentication required — secured by unique token.
    """
    result = await db.execute(
        select(GuestOrderToken).where(GuestOrderToken.token == token)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Mark as viewed
    if order.status == GuestOrderStatus.PENDING:
        order.status = GuestOrderStatus.VIEWED
        order.viewed_at = datetime.now(UTC)
        await db.commit()

    summary = order.order_summary

    return CustomerOrderResponse(
        token=order.token,
        status=order.status,
        customer_name=order.customer_name,
        items=summary.get("items", []),
        subtotal=summary.get("subtotal", 0),
        tax=summary.get("tax", 0),
        total=summary.get("total", 0),
        delivery_address=summary.get("delivery_address"),
        notes=summary.get("notes"),
        tradesperson_name=summary.get("tradesperson_name", "CCW Staff"),
        expires_at=order.expires_at.isoformat(),
        is_expired=order.is_expired(),
    )


@router.post("/guest/order/{token}/approve")
async def approve_guest_order(
    token: str,
    request: CustomerActionRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Public endpoint: Customer approves their order.
    Triggers payment flow and order creation.
    """
    result = await db.execute(
        select(GuestOrderToken).where(GuestOrderToken.token == token)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.is_expired():
        raise HTTPException(status_code=410, detail="This order link has expired")

    if not order.is_actionable():
        raise HTTPException(
            status_code=409,
            detail=f"Order cannot be approved — current status: {order.status}",
        )

    order.status = GuestOrderStatus.APPROVED
    order.approved_at = datetime.now(UTC)
    if request.notes:
        order.customer_notes = request.notes

    await db.commit()

    logger.info(
        "guest_order_approved",
        token=token[:8],
        customer_email=order.customer_email,
    )

    # TODO: Trigger Stripe payment link creation
    # TODO: Create actual order in orders table
    # TODO: Send confirmation email

    return {
        "status": "approved",
        "message": "Your order has been approved. We'll contact you shortly to confirm payment.",
        "token": token,
    }


@router.post("/guest/order/{token}/decline")
async def decline_guest_order(
    token: str,
    request: DeclineRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Public endpoint: Customer declines their order."""
    result = await db.execute(
        select(GuestOrderToken).where(GuestOrderToken.token == token)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if not order.is_actionable():
        raise HTTPException(status_code=409, detail="Order cannot be declined at this stage")

    order.status = GuestOrderStatus.DECLINED
    order.declined_reason = request.reason

    await db.commit()

    logger.info("guest_order_declined", token=token[:8], reason=request.reason[:50])

    return {
        "status": "declined",
        "message": "Order declined. The tradesperson will be notified.",
    }


# ---------------------------------------------------------------------------
# Customer Link Management (authenticated)
# ---------------------------------------------------------------------------


@router.get("/mobile/customer-links")
async def list_customer_links(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    """List all customer links for the current tradesperson."""
    user_id = UUID(current_user["id"])
    result = await db.execute(
        select(TradespersonCustomerLink).where(
            TradespersonCustomerLink.tradesperson_id == user_id
        )
    )
    links = result.scalars().all()

    return [
        {
            "id": str(link.id),
            "customer_name": link.customer_name,
            "customer_email": link.customer_email,
            "status": link.status,
            "auto_approve_under": link.auto_approve_under,
            "created_at": link.created_at.isoformat(),
        }
        for link in links
    ]
