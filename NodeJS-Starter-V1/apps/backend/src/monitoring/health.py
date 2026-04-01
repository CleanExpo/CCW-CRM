"""
Health Check Service.

Monitors health of all system components:
- Database connectivity
- Redis connectivity
- Integration APIs (CIN7, Shopify, StockTrim)
- Event bus
- Celery workers
"""

import asyncio
import logging
from datetime import datetime
from functools import lru_cache
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


class ComponentHealth:
    """Health status for a single component."""

    def __init__(
        self,
        name: str,
        status: str,
        response_time: float | None = None,
        message: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        self.name = name
        self.status = status  # healthy, degraded, unhealthy
        self.response_time = response_time
        self.message = message
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "name": self.name,
            "status": self.status,
        }
        if self.response_time is not None:
            result["response_time_ms"] = round(self.response_time * 1000, 2)
        if self.message:
            result["message"] = self.message
        if self.details:
            result["details"] = self.details
        return result


class HealthCheck:
    """
    System-wide health check service.

    Provides health status for all critical components.
    """

    def __init__(self) -> None:
        """Initialize health check service."""
        self.settings = get_settings()

    async def check_database(self, db: AsyncSession) -> ComponentHealth:
        """Check PostgreSQL database health."""
        start = asyncio.get_event_loop().time()
        try:
            # Simple query to test connection
            result = await db.execute(text("SELECT 1"))
            result.scalar()

            # Get connection pool stats (if available)
            pool_size = None
            if hasattr(db.bind, "pool"):
                pool = db.bind.pool
                pool_size = pool.size()

            response_time = asyncio.get_event_loop().time() - start

            return ComponentHealth(
                name="database",
                status="healthy",
                response_time=response_time,
                message="PostgreSQL connection successful",
                details={"pool_size": pool_size} if pool_size else {},
            )
        except Exception as e:
            response_time = asyncio.get_event_loop().time() - start
            logger.error(f"Database health check failed: {e}")
            return ComponentHealth(
                name="database",
                status="unhealthy",
                response_time=response_time,
                message=f"Database connection failed: {str(e)}",
            )

    async def check_redis(self) -> ComponentHealth:
        """Check Redis connectivity."""
        start = asyncio.get_event_loop().time()
        redis_client = None
        try:
            redis_client = await aioredis.from_url(
                self.settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            await redis_client.ping()

            # Get Redis info
            info = await redis_client.info()
            response_time = asyncio.get_event_loop().time() - start

            return ComponentHealth(
                name="redis",
                status="healthy",
                response_time=response_time,
                message="Redis connection successful",
                details={
                    "version": info.get("redis_version"),
                    "connected_clients": info.get("connected_clients"),
                    "used_memory_human": info.get("used_memory_human"),
                },
            )
        except Exception as e:
            response_time = asyncio.get_event_loop().time() - start
            logger.error(f"Redis health check failed: {e}")
            return ComponentHealth(
                name="redis",
                status="unhealthy",
                response_time=response_time,
                message=f"Redis connection failed: {str(e)}",
            )
        finally:
            if redis_client:
                await redis_client.aclose()

    async def check_cin7_integration(self) -> ComponentHealth:
        """Check CIN7 API connectivity."""
        # TODO: Implement once CIN7 client is created
        # try:
        #     from src.integrations.cin7.client import get_cin7_client
        #     cin7 = get_cin7_client()
        #     start = asyncio.get_event_loop().time()
        #     # Simple API call to test connectivity
        #     await cin7.get("/healthcheck")
        #     response_time = asyncio.get_event_loop().time() - start
        #     return ComponentHealth(
        #         name="cin7",
        #         status="healthy",
        #         response_time=response_time,
        #         message="CIN7 API accessible",
        #     )
        # except Exception as e:
        #     return ComponentHealth(
        #         name="cin7",
        #         status="unhealthy",
        #         message=f"CIN7 API error: {str(e)}",
        #     )

        # Placeholder for now
        return ComponentHealth(
            name="cin7",
            status="not_configured",
            message="CIN7 integration not yet configured",
        )

    async def check_shopify_integration(self) -> ComponentHealth:
        """Check Shopify API connectivity."""
        # TODO: Implement Shopify health check
        # try:
        #     from src.integrations.shopify.client import get_shopify_client
        #     shopify = get_shopify_client()
        #     start = asyncio.get_event_loop().time()
        #     # Test API access
        #     await shopify.get_shop()
        #     response_time = asyncio.get_event_loop().time() - start
        #     return ComponentHealth(
        #         name="shopify",
        #         status="healthy",
        #         response_time=response_time,
        #         message="Shopify API accessible",
        #     )
        # except Exception as e:
        #     return ComponentHealth(
        #         name="shopify",
        #         status="degraded",
        #         message=f"Shopify API error: {str(e)}",
        #     )

        # Placeholder for now
        return ComponentHealth(
            name="shopify",
            status="not_configured",
            message="Shopify integration not yet configured",
        )

    async def check_stocktrim_integration(self) -> ComponentHealth:
        """Check StockTrim API connectivity."""
        # TODO: Implement once StockTrim client is created
        # try:
        #     from src.integrations.stocktrim.client import get_stocktrim_client
        #     stocktrim = get_stocktrim_client()
        #     start = asyncio.get_event_loop().time()
        #     # Test API access
        #     await stocktrim.get("/ping")
        #     response_time = asyncio.get_event_loop().time() - start
        #     return ComponentHealth(
        #         name="stocktrim",
        #         status="healthy",
        #         response_time=response_time,
        #         message="StockTrim API accessible",
        #     )
        # except Exception as e:
        #     return ComponentHealth(
        #         name="stocktrim",
        #         status="unhealthy",
        #         message=f"StockTrim API error: {str(e)}",
        #     )

        # Placeholder for now
        return ComponentHealth(
            name="stocktrim",
            status="not_configured",
            message="StockTrim integration not yet configured",
        )

    async def check_event_bus(self) -> ComponentHealth:
        """Check event bus health."""
        try:
            from src.events.event_bus import get_event_bus

            event_bus = get_event_bus()
            start = asyncio.get_event_loop().time()

            # Check Redis connection used by event bus
            if event_bus.redis is None:
                await event_bus.connect()

            await event_bus.redis.ping()
            response_time = asyncio.get_event_loop().time() - start

            return ComponentHealth(
                name="event_bus",
                status="healthy",
                response_time=response_time,
                message="Event bus operational",
                details={
                    "is_running": event_bus.is_running,
                    "subscriptions": len(event_bus.handlers),
                },
            )
        except Exception as e:
            logger.error(f"Event bus health check failed: {e}")
            return ComponentHealth(
                name="event_bus",
                status="unhealthy",
                message=f"Event bus error: {str(e)}",
            )

    async def check_celery_workers(self) -> ComponentHealth:
        """Check Celery worker health."""
        # TODO: Implement Celery worker health check
        # try:
        #     from src.scheduler.celery_app import celery_app
        #     inspect = celery_app.control.inspect()
        #     active = inspect.active()
        #     stats = inspect.stats()
        #
        #     if not active:
        #         return ComponentHealth(
        #             name="celery",
        #             status="unhealthy",
        #             message="No active Celery workers",
        #         )
        #
        #     return ComponentHealth(
        #         name="celery",
        #         status="healthy",
        #         message=f"{len(active)} Celery workers active",
        #         details={"workers": list(active.keys())},
        #     )
        # except Exception as e:
        #     return ComponentHealth(
        #         name="celery",
        #         status="unhealthy",
        #         message=f"Celery error: {str(e)}",
        #     )

        # Placeholder for now
        return ComponentHealth(
            name="celery",
            status="not_configured",
            message="Celery workers not yet configured",
        )

    async def check_all(self, db: AsyncSession) -> dict[str, Any]:
        """
        Run all health checks.

        Returns:
            Health status summary with individual component statuses
        """
        start_time = datetime.utcnow()

        # Run all checks concurrently
        checks = await asyncio.gather(
            self.check_database(db),
            self.check_redis(),
            self.check_event_bus(),
            self.check_cin7_integration(),
            self.check_shopify_integration(),
            self.check_stocktrim_integration(),
            self.check_celery_workers(),
            return_exceptions=True,
        )

        # Process results
        components = []
        unhealthy_count = 0
        degraded_count = 0

        for check in checks:
            if isinstance(check, Exception):
                logger.error(f"Health check failed with exception: {check}")
                continue

            components.append(check.to_dict())

            if check.status == "unhealthy":
                unhealthy_count += 1
            elif check.status == "degraded":
                degraded_count += 1

        # Determine overall status
        if unhealthy_count > 0:
            overall_status = "unhealthy"
        elif degraded_count > 0:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        end_time = datetime.utcnow()
        total_duration = (end_time - start_time).total_seconds()

        return {
            "status": overall_status,
            "timestamp": start_time.isoformat(),
            "duration_ms": round(total_duration * 1000, 2),
            "components": components,
            "summary": {
                "total": len(components),
                "healthy": len([c for c in components if c["status"] == "healthy"]),
                "degraded": degraded_count,
                "unhealthy": unhealthy_count,
                "not_configured": len([c for c in components if c["status"] == "not_configured"]),
            },
        }


# Global health check instance
@lru_cache
def get_health_check() -> HealthCheck:
    """Get or create the global health check instance."""
    return HealthCheck()
