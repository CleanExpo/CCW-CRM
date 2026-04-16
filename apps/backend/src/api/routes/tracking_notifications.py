"""Customer tracking notification endpoints (UNI-1851).

Sends proactive status update emails to customers when order/shipment
status changes (confirmed, shipped, out for delivery, delivered, delayed).
"""

from datetime import date
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import Customer, Order
from src.services.email_notifications import email_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/notifications/tracking", tags=["Tracking Notifications"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

VALID_TYPES = {"order_confirmed", "shipped", "out_for_delivery", "delivered", "delayed"}

TEMPLATES = [
    {
        "type": "order_confirmed",
        "trigger": "Order status set to confirmed",
        "subject": "Your order has been confirmed",
        "preview": "Dear {customer}, your order {order_number} has been confirmed and is being processed.",
    },
    {
        "type": "shipped",
        "trigger": "Order dispatched with tracking number",
        "subject": "Your order has shipped",
        "preview": "Dear {customer}, your order {order_number} has been shipped. Tracking: {tracking_number}.",
    },
    {
        "type": "out_for_delivery",
        "trigger": "Carrier marks shipment out for delivery",
        "subject": "Your order is out for delivery today",
        "preview": "Dear {customer}, your order {order_number} is out for delivery today. Estimated: {estimated_delivery}.",
    },
    {
        "type": "delivered",
        "trigger": "Carrier confirms delivery",
        "subject": "Your order has been delivered",
        "preview": "Dear {customer}, your order {order_number} has been delivered. Thank you for your business.",
    },
    {
        "type": "delayed",
        "trigger": "Estimated delivery date pushed out",
        "subject": "Update on your order delivery",
        "preview": "Dear {customer}, we want to let you know your order {order_number} has been delayed. New ETA: {estimated_delivery}.",
    },
]


class NotificationTrigger(BaseModel):
    order_id: UUID
    notification_type: str = Field(..., description="order_confirmed | shipped | out_for_delivery | delivered | delayed")
    tracking_number: str | None = None
    estimated_delivery: date | None = None
    custom_message: str | None = None


class BulkNotificationRequest(BaseModel):
    order_ids: list[UUID] = Field(..., max_length=50)
    notification_type: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_subject_and_body(
    notification_type: str,
    order_number: str,
    customer_name: str,
    tracking_number: str | None,
    estimated_delivery: date | None,
    custom_message: str | None,
) -> tuple[str, str]:
    """Build email subject and plain-text body for the given notification type."""
    eta = estimated_delivery.strftime("%B %d, %Y") if estimated_delivery else "TBD"
    tracking = tracking_number or "N/A"

    subjects = {
        "order_confirmed": f"Your order {order_number} has been confirmed",
        "shipped": f"Your order {order_number} has shipped — tracking {tracking}",
        "out_for_delivery": f"Your order {order_number} is out for delivery",
        "delivered": f"Your order {order_number} has been delivered",
        "delayed": f"Update on your order {order_number}",
    }
    bodies = {
        "order_confirmed": (
            f"Dear {customer_name},\n\nYour order {order_number} has been confirmed and is being processed.\n\n"
            "Our team will be in touch shortly regarding shipment details.\n\nThank you,\nCCW Equipment"
        ),
        "shipped": (
            f"Dear {customer_name},\n\nGreat news — your order {order_number} has been dispatched!\n\n"
            f"Tracking number: {tracking}\n"
            + (f"Estimated delivery: {eta}\n" if estimated_delivery else "")
            + "\nThank you,\nCCW Equipment"
        ),
        "out_for_delivery": (
            f"Dear {customer_name},\n\nYour order {order_number} is out for delivery today"
            + (f" and is expected to arrive by {eta}" if estimated_delivery else "")
            + ".\n\nPlease ensure someone is available to receive it.\n\nThank you,\nCCW Equipment"
        ),
        "delivered": (
            f"Dear {customer_name},\n\nYour order {order_number} has been delivered.\n\n"
            "Thank you for your business. If you have any questions, please don't hesitate to contact us.\n\nCCW Equipment"
        ),
        "delayed": (
            f"Dear {customer_name},\n\nWe want to keep you informed about your order {order_number}.\n\n"
            f"Unfortunately, there has been a delay. New estimated delivery: {eta}.\n\n"
            "We apologise for any inconvenience and appreciate your patience.\n\nThank you,\nCCW Equipment"
        ),
    }

    subject = subjects.get(notification_type, f"Update on your order {order_number}")
    body = bodies.get(notification_type, f"Update on your order {order_number}.")
    if custom_message:
        body += f"\n\nAdditional note: {custom_message}"
    return subject, body


async def _fetch_order_and_customer(
    order_id: UUID, db: AsyncSession
) -> tuple[Order, Customer]:
    """Load Order + Customer or raise 404."""
    result = await db.execute(
        select(Order, Customer)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.id == order_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found")
    return row[0], row[1]


async def _send_notification(trigger: NotificationTrigger, db: AsyncSession) -> dict:
    """Core send logic — shared by single and bulk endpoints."""
    if trigger.notification_type not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid notification_type. Must be one of: {', '.join(sorted(VALID_TYPES))}",
        )

    order, customer = await _fetch_order_and_customer(trigger.order_id, db)
    subject, body = _build_subject_and_body(
        trigger.notification_type,
        order.order_number,
        customer.contact_name,
        trigger.tracking_number,
        trigger.estimated_delivery,
        trigger.custom_message,
    )

    # Use send_order_confirmation for order_confirmed, generic HTML send otherwise
    if trigger.notification_type == "order_confirmed":
        sent = email_service.send_order_confirmation(
            order_number=order.order_number,
            customer_email=customer.email,
            customer_name=customer.contact_name,
            total=float(order.total),
            item_count=0,
            status="confirmed",
        )
    else:
        # Fall back to a generic notification via SendGrid Mail directly
        sent = _send_generic(customer.email, subject, body)

    if not sent:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Email delivery failed — check SendGrid configuration",
        )

    logger.info(
        "Tracking notification sent",
        order_id=str(trigger.order_id),
        notification_type=trigger.notification_type,
        recipient=customer.email,
    )
    return {"sent": True, "recipient": customer.email}


def _send_generic(email: str, subject: str, body: str) -> bool:
    """Send a plain-text email via the shared SendGrid client in email_service."""
    if not email_service.client:
        logger.warning("Email notification skipped - SendGrid not configured")
        return False
    try:
        from sendgrid.helpers.mail import Content, Email, Mail, To

        msg = Mail(
            from_email=Email(email_service.from_email),
            to_emails=To(email),
            subject=subject,
            html_content=Content(
                "text/html",
                f"<html><body style='font-family:Arial,sans-serif;color:#333;line-height:1.6;'>"
                f"<div style='max-width:600px;margin:0 auto;padding:20px;border:1px solid #ddd;border-radius:8px;'>"
                f"<pre style='white-space:pre-wrap;font-family:inherit;'>{body}</pre>"
                f"<div style='margin-top:20px;border-top:1px solid #e2e8f0;padding-top:15px;font-size:12px;color:#94a3b8;'>"
                f"CCW Equipment — automated notification</div></div></body></html>",
            ),
        )
        response = email_service.client.send(msg)
        return response.status_code in (200, 201, 202)
    except Exception as exc:
        logger.error("Generic notification send failed", error=str(exc))
        return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", status_code=status.HTTP_200_OK)
async def send_tracking_notification(
    trigger: NotificationTrigger,
    _current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Trigger a tracking status email to the customer attached to the order."""
    return await _send_notification(trigger, db)


@router.get("/templates", status_code=status.HTTP_200_OK)
async def list_templates(
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> list[dict]:
    """Return the list of available notification templates with previews."""
    return TEMPLATES


@router.post("/bulk", status_code=status.HTTP_200_OK)
async def send_bulk_tracking_notifications(
    payload: BulkNotificationRequest,
    _current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Send tracking notifications for up to 50 orders."""
    if len(payload.order_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum 50 orders per bulk request",
        )

    results: list[dict] = []
    errors: list[dict] = []

    for order_id in payload.order_ids:
        try:
            result = await _send_notification(
                NotificationTrigger(
                    order_id=order_id,
                    notification_type=payload.notification_type,
                ),
                db,
            )
            results.append({"order_id": str(order_id), **result})
        except HTTPException as exc:
            errors.append({"order_id": str(order_id), "error": exc.detail})

    return {
        "sent_count": len(results),
        "error_count": len(errors),
        "results": results,
        "errors": errors,
    }
