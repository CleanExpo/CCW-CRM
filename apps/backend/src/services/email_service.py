"""Email service using SendGrid with comprehensive audit logging.

This service provides:
- Email sending via SendGrid API
- Automatic audit logging to EmailLog table
- Pre-send consent and suppression checks
- Delivery tracking support

ISS-037: Updated to include email audit trail for GDPR compliance.
"""

import uuid
from typing import Any

import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Content, CustomArg, Email, Mail, To
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings
from src.db.email_audit_models import EmailPurpose

logger = structlog.get_logger(__name__)


class EmailService:
    """Email service with audit logging for GDPR compliance.

    All emails sent through this service are automatically logged
    to the email_logs table for audit trail and delivery tracking.
    """

    def __init__(
        self,
        api_key: str | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
    ):
        """Initialize email service.

        Args:
            api_key: SendGrid API key (defaults to SENDGRID_API_KEY env var)
            from_email: Default sender email (defaults to SENDGRID_FROM_EMAIL env var)
            from_name: Default sender name (defaults to SENDGRID_FROM_NAME env var)
        """
        _s = get_settings()
        self.api_key = api_key or _s.sendgrid_api_key
        self.from_email = from_email or _s.sendgrid_from_email
        self.from_name = from_name or _s.sendgrid_from_name

        if not self.api_key:
            logger.warning("SendGrid API key not provided - emails will be logged only")
            self.client = None
        else:
            self.client = SendGridAPIClient(self.api_key)

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        to_name: str | None = None,
        *,
        # Audit logging parameters
        db: AsyncSession | None = None,
        purpose: EmailPurpose = EmailPurpose.TRANSACTIONAL,
        user_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        organization_id: uuid.UUID | None = None,
        related_entity_type: str | None = None,
        related_entity_id: uuid.UUID | None = None,
        consent_given: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send email via SendGrid with automatic audit logging.

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body
            text_content: Plain text body (optional)
            to_name: Recipient name (optional)
            db: Database session for audit logging (optional but recommended)
            purpose: Email purpose for GDPR classification
            user_id: ID of user sending the email
            customer_id: ID of customer recipient (if linked)
            organization_id: Organization context
            related_entity_type: Entity type that triggered email (order, quote, etc.)
            related_entity_id: ID of entity that triggered email
            consent_given: Whether marketing consent was given
            metadata: Additional metadata to log

        Returns:
            Dict with success status, message_id, and email_log_id
        """
        email_log = None
        email_log_id = None

        # Create audit log entry if database session provided
        if db:
            from src.services.email_audit_service import EmailAuditService

            audit_service = EmailAuditService(db)

            # Check if we can send to this address
            can_send, reason = await audit_service.can_send_email(to_email, purpose)
            if not can_send:
                logger.warning(
                    "email_blocked_by_suppression",
                    to_email=to_email,
                    reason=reason,
                    purpose=purpose.value,
                )
                return {
                    "success": False,
                    "error": f"Email blocked: {reason}",
                    "reason": reason,
                }

            # Create audit log entry
            email_log = await audit_service.create_email_log(
                recipient_email=to_email,
                recipient_name=to_name,
                from_email=self.from_email,
                from_name=self.from_name,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                purpose=purpose,
                user_id=user_id,
                customer_id=customer_id,
                organization_id=organization_id,
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                consent_given=consent_given,
                metadata=metadata,
            )
            email_log_id = email_log.id

        # If no SendGrid client, log only
        if not self.client:
            logger.info(
                "email_logged_no_sendgrid",
                to_email=to_email,
                subject=subject,
                email_log_id=str(email_log_id) if email_log_id else None,
            )

            if db and email_log:
                from src.services.email_audit_service import EmailAuditService

                audit_service = EmailAuditService(db)
                await audit_service.mark_email_failed(
                    email_log_id, "SendGrid not configured"
                )
                await db.commit()

            return {
                "success": False,
                "error": "SendGrid not configured",
                "email_log_id": str(email_log_id) if email_log_id else None,
            }

        try:
            # Build SendGrid message
            message = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email, to_name),
                subject=subject,
                html_content=Content("text/html", html_content),
            )

            if text_content:
                message.content = [
                    Content("text/plain", text_content),
                    Content("text/html", html_content),
                ]

            # Add custom args for webhook correlation
            if email_log_id:
                # SendGrid custom args are passed to webhooks
                message.custom_arg = CustomArg("email_log_id", str(email_log_id))

            # Send via SendGrid
            response = self.client.send(message)

            # Get SendGrid message ID from headers
            sendgrid_message_id = response.headers.get("X-Message-Id")

            logger.info(
                "email_sent",
                to_email=to_email,
                subject=subject,
                status_code=response.status_code,
                sendgrid_message_id=sendgrid_message_id,
                email_log_id=str(email_log_id) if email_log_id else None,
            )

            # Update audit log with SendGrid message ID
            if db and email_log and sendgrid_message_id:
                from src.services.email_audit_service import EmailAuditService

                audit_service = EmailAuditService(db)
                await audit_service.mark_email_sent(email_log_id, sendgrid_message_id)
                await db.commit()

            return {
                "success": response.status_code in [200, 201, 202],
                "status_code": response.status_code,
                "sendgrid_message_id": sendgrid_message_id,
                "email_log_id": str(email_log_id) if email_log_id else None,
            }

        except Exception as e:
            logger.error(
                "email_send_failed",
                to_email=to_email,
                subject=subject,
                error=str(e),
                email_log_id=str(email_log_id) if email_log_id else None,
            )

            # Update audit log with failure
            if db and email_log:
                from src.services.email_audit_service import EmailAuditService

                audit_service = EmailAuditService(db)
                await audit_service.mark_email_failed(email_log_id, str(e))
                await db.commit()

            return {
                "success": False,
                "error": str(e),
                "email_log_id": str(email_log_id) if email_log_id else None,
            }

    async def send_password_reset_email(
        self,
        to_email: str,
        to_name: str,
        reset_url: str,
        *,
        db: AsyncSession | None = None,
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Send password reset email.

        Args:
            to_email: Recipient email
            to_name: Recipient name
            reset_url: Password reset URL
            db: Database session for audit logging
            user_id: User ID requesting reset

        Returns:
            Send result
        """
        subject = "Reset Your Password - CCW ERP"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Password Reset</h1>
            <p>Hi {to_name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="margin: 30px 0;">
                <a href="{reset_url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Reset Password
                </a>
            </p>
            <p style="color: #666;">This link will expire in 1 hour.</p>
            <p style="color: #666;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">CCW Equipment ERP</p>
        </div>
        """
        text = f"Hi {to_name}, Reset your password: {reset_url} (Expires in 1 hour)"

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            to_name=to_name,
            db=db,
            purpose=EmailPurpose.SYSTEM,
            user_id=user_id,
            related_entity_type="password_reset",
        )

    async def send_magic_link_email(
        self,
        to_email: str,
        to_name: str,
        magic_link: str,
        *,
        db: AsyncSession | None = None,
        customer_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Send magic link login email.

        Args:
            to_email: Recipient email
            to_name: Recipient name
            magic_link: Magic link URL
            db: Database session for audit logging
            customer_id: Customer ID if portal user

        Returns:
            Send result
        """
        subject = "Your Login Link - CCW ERP Portal"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Portal Access</h1>
            <p>Hi {to_name},</p>
            <p>Click the button below to access your CCW Equipment portal:</p>
            <p style="margin: 30px 0;">
                <a href="{magic_link}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Access Portal
                </a>
            </p>
            <p style="color: #666;">This link will expire in 1 hour.</p>
            <p style="color: #666;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">CCW Equipment ERP</p>
        </div>
        """
        text = f"Hi {to_name}, Access your portal: {magic_link} (Expires in 1 hour)"

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            to_name=to_name,
            db=db,
            purpose=EmailPurpose.SYSTEM,
            customer_id=customer_id,
            related_entity_type="magic_link",
        )


# ============================================================
# Singleton Pattern
# ============================================================

_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    """Get or create email service singleton.

    Returns:
        EmailService instance
    """
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
