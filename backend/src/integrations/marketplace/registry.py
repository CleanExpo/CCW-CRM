"""Marketplace channel registry.

Central registry for discovering and instantiating marketplace channel implementations.
Channels register themselves at import time; the sync engine looks them up by type.
"""

from __future__ import annotations

import structlog

from .base import BaseMarketplaceChannel

logger = structlog.get_logger(__name__)

# Global channel registry: channel_type -> channel class
_channel_registry: dict[str, type[BaseMarketplaceChannel]] = {}


def register_channel(channel_cls: type[BaseMarketplaceChannel]) -> type[BaseMarketplaceChannel]:
    """Register a marketplace channel implementation.

    Can be used as a decorator:
        @register_channel
        class ShopifyChannel(BaseMarketplaceChannel):
            channel_type = "shopify"

    Args:
        channel_cls: The channel class to register.

    Returns:
        The same class (unchanged), for decorator use.
    """
    channel_type = channel_cls.channel_type
    if channel_type in _channel_registry:
        logger.warning(
            "channel_already_registered",
            channel_type=channel_type,
            existing=_channel_registry[channel_type].__name__,
            new=channel_cls.__name__,
        )
    _channel_registry[channel_type] = channel_cls
    logger.info("channel_registered", channel_type=channel_type, cls=channel_cls.__name__)
    return channel_cls


def get_channel(channel_type: str) -> type[BaseMarketplaceChannel] | None:
    """Look up a registered channel class by type.

    Args:
        channel_type: The channel type string (e.g. "shopify", "ebay").

    Returns:
        The channel class, or None if not registered.
    """
    return _channel_registry.get(channel_type)


def list_channels() -> list[dict]:
    """List all registered marketplace channels with metadata.

    Returns:
        List of dicts with channel_type and display_name.
    """
    result = []
    for channel_type, cls in _channel_registry.items():
        result.append({
            "channel_type": channel_type,
            "display_name": getattr(cls, "display_name", channel_type.title()),
        })
    return result


def channel_registry() -> dict[str, type[BaseMarketplaceChannel]]:
    """Get a copy of the full channel registry.

    Returns:
        Dict mapping channel_type to channel class.
    """
    return dict(_channel_registry)
