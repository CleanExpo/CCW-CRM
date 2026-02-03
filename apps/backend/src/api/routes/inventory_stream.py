"""
PHASE 4: Real-Time Inventory Stream Endpoint

Provides Server-Sent Events stream for real-time inventory updates.
Prevents overselling by pushing stock changes instantly to all connected clients.

Usage:
    Frontend connects via EventSource:
    const eventSource = new EventSource('/api/inventory-stream');
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Update UI with new stock levels
    };
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.services.sse_service import sse_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api", tags=["Real-Time Inventory"])


@router.on_event("startup")
async def startup_sse_service():
    """Start SSE service on application startup."""
    await sse_service.start()
    logger.info("SSE service initialized for inventory streams")


@router.on_event("shutdown")
async def shutdown_sse_service():
    """Stop SSE service on application shutdown."""
    await sse_service.stop()
    logger.info("SSE service shutdown")


@router.get("/inventory-stream")
async def inventory_stream(
    request: Request,
    location: str | None = Query(None, description="Filter by location"),
):
    """
    Subscribe to real-time inventory updates via Server-Sent Events.

    PHASE 4 OPTIMIZATION: Instant inventory updates prevent overselling.

    Args:
        request: FastAPI request (used to detect disconnections)
        location: Optional location filter (brisbane, sydney, melbourne)

    Returns:
        SSE stream with inventory update events

    Event Format:
        {
            "product_id": "uuid",
            "location": "brisbane",
            "stock": 10,
            "reserved": 2,
            "available": 8,
            "change_type": "stock_update" | "reservation" | "transfer",
            "timestamp": 1234567890.123
        }

    Example Usage (Frontend):
        const eventSource = new EventSource('/api/inventory-stream?location=brisbane');

        eventSource.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            console.log('Inventory update:', data);
            // Update UI
        });

        eventSource.addEventListener('connected', (event) => {
            console.log('Connected to inventory stream');
        });

        eventSource.addEventListener('heartbeat', (event) => {
            console.log('Heartbeat received');
        });

        // Don't forget to close when component unmounts:
        eventSource.close();
    """
    # Determine channel based on location filter
    channel = f"inventory-{location}" if location else "inventory-all"

    logger.info(f"Client subscribing to inventory stream: {channel}")

    return await sse_service.subscribe(
        request,
        channel,
        heartbeat_interval=15,  # Send heartbeat every 15 seconds
    )


@router.get("/inventory-stream/stats")
async def get_stream_stats():
    """
    Get SSE connection statistics.

    Useful for monitoring and debugging.
    """
    return sse_service.get_stats()


# ============================================================================
# Helper Functions for Publishing Events
# ============================================================================


async def publish_inventory_update(
    product_id: str,
    location: str,
    stock: int,
    reserved: int,
    available: int,
    change_type: str = "stock_update",
):
    """
    Publish inventory update to all subscribed clients.

    Call this function whenever inventory changes:
    - After order creation (stock reserved)
    - After order fulfillment (stock depleted)
    - After stock adjustment
    - After stock transfer

    Args:
        product_id: Product UUID
        location: Warehouse location
        stock: Total stock quantity
        reserved: Reserved quantity
        available: Available quantity (stock - reserved)
        change_type: Type of change (stock_update, reservation, transfer, adjustment)
    """
    event_data = {
        "product_id": product_id,
        "location": location,
        "stock": stock,
        "reserved": reserved,
        "available": available,
        "change_type": change_type,
    }

    # Publish to both location-specific and global channels
    await sse_service.publish(f"inventory-{location}", event_data)
    await sse_service.publish("inventory-all", event_data)

    logger.info(
        f"Published inventory update: {product_id} @ {location} - "
        f"stock={stock}, available={available}, type={change_type}"
    )


async def publish_low_stock_alert(
    product_id: str,
    product_name: str,
    location: str,
    stock: int,
    reorder_point: int,
):
    """
    Publish low stock alert.

    Triggered when stock falls below reorder point.
    """
    event_data = {
        "product_id": product_id,
        "product_name": product_name,
        "location": location,
        "stock": stock,
        "reorder_point": reorder_point,
        "alert_type": "low_stock",
    }

    await sse_service.publish("inventory-alerts", event_data)
    logger.warning(
        f"Low stock alert: {product_name} @ {location} - stock={stock}, reorder={reorder_point}"
    )


# ============================================================================
# Integration Example
# ============================================================================

"""
To integrate real-time updates into existing endpoints:

# In orders.py - after creating order:

from src.api.routes.inventory_stream import publish_inventory_update

@router.post("/orders")
async def create_order(...):
    # ... create order logic ...

    # After stock reservation:
    for item in order.items:
        stock_record = await get_product_stock(item.product_id, location)

        await publish_inventory_update(
            product_id=str(item.product_id),
            location=location,
            stock=stock_record.stock,
            reserved=stock_record.reserved,
            available=stock_record.available,
            change_type="reservation",
        )

    # Check for low stock
    if stock_record.stock <= stock_record.reorder_point:
        await publish_low_stock_alert(
            product_id=str(item.product_id),
            product_name=item.product.name,
            location=location,
            stock=stock_record.stock,
            reorder_point=stock_record.reorder_point,
        )

    return order
"""
