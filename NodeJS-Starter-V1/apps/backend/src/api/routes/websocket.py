"""
WebSocket API endpoint for real-time updates.

Provides WebSocket connection at /ws/{client_id} for bidirectional real-time communication.
"""

import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel

from src.websockets.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class SubscriptionMessage(BaseModel):
    """Message format for channel subscriptions."""
    action: str  # "subscribe" or "unsubscribe"
    channel: str  # Channel name


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    token: str = Query(None, description="JWT authentication token (optional)")
):
    """
    WebSocket endpoint for real-time bidirectional communication.

    **Connection**: `ws://localhost:8000/ws/{client_id}?token=<jwt_token>`

    **Message Types**:

    Client → Server:
    ```json
    {
        "action": "subscribe",
        "channel": "orders"
    }
    ```

    Server → Client:
    ```json
    {
        "type": "order_update",
        "data": {...},
        "channel": "orders",
        "timestamp": "2026-01-14T12:00:00Z"
    }
    ```

    **Channels**:
    - `orders` - Order creation, updates, status changes
    - `inventory` - Stock level changes, adjustments
    - `backorders` - Backorder allocation, fulfillment
    - `containers` - Container tracking, ETA updates
    - `notifications` - System notifications, alerts
    - `agents` - AI agent task execution updates

    Args:
        websocket: FastAPI WebSocket connection
        client_id: Unique client identifier (e.g., user ID or session ID)
        token: Optional JWT token for authentication

    Example Usage:
    ```javascript
    const ws = new WebSocket('ws://localhost:8000/ws/user-123');

    ws.onopen = () => {
        // Subscribe to orders channel
        ws.send(JSON.stringify({
            action: 'subscribe',
            channel: 'orders'
        }));
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received:', message);
    };
    ```
    """
    # TODO: Validate JWT token if provided
    # For now, accept all connections

    await manager.connect(websocket, client_id)

    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_json()

            # Handle subscription actions
            if "action" in data:
                action = data.get("action")
                channel = data.get("channel")

                if not channel:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "message": "Channel name required for subscription actions"
                        },
                        websocket
                    )
                    continue

                if action == "subscribe":
                    await manager.subscribe_to_channel(client_id, channel)
                    await manager.send_personal_message(
                        {
                            "type": "subscription",
                            "status": "subscribed",
                            "channel": channel
                        },
                        websocket
                    )
                    logger.info(f"Client {client_id} subscribed to {channel}")

                elif action == "unsubscribe":
                    await manager.unsubscribe_from_channel(client_id, channel)
                    await manager.send_personal_message(
                        {
                            "type": "subscription",
                            "status": "unsubscribed",
                            "channel": channel
                        },
                        websocket
                    )
                    logger.info(f"Client {client_id} unsubscribed from {channel}")

                else:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "message": f"Unknown action: {action}"
                        },
                        websocket
                    )

            # Echo other messages back (for testing)
            else:
                await manager.send_personal_message(
                    {
                        "type": "echo",
                        "data": data
                    },
                    websocket
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(websocket, client_id)


@router.get("/ws/test")
async def test_broadcast(
    channel: str = Query(..., description="Channel to broadcast to"),
    message: str = Query(..., description="Test message")
):
    """
    Test endpoint to broadcast a message to a channel.

    Use this to test WebSocket functionality without triggering actual events.

    Example: `/ws/test?channel=orders&message=Test order update`
    """
    await manager.broadcast_to_channel(
        channel,
        {
            "type": "test",
            "message": message
        }
    )

    return {
        "status": "broadcasted",
        "channel": channel,
        "message": message
    }
