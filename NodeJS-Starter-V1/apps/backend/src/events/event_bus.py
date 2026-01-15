"""
Event Bus System using Redis Pub/Sub.

Enables real-time communication between integrations and autonomous agents.
Follows the observer pattern with publish/subscribe semantics.
"""

import asyncio
import json
import logging
from collections.abc import Callable
from datetime import datetime
from functools import lru_cache
from typing import Any
from uuid import uuid4

try:
    import redis.asyncio as aioredis
    from redis.asyncio.client import PubSub
    REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    PubSub = None
    REDIS_AVAILABLE = False

from src.config.settings import get_settings

logger = logging.getLogger(__name__)


class EventBus:
    """
    Central event bus for real-time event distribution.

    Uses Redis Pub/Sub for scalable, distributed event handling.
    Supports multiple subscribers per event type and async handlers.

    Example:
        ```python
        event_bus = EventBus()
        await event_bus.connect()

        # Subscribe to events
        await event_bus.subscribe("order.created", handle_new_order)

        # Publish events
        await event_bus.publish("order.created", {"order_id": "123"}, source="shopify")

        # Start processing
        await event_bus.start()
        ```
    """

    def __init__(self) -> None:
        """Initialize event bus with Redis connection."""
        self.settings = get_settings()
        self.redis: aioredis.Redis | None = None
        self.pubsub: PubSub | None = None
        self.handlers: dict[str, list[Callable]] = {}
        self.is_running = False
        self._listen_task: asyncio.Task | None = None

    async def connect(self) -> None:
        """Establish Redis connection for event bus."""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, event bus running in local-only mode")
            return

        if self.redis is not None:
            logger.warning("Event bus already connected")
            return

        try:
            self.redis = await aioredis.from_url(
                self.settings.redis_url,
                max_connections=self.settings.redis_max_connections,
                encoding="utf-8",
                decode_responses=True,
            )
            await self.redis.ping()
            logger.info("Event bus connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect event bus to Redis: {e}")
            raise

    async def disconnect(self) -> None:
        """Close Redis connection and stop event processing."""
        self.is_running = False

        if self._listen_task and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass

        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()
            self.pubsub = None

        if self.redis:
            await self.redis.aclose()
            self.redis = None

        logger.info("Event bus disconnected")

    async def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        Subscribe to an event type with a handler function.

        Args:
            event_type: Event type to subscribe to (e.g., "order.created")
            handler: Async function to call when event occurs
                     Signature: async def handler(event: dict) -> None
        """
        if not asyncio.iscoroutinefunction(handler):
            raise TypeError(f"Handler for {event_type} must be an async function")

        if event_type not in self.handlers:
            self.handlers[event_type] = []
            # Subscribe to Redis channel
            if self.redis is not None:
                if self.pubsub is None:
                    self.pubsub = self.redis.pubsub()
                await self.pubsub.subscribe(event_type)
                logger.info(f"Subscribed to event type: {event_type}")

        self.handlers[event_type].append(handler)
        logger.debug(f"Added handler for {event_type}: {handler.__name__}")

    async def unsubscribe(self, event_type: str, handler: Callable | None = None) -> None:
        """
        Unsubscribe from an event type.

        Args:
            event_type: Event type to unsubscribe from
            handler: Specific handler to remove (if None, removes all handlers)
        """
        if event_type not in self.handlers:
            return

        if handler is None:
            # Remove all handlers
            self.handlers.pop(event_type)
            if self.pubsub:
                await self.pubsub.unsubscribe(event_type)
            logger.info(f"Unsubscribed from event type: {event_type}")
        else:
            # Remove specific handler
            if handler in self.handlers[event_type]:
                self.handlers[event_type].remove(handler)
                logger.debug(f"Removed handler for {event_type}: {handler.__name__}")

            # If no handlers left, unsubscribe from Redis
            if not self.handlers[event_type]:
                self.handlers.pop(event_type)
                if self.pubsub:
                    await self.pubsub.unsubscribe(event_type)
                logger.info(f"Unsubscribed from event type: {event_type}")

    async def publish(
        self,
        event_type: str,
        payload: dict[str, Any],
        source: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Publish an event to all subscribers.

        Args:
            event_type: Type of event (e.g., "integration.cin7.stock_updated")
            payload: Event data
            source: Source system (e.g., "cin7", "shopify", "backorder_agent")
            metadata: Additional metadata

        Returns:
            event_id: Unique identifier for this event
        """
        if self.redis is None:
            raise RuntimeError("Event bus not connected. Call connect() first.")

        event_id = str(uuid4())
        event = {
            "type": event_type,
            "event_id": event_id,
            "payload": payload,
            "source": source,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            # Publish to Redis
            await self.redis.publish(event_type, json.dumps(event, default=str))

            # Also store in event log (for debugging/replay)
            await self._log_event(event)

            logger.debug(f"Published event {event_id}: {event_type}")
            return event_id
        except Exception as e:
            logger.error(f"Failed to publish event {event_type}: {e}")
            raise

    async def start(self) -> None:
        """Start listening for events and dispatching to handlers."""
        if self.is_running:
            logger.warning("Event bus already running")
            return

        if self.redis is None:
            await self.connect()

        if not self.pubsub:
            logger.warning("No subscriptions registered")
            return

        self.is_running = True
        self._listen_task = asyncio.create_task(self._listen())
        logger.info("Event bus started")

    async def _listen(self) -> None:
        """Listen for events from Redis and dispatch to handlers."""
        if not self.pubsub:
            return

        try:
            async for message in self.pubsub.listen():
                if not self.is_running:
                    break

                if message["type"] == "message":
                    await self._handle_message(message)
        except asyncio.CancelledError:
            logger.info("Event bus listener cancelled")
        except Exception as e:
            logger.error(f"Error in event bus listener: {e}")
            self.is_running = False

    async def _handle_message(self, message: dict) -> None:
        """Handle incoming message from Redis."""
        try:
            event = json.loads(message["data"])
            event_type = event["type"]

            if event_type not in self.handlers:
                return

            # Dispatch to all registered handlers
            tasks = []
            for handler in self.handlers[event_type]:
                task = asyncio.create_task(self._safe_handler_call(handler, event))
                tasks.append(task)

            # Wait for all handlers to complete
            await asyncio.gather(*tasks, return_exceptions=True)

        except Exception as e:
            logger.error(f"Error handling message: {e}")

    async def _safe_handler_call(self, handler: Callable, event: dict) -> None:
        """Safely call handler with error handling."""
        try:
            await handler(event)
        except Exception as e:
            logger.error(
                f"Error in handler {handler.__name__} for event {event['type']}: {e}",
                exc_info=True,
            )

    async def _log_event(self, event: dict) -> None:
        """Store event in Redis for debugging/replay (7 day TTL)."""
        if self.redis is None:
            return

        try:
            key = f"event_log:{event['event_id']}"
            await self.redis.setex(
                key,
                60 * 60 * 24 * 7,  # 7 days
                json.dumps(event, default=str),
            )
        except Exception as e:
            logger.warning(f"Failed to log event: {e}")

    async def get_event_history(
        self, event_type: str | None = None, limit: int = 100
    ) -> list[dict]:
        """
        Retrieve event history from Redis.

        Args:
            event_type: Filter by event type (None for all)
            limit: Maximum number of events to return

        Returns:
            List of events in reverse chronological order
        """
        if self.redis is None:
            raise RuntimeError("Event bus not connected")

        try:
            keys = await self.redis.keys("event_log:*")
            events = []

            for key in keys[:limit]:
                event_data = await self.redis.get(key)
                if event_data:
                    event = json.loads(event_data)
                    if event_type is None or event["type"] == event_type:
                        events.append(event)

            # Sort by timestamp descending
            events.sort(key=lambda e: e["timestamp"], reverse=True)
            return events[:limit]
        except Exception as e:
            logger.error(f"Failed to retrieve event history: {e}")
            return []


# Global event bus instance
_event_bus: EventBus | None = None


@lru_cache
def get_event_bus() -> EventBus:
    """Get or create the global event bus instance."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus
