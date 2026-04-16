"""NDB (Notifiable Data Breaches) incident response workflow — UNI-1858."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.api.routes.demo_auth import get_current_user
from src.db.models import User

router = APIRouter(prefix="/api/ndb", tags=["NDB Incident Response"])

# In-memory store (no DB model required yet)
_incidents: dict[UUID, dict] = {}

VALID_STATUSES = {"investigating", "notified_individuals", "notified_oaic", "closed"}
OAIC_DEADLINE_DAYS = 30


class NDBIncidentCreate(BaseModel):
    title: str
    description: str
    discovered_at: datetime
    estimated_affected_individuals: int
    data_categories: list[str]
    severity: str  # low | medium | high | critical


class NDBIncidentResponse(NDBIncidentCreate):
    id: UUID
    status: str
    report_deadline: datetime
    days_remaining: int
    created_at: datetime


class StatusUpdate(BaseModel):
    status: str


def _to_response(rec: dict) -> NDBIncidentResponse:
    deadline: datetime = rec["report_deadline"]
    now = datetime.now(timezone.utc)
    # ensure deadline is tz-aware for arithmetic
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    days_remaining = max(0, (deadline - now).days)
    return NDBIncidentResponse(**{k: v for k, v in rec.items() if k != "days_remaining"},
                               days_remaining=days_remaining)


@router.post("/incidents", response_model=NDBIncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    payload: NDBIncidentCreate,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> NDBIncidentResponse:
    """Create a new NDB incident and compute the 30-day OAIC reporting deadline."""
    discovered = payload.discovered_at
    if discovered.tzinfo is None:
        discovered = discovered.replace(tzinfo=timezone.utc)
    incident_id = uuid4()
    rec: dict = {
        **payload.model_dump(),
        "id": incident_id,
        "status": "investigating",
        "report_deadline": discovered + timedelta(days=OAIC_DEADLINE_DAYS),
        "created_at": datetime.now(timezone.utc),
    }
    _incidents[incident_id] = rec
    return _to_response(rec)


@router.get("/incidents", response_model=list[NDBIncidentResponse])
async def list_incidents(
    _current_user: Annotated[User, Depends(get_current_user)],
) -> list[NDBIncidentResponse]:
    """List all NDB incidents."""
    return [_to_response(rec) for rec in _incidents.values()]


@router.get("/incidents/overdue", response_model=list[NDBIncidentResponse])
async def list_overdue_incidents(
    _current_user: Annotated[User, Depends(get_current_user)],
) -> list[NDBIncidentResponse]:
    """List incidents past the OAIC deadline that are not yet notified or closed."""
    now = datetime.now(timezone.utc)
    result = []
    for rec in _incidents.values():
        deadline = rec["report_deadline"]
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if deadline < now and rec["status"] not in {"notified_oaic", "closed"}:
            result.append(_to_response(rec))
    return result


@router.get("/incidents/{incident_id}", response_model=NDBIncidentResponse)
async def get_incident(
    incident_id: UUID,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> NDBIncidentResponse:
    """Get a single NDB incident with live days_remaining."""
    rec = _incidents.get(incident_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _to_response(rec)


@router.patch("/incidents/{incident_id}/status", response_model=NDBIncidentResponse)
async def update_incident_status(
    incident_id: UUID,
    body: StatusUpdate,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> NDBIncidentResponse:
    """Update the status of an NDB incident."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400,
                            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")
    rec = _incidents.get(incident_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Incident not found")
    rec["status"] = body.status
    return _to_response(rec)
