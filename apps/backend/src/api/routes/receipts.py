"""Digital receipt and thermal printer endpoints (UNI-1845)."""
import os
from datetime import datetime
from decimal import Decimal
from uuid import UUID
import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User
from src.db.pos_models import POSTransaction
from src.services.email_service import EmailService
logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/pos", tags=["POS Receipts"])
ABN_NUMBER = os.getenv("ABN_NUMBER", "")
BUSINESS_NAME = os.getenv("BUSINESS_NAME", "CCW Equipment")


class ReceiptResponse(BaseModel):
    receipt_number: str; transaction_id: UUID; transaction_date: datetime
    location: str; payment_method: str; amount: Decimal; gst_included: Decimal
    items: list[dict]; cashier: str | None; footer: str; abn: str


class EmailReceiptRequest(BaseModel):
    email: EmailStr


async def _load_txn(tid: UUID, db: AsyncSession) -> POSTransaction:
    r = await db.execute(
        select(POSTransaction).where(POSTransaction.id == tid)
        .options(selectinload(POSTransaction.location), selectinload(POSTransaction.sales_staff))
    )
    txn = r.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


def _build(txn: POSTransaction) -> ReceiptResponse:
    gst = (txn.amount * Decimal("10") / Decimal("110")).quantize(Decimal("0.01"))
    items: list[dict] = []
    if hasattr(txn, "order") and txn.order:
        for it in (txn.order.order_items or []):
            items.append({"name": it.product.name if it.product else str(it.product_id),
                          "qty": it.quantity, "unit_price": float(it.unit_price),
                          "line_total": float(it.line_total)})
    if not items:
        items = [{"name": f"Payment ({txn.payment_method})", "qty": 1,
                  "unit_price": float(txn.amount), "line_total": float(txn.amount)}]
    return ReceiptResponse(
        receipt_number=f"RCT-{txn.transaction_number}", transaction_id=txn.id,
        transaction_date=txn.created_at,
        location=txn.location.name if txn.location else txn.location_code,
        payment_method=txn.payment_method, amount=txn.amount, gst_included=gst, items=items,
        cashier=txn.sales_staff.full_name if txn.sales_staff else None,
        footer=f"Thank you for your business. ABN: {ABN_NUMBER}", abn=ABN_NUMBER,
    )


@router.get("/transactions/{transaction_id}/receipt", response_model=ReceiptResponse)
async def get_receipt(transaction_id: UUID, db: AsyncSession = Depends(get_async_db),
                      _: User = Depends(get_current_user)) -> ReceiptResponse:
    """Structured digital receipt for a POS transaction."""
    return _build(await _load_txn(transaction_id, db))


@router.get("/transactions/{transaction_id}/receipt/raw", response_class=PlainTextResponse)
async def get_receipt_raw(transaction_id: UUID, db: AsyncSession = Depends(get_async_db),
                          _: User = Depends(get_current_user)) -> str:
    """ESC/POS formatted receipt for thermal printers."""
    txn = await _load_txn(transaction_id, db)
    r = _build(txn)
    lines = "".join(f"{i['name']} x{i['qty']}  ${i['line_total']:.2f}\n" for i in r.items)
    return (f"\x1b\x40\x1b\x61\x01{BUSINESS_NAME}\n"
            f"{txn.created_at.strftime('%Y-%m-%d %H:%M')}\n{txn.transaction_number}\n"
            f"\x1b\x61\x00{lines}---\nTotal: ${r.amount:.2f}\nGST: ${r.gst_included:.2f}\n\x1b\x69")


@router.get("/transactions/{transaction_id}/receipt/email")
async def email_receipt(transaction_id: UUID, body: EmailReceiptRequest,
                        db: AsyncSession = Depends(get_async_db),
                        _: User = Depends(get_current_user)) -> dict:
    """Send receipt to customer email address."""
    txn = await _load_txn(transaction_id, db)
    r = _build(txn)
    rows = "".join(f"<tr><td>{i['name']}</td><td>{i['qty']}</td>"
                   f"<td>${i['unit_price']:.2f}</td><td>${i['line_total']:.2f}</td></tr>"
                   for i in r.items)
    html = (f"<h2>{BUSINESS_NAME} — {r.receipt_number}</h2>"
            f"<p>{r.transaction_date} | {r.location} | {r.payment_method}</p>"
            f"<table border='1'><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>"
            f"{rows}</table><p><strong>Total: ${r.amount:.2f}</strong> (GST: ${r.gst_included:.2f})</p>"
            f"<p>{r.footer}</p>")
    result = await EmailService().send_email(
        to_email=body.email, subject=f"Your receipt — {r.receipt_number}", html_content=html,
        db=db, related_entity_type="pos_transaction", related_entity_id=transaction_id,
    )
    logger.info("receipt_emailed", transaction_id=str(transaction_id), to=body.email)
    return {"sent": True, "email": body.email, "message_id": result.get("message_id")}
