"""Cin7 BOM (Bill of Materials) and Production Run API endpoints.

Provides routes for syncing BOM masters from Cin7, listing/querying BOMs
with their component lists, and managing production runs against those BOMs.

Demo mode returns pre-seeded fixtures for the 3 demo BOM records.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_bom_models import (
    BomStatus,
    Cin7BomComponent,
    Cin7BomMaster,
    Cin7ProductionRun,
    ProductionRunStatus,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7/bom", tags=["Cin7 BOM"])

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------


class BomComponentResponse(BaseModel):
    id: str
    bom_master_id: str
    component_sku: str
    component_name: str
    quantity: str
    uom: str
    wastage_percent: str
    notes: str | None


class BomMasterResponse(BaseModel):
    id: str
    cin7_bom_id: str
    name: str
    sku: str
    version: str
    status: str
    finished_good_sku: str | None
    finished_good_name: str | None
    quantity_produced: str
    uom: str
    notes: str | None
    last_synced_at: str | None
    created_at: str
    updated_at: str
    components: list[BomComponentResponse] = []


class BomListResponse(BaseModel):
    items: list[BomMasterResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SyncBomsResponse(BaseModel):
    status: str
    boms_synced: int
    message: str


class ProductionRunResponse(BaseModel):
    id: str
    bom_master_id: str
    bom_name: str
    cin7_production_id: str | None
    quantity_planned: str
    quantity_completed: str
    status: str
    planned_date: str | None
    completed_date: str | None
    location_id: str | None
    notes: str | None
    cin7_synced: bool
    created_at: str
    updated_at: str


class ProductionRunListResponse(BaseModel):
    items: list[ProductionRunResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CreateProductionRunRequest(BaseModel):
    bom_master_id: str = Field(..., min_length=1)
    quantity_planned: Decimal = Field(..., gt=0)
    planned_date: date | None = None
    location_id: str | None = None
    notes: str | None = None


class UpdateProductionRunStatusRequest(BaseModel):
    status: str = Field(..., description="planned | in_progress | completed | cancelled")
    quantity_completed: Decimal | None = Field(None, ge=0)
    completed_date: date | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_STATUS_TRANSITIONS: dict[str, set[str]] = {
    ProductionRunStatus.PLANNED.value: {
        ProductionRunStatus.IN_PROGRESS.value,
        ProductionRunStatus.CANCELLED.value,
    },
    ProductionRunStatus.IN_PROGRESS.value: {
        ProductionRunStatus.COMPLETED.value,
        ProductionRunStatus.CANCELLED.value,
    },
    ProductionRunStatus.COMPLETED.value: set(),
    ProductionRunStatus.CANCELLED.value: set(),
}

_DEMO_BOMS: list[dict[str, Any]] = [
    {
        "cin7_bom_id": "BOM-001",
        "name": "Industrial Pressure Washer Assembly",
        "sku": "FG-PWA-3000",
        "version": "2",
        "status": "active",
        "finished_good_sku": "FG-PWA-3000",
        "finished_good_name": "Industrial Pressure Washer 3000 PSI",
        "quantity_produced": Decimal("1"),
        "uom": "EA",
        "notes": "Assembled from pump unit, frame, and hose kit",
        "components": [
            {
                "component_sku": "RM-PUMP-3000",
                "component_name": "High-Pressure Pump Unit 3000 PSI",
                "quantity": Decimal("1"),
                "uom": "EA",
                "wastage_percent": Decimal("2"),
                "notes": None,
            },
            {
                "component_sku": "RM-FRAME-STL",
                "component_name": "Steel Frame Assembly",
                "quantity": Decimal("1"),
                "uom": "EA",
                "wastage_percent": Decimal("0"),
                "notes": None,
            },
            {
                "component_sku": "RM-HOSE-15M",
                "component_name": "High-Pressure Hose 15m",
                "quantity": Decimal("2"),
                "uom": "EA",
                "wastage_percent": Decimal("5"),
                "notes": "Order 2 per unit — one spare",
            },
            {
                "component_sku": "RM-LANCE-KIT",
                "component_name": "Lance and Nozzle Kit",
                "quantity": Decimal("1"),
                "uom": "KIT",
                "wastage_percent": Decimal("1"),
                "notes": None,
            },
        ],
    },
    {
        "cin7_bom_id": "BOM-002",
        "name": "Safety Equipment Bundle — Site Pack",
        "sku": "FG-SAFE-SITE",
        "version": "1",
        "status": "active",
        "finished_good_sku": "FG-SAFE-SITE",
        "finished_good_name": "Site Safety Equipment Pack",
        "quantity_produced": Decimal("1"),
        "uom": "KIT",
        "notes": "Standard site safety pack for 1 worker",
        "components": [
            {
                "component_sku": "RM-HELMET-WHT",
                "component_name": "Safety Helmet White",
                "quantity": Decimal("1"),
                "uom": "EA",
                "wastage_percent": Decimal("0"),
                "notes": None,
            },
            {
                "component_sku": "RM-VEST-HI",
                "component_name": "Hi-Vis Safety Vest",
                "quantity": Decimal("1"),
                "uom": "EA",
                "wastage_percent": Decimal("3"),
                "notes": None,
            },
            {
                "component_sku": "RM-GLOVES-L",
                "component_name": "Work Gloves Large",
                "quantity": Decimal("2"),
                "uom": "PAIR",
                "wastage_percent": Decimal("5"),
                "notes": "Include 2 pairs per pack",
            },
            {
                "component_sku": "RM-BOOTS-10",
                "component_name": "Safety Boots Size 10",
                "quantity": Decimal("1"),
                "uom": "PAIR",
                "wastage_percent": Decimal("0"),
                "notes": None,
            },
        ],
    },
    {
        "cin7_bom_id": "BOM-003",
        "name": "Electrical Maintenance Kit",
        "sku": "FG-ELEC-MAINT",
        "version": "1",
        "status": "draft",
        "finished_good_sku": "FG-ELEC-MAINT",
        "finished_good_name": "Electrical Maintenance Tool Kit",
        "quantity_produced": Decimal("1"),
        "uom": "KIT",
        "notes": "Draft — pending component cost review",
        "components": [
            {
                "component_sku": "RM-MULTIMETER",
                "component_name": "Digital Multimeter",
                "quantity": Decimal("1"),
                "uom": "EA",
                "wastage_percent": Decimal("0"),
                "notes": None,
            },
            {
                "component_sku": "RM-SCREWSET",
                "component_name": "Insulated Screwdriver Set",
                "quantity": Decimal("1"),
                "uom": "SET",
                "wastage_percent": Decimal("2"),
                "notes": None,
            },
            {
                "component_sku": "RM-CABLETEST",
                "component_name": "Cable Tester Pro",
                "quantity": Decimal("1"),
                "uom": "EA",
                "wastage_percent": Decimal("0"),
                "notes": None,
            },
        ],
    },
]


def _bom_to_response(
    bom: Cin7BomMaster,
    components: list[Cin7BomComponent] | None = None,
) -> BomMasterResponse:
    """Convert a BOM ORM object to a Pydantic response."""
    comp_list = components if components is not None else list(bom.components or [])
    return BomMasterResponse(
        id=str(bom.id),
        cin7_bom_id=bom.cin7_bom_id,
        name=bom.name,
        sku=bom.sku,
        version=bom.version,
        status=bom.status,
        finished_good_sku=bom.finished_good_sku,
        finished_good_name=bom.finished_good_name,
        quantity_produced=str(bom.quantity_produced),
        uom=bom.uom,
        notes=bom.notes,
        last_synced_at=bom.last_synced_at.isoformat() if bom.last_synced_at else None,
        created_at=bom.created_at.isoformat() if bom.created_at else "",
        updated_at=bom.updated_at.isoformat() if bom.updated_at else "",
        components=[
            BomComponentResponse(
                id=str(c.id),
                bom_master_id=str(c.bom_master_id),
                component_sku=c.component_sku,
                component_name=c.component_name,
                quantity=str(c.quantity),
                uom=c.uom,
                wastage_percent=str(c.wastage_percent),
                notes=c.notes,
            )
            for c in comp_list
        ],
    )


def _run_to_response(
    run: Cin7ProductionRun,
    bom_name: str = "",
) -> ProductionRunResponse:
    """Convert a ProductionRun ORM object to a Pydantic response."""
    return ProductionRunResponse(
        id=str(run.id),
        bom_master_id=str(run.bom_master_id),
        bom_name=bom_name or (run.bom_master.name if run.bom_master else ""),
        cin7_production_id=run.cin7_production_id,
        quantity_planned=str(run.quantity_planned),
        quantity_completed=str(run.quantity_completed),
        status=run.status,
        planned_date=run.planned_date.isoformat() if run.planned_date else None,
        completed_date=run.completed_date.isoformat() if run.completed_date else None,
        location_id=run.location_id,
        notes=run.notes,
        cin7_synced=run.cin7_synced,
        created_at=run.created_at.isoformat() if run.created_at else "",
        updated_at=run.updated_at.isoformat() if run.updated_at else "",
    )


# ---------------------------------------------------------------------------
# BOM endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=BomListResponse)
async def list_boms(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter by status: active, draft, archived"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    """List BOM masters with optional status filter.

    Returns paginated BOM records including their component lists.
    In demo mode, auto-seeds the 3 demo BOMs if none exist.
    """
    logger.info("bom_list", status=status, page=page, page_size=page_size)

    # Count existing records
    count_q = select(func.count(Cin7BomMaster.id))
    if status:
        count_q = count_q.where(Cin7BomMaster.status == status)
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # Auto-seed demo data if empty
    if total == 0 and not status:
        await _seed_demo_boms(db)
        total_result2 = await db.execute(select(func.count(Cin7BomMaster.id)))
        total = total_result2.scalar() or 0

    # Fetch page
    q = select(Cin7BomMaster)
    if status:
        q = q.where(Cin7BomMaster.status == status)
    q = q.order_by(Cin7BomMaster.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    boms = list(result.scalars().all())

    total_pages = max(1, (total + page_size - 1) // page_size)
    return BomListResponse(
        items=[_bom_to_response(b) for b in boms],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/sync", response_model=SyncBomsResponse)
async def sync_boms_from_cin7(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Sync BOM masters from Cin7.

    In demo mode, upserts the 3 demo BOMs and their components.
    In live mode this would call the Cin7 BomMasters / FinishedGoods API.
    """
    logger.info("bom_sync_started")

    synced = await _seed_demo_boms(db, force=True)

    logger.info("bom_sync_complete", boms_synced=synced)
    return SyncBomsResponse(
        status="success",
        boms_synced=synced,
        message=f"Synced {synced} BOMs from Cin7 (demo mode)",
    )


# ---------------------------------------------------------------------------
# Production Run endpoints
# NOTE: These must be declared BEFORE /{bom_id} so FastAPI does not match
# the literal string "production-runs" as a bom_id path parameter.
# ---------------------------------------------------------------------------


@router.get("/production-runs", response_model=ProductionRunListResponse)
async def list_production_runs(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(
        None,
        description="Filter by status: planned, in_progress, completed, cancelled",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    """List production runs with optional status filter."""
    logger.info("production_runs_list", status=status, page=page)

    count_q = select(func.count(Cin7ProductionRun.id))
    if status:
        count_q = count_q.where(Cin7ProductionRun.status == status)
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    q = select(Cin7ProductionRun)
    if status:
        q = q.where(Cin7ProductionRun.status == status)
    q = q.order_by(Cin7ProductionRun.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    runs = list(result.scalars().all())

    # Resolve BOM names
    items = []
    for run in runs:
        bom_name = ""
        if run.bom_master:
            bom_name = run.bom_master.name
        else:
            bom_result = await db.execute(
                select(Cin7BomMaster).where(Cin7BomMaster.id == run.bom_master_id)
            )
            bom = bom_result.scalar_one_or_none()
            bom_name = bom.name if bom else ""
        items.append(_run_to_response(run, bom_name))

    total_pages = max(1, (total + page_size - 1) // page_size)
    return ProductionRunListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/production-runs", response_model=ProductionRunResponse)
async def create_production_run(
    body: CreateProductionRunRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Create a new production run against an existing BOM master."""
    logger.info("production_run_create", bom_master_id=body.bom_master_id)

    # Verify BOM exists
    bom_result = await db.execute(
        select(Cin7BomMaster).where(Cin7BomMaster.id == body.bom_master_id)
    )
    bom = bom_result.scalar_one_or_none()
    if bom is None:
        raise HTTPException(status_code=404, detail="BOM master not found")

    if bom.status == BomStatus.ARCHIVED.value:
        raise HTTPException(
            status_code=400,
            detail="Cannot create a production run against an archived BOM",
        )

    run = Cin7ProductionRun(
        id=str(uuid4()),
        bom_master_id=body.bom_master_id,
        quantity_planned=body.quantity_planned,
        quantity_completed=Decimal("0"),
        status=ProductionRunStatus.PLANNED.value,
        planned_date=body.planned_date,
        location_id=body.location_id,
        notes=body.notes,
        cin7_synced=False,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    logger.info(
        "production_run_created",
        run_id=str(run.id),
        bom_id=body.bom_master_id,
        qty=str(body.quantity_planned),
    )
    return _run_to_response(run, bom_name=bom.name)


@router.patch("/production-runs/{run_id}/status", response_model=ProductionRunResponse)
async def update_production_run_status(
    run_id: str,
    body: UpdateProductionRunStatusRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Advance the status of a production run.

    Valid transitions:
    - planned -> in_progress | cancelled
    - in_progress -> completed | cancelled
    """
    logger.info("production_run_status_update", run_id=run_id, new_status=body.status)

    # Validate status value
    valid_statuses = {s.value for s in ProductionRunStatus}
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(valid_statuses))}",
        )

    result = await db.execute(
        select(Cin7ProductionRun).where(Cin7ProductionRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Production run not found")

    # Validate transition
    allowed = _VALID_STATUS_TRANSITIONS.get(run.status, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition from '{run.status}' to '{body.status}'. "
                f"Allowed transitions: {sorted(allowed) or 'none (terminal state)'}"
            ),
        )

    run.status = body.status

    if body.quantity_completed is not None:
        run.quantity_completed = body.quantity_completed

    if body.completed_date is not None:
        run.completed_date = body.completed_date
    elif body.status == ProductionRunStatus.COMPLETED.value and run.completed_date is None:
        run.completed_date = datetime.now(UTC).date()

    if body.notes is not None:
        run.notes = body.notes

    # Auto-set quantity_completed = quantity_planned when marking completed
    if body.status == ProductionRunStatus.COMPLETED.value and body.quantity_completed is None:
        run.quantity_completed = run.quantity_planned

    await db.commit()
    await db.refresh(run)

    # Resolve BOM name
    bom_name = ""
    bom_result = await db.execute(
        select(Cin7BomMaster).where(Cin7BomMaster.id == run.bom_master_id)
    )
    bom = bom_result.scalar_one_or_none()
    if bom:
        bom_name = bom.name

    logger.info("production_run_status_updated", run_id=run_id, status=run.status)
    return _run_to_response(run, bom_name=bom_name)


# ---------------------------------------------------------------------------
# Single BOM endpoint — declared AFTER production-runs to avoid path conflict
# ---------------------------------------------------------------------------


@router.get("/{bom_id}", response_model=BomMasterResponse)
async def get_bom(
    bom_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Get a single BOM master with all its component lines."""
    logger.info("bom_get", bom_id=bom_id)

    result = await db.execute(
        select(Cin7BomMaster).where(Cin7BomMaster.id == bom_id)
    )
    bom = result.scalar_one_or_none()
    if bom is None:
        raise HTTPException(status_code=404, detail="BOM not found")

    return _bom_to_response(bom)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _seed_demo_boms(db: AsyncSession, force: bool = False) -> int:
    """Upsert the 3 demo BOMs and their components.

    Args:
        db: Database session.
        force: If True, update existing records (re-sync). If False, skip existing.

    Returns:
        Number of BOMs inserted or updated.
    """
    now = datetime.now(UTC)
    synced_count = 0

    for demo in _DEMO_BOMS:
        # Check if BOM already exists
        existing_result = await db.execute(
            select(Cin7BomMaster).where(
                Cin7BomMaster.cin7_bom_id == demo["cin7_bom_id"]
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing and not force:
            continue

        if existing:
            # Update existing
            existing.name = demo["name"]
            existing.sku = demo["sku"]
            existing.version = demo["version"]
            existing.status = demo["status"]
            existing.finished_good_sku = demo["finished_good_sku"]
            existing.finished_good_name = demo["finished_good_name"]
            existing.quantity_produced = demo["quantity_produced"]
            existing.uom = demo["uom"]
            existing.notes = demo["notes"]
            existing.last_synced_at = now
            bom = existing

            # Delete and re-create components on force-sync
            comp_result = await db.execute(
                select(Cin7BomComponent).where(
                    Cin7BomComponent.bom_master_id == str(existing.id)
                )
            )
            for comp in comp_result.scalars().all():
                await db.delete(comp)
        else:
            bom = Cin7BomMaster(
                id=str(uuid4()),
                cin7_bom_id=demo["cin7_bom_id"],
                name=demo["name"],
                sku=demo["sku"],
                version=demo["version"],
                status=demo["status"],
                finished_good_sku=demo["finished_good_sku"],
                finished_good_name=demo["finished_good_name"],
                quantity_produced=demo["quantity_produced"],
                uom=demo["uom"],
                notes=demo["notes"],
                last_synced_at=now,
            )
            db.add(bom)
            await db.flush()  # Ensure bom.id is available

        # Insert components
        for comp_data in demo["components"]:
            comp = Cin7BomComponent(
                id=str(uuid4()),
                bom_master_id=str(bom.id),
                component_sku=comp_data["component_sku"],
                component_name=comp_data["component_name"],
                quantity=comp_data["quantity"],
                uom=comp_data["uom"],
                wastage_percent=comp_data["wastage_percent"],
                notes=comp_data["notes"],
            )
            db.add(comp)

        synced_count += 1

    await db.commit()
    return synced_count
