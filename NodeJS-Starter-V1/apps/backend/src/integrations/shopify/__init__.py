"""Shopify integration package.

Provides order import, inventory sync, and product management for Shopify e-commerce stores.
Supports both demo mode (no real API calls) and live mode (real Shopify Admin API).
"""

from src.integrations.shopify.client import ShopifyClient, get_shopify_client

__all__ = ["ShopifyClient", "get_shopify_client"]
