"""Email Audit Service for GDPR compliance and email tracking.

This service provides:
- Centralized email sending with automatic audit logging
- Delivery tracking via SendGrid webhooks
- GDPR data export for customer email history
- Consent management for marketing emails
- Suppression list management (bounces, unsubscribes, spam reports)

ISS-037: Email audit trail implementation
"""

import re
import uuid
from datetime import UTC, datetime
from html import unescape
from typing import Any

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.email_audit_models import (
    EmailConsent,
    EmailLog,
    EmailPurpose,
    EmailStatus,
)

logger = structlog.get_logger(__name__)


def strip_html_tags(html: str) -> str:
    """Remove HTML tags and convert to plain text."""
    if not html:
        return ""
    # Remove style and script tags with their content
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    # Remove remaining HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Convert HTML entities
    text = unescape(text)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


class EmailAuditService:
    """Service for managing email audit trail and GDPR compliance.

    This service wraps email sending to provide:
    - Automatic logging of all emails to EmailLog table
    - Pre-send consent and suppression checks
    - Post-send delivery tracking via webhooks
    - GDPR data export capabilities
    """

    def __init__(self, db: AsyncSession):
        """Initialize the email audit service.

        Args:
            db: Async database session
        """
        self.db = db

    # ================================================================
    # Email Logging
    # ================================================================

    async def create_email_log(
        self,
        *,
        recipient_email: str,
        recipient_name: str | None,
        from_email: str,
        from_name: str | None,
        subject: str,
        html_content: str | None,
        text_content: str | None = None,
        template_id: str | None = None,
        purpose: EmailPurpose = EmailPurpose.TRANSACTIONAL,
        user_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        organization_id: uuid.UUID | None = None,
        related_entity_type: str | None = None,
        related_entity_id: uuid.UUID | None = None,
        consent_given: bool = False,
        consent_timestamp: datetime | None = None,
        consent_source: str | None = None,
        reply_to: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> EmailLog:
        """Create an email log entry before sending.

        This should be called BEFORE attempting to send the email.
        The log will be updated with SendGrid message ID after sending.

        Args:
            recipient_email: Email recipient
            recipient_name: Recipient display name
            from_email: Sender email
            from_name: Sender display name
            subject: Email subject
            html_content: HTML email body
            text_content: Plain text body (auto-generated from HTML if not provided)
            template_id: SendGrid template ID or internal template name
            purpose: Email purpose for GDPR classification
            user_id: Internal user who sent it
            customer_id: Customer recipient (if linked)
            organization_id: Organization context
            related_entity_type: Entity type that triggered email (order, quote, etc.)
            related_entity_id: Entity ID that triggered email
            consent_given: Whether marketing consent was given
            consent_timestamp: When consent was given
            consent_source: Where consent was given
            reply_to: Reply-to email address
            metadata: Additional custom metadata

        Returns:
            Created EmailLog instance
        """
        # Auto-generate text content from HTML if not provided
        if not text_content and html_content:
            text_content = strip_html_tags(html_content)

        email_log = EmailLog(
            recipient_email=recipient_email.lower().strip(),
            recipient_name=recipient_name,
            from_email=from_email.lower().strip(),
            from_name=from_name,
            reply_to=reply_to,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            template_id=template_id,
            status=EmailStatus.QUEUED.value,
            purpose=purpose.value,
            user_id=user_id,
            customer_id=customer_id,
            organization_id=organization_id,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            consent_given=consent_given,
            consent_timestamp=consent_timestamp,
            consent_source=consent_source,
            extra_metadata=metadata,
        )

        self.db.add(email_log)
        await self.db.flush()

        logger.info(
            "email_log_created",
            email_log_id=str(email_log.id),
            recipient=recipient_email,
            subject=subject[:50],
            purpose=purpose.value,
        )

        return email_log

    async def mark_email_sent(
        self,
        email_log_id: uuid.UUID,
        sendgrid_message_id: str,
    ) -> EmailLog | None:
        """Mark an email as sent with SendGrid message ID.

        Args:
            email_log_id: The email log record ID
            sendgrid_message_id: SendGrid's X-Message-Id header value

        Returns:
            Updated EmailLog or None if not found
        """
        result = await self.db.execute(
            select(EmailLog).where(EmailLog.id == email_log_id)
        )
        email_log = result.scalar_one_or_none()

        if not email_log:
            logger.warning("email_log_not_found", email_log_id=str(email_log_id))
            return None

        email_log.sendgrid_message_id = sendgrid_message_id
        email_log.status = EmailStatus.SENT.value
        email_log.sent_at = datetime.now(UTC)

        await self.db.flush()

        logger.info(
            "email_marked_sent",
            email_log_id=str(email_log_id),
            sendgrid_message_id=sendgrid_message_id,
        )

        return email_log

    async def mark_email_failed(
        self,
        email_log_id: uuid.UUID,
        error_message: str,
        error_code: str | None = None,
    ) -> EmailLog | None:
        """Mark an email as failed to send.

        Args:
            email_log_id: The email log record ID
            error_message: Error description
            error_code: Error code if available

        Returns:
            Updated EmailLog or None if not found
        """
        result = await self.db.execute(
            select(EmailLog).where(EmailLog.id == email_log_id)
        )
        email_log = result.scalar_one_or_none()

        if not email_log:
            logger.warning("email_log_not_found", email_log_id=str(email_log_id))
            return None

        email_log.status = EmailStatus.FAILED.value
        email_log.error_message = error_message
        email_log.error_code = error_code

        await self.db.flush()

        logger.error(
            "email_marked_failed",
            email_log_id=str(email_log_id),
            error_message=error_message,
            error_code=error_code,
        )

        return email_log

    # ================================================================
    # Webhook Event Processing
    # ================================================================

    async def process_sendgrid_event(
        self,
        event: dict[str, Any],
    ) -> bool:
        """Process a SendGrid webhook event.

        Updates email log with delivery status from SendGrid events.

        Args:
            event: SendGrid event payload

        Returns:
            True if event was processed, False otherwise
        """
        event_type = event.get("event", "").lower()
        sg_message_id = event.get("sg_message_id") or event.get("smtp-id")
        timestamp_value = event.get("timestamp")

        # Parse timestamp
        if timestamp_value:
            if isinstance(timestamp_value, int | float):
                event_time = datetime.fromtimestamp(timestamp_value, tz=UTC)
            else:
                event_time = datetime.now(UTC)
        else:
            event_time = datetime.now(UTC)

        if not sg_message_id:
            # Try to extract from custom args
            custom_args = event.get("category", [])
            if isinstance(custom_args, list) and len(custom_args) > 0:
                # Check if email_log_id was passed as category
                pass
            logger.warning("sendgrid_event_no_message_id", event_data=event)
            return False

        # Clean up message ID (SendGrid sometimes includes angle brackets)
        sg_message_id = sg_message_id.strip("<>")

        # Find email log by SendGrid message ID
        result = await self.db.execute(
            select(EmailLog).where(EmailLog.sendgrid_message_id == sg_message_id)
        )
        email_log = result.scalar_one_or_none()

        if not email_log:
            logger.info(
                "sendgrid_event_no_matching_log",
                sg_message_id=sg_message_id,
                event_type=event_type,
            )
            return False

        # Update based on event type
        updated = True

        if event_type == "processed":
            # Email was processed by SendGrid
            pass  # Status already set to SENT

        elif event_type == "delivered":
            email_log.status = EmailStatus.DELIVERED.value
            email_log.delivered_at = event_time

        elif event_type == "open":
            email_log.open_count += 1
            if not email_log.opened_at:
                email_log.opened_at = event_time
                email_log.status = EmailStatus.OPENED.value

        elif event_type == "click":
            email_log.click_count += 1
            if not email_log.clicked_at:
                email_log.clicked_at = event_time
                email_log.status = EmailStatus.CLICKED.value

        elif event_type == "bounce":
            bounce_type = event.get("type", "")
            if bounce_type == "bounce":
                email_log.status = EmailStatus.BOUNCED.value
            else:
                email_log.status = EmailStatus.SOFT_BOUNCED.value
            email_log.bounced_at = event_time
            email_log.error_message = event.get("reason", "")
            email_log.error_code = event.get("status", "")

            # Update consent record for hard bounces
            if bounce_type == "bounce":
                await self._update_consent_bounce(email_log.recipient_email)

        elif event_type == "dropped":
            email_log.status = EmailStatus.DROPPED.value
            email_log.error_message = event.get("reason", "")

        elif event_type == "deferred":
            email_log.status = EmailStatus.DEFERRED.value
            email_log.error_message = event.get("response", "")

        elif event_type == "spamreport":
            email_log.status = EmailStatus.SPAM_REPORT.value
            email_log.spam_reported_at = event_time

            # Update consent record
            await self._update_consent_spam_report(email_log.recipient_email)

        elif event_type == "unsubscribe":
            email_log.status = EmailStatus.UNSUBSCRIBED.value
            email_log.unsubscribed_at = event_time

            # Update consent record
            await self._update_consent_unsubscribe(email_log.recipient_email)

        else:
            logger.info("sendgrid_event_unknown_type", event_type=event_type)
            updated = False

        if updated:
            await self.db.flush()
            logger.info(
                "sendgrid_event_processed",
                email_log_id=str(email_log.id),
                event_type=event_type,
                status=email_log.status,
            )

        return updated

    # ================================================================
    # Consent Management
    # ================================================================

    async def get_or_create_consent(self, email: str) -> EmailConsent:
        """Get or create consent record for an email address.

        Args:
            email: Email address

        Returns:
            EmailConsent record
        """
        email_lower = email.lower().strip()

        result = await self.db.execute(
            select(EmailConsent).where(EmailConsent.email == email_lower)
        )
        consent = result.scalar_one_or_none()

        if consent:
            return consent

        # Create new consent record
        consent = EmailConsent(email=email_lower)
        self.db.add(consent)
        await self.db.flush()

        return consent

    async def can_send_email(
        self,
        email: str,
        purpose: EmailPurpose,
    ) -> tuple[bool, str]:
        """Check if an email can be sent to this address.

        Args:
            email: Recipient email
            purpose: Email purpose

        Returns:
            Tuple of (can_send, reason)
        """
        consent = await self.get_or_create_consent(email)

        if consent.hard_bounced:
            return False, "hard_bounced"

        if consent.spam_reported:
            return False, "spam_reported"

        if purpose == EmailPurpose.MARKETING:
            if consent.unsubscribed:
                return False, "unsubscribed"
            if not consent.marketing_consent:
                return False, "no_marketing_consent"

        return True, "ok"

    async def update_marketing_consent(
        self,
        email: str,
        consent_given: bool,
        source: str,
        customer_id: uuid.UUID | None = None,
    ) -> EmailConsent:
        """Update marketing consent for an email address.

        Args:
            email: Email address
            consent_given: Whether consent is given
            source: Source of consent (signup, portal, etc.)
            customer_id: Optional customer ID

        Returns:
            Updated EmailConsent record
        """
        consent = await self.get_or_create_consent(email)

        consent.marketing_consent = consent_given
        consent.marketing_consent_at = datetime.now(UTC)
        consent.marketing_consent_source = source

        if customer_id:
            consent.customer_id = customer_id

        if consent_given and consent.unsubscribed:
            # Re-subscribing clears unsubscribe
            consent.unsubscribed = False
            consent.unsubscribed_at = None

        await self.db.flush()

        logger.info(
            "marketing_consent_updated",
            email=email,
            consent=consent_given,
            source=source,
        )

        return consent

    async def _update_consent_bounce(self, email: str) -> None:
        """Update consent record for a hard bounce."""
        consent = await self.get_or_create_consent(email)
        consent.hard_bounced = True
        consent.hard_bounced_at = datetime.now(UTC)
        consent.bounce_count += 1
        await self.db.flush()

    async def _update_consent_spam_report(self, email: str) -> None:
        """Update consent record for a spam report."""
        consent = await self.get_or_create_consent(email)
        consent.spam_reported = True
        consent.spam_reported_at = datetime.now(UTC)
        # Also revoke marketing consent
        consent.marketing_consent = False
        await self.db.flush()

    async def _update_consent_unsubscribe(
        self, email: str, reason: str | None = None
    ) -> None:
        """Update consent record for an unsubscribe."""
        consent = await self.get_or_create_consent(email)
        consent.unsubscribed = True
        consent.unsubscribed_at = datetime.now(UTC)
        consent.unsubscribe_reason = reason
        # Revoke marketing consent
        consent.marketing_consent = False
        await self.db.flush()

    # ================================================================
    # Email History & GDPR Export
    # ================================================================

    async def get_email_history(
        self,
        *,
        email: str | None = None,
        customer_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        purpose: EmailPurpose | None = None,
        status: EmailStatus | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        """Get email history with filters.

        Args:
            email: Filter by recipient email
            customer_id: Filter by customer ID
            user_id: Filter by sending user ID
            purpose: Filter by email purpose
            status: Filter by delivery status
            start_date: Filter emails after this date
            end_date: Filter emails before this date
            page: Page number (1-indexed)
            page_size: Results per page

        Returns:
            Dict with emails list and pagination info
        """
        query = select(EmailLog).order_by(EmailLog.created_at.desc())

        # Apply filters
        if email:
            query = query.where(EmailLog.recipient_email == email.lower().strip())
        if customer_id:
            query = query.where(EmailLog.customer_id == customer_id)
        if user_id:
            query = query.where(EmailLog.user_id == user_id)
        if purpose:
            query = query.where(EmailLog.purpose == purpose.value)
        if status:
            query = query.where(EmailLog.status == status.value)
        if start_date:
            query = query.where(EmailLog.created_at >= start_date)
        if end_date:
            query = query.where(EmailLog.created_at <= end_date)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.limit(page_size).offset(offset)

        result = await self.db.execute(query)
        emails = result.scalars().all()

        return {
            "emails": [
                {
                    "id": str(e.id),
                    "recipient_email": e.recipient_email,
                    "recipient_name": e.recipient_name,
                    "subject": e.subject,
                    "status": e.status,
                    "purpose": e.purpose,
                    "sent_at": e.sent_at.isoformat() if e.sent_at else None,
                    "delivered_at": e.delivered_at.isoformat() if e.delivered_at else None,
                    "opened_at": e.opened_at.isoformat() if e.opened_at else None,
                    "open_count": e.open_count,
                    "click_count": e.click_count,
                    "error_message": e.error_message,
                    "created_at": e.created_at.isoformat(),
                }
                for e in emails
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_gdpr_export(
        self,
        *,
        email: str | None = None,
        customer_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Export all email data for GDPR data portability request.

        Args:
            email: Recipient email address
            customer_id: Customer ID

        Returns:
            Complete email history in GDPR-compliant format
        """
        query = select(EmailLog).order_by(EmailLog.created_at.asc())

        if email:
            query = query.where(EmailLog.recipient_email == email.lower().strip())
        elif customer_id:
            query = query.where(EmailLog.customer_id == customer_id)
        else:
            raise ValueError("Either email or customer_id must be provided")

        result = await self.db.execute(query)
        emails = result.scalars().all()

        # Get consent record
        if email:
            consent_result = await self.db.execute(
                select(EmailConsent).where(EmailConsent.email == email.lower().strip())
            )
        else:
            consent_result = await self.db.execute(
                select(EmailConsent).where(EmailConsent.customer_id == customer_id)
            )
        consent = consent_result.scalar_one_or_none()

        return {
            "export_date": datetime.now(UTC).isoformat(),
            "export_type": "gdpr_data_portability",
            "email_address": email,
            "customer_id": str(customer_id) if customer_id else None,
            "consent_status": (
                {
                    "marketing_consent": consent.marketing_consent,
                    "marketing_consent_date": (
                        consent.marketing_consent_at.isoformat()
                        if consent.marketing_consent_at
                        else None
                    ),
                    "unsubscribed": consent.unsubscribed,
                    "unsubscribe_date": (
                        consent.unsubscribed_at.isoformat()
                        if consent.unsubscribed_at
                        else None
                    ),
                }
                if consent
                else None
            ),
            "total_emails": len(emails),
            "emails": [e.to_gdpr_export() for e in emails],
        }

    # ================================================================
    # Analytics & Reporting
    # ================================================================

    async def get_email_stats(
        self,
        *,
        organization_id: uuid.UUID | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """Get email delivery statistics.

        Args:
            organization_id: Filter by organization
            start_date: Start of date range
            end_date: End of date range

        Returns:
            Email statistics summary
        """
        base_query = select(EmailLog)

        if organization_id:
            base_query = base_query.where(EmailLog.organization_id == organization_id)
        if start_date:
            base_query = base_query.where(EmailLog.created_at >= start_date)
        if end_date:
            base_query = base_query.where(EmailLog.created_at <= end_date)

        # Total count
        total_result = await self.db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total = total_result.scalar() or 0

        # Status breakdown
        status_query = (
            select(EmailLog.status, func.count(EmailLog.id))
            .group_by(EmailLog.status)
        )
        if organization_id:
            status_query = status_query.where(EmailLog.organization_id == organization_id)
        if start_date:
            status_query = status_query.where(EmailLog.created_at >= start_date)
        if end_date:
            status_query = status_query.where(EmailLog.created_at <= end_date)

        status_result = await self.db.execute(status_query)
        status_counts = {row[0]: row[1] for row in status_result.all()}

        # Calculate rates
        sent_count = sum(
            status_counts.get(s.value, 0)
            for s in [
                EmailStatus.SENT,
                EmailStatus.DELIVERED,
                EmailStatus.OPENED,
                EmailStatus.CLICKED,
            ]
        )

        delivered_count = sum(
            status_counts.get(s.value, 0)
            for s in [EmailStatus.DELIVERED, EmailStatus.OPENED, EmailStatus.CLICKED]
        )

        opened_count = sum(
            status_counts.get(s.value, 0)
            for s in [EmailStatus.OPENED, EmailStatus.CLICKED]
        )

        clicked_count = status_counts.get(EmailStatus.CLICKED.value, 0)

        bounced_count = (
            status_counts.get(EmailStatus.BOUNCED.value, 0)
            + status_counts.get(EmailStatus.SOFT_BOUNCED.value, 0)
        )

        return {
            "total": total,
            "status_breakdown": status_counts,
            "sent": sent_count,
            "delivered": delivered_count,
            "opened": opened_count,
            "clicked": clicked_count,
            "bounced": bounced_count,
            "spam_reports": status_counts.get(EmailStatus.SPAM_REPORT.value, 0),
            "unsubscribes": status_counts.get(EmailStatus.UNSUBSCRIBED.value, 0),
            "delivery_rate": (delivered_count / sent_count * 100) if sent_count > 0 else 0,
            "open_rate": (opened_count / delivered_count * 100) if delivered_count > 0 else 0,
            "click_rate": (clicked_count / opened_count * 100) if opened_count > 0 else 0,
            "bounce_rate": (bounced_count / sent_count * 100) if sent_count > 0 else 0,
        }
