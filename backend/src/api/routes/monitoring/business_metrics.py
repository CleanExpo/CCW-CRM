"""Business metrics API endpoints for monitoring."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.services.business_metrics_service import get_business_metrics_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/monitoring/business", tags=["Monitoring - Business Metrics"])


@router.get("/pos")
async def get_pos_metrics(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get POS transaction metrics.

    Returns:
        POS metrics including volume, failures, average transaction value
    """
    try:
        service = get_business_metrics_service()
        metrics = await service.get_pos_metrics(db)

        logger.info("POS metrics retrieved")

        return metrics

    except Exception as e:
        logger.error("Failed to get POS metrics", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get POS metrics: {str(e)}") from e


@router.get("/reconciliation")
async def get_reconciliation_metrics(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get bank reconciliation metrics.

    Returns:
        Reconciliation metrics including success rate, unreconciled count
    """
    try:
        service = get_business_metrics_service()
        metrics = await service.get_reconciliation_metrics(db)

        logger.info("Reconciliation metrics retrieved")

        return metrics

    except Exception as e:
        logger.error("Failed to get reconciliation metrics", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get reconciliation metrics: {str(e)}"
        ) from e


@router.get("/orders")
async def get_order_metrics(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get order metrics.

    Returns:
        Order metrics including count by status, throughput, average value
    """
    try:
        service = get_business_metrics_service()
        metrics = await service.get_order_metrics(db)

        logger.info("Order metrics retrieved")

        return metrics

    except Exception as e:
        logger.error("Failed to get order metrics", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get order metrics: {str(e)}") from e


@router.get("/summary")
async def get_all_business_metrics(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """
    Get all business metrics in one call.

    Returns:
        Combined metrics for POS, reconciliation, and orders
    """
    try:
        service = get_business_metrics_service()
        metrics = await service.get_all_business_metrics(db)

        logger.info("All business metrics retrieved")

        return metrics

    except Exception as e:
        logger.error("Failed to get business metrics", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get business metrics: {str(e)}"
        ) from e
