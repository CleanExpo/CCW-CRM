"""Cin7 real-time SSE stream and polling endpoints.

Provides Server-Sent Events stream for real-time Cin7 sync events,
plus manual polling trigger and status endpoints. Follows the pattern
established by ``dashboard_stream.py``.

Frontend usage::

    const es = new EventSource('/api/integrations/cin7/stream');
    es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Cin7 event:', data);
    };
"""

import time
from datetime import UTC, datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Request

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.integrations.cin7.client import get_cin7_client
from src.integrations.cin7.event_dispatcher import CIN7_SSE_CHANNEL
from src.services.sse_service import sse_service

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/integrations/cin7",
    tags=["Cin7 Real-Time"],
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def publish_cin7_event(event_type: str, data: dict[str, Any]) -> None:
    """Publish a Cin7 event to the cin7-sync SSE channel.

    Convenience wrapper used by other modules to push events to
    connected SSE clients.
    """
    payload = {
        "event_type": event_type,
        **data,
        "timestamp": data.get("timestamp", datetime.now(UTC).isoformat()),
    }
    await sse_service.publish(CIN7_SSE_CHANNEL, payload)


# ---------------------------------------------------------------------------
# SSE endpoints
# ---------------------------------------------------------------------------


@router.get("/stream")
async def cin7_sync_stream(request: Request):
    """Subscribe to real-time Cin7 sync events via Server-Sent Events.

    Channel: ``cin7-sync``

    Events include:
    - cin7.product.changed
    - cin7.customer.changed
    - cin7.sales.changed
    - cin7.inventory.changed
    - cin7.sync.completed / cin7.sync.failed
    - cin7.poll.completed
    """
    logger.info("cin7_sse_client_subscribing", channel=CIN7_SSE_CHANNEL)
    return await sse_service.subscribe(
        request,
        CIN7_SSE_CHANNEL,
        heartbeat_interval=15,
    )


@router.get("/stream/stats")
async def get_cin7_stream_stats() -> dict[str, Any]:
    """Get SSE connection statistics for the cin7-sync channel."""
    stats = sse_service.get_stats()
    channel_stats = stats.get("channels", {}).get(CIN7_SSE_CHANNEL, {})
    return {
        "channel": CIN7_SSE_CHANNEL,
        "active_connections": channel_stats.get("subscribers", 0),
        "total_events_sent": channel_stats.get("events_sent", 0),
        "checked_at": datetime.now(UTC).isoformat(),
    }


@router.post("/stream/test")
async def publish_test_cin7_event(
    event_type: str = "cin7.product.changed",
    source: str = "core",
) -> dict[str, Any]:
    """Manually inject a test event into the cin7-sync SSE channel.

    Useful for testing frontend SSE subscriptions without real data.
    """
    test_data = {
        "entity_type": "test",
        "entity_id": "test-001",
        "action": "test",
        "source": source,
        "test": True,
    }
    await publish_cin7_event(event_type, test_data)

    logger.info("cin7_test_event_published", event_type=event_type)
    return {
        "status": "published",
        "event_type": event_type,
        "channel": CIN7_SSE_CHANNEL,
    }


# ---------------------------------------------------------------------------
# Polling endpoints
# ---------------------------------------------------------------------------


@router.post("/poll")
async def trigger_cin7_poll(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    source: str = "core",
) -> dict[str, Any]:
    """Trigger a manual Cin7 poll for all enabled entity types.

    Calls ``Cin7ChangeDetector.poll_all()`` and returns the results.
    This is useful for on-demand sync without waiting for the scheduler.
    """
    from src.integrations.cin7.change_detector import Cin7ChangeDetector

    start = time.monotonic()

    async with get_cin7_client(settings) as client:
        detector = Cin7ChangeDetector(client, settings)
        results = await detector.poll_all(source)

    duration_ms = int((time.monotonic() - start) * 1000)
    results["duration_ms"] = duration_ms

    logger.info(
        "cin7_manual_poll_complete",
        source=source,
        total_changes=results.get("total_changes", 0),
        duration_ms=duration_ms,
    )
    return results


@router.get("/poll/status")
async def get_cin7_poll_status(
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
) -> dict[str, Any]:
    """Get polling configuration and health status.

    Returns polling intervals, enabled entity types, and whether
    polling is enabled.
    """
    return {
        "polling_enabled": settings.polling_enabled,
        "intervals": {
            "products": settings.poll_interval_products,
            "customers": settings.poll_interval_customers,
            "sales": settings.poll_interval_sales,
            "inventory": settings.poll_interval_inventory,
        },
        "sync_enabled": {
            "products": settings.sync_products,
            "customers": settings.sync_customers,
            "sales": settings.sync_sales,
            "inventory": settings.sync_inventory,
        },
        "mode": settings.mode,
        "checked_at": datetime.now(UTC).isoformat(),
    }
