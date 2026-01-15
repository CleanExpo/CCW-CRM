"""
WebSocket event broadcasting utilities.

Helper functions to send real-time updates when entities change.
Use these in your API routes to notify connected clients.
"""

import logging
from typing import Any, Dict
from datetime import datetime

from src.websockets.manager import manager

logger = logging.getLogger(__name__)


async def broadcast_order_update(order_id: str, action: str, data: Dict[str, Any]):
    """
    Broadcast an order update to all clients subscribed to the 'orders' channel.

    Args:
        order_id: Order ID
        action: Action type (created, updated, status_changed, deleted)
        data: Order data

    Example:
        await broadcast_order_update(
            order_id="123",
            action="status_changed",
            data={"id": "123", "status": "shipped", "order_number": "ORD-2026-001"}
        )
    """
    await manager.broadcast_to_channel(
        "orders",
        {
            "type": "order_update",
            "action": action,
            "order_id": order_id,
            "data": data,
        }
    )
    logger.info(f"Broadcasted order {action}: {order_id}")


async def broadcast_inventory_update(product_id: str, warehouse: str, data: Dict[str, Any]):
    """
    Broadcast an inventory level change to the 'inventory' channel.

    Args:
        product_id: Product ID
        warehouse: Warehouse code
        data: Inventory data including available quantity

    Example:
        await broadcast_inventory_update(
            product_id="PROD-001",
            warehouse="sydney",
            data={"product_id": "PROD-001", "warehouse": "sydney", "available": 45}
        )
    """
    await manager.broadcast_to_channel(
        "inventory",
        {
            "type": "inventory_update",
            "product_id": product_id,
            "warehouse": warehouse,
            "data": data,
        }
    )
    logger.debug(f"Broadcasted inventory update: {product_id} @ {warehouse}")


async def broadcast_backorder_update(backorder_id: str, action: str, data: Dict[str, Any]):
    """
    Broadcast a backorder update to the 'backorders' channel.

    Args:
        backorder_id: Backorder ID
        action: Action type (created, allocated, fulfilled, cancelled)
        data: Backorder data

    Example:
        await broadcast_backorder_update(
            backorder_id="BO-001",
            action="allocated",
            data={"id": "BO-001", "quantity_allocated": 10}
        )
    """
    await manager.broadcast_to_channel(
        "backorders",
        {
            "type": "backorder_update",
            "action": action,
            "backorder_id": backorder_id,
            "data": data,
        }
    )
    logger.info(f"Broadcasted backorder {action}: {backorder_id}")


async def broadcast_container_update(container_id: str, action: str, data: Dict[str, Any]):
    """
    Broadcast a container tracking update to the 'containers' channel.

    Args:
        container_id: Container ID
        action: Action type (created, eta_updated, status_changed, arrived)
        data: Container data

    Example:
        await broadcast_container_update(
            container_id="CONT-001",
            action="eta_updated",
            data={"id": "CONT-001", "estimated_arrival_date": "2026-02-01", "days_until_arrival": 7}
        )
    """
    await manager.broadcast_to_channel(
        "containers",
        {
            "type": "container_update",
            "action": action,
            "container_id": container_id,
            "data": data,
        }
    )
    logger.info(f"Broadcasted container {action}: {container_id}")


async def broadcast_notification(
    title: str,
    message: str,
    severity: str = "info",
    action_url: str | None = None
):
    """
    Broadcast a system notification to all connected clients.

    Args:
        title: Notification title
        message: Notification message
        severity: Notification severity (info, success, warning, error)
        action_url: Optional URL for notification action

    Example:
        await broadcast_notification(
            title="Low Stock Alert",
            message="Product XYZ-123 is below reorder point",
            severity="warning",
            action_url="/inventory/products/XYZ-123"
        )
    """
    await manager.broadcast_to_all(
        {
            "type": "notification",
            "title": title,
            "message": message,
            "severity": severity,
            "action_url": action_url,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
    logger.info(f"Broadcasted notification: {title}")


async def broadcast_agent_update(agent_name: str, status: str, data: Dict[str, Any]):
    """
    Broadcast an AI agent execution update to the 'agents' channel.

    Args:
        agent_name: Agent identifier
        status: Agent status (started, running, completed, failed)
        data: Agent execution data

    Example:
        await broadcast_agent_update(
            agent_name="inventory_agent",
            status="completed",
            data={"task": "check_low_stock", "items_found": 12}
        )
    """
    await manager.broadcast_to_channel(
        "agents",
        {
            "type": "agent_update",
            "agent_name": agent_name,
            "status": status,
            "data": data,
        }
    )
    logger.info(f"Broadcasted agent update: {agent_name} - {status}")


# Convenience function for generic entity updates
async def broadcast_entity_update(
    channel: str,
    entity_type: str,
    entity_id: str,
    action: str,
    data: Dict[str, Any]
):
    """
    Generic entity update broadcaster.

    Args:
        channel: Channel to broadcast to
        entity_type: Type of entity (e.g., "product", "customer", "quote")
        entity_id: Entity ID
        action: Action performed
        data: Entity data

    Example:
        await broadcast_entity_update(
            channel="products",
            entity_type="product",
            entity_id="PROD-001",
            action="price_changed",
            data={"id": "PROD-001", "price": 299.99}
        )
    """
    await manager.broadcast_to_channel(
        channel,
        {
            "type": f"{entity_type}_update",
            "action": action,
            f"{entity_type}_id": entity_id,
            "data": data,
        }
    )
    logger.debug(f"Broadcasted {entity_type} {action}: {entity_id}")
