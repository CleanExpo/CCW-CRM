"""Email generator for customer communications."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, OrderStatus, Quote, QuoteStatus
from src.utils import get_logger

from ..ollama_client import get_ollama_client

logger = get_logger(__name__)


class EmailGenerator:
    """Generator for customer email communications."""

    def __init__(self):
        self.ollama = get_ollama_client()

    async def generate_quote_follow_up(
        self,
        quote_id: str,
        tone: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Generate a quote follow-up email.

        Args:
            quote_id: Quote ID
            tone: Email tone (formal, friendly, urgent)
            db: Database session

        Returns:
            Generated email with subject and body
        """
        # Get quote data
        result = await db.execute(
            select(Quote).where(Quote.id == UUID(quote_id))
        )
        quote = result.scalar_one_or_none()

        if not quote:
            return {"error": "Quote not found"}

        # Get customer
        result = await db.execute(
            select(Customer).where(Customer.id == quote.customer_id)
        )
        customer = result.scalar_one_or_none()

        if not customer:
            return {"error": "Customer not found"}

        # Generate email
        system_prompt = self._get_tone_prompt(tone)

        user_prompt = f"""Generate a professional follow-up email for a quote.

Customer: {customer.company_name}
Contact: {customer.contact_name}
Quote Number: {quote.quote_number}
Quote Date: {quote.quote_date.strftime('%B %d, %Y')}
Total: ${float(quote.total):,.2f}
Valid Until: {quote.valid_until.strftime('%B %d, %Y') if quote.valid_until else 'N/A'}
Status: {quote.status.value}

Generate:
1. Subject line (clear and professional)
2. Email body (include greeting, reference to quote, call to action, closing)

Format as:
Subject: [subject line]

[email body]"""

        try:
            response = await self.ollama.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
            )

            # Parse response
            subject, body = self._parse_email(response)

            return {
                "subject": subject or f"Follow-up: Quote {quote.quote_number}",
                "body": body,
                "to": customer.email,
                "customer_name": customer.contact_name,
                "company_name": customer.company_name,
            }

        except Exception as e:
            logger.error(f"Error generating email", error=str(e))
            return self._fallback_quote_follow_up(quote, customer)

    async def generate_order_confirmation(
        self,
        order_id: str,
        tone: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Generate an order confirmation email.

        Args:
            order_id: Order ID
            tone: Email tone
            db: Database session

        Returns:
            Generated email
        """
        # Get order data
        result = await db.execute(
            select(Order).where(Order.id == UUID(order_id))
        )
        order = result.scalar_one_or_none()

        if not order:
            return {"error": "Order not found"}

        # Get customer
        result = await db.execute(
            select(Customer).where(Customer.id == order.customer_id)
        )
        customer = result.scalar_one_or_none()

        if not customer:
            return {"error": "Customer not found"}

        # Generate email
        system_prompt = self._get_tone_prompt(tone)

        user_prompt = f"""Generate a professional order confirmation email.

Customer: {customer.company_name}
Contact: {customer.contact_name}
Order Number: {order.order_number}
Order Date: {order.order_date.strftime('%B %d, %Y')}
Total: ${float(order.total):,.2f}
Status: {order.status.value}

Generate:
1. Subject line
2. Email body (confirmation, order details, next steps)

Format as:
Subject: [subject line]

[email body]"""

        try:
            response = await self.ollama.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
            )

            subject, body = self._parse_email(response)

            return {
                "subject": subject or f"Order Confirmation: {order.order_number}",
                "body": body,
                "to": customer.email,
                "customer_name": customer.contact_name,
                "company_name": customer.company_name,
            }

        except Exception as e:
            logger.error(f"Error generating email", error=str(e))
            return self._fallback_order_confirmation(order, customer)

    async def generate_custom_email(
        self,
        customer_id: str,
        purpose: str,
        context: str,
        tone: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Generate a custom email based on purpose and context.

        Args:
            customer_id: Customer ID
            purpose: Email purpose (introduction, follow_up, announcement, etc.)
            context: Additional context for the email
            tone: Email tone
            db: Database session

        Returns:
            Generated email
        """
        # Get customer
        result = await db.execute(
            select(Customer).where(Customer.id == UUID(customer_id))
        )
        customer = result.scalar_one_or_none()

        if not customer:
            return {"error": "Customer not found"}

        # Generate email
        system_prompt = self._get_tone_prompt(tone)

        user_prompt = f"""Generate a professional email for the following purpose.

Customer: {customer.company_name}
Contact: {customer.contact_name}
Purpose: {purpose}
Context: {context}

Generate:
1. Appropriate subject line
2. Email body tailored to the purpose

Format as:
Subject: [subject line]

[email body]"""

        try:
            response = await self.ollama.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
            )

            subject, body = self._parse_email(response)

            return {
                "subject": subject or f"Message from Equipment ERP",
                "body": body,
                "to": customer.email,
                "customer_name": customer.contact_name,
                "company_name": customer.company_name,
            }

        except Exception as e:
            logger.error(f"Error generating email", error=str(e))
            return {
                "error": f"Failed to generate email: {str(e)}",
            }

    def _get_tone_prompt(self, tone: str) -> str:
        """Get system prompt based on tone."""
        base_prompt = "You are a professional business email writer. "

        tone_prompts = {
            "formal": "Use formal, professional language. Be respectful and concise.",
            "friendly": "Use warm, approachable language while maintaining professionalism. Be conversational.",
            "urgent": "Convey urgency respectfully. Be clear about timelines and actions needed.",
        }

        return base_prompt + tone_prompts.get(tone, tone_prompts["formal"])

    def _parse_email(self, response: str) -> tuple[str, str]:
        """Parse subject and body from response."""
        lines = response.strip().split("\n")

        subject = ""
        body_lines = []
        in_body = False

        for line in lines:
            if line.startswith("Subject:"):
                subject = line.replace("Subject:", "").strip()
                in_body = True
            elif in_body:
                body_lines.append(line)

        body = "\n".join(body_lines).strip()

        return subject, body

    def _fallback_quote_follow_up(
        self, quote: Quote, customer: Customer
    ) -> dict[str, Any]:
        """Fallback quote follow-up email template."""
        subject = f"Follow-up: Quote {quote.quote_number}"

        body = f"""Dear {customer.contact_name},

I hope this email finds you well. I wanted to follow up on quote {quote.quote_number} that we sent on {quote.quote_date.strftime('%B %d, %Y')}.

The quote totals ${float(quote.total):,.2f} and is valid until {quote.valid_until.strftime('%B %d, %Y') if quote.valid_until else 'further notice'}.

If you have any questions or would like to proceed with this quote, please don't hesitate to reach out. We're here to help!

Best regards,
Equipment ERP Team"""

        return {
            "subject": subject,
            "body": body,
            "to": customer.email,
            "customer_name": customer.contact_name,
            "company_name": customer.company_name,
        }

    def _fallback_order_confirmation(
        self, order: Order, customer: Customer
    ) -> dict[str, Any]:
        """Fallback order confirmation email template."""
        subject = f"Order Confirmation: {order.order_number}"

        body = f"""Dear {customer.contact_name},

Thank you for your order! This email confirms your order {order.order_number} placed on {order.order_date.strftime('%B %d, %Y')}.

Order Total: ${float(order.total):,.2f}
Status: {order.status.value.replace('_', ' ').title()}

We'll keep you updated on the progress of your order. If you have any questions, please contact us.

Thank you for your business!

Best regards,
Equipment ERP Team"""

        return {
            "subject": subject,
            "body": body,
            "to": customer.email,
            "customer_name": customer.contact_name,
            "company_name": customer.company_name,
        }
