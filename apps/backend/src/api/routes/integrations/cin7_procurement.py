"""Cin7 procurement sync API endpoints.

Provides routes for triggering supplier and purchase order syncs between
the CCW ERP and Cin7 (Core + Omni).
"""

from typing import Annotated, Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.config.database import get_async_db
from src.integrations.cin7.client import get_cin7_client
from src.integrations.cin7.purchase_sync import Cin7PurchaseSyncer
from src.integrations.cin7.supplier_sync import Cin7SupplierSyncer

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/cin7/sync", tags=["Cin7 Procurement Sync"])


# ------------------------------------------------------------------
# Supplier endpoints
# ------------------------------------------------------------------


@router.post("/suppliers")
async def sync_cin7_suppliers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    source: str = "core",
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Trigger a full supplier sync."""
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    logger.info("cin7_supplier_sync_triggered", direction=direction, source=source)

    async with get_cin7_client(settings) as client:
        syncer = Cin7SupplierSyncer(db, client)

        if direction == "cin7_to_erp":
            log = await syncer.sync_suppliers_from_cin7(source=source, page=page, limit=limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Bulk erp_to_cin7 supplier sync not yet supported. Use the single-supplier endpoint.",
            )

    await db.commit()

    return {
        "status": log.status,
        "direction": direction,
        "source": source,
        "records_processed": log.records_processed,
        "records_created": log.records_created,
        "records_updated": log.records_updated,
        "records_failed": log.records_failed,
        "sync_log_id": log.id,
    }


@router.post("/suppliers/{supplier_id}")
async def sync_cin7_supplier_single(
    supplier_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    target: str = "core",
) -> dict[str, Any]:
    """Push a single ERP supplier to Cin7."""
    if target not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="target must be 'core' or 'omni'")

    async with get_cin7_client(settings) as client:
        syncer = Cin7SupplierSyncer(db, client)
        log = await syncer.sync_supplier_to_cin7(supplier_id, target=target)

    await db.commit()

    return {
        "status": log.status,
        "supplier_id": supplier_id,
        "target": target,
        "sync_log_id": log.id,
        "error": log.error_message,
    }


# ------------------------------------------------------------------
# Purchase Order endpoints
# ------------------------------------------------------------------


@router.post("/purchases")
async def sync_cin7_purchases(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    source: str = "core",
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Trigger a full purchase order sync."""
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    logger.info("cin7_purchase_sync_triggered", direction=direction, source=source)

    async with get_cin7_client(settings) as client:
        syncer = Cin7PurchaseSyncer(db, client)

        if direction == "cin7_to_erp":
            log = await syncer.sync_purchase_orders_from_cin7(source=source, page=page, limit=limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Bulk erp_to_cin7 purchase sync not yet supported. Use the single-PO endpoint.",
            )

    await db.commit()

    return {
        "status": log.status,
        "direction": direction,
        "source": source,
        "records_processed": log.records_processed,
        "records_created": log.records_created,
        "records_updated": log.records_updated,
        "records_failed": log.records_failed,
        "sync_log_id": log.id,
    }


@router.post("/purchases/{po_id}")
async def sync_cin7_purchase_single(
    po_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    target: str = "core",
) -> dict[str, Any]:
    """Push a single ERP purchase order to Cin7."""
    if target not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="target must be 'core' or 'omni'")

    async with get_cin7_client(settings) as client:
        syncer = Cin7PurchaseSyncer(db, client)
        log = await syncer.sync_purchase_order_to_cin7(po_id, target=target)

    await db.commit()

    return {
        "status": log.status,
        "po_id": po_id,
        "target": target,
        "sync_log_id": log.id,
        "error": log.error_message,
    }
