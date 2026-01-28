"""
Google Agent Payments Protocol (AP2) API endpoints.

Provides API routes for AP2 integration including:
- Mandate creation and verification
- Payment processing
- Voice commerce
- Agent-to-agent commerce
- Webhook handling
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.ap2_settings import get_ap2_settings
from src.config.database import get_async_db
from src.db.ap2_models import (
    AP2AgentInteraction,
    AP2Connection,
    AP2Mandate,
    AP2MandateStatus,
    AP2MandateType,
    AP2Transaction,
    AP2TransactionStatus,
    AP2VoiceSession,
    AP2VoiceSessionStatus,
    AP2WebhookLog,
)
from src.integrations.ap2 import get_ap2_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/ap2", tags=["AP2 Integration"])


# Pydantic Schemas

class CreateIntentMandateRequest(BaseModel):
    """Request to create intent mandate."""

    intent_description: str = Field(..., min_length=1, max_length=1000)
    language: str = Field(default="en", pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    metadata: dict | None = None


class CreateCartMandateRequest(BaseModel):
    """Request to create cart mandate."""

    parent_mandate_id: UUID
    cart_items: list[dict]
    total_amount: float = Field(..., gt=0)
    currency: str = Field(default="AUD", max_length=3)


class CreatePaymentMandateRequest(BaseModel):
    """Request to create payment mandate."""

    parent_mandate_id: UUID
    payment_amount: float = Field(..., gt=0)
    payment_method: str
    currency: str = Field(default="AUD", max_length=3)


class VerifyMandateRequest(BaseModel):
    """Request to verify mandate signature."""

    signature: str
    public_key: str


class ExecutePaymentRequest(BaseModel):
    """Request to execute payment."""

    order_id: UUID | None = None


class VoiceInputRequest(BaseModel):
    """Request to process voice input."""

    voice_text: str = Field(..., min_length=1)
    language: str = Field(default="en")


class MandateResponse(BaseModel):
    """Mandate response."""

    mandate_id: UUID
    mandate_type: str
    status: str
    expires_at: datetime
    signature: str | None
    parent_mandate_id: UUID | None = None


class TransactionResponse(BaseModel):
    """Transaction response."""

    transaction_id: UUID
    status: str
    amount: float
    currency: str
    completed_at: datetime | None


# API Endpoints


@router.post("/mandates/intent", response_model=MandateResponse, status_code=status.HTTP_201_CREATED)
async def create_intent_mandate(
    request: CreateIntentMandateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> MandateResponse:
    """
    Create an intent mandate (first step in AP2 payment flow).

    The intent mandate represents the user's expressed desire to make a purchase.
    This is the first step in the Intent → Cart → Payment mandate chain.
    """
    settings = get_ap2_settings()
    client = get_ap2_client()

    try:
        # Create mandate via AP2 client
        mandate_data = await client.create_intent_mandate(
            intent_description=request.intent_description,
            language=request.language,
            metadata=request.metadata,
        )

        # Save to database
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.mandate_ttl_seconds)

        mandate = AP2Mandate(
            mandate_type=AP2MandateType.INTENT,
            status=AP2MandateStatus.VERIFIED,
            intent_description=request.intent_description,
            intent_language=request.language,
            signature=mandate_data.get("signature"),
            public_key=mandate_data.get("public_key"),
            expires_at=expires_at,
            mandate_metadata=request.metadata,
        )

        db.add(mandate)
        await db.commit()
        await db.refresh(mandate)

        logger.info(
            "Intent mandate created",
            mandate_id=str(mandate.id),
            intent=request.intent_description,
        )

        return MandateResponse(
            mandate_id=mandate.id,
            mandate_type=mandate.mandate_type.value,
            status=mandate.status.value,
            expires_at=mandate.expires_at,
            signature=mandate.signature,
            parent_mandate_id=None,
        )

    except Exception as e:
        logger.error("Failed to create intent mandate", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create intent mandate: {str(e)}",
        )


@router.post("/mandates/cart", response_model=MandateResponse, status_code=status.HTTP_201_CREATED)
async def create_cart_mandate(
    request: CreateCartMandateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> MandateResponse:
    """
    Create a cart mandate (second step in AP2 payment flow).

    The cart mandate represents the user's selected items and total.
    Must reference a valid intent mandate as parent.
    """
    settings = get_ap2_settings()
    client = get_ap2_client()

    # Verify parent mandate exists
    parent_result = await db.execute(
        select(AP2Mandate).where(AP2Mandate.id == request.parent_mandate_id)
    )
    parent_mandate = parent_result.scalar_one_or_none()

    if not parent_mandate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent mandate not found",
        )

    if parent_mandate.mandate_type != AP2MandateType.INTENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent mandate must be of type INTENT",
        )

    try:
        # Create mandate via AP2 client
        mandate_data = await client.create_cart_mandate(
            parent_mandate_id=str(request.parent_mandate_id),
            cart_items=request.cart_items,
            total_amount=request.total_amount,
            currency=request.currency,
        )

        # Save to database
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.mandate_ttl_seconds)

        mandate = AP2Mandate(
            mandate_type=AP2MandateType.CART,
            status=AP2MandateStatus.VERIFIED,
            cart_items=request.cart_items,
            cart_total=request.total_amount,
            signature=mandate_data.get("signature"),
            public_key=mandate_data.get("public_key"),
            parent_mandate_id=request.parent_mandate_id,
            expires_at=expires_at,
        )

        db.add(mandate)
        await db.commit()
        await db.refresh(mandate)

        logger.info(
            "Cart mandate created",
            mandate_id=str(mandate.id),
            parent_mandate_id=str(request.parent_mandate_id),
            total=request.total_amount,
        )

        return MandateResponse(
            mandate_id=mandate.id,
            mandate_type=mandate.mandate_type.value,
            status=mandate.status.value,
            expires_at=mandate.expires_at,
            signature=mandate.signature,
            parent_mandate_id=mandate.parent_mandate_id,
        )

    except Exception as e:
        logger.error("Failed to create cart mandate", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create cart mandate: {str(e)}",
        )


@router.post(
    "/mandates/payment", response_model=MandateResponse, status_code=status.HTTP_201_CREATED
)
async def create_payment_mandate(
    request: CreatePaymentMandateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> MandateResponse:
    """
    Create a payment mandate (final step in AP2 payment flow).

    The payment mandate authorizes the actual payment.
    Must reference a valid cart mandate as parent.
    """
    settings = get_ap2_settings()
    client = get_ap2_client()

    # Verify parent mandate exists
    parent_result = await db.execute(
        select(AP2Mandate).where(AP2Mandate.id == request.parent_mandate_id)
    )
    parent_mandate = parent_result.scalar_one_or_none()

    if not parent_mandate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent mandate not found",
        )

    if parent_mandate.mandate_type != AP2MandateType.CART:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent mandate must be of type CART",
        )

    try:
        # Create mandate via AP2 client
        mandate_data = await client.create_payment_mandate(
            parent_mandate_id=str(request.parent_mandate_id),
            payment_amount=request.payment_amount,
            payment_method=request.payment_method,
            currency=request.currency,
        )

        # Save to database
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.mandate_ttl_seconds)

        mandate = AP2Mandate(
            mandate_type=AP2MandateType.PAYMENT,
            status=AP2MandateStatus.VERIFIED,
            payment_amount=request.payment_amount,
            payment_currency=request.currency,
            payment_method=request.payment_method,
            signature=mandate_data.get("signature"),
            public_key=mandate_data.get("public_key"),
            parent_mandate_id=request.parent_mandate_id,
            expires_at=expires_at,
        )

        db.add(mandate)
        await db.commit()
        await db.refresh(mandate)

        logger.info(
            "Payment mandate created",
            mandate_id=str(mandate.id),
            parent_mandate_id=str(request.parent_mandate_id),
            amount=request.payment_amount,
        )

        return MandateResponse(
            mandate_id=mandate.id,
            mandate_type=mandate.mandate_type.value,
            status=mandate.status.value,
            expires_at=mandate.expires_at,
            signature=mandate.signature,
            parent_mandate_id=mandate.parent_mandate_id,
        )

    except Exception as e:
        logger.error("Failed to create payment mandate", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create payment mandate: {str(e)}",
        )


@router.post("/mandates/{mandate_id}/verify")
async def verify_mandate(
    mandate_id: UUID,
    request: VerifyMandateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Verify mandate cryptographic signature.

    Ensures the mandate has not been tampered with.
    """
    client = get_ap2_client()

    # Get mandate from database
    result = await db.execute(select(AP2Mandate).where(AP2Mandate.id == mandate_id))
    mandate = result.scalar_one_or_none()

    if not mandate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mandate not found",
        )

    try:
        verified = await client.verify_mandate_signature(
            mandate_id=str(mandate_id),
            signature=request.signature,
            public_key=request.public_key,
        )

        if verified:
            mandate.verified_at = datetime.now(UTC)
            mandate.status = AP2MandateStatus.VERIFIED
            await db.commit()

        logger.info("Mandate verification", mandate_id=str(mandate_id), verified=verified)

        return {
            "mandate_id": str(mandate_id),
            "verified": verified,
            "verified_at": mandate.verified_at.isoformat() if verified else None,
        }

    except Exception as e:
        logger.error("Failed to verify mandate", mandate_id=str(mandate_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify mandate: {str(e)}",
        )


@router.post(
    "/payments/execute",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_payment(
    mandate_id: UUID,
    request: ExecutePaymentRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TransactionResponse:
    """
    Execute payment using a payment mandate.

    Creates a transaction and processes the payment.
    """
    client = get_ap2_client()

    # Get mandate from database
    result = await db.execute(select(AP2Mandate).where(AP2Mandate.id == mandate_id))
    mandate = result.scalar_one_or_none()

    if not mandate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mandate not found",
        )

    if mandate.mandate_type != AP2MandateType.PAYMENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mandate must be of type PAYMENT",
        )

    if mandate.status != AP2MandateStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mandate must be verified before payment execution",
        )

    if mandate.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mandate has expired",
        )

    try:
        # Execute payment via AP2 client
        transaction_data = await client.execute_payment(
            mandate_id=str(mandate_id),
            order_id=str(request.order_id) if request.order_id else None,
        )

        # Create transaction record
        transaction = AP2Transaction(
            mandate_id=mandate_id,
            transaction_type="payment",
            status=AP2TransactionStatus.COMPLETED,
            amount=mandate.payment_amount or 0,
            currency=mandate.payment_currency or "AUD",
            payment_method=mandate.payment_method,
            google_transaction_id=transaction_data.get("google_transaction_id"),
            order_id=request.order_id,
            processing_started_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
        )

        # Update mandate status
        mandate.status = AP2MandateStatus.EXECUTED
        mandate.executed_at = datetime.now(UTC)

        db.add(transaction)
        await db.commit()
        await db.refresh(transaction)

        logger.info(
            "Payment executed",
            transaction_id=str(transaction.id),
            mandate_id=str(mandate_id),
            amount=transaction.amount,
        )

        return TransactionResponse(
            transaction_id=transaction.id,
            status=transaction.status.value,
            amount=float(transaction.amount),
            currency=transaction.currency,
            completed_at=transaction.completed_at,
        )

    except Exception as e:
        logger.error("Failed to execute payment", mandate_id=str(mandate_id), error=str(e))

        # Create failed transaction record
        transaction = AP2Transaction(
            mandate_id=mandate_id,
            transaction_type="payment",
            status=AP2TransactionStatus.FAILED,
            amount=mandate.payment_amount or 0,
            currency=mandate.payment_currency or "AUD",
            payment_method=mandate.payment_method,
            order_id=request.order_id,
            processing_started_at=datetime.now(UTC),
            failed_at=datetime.now(UTC),
            error_message=str(e),
        )

        db.add(transaction)
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute payment: {str(e)}",
        )


@router.get("/payments/{transaction_id}", response_model=TransactionResponse)
async def get_payment_status(
    transaction_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TransactionResponse:
    """Get payment transaction status."""
    result = await db.execute(select(AP2Transaction).where(AP2Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    return TransactionResponse(
        transaction_id=transaction.id,
        status=transaction.status.value,
        amount=float(transaction.amount),
        currency=transaction.currency,
        completed_at=transaction.completed_at,
    )


@router.post("/voice/sessions", status_code=status.HTTP_201_CREATED)
async def create_voice_session(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    language: str = "en",
) -> dict:
    """Create a new voice commerce session."""
    session = AP2VoiceSession(
        status=AP2VoiceSessionStatus.ACTIVE,
        language=language,
        conversation_history=[],
    )

    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info("Voice session created", session_id=str(session.id), language=language)

    return {
        "session_id": str(session.id),
        "status": session.status.value,
        "language": session.language,
        "started_at": session.started_at.isoformat(),
    }


@router.post("/voice/sessions/{session_id}/input")
async def process_voice_input(
    session_id: UUID,
    request: VoiceInputRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Process voice input for a session."""
    client = get_ap2_client()

    # Get session
    result = await db.execute(select(AP2VoiceSession).where(AP2VoiceSession.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice session not found",
        )

    if session.status != AP2VoiceSessionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is not active (status: {session.status})",
        )

    try:
        # Process via AP2 client
        response_data = await client.process_voice_input(
            session_id=str(session_id),
            voice_text=request.voice_text,
            language=request.language,
        )

        # Update session
        session.turn_count += 1
        session.detected_intent = response_data.get("intent")
        session.intent_confidence = response_data.get("confidence")

        # Append to conversation history
        if session.conversation_history is None:
            session.conversation_history = []

        session.conversation_history.append(
            {
                "turn": session.turn_count,
                "user_input": request.voice_text,
                "intent": response_data.get("intent"),
                "confidence": response_data.get("confidence"),
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )

        await db.commit()

        logger.info(
            "Voice input processed",
            session_id=str(session_id),
            intent=response_data.get("intent"),
        )

        return response_data

    except Exception as e:
        logger.error("Failed to process voice input", session_id=str(session_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process voice input: {str(e)}",
        )


@router.post("/webhooks")
async def handle_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    x_google_signature: Annotated[str | None, Header()] = None,
) -> dict:
    """
    Handle AP2 webhooks from Google.

    Logs all webhook events for auditing and processes them.
    """
    settings = get_ap2_settings()

    # Get request body
    body = await request.body()
    payload = await request.json()

    # Log webhook
    webhook_log = AP2WebhookLog(
        event_type=payload.get("event_type", "unknown"),
        event_id=payload.get("event_id"),
        headers=dict(request.headers),
        payload=payload,
        signature=x_google_signature,
        signature_verified=False,  # Will be updated after verification
    )

    db.add(webhook_log)
    await db.commit()

    # Verify signature if enabled
    if settings.signature_verification_enabled and x_google_signature:
        # TODO: Implement signature verification logic
        # For now, we'll mark it as verified in demo mode
        if settings.mode == "demo":
            webhook_log.signature_verified = True
        else:
            # Real signature verification would go here
            pass

        await db.commit()

    logger.info(
        "Webhook received",
        event_type=payload.get("event_type"),
        event_id=payload.get("event_id"),
        verified=webhook_log.signature_verified,
    )

    # TODO: Process webhook based on event_type
    # - payment.completed → update transaction status
    # - mandate.expired → mark mandate as expired
    # - etc.

    return {
        "received": True,
        "event_id": payload.get("event_id"),
        "verified": webhook_log.signature_verified,
    }
