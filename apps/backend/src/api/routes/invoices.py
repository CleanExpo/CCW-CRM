"""Invoice API endpoints for UNI-173."""
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.schemas.invoicing import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceSummary,
    InvoiceListResponse,
)
from src.config.database import get_async_db
from src.db.models.invoicing import Invoice, InvoiceItem
from src.db.demo_models import Customer

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


async def generate_invoice_number(db: AsyncSession) -> str:
    """Generate unique invoice number in format INV-YYYY-NNNN."""
    current_year = datetime.utcnow().year
    prefix = f"INV-{current_year}-"

    # Get the highest invoice number for current year
    result = await db.execute(
        select(func.max(Invoice.invoice_number))
        .where(Invoice.invoice_number.like(f"{prefix}%"))
    )
    last_number = result.scalar()

    if last_number:
        # Extract the sequence number and increment
        sequence = int(last_number.split("-")[-1]) + 1
    else:
        # First invoice of the year
        sequence = 1

    return f"{prefix}{sequence:04d}"


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: str | None = None,
    customer_id: UUID | None = None,
    search: str | None = None,
) -> InvoiceListResponse:
    """List invoices with pagination and filters."""
    query = select(Invoice).options(selectinload(Invoice.customer))

    # Apply filters
    if status:
        query = query.where(Invoice.status == status)

    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)

    if search:
        query = query.where(
            or_(
                Invoice.invoice_number.ilike(f"%{search}%"),
                Invoice.notes.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Invoice.created_at.desc())
    query = query.limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    invoices = result.scalars().all()

    # Convert to summary format
    summaries = [
        InvoiceSummary(
            id=inv.id,
            invoice_number=inv.invoice_number,
            customer_id=inv.customer_id,
            customer_name=inv.customer.company_name if inv.customer else None,
            issue_date=inv.issue_date,
            due_date=inv.due_date,
            status=inv.status,
            total=inv.total,
            amount_paid=inv.amount_paid,
            amount_due=inv.amount_due,
            created_at=inv.created_at,
        )
        for inv in invoices
    ]

    return InvoiceListResponse(
        items=summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoiceResponse:
    """Get invoice details."""
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return InvoiceResponse.model_validate(invoice)


@router.post("", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoiceResponse:
    """Create new invoice."""
    # Verify customer exists
    customer_result = await db.execute(
        select(Customer).where(Customer.id == data.customer_id)
    )
    if not customer_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    # Generate invoice number
    invoice_number = await generate_invoice_number(db)

    # Calculate totals from items
    subtotal = sum(item.subtotal for item in data.items)
    tax_amount = sum(item.tax_amount for item in data.items)
    total = subtotal + tax_amount

    # Create invoice
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=data.customer_id,
        order_id=data.order_id,
        issue_date=data.issue_date,
        due_date=data.due_date,
        status="draft",
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        amount_paid=0,
        amount_due=total,
        notes=data.notes,
        payment_terms=data.payment_terms,
    )

    db.add(invoice)
    await db.flush()

    # Create invoice items
    for item_data in data.items:
        item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item_data.product_id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            tax_rate=item_data.tax_rate,
            tax_amount=item_data.tax_amount,
            subtotal=item_data.subtotal,
            total=item_data.total,
        )
        db.add(item)

    await db.commit()
    await db.refresh(invoice)

    # Load items for response
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice.id)
    )
    loaded_invoice = result.scalar_one()

    return InvoiceResponse.model_validate(loaded_invoice)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoiceResponse:
    """Update invoice (draft only)."""
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be updated"
        )

    # Update fields
    if data.customer_id is not None:
        # Verify customer exists
        customer_result = await db.execute(
            select(Customer).where(Customer.id == data.customer_id)
        )
        if not customer_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Customer not found")
        invoice.customer_id = data.customer_id

    if data.issue_date is not None:
        invoice.issue_date = data.issue_date

    if data.due_date is not None:
        invoice.due_date = data.due_date

    if data.notes is not None:
        invoice.notes = data.notes

    if data.payment_terms is not None:
        invoice.payment_terms = data.payment_terms

    if data.status is not None:
        invoice.status = data.status

    invoice.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(invoice)

    return InvoiceResponse.model_validate(invoice)


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Delete invoice (draft only)."""
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be deleted"
        )

    await db.delete(invoice)
    await db.commit()


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoiceResponse:
    """Mark invoice as sent."""
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be sent"
        )

    invoice.status = "sent"
    invoice.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(invoice)

    return InvoiceResponse.model_validate(invoice)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoiceResponse:
    """Cancel invoice."""
    result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status in ("paid", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel paid or already cancelled invoices"
        )

    invoice.status = "cancelled"
    invoice.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(invoice)

    return InvoiceResponse.model_validate(invoice)
