"""Cin7 Shadow Sync API endpoints.

Phase A of the Shadow Transition System (UNI-1260).

Provides routes for:
  - Triggering a shadow poll (detect gaps between Cin7 and ERP)
  - Querying shadow sync status summary
  - Listing / filtering sync gaps
  - Resolving or ignoring individual gaps
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.config.database import get_async_db
from src.db.cin7_shadow_models import Cin7ShadowSync, Cin7SyncGap

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7/shadow", tags=["Cin7 Shadow Sync"])

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------


class ShadowStatusResponse(BaseModel):
    total_synced: int
    total_gaps: int
    total_conflicts: int
    last_poll_at: str | None
    gap_by_entity: dict[str, int]


class SyncGapResponse(BaseModel):
    id: str
    shadow_sync_id: str
    gap_type: str
    entity_type: str
    cin7_id: str
    erp_id: str | None
    field_name: str | None
    cin7_value: str | None
    erp_value: str | None
    severity: str
    status: str
    detected_at: str
    resolved_at: str | None
    resolution_notes: str | None
    created_at: str


class GapListResponse(BaseModel):
    items: list[SyncGapResponse]
    total: int
    page: int
    page_size: int


class GapSummaryItem(BaseModel):
    entity_type: str
    severity: str
    count: int


class GapUpdateRequest(BaseModel):
    status: str  # open | investigating | resolved | ignored
    resolution_notes: str | None = None


# ---------------------------------------------------------------------------
# Demo data helpers
# ---------------------------------------------------------------------------

_DEMO_ENTITY_TYPES = [
    "product",
    "customer",
    "order",
    "quote",
    "supplier",
    "purchase_order",
]

_DEMO_GAP_TYPES = [
    "missing_in_erp",
    "missing_in_cin7",
    "data_mismatch",
    "stale_data",
]

_DEMO_SEVERITIES = ["low", "medium", "high", "critical"]


def _make_demo_shadow_syncs() -> list[dict[str, Any]]:
    """Return 5 realistic demo shadow sync records with mixed statuses."""
    now = datetime.now(UTC)
    return [
        {
            "id": str(uuid4()),
            "entity_type": "product",
            "cin7_id": "PROD-CIN7-1001",
            "erp_id": None,
            "sync_status": "gap",
            "cin7_hash": "a1b2c3d4e5f6",
            "erp_hash": None,
            "last_checked_at": now.isoformat(),
            "gap_detected_at": (now - timedelta(hours=2)).isoformat(),
            "resolved_at": None,
            "created_at": (now - timedelta(days=1)).isoformat(),
        },
        {
            "id": str(uuid4()),
            "entity_type": "customer",
            "cin7_id": "CUST-CIN7-2042",
            "erp_id": str(uuid4()),
            "sync_status": "conflict",
            "cin7_hash": "b2c3d4e5f6a1",
            "erp_hash": "x9y8z7w6v5u4",
            "last_checked_at": now.isoformat(),
            "gap_detected_at": (now - timedelta(hours=5)).isoformat(),
            "resolved_at": None,
            "created_at": (now - timedelta(days=2)).isoformat(),
        },
        {
            "id": str(uuid4()),
            "entity_type": "order",
            "cin7_id": "ORD-CIN7-3301",
            "erp_id": str(uuid4()),
            "sync_status": "synced",
            "cin7_hash": "c3d4e5f6a1b2",
            "erp_hash": "c3d4e5f6a1b2",
            "last_checked_at": now.isoformat(),
            "gap_detected_at": None,
            "resolved_at": None,
            "created_at": (now - timedelta(days=3)).isoformat(),
        },
        {
            "id": str(uuid4()),
            "entity_type": "product",
            "cin7_id": "PROD-CIN7-1005",
            "erp_id": str(uuid4()),
            "sync_status": "gap",
            "cin7_hash": "d4e5f6a1b2c3",
            "erp_hash": "000000000000",
            "last_checked_at": now.isoformat(),
            "gap_detected_at": (now - timedelta(hours=1)).isoformat(),
            "resolved_at": None,
            "created_at": (now - timedelta(days=1)).isoformat(),
        },
        {
            "id": str(uuid4()),
            "entity_type": "supplier",
            "cin7_id": "SUP-CIN7-0088",
            "erp_id": str(uuid4()),
            "sync_status": "synced",
            "cin7_hash": "e5f6a1b2c3d4",
            "erp_hash": "e5f6a1b2c3d4",
            "last_checked_at": now.isoformat(),
            "gap_detected_at": None,
            "resolved_at": None,
            "created_at": (now - timedelta(days=7)).isoformat(),
        },
    ]


def _make_demo_gaps(shadow_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return gap records for shadow sync records that have gaps."""
    now = datetime.now(UTC)
    gap_records = []

    for record in shadow_records:
        if record["sync_status"] == "gap" and record["entity_type"] == "product":
            gap_records.append(
                {
                    "id": str(uuid4()),
                    "shadow_sync_id": record["id"],
                    "gap_type": "missing_in_erp",
                    "entity_type": record["entity_type"],
                    "cin7_id": record["cin7_id"],
                    "erp_id": None,
                    "field_name": None,
                    "cin7_value": None,
                    "erp_value": None,
                    "severity": "high",
                    "status": "open",
                    "detected_at": record["gap_detected_at"],
                    "resolved_at": None,
                    "resolution_notes": None,
                    "created_at": record["gap_detected_at"],
                }
            )

        if record["sync_status"] == "conflict":
            gap_records.append(
                {
                    "id": str(uuid4()),
                    "shadow_sync_id": record["id"],
                    "gap_type": "data_mismatch",
                    "entity_type": record["entity_type"],
                    "cin7_id": record["cin7_id"],
                    "erp_id": record.get("erp_id"),
                    "field_name": "email",
                    "cin7_value": "contact@acme.cin7.com",
                    "erp_value": "old-contact@acme.local",
                    "severity": "medium",
                    "status": "investigating",
                    "detected_at": record["gap_detected_at"],
                    "resolved_at": None,
                    "resolution_notes": "Awaiting customer confirmation on canonical email",
                    "created_at": record["gap_detected_at"],
                }
            )

    return gap_records


# ---------------------------------------------------------------------------
# POST /api/cin7/shadow/poll
# ---------------------------------------------------------------------------


@router.post("/poll")
async def trigger_shadow_poll(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Trigger a shadow poll: compare Cin7 entities against ERP records.

    In demo mode, creates / refreshes 5 realistic demo shadow sync records with
    mixed statuses (synced, gap, conflict) and generates associated gap records.

    In live mode, this would iterate through configured entity types, fetch
    the current Cin7 state, compare against ERP mappings, and persist results.
    """
    logger.info("cin7_shadow_poll_triggered", mode=settings.mode)
    now = datetime.now(UTC)

    if settings.mode == "demo":
        # ---- Demo mode: persist 5 shadow records + associated gaps ----
        demo_records = _make_demo_shadow_syncs()
        demo_gaps = _make_demo_gaps(demo_records)

        synced_count = sum(1 for r in demo_records if r["sync_status"] == "synced")
        gap_count = sum(1 for r in demo_records if r["sync_status"] == "gap")
        conflict_count = sum(1 for r in demo_records if r["sync_status"] == "conflict")

        # Upsert shadow records into the database
        for record_data in demo_records:
            # Check if a shadow record already exists for this cin7_id + entity_type
            existing_stmt = select(Cin7ShadowSync).where(
                Cin7ShadowSync.cin7_id == record_data["cin7_id"],
                Cin7ShadowSync.entity_type == record_data["entity_type"],
            )
            existing_result = await db.execute(existing_stmt)
            existing = existing_result.scalar_one_or_none()

            if existing is None:
                shadow = Cin7ShadowSync(
                    id=record_data["id"],
                    entity_type=record_data["entity_type"],
                    cin7_id=record_data["cin7_id"],
                    erp_id=record_data.get("erp_id"),
                    sync_status=record_data["sync_status"],
                    cin7_hash=record_data.get("cin7_hash"),
                    erp_hash=record_data.get("erp_hash"),
                    last_checked_at=now,
                    gap_detected_at=(
                        datetime.fromisoformat(record_data["gap_detected_at"])
                        if record_data.get("gap_detected_at")
                        else None
                    ),
                )
                db.add(shadow)
            else:
                # Update the existing record
                existing.sync_status = record_data["sync_status"]
                existing.cin7_hash = record_data.get("cin7_hash")
                existing.erp_hash = record_data.get("erp_hash")
                existing.last_checked_at = now
                if record_data.get("gap_detected_at") and not existing.gap_detected_at:
                    existing.gap_detected_at = datetime.fromisoformat(
                        record_data["gap_detected_at"]
                    )
                # Update record id so gap FK insertion uses existing id
                record_data["id"] = str(existing.id)

        await db.flush()

        # Insert gap records (skip if shadow_sync_id already has open gaps)
        for gap_data in demo_gaps:
            existing_gap_stmt = select(Cin7SyncGap).where(
                Cin7SyncGap.shadow_sync_id == gap_data["shadow_sync_id"],
                Cin7SyncGap.gap_type == gap_data["gap_type"],
                Cin7SyncGap.status.in_(["open", "investigating"]),
            )
            existing_gap = await db.execute(existing_gap_stmt)
            if existing_gap.scalar_one_or_none() is None:
                gap = Cin7SyncGap(
                    id=gap_data["id"],
                    shadow_sync_id=gap_data["shadow_sync_id"],
                    gap_type=gap_data["gap_type"],
                    entity_type=gap_data["entity_type"],
                    cin7_id=gap_data["cin7_id"],
                    erp_id=gap_data.get("erp_id"),
                    field_name=gap_data.get("field_name"),
                    cin7_value=gap_data.get("cin7_value"),
                    erp_value=gap_data.get("erp_value"),
                    severity=gap_data["severity"],
                    status=gap_data["status"],
                    detected_at=datetime.fromisoformat(gap_data["detected_at"]),
                    resolution_notes=gap_data.get("resolution_notes"),
                )
                db.add(gap)

        await db.commit()

        logger.info(
            "cin7_shadow_poll_demo_complete",
            records=len(demo_records),
            gaps=len(demo_gaps),
        )

        return {
            "status": "completed",
            "mode": "demo",
            "polled_at": now.isoformat(),
            "records_checked": len(demo_records),
            "records_synced": synced_count,
            "records_gap": gap_count,
            "records_conflict": conflict_count,
            "gaps_detected": len(demo_gaps),
        }

    # ---- Live mode: full Cin7 ghost sync ----
    logger.info("cin7_shadow_poll_live_started")
    from src.services.shadow_poller import run_shadow_poll
    return await run_shadow_poll(db)


# ---------------------------------------------------------------------------
# GET /api/cin7/shadow/status
# ---------------------------------------------------------------------------


@router.get("/status")
async def get_shadow_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> ShadowStatusResponse:
    """Return a summary of the current shadow sync state.

    Counts synced / gap / conflict records and breaks down gaps by entity type.
    Falls back to demo stats if no records exist in the database.
    """
    # Aggregate counts by sync_status
    status_stmt = select(
        Cin7ShadowSync.sync_status,
        func.count(Cin7ShadowSync.id).label("cnt"),
    ).group_by(Cin7ShadowSync.sync_status)

    status_result = await db.execute(status_stmt)
    status_rows = status_result.all()

    counts: dict[str, int] = {"synced": 0, "gap": 0, "conflict": 0, "unknown": 0}
    for row in status_rows:
        if row.sync_status in counts:
            counts[row.sync_status] = row.cnt

    # Last poll timestamp
    last_poll_stmt = select(func.max(Cin7ShadowSync.last_checked_at))
    last_poll_result = await db.execute(last_poll_stmt)
    last_poll_at_raw = last_poll_result.scalar_one_or_none()
    last_poll_at = last_poll_at_raw.isoformat() if last_poll_at_raw else None

    # Gap counts by entity type (only gap + conflict records)
    gap_by_entity_stmt = (
        select(
            Cin7ShadowSync.entity_type,
            func.count(Cin7ShadowSync.id).label("cnt"),
        )
        .where(Cin7ShadowSync.sync_status.in_(["gap", "conflict"]))
        .group_by(Cin7ShadowSync.entity_type)
    )
    gap_by_entity_result = await db.execute(gap_by_entity_stmt)
    gap_by_entity: dict[str, int] = {}
    for row in gap_by_entity_result.all():
        gap_by_entity[row.entity_type] = row.cnt

    # If DB is empty and in demo mode, return plausible demo stats
    total_records = sum(counts.values())
    if total_records == 0 and settings.mode == "demo":
        return ShadowStatusResponse(
            total_synced=3,
            total_gaps=2,
            total_conflicts=1,
            last_poll_at=None,
            gap_by_entity={"product": 2, "customer": 1},
        )

    return ShadowStatusResponse(
        total_synced=counts["synced"],
        total_gaps=counts["gap"],
        total_conflicts=counts["conflict"],
        last_poll_at=last_poll_at,
        gap_by_entity=gap_by_entity,
    )


# ---------------------------------------------------------------------------
# GET /api/cin7/shadow/gaps
# ---------------------------------------------------------------------------


@router.get("/gaps")
async def list_sync_gaps(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entity_type: str | None = Query(None),
    severity: str | None = Query(None),
) -> GapListResponse:
    """Return paginated list of open Cin7SyncGap records.

    Filters:
      - entity_type: product | customer | order | quote | supplier | purchase_order
      - severity: low | medium | high | critical
    """
    base_stmt = select(Cin7SyncGap).where(
        Cin7SyncGap.status.in_(["open", "investigating"])
    )

    if entity_type:
        base_stmt = base_stmt.where(Cin7SyncGap.entity_type == entity_type)
    if severity:
        base_stmt = base_stmt.where(Cin7SyncGap.severity == severity)

    # Total count
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Paginated rows
    offset = (page - 1) * page_size
    paginated_stmt = (
        base_stmt.order_by(Cin7SyncGap.detected_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows_result = await db.execute(paginated_stmt)
    rows = rows_result.scalars().all()

    items = [
        SyncGapResponse(
            id=str(row.id),
            shadow_sync_id=str(row.shadow_sync_id),
            gap_type=row.gap_type,
            entity_type=row.entity_type,
            cin7_id=row.cin7_id,
            erp_id=str(row.erp_id) if row.erp_id else None,
            field_name=row.field_name,
            cin7_value=row.cin7_value,
            erp_value=row.erp_value,
            severity=row.severity,
            status=row.status,
            detected_at=row.detected_at.isoformat(),
            resolved_at=row.resolved_at.isoformat() if row.resolved_at else None,
            resolution_notes=row.resolution_notes,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]

    return GapListResponse(items=items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# GET /api/cin7/shadow/gaps/summary
# ---------------------------------------------------------------------------


@router.get("/gaps/summary")
async def get_gaps_summary(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[GapSummaryItem]:
    """Return gap counts grouped by entity_type and severity."""
    stmt = (
        select(
            Cin7SyncGap.entity_type,
            Cin7SyncGap.severity,
            func.count(Cin7SyncGap.id).label("cnt"),
        )
        .where(Cin7SyncGap.status.in_(["open", "investigating"]))
        .group_by(Cin7SyncGap.entity_type, Cin7SyncGap.severity)
        .order_by(Cin7SyncGap.entity_type, Cin7SyncGap.severity)
    )
    result = await db.execute(stmt)
    return [
        GapSummaryItem(entity_type=row.entity_type, severity=row.severity, count=row.cnt)
        for row in result.all()
    ]


# ---------------------------------------------------------------------------
# PATCH /api/cin7/shadow/gaps/{gap_id}
# ---------------------------------------------------------------------------


@router.patch("/gaps/{gap_id}")
async def update_gap_status(
    gap_id: str,
    body: GapUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SyncGapResponse:
    """Update the status of a sync gap (resolve / ignore / reopen).

    Valid transitions:
      open -> investigating, resolved, ignored
      investigating -> resolved, ignored, open
      resolved -> open  (re-open if gap recurs)
      ignored -> open
    """
    valid_statuses = {"open", "investigating", "resolved", "ignored"}
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(valid_statuses)}",
        )

    stmt = select(Cin7SyncGap).where(Cin7SyncGap.id == gap_id)
    result = await db.execute(stmt)
    gap = result.scalar_one_or_none()

    if gap is None:
        raise HTTPException(status_code=404, detail=f"Gap '{gap_id}' not found")

    now = datetime.now(UTC)
    gap.status = body.status
    if body.resolution_notes is not None:
        gap.resolution_notes = body.resolution_notes

    if body.status in ("resolved", "ignored") and gap.resolved_at is None:
        gap.resolved_at = now

    if body.status == "open":
        gap.resolved_at = None

    await db.commit()
    await db.refresh(gap)

    logger.info(
        "cin7_sync_gap_updated",
        gap_id=gap_id,
        new_status=body.status,
    )

    return SyncGapResponse(
        id=str(gap.id),
        shadow_sync_id=str(gap.shadow_sync_id),
        gap_type=gap.gap_type,
        entity_type=gap.entity_type,
        cin7_id=gap.cin7_id,
        erp_id=str(gap.erp_id) if gap.erp_id else None,
        field_name=gap.field_name,
        cin7_value=gap.cin7_value,
        erp_value=gap.erp_value,
        severity=gap.severity,
        status=gap.status,
        detected_at=gap.detected_at.isoformat(),
        resolved_at=gap.resolved_at.isoformat() if gap.resolved_at else None,
        resolution_notes=gap.resolution_notes,
        created_at=gap.created_at.isoformat(),
    )
