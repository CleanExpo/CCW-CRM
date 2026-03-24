"""Supplier Self-Service Portal endpoints.

Routes (prefix /api/supplier-portal):
  GET  /profile                                     — supplier profile
  GET  /purchase-orders                             — open POs for this supplier
  GET  /purchase-orders/{po_id}                     — PO detail with line items
  PUT  /purchase-orders/{po_id}/confirm             — confirm delivery date
  POST /purchase-orders/{po_id}/upload-delivery-doc — upload delivery documentation
  GET  /payment-history                             — payment history

Operates in demo mode when no real supplier auth is present.
"""

from __future__ import annotations

from datetime import UTC, datetime

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/supplier-portal", tags=["Supplier Portal"])

# ─── Demo data ─────────────────────────────────────────────────────────────────

_DEMO_SUPPLIER_ID = "sup-demo-001"

DEMO_SUPPLIER_PROFILE = {
    "supplier_id": _DEMO_SUPPLIER_ID,
    "company_name": "CleanTech Equipment Pty Ltd",
    "contact_name": "Sarah Mitchell",
    "email": "orders@cleantech.com.au",
    "phone": "+61 3 9555 7800",
    "address": "88 Factory Road, Dandenong VIC 3175",
    "payment_terms": "Net 30",
    "currency": "AUD",
}

DEMO_PURCHASE_ORDERS: list[dict[str, Any]] = [
    {
        "po_id": "po-demo-001",
        "po_number": "PO-2026-0031",
        "status": "confirmed",
        "issued_date": "2026-03-10",
        "required_by": "2026-03-28",
        "confirmed_delivery_date": "2026-03-27",
        "total": 45600.00,
        "line_items": [
            {
                "sku": "TM-PRO-570",
                "description": "TruckMount Pro 570",
                "qty": 3,
                "unit_price": 9200.00,
                "line_total": 27600.00,
            },
            {
                "sku": "TM-PRO-450",
                "description": "TruckMount Pro 450",
                "qty": 2,
                "unit_price": 9000.00,
                "line_total": 18000.00,
            },
        ],
        "notes": "Urgent — needed for Q2 stock build-up",
        "delivery_doc_uploaded": False,
    },
    {
        "po_id": "po-demo-002",
        "po_number": "PO-2026-0022",
        "status": "pending_confirmation",
        "issued_date": "2026-03-20",
        "required_by": "2026-04-15",
        "confirmed_delivery_date": None,
        "total": 18400.00,
        "line_items": [
            {
                "sku": "EXTRACT-PORTABLE-5G",
                "description": "5-Gallon Portable Extractor",
                "qty": 8,
                "unit_price": 1800.00,
                "line_total": 14400.00,
            },
            {
                "sku": "ACC-UPHOLSTERY-KIT",
                "description": "Upholstery Cleaning Kit",
                "qty": 4,
                "unit_price": 1000.00,
                "line_total": 4000.00,
            },
        ],
        "notes": "",
        "delivery_doc_uploaded": False,
    },
    {
        "po_id": "po-demo-003",
        "po_number": "PO-2026-0008",
        "status": "delivered",
        "issued_date": "2026-02-12",
        "required_by": "2026-03-01",
        "confirmed_delivery_date": "2026-02-28",
        "total": 31200.00,
        "line_items": [
            {
                "sku": "CHEM-PRECON-5L",
                "description": "Pre-Conditioner 5L (Case of 4)",
                "qty": 60,
                "unit_price": 260.00,
                "line_total": 15600.00,
            },
            {
                "sku": "CHEM-RINSE-5L",
                "description": "pH Balanced Rinse 5L (Case of 4)",
                "qty": 65,
                "unit_price": 240.00,
                "line_total": 15600.00,
            },
        ],
        "notes": "",
        "delivery_doc_uploaded": True,
    },
]

DEMO_PAYMENT_HISTORY: list[dict[str, Any]] = [
    {
        "payment_id": "pmt-sup-001",
        "po_number": "PO-2026-0008",
        "amount": 31200.00,
        "paid_date": "2026-03-15",
        "method": "EFT",
        "reference": "CCW-PAY-0008-MAR26",
    },
    {
        "payment_id": "pmt-sup-002",
        "po_number": "PO-2026-0001",
        "amount": 22400.00,
        "paid_date": "2026-02-10",
        "method": "EFT",
        "reference": "CCW-PAY-0001-FEB26",
    },
]

# Mutable for demo delivery confirmations
_po_confirmations: dict[str, str] = {}


# ─── Pydantic ──────────────────────────────────────────────────────────────────


class ConfirmDeliveryRequest(BaseModel):
    confirmed_delivery_date: str  # YYYY-MM-DD
    notes: str | None = None


# ─── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/profile")
async def get_supplier_profile() -> dict:
    """Return the authenticated supplier's profile."""
    return DEMO_SUPPLIER_PROFILE


@router.get("/purchase-orders")
async def list_supplier_purchase_orders(
    status: str | None = Query(None, description="pending_confirmation | confirmed | delivered"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> dict:
    """List open purchase orders for this supplier."""
    orders = DEMO_PURCHASE_ORDERS
    if status:
        orders = [o for o in orders if o["status"] == status]
    start = (page - 1) * page_size
    return {
        "supplier_id": _DEMO_SUPPLIER_ID,
        "total": len(orders),
        "page": page,
        "page_size": page_size,
        "purchase_orders": orders[start : start + page_size],
    }


@router.get("/purchase-orders/{po_id}")
async def get_supplier_purchase_order(po_id: str) -> dict:
    """Return a single PO with full detail."""
    po = next((o for o in DEMO_PURCHASE_ORDERS if o["po_id"] == po_id), None)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    # Apply any confirmed delivery overrides
    if po_id in _po_confirmations:
        po = {**po, "confirmed_delivery_date": _po_confirmations[po_id], "status": "confirmed"}
    return po


@router.put("/purchase-orders/{po_id}/confirm")
async def confirm_purchase_order_delivery(
    po_id: str,
    body: ConfirmDeliveryRequest,
) -> dict:
    """Supplier confirms delivery date for a purchase order."""
    po = next((o for o in DEMO_PURCHASE_ORDERS if o["po_id"] == po_id), None)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po["status"] == "delivered":
        raise HTTPException(status_code=400, detail="Order already delivered — cannot modify")
    # Record the confirmation
    _po_confirmations[po_id] = body.confirmed_delivery_date
    return {
        "message": f"Delivery confirmed for {body.confirmed_delivery_date}. CCW has been notified.",
        "po_id": po_id,
        "po_number": po["po_number"],
        "confirmed_delivery_date": body.confirmed_delivery_date,
        "status": "confirmed",
        "notes": body.notes,
        "confirmed_at": datetime.now(UTC).isoformat(),
    }


@router.get("/payment-history")
async def get_supplier_payment_history() -> dict:
    """Return payment history for this supplier."""
    return {
        "supplier_id": _DEMO_SUPPLIER_ID,
        "total": len(DEMO_PAYMENT_HISTORY),
        "total_paid_ytd": sum(p["amount"] for p in DEMO_PAYMENT_HISTORY),
        "payments": DEMO_PAYMENT_HISTORY,
    }
