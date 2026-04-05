"""Customer Self-Service Portal endpoints.

Routes (prefix /api/portal):
  GET  /profile                     — customer profile
  GET  /orders                      — customer's order history
  GET  /orders/{order_id}           — single order detail with line items
  GET  /invoices                    — customer's invoices
  GET  /invoices/{invoice_id}       — invoice detail
  GET  /certifications              — IICRC certifications for this customer
  POST /service-requests            — log warranty / service request
  GET  /service-requests            — view logged service requests

All endpoints operate in demo mode when ANTHROPIC_API_KEY is absent;
in production they would scope data to the authenticated portal user's customer_id.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db

router = APIRouter(prefix="/api/portal", tags=["Customer Portal"])

# ─── Demo helpers ─────────────────────────────────────────────────────────────

_DEMO_CUSTOMER_ID = "cust-demo-001"

DEMO_PROFILE = {
    "customer_id": _DEMO_CUSTOMER_ID,
    "company_name": "Brisbane Carpet Care Pty Ltd",
    "contact_name": "James Nguyen",
    "email": "james@brisbanecarpetcare.com.au",
    "phone": "+61 7 3222 1234",
    "address": "14 Industrial Ave, Coopers Plains QLD 4108",
    "account_since": "2021-06-15",
    "pricing_tier": "Gold",
}

DEMO_ORDERS = [
    {
        "order_id": "ord-demo-001",
        "order_number": "ORD-2026-0041",
        "date": "2026-03-18",
        "status": "delivered",
        "total": 12450.00,
        "items": [
            {
                "sku": "TM-PRO-570",
                "name": "TruckMount Pro 570 — Carpet Extractor",
                "qty": 1,
                "unit_price": 11250.00,
            },
            {"sku": "ACC-HOSE-15M", "name": "15m Solution Hose Set", "qty": 2, "unit_price": 600.00},
        ],
        "tracking_number": "AUST-POST-946882712",
        "estimated_delivery": "2026-03-22",
        "delivered_at": "2026-03-21",
    },
    {
        "order_id": "ord-demo-002",
        "order_number": "ORD-2026-0019",
        "date": "2026-02-04",
        "status": "delivered",
        "total": 3280.00,
        "items": [
            {"sku": "CHEM-PRECON-5L", "name": "Pre-Conditioner 5L (Case of 4)", "qty": 3, "unit_price": 260.00},
            {"sku": "TOOL-SPOTPRO", "name": "Spot & Stain Pro Kit", "qty": 1, "unit_price": 1820.00},
            {"sku": "CHEM-RINSE-5L", "name": "pH Balanced Rinse 5L (Case of 4)", "qty": 2, "unit_price": 240.00},
        ],
        "tracking_number": "STARTRACK-88271443",
        "estimated_delivery": "2026-02-08",
        "delivered_at": "2026-02-07",
    },
    {
        "order_id": "ord-demo-003",
        "order_number": "ORD-2026-0058",
        "date": "2026-03-24",
        "status": "processing",
        "total": 5940.00,
        "items": [
            {
                "sku": "EXTRACT-PORTABLE-5G",
                "name": "5-Gallon Portable Extractor",
                "qty": 2,
                "unit_price": 2200.00,
            },
            {"sku": "CHEM-DEODORISER-5L", "name": "Odour Eliminator Pro 5L", "qty": 3, "unit_price": 180.00},
            {"sku": "ACC-UPHOLSTERY-KIT", "name": "Upholstery Cleaning Kit", "qty": 1, "unit_price": 820.00},
        ],
        "tracking_number": None,
        "estimated_delivery": "2026-03-28",
        "delivered_at": None,
    },
]

DEMO_INVOICES = [
    {
        "invoice_id": "inv-demo-001",
        "invoice_number": "INV-2026-0041",
        "order_number": "ORD-2026-0041",
        "invoice_date": "2026-03-18",
        "due_date": "2026-04-17",
        "status": "paid",
        "subtotal": 11340.91,
        "gst": 1109.09,
        "total": 12450.00,
        "paid_at": "2026-03-25",
        "payment_method": "Bank Transfer",
    },
    {
        "invoice_id": "inv-demo-002",
        "invoice_number": "INV-2026-0019",
        "order_number": "ORD-2026-0019",
        "invoice_date": "2026-02-04",
        "due_date": "2026-03-05",
        "status": "paid",
        "subtotal": 2981.82,
        "gst": 298.18,
        "total": 3280.00,
        "paid_at": "2026-02-20",
        "payment_method": "Credit Card",
    },
    {
        "invoice_id": "inv-demo-003",
        "invoice_number": "INV-2026-0058",
        "order_number": "ORD-2026-0058",
        "invoice_date": "2026-03-24",
        "due_date": "2026-04-23",
        "status": "outstanding",
        "subtotal": 5400.00,
        "gst": 540.00,
        "total": 5940.00,
        "paid_at": None,
        "payment_method": None,
    },
]

DEMO_CERTIFICATIONS: list[dict[str, Any]] = [
    {
        "cert_id": "cert-demo-001",
        "cert_type": "IICRC WRT",
        "full_name": "Water Restoration Technician",
        "cert_number": "WRT-AU-88421",
        "issued_date": "2024-04-10",
        "expiry_date": "2026-04-10",
        "status": "active",
        "days_until_expiry": 16,
    },
    {
        "cert_id": "cert-demo-002",
        "cert_type": "IICRC CCT",
        "full_name": "Carpet Cleaning Technician",
        "cert_number": "CCT-AU-55317",
        "issued_date": "2023-09-15",
        "expiry_date": "2025-09-15",
        "status": "expired",
        "days_until_expiry": -192,
    },
    {
        "cert_id": "cert-demo-003",
        "cert_type": "IICRC FSRT",
        "full_name": "Fire and Smoke Restoration Technician",
        "cert_number": "FSRT-AU-71004",
        "issued_date": "2025-01-20",
        "expiry_date": "2027-01-20",
        "status": "active",
        "days_until_expiry": 666,
    },
]

DEMO_SERVICE_REQUESTS: list[dict[str, Any]] = []


# ─── Pydantic models ──────────────────────────────────────────────────────────


class ServiceRequestCreate(BaseModel):
    order_id: str | None = None
    product_sku: str | None = None
    request_type: str  # warranty_claim | service_booking | general_inquiry
    description: str
    preferred_contact: str = "email"


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/profile")
async def get_portal_profile(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return the authenticated customer's profile."""
    return DEMO_PROFILE


@router.get("/orders")
async def list_portal_orders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> dict:
    """Return the customer's order history, newest first."""
    orders = DEMO_ORDERS
    if status:
        orders = [o for o in orders if o["status"] == status]
    start = (page - 1) * page_size
    return {
        "customer_id": _DEMO_CUSTOMER_ID,
        "total": len(orders),
        "page": page,
        "page_size": page_size,
        "orders": orders[start : start + page_size],
    }


@router.get("/orders/{order_id}")
async def get_portal_order(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return a single order with full line item detail."""
    order = next((o for o in DEMO_ORDERS if o["order_id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/invoices")
async def list_portal_invoices(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter by status: paid | outstanding | overdue"),
) -> dict:
    """Return the customer's invoice list."""
    invoices = DEMO_INVOICES
    if status:
        invoices = [i for i in invoices if i["status"] == status]
    return {
        "customer_id": _DEMO_CUSTOMER_ID,
        "total": len(invoices),
        "total_outstanding": sum(
            i["total"] for i in DEMO_INVOICES if i["status"] in ("outstanding", "overdue")
        ),
        "invoices": invoices,
    }


@router.get("/invoices/{invoice_id}")
async def get_portal_invoice(
    invoice_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return a single invoice detail."""
    invoice = next((i for i in DEMO_INVOICES if i["invoice_id"] == invoice_id), None)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/certifications")
async def list_portal_certifications(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return the customer's IICRC certification status."""
    active = [c for c in DEMO_CERTIFICATIONS if c["status"] == "active"]
    expired = [c for c in DEMO_CERTIFICATIONS if c["status"] == "expired"]
    expiring_soon = [c for c in active if c["days_until_expiry"] <= 60]
    return {
        "customer_id": _DEMO_CUSTOMER_ID,
        "total": len(DEMO_CERTIFICATIONS),
        "active_count": len(active),
        "expired_count": len(expired),
        "expiring_soon_count": len(expiring_soon),
        "certifications": DEMO_CERTIFICATIONS,
    }


@router.post("/service-requests", status_code=201)
async def create_service_request(
    body: ServiceRequestCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Log a warranty claim or service booking."""
    if body.request_type not in ("warranty_claim", "service_booking", "general_inquiry"):
        raise HTTPException(
            status_code=400,
            detail="request_type must be warranty_claim, service_booking, or general_inquiry",
        )
    request_id = f"sr-{uuid.uuid4().hex[:8]}"
    record = {
        "request_id": request_id,
        "customer_id": _DEMO_CUSTOMER_ID,
        "order_id": body.order_id,
        "product_sku": body.product_sku,
        "request_type": body.request_type,
        "description": body.description,
        "preferred_contact": body.preferred_contact,
        "status": "open",
        "created_at": datetime.now(UTC).isoformat(),
        "reference_number": f"SR-{request_id.upper()}",
    }
    DEMO_SERVICE_REQUESTS.append(record)
    return {
        "message": "Service request logged. Our team will contact you within 1 business day.",
        **record,
    }


@router.get("/service-requests")
async def list_service_requests(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return the customer's service request history."""
    return {
        "customer_id": _DEMO_CUSTOMER_ID,
        "total": len(DEMO_SERVICE_REQUESTS),
        "requests": DEMO_SERVICE_REQUESTS,
    }
