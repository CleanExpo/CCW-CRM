"""Xero accounting integration.

This module provides OAuth2 authentication, API client, and sync functionality for Xero.

Key Components:
- XeroAuth: OAuth2 authentication flow handler
- XeroClient: Basic Xero API client
- XeroClientWithAutoRefresh: Client with automatic token refresh (recommended)
- XeroTokenManager: Token management with auto-refresh and persistence
"""

from .auth import XeroAuth
from .client import XeroClient
from .demo_client import DemoXeroClient
from .pos_reconciliation import POSXeroReconciliation
from .token_manager import (
    TokenRefreshError,
    XeroClientWithAutoRefresh,
    XeroTokenManager,
    get_auto_refresh_client,
)


def get_xero_client(access_token: str, tenant_id: str, demo_mode: bool = False) -> XeroClient | DemoXeroClient:  # noqa: E501
    """Factory function to get appropriate Xero client (LEGACY - use get_auto_refresh_client for production).

    For production use, prefer get_auto_refresh_client() which handles token refresh automatically.

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


__all__ = [
    # Auth
    "XeroAuth",
    # Clients
    "XeroClient",
    "DemoXeroClient",
    "XeroClientWithAutoRefresh",
    # Token Management
    "XeroTokenManager",
    "TokenRefreshError",
    # Factory Functions
    "get_xero_client",
    "get_auto_refresh_client",
    # POS Reconciliation
    "POSXeroReconciliation",
]
