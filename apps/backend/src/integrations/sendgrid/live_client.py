"""Live SendGrid client for real email sending."""

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


class SendGridLiveClient:
    """Real SendGrid API client for sending emails.

    Uses SendGrid's v3 API for transactional email sending.
    """

    def __init__(self, api_key: str, from_email: str, from_name: str) -> None:
        """Initialize live SendGrid client.

        Args:
            api_key: SendGrid API key
            from_email: Default sender email
            from_name: Default sender name
        """
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name
        self.base_url = "https://api.sendgrid.com/v3"
        logger.info("sendgrid_live_client_initialized", from_email=from_email)

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
        """Send an email via SendGrid API.

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
            Response with message ID and status

        Raises:
            httpx.HTTPError: If SendGrid API returns an error
        """
        sender_email = from_email or self.from_email
        sender_name = from_name or self.from_name

        # Build personalizations
        personalizations = [
            {
                "to": [{"email": to_email}],
            }
        ]

        if cc:
            personalizations[0]["cc"] = [{"email": email} for email in cc]

        if bcc:
            personalizations[0]["bcc"] = [{"email": email} for email in bcc]

        if template_data:
            personalizations[0]["dynamic_template_data"] = template_data

        # Build request payload
        payload: dict[str, Any] = {
            "personalizations": personalizations,
            "from": {
                "email": sender_email,
                "name": sender_name,
            },
            "subject": subject,
        }

        # Use template or content
        if template_id:
            payload["template_id"] = template_id
        else:
            content = []
            if body_text:
                content.append({"type": "text/plain", "value": body_text})
            if body_html:
                content.append({"type": "text/html", "value": body_html})
            payload["content"] = content

        # Add attachments if provided
        if attachments:
            payload["attachments"] = attachments

        # Send via SendGrid API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/mail/send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )

            response.raise_for_status()

            # SendGrid returns 202 Accepted with X-Message-Id header
            message_id = response.headers.get("X-Message-Id", "unknown")

            logger.info(
                "email_sent_via_sendgrid",
                message_id=message_id,
                to=to_email,
                subject=subject,
            )

            return {
                "success": True,
                "message_id": message_id,
                "status": "accepted",
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
        """Send bulk email to multiple recipients.

        Args:
            recipients: List of {email, name} dicts
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body (optional)
            from_email: Sender email (optional)
            from_name: Sender name (optional)

        Returns:
            Response with message IDs
        """
        sender_email = from_email or self.from_email
        sender_name = from_name or self.from_name

        # Build personalizations for each recipient
        personalizations = [
            {"to": [{"email": r["email"], "name": r.get("name", "")}]}
            for r in recipients
        ]

        # Build payload
        content = []
        if body_text:
            content.append({"type": "text/plain", "value": body_text})
        if body_html:
            content.append({"type": "text/html", "value": body_html})

        payload = {
            "personalizations": personalizations,
            "from": {
                "email": sender_email,
                "name": sender_name,
            },
            "subject": subject,
            "content": content,
        }

        # Send via SendGrid API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/mail/send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )

            response.raise_for_status()

            message_id = response.headers.get("X-Message-Id", "unknown")

            logger.info(
                "bulk_email_sent_via_sendgrid",
                message_id=message_id,
                recipient_count=len(recipients),
            )

            return {
                "success": True,
                "message_id": message_id,
                "sent_count": len(recipients),
            }

    async def get_email_status(self, message_id: str) -> dict[str, Any]:
        """Get email delivery status from SendGrid.

        Note: This requires SendGrid Event Webhook to be configured.
        This method queries the activity API which has limitations.

        Args:
            message_id: SendGrid message ID

        Returns:
            Status information
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/messages/{message_id}",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                    },
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message_id": message_id,
                        "status": data.get("status", "unknown"),
                        "events": data.get("events", []),
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Status code: {response.status_code}",
                    }

        except httpx.HTTPError as e:
            logger.error("failed_to_get_email_status", message_id=message_id, error=str(e))
            return {
                "success": False,
                "error": str(e),
            }
