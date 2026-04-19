"""
Notification service for automated customer communications.

Provides event-driven notifications via:
- Email (SendGrid)
- SMS (Twilio) - Future
- Push notifications - Future

Triggers automatically on:
- Order confirmed
- Order shipped
- Order delivered
- Quote created
- Quote expiring
- Service scheduled
- Service completed
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Any
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.db.demo_models import Customer, Order, Quote


class NotificationEvent(str, Enum):
    """Notification trigger events."""

    ORDER_CONFIRMED = "order_confirmed"
    ORDER_SHIPPED = "order_shipped"
    ORDER_DELIVERED = "order_delivered"
    ORDER_CANCELLED = "order_cancelled"

    QUOTE_CREATED = "quote_created"
    QUOTE_ACCEPTED = "quote_accepted"
    QUOTE_EXPIRING = "quote_expiring"

    SERVICE_QUOTED = "service_quoted"
    SERVICE_SCHEDULED = "service_scheduled"
    SERVICE_COMPLETED = "service_completed"


class NotificationChannel(str, Enum):
    """Notification delivery channels."""

    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"


class EmailNotification(BaseModel):
    """Email notification details."""

    to_email: str
    to_name: str
    subject: str
    html_body: str
    text_body: str | None = None
    from_email: str | None = None
    from_name: str | None = None
    reply_to: str | None = None


class NotificationService:
    """Service for sending automated customer notifications."""

    def __init__(self):
        """Initialize notification service."""
        self.settings = get_settings()
        self.sendgrid_api_key = self.settings.sendgrid_api_key
        self.from_email = self.settings.sendgrid_from_email
        self.from_name = self.settings.sendgrid_from_name
        self.portal_url = self.settings.frontend_url

        # Initialize Jinja2 template environment
        template_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "emails",
            "templates"
        )
        self.jinja_env = Environment(
            loader=FileSystemLoader(template_dir) if os.path.exists(template_dir) else FileSystemLoader("."),  # noqa: E501
            autoescape=select_autoescape(["html", "xml"]),
        )

    async def send_email(self, notification: EmailNotification) -> bool:
        """
        Send email notification via SendGrid.

        Args:
            notification: Email details

        Returns:
            True if sent successfully, False otherwise
        """
        if not self.sendgrid_api_key:
            print(f"[DEV MODE] Email would be sent to {notification.to_email}")
            print(f"Subject: {notification.subject}")
            print(f"Body preview: {notification.html_body[:200]}...")
            return True

        try:
            # In production, use SendGrid API
            # from sendgrid import SendGridAPIClient
            # from sendgrid.helpers.mail import Mail
            #
            # message = Mail(
            #     from_email=(notification.from_email or self.from_email, notification.from_name or self.from_name),  # noqa: E501
            #     to_emails=notification.to_email,
            #     subject=notification.subject,
            #     html_content=notification.html_body,
            #     plain_text_content=notification.text_body,
            # )
            #
            # sg = SendGridAPIClient(self.sendgrid_api_key)
            # response = sg.send(message)
            # return response.status_code == 202

            # For now, log to console
            print(f"[EMAIL] To: {notification.to_email}, Subject: {notification.subject}")
            return True

        except Exception as e:
            print(f"Error sending email: {e}")
            return False

    def _render_template(self, template_name: str, context: dict[str, Any]) -> str:
        """
        Render email template with context.

        Args:
            template_name: Template file name (e.g., "order_confirmed.html")
            context: Template variables

        Returns:
            Rendered HTML
        """
        try:
            template = self.jinja_env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            # Fallback to simple HTML if template not found
            print(f"Template error: {e}. Using fallback.")
            return self._fallback_template(context)

    def _fallback_template(self, context: dict[str, Any]) -> str:
        """Simple fallback HTML template."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>CCW Equipment</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">{context.get('title', 'Notification')}</h1>
            <p>Hi {context.get('customer_name', 'Customer')},</p>
            <p>{context.get('message', 'This is an automated notification from CCW Equipment.')}</p>
            <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
                {context.get('details_html', '')}
            </div>
            <p>If you have any questions, please contact us at support@ccw.com.au</p>
            <hr style="border: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
                This is an automated message from CCW Equipment. Please do not reply to this email.
            </p>
        </body>
        </html>
        """  # noqa: E501

    # Event-specific notification methods

    async def on_order_confirmed(
        self,
        order_id: UUID,
        db: AsyncSession,
    ) -> bool:
        """
        Send notification when order is confirmed.

        Args:
            order_id: Order ID
            db: Database session

        Returns:
            True if notification sent successfully
        """
        # Fetch order with customer details
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            return False

        customer_result = await db.execute(
            select(Customer).where(Customer.id == order.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if not customer:
            return False

        # Prepare template context
        context = {
            "title": "Order Confirmed",
            "customer_name": customer.contact_name or customer.company_name,
            "order_number": order.order_number,
            "order_date": order.order_date.strftime("%d/%m/%Y") if order.order_date else "N/A",
            "total": f"${order.total:,.2f}" if order.total else "$0.00",
            "order_url": f"{self.portal_url}/portal/orders/{order.id}",
            "message": f"Your order {order.order_number} has been confirmed and is being processed.",  # noqa: E501
            "details_html": f"""
                <p><strong>Order Number:</strong> {order.order_number}</p>
                <p><strong>Order Date:</strong> {order.order_date.strftime("%d/%m/%Y") if order.order_date else "N/A"}</p>
                <p><strong>Total Amount:</strong> ${order.total:,.2f} (inc. GST)</p>
                <p><a href="{self.portal_url}/portal/orders/{order.id}" style="color: #007bff;">View Order Details</a></p>
            """,  # noqa: E501
        }

        html_body = self._render_template("order_confirmed.html", context)

        notification = EmailNotification(
            to_email=customer.email,
            to_name=customer.contact_name or customer.company_name,
            subject=f"Order Confirmed - {order.order_number}",
            html_body=html_body,
            from_email=self.from_email,
            from_name=self.from_name,
        )

        return await self.send_email(notification)

    async def on_order_shipped(
        self,
        order_id: UUID,
        db: AsyncSession,
    ) -> bool:
        """Send notification when order is shipped."""
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            return False

        customer_result = await db.execute(
            select(Customer).where(Customer.id == order.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if not customer:
            return False

        context = {
            "title": "Order Shipped",
            "customer_name": customer.contact_name or customer.company_name,
            "order_number": order.order_number,
            "tracking_number": order.tracking_number or "Not available",
            "carrier_name": order.carrier_name or "N/A",
            "estimated_delivery": order.estimated_delivery_date.strftime("%d/%m/%Y") if order.estimated_delivery_date else "TBD",  # noqa: E501
            "tracking_url": f"{self.portal_url}/portal/orders/{order.id}/tracking",
            "message": f"Your order {order.order_number} has been shipped!",
            "details_html": f"""
                <p><strong>Tracking Number:</strong> {order.tracking_number or "Not available"}</p>
                <p><strong>Carrier:</strong> {order.carrier_name or "N/A"}</p>
                <p><strong>Estimated Delivery:</strong> {order.estimated_delivery_date.strftime("%d/%m/%Y") if order.estimated_delivery_date else "TBD"}</p>
                <p><a href="{self.portal_url}/portal/orders/{order.id}/tracking" style="color: #007bff;">Track Your Package</a></p>
            """,  # noqa: E501
        }

        html_body = self._render_template("order_shipped.html", context)

        notification = EmailNotification(
            to_email=customer.email,
            to_name=customer.contact_name or customer.company_name,
            subject=f"Order Shipped - {order.order_number}",
            html_body=html_body,
        )

        return await self.send_email(notification)

    async def on_order_delivered(
        self,
        order_id: UUID,
        db: AsyncSession,
    ) -> bool:
        """Send notification when order is delivered."""
        result = await db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            return False

        customer_result = await db.execute(
            select(Customer).where(Customer.id == order.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if not customer:
            return False

        context = {
            "title": "Order Delivered",
            "customer_name": customer.contact_name or customer.company_name,
            "order_number": order.order_number,
            "message": f"Your order {order.order_number} has been delivered!",
            "details_html": f"""
                <p>Thank you for your business. We hope you're satisfied with your purchase.</p>
                <p><a href="{self.portal_url}/portal/orders/{order.id}" style="color: #007bff;">View Order</a></p>
            """,  # noqa: E501
        }

        html_body = self._render_template("order_delivered.html", context)

        notification = EmailNotification(
            to_email=customer.email,
            to_name=customer.contact_name or customer.company_name,
            subject=f"Order Delivered - {order.order_number}",
            html_body=html_body,
        )

        return await self.send_email(notification)

    async def on_quote_created(
        self,
        quote_id: UUID,
        db: AsyncSession,
    ) -> bool:
        """Send notification when quote is created."""
        result = await db.execute(
            select(Quote).where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()
        if not quote:
            return False

        customer_result = await db.execute(
            select(Customer).where(Customer.id == quote.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if not customer:
            return False

        context = {
            "title": "Quote Ready",
            "customer_name": customer.contact_name or customer.company_name,
            "quote_number": quote.quote_number,
            "quote_date": quote.quote_date.strftime("%d/%m/%Y") if quote.quote_date else "N/A",
            "valid_until": quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else "N/A",
            "total": f"${quote.total:,.2f}" if quote.total else "$0.00",
            "quote_url": f"{self.portal_url}/portal/quotes/{quote.id}",
            "message": f"Your quote {quote.quote_number} is ready for review.",
            "details_html": f"""
                <p><strong>Quote Number:</strong> {quote.quote_number}</p>
                <p><strong>Total Amount:</strong> ${quote.total:,.2f} (inc. GST)</p>
                <p><strong>Valid Until:</strong> {quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else "N/A"}</p>
                <p><a href="{self.portal_url}/portal/quotes/{quote.id}" style="color: #007bff;">View Quote</a></p>
            """,  # noqa: E501
        }

        html_body = self._render_template("quote_created.html", context)

        notification = EmailNotification(
            to_email=customer.email,
            to_name=customer.contact_name or customer.company_name,
            subject=f"Quote Ready - {quote.quote_number}",
            html_body=html_body,
        )

        return await self.send_email(notification)

    async def on_quote_expiring(
        self,
        quote_id: UUID,
        db: AsyncSession,
    ) -> bool:
        """Send notification when quote is about to expire (3 days before)."""
        result = await db.execute(
            select(Quote).where(Quote.id == quote_id)
        )
        quote = result.scalar_one_or_none()
        if not quote:
            return False

        customer_result = await db.execute(
            select(Customer).where(Customer.id == quote.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if not customer:
            return False

        days_remaining = (quote.valid_until - datetime.now()).days if quote.valid_until else 0

        context = {
            "title": "Quote Expiring Soon",
            "customer_name": customer.contact_name or customer.company_name,
            "quote_number": quote.quote_number,
            "valid_until": quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else "N/A",
            "days_remaining": days_remaining,
            "total": f"${quote.total:,.2f}" if quote.total else "$0.00",
            "quote_url": f"{self.portal_url}/portal/quotes/{quote.id}",
            "message": f"Your quote {quote.quote_number} will expire in {days_remaining} days.",
            "details_html": f"""
                <p><strong>Quote Number:</strong> {quote.quote_number}</p>
                <p><strong>Expires:</strong> {quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else "N/A"} ({days_remaining} days)</p>
                <p><strong>Total Amount:</strong> ${quote.total:,.2f} (inc. GST)</p>
                <p><a href="{self.portal_url}/portal/quotes/{quote.id}" style="color: #007bff; background-color: #ffc107; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Quote Now</a></p>
            """,  # noqa: E501
        }

        html_body = self._render_template("quote_expiring.html", context)

        notification = EmailNotification(
            to_email=customer.email,
            to_name=customer.contact_name or customer.company_name,
            subject=f"Quote Expiring Soon - {quote.quote_number}",
            html_body=html_body,
        )

        return await self.send_email(notification)

    async def check_expiring_quotes(self, db: AsyncSession) -> int:
        """
        Check for quotes expiring in 3 days and send notifications.

        This method should be called by a scheduled job (Vercel cron).

        Returns:
            Number of notifications sent
        """
        three_days_from_now = datetime.now() + timedelta(days=3)
        end_of_day = three_days_from_now.replace(hour=23, minute=59, second=59)

        # Find quotes expiring in 3 days that are still pending/sent
        result = await db.execute(
            select(Quote)
            .where(Quote.status.in_(["pending", "sent"]))
            .where(Quote.valid_until <= end_of_day)
            .where(Quote.valid_until >= datetime.now())
        )
        expiring_quotes = result.scalars().all()

        count = 0
        for quote in expiring_quotes:
            success = await self.on_quote_expiring(quote.id, db)
            if success:
                count += 1

        return count


# Singleton instance
_notification_service: NotificationService | None = None


def get_notification_service() -> NotificationService:
    """Get or create notification service singleton."""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
