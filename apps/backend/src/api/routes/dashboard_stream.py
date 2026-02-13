"""
PHASE 4: Real-Time Dashboard Metrics Stream Endpoint

Provides Server-Sent Events stream for real-time dashboard metrics updates.
Eliminates polling by pushing metrics changes instantly to all connected clients.

Usage:
    Frontend connects via EventSource:
    const eventSource = new EventSource('/api/dashboard/metrics-stream');
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Update dashboard metrics in real-time
    };
"""


import structlog
from fastapi import APIRouter, Request

from src.services.sse_service import sse_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["Real-Time Dashboard"])


@router.get("/metrics-stream")
async def dashboard_metrics_stream(request: Request):
    """
    Subscribe to real-time dashboard metrics updates via Server-Sent Events.

    PHASE 4 OPTIMIZATION: Instant metrics updates eliminate polling overhead.

    Args:
        request: FastAPI request (used to detect disconnections)

    Returns:
        SSE stream with dashboard metrics update events

    Event Format:
        {
            "type": "metrics_updated",
            "metric": "active_orders" | "total_products" | "total_customers" | "low_stock_alerts" | "pending_quotes",
            "change": "increment" | "decrement" | "status_change" | "update",
            "timestamp": "2026-02-04T12:34:56Z"
        }

    Example Usage (Frontend):
        const eventSource = new EventSource('/api/dashboard/metrics-stream');

        eventSource.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            console.log('Metrics update:', data);

            // Update specific metric in UI
            if (data.metric === 'active_orders' && data.change === 'increment') {
                setActiveOrders(prev => prev + 1);
            }
        });

        eventSource.addEventListener('connected', (event) => {
            console.log('Connected to metrics stream');
        });

        // Don't forget to close when component unmounts:
        eventSource.close();
    """
    channel = "dashboard-metrics"

    logger.info(f"Client subscribing to dashboard metrics stream: {channel}")

    return await sse_service.subscribe(
        request,
        channel,
        heartbeat_interval=15,  # Send heartbeat every 15 seconds
    )


@router.get("/metrics-stream/stats")
async def get_metrics_stream_stats():
    """
    Get dashboard metrics stream connection statistics.

    Useful for monitoring and debugging.
    """
    return sse_service.get_stats()


# ============================================================================
# Helper Functions for Publishing Events
# ============================================================================


async def publish_dashboard_metric_update(
    metric: str,
    change: str,
):
    """
    Publish dashboard metric update to all subscribed clients.

    Call this function whenever metrics change:
    - After order creation/update (active_orders)
    - After product creation/deletion (total_products)
    - After customer creation (total_customers)
    - After stock falls below threshold (low_stock_alerts)
    - After quote creation/update (pending_quotes)

    Args:
        metric: Metric name (active_orders, total_products, etc.)
        change: Change type (increment, decrement, status_change, update)
    """
    import time

    event_data = {
        "type": "metrics_updated",
        "metric": metric,
        "change": change,
        "timestamp": time.time(),
    }

    await sse_service.publish("dashboard-metrics", event_data)

    logger.info(
        f"Published dashboard metric update: {metric} - {change}"
    )


# ============================================================================
# Integration Example
# ============================================================================

"""
To integrate real-time updates into existing endpoints:

# In orders.py - after creating/updating order:

from src.api.routes.dashboard_stream import publish_dashboard_metric_update

@router.post("/orders")
async def create_order(...):
    # ... create order logic ...

    # Publish metric update
    await publish_dashboard_metric_update(
        metric="active_orders",
        change="increment"
    )

    return order

@router.put("/orders/{order_id}")
async def update_order(...):
    # ... update order logic ...

    # If status changed from draft to confirmed
    if old_status == "draft" and new_status == "confirmed":
        await publish_dashboard_metric_update(
            metric="active_orders",
            change="status_change"
        )

    return order

# Similar pattern for products, customers, quotes
"""


@router.post("/test-event")
async def publish_test_event(
    metric: str = "active_orders",
    change: str = "increment",
):
    """
    Test endpoint to manually trigger SSE events.

    Usage:
    curl -X POST "http://localhost:8000/api/dashboard/test-event?metric=active_orders&change=increment"
    """
    await publish_dashboard_metric_update(metric=metric, change=change)

    # Also publish activity event
    await sse_service.publish("dashboard-activity", {
        "activity_type": "test_event",
        "title": "Test Event",
        "description": f"Test: {metric} - {change}",
        "link": "/dashboard",
        "timestamp": datetime.utcnow().isoformat(),
    })

    return {
        "success": True,
        "message": f"Published test event: {metric} - {change}",
        "channel": "dashboard-metrics"
    }
