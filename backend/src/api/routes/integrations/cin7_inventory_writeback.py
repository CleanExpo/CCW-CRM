"""Cin7 Inventory Write-Back API (UNI-1265).

Endpoints for stock adjustments, stock transfers, and stock-takes
that are written back to Cin7.  In demo mode the records are
marked as synced immediately with a generated Cin7 ID.
"""

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.config.database import get_async_db
from src.db.cin7_models import (
    Cin7StockAdjustment,
    Cin7StockTake,
    Cin7StockTakeLine,
    Cin7StockTransfer,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7", tags=["Cin7 Inventory Write-Back"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class StockAdjustmentRequest(BaseModel):
    location_id: str = Field(..., min_length=1, description="Warehouse location")
    product_id: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    adjustment_qty: int = Field(..., description="Positive=add, negative=remove")
    reason: str | None = None


class StockTransferRequest(BaseModel):
    from_location_id: str = Field(..., min_length=1)
    to_location_id: str = Field(..., min_length=1)
    product_id: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    quantity: int = Field(..., gt=0)
    reference: str | None = None


class StockTakeCreateRequest(BaseModel):
    location_id: str = Field(..., min_length=1)
    reference: str = Field(..., min_length=1)


class StockTakeLineRequest(BaseModel):
    product_id: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    counted_qty: int = Field(..., ge=0)
    system_qty: int | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _demo_cin7_id(prefix: str) -> str:
    """Generate a fake Cin7 ID for demo mode."""
    return f"{prefix}-demo-{uuid4().hex[:8]}"


def _record_to_dict(record: Any) -> dict[str, Any]:
    """Serialise a SQLAlchemy model to a plain dict for the JSON response."""
    d: dict[str, Any] = {}
    for col in record.__table__.columns:
        val = getattr(record, col.name)
        if isinstance(val, datetime):
            d[col.name] = val.isoformat()
        else:
            d[col.name] = str(val) if val is not None else None
    return d


# ---------------------------------------------------------------------------
# Stock Adjustments
# ---------------------------------------------------------------------------


@router.post("/stock-adjustments")
async def create_stock_adjustment(
    body: StockAdjustmentRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Create a stock adjustment and sync to Cin7.

    In demo mode the adjustment is marked as synced immediately.
    """
    record = Cin7StockAdjustment(
        id=str(uuid4()),
        location_id=body.location_id,
        product_id=body.product_id,
        sku=body.sku,
        adjustment_qty=body.adjustment_qty,
        reason=body.reason,
        status="pending",
    )
    db.add(record)

    if settings.is_demo_mode:
        record.cin7_adjustment_id = _demo_cin7_id("ADJ")
        record.status = "synced"
        record.synced_at = datetime.now(UTC)
        logger.info(
            "cin7_stock_adjustment_demo",
            sku=body.sku,
            qty=body.adjustment_qty,
            cin7_id=record.cin7_adjustment_id,
        )
    else:
        # Live mode: call Cin7 Core API for stock adjustment
        try:
            from src.integrations.cin7.client import get_cin7_client

            async with get_cin7_client(settings) as client:
                result = await client.core._request(
                    "POST",
                    "/stockAdjustment",
                    json={
                        "Location": body.location_id,
                        "SKU": body.sku,
                        "Quantity": body.adjustment_qty,
                        "Reason": body.reason or "",
                    },
                )
                record.cin7_adjustment_id = result.get("TaskID", str(uuid4()))
                record.status = "synced"
                record.synced_at = datetime.now(UTC)
        except Exception as exc:
            record.status = "failed"
            record.error_message = str(exc)[:500]
            logger.error("cin7_stock_adjustment_failed", error=str(exc))

    await db.commit()
    return _record_to_dict(record)


@router.get("/stock-adjustments")
async def list_stock_adjustments(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List recent stock adjustments, newest first."""
    result = await db.execute(
        select(Cin7StockAdjustment)
        .order_by(Cin7StockAdjustment.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return {
        "total": len(records),
        "items": [_record_to_dict(r) for r in records],
    }


# ---------------------------------------------------------------------------
# Stock Transfers
# ---------------------------------------------------------------------------


@router.post("/stock-transfers")
async def create_stock_transfer(
    body: StockTransferRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Create a stock transfer between locations and sync to Cin7."""
    if body.from_location_id == body.to_location_id:
        raise HTTPException(
            status_code=400,
            detail="Source and destination locations must be different.",
        )

    record = Cin7StockTransfer(
        id=str(uuid4()),
        from_location_id=body.from_location_id,
        to_location_id=body.to_location_id,
        product_id=body.product_id,
        sku=body.sku,
        quantity=body.quantity,
        reference=body.reference,
        status="pending",
    )
    db.add(record)

    if settings.is_demo_mode:
        record.cin7_transfer_id = _demo_cin7_id("TFR")
        record.status = "synced"
        record.synced_at = datetime.now(UTC)
        logger.info(
            "cin7_stock_transfer_demo",
            sku=body.sku,
            qty=body.quantity,
            from_loc=body.from_location_id,
            to_loc=body.to_location_id,
            cin7_id=record.cin7_transfer_id,
        )
    else:
        try:
            from src.integrations.cin7.client import get_cin7_client

            async with get_cin7_client(settings) as client:
                result = await client.core._request(
                    "POST",
                    "/stockTransfer",
                    json={
                        "From": body.from_location_id,
                        "To": body.to_location_id,
                        "SKU": body.sku,
                        "Quantity": body.quantity,
                        "Reference": body.reference or "",
                    },
                )
                record.cin7_transfer_id = result.get("TaskID", str(uuid4()))
                record.status = "synced"
                record.synced_at = datetime.now(UTC)
        except Exception as exc:
            record.status = "failed"
            record.error_message = str(exc)[:500]
            logger.error("cin7_stock_transfer_failed", error=str(exc))

    await db.commit()
    return _record_to_dict(record)


@router.get("/stock-transfers")
async def list_stock_transfers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List recent stock transfers, newest first."""
    result = await db.execute(
        select(Cin7StockTransfer)
        .order_by(Cin7StockTransfer.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return {
        "total": len(records),
        "items": [_record_to_dict(r) for r in records],
    }


# ---------------------------------------------------------------------------
# Stock Takes
# ---------------------------------------------------------------------------


@router.post("/stock-takes")
async def create_stock_take(
    body: StockTakeCreateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Create a new draft stock-take."""
    record = Cin7StockTake(
        id=str(uuid4()),
        location_id=body.location_id,
        reference=body.reference,
        status="draft",
    )
    db.add(record)
    await db.commit()
    return _record_to_dict(record)


@router.get("/stock-takes")
async def list_stock_takes(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """List recent stock-takes, newest first."""
    result = await db.execute(
        select(Cin7StockTake)
        .order_by(Cin7StockTake.created_at.desc())
        .limit(limit)
    )
    records = result.scalars().all()
    return {
        "total": len(records),
        "items": [_record_to_dict(r) for r in records],
    }


@router.post("/stock-takes/{stock_take_id}/lines")
async def add_stock_take_lines(
    stock_take_id: str,
    lines: list[StockTakeLineRequest],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Add line items to a stock-take."""
    # Verify stock-take exists and is in draft status
    result = await db.execute(
        select(Cin7StockTake).where(Cin7StockTake.id == stock_take_id)
    )
    stock_take = result.scalar_one_or_none()
    if stock_take is None:
        raise HTTPException(status_code=404, detail="Stock take not found")
    if stock_take.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Stock take is '{stock_take.status}', lines can only be added to drafts.",
        )

    created: list[dict[str, Any]] = []
    for line in lines:
        variance = (
            (line.counted_qty - line.system_qty)
            if line.system_qty is not None
            else None
        )
        record = Cin7StockTakeLine(
            id=str(uuid4()),
            stock_take_id=stock_take_id,
            product_id=line.product_id,
            sku=line.sku,
            counted_qty=line.counted_qty,
            system_qty=line.system_qty,
            variance=variance,
        )
        db.add(record)
        created.append(_record_to_dict(record))

    await db.commit()
    return {"stock_take_id": stock_take_id, "lines_added": len(created), "lines": created}


@router.post("/stock-takes/{stock_take_id}/submit")
async def submit_stock_take(
    stock_take_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Submit a stock-take to Cin7."""
    result = await db.execute(
        select(Cin7StockTake).where(Cin7StockTake.id == stock_take_id)
    )
    stock_take = result.scalar_one_or_none()
    if stock_take is None:
        raise HTTPException(status_code=404, detail="Stock take not found")
    if stock_take.status not in ("draft",):
        raise HTTPException(
            status_code=400,
            detail=f"Stock take is '{stock_take.status}', only drafts can be submitted.",
        )

    stock_take.submitted_at = datetime.now(UTC)

    if settings.is_demo_mode:
        stock_take.cin7_stock_take_id = _demo_cin7_id("ST")
        stock_take.status = "synced"
        stock_take.synced_at = datetime.now(UTC)
        logger.info(
            "cin7_stock_take_submitted_demo",
            ref=stock_take.reference,
            cin7_id=stock_take.cin7_stock_take_id,
        )
    else:
        try:
            # Gather lines
            lines_result = await db.execute(
                select(Cin7StockTakeLine).where(
                    Cin7StockTakeLine.stock_take_id == stock_take_id
                )
            )
            lines = lines_result.scalars().all()

            from src.integrations.cin7.client import get_cin7_client

            async with get_cin7_client(settings) as client:
                payload = {
                    "Location": stock_take.location_id,
                    "Reference": stock_take.reference,
                    "Lines": [
                        {"SKU": ln.sku, "CountedQty": ln.counted_qty}
                        for ln in lines
                    ],
                }
                result_api = await client.core._request(
                    "POST", "/stockTake", json=payload
                )
                stock_take.cin7_stock_take_id = result_api.get("TaskID", str(uuid4()))
                stock_take.status = "synced"
                stock_take.synced_at = datetime.now(UTC)
        except Exception as exc:
            stock_take.status = "failed"
            logger.error("cin7_stock_take_submit_failed", error=str(exc))

    await db.commit()
    return _record_to_dict(stock_take)
