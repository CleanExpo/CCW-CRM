"""Email Audit Trail API routes for GDPR compliance and email tracking.

Provides endpoints for:
- SendGrid webhook handling (delivery, opens, clicks, bounces)
- Email history queries
- GDPR data export
- Consent management
- Email analytics

ISS-037: Email audit trail implementation
"""

import hashlib
import hmac
import os
from datetime import datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.email_audit_models import EmailPurpose, EmailStatus
from src.services.email_audit_service import EmailAuditService

router = APIRouter(prefix="/api/emails", tags=["Email Audit"])
logger = structlog.get_logger(__name__)


# ============================================================
# Request/Response Models
# ============================================================


class EmailHistoryResponse(BaseModel):
    """Response model for email history."""

    id: str
    recipient_email: str
    recipient_name: str | None
    subject: str
    status: str
    purpose: str
    sent_at: str | None
    delivered_at: str | None
    opened_at: str | None
    open_count: int
    click_count: int
    error_message: str | None
    created_at: str


class EmailHistoryListResponse(BaseModel):
    """Paginated email history response."""

    emails: list[EmailHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class EmailStatsResponse(BaseModel):
    """Email statistics response."""

    total: int
    sent: int
    delivered: int
    opened: int
    clicked: int
    bounced: int
    spam_reports: int
    unsubscribes: int
    delivery_rate: float
    open_rate: float
    click_rate: float
    bounce_rate: float
    status_breakdown: dict[str, int]


class ConsentUpdateRequest(BaseModel):
    """Request to update email consent."""

    email: EmailStr
    marketing_consent: bool
    source: str = Field(
        description="Source of consent change (signup, portal, preference_center)"
    )
    customer_id: str | None = None


class ConsentResponse(BaseModel):
    """Consent status response."""

    email: str
    marketing_consent: bool
    marketing_consent_at: str | None
    notification_consent: bool
    unsubscribed: bool
    unsubscribed_at: str | None
    hard_bounced: bool
    spam_reported: bool


class GDPRExportResponse(BaseModel):
    """GDPR data export response."""

    export_date: str
    export_type: str
    email_address: str | None
    customer_id: str | None
    consent_status: dict | None
    total_emails: int
    emails: list[dict]


# ============================================================
# SendGrid Webhook Handler
# ============================================================


def _verify_sendgrid_signature(
    request_body: bytes,
    signature: str,
    timestamp: str,
    secret: str,
) -> bool:
    """Verify SendGrid webhook signature.

    SendGrid signs webhooks using the following algorithm:
    HMAC-SHA256(timestamp + payload, webhook_secret)

    Args:
        request_body: Raw request body
        signature: X-Twilio-Email-Event-Webhook-Signature header
        timestamp: X-Twilio-Email-Event-Webhook-Timestamp header
        secret: Webhook verification key

    Returns:
        True if signature is valid
    """
    payload = timestamp.encode() + request_body
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


@router.post("/webhooks/sendgrid/events")
async def handle_sendgrid_events(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Handle SendGrid Event Webhook for delivery tracking.

    Receives events for:
    - processed: Email was accepted by SendGrid
    - delivered: Email was delivered to recipient
    - open: Email was opened (requires tracking enabled)
    - click: Link was clicked (requires tracking enabled)
    - bounce: Email bounced (hard or soft)
    - dropped: Email was dropped (invalid, suppression list, etc.)
    - deferred: Delivery was temporarily delayed
    - spamreport: Recipient marked as spam
    - unsubscribe: Recipient unsubscribed

    Webhook URL to configure in SendGrid:
    https://your-domain.com/api/emails/webhooks/sendgrid/events
    """
    # Get verification secret
    webhook_secret = os.getenv("SENDGRID_WEBHOOK_VERIFICATION_KEY", "")

    # Verify signature in production
    if webhook_secret and os.getenv("ENVIRONMENT", "development") != "development":
        signature = request.headers.get("X-Twilio-Email-Event-Webhook-Signature", "")
        timestamp = request.headers.get("X-Twilio-Email-Event-Webhook-Timestamp", "")

        if not signature or not timestamp:
            logger.warning("sendgrid_webhook_missing_signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing webhook signature",
            )

        body = await request.body()

        if not _verify_sendgrid_signature(body, signature, timestamp, webhook_secret):
            logger.warning("sendgrid_webhook_invalid_signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

    # Parse events (SendGrid sends array of events)
    events = await request.json()

    if not isinstance(events, list):
        events = [events]

    audit_service = EmailAuditService(db)

    processed_count = 0
    failed_count = 0

    for event in events:
        try:
            success = await audit_service.process_sendgrid_event(event)
            if success:
                processed_count += 1
            else:
                failed_count += 1
        except Exception as e:
            logger.error(
                "sendgrid_event_processing_error",
                event=event,
                error=str(e),
            )
            failed_count += 1

    await db.commit()

    logger.info(
        "sendgrid_webhook_processed",
        total_events=len(events),
        processed=processed_count,
        failed=failed_count,
    )

    return {
        "success": True,
        "total_events": len(events),
        "processed": processed_count,
        "failed": failed_count,
    }


# ============================================================
# Email History API
# ============================================================


@router.get("/history", response_model=EmailHistoryListResponse)
async def get_email_history(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    email: str | None = Query(None, description="Filter by recipient email"),
    customer_id: str | None = Query(None, description="Filter by customer ID"),
    user_id: str | None = Query(None, description="Filter by sending user ID"),
    purpose: str | None = Query(None, description="Filter by purpose (transactional, marketing, etc.)"),
    email_status: str | None = Query(None, alias="status", description="Filter by status"),
    start_date: datetime | None = Query(None, description="Filter emails after this date"),
    end_date: datetime | None = Query(None, description="Filter emails before this date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Results per page"),
) -> EmailHistoryListResponse:
    """Get email history with filters.

    Supports filtering by:
    - recipient email address
    - customer ID
    - sending user ID
    - email purpose
    - delivery status
    - date range

    Results are ordered by creation date (newest first).
    """
    audit_service = EmailAuditService(db)

    # Parse enums
    purpose_enum = None
    if purpose:
        try:
            purpose_enum = EmailPurpose(purpose)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid purpose. Valid values: {[p.value for p in EmailPurpose]}",
            )

    status_enum = None
    if email_status:
        try:
            status_enum = EmailStatus(email_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Valid values: {[s.value for s in EmailStatus]}",
            )

    # Parse UUIDs
    customer_uuid = UUID(customer_id) if customer_id else None
    user_uuid = UUID(user_id) if user_id else None

    result = await audit_service.get_email_history(
        email=email,
        customer_id=customer_uuid,
        user_id=user_uuid,
        purpose=purpose_enum,
        status=status_enum,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )

    return EmailHistoryListResponse(
        emails=[EmailHistoryResponse(**e) for e in result["emails"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.get("/history/{email_id}")
async def get_email_detail(
    email_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get detailed information about a specific email.

    Returns full email content and delivery tracking information.
    """
    from sqlalchemy import select

    from src.db.email_audit_models import EmailLog

    result = await db.execute(
        select(EmailLog).where(EmailLog.id == UUID(email_id))
    )
    email_log = result.scalar_one_or_none()

    if not email_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found",
        )

    return {
        "id": str(email_log.id),
        "recipient_email": email_log.recipient_email,
        "recipient_name": email_log.recipient_name,
        "from_email": email_log.from_email,
        "from_name": email_log.from_name,
        "subject": email_log.subject,
        "html_content": email_log.html_content if not email_log.content_purged else None,
        "text_content": email_log.text_content if not email_log.content_purged else None,
        "content_purged": email_log.content_purged,
        "template_id": email_log.template_id,
        "status": email_log.status,
        "error_message": email_log.error_message,
        "purpose": email_log.purpose,
        "sendgrid_message_id": email_log.sendgrid_message_id,
        "sent_at": email_log.sent_at.isoformat() if email_log.sent_at else None,
        "delivered_at": email_log.delivered_at.isoformat() if email_log.delivered_at else None,
        "opened_at": email_log.opened_at.isoformat() if email_log.opened_at else None,
        "open_count": email_log.open_count,
        "clicked_at": email_log.clicked_at.isoformat() if email_log.clicked_at else None,
        "click_count": email_log.click_count,
        "bounced_at": email_log.bounced_at.isoformat() if email_log.bounced_at else None,
        "consent_given": email_log.consent_given,
        "related_entity_type": email_log.related_entity_type,
        "related_entity_id": str(email_log.related_entity_id) if email_log.related_entity_id else None,
        "created_at": email_log.created_at.isoformat(),
        "updated_at": email_log.updated_at.isoformat(),
    }


# ============================================================
# GDPR Export API
# ============================================================


@router.get("/gdpr/export")
async def get_gdpr_export(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    email: str | None = Query(None, description="Email address to export"),
    customer_id: str | None = Query(None, description="Customer ID to export"),
) -> GDPRExportResponse:
    """Export email data for GDPR data portability request.

    Exports all email communication history including:
    - All emails sent to the address
    - Consent status and history
    - Delivery tracking information

    Either email or customer_id must be provided.
    """
    if not email and not customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email or customer_id must be provided",
        )

    audit_service = EmailAuditService(db)

    try:
        result = await audit_service.get_gdpr_export(
            email=email,
            customer_id=UUID(customer_id) if customer_id else None,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return GDPRExportResponse(**result)


# ============================================================
# Consent Management API
# ============================================================


@router.get("/consent/{email}", response_model=ConsentResponse)
async def get_consent_status(
    email: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ConsentResponse:
    """Get consent status for an email address.

    Returns current consent settings including:
    - Marketing email consent
    - Notification consent
    - Unsubscribe status
    - Bounce/spam report status
    """
    audit_service = EmailAuditService(db)
    consent = await audit_service.get_or_create_consent(email)

    return ConsentResponse(
        email=consent.email,
        marketing_consent=consent.marketing_consent,
        marketing_consent_at=(
            consent.marketing_consent_at.isoformat()
            if consent.marketing_consent_at
            else None
        ),
        notification_consent=consent.notification_consent,
        unsubscribed=consent.unsubscribed,
        unsubscribed_at=(
            consent.unsubscribed_at.isoformat() if consent.unsubscribed_at else None
        ),
        hard_bounced=consent.hard_bounced,
        spam_reported=consent.spam_reported,
    )


@router.post("/consent/update")
async def update_consent(
    request: ConsentUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ConsentResponse:
    """Update marketing consent for an email address.

    Used for:
    - Preference center updates
    - Signup form consent
    - Unsubscribe requests

    Marketing consent is required for promotional emails under GDPR.
    """
    audit_service = EmailAuditService(db)

    consent = await audit_service.update_marketing_consent(
        email=request.email,
        consent_given=request.marketing_consent,
        source=request.source,
        customer_id=UUID(request.customer_id) if request.customer_id else None,
    )

    await db.commit()

    return ConsentResponse(
        email=consent.email,
        marketing_consent=consent.marketing_consent,
        marketing_consent_at=(
            consent.marketing_consent_at.isoformat()
            if consent.marketing_consent_at
            else None
        ),
        notification_consent=consent.notification_consent,
        unsubscribed=consent.unsubscribed,
        unsubscribed_at=(
            consent.unsubscribed_at.isoformat() if consent.unsubscribed_at else None
        ),
        hard_bounced=consent.hard_bounced,
        spam_reported=consent.spam_reported,
    )


@router.post("/consent/unsubscribe")
async def process_unsubscribe(
    email: str = Query(..., description="Email to unsubscribe"),
    reason: str | None = Query(None, description="Unsubscribe reason"),
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    """Process an unsubscribe request.

    Sets unsubscribed flag and revokes marketing consent.
    Transactional emails (orders, quotes) will still be sent.
    """
    audit_service = EmailAuditService(db)
    await audit_service._update_consent_unsubscribe(email, reason)
    await db.commit()

    logger.info("unsubscribe_processed", email=email, reason=reason)

    return {
        "success": True,
        "message": "Successfully unsubscribed from marketing emails",
    }


# ============================================================
# Analytics API
# ============================================================


@router.get("/stats", response_model=EmailStatsResponse)
async def get_email_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    organization_id: str | None = Query(None, description="Filter by organization"),
    start_date: datetime | None = Query(None, description="Start of date range"),
    end_date: datetime | None = Query(None, description="End of date range"),
) -> EmailStatsResponse:
    """Get email delivery statistics.

    Returns:
    - Total emails sent
    - Delivery rate
    - Open rate
    - Click rate
    - Bounce rate
    - Spam reports
    - Unsubscribes
    """
    audit_service = EmailAuditService(db)

    result = await audit_service.get_email_stats(
        organization_id=UUID(organization_id) if organization_id else None,
        start_date=start_date,
        end_date=end_date,
    )

    return EmailStatsResponse(**result)


# ============================================================
# Suppression List API
# ============================================================


@router.get("/suppression-list")
async def get_suppression_list(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    """Get email suppression list (bounced, spam reported, unsubscribed).

    These addresses should not receive emails:
    - hard_bounced: Email address doesn't exist
    - spam_reported: Recipient marked as spam
    - unsubscribed: Recipient opted out
    """
    from sqlalchemy import func, or_, select

    from src.db.email_audit_models import EmailConsent

    query = select(EmailConsent).where(
        or_(
            EmailConsent.hard_bounced.is_(True),
            EmailConsent.spam_reported.is_(True),
            EmailConsent.unsubscribed.is_(True),
        )
    ).order_by(EmailConsent.updated_at.desc())

    # Count
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Paginate
    query = query.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(query)
    consents = result.scalars().all()

    return {
        "suppressed": [
            {
                "email": c.email,
                "reason": (
                    "hard_bounced"
                    if c.hard_bounced
                    else "spam_reported"
                    if c.spam_reported
                    else "unsubscribed"
                ),
                "date": (
                    c.hard_bounced_at or c.spam_reported_at or c.unsubscribed_at
                ).isoformat()
                if (c.hard_bounced_at or c.spam_reported_at or c.unsubscribed_at)
                else None,
            }
            for c in consents
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/check-send")
async def check_can_send(
    email: str = Query(..., description="Email to check"),
    purpose: str = Query("transactional", description="Email purpose"),
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    """Check if an email can be sent to this address.

    Returns whether the email is blocked and the reason.
    Used before sending to prevent sending to suppressed addresses.
    """
    audit_service = EmailAuditService(db)

    try:
        purpose_enum = EmailPurpose(purpose)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid purpose. Valid values: {[p.value for p in EmailPurpose]}",
        )

    can_send, reason = await audit_service.can_send_email(email, purpose_enum)

    return {
        "email": email,
        "purpose": purpose,
        "can_send": can_send,
        "reason": reason,
    }
