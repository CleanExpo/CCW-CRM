"""API performance metrics endpoints."""

import structlog
from fastapi import APIRouter, HTTPException, Query

from src.api.middleware.performance import get_performance_metrics

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/monitoring/performance", tags=["Monitoring - Performance"])


@router.get("")
async def get_performance_stats() -> dict:
    """
    Get overall API performance statistics.

    Returns:
        Overall performance metrics
    """
    try:
        metrics = get_performance_metrics()
        stats = metrics.get_overall_stats()

        logger.info("Performance stats retrieved")

        return stats

    except Exception as e:
        logger.error("Failed to get performance stats", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get performance stats: {str(e)}"
        ) from e


@router.get("/endpoints")
async def get_all_endpoint_stats(
    limit: int = Query(100, ge=1, le=500, description="Maximum number of endpoints to return"),
) -> dict:
    """
    Get statistics for all tracked endpoints.

    Args:
        limit: Maximum number of endpoints to return

    Returns:
        List of endpoint statistics
    """
    try:
        metrics = get_performance_metrics()
        endpoints = metrics.get_all_endpoints()[:limit]

        logger.info("Endpoint stats retrieved", count=len(endpoints))

        return {
            "endpoints": endpoints,
            "total": len(endpoints),
        }

    except Exception as e:
        logger.error("Failed to get endpoint stats", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get endpoint stats: {str(e)}"
        ) from e


@router.get("/slowest")
async def get_slowest_endpoints(
    limit: int = Query(10, ge=1, le=50, description="Number of endpoints to return"),
) -> dict:
    """
    Get the slowest endpoints by p95 response time.

    Args:
        limit: Number of endpoints to return

    Returns:
        List of slowest endpoints
    """
    try:
        metrics = get_performance_metrics()
        slowest = metrics.get_slowest_endpoints(limit=limit)

        logger.info("Slowest endpoints retrieved", count=len(slowest))

        return {
            "endpoints": slowest,
            "total": len(slowest),
        }

    except Exception as e:
        logger.error("Failed to get slowest endpoints", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get slowest endpoints: {str(e)}"
        ) from e


@router.get("/errors")
async def get_error_endpoints(
    min_error_rate: float = Query(
        1.0, ge=0.1, le=100.0, description="Minimum error rate percentage"
    ),
) -> dict:
    """
    Get endpoints with error rates above threshold.

    Args:
        min_error_rate: Minimum error rate percentage to include

    Returns:
        List of endpoints with high error rates
    """
    try:
        metrics = get_performance_metrics()
        error_endpoints = metrics.get_error_endpoints(min_error_rate=min_error_rate)

        logger.info("Error endpoints retrieved", count=len(error_endpoints))

        return {
            "endpoints": error_endpoints,
            "total": len(error_endpoints),
            "min_error_rate": min_error_rate,
        }

    except Exception as e:
        logger.error("Failed to get error endpoints", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get error endpoints: {str(e)}"
        ) from e


@router.get("/endpoint")
async def get_endpoint_stats(
    method: str = Query(..., description="HTTP method (GET, POST, etc.)"),
    path: str = Query(..., description="Endpoint path"),
) -> dict:
    """
    Get statistics for a specific endpoint.

    Args:
        method: HTTP method
        path: Request path

    Returns:
        Endpoint statistics
    """
    try:
        metrics = get_performance_metrics()
        stats = metrics.get_endpoint_stats(method, path)

        logger.info("Endpoint stats retrieved", method=method, path=path)

        return stats

    except Exception as e:
        logger.error("Failed to get endpoint stats", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Failed to get endpoint stats: {str(e)}"
        ) from e
