"""Invoice API endpoints for UNI-173."""
import uuid as _uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.schemas.invoicing import (
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceSummary,
    InvoiceUpdate,
    RevenueSummary,
    TaxByRate,
    TaxRateResponse,
    TaxSummary,
)
from src.config.database import get_async_db
from src.db.demo_models import Customer, Order, OrderItem
from src.db.models.invoicing import Invoice, InvoiceItem, TaxRate

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
    date_from: date | None = None,
    date_to: date | None = None,
    overdue_only: bool = False,
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

    if date_from:
        query = query.where(Invoice.invoice_date >= date_from)

    if date_to:
        query = query.where(Invoice.invoice_date <= date_to)

    if overdue_only:
        query = query.where(
            Invoice.due_date < date.today(),
            Invoice.status.in_(["sent", "partial"]),
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
            invoice_date=inv.invoice_date,
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


@router.get("/reports/revenue", response_model=RevenueSummary)
async def get_revenue_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    date_from: date | None = None,
    date_to: date | None = None,
) -> RevenueSummary:
    """Get revenue summary for financial dashboard."""
    # Base query filtered by date range if provided
    def apply_date_filters(q):  # type: ignore[no-untyped-def]
        if date_from:
            q = q.where(Invoice.invoice_date >= date_from)
        if date_to:
            q = q.where(Invoice.invoice_date <= date_to)
        return q

    # total_revenue: SUM of total where status NOT in ('draft', 'cancelled')
    revenue_q = select(func.coalesce(func.sum(Invoice.total), 0)).where(
        Invoice.status.notin_(["draft", "cancelled"])
    )
    revenue_q = apply_date_filters(revenue_q)
    total_revenue = (await db.execute(revenue_q)).scalar() or Decimal("0")

    # total_outstanding: SUM of amount_due where status in ('sent', 'partial', 'overdue')
    outstanding_q = select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
        Invoice.status.in_(["sent", "partial", "overdue"])
    )
    outstanding_q = apply_date_filters(outstanding_q)
    total_outstanding = (await db.execute(outstanding_q)).scalar() or Decimal("0")

    # total_overdue: SUM of amount_due where status = 'overdue'
    overdue_q = select(func.coalesce(func.sum(Invoice.amount_due), 0)).where(
        Invoice.status == "overdue"
    )
    overdue_q = apply_date_filters(overdue_q)
    total_overdue = (await db.execute(overdue_q)).scalar() or Decimal("0")

    # invoice_count: COUNT of all non-cancelled invoices
    count_q = select(func.count(Invoice.id)).where(Invoice.status != "cancelled")
    count_q = apply_date_filters(count_q)
    invoice_count = (await db.execute(count_q)).scalar() or 0

    # paid_invoice_count: COUNT where status = 'paid'
    paid_q = select(func.count(Invoice.id)).where(Invoice.status == "paid")
    paid_q = apply_date_filters(paid_q)
    paid_invoice_count = (await db.execute(paid_q)).scalar() or 0

    # overdue_invoice_count: COUNT where status = 'overdue'
    overdue_count_q = select(func.count(Invoice.id)).where(Invoice.status == "overdue")
    overdue_count_q = apply_date_filters(overdue_count_q)
    overdue_invoice_count = (await db.execute(overdue_count_q)).scalar() or 0

    # period_start: date_from or earliest invoice date
    if date_from:
        period_start = date_from
    else:
        earliest_q = select(func.min(Invoice.invoice_date))
        period_start = (await db.execute(earliest_q)).scalar() or date.today()

    period_end = date_to or date.today()

    return RevenueSummary(
        total_revenue=Decimal(str(total_revenue)),
        total_outstanding=Decimal(str(total_outstanding)),
        total_overdue=Decimal(str(total_overdue)),
        invoice_count=int(invoice_count),
        paid_invoice_count=int(paid_invoice_count),
        overdue_invoice_count=int(overdue_invoice_count),
        period_start=period_start,
        period_end=period_end,
    )


@router.get("/reports/tax", response_model=TaxSummary)
async def get_tax_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    date_from: date | None = None,
    date_to: date | None = None,
) -> TaxSummary:
    """Get tax collected summary grouped by tax rate."""
    # Query invoice totals grouped by tax_rate, excluding draft/cancelled
    group_q = (
        select(
            Invoice.tax_rate,
            func.coalesce(func.sum(Invoice.tax_amount), 0).label("total_tax"),
            func.count(Invoice.id).label("invoice_count"),
        )
        .where(Invoice.status.notin_(["draft", "cancelled"]))
        .group_by(Invoice.tax_rate)
        .order_by(Invoice.tax_rate)
    )
    if date_from:
        group_q = group_q.where(Invoice.invoice_date >= date_from)
    if date_to:
        group_q = group_q.where(Invoice.invoice_date <= date_to)

    rows = (await db.execute(group_q)).all()

    tax_by_rate = [
        TaxByRate(
            tax_rate=Decimal(str(row.tax_rate)),
            total_tax=Decimal(str(row.total_tax)),
            invoice_count=int(row.invoice_count),
        )
        for row in rows
    ]

    total_tax_collected = sum(
        (t.total_tax for t in tax_by_rate), Decimal("0")
    )

    return TaxSummary(
        total_tax_collected=total_tax_collected,
        tax_by_rate=tax_by_rate,
    )


@router.get("/tax-rates", response_model=list[TaxRateResponse])
async def list_tax_rates(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[TaxRateResponse]:
    """List all active tax rates. Returns a default if none exist."""
    result = await db.execute(
        select(TaxRate).where(TaxRate.is_active.is_(True)).order_by(TaxRate.rate)
    )
    tax_rates = result.scalars().all()

    if not tax_rates:
        # Return a hardcoded default for Australian GST
        default_dt = datetime.now(UTC)
        return [
            TaxRateResponse(
                id=_uuid.UUID("00000000-0000-0000-0000-000000000001"),
                name="GST",
                rate=Decimal("10.00"),
                country="AU",
                is_default=True,
                is_active=True,
                created_at=default_dt,
            )
        ]

    return [TaxRateResponse.model_validate(tr) for tr in tax_rates]


@router.post("/from-order/{order_id}", response_model=InvoiceResponse, status_code=201)
async def generate_invoice_from_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> InvoiceResponse:
    """Generate an invoice from a confirmed or delivered order."""
    # 1. Load order with items and products
    order_result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.product)
        )
        .where(Order.id == order_id)
    )
    order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Check order status
    if order.status not in ("confirmed", "delivered"):
        raise HTTPException(
            status_code=400,
            detail="Can only generate invoices for confirmed or delivered orders",
        )

    # 3. Check no existing invoice for this order
    existing_result = await db.execute(
        select(Invoice.id).where(Invoice.order_id == order_id).limit(1)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Invoice already exists for this order",
        )

    # 4. Generate invoice number
    invoice_number = await generate_invoice_number(db)

    # 5. Build invoice dates
    today = date.today()
    due_date = today + timedelta(days=30)

    # 6. Pre-calculate item totals
    gst_rate = Decimal("10.00")
    gst_multiplier = gst_rate / Decimal("100")

    items_data = []
    for order_item in order.order_items:
        product_name = (
            order_item.product.name if order_item.product else f"Product {order_item.product_id}"
        )
        qty = Decimal(str(order_item.quantity))
        unit_price = Decimal(str(order_item.unit_price))
        item_subtotal = qty * unit_price
        item_tax = item_subtotal * gst_multiplier
        item_total = item_subtotal + item_tax
        items_data.append(
            {
                "description": product_name,
                "quantity": order_item.quantity,
                "unit_price": unit_price,
                "subtotal": item_subtotal,
                "tax_amount": item_tax,
                "total": item_total,
                "product_id": order_item.product_id,
            }
        )

    invoice_subtotal = sum(d["subtotal"] for d in items_data)
    invoice_tax = sum(d["tax_amount"] for d in items_data)
    invoice_total = invoice_subtotal + invoice_tax

    # 7. Create Invoice record
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=order.customer_id,
        order_id=order_id,
        invoice_date=today,
        due_date=due_date,
        status="draft",
        subtotal=invoice_subtotal,
        tax_rate=gst_rate,
        tax_amount=invoice_tax,
        total=invoice_total,
        amount_paid=Decimal("0.00"),
        amount_due=invoice_total,
        notes=f"Generated from order {order.order_number}",
        payment_terms="Net 30",
    )
    db.add(invoice)
    await db.flush()

    # 8. Create InvoiceItem records
    for item in items_data:
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=item["product_id"],
            description=item["description"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            tax_rate=gst_rate,
            tax_amount=item["tax_amount"],
            subtotal=item["subtotal"],
            total=item["total"],
        )
        db.add(invoice_item)

    await db.commit()
    await db.refresh(invoice)

    # 9. Return full invoice with items
    loaded_result = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(Invoice.id == invoice.id)
    )
    loaded_invoice = loaded_result.scalar_one()

    return InvoiceResponse.model_validate(loaded_invoice)


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
        invoice_date=data.invoice_date,
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

    if data.invoice_date is not None:
        invoice.invoice_date = data.invoice_date

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


@router.delete("/{invoice_id}", status_code=204, response_model=None)
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
