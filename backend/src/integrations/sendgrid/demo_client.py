"""Demo SendGrid client for testing without real email sending."""

import uuid
from datetime import datetime
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class SendGridDemoClient:
    """Mock SendGrid client that logs emails instead of sending them.

    Useful for development and testing without actually sending emails
    or consuming SendGrid API credits.
    """

    def __init__(self) -> None:
        """Initialize demo client."""
        self.sent_emails: list[dict[str, Any]] = []
        logger.info("sendgrid_demo_client_initialized")

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: str | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        attachments: list[dict[str, Any]] | None = None,
        template_id: str | None = None,
        template_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send an email (demo mode - just logs it).

        Args:
            to_email: Recipient email address
            subject: Email subject line
            body_text: Plain text email body
            body_html: HTML email body (optional)
            from_email: Sender email (optional, uses default)
            from_name: Sender name (optional, uses default)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
            attachments: List of attachments (optional)
            template_id: SendGrid template ID (optional)
            template_data: Template variable data (optional)

        Returns:
            Demo response with mock message ID
        """
        message_id = f"demo_msg_{uuid.uuid4().hex[:16]}"

        email_data = {
            "message_id": message_id,
            "to": to_email,
            "subject": subject,
            "from": from_email or "demo@ccwonline.com.au",
            "from_name": from_name or "CCW Equipment Demo",
            "body_text": body_text,
            "body_html": body_html,
            "cc": cc or [],
            "bcc": bcc or [],
            "attachments": attachments or [],
            "template_id": template_id,
            "template_data": template_data,
            "sent_at": datetime.utcnow().isoformat(),
            "status": "sent",
        }

        self.sent_emails.append(email_data)

        logger.info(
            "demo_email_sent",
            message_id=message_id,
            to=to_email,
            subject=subject,
            has_html=body_html is not None,
            has_template=template_id is not None,
        )

        return {
            "success": True,
            "message_id": message_id,
            "status": "sent",
            "timestamp": email_data["sent_at"],
        }

    async def send_bulk_email(
        self,
        recipients: list[dict[str, str]],
        subject: str,
        body_text: str,
        body_html: str | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
    ) -> dict[str, Any]:
        """Send bulk email to multiple recipients (demo mode).

        Args:
            recipients: List of {email, name} dicts
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body (optional)
            from_email: Sender email (optional)
            from_name: Sender name (optional)

        Returns:
            Demo response with list of message IDs
        """
        message_ids = []

        for recipient in recipients:
            result = await self.send_email(
                to_email=recipient["email"],
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                from_email=from_email,
                from_name=from_name,
            )
            message_ids.append(result["message_id"])

        logger.info(
            "demo_bulk_email_sent",
            recipient_count=len(recipients),
            message_ids_count=len(message_ids),
        )

        return {
            "success": True,
            "message_ids": message_ids,
            "sent_count": len(message_ids),
        }

    async def get_email_status(self, message_id: str) -> dict[str, Any]:
        """Get email delivery status (demo mode).

        Args:
            message_id: SendGrid message ID

        Returns:
            Mock status information
        """
        # Find email in sent list
        email = next(
            (e for e in self.sent_emails if e["message_id"] == message_id), None
        )

        if not email:
            return {
                "success": False,
                "error": "Message not found",
            }

        # Demo: simulate delivered status
        return {
            "success": True,
            "message_id": message_id,
            "status": "delivered",
            "events": [
                {
                    "event": "processed",
                    "timestamp": email["sent_at"],
                },
                {
                    "event": "delivered",
                    "timestamp": email["sent_at"],
                },
            ],
        }

    def get_demo_inbound_email(self, email_number: int = 1) -> dict[str, Any]:
        """Generate a demo inbound email payload.

        Simulates what SendGrid would send to our inbound webhook.

        Args:
            email_number: Email variation number

        Returns:
            Mock inbound email data
        """
        variations = [
            {
                "from": "customer1@example.com",
                "from_name": "John Smith",
                "subject": "Order Status Inquiry",
                "text": "Hi, I placed order #ORD-2026-001 last week. Can you please tell me when it will be shipped? Thanks!",  # noqa: E501
                "intent": "order_inquiry",
            },
            {
                "from": "customer2@example.com",
                "from_name": "Sarah Johnson",
                "subject": "Product Availability",
                "text": "Do you have the Makita cordless drill (SKU: DRL-001) in stock? I need 5 units. Please let me know pricing and delivery time.",  # noqa: E501
                "intent": "stock_check",
            },
            {
                "from": "customer3@example.com",
                "from_name": "Mike Brown",
                "subject": "Quote Request",
                "text": "I need a quote for 10x safety helmets and 20x safety vests for my construction site. Can you send me a quote with delivery options?",  # noqa: E501
                "intent": "quote_request",
            },
            {
                "from": "customer4@example.com",
                "from_name": "Lisa Chen",
                "subject": "Complaint - Wrong Item Delivered",
                "text": "I received the wrong item in my order #ORD-2026-003. I ordered a hammer but received a screwdriver. Please help resolve this urgently!",  # noqa: E501
                "intent": "complaint",
            },
            {
                "from": "customer5@example.com",
                "from_name": "David Wilson",
                "subject": "General Inquiry",
                "text": "What are your business hours? Do you offer installation services for heavy equipment?",  # noqa: E501
                "intent": "support",
            },
        ]

        # Cycle through variations
        variation = variations[(email_number - 1) % len(variations)]

        return {
            "headers": {
                "Message-ID": f"<demo-{uuid.uuid4().hex}@mail.example.com>",
                "From": f"{variation['from_name']} <{variation['from']}>",
                "To": "support@ccwonline.com.au",
                "Subject": variation["subject"],
                "Date": datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S +0000"),
            },
            "from": variation["from"],
            "to": "support@ccwonline.com.au",
            "subject": variation["subject"],
            "text": variation["text"],
            "html": f"<p>{variation['text']}</p>",
            "sender_ip": "192.168.1.100",
            "envelope": {
                "from": variation["from"],
                "to": ["support@ccwonline.com.au"],
            },
            "attachments": 0,
            "intent": variation["intent"],  # Not in real SendGrid, but useful for demo
        }

    def get_sent_emails(self) -> list[dict[str, Any]]:
        """Get all sent emails (demo mode only).

        Returns:
            List of all emails "sent" in demo mode
        """
        return self.sent_emails

    def clear_sent_emails(self) -> None:
        """Clear sent emails history (demo mode only)."""
        self.sent_emails = []
        logger.info("demo_sent_emails_cleared")
