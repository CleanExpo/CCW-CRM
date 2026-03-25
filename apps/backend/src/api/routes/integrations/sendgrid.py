"""SendGrid email integration API routes."""

import hashlib
import hmac
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.config.sendgrid_settings import SendGridSettings, sendgrid_settings
from src.db.email_models import EmailConversation, EmailMessage, EmailWebhookLog
from src.db.integration_credential_models import IntegrationCredential
from src.integrations.sendgrid.client import SendGridClient
from src.integrations.sendgrid.processor import EmailProcessor

router = APIRouter(prefix="/api/integrations/sendgrid", tags=["SendGrid Integration"])
logger = structlog.get_logger(__name__)


# Pydantic models for requests/responses
class SendGridConfigureRequest(BaseModel):
    """Credentials to configure the SendGrid integration."""

    api_key: str = Field(min_length=1, description="SendGrid API key (starts with SG.)")
    from_email: str = Field(default="", description="Sender email address")
    from_name: str = Field(default="", description="Sender display name")


class SendEmailRequest(BaseModel):
    """Request model for sending an email."""

    to_email: EmailStr
    subject: str
    body_text: str
    body_html: str | None = None


class EmailConversationResponse(BaseModel):
    """Response model for email conversation."""

    id: str
    thread_id: str
    subject: str
    customer_email: str
    customer_name: str | None
    status: str
    intent: str | None
    message_count: int
    first_message_at: str
    last_message_at: str


class EmailMessageResponse(BaseModel):
    """Response model for email message."""

    id: str
    direction: str
    from_email: str
    to_email: str
    subject: str
    body_text: str
    sent_at: str
    was_ai_generated: bool


# Helper functions
def get_sendgrid_settings() -> SendGridSettings:
    """Get SendGrid settings dependency."""
    return sendgrid_settings


@router.get("/status")
async def get_connection_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[SendGridSettings, Depends(get_sendgrid_settings)],
) -> dict:
    """Get SendGrid connection status.

    Checks DB for a saved API key first, then falls back to env var mode.
    """
    logger.info("checking_sendgrid_status")

    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.integration_name == "sendgrid",
            IntegrationCredential.is_active.is_(True),
        )
    )
    cred = result.scalar_one_or_none()
    stored = cred.get_credentials() if cred else {}
    has_real_key = bool(stored.get("api_key") and not stored["api_key"].startswith("demo_"))

    if has_real_key:
        return {
            "connected": True,
            "mode": "live",
            "from_email": stored.get("from_email") or settings.from_email,
            "from_name": stored.get("from_name") or settings.from_name,
        }

    if settings.mode == "demo":
        return {
            "connected": True,
            "mode": "demo",
            "from_email": settings.from_email,
            "from_name": settings.from_name,
        }

    return {
        "connected": False,
        "mode": "not_configured",
        "message": "Enter your SendGrid API key to enable email integration",
    }


@router.post("/configure")
async def configure_sendgrid(
    request: SendGridConfigureRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Save SendGrid API key to the database.

    Creates or updates the SendGrid credential record.
    """
    logger.info("configuring_sendgrid_credentials")

    result = await db.execute(
        select(IntegrationCredential).where(
            IntegrationCredential.integration_name == "sendgrid"
        )
    )
    cred = result.scalar_one_or_none()

    if cred:
        cred.set_credentials({
            "api_key": request.api_key,
            "from_email": request.from_email,
            "from_name": request.from_name,
        })
        cred.is_active = True
    else:
        cred = IntegrationCredential(integration_name="sendgrid", is_active=True)
        cred.set_credentials({
            "api_key": request.api_key,
            "from_email": request.from_email,
            "from_name": request.from_name,
        })
        db.add(cred)

    await db.commit()

    logger.info("sendgrid_credentials_saved")
    return {
        "connected": True,
        "mode": "live",
        "from_email": request.from_email,
        "message": "SendGrid credentials saved successfully",
    }


@router.post("/send")
async def send_email(
    email_request: SendEmailRequest,
    settings: Annotated[SendGridSettings, Depends(get_sendgrid_settings)],
) -> dict:
    """Send an email via SendGrid.

    Args:
        email_request: Email details (to, subject, body)
        settings: SendGrid settings

    Returns:
        Send result with message ID
    """
    logger.info("sending_email", to=email_request.to_email, subject=email_request.subject)

    client = SendGridClient(settings)

    try:
        result = await client.send_email(
            to_email=email_request.to_email,
            subject=email_request.subject,
            body_text=email_request.body_text,
            body_html=email_request.body_html,
        )

        return {
            "success": True,
            "message_id": result["message_id"],
            "mode": settings.mode,
        }

    except Exception as e:
        logger.error("failed_to_send_email", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )


@router.get("/conversations")
async def list_conversations(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status_filter: str | None = None,
    limit: int = 50,
) -> dict:
    """List email conversations.

    Args:
        db: Database session
        status_filter: Filter by status (open|responded|escalated|closed)
        limit: Maximum number of conversations to return

    Returns:
        List of email conversations
    """
    logger.info("listing_conversations", status_filter=status_filter, limit=limit)

    query = select(EmailConversation).order_by(EmailConversation.last_message_at.desc())

    if status_filter:
        query = query.where(EmailConversation.status == status_filter)

    query = query.limit(limit)

    result = await db.execute(query)
    conversations = result.scalars().all()

    return {
        "success": True,
        "count": len(conversations),
        "conversations": [
            EmailConversationResponse(
                id=str(conv.id),
                thread_id=conv.thread_id,
                subject=conv.subject,
                customer_email=conv.customer_email,
                customer_name=conv.customer_name,
                status=conv.status,
                intent=conv.intent,
                message_count=conv.message_count,
                first_message_at=conv.first_message_at.isoformat(),
                last_message_at=conv.last_message_at.isoformat(),
            ).model_dump()
            for conv in conversations
        ],
    }


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get conversation details with all messages.

    Args:
        conversation_id: Conversation UUID
        db: Database session

    Returns:
        Conversation with messages
    """
    logger.info("getting_conversation", conversation_id=conversation_id)

    # Get conversation
    stmt = select(EmailConversation).where(EmailConversation.id == conversation_id)
    result = await db.execute(stmt)
    conversation = result.scalars().first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    # Get messages
    stmt = (
        select(EmailMessage)
        .where(EmailMessage.conversation_id == conversation_id)
        .order_by(EmailMessage.sent_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return {
        "success": True,
        "conversation": EmailConversationResponse(
            id=str(conversation.id),
            thread_id=conversation.thread_id,
            subject=conversation.subject,
            customer_email=conversation.customer_email,
            customer_name=conversation.customer_name,
            status=conversation.status,
            intent=conversation.intent,
            message_count=conversation.message_count,
            first_message_at=conversation.first_message_at.isoformat(),
            last_message_at=conversation.last_message_at.isoformat(),
        ).model_dump(),
        "messages": [
            EmailMessageResponse(
                id=str(msg.id),
                direction=msg.direction,
                from_email=msg.from_email,
                to_email=msg.to_email,
                subject=msg.subject,
                body_text=msg.body_text or "",
                sent_at=msg.sent_at.isoformat(),
                was_ai_generated=msg.was_ai_generated,
            ).model_dump()
            for msg in messages
        ],
    }


@router.post("/webhook/inbound")
async def handle_inbound_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[SendGridSettings, Depends(get_sendgrid_settings)],
) -> dict:
    """Handle inbound email webhook from SendGrid Inbound Parse.

    This endpoint receives emails forwarded by SendGrid and processes them.

    Args:
        request: FastAPI request with form data
        db: Database session
        settings: SendGrid settings

    Returns:
        Processing result
    """
    logger.info("inbound_webhook_received")

    # Get form data (SendGrid sends multipart/form-data)
    form_data = await request.form()

    # Extract email data
    email_data = {
        "headers": dict(form_data.get("headers", {})),
        "from": form_data.get("from", ""),
        "to": form_data.get("to", ""),
        "subject": form_data.get("subject", ""),
        "text": form_data.get("text", ""),
        "html": form_data.get("html"),
    }

    # Process the email
    client = SendGridClient(settings)
    processor = EmailProcessor(db, client)

    try:
        result = await processor.process_inbound_email(email_data)

        logger.info(
            "inbound_email_processed",
            conversation_id=result["conversation_id"],
            intent=result["intent"],
            response_sent=result["response_sent"],
        )

        return {
            "success": True,
            "conversation_id": result["conversation_id"],
            "intent": result["intent"],
            "response_sent": result["response_sent"],
        }

    except Exception as e:
        logger.error("inbound_email_processing_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process inbound email: {str(e)}",
        )


@router.post("/webhook/events")
async def handle_event_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[SendGridSettings, Depends(get_sendgrid_settings)],
) -> dict:
    """Handle SendGrid Event Webhook (delivery, opens, clicks, bounces).

    This webhook tracks email delivery status and engagement.

    Args:
        request: FastAPI request with JSON array of events
        db: Database session
        settings: SendGrid settings

    Returns:
        Processing result
    """
    logger.info("event_webhook_received")

    # Verify webhook signature if in live mode
    if settings.is_live_mode:
        signature = request.headers.get("X-Twilio-Email-Event-Webhook-Signature")
        timestamp = request.headers.get("X-Twilio-Email-Event-Webhook-Timestamp")

        if not signature or not timestamp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing webhook signature",
            )

        # Verify signature (simplified - in production use proper verification)
        body = await request.body()
        expected_signature = hmac.new(
            settings.inbound_webhook_secret.encode(),
            timestamp.encode() + body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

    # Parse events
    events = await request.json()

    processed_count = 0

    for event in events:
        event_type = event.get("event", "unknown")
        sendgrid_message_id = event.get("sg_message_id")

        # Log webhook event
        webhook_log = EmailWebhookLog(
            event_type=event_type,
            sendgrid_message_id=sendgrid_message_id,
            payload=event,
            processed=False,
        )
        db.add(webhook_log)

        # Update message status if we have the message
        if sendgrid_message_id:
            stmt = select(EmailMessage).where(
                EmailMessage.sendgrid_message_id == sendgrid_message_id
            )
            result = await db.execute(stmt)
            message = result.scalars().first()

            if message:
                message.sendgrid_status = event_type

                if event_type == "delivered":
                    message.delivered_at = event.get("timestamp")
                elif event_type == "open":
                    message.opened_at = event.get("timestamp")

                webhook_log.processed = True
                webhook_log.email_message_id = message.id

        processed_count += 1

    await db.commit()

    logger.info("event_webhook_processed", event_count=processed_count)

    return {
        "success": True,
        "events_processed": processed_count,
    }


@router.post("/demo/simulate-inbound")
async def simulate_inbound_email(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[SendGridSettings, Depends(get_sendgrid_settings)],
    email_number: int = 1,
) -> dict:
    """Simulate an inbound email for demo/testing purposes.

    Args:
        email_number: Email variation number (1-5)
        db: Database session
        settings: SendGrid settings

    Returns:
        Processing result
    """
    if not settings.is_demo_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only available in demo mode",
        )

    logger.info("simulating_inbound_email", email_number=email_number)

    # Get demo email from client
    from src.integrations.sendgrid.demo_client import SendGridDemoClient

    demo_client = SendGridDemoClient()
    email_data = demo_client.get_demo_inbound_email(email_number)

    # Process it
    client = SendGridClient(settings)
    processor = EmailProcessor(db, client)

    result = await processor.process_inbound_email(email_data)

    return {
        "success": True,
        "mode": "demo",
        "email_variation": email_number,
        "conversation_id": result["conversation_id"],
        "intent": result["intent"],
        "confidence": result["confidence"],
        "response_sent": result["response_sent"],
        "preview": {
            "from": email_data["from"],
            "subject": email_data["subject"],
            "body": email_data["text"][:200] + "...",
        },
    }
