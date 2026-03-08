"""Health check routes."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_engine, get_async_db

router = APIRouter()


@router.get("/health")
async def health_check(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, str | dict]:
    """
    Comprehensive health check endpoint.

    Checks:
    - API responsiveness
    - Database connectivity
    - Timestamp for debugging

    Returns:
        dict: Health status with component checks
    """
    checks = {
        "api": "healthy",
        "database": "unknown",
        "timestamp": datetime.now().isoformat(),
    }

    # Check database connectivity
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as db_error:
        checks["database"] = f"unhealthy: {str(db_error)}"
        checks["status"] = "degraded"
        return checks

    checks["status"] = "healthy"
    checks["version"] = "1.0.0"
    return checks


@router.get("/health/database")
async def database_health_check(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, str | int]:
    """
    Database-specific health check.

    Performs a simple query to verify database connectivity.

    Returns:
        dict: Database health status

    Raises:
        HTTPException: If database is unreachable
    """
    try:
        result = await db.execute(text("SELECT 1 as health_check"))
        row = result.fetchone()

        if row and row[0] == 1:
            return {
                "status": "healthy",
                "message": "Database connection successful",
                "timestamp": datetime.now().isoformat(),
            }
        else:
            raise HTTPException(
                status_code=503,
                detail="Database query returned unexpected result",
            )
    except Exception as db_error:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(db_error)}",
        )


@router.get("/health/routes")
async def routes_health_check() -> dict[str, str | int]:
    """
    Routes health check endpoint.

    Verifies that the API routing system is functioning.
    This endpoint itself being reachable indicates routes are working.

    Returns:
        dict: Routes health status
    """
    return {
        "status": "healthy",
        "message": "API routes are responding",
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/ready")
async def readiness_check(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, str]:
    """
    Readiness check endpoint for Kubernetes/container orchestration.

    Checks all critical dependencies before marking the service as ready
    to receive traffic.

    Returns:
        dict: Readiness status

    Raises:
        HTTPException: If any critical dependency is not ready
    """
    # Check database connectivity
    try:
        await db.execute(text("SELECT 1"))
    except Exception as db_error:
        raise HTTPException(
            status_code=503,
            detail=f"Database not ready: {str(db_error)}",
        )

    # All checks passed
    return {
        "status": "ready",
        "message": "All dependencies are ready",
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/health/pool")
async def connection_pool_health() -> dict:
    """
    Database connection pool health endpoint (CCW-PERF-003).

    Returns real-time pool metrics to support capacity planning and
    detect connection leaks before they cause outages.

    Returns:
        dict: Pool size, checked-out connections, overflow, and utilisation %
    """
    pool = async_engine.pool
    pool_size: int = pool.size()
    checked_out: int = pool.checkedout()
    overflow: int = pool.overflow()
    checkedin: int = pool.checkedin()
    total_capacity = pool_size + max(overflow, 0)
    utilisation_pct = round((checked_out / total_capacity) * 100, 1) if total_capacity else 0

    status = "healthy"
    if utilisation_pct >= 90:
        status = "critical"
    elif utilisation_pct >= 75:
        status = "warning"

    return {
        "status": status,
        "pool_size": pool_size,
        "checked_out": checked_out,
        "checked_in": checkedin,
        "overflow": overflow,
        "utilisation_pct": utilisation_pct,
        "timestamp": datetime.now().isoformat(),
    }
