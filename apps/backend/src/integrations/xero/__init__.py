"""Xero accounting integration.

This module provides OAuth2 authentication, API client, and sync functionality for Xero.
"""

from .auth import XeroAuth
from .client import XeroClient
from .demo_client import DemoXeroClient


def get_xero_client(access_token: str, tenant_id: str, demo_mode: bool = False) -> XeroClient | DemoXeroClient:  # noqa: E501
    """Factory function to get appropriate Xero client.

    Args:
        access_token: OAuth2 access token
        tenant_id: Xero tenant ID
        demo_mode: If True, return demo client (no real API calls)

    Returns:
        XeroClient or DemoXeroClient
    """
    if demo_mode:
        return DemoXeroClient(access_token, tenant_id)
    return XeroClient(access_token, tenant_id)


__all__ = ["XeroAuth", "XeroClient", "DemoXeroClient", "get_xero_client"]
