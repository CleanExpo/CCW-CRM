"""Event system for the ERP application."""

from .event_bus import EventBus, get_event_bus

__all__ = ["EventBus", "get_event_bus"]
