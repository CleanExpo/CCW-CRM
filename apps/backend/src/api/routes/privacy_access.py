"""Privacy Act APP 12 compliance endpoints — UNI-1862.

Implements Australian Privacy Principle 12: individuals have the right to
access, correct, or request deletion of their personal information.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_admin_user
from src.config.database import get_async_db
from src.db.audit_models import AuditLog
from src.db.demo_models import Customer, Order
from src.db.models.invoicing import Invoice
from src.db.pos_models import POSTransaction
from src.db.models import User
from src.services.email_notifications import email_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/privacy", tags=["Privacy / APP 12"])

# ---------------------------------------------------------------------------
# In-memory store (sufficient for low-volume compliance use case)
# ---------------------------------------------------------------------------
_access_requests: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AccessRequestCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    request_type: Literal["access", "correction", "deletion"]
    description: str = Field(..., min_length=10, max_length=2000)


class AccessRequestResponse(BaseModel):
    request_id: str
    expected_response_by: date


class AccessRequestRecord(BaseModel):
    request_id: str
    name: str
    email: str
    request_type: str
    description: str
    status: str
    submitted_at: datetime
    expected_response_by: date
    response_note: str | None = None
    responded_at: datetime | None = None


class RespondRequest(BaseModel):
    response_note: str = Field(..., min_length=1, max_length=2000)
    status: Literal["fulfilled", "refused", "partial"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/access-request", response_model=AccessRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_access_request(body: AccessRequestCreate) -> AccessRequestResponse:
    """Submit a privacy access/correction/deletion request (APP 12, no auth required)."""
    request_id = str(uuid.uuid4())
    submitted_at = datetime.now(UTC)
    expected_response_by = (submitted_at + timedelta(days=30)).date()

    _access_requests[request_id] = {
        "request_id": request_id,
        "name": body.name,
        "email": body.email,
        "request_type": body.request_type,
        "description": body.description,
        "status": "pending",
        "submitted_at": submitted_at,
        "expected_response_by": expected_response_by,
        "response_note": None,
        "responded_at": None,
    }

    logger.info(
        "Privacy access request submitted",
        request_id=request_id,
        request_type=body.request_type,
        email=body.email,
    )

    # Best-effort confirmation email — don't fail the request if email errors
    try:
        email_service.send_contact_submission_notification(
            contact_name=body.name,
            contact_email=body.email,
            subject=f"Privacy request received — ref {request_id}",
            message=(
                f"Thank you {body.name}. We have received your {body.request_type} request "
                f"(ref: {request_id}). We will respond by {expected_response_by}."
            ),
        )
    except Exception as exc:
        logger.warning("Confirmation email failed", request_id=request_id, error=str(exc))

    return AccessRequestResponse(request_id=request_id, expected_response_by=expected_response_by)


@router.get("/access-requests", response_model=list[AccessRequestRecord])
async def list_access_requests(
    _admin: Annotated[User, Depends(get_current_admin_user)],
) -> list[AccessRequestRecord]:
    """List all privacy access requests (admin only)."""
    return [AccessRequestRecord(**r) for r in _access_requests.values()]


@router.patch("/access-requests/{request_id}/respond", response_model=AccessRequestRecord)
async def respond_to_access_request(
    request_id: str,
    body: RespondRequest,
    _admin: Annotated[User, Depends(get_current_admin_user)],
) -> AccessRequestRecord:
    """Record a response to a privacy access request (admin only)."""
    record = _access_requests.get(request_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    record["status"] = body.status
    record["response_note"] = body.response_note
    record["responded_at"] = datetime.now(UTC)

    logger.info(
        "Privacy request responded",
        request_id=request_id,
        status=body.status,
    )
    return AccessRequestRecord(**record)


@router.get("/data-export/{customer_id}")
async def export_customer_data(
    customer_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    _admin: Annotated[User, Depends(get_current_admin_user)],
) -> dict:
    """Compile all personal data for a customer (APP 12 data export, admin only)."""
    # Customer profile
    customer_result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = customer_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Orders
    orders_result = await db.execute(select(Order).where(Order.customer_id == customer_id))
    orders = orders_result.scalars().all()
    order_ids = [str(o.id) for o in orders]

    # Invoices linked to orders
    invoices: list[Invoice] = []
    if order_ids:
        invoices_result = await db.execute(
            select(Invoice).where(Invoice.order_id.in_([o.id for o in orders]))
        )
        invoices = invoices_result.scalars().all()

    # POS transactions linked to orders
    pos_txns: list[POSTransaction] = []
    if order_ids:
        pos_result = await db.execute(
            select(POSTransaction).where(POSTransaction.order_id.in_([o.id for o in orders]))
        )
        pos_txns = pos_result.scalars().all()

    # Audit log entries referencing this customer
    audit_result = await db.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "customer",
            AuditLog.entity_id == str(customer_id),
        )
    )
    audit_entries = audit_result.scalars().all()

    export = {
        "export_generated_at": datetime.now(UTC).isoformat(),
        "customer": {
            "id": str(customer.id),
            "name": getattr(customer, "name", None),
            "email": getattr(customer, "email", None),
            "phone": getattr(customer, "phone", None),
            "address": getattr(customer, "address", None),
            "created_at": str(getattr(customer, "created_at", None)),
        },
        "orders": [
            {
                "id": str(o.id),
                "status": getattr(o, "status", None),
                "total": str(getattr(o, "total_amount", None)),
                "created_at": str(getattr(o, "created_at", None)),
            }
            for o in orders
        ],
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": getattr(inv, "invoice_number", None),
                "status": getattr(inv, "status", None),
                "total": str(getattr(inv, "total_amount", None)),
                "issued_date": str(getattr(inv, "issued_date", None)),
            }
            for inv in invoices
        ],
        "pos_transactions": [
            {
                "id": str(txn.id),
                "transaction_number": getattr(txn, "transaction_number", None),
                "amount": str(getattr(txn, "amount", None)),
                "payment_method": getattr(txn, "payment_method", None),
                "created_at": str(getattr(txn, "created_at", None)),
            }
            for txn in pos_txns
        ],
        "audit_log_entries": [
            {
                "id": str(entry.id),
                "action": entry.action,
                "user_email": entry.user_email,
                "created_at": str(entry.created_at),
            }
            for entry in audit_entries
        ],
    }

    logger.info("Customer data exported for APP 12", customer_id=str(customer_id))
    return export
