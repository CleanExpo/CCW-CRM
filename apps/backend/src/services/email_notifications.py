"""Email notification service for form submissions."""

import os
from typing import Optional
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import structlog

logger = structlog.get_logger(__name__)


class EmailNotificationService:
    """Service for sending email notifications."""

    def __init__(self):
        """Initialize the email service with SendGrid."""
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        self.from_email = os.getenv("NOTIFICATION_FROM_EMAIL", "notifications@ccwequipment.com")
        self.admin_email = os.getenv("ADMIN_NOTIFICATION_EMAIL", "admin@ccwequipment.com")

        if self.sendgrid_api_key:
            self.client = SendGridAPIClient(self.sendgrid_api_key)
            logger.info("Email notification service initialized", has_api_key=True)
        else:
            self.client = None
            logger.warning("SendGrid API key not found - email notifications disabled")

    def send_contact_submission_notification(
        self,
        submission_id: str,
        name: str,
        email: str,
        phone: Optional[str],
        subject: Optional[str],
        message: str,
        source: str,
        created_at: datetime,
    ) -> bool:
        """
        Send email notification for new contact submission.

        Args:
            submission_id: Unique ID of the submission
            name: Name of the person who submitted
            email: Email of the person who submitted
            phone: Phone number (optional)
            subject: Subject of the message (optional)
            message: The message content
            source: Source portal (walk-in, internet, phone, service)
            created_at: Timestamp of submission

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.client:
            logger.warning("Email notification skipped - SendGrid not configured")
            return False

        try:
            # Build email content
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #2563eb; margin-bottom: 20px;">🔔 New Contact Form Submission</h2>

                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="margin: 5px 0;"><strong>Submission ID:</strong> {submission_id}</p>
                            <p style="margin: 5px 0;"><strong>Submitted:</strong> {created_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                            <p style="margin: 5px 0;"><strong>Source:</strong> {source.upper()}</p>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <h3 style="color: #1e40af; margin-bottom: 10px;">Contact Information</h3>
                            <p style="margin: 5px 0;"><strong>Name:</strong> {name}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> {phone or 'Not provided'}</p>
                        </div>

                        {f'<div style="margin-bottom: 20px;"><h3 style="color: #1e40af; margin-bottom: 10px;">Subject</h3><p>{subject}</p></div>' if subject else ''}

                        <div style="margin-bottom: 20px;">
                            <h3 style="color: #1e40af; margin-bottom: 10px;">Message</h3>
                            <div style="background-color: #f1f5f9; padding: 15px; border-left: 4px solid #2563eb; border-radius: 4px;">
                                <p style="margin: 0; white-space: pre-wrap;">{message}</p>
                            </div>
                        </div>

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 5px 0; font-size: 14px; color: #64748b;">
                                This is an automated notification from CCW Equipment Portal.
                            </p>
                            <p style="margin: 5px 0; font-size: 14px; color: #64748b;">
                                <a href="http://localhost:3005/submissions" style="color: #2563eb; text-decoration: none;">View all submissions in admin dashboard →</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
            """

            # Create and send email
            message = Mail(
                from_email=Email(self.from_email),
                to_emails=To(self.admin_email),
                subject=f"New Contact Form: {subject or 'No Subject'} - {name}",
                html_content=Content("text/html", html_content),
            )

            response = self.client.send(message)

            if response.status_code in (200, 201, 202):
                logger.info(
                    "Contact submission notification sent",
                    submission_id=submission_id,
                    to_email=self.admin_email,
                    status_code=response.status_code,
                )
                return True
            else:
                logger.error(
                    "Failed to send contact submission notification",
                    submission_id=submission_id,
                    status_code=response.status_code,
                )
                return False

        except Exception as e:
            logger.error(
                "Error sending contact submission notification",
                submission_id=submission_id,
                error=str(e),
            )
            return False

    def send_demo_request_notification(
        self,
        request_id: str,
        company_name: str,
        contact_name: str,
        email: str,
        phone: str,
        product_interest: Optional[str],
        preferred_date: Optional[datetime],
        notes: Optional[str],
        created_at: datetime,
    ) -> bool:
        """
        Send email notification for new demo request.

        Args:
            request_id: Unique ID of the request
            company_name: Name of the company
            contact_name: Name of the contact person
            email: Email of the contact
            phone: Phone number
            product_interest: Products they're interested in (optional)
            preferred_date: Preferred demo date (optional)
            notes: Additional notes (optional)
            created_at: Timestamp of request

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.client:
            logger.warning("Email notification skipped - SendGrid not configured")
            return False

        try:
            # Build email content
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #ea580c; margin-bottom: 20px;">🎯 New Demo Request</h2>

                        <div style="background-color: #fff7ed; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #ea580c;">
                            <p style="margin: 5px 0;"><strong>🔥 HOT LEAD - Demo Request</strong></p>
                            <p style="margin: 5px 0;"><strong>Request ID:</strong> {request_id}</p>
                            <p style="margin: 5px 0;"><strong>Submitted:</strong> {created_at.strftime('%B %d, %Y at %I:%M %p')}</p>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <h3 style="color: #c2410c; margin-bottom: 10px;">Company Information</h3>
                            <p style="margin: 5px 0;"><strong>Company:</strong> {company_name}</p>
                            <p style="margin: 5px 0;"><strong>Contact:</strong> {contact_name}</p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:{email}" style="color: #ea580c;">{email}</a></p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:{phone}" style="color: #ea580c;">{phone}</a></p>
                        </div>

                        {f'<div style="margin-bottom: 20px;"><h3 style="color: #c2410c; margin-bottom: 10px;">Product Interest</h3><p style="background-color: #fef3c7; padding: 10px; border-radius: 4px;">{product_interest}</p></div>' if product_interest else ''}

                        {f'<div style="margin-bottom: 20px;"><h3 style="color: #c2410c; margin-bottom: 10px;">Preferred Demo Date</h3><p style="font-size: 16px; color: #ea580c;"><strong>📅 {preferred_date.strftime("%B %d, %Y")}</strong></p></div>' if preferred_date else ''}

                        {f'<div style="margin-bottom: 20px;"><h3 style="color: #c2410c; margin-bottom: 10px;">Additional Notes</h3><div style="background-color: #f1f5f9; padding: 15px; border-left: 4px solid #ea580c; border-radius: 4px;"><p style="margin: 0; white-space: pre-wrap;">{notes}</p></div></div>' if notes else ''}

                        <div style="margin-top: 30px; padding: 20px; background-color: #dcfce7; border-radius: 6px; text-align: center;">
                            <p style="margin: 0 0 10px 0; font-size: 16px; color: #166534;">
                                <strong>⚡ Action Required</strong>
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #15803d;">
                                Respond within 24 hours for best conversion rate
                            </p>
                        </div>

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 5px 0; font-size: 14px; color: #64748b;">
                                This is an automated notification from CCW Equipment Portal.
                            </p>
                            <p style="margin: 5px 0; font-size: 14px; color: #64748b;">
                                <a href="http://localhost:3005/submissions" style="color: #ea580c; text-decoration: none;">View all demo requests in admin dashboard →</a>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
            """

            # Create and send email
            message = Mail(
                from_email=Email(self.from_email),
                to_emails=To(self.admin_email),
                subject=f"🎯 New Demo Request - {company_name} ({contact_name})",
                html_content=Content("text/html", html_content),
            )

            response = self.client.send(message)

            if response.status_code in (200, 201, 202):
                logger.info(
                    "Demo request notification sent",
                    request_id=request_id,
                    to_email=self.admin_email,
                    status_code=response.status_code,
                )
                return True
            else:
                logger.error(
                    "Failed to send demo request notification",
                    request_id=request_id,
                    status_code=response.status_code,
                )
                return False

        except Exception as e:
            logger.error(
                "Error sending demo request notification",
                request_id=request_id,
                error=str(e),
            )
            return False


# Global instance
email_service = EmailNotificationService()
