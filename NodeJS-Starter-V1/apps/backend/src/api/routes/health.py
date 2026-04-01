"""Health check routes with comprehensive dependency checks.

Provides multiple health check endpoints for Kubernetes and monitoring:
- /health - Basic liveness probe (is the app running?)
- /ready - Readiness probe (can the app serve traffic?)
- /health/detailed - Detailed health status of all dependencies
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db

logger = structlog.get_logger(__name__)

router = APIRouter()

# Application start time for uptime calculation
APP_START_TIME = datetime.now()

# Version - should be updated with each release
APP_VERSION = "1.0.0"


class HealthStatus(BaseModel):
    """Health status response model."""

    status: str  # healthy, degraded, unhealthy
    timestamp: str
    version: str
    uptime_seconds: float


class DependencyHealth(BaseModel):
    """Individual dependency health status."""

    name: str
    status: str  # healthy, degraded, unhealthy
    response_time_ms: float
    message: str | None = None
    details: dict[str, Any] | None = None


class DetailedHealthStatus(BaseModel):
    """Detailed health status with all dependencies."""

    status: str
    timestamp: str
    version: str
    uptime_seconds: float
    dependencies: list[DependencyHealth]


async def check_database_health(db: AsyncSession) -> DependencyHealth:
    """Check database connectivity and responsiveness."""
    start_time = datetime.now()
    try:
        # Simple query to check connectivity
        result = await db.execute(text("SELECT 1"))
        result.scalar_one()

        # Check connection pool status
        pool_size = db.get_bind().pool.size()
        checked_out = db.get_bind().pool.checkedout()

        response_time = (datetime.now() - start_time).total_seconds() * 1000

        return DependencyHealth(
            name="database",
            status="healthy",
            response_time_ms=round(response_time, 2),
            details={
                "pool_size": pool_size,
                "checked_out": checked_out,
                "available": pool_size - checked_out,
            },
        )
    except Exception as e:
        response_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error("Database health check failed", error=str(e))
        return DependencyHealth(
            name="database",
            status="unhealthy",
            response_time_ms=round(response_time, 2),
            message=str(e),
        )


async def check_redis_health() -> DependencyHealth:
    """Check Redis connectivity and responsiveness."""
    start_time = datetime.now()
    try:
        # Import Redis client
        from src.core.redis_client import get_redis_client

        redis = get_redis_client()
        await redis.ping()

        # Get Redis info
        info = await redis.info()
        memory_used = info.get("used_memory_human", "unknown")

        response_time = (datetime.now() - start_time).total_seconds() * 1000

        return DependencyHealth(
            name="redis",
            status="healthy",
            response_time_ms=round(response_time, 2),
            details={
                "memory_used": memory_used,
                "connected_clients": info.get("connected_clients", 0),
            },
        )
    except Exception as e:
        response_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.error("Redis health check failed", error=str(e))
        return DependencyHealth(
            name="redis",
            status="unhealthy",
            response_time_ms=round(response_time, 2),
            message=str(e),
        )


async def check_celery_health() -> DependencyHealth:
    """Check Celery worker availability."""
    start_time = datetime.now()
    try:
        from src.core.celery_app import app as celery_app

        # Check if any workers are active
        inspect = celery_app.control.inspect()
        stats = inspect.stats()

        if not stats:
            raise Exception("No active Celery workers found")

        worker_count = len(stats)
        response_time = (datetime.now() - start_time).total_seconds() * 1000

        return DependencyHealth(
            name="celery",
            status="healthy",
            response_time_ms=round(response_time, 2),
            details={"active_workers": worker_count},
        )
    except Exception as e:
        response_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.warning("Celery health check failed", error=str(e))
        # Degraded instead of unhealthy - app can still function without Celery
        return DependencyHealth(
            name="celery",
            status="degraded",
            response_time_ms=round(response_time, 2),
            message=str(e),
        )


async def check_websocket_health() -> DependencyHealth:
    """Check WebSocket service availability."""
    start_time = datetime.now()
    try:
        from src.core.websocket import websocket_manager

        active_connections = len(websocket_manager.active_connections)
        response_time = (datetime.now() - start_time).total_seconds() * 1000

        return DependencyHealth(
            name="websocket",
            status="healthy",
            response_time_ms=round(response_time, 2),
            details={"active_connections": active_connections},
        )
    except Exception as e:
        response_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.warning("WebSocket health check failed", error=str(e))
        return DependencyHealth(
            name="websocket",
            status="degraded",
            response_time_ms=round(response_time, 2),
            message=str(e),
        )


def calculate_overall_status(dependencies: list[DependencyHealth]) -> str:
    """Calculate overall health status based on dependencies.

    Args:
        dependencies: List of dependency health checks

    Returns:
        str: Overall status - healthy, degraded, or unhealthy
    """
    statuses = [dep.status for dep in dependencies]

    # If any critical dependency is unhealthy, overall is unhealthy
    critical_deps = ["database", "redis"]
    for dep in dependencies:
        if dep.name in critical_deps and dep.status == "unhealthy":
            return "unhealthy"

    # If any dependency is unhealthy or degraded, overall is degraded
    if "unhealthy" in statuses or "degraded" in statuses:
        return "degraded"

    return "healthy"


@router.get("/health", response_model=HealthStatus, tags=["Health"])
async def health_check() -> HealthStatus:
    """Basic liveness probe.

    Returns HTTP 200 if the application is running.
    This endpoint should be fast (<100ms) and not check external dependencies.
    Used by Kubernetes liveness probe.

    Returns:
        HealthStatus: Basic health information
    """
    uptime = (datetime.now() - APP_START_TIME).total_seconds()

    return HealthStatus(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        version=APP_VERSION,
        uptime_seconds=round(uptime, 2),
    )


@router.get("/ready", response_model=HealthStatus, tags=["Health"])
async def readiness_check(db: AsyncSession = Depends(get_db)) -> HealthStatus:
    """Readiness probe with basic dependency checks.

    Returns HTTP 200 if the application is ready to serve traffic.
    Checks critical dependencies (database).
    Used by Kubernetes readiness probe.

    Args:
        db: Database session

    Returns:
        HealthStatus: Readiness status

    Raises:
        HTTPException: If dependencies are not ready
    """
    try:
        # Quick database check
        await db.execute(text("SELECT 1"))
        uptime = (datetime.now() - APP_START_TIME).total_seconds()

        return HealthStatus(
            status="ready",
            timestamp=datetime.now().isoformat(),
            version=APP_VERSION,
            uptime_seconds=round(uptime, 2),
        )
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready",
        )


@router.get(
    "/health/detailed",
    response_model=DetailedHealthStatus,
    tags=["Health"],
)
async def detailed_health_check(
    db: AsyncSession = Depends(get_db),
) -> DetailedHealthStatus:
    """Detailed health check with all dependencies.

    Checks all application dependencies and returns detailed status.
    This endpoint may be slower and should not be used for liveness/readiness probes.
    Useful for monitoring dashboards and alerting.

    Args:
        db: Database session

    Returns:
        DetailedHealthStatus: Detailed health information for all dependencies
    """
    # Run all health checks in parallel
    checks = await asyncio.gather(
        check_database_health(db),
        check_redis_health(),
        check_celery_health(),
        check_websocket_health(),
        return_exceptions=True,
    )

    # Filter out exceptions and convert to DependencyHealth
    dependencies = []
    for check in checks:
        if isinstance(check, Exception):
            logger.error("Health check raised exception", error=str(check))
            dependencies.append(
                DependencyHealth(
                    name="unknown",
                    status="unhealthy",
                    response_time_ms=0.0,
                    message=str(check),
                )
            )
        else:
            dependencies.append(check)

    overall_status = calculate_overall_status(dependencies)
    uptime = (datetime.now() - APP_START_TIME).total_seconds()

    return DetailedHealthStatus(
        status=overall_status,
        timestamp=datetime.now().isoformat(),
        version=APP_VERSION,
        uptime_seconds=round(uptime, 2),
        dependencies=dependencies,
    )


@router.get("/health/live", tags=["Health"])
async def liveness_probe() -> dict[str, str]:
    """Kubernetes liveness probe (simple version).

    Ultra-fast liveness check that just returns 200 OK.
    No dependency checks.

    Returns:
        dict: Status OK
    """
    return {"status": "ok"}


@router.get("/health/startup", tags=["Health"])
async def startup_probe(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Kubernetes startup probe.

    Used during application startup to check if the app is ready.
    Fails fast if critical dependencies are not available.

    Args:
        db: Database session

    Returns:
        dict: Status OK if startup is complete

    Raises:
        HTTPException: If startup dependencies are not ready
    """
    try:
        # Check database connectivity
        await db.execute(text("SELECT 1"))

        # Check Redis connectivity
        from src.core.redis_client import get_redis_client

        redis = get_redis_client()
        await redis.ping()

        return {"status": "ok"}
    except Exception as e:
        logger.error("Startup check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Startup dependencies not ready",
        )
