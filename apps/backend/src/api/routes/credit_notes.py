"""Credit note API endpoints (UNI-1810, UNI-1814).

Endpoints:
  POST /api/invoices/{invoice_id}/credit-notes  — create a credit note
  POST /api/credit-notes/{id}/issue             — issue a credit note + sync to Xero
  GET  /api/credit-notes/{id}                   — retrieve a credit note
"""
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.middleware.tenant_isolation import CurrentOrganization
from src.api.schemas.invoicing import CreditNoteCreate, CreditNoteResponse
from src.config.database import get_async_db
from src.config.xero_settings import XeroSettings, get_xero_settings
from src.db.models.invoicing import CreditNote, Invoice
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.credit_notes import push_credit_note

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["Credit Notes"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_xero_auth(settings: Annotated[XeroSettings, Depends(get_xero_settings)]) -> XeroAuth:
    """Dependency: build a XeroAuth instance from settings."""
    return XeroAuth(
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        redirect_uri=settings.redirect_uri,
        scopes=settings.scopes_list,
    )


async def _generate_credit_note_number(db: AsyncSession, invoice_number: str) -> str:
    """Generate a sequential credit note number: CN-{invoice_number}-{seq}.

    Example: CN-INV-2026-0001-1
    """
    prefix = f"CN-{invoice_number}-"
    result = await db.execute(
        select(func.count(CreditNote.id)).where(
            CreditNote.credit_note_number.like(f"{prefix}%")
        )
    )
    existing_count: int = result.scalar() or 0
    return f"{prefix}{existing_count + 1}"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "/api/invoices/{invoice_id}/credit-notes",
    response_model=CreditNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_credit_note(
    invoice_id: UUID,
    body: CreditNoteCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CreditNoteResponse:
    """Create a draft credit note against an invoice.

    - amount must be > 0 and <= invoice total
    - Credit note is created in 'draft' status; call /issue to finalise.
    """
    # Load invoice
    stmt = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if body.amount > invoice.total:
        raise HTTPException(
            status_code=400,
            detail=f"Credit note amount ({body.amount}) exceeds invoice total ({invoice.total})",
        )

    credit_note_number = await _generate_credit_note_number(db, invoice.invoice_number)

    cn = CreditNote(
        invoice_id=invoice_id,
        credit_note_number=credit_note_number,
        reason=body.reason,
        amount=body.amount,
        status="draft",
    )
    db.add(cn)
    await db.commit()
    await db.refresh(cn)

    logger.info(
        "Credit note created",
        credit_note_id=str(cn.id),
        credit_note_number=credit_note_number,
        invoice_id=str(invoice_id),
        amount=str(body.amount),
    )

    return CreditNoteResponse.model_validate(cn)


@router.post(
    "/api/credit-notes/{credit_note_id}/issue",
    response_model=CreditNoteResponse,
)
async def issue_credit_note(
    credit_note_id: UUID,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(_get_xero_auth)],
) -> CreditNoteResponse:
    """Issue a draft credit note.

    - Sets status to 'issued' and records issued_at timestamp.
    - Reduces the originating invoice's amount_due by the credit note amount.
    - Pushes the credit note to Xero (non-blocking if Xero is not connected).
    """
    stmt = (
        select(CreditNote)
        .where(CreditNote.id == credit_note_id)
        .options(selectinload(CreditNote.invoice))
    )
    result = await db.execute(stmt)
    cn = result.scalar_one_or_none()

    if not cn:
        raise HTTPException(status_code=404, detail="Credit note not found")

    if cn.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Credit note is already '{cn.status}' — only draft credit notes can be issued",
        )

    # Update status
    cn.status = "issued"
    cn.issued_at = datetime.now(UTC)

    # Reduce invoice outstanding amount
    invoice: Invoice = cn.invoice
    new_amount_due = max(invoice.amount_due - cn.amount, 0)
    invoice.amount_due = new_amount_due

    await db.flush()

    # Push to Xero (non-blocking)
    try:
        xero_cn_id = await push_credit_note(
            db=db,
            organization_id=org_id,
            credit_note_id=cn.id,
            xero_auth=xero_auth,
        )
        if xero_cn_id:
            cn.xero_credit_note_id = xero_cn_id
    except Exception as exc:
        # Xero sync failure is non-blocking — log and continue
        logger.warning(
            "Xero credit note sync failed — continuing without Xero ID",
            credit_note_id=str(credit_note_id),
            error=str(exc),
        )

    await db.commit()
    await db.refresh(cn)

    logger.info(
        "Credit note issued",
        credit_note_id=str(cn.id),
        credit_note_number=cn.credit_note_number,
        invoice_id=str(invoice.id),
        xero_credit_note_id=cn.xero_credit_note_id,
    )

    return CreditNoteResponse.model_validate(cn)


@router.get(
    "/api/credit-notes/{credit_note_id}",
    response_model=CreditNoteResponse,
)
async def get_credit_note(
    credit_note_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CreditNoteResponse:
    """Retrieve a credit note by ID."""
    stmt = select(CreditNote).where(CreditNote.id == credit_note_id)
    result = await db.execute(stmt)
    cn = result.scalar_one_or_none()

    if not cn:
        raise HTTPException(status_code=404, detail="Credit note not found")

    return CreditNoteResponse.model_validate(cn)
