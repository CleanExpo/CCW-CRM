"""Cin7 sync API endpoints.

Provides routes for triggering product and inventory syncs between
the CCW ERP and Cin7 (Core + Omni), and for viewing sync logs.
"""

from typing import Annotated, Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.config.database import get_async_db
from src.db.cin7_models import Cin7SyncLog
from src.integrations.cin7.client import get_cin7_client
from src.integrations.cin7.inventory_sync import Cin7InventorySyncer
from src.integrations.cin7.product_sync import Cin7ProductSyncer

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/cin7/sync", tags=["Cin7 Sync"])


@router.post("/products")
async def sync_cin7_products(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    source: str = "core",
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Trigger a full product sync.

    Args:
        direction: ``cin7_to_erp`` to import from Cin7, ``erp_to_cin7`` to push.
        source: Which Cin7 API — ``core`` or ``omni``.
        page: Starting page for Cin7 → ERP direction.
        limit: Records per page.
    """
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    logger.info("cin7_product_sync_triggered", direction=direction, source=source)

    async with get_cin7_client(settings) as client:
        syncer = Cin7ProductSyncer(db, client)

        if direction == "cin7_to_erp":
            log = await syncer.sync_products_from_cin7(source=source, page=page, limit=limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Bulk erp_to_cin7 product sync not yet supported. Use the single-product endpoint.",
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


@router.post("/products/{product_id}")
async def sync_cin7_product_single(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    target: str = "core",
) -> dict[str, Any]:
    """Push a single ERP product to Cin7.

    Args:
        product_id: The ERP product UUID.
        target: Which Cin7 API to push to — ``core`` or ``omni``.
    """
    if target not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="target must be 'core' or 'omni'")

    async with get_cin7_client(settings) as client:
        syncer = Cin7ProductSyncer(db, client)
        log = await syncer.sync_product_to_cin7(product_id, target=target)

    await db.commit()

    return {
        "status": log.status,
        "product_id": product_id,
        "target": target,
        "sync_log_id": log.id,
        "error": log.error_message,
    }


@router.post("/inventory")
async def sync_cin7_inventory(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    source: str = "core",
) -> dict[str, Any]:
    """Trigger a full inventory/stock sync.

    Args:
        direction: ``cin7_to_erp`` to pull stock from Cin7, ``erp_to_cin7`` to push.
        source: Which Cin7 API — ``core`` or ``omni``.
    """
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    logger.info("cin7_inventory_sync_triggered", direction=direction, source=source)

    async with get_cin7_client(settings) as client:
        syncer = Cin7InventorySyncer(client)

        if direction == "cin7_to_erp":
            log = await syncer.bulk_sync_stock_from_cin7(db, source=source)
        else:
            log = await syncer.bulk_sync_stock_to_cin7(db, source=source)

    await db.commit()

    return {
        "status": log.status,
        "direction": direction,
        "source": source,
        "records_processed": log.records_processed,
        "records_updated": log.records_updated,
        "records_failed": log.records_failed,
        "sync_log_id": log.id,
    }


@router.post("/inventory/{product_id}")
async def sync_cin7_inventory_single(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "erp_to_cin7",
    source: str = "core",
) -> dict[str, Any]:
    """Sync stock for a single product.

    Args:
        product_id: The ERP product UUID.
        direction: Sync direction.
        source: Which Cin7 API — ``core`` or ``omni``.
    """
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    async with get_cin7_client(settings) as client:
        syncer = Cin7InventorySyncer(client)

        if direction == "erp_to_cin7":
            log = await syncer.sync_stock_to_cin7(db, product_id, source=source)
        else:
            # Need mapping to get cin7_sku
            from src.db.cin7_models import Cin7ProductMapping

            result = await db.execute(
                select(Cin7ProductMapping).where(
                    Cin7ProductMapping.product_id == product_id
                )
            )
            mapping = result.scalar_one_or_none()
            if mapping is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No Cin7 mapping found for product {product_id}",
                )
            log = await syncer.sync_stock_from_cin7(
                db, product_id, mapping.cin7_sku, source=source
            )

    await db.commit()

    return {
        "status": log.status,
        "product_id": product_id,
        "direction": direction,
        "source": source,
        "sync_log_id": log.id,
    }


@router.get("/logs")
async def get_cin7_sync_logs(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sync_type: str | None = None,
) -> dict[str, Any]:
    """Get recent Cin7 sync log entries.

    Args:
        page: Page number.
        page_size: Records per page.
        sync_type: Optional filter — ``products`` or ``inventory``.
    """
    query = select(Cin7SyncLog).order_by(Cin7SyncLog.started_at.desc())

    if sync_type:
        query = query.where(Cin7SyncLog.sync_type == sync_type)

    query = query.limit(page_size).offset((page - 1) * page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "page": page,
        "page_size": page_size,
        "logs": [
            {
                "id": str(log.id),
                "sync_type": log.sync_type,
                "direction": log.direction,
                "api_source": log.api_source,
                "status": log.status,
                "records_processed": log.records_processed,
                "records_created": log.records_created,
                "records_updated": log.records_updated,
                "records_failed": log.records_failed,
                "error_message": log.error_message,
                "started_at": log.started_at.isoformat() if log.started_at else None,
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            }
            for log in logs
        ],
    }
