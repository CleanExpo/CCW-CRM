"""Cin7 CRM sync API endpoints.

Provides routes for triggering customer, order, and quote syncs between
the CCW ERP and Cin7 (Core + Omni).
"""

from typing import Annotated, Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.config.database import get_async_db
from src.integrations.cin7.client import get_cin7_client
from src.integrations.cin7.customer_sync import Cin7CustomerSyncer
from src.integrations.cin7.sales_sync import Cin7SalesSyncer

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/cin7/sync", tags=["Cin7 CRM Sync"])


# ------------------------------------------------------------------
# Customer endpoints
# ------------------------------------------------------------------


@router.post("/customers")
async def sync_cin7_customers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    source: str = "core",
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Trigger a full customer sync."""
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    logger.info("cin7_customer_sync_triggered", direction=direction, source=source)

    async with get_cin7_client(settings) as client:
        syncer = Cin7CustomerSyncer(db, client)

        if direction == "cin7_to_erp":
            log = await syncer.sync_customers_from_cin7(source=source, page=page, limit=limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Bulk erp_to_cin7 customer sync not yet supported. Use the single-customer endpoint.",
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


@router.post("/customers/{customer_id}")
async def sync_cin7_customer_single(
    customer_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    target: str = "core",
) -> dict[str, Any]:
    """Push a single ERP customer to Cin7."""
    if target not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="target must be 'core' or 'omni'")

    async with get_cin7_client(settings) as client:
        syncer = Cin7CustomerSyncer(db, client)
        log = await syncer.sync_customer_to_cin7(customer_id, target=target)

    await db.commit()

    return {
        "status": log.status,
        "customer_id": customer_id,
        "target": target,
        "sync_log_id": log.id,
        "error": log.error_message,
    }


# ------------------------------------------------------------------
# Order endpoints
# ------------------------------------------------------------------


@router.post("/orders")
async def sync_cin7_orders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    source: str = "core",
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
) -> dict[str, Any]:
    """Trigger a full order sync."""
    if source not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="source must be 'core' or 'omni'")

    logger.info("cin7_order_sync_triggered", direction=direction, source=source)

    async with get_cin7_client(settings) as client:
        syncer = Cin7SalesSyncer(db, client)

        if direction == "cin7_to_erp":
            log = await syncer.sync_orders_from_cin7(source=source, page=page, limit=limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Bulk erp_to_cin7 order sync not yet supported. Use the single-order endpoint.",
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


@router.post("/orders/{order_id}")
async def sync_cin7_order_single(
    order_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    target: str = "core",
) -> dict[str, Any]:
    """Push a single ERP order to Cin7."""
    if target not in ("core", "omni"):
        raise HTTPException(status_code=400, detail="target must be 'core' or 'omni'")

    async with get_cin7_client(settings) as client:
        syncer = Cin7SalesSyncer(db, client)
        log = await syncer.sync_order_to_cin7(order_id, target=target)

    await db.commit()

    return {
        "status": log.status,
        "order_id": order_id,
        "target": target,
        "sync_log_id": log.id,
        "error": log.error_message,
    }


# ------------------------------------------------------------------
# Quote endpoints
# ------------------------------------------------------------------


@router.post("/quotes")
async def sync_cin7_quotes(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    direction: Literal["cin7_to_erp", "erp_to_cin7"] = "cin7_to_erp",
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Trigger a full quote sync (Omni only)."""
    logger.info("cin7_quote_sync_triggered", direction=direction)

    async with get_cin7_client(settings) as client:
        syncer = Cin7SalesSyncer(db, client)

        if direction == "cin7_to_erp":
            log = await syncer.sync_quotes_from_cin7(page=page, limit=limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Bulk erp_to_cin7 quote sync not yet supported. Use the single-quote endpoint.",
            )

    await db.commit()

    return {
        "status": log.status,
        "direction": direction,
        "source": "omni",
        "records_processed": log.records_processed,
        "records_created": log.records_created,
        "records_updated": log.records_updated,
        "records_failed": log.records_failed,
        "sync_log_id": log.id,
    }


@router.post("/quotes/{quote_id}")
async def sync_cin7_quote_single(
    quote_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Push a single ERP quote to Cin7 Omni."""
    async with get_cin7_client(settings) as client:
        syncer = Cin7SalesSyncer(db, client)
        log = await syncer.sync_quote_to_cin7(quote_id)

    await db.commit()

    return {
        "status": log.status,
        "quote_id": quote_id,
        "target": "omni",
        "sync_log_id": log.id,
        "error": log.error_message,
    }
