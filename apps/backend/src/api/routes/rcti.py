"""RCTI (Recipient-Created Tax Invoice) — buyer-generated invoice for AU commodity purchases."""
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.deps import get_current_user

router = APIRouter(prefix="/api/rcti", tags=["RCTI"], dependencies=[Depends(get_current_user)])

_store: dict[UUID, dict] = {}
_counter = 0


class RCTICreate(BaseModel):
    supplier_id: UUID
    agreement_number: str
    period_start: date
    period_end: date
    line_items: list[dict]  # [{description, quantity, unit_price, gst_applicable}]


class RCTIResponse(BaseModel):
    id: UUID
    rcti_number: str
    supplier_id: UUID
    agreement_number: str
    period_start: date
    period_end: date
    subtotal: Decimal
    gst: Decimal
    total: Decimal
    status: str
    created_at: datetime
    issued_at: datetime | None = None


def _calc(items: list[dict]) -> tuple[Decimal, Decimal]:
    sub, gst = Decimal("0"), Decimal("0")
    for i in items:
        line = Decimal(str(i.get("quantity", 0))) * Decimal(str(i.get("unit_price", 0)))
        sub += line
        if i.get("gst_applicable"):
            gst += (line * Decimal("0.1")).quantize(Decimal("0.01"))
    return sub, gst


@router.post("", response_model=RCTIResponse, status_code=201)
async def create_rcti(data: RCTICreate) -> RCTIResponse:
    """Create a new RCTI in draft status."""
    global _counter
    _counter += 1
    sub, gst = _calc(data.line_items)
    record = {**data.model_dump(), "id": uuid4(),
              "rcti_number": f"RCTI-{datetime.now().year}-{_counter:04d}",
              "subtotal": sub, "gst": gst, "total": sub + gst,
              "status": "draft", "created_at": datetime.utcnow(), "issued_at": None}
    _store[record["id"]] = record
    return RCTIResponse(**record)


@router.get("", response_model=list[RCTIResponse])
async def list_rctis(supplier_id: UUID | None = Query(None), status: str | None = Query(None)) -> list[RCTIResponse]:
    """List RCTIs filtered by supplier_id and/or status."""
    rows = list(_store.values())
    if supplier_id:
        rows = [r for r in rows if r["supplier_id"] == supplier_id]
    if status:
        rows = [r for r in rows if r["status"] == status]
    return [RCTIResponse(**r) for r in rows]


@router.get("/{rcti_id}", response_model=RCTIResponse)
async def get_rcti(rcti_id: UUID) -> RCTIResponse:
    """Get a single RCTI by ID."""
    r = _store.get(rcti_id)
    if not r:
        raise HTTPException(status_code=404, detail="RCTI not found")
    return RCTIResponse(**r)


@router.post("/{rcti_id}/issue", response_model=RCTIResponse)
async def issue_rcti(rcti_id: UUID) -> RCTIResponse:
    """Mark an RCTI as issued."""
    r = _store.get(rcti_id)
    if not r:
        raise HTTPException(status_code=404, detail="RCTI not found")
    if r["status"] != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot issue RCTI in status '{r['status']}'")
    r["status"] = "issued"
    r["issued_at"] = datetime.utcnow()
    return RCTIResponse(**r)
