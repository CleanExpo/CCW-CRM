"""IICRC and industry certification tracking API endpoints."""
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.certification_models import (
    CERT_BODIES,
    TechnicianCertification,
)

router = APIRouter(prefix="/api/certifications", tags=["Certifications"])


# ─── Pydantic schemas ───────────────────────────────────────────────────────


class CertificationCreate(BaseModel):
    customer_id: UUID
    cert_body: str = "IICRC"
    cert_type: str
    cert_number: str | None = None
    technician_name: str | None = None
    issue_date: datetime | None = None
    expiry_date: datetime | None = None
    notes: str | None = None


class CertificationResponse(BaseModel):
    id: UUID
    customer_id: UUID
    cert_body: str
    cert_type: str
    cert_number: str | None
    technician_name: str | None
    issue_date: datetime | None
    expiry_date: datetime | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    days_until_expiry: int | None = None

    model_config = {"from_attributes": True}


class CertificationRenew(BaseModel):
    new_expiry_date: datetime
    cert_number: str | None = None
    notes: str | None = None


# ─── Helpers ────────────────────────────────────────────────────────────────


def _compute_status(expiry: datetime | None) -> str:
    if expiry is None:
        return "active"
    now = datetime.now(UTC)
    if expiry < now:
        return "expired"
    if expiry < now + timedelta(days=60):
        return "expiring_soon"
    return "active"


def _days_until_expiry(expiry: datetime | None) -> int | None:
    if expiry is None:
        return None
    now = datetime.now(UTC)
    expiry_utc = expiry.replace(tzinfo=UTC) if expiry.tzinfo is None else expiry
    return (expiry_utc - now).days


def _to_response(cert: TechnicianCertification) -> CertificationResponse:
    return CertificationResponse(
        id=cert.id,
        customer_id=cert.customer_id,
        cert_body=cert.cert_body,
        cert_type=cert.cert_type,
        cert_number=cert.cert_number,
        technician_name=cert.technician_name,
        issue_date=cert.issue_date,
        expiry_date=cert.expiry_date,
        status=_compute_status(cert.expiry_date),
        notes=cert.notes,
        created_at=cert.created_at,
        updated_at=cert.updated_at,
        days_until_expiry=_days_until_expiry(cert.expiry_date),
    )


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("", response_model=list[CertificationResponse])
async def list_certifications(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    customer_id: UUID | None = None,
    cert_body: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> list[CertificationResponse]:
    """List certifications with optional filters."""
    stmt = select(TechnicianCertification)
    if customer_id:
        stmt = stmt.where(TechnicianCertification.customer_id == customer_id)
    if cert_body:
        stmt = stmt.where(TechnicianCertification.cert_body == cert_body)
    stmt = stmt.order_by(TechnicianCertification.expiry_date.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    certs = result.scalars().all()

    # Apply in-memory status filter (computed field)
    items = [_to_response(c) for c in certs]
    if status:
        items = [i for i in items if i.status == status]
    return items


@router.post("", response_model=CertificationResponse, status_code=201)
async def create_certification(
    payload: CertificationCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CertificationResponse:
    """Register a certification for a customer's technician."""
    if payload.cert_body not in CERT_BODIES:
        raise HTTPException(
            status_code=400,
            detail=f"cert_body must be one of: {', '.join(CERT_BODIES)}",
        )

    cert = TechnicianCertification(
        customer_id=payload.customer_id,
        cert_body=payload.cert_body,
        cert_type=payload.cert_type,
        cert_number=payload.cert_number,
        technician_name=payload.technician_name,
        issue_date=payload.issue_date,
        expiry_date=payload.expiry_date,
        status=_compute_status(payload.expiry_date),
        notes=payload.notes,
    )
    db.add(cert)
    await db.commit()
    await db.refresh(cert)
    return _to_response(cert)


@router.get("/expiring", response_model=list[CertificationResponse])
async def get_expiring_certifications(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    days: int = Query(60, ge=1, le=365, description="Look-ahead window in days"),
) -> list[CertificationResponse]:
    """Return certifications expiring within the given number of days."""
    now = datetime.now(UTC)
    cutoff = now + timedelta(days=days)

    result = await db.execute(
        select(TechnicianCertification)
        .where(TechnicianCertification.expiry_date.isnot(None))
        .where(TechnicianCertification.expiry_date <= cutoff)
        .order_by(TechnicianCertification.expiry_date)
    )
    certs = result.scalars().all()
    return [_to_response(c) for c in certs]


@router.post("/{cert_id}/renew", response_model=CertificationResponse)
async def renew_certification(
    cert_id: UUID,
    payload: CertificationRenew,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CertificationResponse:
    """Mark a certification as renewed with a new expiry date."""
    result = await db.execute(
        select(TechnicianCertification).where(TechnicianCertification.id == cert_id)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certification not found")

    cert.expiry_date = payload.new_expiry_date
    cert.status = _compute_status(payload.new_expiry_date)
    if payload.cert_number:
        cert.cert_number = payload.cert_number
    if payload.notes:
        cert.notes = payload.notes
    cert.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(cert)
    return _to_response(cert)


@router.get("/stats")
async def get_certification_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return certification aggregate stats for the dashboard Urgent Today card."""
    now = datetime.now(UTC)

    total_result = await db.execute(select(func.count(TechnicianCertification.id)))
    total = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(TechnicianCertification.id)).where(
            TechnicianCertification.status == "active"
        )
    )
    active = active_result.scalar() or 0

    expiring_soon_result = await db.execute(
        select(func.count(TechnicianCertification.id))
        .where(TechnicianCertification.expiry_date.isnot(None))
        .where(TechnicianCertification.expiry_date <= now + timedelta(days=60))
        .where(TechnicianCertification.expiry_date >= now)
    )
    expiring_soon = expiring_soon_result.scalar() or 0

    expired_result = await db.execute(
        select(func.count(TechnicianCertification.id))
        .where(TechnicianCertification.expiry_date.isnot(None))
        .where(TechnicianCertification.expiry_date < now)
    )
    expired = expired_result.scalar() or 0

    # Expiring alerts list: certs expiring within 60 days
    alerts_result = await db.execute(
        select(TechnicianCertification)
        .where(TechnicianCertification.expiry_date.isnot(None))
        .where(TechnicianCertification.expiry_date >= now)
        .where(TechnicianCertification.expiry_date <= now + timedelta(days=60))
        .order_by(TechnicianCertification.expiry_date)
        .limit(20)
    )
    alert_certs = alerts_result.scalars().all()
    expiring_alerts = [
        {
            "id": str(c.id),
            "cert_type": c.cert_type,
            "expiry_date": c.expiry_date.isoformat() if c.expiry_date else None,
            "days_until_expiry": (c.expiry_date - now).days if c.expiry_date else None,
        }
        for c in alert_certs
    ]

    return {
        "total": total,
        "active": active,
        "expiring_soon": expiring_soon,
        "expired": expired,
        "expiring_alerts": expiring_alerts,
    }
