"""
CRM Onboarding Sequences — UNI-1113

When a new client signs up, automatically schedule:
  Day  1: Welcome email + quick-start checklist
  Day  7: Check-in (did they use the platform?)
  Day 30: Value receipt (what they've done/saved)

Triggered on new customer creation.
Cancelled automatically if customer becomes inactive.
Uses existing SendGrid integration — no new API spend.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.customer_health_models import (
    OnboardingSequence,
    OnboardingStatus,
    OnboardingTouchpoint,
    TouchpointStatus,
)
from src.db.demo_models import Customer

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/crm/onboarding", tags=["CRM Onboarding"])

# ─── Email templates ──────────────────────────────────────────────────────────

TOUCHPOINT_TEMPLATES = {
    "1": {
        "subject": "Welcome to CCW — your quick-start checklist",
        "body": (
            "Hi {contact_name},\n\n"
            "Welcome to CCW Online! We're thrilled to have {company_name} on board.\n\n"
            "Here's your quick-start checklist:\n"
            "✅ Browse our full product catalogue\n"
            "✅ Request a quote for your next equipment purchase\n"
            "✅ Chat with our team if you need advice\n\n"
            "Ready to get started? Log in at https://ccwonline.com.au\n\n"
            "Cheers,\nThe CCW Team"
        ),
    },
    "7": {
        "subject": "How are you finding CCW? (7-day check-in)",
        "body": (
            "Hi {contact_name},\n\n"
            "It's been a week since {company_name} joined CCW Online.\n\n"
            "Have you had a chance to explore our range?\n"
            "• Truckmounts & Portables\n"
            "• Restoration Equipment\n"
            "• Chemicals & Consumables\n\n"
            "If you have any questions or need a quote, reply to this email — we're here to help.\n\n"
            "Cheers,\nThe CCW Team"
        ),
    },
    "30": {
        "subject": "Your first 30 days with CCW — here's what you've saved",
        "body": (
            "Hi {contact_name},\n\n"
            "30 days in! Here's a quick summary of what {company_name} has done with CCW:\n\n"
            "We're proud to be your equipment partner.\n"
            "If there's anything we can do to make your experience better, let us know.\n\n"
            "Cheers,\nThe CCW Team"
        ),
    },
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def create_onboarding_sequence(customer: Customer, db: AsyncSession) -> OnboardingSequence:
    """
    Create a new onboarding sequence with 3 scheduled touchpoints.
    Called when a new customer is created.
    """
    now = datetime.now(UTC)

    seq = OnboardingSequence(
        customer_id=customer.id,
        status=OnboardingStatus.ACTIVE.value,
        triggered_at=now,
    )
    db.add(seq)
    await db.flush()  # get seq.id

    for day_str, tmpl in TOUCHPOINT_TEMPLATES.items():
        delay_days = int(day_str)
        tp = OnboardingTouchpoint(
            sequence_id=seq.id,
            day=day_str,
            status=TouchpointStatus.SCHEDULED.value,
            scheduled_at=now + timedelta(days=delay_days),
            email_subject=tmpl["subject"],
        )
        db.add(tp)

    await db.commit()
    await db.refresh(seq)

    logger.info(
        "Onboarding sequence created",
        sequence_id=str(seq.id),
        customer_id=str(customer.id),
        company=customer.company_name,
    )
    return seq


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/sequences")
async def list_sequences(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status_filter: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    """List all onboarding sequences with their touchpoints."""
    stmt = select(OnboardingSequence)
    if status_filter:
        stmt = stmt.where(OnboardingSequence.status == status_filter)
    stmt = stmt.order_by(OnboardingSequence.triggered_at.desc())

    result = await db.execute(stmt)
    sequences = result.scalars().all()

    # Enrich with customer names
    customer_ids = [s.customer_id for s in sequences]
    cust_result = await db.execute(
        select(Customer).where(Customer.id.in_(customer_ids))
    )
    customers = {c.id: c for c in cust_result.scalars().all()}

    # Get touchpoints
    seq_ids = [s.id for s in sequences]
    if seq_ids:
        tp_result = await db.execute(
            select(OnboardingTouchpoint).where(OnboardingTouchpoint.sequence_id.in_(seq_ids))
        )
        touchpoints_by_seq: dict = {}
        for tp in tp_result.scalars().all():
            touchpoints_by_seq.setdefault(str(tp.sequence_id), []).append({
                "id": str(tp.id),
                "day": tp.day,
                "status": tp.status,
                "scheduled_at": tp.scheduled_at.isoformat() if tp.scheduled_at else None,
                "sent_at": tp.sent_at.isoformat() if tp.sent_at else None,
                "email_subject": tp.email_subject,
            })
    else:
        touchpoints_by_seq = {}

    items = []
    for seq in sequences:
        c = customers.get(seq.customer_id)
        items.append({
            "id": str(seq.id),
            "customer_id": str(seq.customer_id),
            "company_name": c.company_name if c else "Unknown",
            "contact_name": c.contact_name if c else None,
            "email": c.email if c else None,
            "status": seq.status,
            "triggered_at": seq.triggered_at.isoformat() if seq.triggered_at else None,
            "cancelled_at": seq.cancelled_at.isoformat() if seq.cancelled_at else None,
            "completed_at": seq.completed_at.isoformat() if seq.completed_at else None,
            "touchpoints": touchpoints_by_seq.get(str(seq.id), []),
        })

    total = len(items)
    start = (page - 1) * page_size
    paginated = items[start: start + page_size]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


class TriggerRequest(BaseModel):
    customer_id: str


@router.post("/sequences/trigger", status_code=status.HTTP_201_CREATED)
async def trigger_sequence(
    request: TriggerRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Manually trigger an onboarding sequence for a customer."""
    cust_result = await db.execute(
        select(Customer).where(Customer.id == UUID(request.customer_id))
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    seq = await create_onboarding_sequence(customer, db)
    return {
        "sequence_id": str(seq.id),
        "customer_id": request.customer_id,
        "company_name": customer.company_name,
        "status": "created",
    }


@router.patch("/sequences/{sequence_id}/cancel")
async def cancel_sequence(
    sequence_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Cancel an active onboarding sequence."""
    result = await db.execute(
        select(OnboardingSequence).where(OnboardingSequence.id == UUID(sequence_id))
    )
    seq = result.scalar_one_or_none()
    if not seq:
        raise HTTPException(status_code=404, detail="Sequence not found")

    seq.status = OnboardingStatus.CANCELLED.value
    seq.cancelled_at = datetime.now(UTC)

    # Cancel pending touchpoints
    await db.execute(
        update(OnboardingTouchpoint)
        .where(
            OnboardingTouchpoint.sequence_id == UUID(sequence_id),
            OnboardingTouchpoint.status == TouchpointStatus.SCHEDULED.value,
        )
        .values(status=TouchpointStatus.SKIPPED.value)
    )
    await db.commit()

    logger.info("Onboarding sequence cancelled", sequence_id=sequence_id)
    return {"sequence_id": sequence_id, "status": "cancelled"}
