"""Email processing logic for classifying and responding to emails."""

import hashlib
import re
import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, Product
from src.db.email_models import EmailConversation, EmailMessage
from src.integrations.sendgrid.client import SendGridClient

logger = structlog.get_logger(__name__)


class EmailProcessor:
    """Process incoming emails and generate appropriate responses."""

    def __init__(self, db: AsyncSession, sendgrid_client: SendGridClient) -> None:
        """Initialize email processor.

        Args:
            db: Database session
            sendgrid_client: SendGrid client for sending responses
        """
        self.db = db
        self.sendgrid_client = sendgrid_client

    async def process_inbound_email(self, email_data: dict[str, Any]) -> dict[str, Any]:
        """Process an inbound email from SendGrid webhook.

        Args:
            email_data: Email data from SendGrid inbound parse webhook

        Returns:
            Processing result with conversation_id and response_sent
        """
        logger.info(
            "processing_inbound_email",
            from_email=email_data.get("from"),
            subject=email_data.get("subject"),
        )

        # Extract email details
        from_email = email_data.get("from", "").lower()
        subject = email_data.get("subject", "No Subject")
        body_text = email_data.get("text", "")
        body_html = email_data.get("html")
        message_id = email_data.get("headers", {}).get("Message-ID", f"<{uuid.uuid4()}@unknown>")

        # Extract name from "Name <email@example.com>" format
        from_name = None
        if "<" in from_email:
            match = re.match(r"(.+?)\s*<(.+?)>", from_email)
            if match:
                from_name = match.group(1).strip()
                from_email = match.group(2).strip()

        # Find or create conversation thread
        thread_id = self._generate_thread_id(from_email, subject)
        conversation = await self._get_or_create_conversation(
            thread_id=thread_id,
            customer_email=from_email,
            customer_name=from_name,
            subject=subject,
        )

        # Save inbound message
        inbound_message = await self._save_inbound_message(
            conversation_id=conversation.id,
            message_id=message_id,
            from_email=from_email,
            from_name=from_name,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )

        # Classify intent
        intent_result = await self._classify_intent(body_text, subject)
        conversation.intent = intent_result["intent"]
        conversation.confidence_score = intent_result["confidence"]

        # Extract related entities (order numbers, product SKUs, etc.)
        entities = await self._extract_entities(body_text)
        if entities.get("order_ids"):
            conversation.related_order_ids = {"order_ids": entities["order_ids"]}
        if entities.get("product_skus"):
            conversation.related_product_ids = {"product_skus": entities["product_skus"]}

        # Update message count
        conversation.message_count += 1
        conversation.last_message_at = datetime.utcnow()

        await self.db.commit()

        # Generate and send response if confidence is high enough
        response_sent = False
        if (
            self.sendgrid_client.settings.ai_auto_response_enabled
            and intent_result["confidence"] >= self.sendgrid_client.settings.ai_confidence_threshold
        ):
            response = await self._generate_response(conversation, inbound_message, intent_result, entities)

            if response:
                send_result = await self.sendgrid_client.send_email(
                    to_email=from_email,
                    subject=f"Re: {subject}",
                    body_text=response["body_text"],
                    body_html=response.get("body_html"),
                )

                # Save outbound message
                await self._save_outbound_message(
                    conversation_id=conversation.id,
                    message_id=send_result["message_id"],
                    to_email=from_email,
                    to_name=from_name,
                    subject=f"Re: {subject}",
                    body_text=response["body_text"],
                    body_html=response.get("body_html"),
                    ai_confidence=intent_result["confidence"],
                )

                conversation.status = "responded"
                conversation.message_count += 1
                await self.db.commit()
                response_sent = True

                logger.info(
                    "auto_response_sent",
                    conversation_id=str(conversation.id),
                    intent=intent_result["intent"],
                    confidence=intent_result["confidence"],
                )
        else:
            # Mark for human review
            conversation.status = "escalated"
            await self.db.commit()
            logger.info(
                "email_escalated_for_human_review",
                conversation_id=str(conversation.id),
                reason="low_confidence" if intent_result["confidence"] < 0.75 else "auto_response_disabled",
            )

        return {
            "success": True,
            "conversation_id": str(conversation.id),
            "intent": intent_result["intent"],
            "confidence": intent_result["confidence"],
            "response_sent": response_sent,
        }

    def _generate_thread_id(self, email: str, subject: str) -> str:
        """Generate a consistent thread ID for conversation grouping.

        Args:
            email: Customer email
            subject: Email subject

        Returns:
            Thread ID hash
        """
        # Normalize subject (remove Re:, Fwd:, etc.)
        normalized_subject = re.sub(r"^(Re|Fwd|Fw):\s*", "", subject, flags=re.IGNORECASE).strip()

        # Create hash from email + normalized subject
        thread_string = f"{email.lower()}:{normalized_subject.lower()}"
        return hashlib.sha256(thread_string.encode()).hexdigest()[:32]

    async def _get_or_create_conversation(
        self,
        thread_id: str,
        customer_email: str,
        customer_name: str | None,
        subject: str,
    ) -> EmailConversation:
        """Get existing conversation or create new one.

        Args:
            thread_id: Thread identifier
            customer_email: Customer email
            customer_name: Customer name (optional)
            subject: Email subject

        Returns:
            EmailConversation instance
        """
        # Try to find existing conversation
        stmt = select(EmailConversation).where(EmailConversation.thread_id == thread_id)
        result = await self.db.execute(stmt)
        conversation = result.scalars().first()

        if conversation:
            return conversation

        # Try to find linked customer
        stmt = select(Customer).where(Customer.email == customer_email)
        result = await self.db.execute(stmt)
        customer = result.scalars().first()

        # Create new conversation
        conversation = EmailConversation(
            id=uuid.uuid4(),
            thread_id=thread_id,
            subject=subject,
            customer_email=customer_email,
            customer_name=customer_name,
            customer_id=customer.id if customer else None,
            status="open",
            first_message_at=datetime.utcnow(),
            last_message_at=datetime.utcnow(),
        )

        self.db.add(conversation)
        await self.db.flush()

        logger.info(
            "conversation_created",
            conversation_id=str(conversation.id),
            thread_id=thread_id,
            customer_email=customer_email,
        )

        return conversation

    async def _save_inbound_message(
        self,
        conversation_id: uuid.UUID,
        message_id: str,
        from_email: str,
        from_name: str | None,
        subject: str,
        body_text: str,
        body_html: str | None,
    ) -> EmailMessage:
        """Save inbound email message to database.

        Args:
            conversation_id: Conversation ID
            message_id: Email Message-ID
            from_email: Sender email
            from_name: Sender name
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body

        Returns:
            EmailMessage instance
        """
        message = EmailMessage(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            message_id=message_id,
            direction="inbound",
            from_email=from_email,
            from_name=from_name,
            to_email="support@ccwonline.com.au",  # Our support email
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            was_ai_generated=False,
        )

        self.db.add(message)
        await self.db.flush()

        return message

    async def _save_outbound_message(
        self,
        conversation_id: uuid.UUID,
        message_id: str,
        to_email: str,
        to_name: str | None,
        subject: str,
        body_text: str,
        body_html: str | None,
        ai_confidence: float,
    ) -> EmailMessage:
        """Save outbound email message to database.

        Args:
            conversation_id: Conversation ID
            message_id: SendGrid message ID
            to_email: Recipient email
            to_name: Recipient name
            subject: Email subject
            body_text: Plain text body
            body_html: HTML body
            ai_confidence: AI confidence score

        Returns:
            EmailMessage instance
        """
        message = EmailMessage(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            message_id=message_id,
            direction="outbound",
            from_email="support@ccwonline.com.au",
            from_name="CCW Equipment Support",
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            was_ai_generated=True,
            ai_confidence=ai_confidence,
            sendgrid_message_id=message_id,
            sendgrid_status="sent",
        )

        self.db.add(message)
        await self.db.flush()

        return message

    async def _classify_intent(self, body_text: str, subject: str) -> dict[str, Any]:
        """Classify email intent using simple keyword matching.

        In production, this would use an LLM for better accuracy.

        Args:
            body_text: Email body text
            subject: Email subject

        Returns:
            Dict with intent and confidence score
        """
        text_lower = (body_text + " " + subject).lower()

        # Simple keyword-based classification
        patterns = {
            "order_inquiry": [
                r"order\s+#?\d+",
                r"order\s+status",
                r"where\s+is\s+my\s+order",
                r"track.*order",
                r"delivery.*status",
            ],
            "stock_check": [
                r"in\s+stock",
                r"availability",
                r"do\s+you\s+have",
                r"can\s+i\s+buy",
                r"quantity\s+available",
            ],
            "quote_request": [
                r"quote",
                r"pricing",
                r"how\s+much",
                r"cost",
                r"price",
            ],
            "complaint": [
                r"wrong",
                r"complaint",
                r"issue",
                r"problem",
                r"defective",
                r"broken",
                r"damaged",
            ],
            "support": [
                r"help",
                r"support",
                r"question",
                r"how\s+to",
                r"installation",
            ],
        }

        intent = "other"
        max_score = 0

        for intent_type, keywords in patterns.items():
            score = sum(1 for pattern in keywords if re.search(pattern, text_lower))
            if score > max_score:
                max_score = score
                intent = intent_type

        # Confidence based on match count
        confidence = min(0.95, 0.60 + (max_score * 0.15))

        return {
            "intent": intent,
            "confidence": confidence,
        }

    async def _extract_entities(self, body_text: str) -> dict[str, list[str]]:
        """Extract order numbers, SKUs, etc. from email text.

        Args:
            body_text: Email body text

        Returns:
            Dict with extracted entity lists
        """
        entities: dict[str, list[str]] = {}

        # Extract order numbers (ORD-YYYY-NNN format)
        order_matches = re.findall(r"ORD-\d{4}-\d{3}", body_text, re.IGNORECASE)
        if order_matches:
            entities["order_ids"] = list(set(order_matches))

        # Extract SKUs (various formats)
        sku_matches = re.findall(r"[A-Z]{3}-\d{3}", body_text)
        if sku_matches:
            entities["product_skus"] = list(set(sku_matches))

        return entities

    async def _generate_response(
        self,
        conversation: EmailConversation,
        inbound_message: EmailMessage,
        intent_result: dict[str, Any],
        entities: dict[str, list[str]],
    ) -> dict[str, str] | None:
        """Generate appropriate email response based on intent.

        Args:
            conversation: Email conversation
            inbound_message: Inbound email message
            intent_result: Intent classification result
            entities: Extracted entities

        Returns:
            Dict with body_text and body_html, or None if can't generate
        """
        intent = intent_result["intent"]
        customer_name = conversation.customer_name or "there"

        responses = {
            "order_inquiry": await self._generate_order_inquiry_response(customer_name, entities),
            "stock_check": self._generate_stock_check_response(customer_name),
            "quote_request": self._generate_quote_request_response(customer_name),
            "complaint": self._generate_complaint_response(customer_name),
            "support": self._generate_support_response(customer_name),
            "other": self._generate_generic_response(customer_name),
        }

        return responses.get(intent)

    async def _generate_order_inquiry_response(
        self, customer_name: str, entities: dict[str, list[str]]
    ) -> dict[str, str]:
        """Generate response for order inquiries."""
        order_ids = entities.get("order_ids", [])

        if order_ids:
            # Try to look up actual order
            order_number = order_ids[0]
            stmt = select(Order).where(Order.order_number == order_number)
            result = await self.db.execute(stmt)
            order = result.scalars().first()

            if order:
                body_text = f"""Hi {customer_name},

Thank you for your inquiry about order {order.order_number}.

Your order status is: {order.status.value}
Order date: {order.order_date.strftime('%B %d, %Y')}
Total: ${order.total}

If you have any other questions, please don't hesitate to reach out!

Best regards,
CCW Equipment Support Team"""
            else:
                body_text = f"""Hi {customer_name},

Thank you for your inquiry about order {order_number}.

I wasn't able to find that order number in our system. Could you please verify the order number and provide any additional details?

Best regards,
CCW Equipment Support Team"""
        else:
            body_text = f"""Hi {customer_name},

Thank you for your order inquiry.

To help you better, could you please provide your order number? It should be in the format ORD-YYYY-NNN.

Best regards,
CCW Equipment Support Team"""

        return {"body_text": body_text, "body_html": f"<p>{body_text.replace(chr(10), '<br>')}</p>"}

    def _generate_stock_check_response(self, customer_name: str) -> dict[str, str]:
        """Generate response for stock inquiries."""
        body_text = f"""Hi {customer_name},

Thank you for your interest in our products!

To check product availability, I'll need the following information:
- Product name or SKU
- Quantity required
- Preferred delivery location

Once you provide these details, I'll get back to you with availability and pricing.

Best regards,
CCW Equipment Support Team"""

        return {"body_text": body_text, "body_html": f"<p>{body_text.replace(chr(10), '<br>')}</p>"}

    def _generate_quote_request_response(self, customer_name: str) -> dict[str, str]:
        """Generate response for quote requests."""
        body_text = f"""Hi {customer_name},

Thank you for your quote request!

I've received your inquiry and will prepare a detailed quote for you. Please expect to receive it within 24 business hours.

If you need the quote urgently, please call us at (07) 1234 5678.

Best regards,
CCW Equipment Support Team"""

        return {"body_text": body_text, "body_html": f"<p>{body_text.replace(chr(10), '<br>')}</p>"}

    def _generate_complaint_response(self, customer_name: str) -> dict[str, str]:
        """Generate response for complaints."""
        body_text = f"""Hi {customer_name},

Thank you for reaching out to us.

I'm sorry to hear you're experiencing an issue. Your satisfaction is our top priority, and I want to help resolve this as quickly as possible.

A member of our customer service team will contact you within 24 hours to address your concern.

If this is urgent, please call us at (07) 1234 5678.

Best regards,
CCW Equipment Support Team"""

        return {"body_text": body_text, "body_html": f"<p>{body_text.replace(chr(10), '<br>')}</p>"}

    def _generate_support_response(self, customer_name: str) -> dict[str, str]:
        """Generate response for support inquiries."""
        body_text = f"""Hi {customer_name},

Thank you for contacting CCW Equipment support!

I've received your inquiry and will get back to you with the information you need as soon as possible.

Our business hours are:
Monday - Friday: 8:00 AM - 6:00 PM
Saturday: 9:00 AM - 1:00 PM
Sunday: Closed

Best regards,
CCW Equipment Support Team"""

        return {"body_text": body_text, "body_html": f"<p>{body_text.replace(chr(10), '<br>')}</p>"}

    def _generate_generic_response(self, customer_name: str) -> dict[str, str]:
        """Generate generic response."""
        body_text = f"""Hi {customer_name},

Thank you for contacting CCW Equipment!

I've received your email and will get back to you soon.

If you need immediate assistance, please call us at (07) 1234 5678.

Best regards,
CCW Equipment Support Team"""

        return {"body_text": body_text, "body_html": f"<p>{body_text.replace(chr(10), '<br>')}</p>"}
