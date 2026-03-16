"""Multi-channel marketplace integration package.

Provides a unified abstraction layer for syncing products, inventory,
and orders across Shopify, eBay, and Facebook Marketplace.
"""

from .base import BaseMarketplaceChannel, ChannelProduct, ChannelOrder, ConnectionResult
from .registry import channel_registry, get_channel, register_channel

__all__ = [
    "BaseMarketplaceChannel",
    "ChannelProduct",
    "ChannelOrder",
    "ConnectionResult",
    "channel_registry",
    "get_channel",
    "register_channel",
]
