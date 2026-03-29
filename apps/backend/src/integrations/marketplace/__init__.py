"""Multi-channel marketplace integration package.

Provides a unified abstraction layer for syncing products, inventory,
and orders across Shopify, eBay, and Facebook Marketplace.
"""

from .base import BaseMarketplaceChannel, ChannelOrder, ChannelProduct, ConnectionResult
from .registry import channel_registry, get_channel, register_channel

# Import channel implementations to trigger @register_channel decorators
from . import shopify_channel  # noqa: F401
from . import ebay_channel  # noqa: F401

__all__ = [
    "BaseMarketplaceChannel",
    "ChannelProduct",
    "ChannelOrder",
    "ConnectionResult",
    "channel_registry",
    "get_channel",
    "register_channel",
    "shopify_channel",
    "ebay_channel",
]
