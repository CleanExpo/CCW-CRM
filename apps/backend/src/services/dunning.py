"""Dunning letter automation service (GAP-029).

Automated overdue invoice reminder sequence.
Uses Pure Function TDD pattern - core logic is testable without DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models.invoicing import Invoice

logger = structlog.get_logger(__name__)


class DunningLevel(int, Enum):
    """Dunning escalation level."""

    FRIENDLY_REMINDER = 1  # Day 7
    FORMAL_NOTICE = 2  # Day 14
    FINAL_WARNING = 3  # Day 30
    COLLECTIONS = 4  # Day 45+


@dataclass
class DunningLetter:
    """Generated dunning letter."""

    level: DunningLevel
    subject: str
    body: str
    tone: str  # friendly, formal, urgent, severe
    days_overdue: int
    amount_due: Decimal


@dataclass
class DunningCheck:
    """Result of should_send_dunning check."""

    should_send: bool
    level: DunningLevel | None
    days_overdue: int
    reason: str


# ---------------------------------------------------------------------------
# Dunning Templates
# ---------------------------------------------------------------------------

DUNNING_TEMPLATES = {
    DunningLevel.FRIENDLY_REMINDER: {
        "tone": "friendly",
        "subject": "Friendly Reminder: Invoice {invoice_number} Payment Due",
        "body": """Dear {customer_name},

This is a friendly reminder that invoice {invoice_number} for ${amount_due} was due on {due_date}.

We understand that oversights happen. If you have already sent payment, please disregard this notice.

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
Accounts Receivable Team
""",
    },
    DunningLevel.FORMAL_NOTICE: {
        "tone": "formal",
        "subject": "Payment Required: Invoice {invoice_number} Now {days_overdue} Days Overdue",
        "body": """Dear {customer_name},

Our records indicate that invoice {invoice_number} for ${amount_due}, which was due on {due_date}, remains unpaid. This invoice is now {days_overdue} days overdue.

Please remit payment immediately to avoid service interruption. If payment has been sent, please contact us with payment details.

Invoice Details:
- Invoice Number: {invoice_number}
- Amount Due: ${amount_due}
- Due Date: {due_date}
- Days Overdue: {days_overdue}

If you are experiencing difficulty with payment, please contact us to discuss payment arrangements.

Regards,
Accounts Receivable Department
""",
    },
    DunningLevel.FINAL_WARNING: {
        "tone": "urgent",
        "subject": "FINAL NOTICE: Invoice {invoice_number} - Immediate Payment Required",
        "body": """URGENT: FINAL NOTICE

Dear {customer_name},

This is a final notice regarding invoice {invoice_number} for ${amount_due}, which is now {days_overdue} days overdue.

IMMEDIATE ACTION REQUIRED:
Payment must be received within 7 business days to avoid:
1. Service suspension
2. Legal action
3. Additional collection fees
4. Negative credit reporting

Invoice Details:
- Invoice Number: {invoice_number}
- Amount Due: ${amount_due}
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

If payment is not received or payment arrangements are not made within 7 days, this account will be escalated to our collections department.

Contact us immediately: [phone] or [email]

Collections Department
""",
    },
    DunningLevel.COLLECTIONS: {
        "tone": "severe",
        "subject": "COLLECTIONS NOTICE: Invoice {invoice_number} Escalated",
        "body": """COLLECTIONS NOTICE

Dear {customer_name},

Your account has been escalated to our collections department. Invoice {invoice_number} for ${amount_due} is now {days_overdue} days overdue.

This account is subject to:
- Legal proceedings
- Collection agency referral
- Credit bureau reporting
- Additional fees and interest
- Attorney fees if litigation is required

FINAL OPPORTUNITY TO RESOLVE:
Contact our collections department within 48 hours to arrange immediate payment or negotiate a settlement.

Failure to respond will result in further legal action.

Collections Department
Reference Number: {invoice_number}
Amount Due: ${amount_due}
""",
    },
}


# ---------------------------------------------------------------------------
# Pure Functions (No DB - easy to test)
# ---------------------------------------------------------------------------


def get_dunning_level(days_overdue: int) -> DunningLevel:
    """
    Determine dunning level based on days overdue.

    Pure function - no database access, easily testable.

    Args:
        days_overdue: Number of days invoice is overdue

    Returns:
        Appropriate DunningLevel
    """
    if days_overdue >= 45:
        return DunningLevel.COLLECTIONS
    elif days_overdue >= 30:
        return DunningLevel.FINAL_WARNING
    elif days_overdue >= 14:
        return DunningLevel.FORMAL_NOTICE
    elif days_overdue >= 7:
        return DunningLevel.FRIENDLY_REMINDER
    else:
        # Not yet overdue enough for dunning
        return DunningLevel.FRIENDLY_REMINDER


def calculate_days_overdue(due_date: date, reference_date: date | None = None) -> int:
    """
    Calculate number of days invoice is overdue.

    Pure function.

    Args:
        due_date: Invoice due date
        reference_date: Date to calculate from (defaults to today)

    Returns:
        Number of days overdue (negative if not yet due)
    """
    if reference_date is None:
        reference_date = date.today()

    delta = reference_date - due_date
    return delta.days


def generate_dunning_letter(
    invoice_number: str,
    customer_name: str,
    amount_due: Decimal,
    due_date: date,
    level: DunningLevel,
    reference_date: date | None = None,
) -> DunningLetter:
    """
    Generate dunning letter with appropriate tone and content.

    Pure function - returns data structure, doesn't send anything.

    Args:
        invoice_number: Invoice number
        customer_name: Customer name
        amount_due: Amount owed
        due_date: Original due date
        level: Dunning escalation level
        reference_date: Date for calculation (defaults to today)

    Returns:
        DunningLetter with populated content
    """
    days_overdue = calculate_days_overdue(due_date, reference_date)

    template = DUNNING_TEMPLATES[level]

    # Format placeholders
    context = {
        "invoice_number": invoice_number,
        "customer_name": customer_name,
        "amount_due": f"{amount_due:.2f}",
        "due_date": due_date.strftime("%Y-%m-%d"),
        "days_overdue": days_overdue,
    }

    subject = template["subject"].format(**context)
    body = template["body"].format(**context)

    return DunningLetter(
        level=level,
        subject=subject,
        body=body,
        tone=template["tone"],
        days_overdue=days_overdue,
        amount_due=amount_due,
    )


def should_send_dunning_pure(
    due_date: date,
    last_dunning_sent: datetime | None,
    amount_due: Decimal,
    reference_date: date | None = None,
) -> DunningCheck:
    """
    Check if dunning letter should be sent (pure function).

    Pure function - only logic, no I/O.

    Args:
        due_date: Invoice due date
        last_dunning_sent: When last dunning was sent
        amount_due: Amount still owed
        reference_date: Date for calculation (defaults to today)

    Returns:
        DunningCheck indicating whether to send and at what level
    """
    if reference_date is None:
        reference_date = date.today()

    days_overdue = calculate_days_overdue(due_date, reference_date)

    # Not overdue enough yet
    if days_overdue < 7:
        return DunningCheck(
            should_send=False,
            level=None,
            days_overdue=days_overdue,
            reason=f"Not yet due (only {days_overdue} days overdue)",
        )

    # Already paid
    if amount_due <= Decimal("0"):
        return DunningCheck(
            should_send=False,
            level=None,
            days_overdue=days_overdue,
            reason="Invoice already paid",
        )

    # Determine appropriate level
    level = get_dunning_level(days_overdue)

    # Check if already sent today
    if last_dunning_sent:
        last_sent_date = last_dunning_sent.date()
        if last_sent_date == reference_date:
            return DunningCheck(
                should_send=False,
                level=level,
                days_overdue=days_overdue,
                reason="Dunning already sent today",
            )

    # All checks passed - should send
    return DunningCheck(
        should_send=True,
        level=level,
        days_overdue=days_overdue,
        reason=f"Level {level.value} dunning due ({days_overdue} days overdue)",
    )


def get_dunning_schedule() -> dict[int, str]:
    """
    Get dunning schedule map.

    Pure function - returns static data.

    Returns:
        Dictionary mapping days overdue to dunning action
    """
    return {
        7: "Send friendly reminder",
        14: "Send formal notice",
        30: "Send final warning",
        45: "Escalate to collections",
    }


# ---------------------------------------------------------------------------
# Async DB Wrapper Functions
# ---------------------------------------------------------------------------


async def should_send_dunning(
    db: AsyncSession,
    invoice_id: UUID,
) -> DunningCheck:
    """
    Check if dunning letter should be sent for invoice (async DB wrapper).

    Fetches invoice from DB, then calls pure function for check.

    Args:
        db: Database session
        invoice_id: Invoice ID

    Returns:
        DunningCheck indicating whether to send dunning
    """
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        logger.warning("invoice_not_found", invoice_id=str(invoice_id))
        return DunningCheck(
            should_send=False,
            level=None,
            days_overdue=0,
            reason="Invoice not found",
        )

    # In real system, would track last_dunning_sent in DB
    # For now, use None (first dunning)
    last_dunning_sent = None

    # Call pure function
    check_result = should_send_dunning_pure(
        due_date=invoice.due_date,
        last_dunning_sent=last_dunning_sent,
        amount_due=invoice.amount_due,
    )

    logger.info(
        "dunning_check_complete",
        invoice_id=str(invoice_id),
        should_send=check_result.should_send,
        level=check_result.level.value if check_result.level else None,
        days_overdue=check_result.days_overdue,
        reason=check_result.reason,
    )

    return check_result


async def generate_dunning_for_invoice(
    db: AsyncSession,
    invoice_id: UUID,
) -> DunningLetter | None:
    """
    Generate dunning letter for invoice (async DB wrapper).

    Args:
        db: Database session
        invoice_id: Invoice ID

    Returns:
        DunningLetter if should be sent, None otherwise
    """
    # Check if should send
    check = await should_send_dunning(db, invoice_id)

    if not check.should_send or check.level is None:
        return None

    # Fetch invoice for details
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        return None

    # In real system, would fetch customer name from Customer table
    customer_name = "Valued Customer"

    # Generate letter (pure function)
    letter = generate_dunning_letter(
        invoice_number=invoice.invoice_number,
        customer_name=customer_name,
        amount_due=invoice.amount_due,
        due_date=invoice.due_date,
        level=check.level,
    )

    logger.info(
        "dunning_letter_generated",
        invoice_id=str(invoice_id),
        level=letter.level.value,
        tone=letter.tone,
    )

    return letter
