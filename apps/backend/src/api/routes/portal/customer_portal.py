"""Customer Self-Service Portal endpoints — UNI-1869.

Routes (prefix /api/portal):
  GET  /profile                     — customer profile
  GET  /orders                      — customer's order history
  GET  /orders/{order_id}           — single order detail with line items
  GET  /invoices                    — customer's invoices
  GET  /invoices/{invoice_id}       — invoice detail
  GET  /certifications              — IICRC certifications for this customer
  POST /service-requests            — log warranty / service request
  GET  /service-requests            — view logged service requests

Security (UNI-1869):
  All endpoints require a valid JWT (enforced by AuthMiddleware).
  All DB queries are scoped to:
    • the authenticated user's organisation_id  (org isolation)
    • the customer record whose email matches the authenticated user's email
      OR whose customer_id is stored in the JWT (customer isolation)

Demo mode fallback:
  Set PORTAL_DEMO_MODE=true (env var) to return fixture data without DB access.
  This must only be used in local / CI environments — it is OFF by default so
  production is always safe.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.config.settings import get_settings
from src.db.demo_models import Customer, Order, OrderItem, Product

logger = structlog.get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/portal", tags=["Customer Portal"])

# ─── Demo fixture data (used only when PORTAL_DEMO_MODE=true) ─────────────────

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


# ─── Auth helper ──────────────────────────────────────────────────────────────


async def _resolve_customer(
    request: Request,
    db: AsyncSession,
    org_id: uuid.UUID,
) -> Customer:
    """
    Resolve the Customer record for the authenticated portal user.

    Strategy (UNI-1869):
    1. Match by authenticated user's email within the org.
    2. If no match → 403 (user is not a known customer of this org).

    We scope by org_id so a customer from Org A cannot access Org B data
    even if they share an email address.
    """
    state_user: dict = getattr(request.state, "user", {}) or {}
    user_email: str | None = state_user.get("email") or getattr(request.state, "email", None)

    if not user_email:
        raise HTTPException(status_code=401, detail="Cannot determine authenticated user email.")

    result = await db.execute(
        select(Customer).where(
            Customer.organization_id == org_id,
            Customer.email == user_email,
            Customer.is_active.is_(True),
        )
    )
    customer = result.scalar_one_or_none()

    if not customer:
        logger.warning(
            "Portal: no customer record for authenticated user",
            org_id=str(org_id),
            email=user_email,
        )
        raise HTTPException(
            status_code=403,
            detail="No customer account found for your login in this organisation.",
        )

    return customer


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/profile")
async def get_portal_profile(
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return the authenticated customer's profile."""
    if settings.portal_demo_mode:
        return DEMO_PROFILE

    customer = await _resolve_customer(request, db, org_id)
    return {
        "customer_id": str(customer.id),
        "company_name": customer.company_name,
        "contact_name": customer.contact_name,
        "email": customer.email,
        "phone": customer.phone or "",
        "address": customer.address or "",
        "account_since": customer.created_at.date().isoformat(),
        "pricing_tier": "Standard",
    }


@router.get("/orders")
async def list_portal_orders(
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> dict:
    """Return the customer's order history, newest first."""
    if settings.portal_demo_mode:
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

    customer = await _resolve_customer(request, db, org_id)

    # Scope: org_id AND customer_id (UNI-1869)
    stmt = (
        select(Order)
        .where(
            Order.organization_id == org_id,
            Order.customer_id == customer.id,
        )
        .order_by(Order.order_date.desc())
    )
    if status:
        stmt = stmt.where(Order.status == status)

    result = await db.execute(stmt)
    all_orders = result.scalars().all()

    start = (page - 1) * page_size
    page_orders = all_orders[start : start + page_size]

    return {
        "customer_id": str(customer.id),
        "total": len(all_orders),
        "page": page,
        "page_size": page_size,
        "orders": [
            {
                "order_id": str(o.id),
                "order_number": o.order_number,
                "date": o.order_date.date().isoformat(),
                "status": o.status,
                "total": float(o.total),
                "tracking_number": o.tracking_number,
                "estimated_delivery": (
                    o.estimated_delivery_date.date().isoformat()
                    if o.estimated_delivery_date
                    else None
                ),
                "delivered_at": (
                    o.shipped_date.date().isoformat() if o.shipped_date else None
                ),
            }
            for o in page_orders
        ],
    }


@router.get("/orders/{order_id}")
async def get_portal_order(
    order_id: str,
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return a single order with full line item detail."""
    if settings.portal_demo_mode:
        order = next((o for o in DEMO_ORDERS if o["order_id"] == order_id), None)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return order

    customer = await _resolve_customer(request, db, org_id)

    try:
        order_uuid = uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Order not found")

    # Scope: org_id AND customer_id (UNI-1869)
    result = await db.execute(
        select(Order).where(
            Order.id == order_uuid,
            Order.organization_id == org_id,
            Order.customer_id == customer.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Load line items
    items_result = await db.execute(
        select(OrderItem, Product)
        .join(Product, OrderItem.product_id == Product.id, isouter=True)
        .where(OrderItem.order_id == order.id)
    )
    items = items_result.all()

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "date": order.order_date.date().isoformat(),
        "status": order.status,
        "total": float(order.total),
        "tracking_number": order.tracking_number,
        "estimated_delivery": (
            order.estimated_delivery_date.date().isoformat()
            if order.estimated_delivery_date
            else None
        ),
        "delivered_at": order.shipped_date.date().isoformat() if order.shipped_date else None,
        "items": [
            {
                "sku": prod.sku if prod else "—",
                "name": prod.name if prod else "Unknown product",
                "qty": item.quantity,
                "unit_price": float(item.unit_price),
            }
            for item, prod in items
        ],
    }


@router.get("/invoices")
async def list_portal_invoices(
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter by status: paid | outstanding | overdue"),
) -> dict:
    """Return the customer's invoice list.

    NOTE: The core schema does not have a standalone Invoice table in demo_models.
    Invoices are derived from Orders (each order maps 1:1 to an invoice in the MVP).
    If a dedicated Invoice model is added in future, update this endpoint.
    """
    if settings.portal_demo_mode:
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

    customer = await _resolve_customer(request, db, org_id)

    # Scope: org_id AND customer_id (UNI-1869)
    stmt = select(Order).where(
        Order.organization_id == org_id,
        Order.customer_id == customer.id,
    ).order_by(Order.order_date.desc())

    result = await db.execute(stmt)
    orders = result.scalars().all()

    def _order_to_invoice(o: Order) -> dict[str, Any]:
        """Derive invoice shape from an order."""
        subtotal = float(o.total) / 1.1  # Back-calculate ex-GST
        gst = float(o.total) - subtotal
        inv_status = "paid" if o.status in ("delivered", "shipped", "completed") else "outstanding"
        return {
            "invoice_id": str(o.id),
            "invoice_number": f"INV-{o.order_number.removeprefix('ORD-')}",
            "order_number": o.order_number,
            "invoice_date": o.order_date.date().isoformat(),
            "due_date": None,  # Payment terms not yet wired to portal
            "status": inv_status,
            "subtotal": round(subtotal, 2),
            "gst": round(gst, 2),
            "total": float(o.total),
            "paid_at": o.shipped_date.isoformat() if o.shipped_date and inv_status == "paid" else None,
            "payment_method": None,
        }

    invoices = [_order_to_invoice(o) for o in orders]
    if status:
        invoices = [i for i in invoices if i["status"] == status]

    return {
        "customer_id": str(customer.id),
        "total": len(invoices),
        "total_outstanding": sum(i["total"] for i in invoices if i["status"] in ("outstanding", "overdue")),
        "invoices": invoices,
    }


@router.get("/invoices/{invoice_id}")
async def get_portal_invoice(
    invoice_id: str,
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return a single invoice detail."""
    if settings.portal_demo_mode:
        invoice = next((i for i in DEMO_INVOICES if i["invoice_id"] == invoice_id), None)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice

    customer = await _resolve_customer(request, db, org_id)

    try:
        order_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Invoice ID == Order ID in MVP schema; enforce org + customer scope
    result = await db.execute(
        select(Order).where(
            Order.id == order_uuid,
            Order.organization_id == org_id,
            Order.customer_id == customer.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Invoice not found")

    subtotal = float(order.total) / 1.1
    gst = float(order.total) - subtotal
    inv_status = "paid" if order.status in ("delivered", "shipped", "completed") else "outstanding"

    return {
        "invoice_id": str(order.id),
        "invoice_number": f"INV-{order.order_number.removeprefix('ORD-')}",
        "order_number": order.order_number,
        "invoice_date": order.order_date.date().isoformat(),
        "due_date": None,
        "status": inv_status,
        "subtotal": round(subtotal, 2),
        "gst": round(gst, 2),
        "total": float(order.total),
        "paid_at": order.shipped_date.isoformat() if order.shipped_date and inv_status == "paid" else None,
        "payment_method": None,
    }


@router.get("/certifications")
async def list_portal_certifications(
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return the customer's IICRC certification status.

    NOTE: The certification_models table (TechnicianCertification) links to
    contractors, not to portal customers. Until that schema is extended to
    reference customer_id this endpoint returns an empty list in live mode
    and falls back to demo data only when PORTAL_DEMO_MODE=true.
    """
    if settings.portal_demo_mode:
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

    # Live mode: resolve customer (auth + org scope enforced), return empty list
    # until TechnicianCertification is linked to Customer.
    customer = await _resolve_customer(request, db, org_id)

    return {
        "customer_id": str(customer.id),
        "total": 0,
        "active_count": 0,
        "expired_count": 0,
        "expiring_soon_count": 0,
        "certifications": [],
    }


@router.post("/service-requests", status_code=201)
async def create_service_request(
    body: ServiceRequestCreate,
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Log a warranty claim or service booking."""
    if body.request_type not in ("warranty_claim", "service_booking", "general_inquiry"):
        raise HTTPException(
            status_code=400,
            detail="request_type must be warranty_claim, service_booking, or general_inquiry",
        )

    if settings.portal_demo_mode:
        request_id = f"sr-{uuid.uuid4().hex[:8]}"
        record: dict[str, Any] = {
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

    # Live mode: resolve customer (auth + org scope enforced)
    customer = await _resolve_customer(request, db, org_id)

    request_id = f"sr-{uuid.uuid4().hex[:8]}"
    record = {
        "request_id": request_id,
        "customer_id": str(customer.id),
        "order_id": body.order_id,
        "product_sku": body.product_sku,
        "request_type": body.request_type,
        "description": body.description,
        "preferred_contact": body.preferred_contact,
        "status": "open",
        "created_at": datetime.now(UTC).isoformat(),
        "reference_number": f"SR-{request_id.upper()}",
    }

    logger.info(
        "Portal service request created",
        customer_id=str(customer.id),
        org_id=str(org_id),
        request_type=body.request_type,
        reference_number=record["reference_number"],
    )

    # TODO: Persist to ServiceRequest table once schema is wired
    return {
        "message": "Service request logged. Our team will contact you within 1 business day.",
        **record,
    }


@router.get("/service-requests")
async def list_service_requests(
    request: Request,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return the customer's service request history."""
    if settings.portal_demo_mode:
        return {
            "customer_id": _DEMO_CUSTOMER_ID,
            "total": len(DEMO_SERVICE_REQUESTS),
            "requests": DEMO_SERVICE_REQUESTS,
        }

    customer = await _resolve_customer(request, db, org_id)

    # TODO: Query ServiceRequest table once schema is wired to Customer
    return {
        "customer_id": str(customer.id),
        "total": 0,
        "requests": [],
    }
