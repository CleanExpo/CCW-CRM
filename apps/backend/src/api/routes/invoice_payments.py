"""Invoice payment API endpoints for UNI-173."""
from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas.invoicing import (
    InvoicePaymentCreate,
    InvoicePaymentUpdate,
    InvoicePaymentResponse,
    PaymentListResponse,
)
from src.config.database import get_async_db
from src.db.models.invoicing import Invoice, InvoicePayment

router = APIRouter(prefix="/api/invoices", tags=["Invoice Payments"])


async def update_invoice_payment_status(
    invoice: Invoice,
    db: AsyncSession
) -> None:
    """Update invoice payment status based on amount paid."""
    # Recalculate amount_paid from all payments
    result = await db.execute(
        select(func.sum(InvoicePayment.amount))
        .where(InvoicePayment.invoice_id == invoice.id)
    )
    total_paid = result.scalar() or Decimal("0")

    invoice.amount_paid = total_paid
    invoice.amount_due = invoice.total - total_paid

    # Update status
    if invoice.amount_paid >= invoice.total:
        invoice.status = "paid"
    elif invoice.amount_paid > 0:
        invoice.status = "partial"
    elif invoice.due_date < datetime.utcnow().date() and invoice.status == "sent":
        invoice.status = "overdue"

    invoice.updated_at = datetime.utcnow()


@router.get("/{invoice_id}/payments", response_model=list[InvoicePaymentResponse])
async def list_invoice_payments(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[InvoicePaymentResponse]:
    """List all payments for an invoice."""
    # Verify invoice exists
    invoice_result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    if not invoice_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Get payments
    result = await db.execute(
        select(InvoicePayment)
        .where(InvoicePayment.invoice_id == invoice_id)
        .order_by(InvoicePayment.payment_date.desc())
    )
    payments = result.scalars().all()

    return [InvoicePaymentResponse.model_validate(p) for p in payments]


@router.post("/{invoice_id}/payments", response_model=InvoicePaymentResponse, status_code=201)
async def record_payment(
    invoice_id: UUID,
    data: InvoicePaymentCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoicePaymentResponse:
    """Record a payment against an invoice."""
    # Get invoice
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cannot record payment for cancelled invoice"
        )

    # Validate payment amount
    if data.amount > invoice.amount_due:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ${data.amount} exceeds outstanding amount ${invoice.amount_due}"
        )

    # Create payment record
    payment = InvoicePayment(
        invoice_id=invoice_id,
        amount=data.amount,
        payment_method=data.payment_method,
        payment_date=data.payment_date,
        reference_number=data.reference_number,
        notes=data.notes,
    )

    db.add(payment)
    await db.flush()

    # Update invoice payment status
    await update_invoice_payment_status(invoice, db)

    await db.commit()
    await db.refresh(payment)

    return InvoicePaymentResponse.model_validate(payment)


@router.get("/payments", response_model=PaymentListResponse)
async def list_all_payments(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    invoice_id: UUID | None = None,
    payment_method: str | None = None,
) -> PaymentListResponse:
    """List all payments with pagination and filters."""
    query = select(InvoicePayment)

    # Apply filters
    if invoice_id:
        query = query.where(InvoicePayment.invoice_id == invoice_id)

    if payment_method:
        query = query.where(InvoicePayment.payment_method == payment_method)

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(InvoicePayment.payment_date.desc())
    query = query.limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    payments = result.scalars().all()

    return PaymentListResponse(
        items=[InvoicePaymentResponse.model_validate(p) for p in payments],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.delete("/payments/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Delete a payment record (admin only)."""
    # Get payment
    result = await db.execute(
        select(InvoicePayment).where(InvoicePayment.id == payment_id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice_id = payment.invoice_id

    # Delete payment
    await db.delete(payment)
    await db.flush()

    # Update invoice status
    invoice_result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = invoice_result.scalar_one()
    await update_invoice_payment_status(invoice, db)

    await db.commit()
