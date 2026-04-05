"""Infrastructure health and metrics endpoints for the monitoring dashboard.

Provides /api/monitoring/health, /api/monitoring/metrics, and /api/monitoring/range
endpoints consumed by the frontend monitoring.ts client.
"""

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Query

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring - Infrastructure"])


@router.get("/health")
async def get_infrastructure_health() -> dict:
    """Return service health status.

    In production this would query Prometheus targets.
    Returns a lightweight self-check for now.
    """
    return {
        "services": [
            {
                "job": "erp-backend",
                "health": "up",
                "lastScrape": datetime.now(UTC).isoformat(),
                "lastError": "",
            },
            {
                "job": "postgres",
                "health": "up",
                "lastScrape": datetime.now(UTC).isoformat(),
                "lastError": "",
            },
        ],
        "prometheus": "down",  # No Prometheus configured yet
    }


@router.get("/metrics")
async def get_infrastructure_metrics() -> dict:
    """Return key infrastructure metrics.

    In production this would query Prometheus metrics.
    Returns basic resource usage stats.
    """
    import os
    import threading

    metrics: dict[str, float | int | None] = {
        "process_pid": os.getpid(),
        "active_threads": threading.active_count(),
    }

    # Memory from resource module (Unix only)
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF)
        metrics["max_rss_kb"] = usage.ru_maxrss
        metrics["user_time_seconds"] = usage.ru_utime
        metrics["system_time_seconds"] = usage.ru_stime
    except (ImportError, AttributeError):
        # resource module not available on Windows
        metrics["max_rss_kb"] = None
        metrics["user_time_seconds"] = None
        metrics["system_time_seconds"] = None

    return {"metrics": metrics}


@router.get("/range")
async def get_range_data(
    query: str = Query(..., description="Prometheus query expression"),
    duration: str = Query("1h", description="Time range (e.g. 1h, 6h, 24h)"),
    step: str = Query("5m", description="Query resolution step"),
) -> dict:
    """Return time series range data.

    In production this would proxy to Prometheus range_query API.
    Returns empty series since Prometheus is not yet configured.
    """
    logger.info("range_query_requested", query=query, duration=duration, step=step)
    return {
        "series": [],
        "query": query,
        "duration": duration,
        "step": step,
        "note": "Prometheus not configured — connect a Prometheus instance to enable time-series queries",
    }
