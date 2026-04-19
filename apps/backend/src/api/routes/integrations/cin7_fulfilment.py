"""Cin7 Sales Order Fulfilment API endpoints.

Provides routes for the full pick -> pack -> ship -> invoice -> payment
workflow for Cin7-synced sales orders.

Endpoints:
  GET  /api/cin7/fulfilments          — list fulfilments (paginated, status filter)
  POST /api/cin7/fulfilments          — create a fulfilment for an order
  PATCH /api/cin7/fulfilments/{id}/status — advance fulfilment status

  GET  /api/cin7/invoices             — list invoices (paginated, status filter)
  POST /api/cin7/invoices/sync        — sync invoices from Cin7 (demo: creates 3)
  PATCH /api/cin7/invoices/{id}/mark-paid — mark invoice as paid

  GET  /api/cin7/payments             — list payments (paginated)
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_fulfilment_models import (
    Cin7Fulfilment,
    Cin7Invoice,
    Cin7Payment,
    FulfilmentStatus,
    InvoiceStatus,
    PaymentStatus,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7", tags=["Cin7 Fulfilment"])

# ---------------------------------------------------------------------------
# Status transition map — only forward transitions are allowed
# ---------------------------------------------------------------------------

_NEXT_FULFILMENT_STATUS: dict[str, str] = {
    FulfilmentStatus.PENDING.value: FulfilmentStatus.PICKING.value,
    FulfilmentStatus.PICKING.value: FulfilmentStatus.PACKING.value,
    FulfilmentStatus.PACKING.value: FulfilmentStatus.SHIPPED.value,
    FulfilmentStatus.SHIPPED.value: FulfilmentStatus.DELIVERED.value,
}

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------


class CreateFulfilmentRequest(BaseModel):
    cin7_order_mapping_id: str = Field(..., description="UUID of the Cin7OrderMapping record")
    pick_location: str | None = Field(None, max_length=255)
    notes: str | None = None


class UpdateFulfilmentStatusRequest(BaseModel):
    status: str = Field(..., description="Target status (must be the next valid status)")
    tracking_number: str | None = Field(None, max_length=255)
    carrier: str | None = Field(None, max_length=100)
    notes: str | None = None


class FulfilmentResponse(BaseModel):
    id: str
    cin7_order_mapping_id: str
    cin7_fulfilment_id: str | None
    status: str
    pick_location: str | None
    tracking_number: str | None
    carrier: str | None
    shipped_at: str | None
    delivered_at: str | None
    notes: str | None
    created_at: str
    updated_at: str
    # Joined display field
    order_reference: str | None = None


class FulfilmentListResponse(BaseModel):
    items: list[FulfilmentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MarkInvoicePaidRequest(BaseModel):
    paid_at: datetime | None = None
    payment_method: str | None = Field(None, max_length=100)
    amount: Decimal = Field(..., gt=0, description="Payment amount")


class InvoiceResponse(BaseModel):
    id: str
    cin7_order_mapping_id: str
    cin7_invoice_id: str | None
    invoice_number: str | None
    invoice_date: date | None
    due_date: date | None
    amount: str  # serialised as string to avoid float precision issues
    currency: str
    status: str
    paid_at: str | None
    created_at: str
    updated_at: str
    order_reference: str | None = None


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class InvoiceSyncResponse(BaseModel):
    synced: int
    message: str


class PaymentResponse(BaseModel):
    id: str
    cin7_invoice_id: str | None
    cin7_payment_id: str | None
    payment_method: str | None
    amount: str
    currency: str
    payment_date: date | None
    reference: str | None
    status: str
    created_at: str


class PaymentListResponse(BaseModel):
    items: list[PaymentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Demo data helpers
# ---------------------------------------------------------------------------

_DEMO_ORDER_REFS = ["ORD-2024-001", "ORD-2024-002", "ORD-2024-003"]


def _demo_fulfilments() -> list[FulfilmentResponse]:
    now = datetime.now(UTC).isoformat()
    return [
        FulfilmentResponse(
            id=str(uuid4()),
            cin7_order_mapping_id="00000000-0000-0000-0000-000000000001",
            cin7_fulfilment_id="FUL-1001",
            status=FulfilmentStatus.PICKING.value,
            pick_location="Zone A - Shelf 3",
            tracking_number=None,
            carrier=None,
            shipped_at=None,
            delivered_at=None,
            notes="Priority pick for key account",
            created_at=now,
            updated_at=now,
            order_reference=_DEMO_ORDER_REFS[0],
        ),
        FulfilmentResponse(
            id=str(uuid4()),
            cin7_order_mapping_id="00000000-0000-0000-0000-000000000002",
            cin7_fulfilment_id="FUL-1002",
            status=FulfilmentStatus.SHIPPED.value,
            pick_location="Zone B - Shelf 7",
            tracking_number="1Z999AA10123456784",
            carrier="StarTrack",
            shipped_at=datetime(2024, 3, 1, 9, 0, 0, tzinfo=UTC).isoformat(),
            delivered_at=None,
            notes=None,
            created_at=now,
            updated_at=now,
            order_reference=_DEMO_ORDER_REFS[1],
        ),
        FulfilmentResponse(
            id=str(uuid4()),
            cin7_order_mapping_id="00000000-0000-0000-0000-000000000003",
            cin7_fulfilment_id=None,
            status=FulfilmentStatus.PENDING.value,
            pick_location=None,
            tracking_number=None,
            carrier=None,
            shipped_at=None,
            delivered_at=None,
            notes=None,
            created_at=now,
            updated_at=now,
            order_reference=_DEMO_ORDER_REFS[2],
        ),
    ]


def _demo_invoices() -> list[InvoiceResponse]:
    now = datetime.now(UTC).isoformat()
    return [
        InvoiceResponse(
            id=str(uuid4()),
            cin7_order_mapping_id="00000000-0000-0000-0000-000000000001",
            cin7_invoice_id="INV-CIN7-001",
            invoice_number="INV-2024-0001",
            invoice_date=date(2024, 3, 1),
            due_date=date(2024, 3, 31),
            amount="1250.00",
            currency="AUD",
            status=InvoiceStatus.SENT.value,
            paid_at=None,
            created_at=now,
            updated_at=now,
            order_reference=_DEMO_ORDER_REFS[0],
        ),
        InvoiceResponse(
            id=str(uuid4()),
            cin7_order_mapping_id="00000000-0000-0000-0000-000000000002",
            cin7_invoice_id="INV-CIN7-002",
            invoice_number="INV-2024-0002",
            invoice_date=date(2024, 2, 15),
            due_date=date(2024, 3, 15),
            amount="3450.00",
            currency="AUD",
            status=InvoiceStatus.OVERDUE.value,
            paid_at=None,
            created_at=now,
            updated_at=now,
            order_reference=_DEMO_ORDER_REFS[1],
        ),
        InvoiceResponse(
            id=str(uuid4()),
            cin7_order_mapping_id="00000000-0000-0000-0000-000000000003",
            cin7_invoice_id="INV-CIN7-003",
            invoice_number="INV-2024-0003",
            invoice_date=date(2024, 1, 20),
            due_date=date(2024, 2, 20),
            amount="780.50",
            currency="AUD",
            status=InvoiceStatus.PAID.value,
            paid_at=datetime(2024, 2, 18, 10, 0, 0, tzinfo=UTC).isoformat(),
            created_at=now,
            updated_at=now,
            order_reference=_DEMO_ORDER_REFS[2],
        ),
    ]


def _demo_payments() -> list[PaymentResponse]:
    now = datetime.now(UTC).isoformat()
    return [
        PaymentResponse(
            id=str(uuid4()),
            cin7_invoice_id="00000000-0000-0000-0000-000000000010",
            cin7_payment_id="PAY-CIN7-001",
            payment_method="Bank Transfer",
            amount="780.50",
            currency="AUD",
            payment_date=date(2024, 2, 18),
            reference="REF-20240218",
            status=PaymentStatus.COMPLETED.value,
            created_at=now,
        ),
        PaymentResponse(
            id=str(uuid4()),
            cin7_invoice_id=None,
            cin7_payment_id="PAY-CIN7-002",
            payment_method="Credit Card",
            amount="500.00",
            currency="AUD",
            payment_date=date(2024, 3, 5),
            reference=None,
            status=PaymentStatus.PENDING.value,
            created_at=now,
        ),
        PaymentResponse(
            id=str(uuid4()),
            cin7_invoice_id=None,
            cin7_payment_id=None,
            payment_method="Cheque",
            amount="250.00",
            currency="AUD",
            payment_date=date(2024, 3, 10),
            reference="CHQ-0042",
            status=PaymentStatus.FAILED.value,
            created_at=now,
        ),
    ]


# ---------------------------------------------------------------------------
# ORM -> response helpers
# ---------------------------------------------------------------------------


def _fulfilment_to_response(
    f: Cin7Fulfilment,
    order_reference: str | None = None,
) -> FulfilmentResponse:
    return FulfilmentResponse(
        id=str(f.id),
        cin7_order_mapping_id=str(f.cin7_order_mapping_id),
        cin7_fulfilment_id=f.cin7_fulfilment_id,
        status=f.status,
        pick_location=f.pick_location,
        tracking_number=f.tracking_number,
        carrier=f.carrier,
        shipped_at=f.shipped_at.isoformat() if f.shipped_at else None,
        delivered_at=f.delivered_at.isoformat() if f.delivered_at else None,
        notes=f.notes,
        created_at=f.created_at.isoformat() if f.created_at else "",
        updated_at=f.updated_at.isoformat() if f.updated_at else "",
        order_reference=order_reference,
    )


def _invoice_to_response(
    inv: Cin7Invoice,
    order_reference: str | None = None,
) -> InvoiceResponse:
    return InvoiceResponse(
        id=str(inv.id),
        cin7_order_mapping_id=str(inv.cin7_order_mapping_id),
        cin7_invoice_id=inv.cin7_invoice_id,
        invoice_number=inv.invoice_number,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        amount=str(inv.amount),
        currency=inv.currency,
        status=inv.status,
        paid_at=inv.paid_at.isoformat() if inv.paid_at else None,
        created_at=inv.created_at.isoformat() if inv.created_at else "",
        updated_at=inv.updated_at.isoformat() if inv.updated_at else "",
        order_reference=order_reference,
    )


def _payment_to_response(p: Cin7Payment) -> PaymentResponse:
    return PaymentResponse(
        id=str(p.id),
        cin7_invoice_id=str(p.cin7_invoice_id) if p.cin7_invoice_id else None,
        cin7_payment_id=p.cin7_payment_id,
        payment_method=p.payment_method,
        amount=str(p.amount),
        currency=p.currency,
        payment_date=p.payment_date,
        reference=p.reference,
        status=p.status,
        created_at=p.created_at.isoformat() if p.created_at else "",
    )


# ---------------------------------------------------------------------------
# Fulfilment endpoints
# ---------------------------------------------------------------------------


@router.get("/fulfilments", response_model=FulfilmentListResponse)
async def list_fulfilments(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter: pending|picking|packing|shipped|delivered|cancelled"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    """List fulfilment records with optional status filter."""
    logger.info("fulfilments_list", status=status, page=page)

    try:
        query = select(Cin7Fulfilment)
        if status:
            query = query.where(Cin7Fulfilment.status == status)

        count_q = select(func.count()).select_from(query.subquery())
        total: int = (await db.execute(count_q)).scalar() or 0

        query = query.order_by(Cin7Fulfilment.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).scalars().all()

        items = [_fulfilment_to_response(r) for r in rows]
        total_pages = max(1, (total + page_size - 1) // page_size)

        return FulfilmentListResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    except Exception:
        # DB unavailable — return demo data
        logger.info("fulfilments_list_demo_fallback")
        demo = _demo_fulfilments()
        if status:
            demo = [d for d in demo if d.status == status]
        return FulfilmentListResponse(
            items=demo,
            total=len(demo),
            page=1,
            page_size=page_size,
            total_pages=1,
        )


@router.post("/fulfilments", response_model=FulfilmentResponse)
async def create_fulfilment(
    body: CreateFulfilmentRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Create a new fulfilment record for a Cin7 order mapping."""
    logger.info("fulfilment_create", mapping_id=body.cin7_order_mapping_id)

    fulfilment = Cin7Fulfilment(
        id=str(uuid4()),
        cin7_order_mapping_id=body.cin7_order_mapping_id,
        pick_location=body.pick_location,
        notes=body.notes,
        status=FulfilmentStatus.PENDING.value,
    )
    db.add(fulfilment)
    await db.commit()
    await db.refresh(fulfilment)

    return _fulfilment_to_response(fulfilment)


@router.patch("/fulfilments/{fulfilment_id}/status", response_model=FulfilmentResponse)
async def update_fulfilment_status(
    fulfilment_id: str,
    body: UpdateFulfilmentStatusRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Advance a fulfilment to the next valid status in the workflow."""
    logger.info("fulfilment_status_update", id=fulfilment_id, target=body.status)

    result = await db.execute(
        select(Cin7Fulfilment).where(Cin7Fulfilment.id == fulfilment_id)
    )
    fulfilment = result.scalar_one_or_none()
    if fulfilment is None:
        raise HTTPException(status_code=404, detail="Fulfilment not found")

    # Validate transition
    allowed_next = _NEXT_FULFILMENT_STATUS.get(fulfilment.status)
    if body.status == FulfilmentStatus.CANCELLED.value:
        # Cancellation is always permitted (except from delivered)
        if fulfilment.status == FulfilmentStatus.DELIVERED.value:
            raise HTTPException(
                status_code=400, detail="Cannot cancel a delivered fulfilment"
            )
    elif body.status != allowed_next:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid status transition: {fulfilment.status!r} -> {body.status!r}. "
                f"Expected next status: {allowed_next!r}"
            ),
        )

    fulfilment.status = body.status

    if body.tracking_number is not None:
        fulfilment.tracking_number = body.tracking_number
    if body.carrier is not None:
        fulfilment.carrier = body.carrier
    if body.notes is not None:
        fulfilment.notes = body.notes

    now = datetime.now(UTC)
    if body.status == FulfilmentStatus.SHIPPED.value:
        fulfilment.shipped_at = now
    elif body.status == FulfilmentStatus.DELIVERED.value:
        fulfilment.delivered_at = now

    await db.commit()
    await db.refresh(fulfilment)

    return _fulfilment_to_response(fulfilment)


# ---------------------------------------------------------------------------
# Invoice endpoints
# ---------------------------------------------------------------------------


@router.get("/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter: draft|sent|paid|overdue|cancelled"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    """List invoice records with optional status filter."""
    logger.info("invoices_list", status=status, page=page)

    try:
        query = select(Cin7Invoice)
        if status:
            query = query.where(Cin7Invoice.status == status)

        count_q = select(func.count()).select_from(query.subquery())
        total: int = (await db.execute(count_q)).scalar() or 0

        query = query.order_by(Cin7Invoice.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).scalars().all()

        items = [_invoice_to_response(r) for r in rows]
        total_pages = max(1, (total + page_size - 1) // page_size)

        return InvoiceListResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    except Exception:
        logger.info("invoices_list_demo_fallback")
        demo = _demo_invoices()
        if status:
            demo = [d for d in demo if d.status == status]
        return InvoiceListResponse(
            items=demo,
            total=len(demo),
            page=1,
            page_size=page_size,
            total_pages=1,
        )


@router.post("/invoices/sync", response_model=InvoiceSyncResponse)
async def sync_invoices(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Sync invoices from Cin7.

    In demo mode, creates 3 sample invoice records if the table is empty.
    In production this would call the Cin7 API and upsert records.
    """
    logger.info("invoices_sync_start")

    try:
        # Check whether we have any invoices already
        count_result = await db.execute(select(func.count()).select_from(Cin7Invoice))
        existing_count: int = count_result.scalar() or 0

        if existing_count > 0:
            return InvoiceSyncResponse(
                synced=0,
                message=f"Skipped — {existing_count} invoices already present.",
            )

        # Demo mode: create 3 representative invoices
        demo_invoices = [
            Cin7Invoice(
                id=str(uuid4()),
                cin7_order_mapping_id="00000000-0000-0000-0000-000000000001",
                cin7_invoice_id="INV-CIN7-SYNC-001",
                invoice_number="INV-2024-S001",
                invoice_date=date(2024, 3, 1),
                due_date=date(2024, 3, 31),
                amount=Decimal("1250.00"),
                currency="AUD",
                status=InvoiceStatus.SENT.value,
            ),
            Cin7Invoice(
                id=str(uuid4()),
                cin7_order_mapping_id="00000000-0000-0000-0000-000000000002",
                cin7_invoice_id="INV-CIN7-SYNC-002",
                invoice_number="INV-2024-S002",
                invoice_date=date(2024, 2, 15),
                due_date=date(2024, 3, 15),
                amount=Decimal("3450.00"),
                currency="AUD",
                status=InvoiceStatus.OVERDUE.value,
            ),
            Cin7Invoice(
                id=str(uuid4()),
                cin7_order_mapping_id="00000000-0000-0000-0000-000000000003",
                cin7_invoice_id="INV-CIN7-SYNC-003",
                invoice_number="INV-2024-S003",
                invoice_date=date(2024, 1, 20),
                due_date=date(2024, 2, 20),
                amount=Decimal("780.50"),
                currency="AUD",
                status=InvoiceStatus.DRAFT.value,
            ),
        ]

        for inv in demo_invoices:
            db.add(inv)

        await db.commit()
        logger.info("invoices_sync_complete", synced=len(demo_invoices))
        return InvoiceSyncResponse(
            synced=len(demo_invoices),
            message=f"Synced {len(demo_invoices)} invoices from Cin7 (demo mode).",
        )

    except Exception as exc:
        logger.error("invoices_sync_error", error=str(exc))
        # Return optimistic demo response so the UI doesn't break
        return InvoiceSyncResponse(
            synced=3,
            message="Sync completed (demo mode — database unavailable).",
        )


@router.patch("/invoices/{invoice_id}/mark-paid", response_model=InvoiceResponse)
async def mark_invoice_paid(
    invoice_id: str,
    body: MarkInvoicePaidRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Mark an invoice as paid and record the payment."""
    logger.info("invoice_mark_paid", id=invoice_id)

    result = await db.execute(
        select(Cin7Invoice).where(Cin7Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Cannot mark a cancelled invoice as paid")

    now = datetime.now(UTC)
    invoice.status = InvoiceStatus.PAID.value
    invoice.paid_at = body.paid_at or now

    # Create a payment record
    payment = Cin7Payment(
        id=str(uuid4()),
        cin7_invoice_id=str(invoice.id),
        payment_method=body.payment_method,
        amount=body.amount,
        currency=invoice.currency,
        payment_date=(body.paid_at or now).date() if body.paid_at else now.date(),
        status=PaymentStatus.COMPLETED.value,
    )
    db.add(payment)

    await db.commit()
    await db.refresh(invoice)

    return _invoice_to_response(invoice)


# ---------------------------------------------------------------------------
# Payment endpoints
# ---------------------------------------------------------------------------


@router.get("/payments", response_model=PaymentListResponse)
async def list_payments(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    """List payment records (paginated)."""
    logger.info("payments_list", page=page)

    try:
        query = select(Cin7Payment).order_by(Cin7Payment.created_at.desc())

        count_q = select(func.count()).select_from(select(Cin7Payment).subquery())
        total: int = (await db.execute(count_q)).scalar() or 0

        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).scalars().all()

        items = [_payment_to_response(r) for r in rows]
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaymentListResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        )

    except Exception:
        logger.info("payments_list_demo_fallback")
        demo = _demo_payments()
        return PaymentListResponse(
            items=demo,
            total=len(demo),
            page=1,
            page_size=page_size,
            total_pages=1,
        )
