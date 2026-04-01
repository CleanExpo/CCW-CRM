"""Event bus for application-wide event handling."""

from collections import defaultdict
from collections.abc import Callable
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class EventBus:
    """Simple event bus for publishing and subscribing to events."""

    def __init__(self) -> None:
        """Initialize the event bus."""
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable) -> None:
        """
        Subscribe to an event type.

        Args:
            event_type: The type of event to subscribe to
            handler: The function to call when the event is published
        """
        self._subscribers[event_type].append(handler)
        logger.debug("Subscribed to event", event_type=event_type, handler=handler.__name__)

    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """
        Unsubscribe from an event type.

        Args:
            event_type: The type of event to unsubscribe from
            handler: The handler function to remove
        """
        if event_type in self._subscribers:
            self._subscribers[event_type].remove(handler)
            logger.debug("Unsubscribed from event", event_type=event_type, handler=handler.__name__)  # noqa: E501

    async def publish(self, event_type: str, data: dict[str, Any] | None = None) -> None:
        """
        Publish an event to all subscribers.

        Args:
            event_type: The type of event being published
            data: Optional data to pass to handlers
        """
        if event_type not in self._subscribers:
            logger.debug("No subscribers for event", event_type=event_type)
            return

        logger.info("Publishing event", event_type=event_type, subscriber_count=len(self._subscribers[event_type]))  # noqa: E501

        for handler in self._subscribers[event_type]:
            try:
                if data:
                    await handler(data)
                else:
                    await handler()
                logger.debug("Event handler executed", event_type=event_type, handler=handler.__name__)  # noqa: E501
            except Exception as e:
                logger.error("Event handler failed", event_type=event_type, handler=handler.__name__, error=str(e))  # noqa: E501


# Global event bus instance
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """
    Get the global event bus instance.

    Returns:
        The global EventBus instance
    """
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
        logger.info("Event bus initialized")
    return _event_bus
