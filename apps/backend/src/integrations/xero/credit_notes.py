"""Xero credit note synchronization logic (UNI-1814).

Pushes credit notes issued in the ERP to Xero as ACCREC credit notes,
reducing accounts receivable to match the adjustment note.
"""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroAPIError

logger = structlog.get_logger(__name__)


async def push_credit_note(
    db: AsyncSession,
    organization_id: UUID,
    credit_note_id: UUID,
    xero_auth: XeroAuth,
) -> str | None:
    """Push a credit note to Xero and return the Xero CreditNoteID.

    Called automatically when a credit note is issued via
    POST /api/credit-notes/{id}/issue.

    If no active Xero connection exists for the organization, logs a warning
    and returns None (non-blocking — the credit note is still issued locally).

    Args:
        db: Async database session
        organization_id: Organization UUID
        credit_note_id: CreditNote UUID
        xero_auth: XeroAuth instance for token management

    Returns:
        Xero CreditNoteID string, or None if Xero is not connected.

    Raises:
        XeroAPIError: If the Xero API call fails (bubbles up to caller).
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from src.db.models.invoicing import CreditNote, Invoice
    from src.db.demo_models import Customer

    # Resolve Xero connection (non-blocking if absent)
    connection = await xero_auth.get_active_connection(db, organization_id)
    if not connection:
        logger.warning(
            "No active Xero connection — skipping credit note sync",
            organization_id=str(organization_id),
            credit_note_id=str(credit_note_id),
        )
        return None

    # Load credit note + invoice + customer
    stmt = (
        select(CreditNote)
        .where(CreditNote.id == credit_note_id)
        .options(
            selectinload(CreditNote.invoice).selectinload(Invoice.customer)
        )
    )
    result = await db.execute(stmt)
    cn = result.scalar_one_or_none()

    if not cn:
        raise ValueError(f"CreditNote {credit_note_id} not found")

    customer: Customer = cn.invoice.customer

    demo_mode = connection.access_token.startswith("demo_")
    xero_client = get_xero_client(
        access_token=connection.access_token,
        tenant_id=connection.tenant_id,
        demo_mode=demo_mode,
    )

    try:
        # Resolve or create Xero contact
        contact = await xero_client.get_contact_by_email(customer.email)
        if not contact:
            contact = await xero_client.create_contact(
                name=customer.company_name,
                email=customer.email,
                phone=getattr(customer, "phone", None),
            )

        xero_cn = await xero_client.create_credit_note(
            contact_id=contact["ContactID"],
            description=(
                f"Credit note for invoice {cn.invoice.invoice_number}: {cn.reason}"
            ),
            amount=float(cn.amount),
            reference=cn.credit_note_number,
        )

        xero_cn_id: str = xero_cn["CreditNoteID"]

        logger.info(
            "Credit note pushed to Xero",
            credit_note_id=str(credit_note_id),
            credit_note_number=cn.credit_note_number,
            xero_credit_note_id=xero_cn_id,
        )

        return xero_cn_id

    except XeroAPIError:
        logger.error(
            "Failed to push credit note to Xero",
            credit_note_id=str(credit_note_id),
        )
        raise

    finally:
        await xero_client.close()
