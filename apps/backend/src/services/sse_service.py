"""
PHASE 4: Server-Sent Events (SSE) Service

Provides real-time updates to frontend clients via SSE.
Prevents overselling by pushing inventory changes instantly.

Architecture:
- In-memory event queue (production should use Redis Pub/Sub)
- Automatic cleanup of stale connections
- Support for multiple event channels

Usage:
    from src.services.sse_service import sse_service

    # Publish event
    await sse_service.publish("inventory-updates", {
        "product_id": "...",
        "location": "brisbane",
        "stock": 10,
    })

    # Subscribe in endpoint
    @router.get("/stream")
    async def stream(request: Request):
        return await sse_service.subscribe(request, "inventory-updates")
"""

import asyncio
import json
import time
from collections import defaultdict
from typing import Any, AsyncGenerator
from uuid import uuid4

import structlog
from fastapi import Request
from sse_starlette.sse import EventSourceResponse

logger = structlog.get_logger(__name__)


class SSEService:
    """Server-Sent Events service for real-time updates."""

    def __init__(self):
        """Initialize SSE service with in-memory event queues."""
        # Channel name -> list of (queue, client_id, created_at)
        self.channels: dict[str, list[tuple[asyncio.Queue, str, float]]] = defaultdict(list)

        # Track connection stats
        self.stats = {
            "total_connections": 0,
            "active_connections": 0,
            "events_published": 0,
        }

        # Start cleanup task
        self._cleanup_task = None

    async def start(self):
        """Start background cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_stale_connections())
            logger.info("SSE service started")

    async def stop(self):
        """Stop background tasks."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            logger.info("SSE service stopped")

    async def publish(self, channel: str, data: dict[str, Any]):
        """
        Publish event to all subscribers on a channel.

        Args:
            channel: Channel name (e.g., "inventory-updates")
            data: Event data (will be JSON serialized)
        """
        if channel not in self.channels or not self.channels[channel]:
            logger.debug(f"No subscribers for channel: {channel}")
            return

        event = {
            "timestamp": time.time(),
            "data": data,
        }

        # Send to all subscribers on this channel
        dead_queues = []
        for queue, client_id, created_at in self.channels[channel]:
            try:
                # Non-blocking put
                queue.put_nowait(event)
                logger.debug(f"Published to {channel}/{client_id}")
            except asyncio.QueueFull:
                logger.warning(f"Queue full for {channel}/{client_id}, marking for removal")
                dead_queues.append((queue, client_id, created_at))
            except Exception as e:
                logger.error(f"Failed to publish to {channel}/{client_id}: {e}")
                dead_queues.append((queue, client_id, created_at))

        # Remove dead queues
        for dead_queue in dead_queues:
            self.channels[channel].remove(dead_queue)

        self.stats["events_published"] += 1

    async def subscribe(
        self,
        request: Request,
        channel: str,
        *,
        heartbeat_interval: int = 15,
    ) -> EventSourceResponse:
        """
        Subscribe to SSE channel.

        Args:
            request: FastAPI request object
            channel: Channel name to subscribe to
            heartbeat_interval: Seconds between heartbeat pings

        Returns:
            EventSourceResponse for SSE streaming
        """
        client_id = str(uuid4())
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        created_at = time.time()

        logger.info(f"New SSE connection: {channel}/{client_id}")

        # Add to channel subscribers
        self.channels[channel].append((queue, client_id, created_at))
        self.stats["total_connections"] += 1
        self.stats["active_connections"] += 1

        async def event_generator() -> AsyncGenerator[dict[str, Any], None]:
            """Generate SSE events for this client."""
            try:
                # Send initial connection event
                yield {
                    "event": "connected",
                    "data": json.dumps({
                        "client_id": client_id,
                        "channel": channel,
                        "timestamp": time.time(),
                    }),
                }

                last_heartbeat = time.time()

                while True:
                    # Check if client disconnected
                    if await request.is_disconnected():
                        logger.info(f"Client disconnected: {channel}/{client_id}")
                        break

                    # Send heartbeat if needed
                    if time.time() - last_heartbeat > heartbeat_interval:
                        yield {
                            "event": "heartbeat",
                            "data": json.dumps({"timestamp": time.time()}),
                        }
                        last_heartbeat = time.time()

                    # Wait for event with timeout
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=1.0)

                        yield {
                            "event": "message",
                            "data": json.dumps(event["data"]),
                        }
                    except asyncio.TimeoutError:
                        # No event, continue loop for heartbeat/disconnect check
                        continue

            except asyncio.CancelledError:
                logger.info(f"SSE stream cancelled: {channel}/{client_id}")
            except Exception as e:
                logger.error(f"SSE stream error: {channel}/{client_id}: {e}")
            finally:
                # Cleanup: remove from subscribers
                try:
                    self.channels[channel].remove((queue, client_id, created_at))
                    self.stats["active_connections"] -= 1
                    logger.info(f"Cleaned up SSE connection: {channel}/{client_id}")
                except ValueError:
                    pass  # Already removed

        return EventSourceResponse(event_generator())

    async def _cleanup_stale_connections(self):
        """Background task to clean up stale connections (>5 minutes old)."""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute

                now = time.time()
                stale_threshold = 300  # 5 minutes

                for channel, subscribers in list(self.channels.items()):
                    stale = [
                        (queue, client_id, created_at)
                        for queue, client_id, created_at in subscribers
                        if now - created_at > stale_threshold
                    ]

                    for stale_conn in stale:
                        try:
                            subscribers.remove(stale_conn)
                            self.stats["active_connections"] -= 1
                            logger.info(
                                f"Cleaned up stale connection: {channel}/{stale_conn[1]}"
                            )
                        except ValueError:
                            pass

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup task error: {e}")

    def get_stats(self) -> dict[str, Any]:
        """Get connection statistics."""
        return {
            **self.stats,
            "channels": {
                channel: len(subscribers)
                for channel, subscribers in self.channels.items()
            },
        }


# Global SSE service instance
sse_service = SSEService()
