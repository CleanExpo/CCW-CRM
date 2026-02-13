"""Xero OAuth2 token manager with automatic refresh.

This module provides a token-aware client wrapper that automatically refreshes
access tokens before they expire, preventing integration breakage after 24 hours.

Key Features:
- Automatic token refresh before expiry (5-minute buffer)
- Retry logic for 401 errors with automatic token refresh
- Thread-safe token updates with database persistence
- Proactive refresh support for background jobs
"""

import time
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.xero_models import XeroConnection
from src.monitoring.metrics import (
    xero_connection_health,
    xero_token_expiry_minutes,
    xero_token_refresh_duration,
    xero_token_refresh_total,
)
from src.security.encryption import get_encryption_service

logger = structlog.get_logger(__name__)

# Constants
TOKEN_REFRESH_BUFFER_MINUTES = 5  # Refresh if token expires within this time
MAX_REFRESH_RETRIES = 2  # Max retries for token refresh


class TokenRefreshError(Exception):
    """Exception raised when token refresh fails."""

    def __init__(self, message: str, is_recoverable: bool = False):
        self.message = message
        self.is_recoverable = is_recoverable
        super().__init__(self.message)


class XeroTokenManager:
    """Manages Xero OAuth2 tokens with automatic refresh.

    This class handles:
    - Checking token expiry before API calls
    - Automatic token refresh when needed
    - Persisting updated tokens to database
    - Handling refresh token rotation (Xero uses rolling refresh tokens)
    """

    # Xero OAuth2 token endpoint
    TOKEN_ENDPOINT = "https://identity.xero.com/connect/token"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        connection_id: UUID | None = None,
    ):
        """Initialize token manager.

        Args:
            client_id: Xero OAuth2 client ID
            client_secret: Xero OAuth2 client secret
            connection_id: Optional XeroConnection ID for database persistence
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.connection_id = connection_id
        self._http_client: httpx.AsyncClient | None = None

        # Cached token data (decrypted)
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._expires_at: datetime | None = None
        self._tenant_id: str | None = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    def load_from_connection(self, connection: XeroConnection) -> None:
        """Load token data from XeroConnection model.

        Args:
            connection: XeroConnection instance with encrypted tokens
        """
        encryption_service = get_encryption_service()

        try:
            self._access_token = encryption_service.decrypt(connection.access_token)
            self._refresh_token = encryption_service.decrypt(connection.refresh_token)
            self._expires_at = connection.expires_at
            self._tenant_id = connection.tenant_id
            self.connection_id = connection.id

            logger.debug(
                "Loaded tokens from connection",
                connection_id=str(connection.id),
                expires_at=self._expires_at.isoformat() if self._expires_at else None,
            )

        except Exception as e:
            logger.error("Failed to decrypt tokens from connection", error=str(e))
            raise TokenRefreshError(
                f"Failed to decrypt tokens: {e}", is_recoverable=False
            )

    def is_token_expired(self, buffer_minutes: int = TOKEN_REFRESH_BUFFER_MINUTES) -> bool:
        """Check if access token is expired or will expire soon.

        Args:
            buffer_minutes: Minutes before actual expiry to consider expired

        Returns:
            True if token is expired or will expire within buffer time
        """
        if not self._expires_at:
            return True

        now = datetime.now(UTC)
        expiry_threshold = self._expires_at - timedelta(minutes=buffer_minutes)

        return now >= expiry_threshold

    async def ensure_valid_token(self, db: AsyncSession) -> str:
        """Ensure access token is valid, refreshing if needed.

        This is the main method to call before making Xero API requests.

        Args:
            db: Database session for persisting updated tokens

        Returns:
            Valid access token

        Raises:
            TokenRefreshError: If token refresh fails
        """
        if not self._access_token or not self._refresh_token:
            raise TokenRefreshError(
                "No tokens loaded. Call load_from_connection() first.",
                is_recoverable=False,
            )

        if self.is_token_expired():
            logger.info(
                "Access token expired or expiring soon, refreshing",
                expires_at=self._expires_at.isoformat() if self._expires_at else None,
            )
            await self._refresh_access_token(db)

        return self._access_token

    async def _refresh_access_token(
        self,
        db: AsyncSession,
        retries: int = MAX_REFRESH_RETRIES,
    ) -> None:
        """Refresh the access token using the refresh token.

        Args:
            db: Database session for persisting updated tokens
            retries: Number of retry attempts remaining

        Raises:
            TokenRefreshError: If refresh fails after all retries
        """
        if not self._refresh_token:
            xero_token_refresh_total.labels(status="failed").inc()
            raise TokenRefreshError(
                "No refresh token available", is_recoverable=False
            )

        http_client = await self._get_http_client()
        start_time = time.monotonic()

        data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self._refresh_token,
        }

        try:
            response = await http_client.post(
                self.TOKEN_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code == 401 or response.status_code == 400:
                # Refresh token is invalid or expired
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("error_description", "Invalid refresh token")

                logger.error(
                    "Refresh token invalid",
                    status_code=response.status_code,
                    error=error_msg,
                )

                # Record metrics
                xero_token_refresh_total.labels(status="invalid_refresh_token").inc()
                if self._tenant_id:
                    xero_connection_health.labels(tenant_id=self._tenant_id).set(0)

                # Mark connection as inactive
                await self._mark_connection_inactive(db)

                raise TokenRefreshError(
                    f"Refresh token invalid: {error_msg}. Re-authentication required.",
                    is_recoverable=False,
                )

            response.raise_for_status()

            token_data = response.json()

            # Update cached tokens
            self._access_token = token_data["access_token"]
            self._expires_at = datetime.now(UTC) + timedelta(
                seconds=token_data["expires_in"]
            )

            # Xero uses rolling refresh tokens - always update if provided
            if "refresh_token" in token_data:
                self._refresh_token = token_data["refresh_token"]

            # Persist to database
            await self._persist_tokens(db)

            # Record success metrics
            duration = time.monotonic() - start_time
            xero_token_refresh_total.labels(status="success").inc()
            xero_token_refresh_duration.observe(duration)

            # Update expiry metric
            if self._tenant_id and self._expires_at:
                minutes_until_expiry = (self._expires_at - datetime.now(UTC)).total_seconds() / 60
                xero_token_expiry_minutes.labels(tenant_id=self._tenant_id).set(minutes_until_expiry)
                xero_connection_health.labels(tenant_id=self._tenant_id).set(3)  # healthy

            logger.info(
                "Successfully refreshed access token",
                expires_in=token_data["expires_in"],
                new_expires_at=self._expires_at.isoformat(),
                duration_seconds=round(duration, 3),
            )

        except httpx.HTTPStatusError as e:
            if retries > 0 and e.response.status_code >= 500:
                # Retry on server errors
                logger.warning(
                    "Token refresh failed with server error, retrying",
                    status_code=e.response.status_code,
                    retries_remaining=retries - 1,
                )
                await self._refresh_access_token(db, retries - 1)
            else:
                error_msg = f"Token refresh failed: HTTP {e.response.status_code}"
                logger.error(error_msg)
                xero_token_refresh_total.labels(status="failed").inc()
                raise TokenRefreshError(error_msg, is_recoverable=False) from e

        except httpx.RequestError as e:
            if retries > 0:
                logger.warning(
                    "Token refresh network error, retrying",
                    error=str(e),
                    retries_remaining=retries - 1,
                )
                await self._refresh_access_token(db, retries - 1)
            else:
                error_msg = f"Token refresh network error: {e}"
                logger.error(error_msg)
                xero_token_refresh_total.labels(status="failed").inc()
                raise TokenRefreshError(error_msg, is_recoverable=True) from e

    async def _persist_tokens(self, db: AsyncSession) -> None:
        """Persist updated tokens to database.

        Args:
            db: Database session
        """
        if not self.connection_id:
            logger.warning("No connection_id set, skipping token persistence")
            return

        encryption_service = get_encryption_service()

        try:
            stmt = select(XeroConnection).where(XeroConnection.id == self.connection_id)
            result = await db.execute(stmt)
            connection = result.scalar_one_or_none()

            if not connection:
                logger.error(
                    "Connection not found for token persistence",
                    connection_id=str(self.connection_id),
                )
                return

            # Encrypt and update tokens
            connection.access_token = encryption_service.encrypt(self._access_token)
            connection.refresh_token = encryption_service.encrypt(self._refresh_token)
            connection.expires_at = self._expires_at
            connection.updated_at = datetime.now(UTC)

            await db.commit()

            logger.info(
                "Persisted refreshed tokens to database",
                connection_id=str(self.connection_id),
            )

        except Exception as e:
            logger.error(
                "Failed to persist tokens",
                connection_id=str(self.connection_id),
                error=str(e),
            )
            # Don't raise - tokens are still valid in memory

    async def _mark_connection_inactive(self, db: AsyncSession) -> None:
        """Mark connection as inactive when refresh token is invalid.

        Args:
            db: Database session
        """
        if not self.connection_id:
            return

        try:
            stmt = select(XeroConnection).where(XeroConnection.id == self.connection_id)
            result = await db.execute(stmt)
            connection = result.scalar_one_or_none()

            if connection:
                connection.is_active = False
                connection.updated_at = datetime.now(UTC)
                await db.commit()

                logger.warning(
                    "Marked Xero connection as inactive due to invalid refresh token",
                    connection_id=str(self.connection_id),
                )

        except Exception as e:
            logger.error(
                "Failed to mark connection inactive",
                connection_id=str(self.connection_id),
                error=str(e),
            )

    @property
    def access_token(self) -> str | None:
        """Get current access token (may be expired)."""
        return self._access_token

    @property
    def tenant_id(self) -> str | None:
        """Get Xero tenant ID."""
        return self._tenant_id

    @property
    def expires_at(self) -> datetime | None:
        """Get token expiry time."""
        return self._expires_at

    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None


class XeroClientWithAutoRefresh:
    """Xero API client wrapper with automatic token refresh.

    This client wraps the base XeroClient and automatically refreshes
    tokens before making API calls, preventing 401 errors due to token expiry.

    Usage:
        async with XeroClientWithAutoRefresh(token_manager, db) as client:
            result = await client.get_organisation()
    """

    BASE_URL = "https://api.xero.com/api.xro/2.0"

    def __init__(
        self,
        token_manager: XeroTokenManager,
        db: AsyncSession,
    ):
        """Initialize auto-refresh client.

        Args:
            token_manager: XeroTokenManager instance with loaded tokens
            db: Database session for token persistence
        """
        self.token_manager = token_manager
        self.db = db
        self._http_client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "XeroClientWithAutoRefresh":
        """Async context manager entry."""
        self._http_client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    async def _get_headers(self) -> dict[str, str]:
        """Get headers with valid access token.

        Automatically refreshes token if expired.
        """
        access_token = await self.token_manager.ensure_valid_token(self.db)

        return {
            "Authorization": f"Bearer {access_token}",
            "Xero-tenant-id": self.token_manager.tenant_id or "",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: dict | None = None,
        params: dict | None = None,
        retry_on_401: bool = True,
    ) -> dict:
        """Make an authenticated request with automatic token refresh.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., "/Invoices")
            data: Request body data
            params: Query parameters
            retry_on_401: Whether to retry on 401 (default True)

        Returns:
            Response JSON data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        if not self._http_client:
            raise RuntimeError("Client not initialized. Use 'async with' context manager.")

        url = f"{self.BASE_URL}{endpoint}"
        headers = await self._get_headers()

        try:
            response = await self._http_client.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
            )

            # Handle 401 with automatic retry after token refresh
            if response.status_code == 401 and retry_on_401:
                logger.warning(
                    "Received 401, attempting token refresh and retry",
                    endpoint=endpoint,
                )

                # Force token refresh
                await self.token_manager._refresh_access_token(self.db)

                # Retry request with new token
                headers = await self._get_headers()
                response = await self._http_client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=data,
                    params=params,
                )

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError:
            raise
        except Exception as e:
            logger.error(
                "Xero API request failed",
                method=method,
                endpoint=endpoint,
                error=str(e),
            )
            raise

    # Delegate common operations to maintain compatibility with XeroClient interface

    async def get_organisation(self) -> dict:
        """Get organization details."""
        result = await self._make_request("GET", "/Organisation")
        organisations = result.get("Organisations", [])
        return organisations[0] if organisations else {}

    async def create_contact(
        self,
        name: str,
        email: str | None = None,
        phone: str | None = None,
        address: dict | None = None,
    ) -> dict:
        """Create or update a contact in Xero."""
        contact_data: dict[str, Any] = {"Name": name}

        if email:
            contact_data["EmailAddress"] = email

        if phone:
            contact_data["Phones"] = [{"PhoneType": "DEFAULT", "PhoneNumber": phone}]

        if address:
            contact_data["Addresses"] = [
                {
                    "AddressType": "STREET",
                    "AddressLine1": address.get("street", ""),
                    "City": address.get("city", ""),
                    "Region": address.get("state", ""),
                    "PostalCode": address.get("postal_code", ""),
                    "Country": address.get("country", ""),
                }
            ]

        payload = {"Contacts": [contact_data]}
        result = await self._make_request("POST", "/Contacts", data=payload)
        contacts = result.get("Contacts", [])
        return contacts[0] if contacts else {}

    async def get_contact_by_email(self, email: str) -> dict | None:
        """Find a contact by email address."""
        params = {"where": f'EmailAddress=="{email}"'}
        result = await self._make_request("GET", "/Contacts", params=params)
        contacts = result.get("Contacts", [])
        return contacts[0] if contacts else None

    async def create_invoice(
        self,
        contact_id: str,
        invoice_number: str,
        line_items: list[dict],
        due_date: Any = None,
        reference: str | None = None,
    ) -> dict:
        """Create an invoice in Xero."""
        invoice_data: dict[str, Any] = {
            "Type": "ACCREC",
            "Contact": {"ContactID": contact_id},
            "InvoiceNumber": invoice_number,
            "LineItems": [
                {
                    "Description": item["description"],
                    "Quantity": item["quantity"],
                    "UnitAmount": item["unit_amount"],
                    "AccountCode": "200",
                }
                for item in line_items
            ],
            "Status": "DRAFT",
        }

        if due_date:
            date_val = due_date.isoformat() if hasattr(due_date, "isoformat") else str(due_date)
            invoice_data["DueDate"] = date_val

        if reference:
            invoice_data["Reference"] = reference

        payload = {"Invoices": [invoice_data]}
        result = await self._make_request("POST", "/Invoices", data=payload)
        invoices = result.get("Invoices", [])
        return invoices[0] if invoices else {}

    async def get_invoice(self, invoice_id: str) -> dict:
        """Get invoice details by ID."""
        result = await self._make_request("GET", f"/Invoices/{invoice_id}")
        invoices = result.get("Invoices", [])
        return invoices[0] if invoices else {}

    async def approve_invoice(self, invoice_id: str) -> dict:
        """Approve a draft invoice."""
        payload = {"Invoices": [{"InvoiceID": invoice_id, "Status": "AUTHORISED"}]}
        result = await self._make_request("POST", "/Invoices", data=payload)
        invoices = result.get("Invoices", [])
        return invoices[0] if invoices else {}

    async def get_payments(
        self,
        invoice_id: str | None = None,
        modified_after: Any = None,
    ) -> list[dict]:
        """Get payments, optionally filtered."""
        params = {}

        if invoice_id:
            params["where"] = f'Invoice.InvoiceID==Guid("{invoice_id}")'

        if modified_after:
            if hasattr(modified_after, "isoformat"):
                params["If-Modified-Since"] = modified_after.isoformat()
            else:
                params["If-Modified-Since"] = str(modified_after)

        result = await self._make_request("GET", "/Payments", params=params)
        return result.get("Payments", [])

    async def get_bank_transactions(
        self,
        start_date: Any = None,
        end_date: Any = None,
        bank_account_id: str | None = None,
    ) -> list[dict]:
        """Get bank transactions (bank feed data)."""
        params = {}
        where_clauses = []

        if start_date:
            if hasattr(start_date, 'year'):
                where_clauses.append(f'Date>=DateTime({start_date.year},{start_date.month},{start_date.day})')

        if end_date:
            if hasattr(end_date, 'year'):
                where_clauses.append(f'Date<=DateTime({end_date.year},{end_date.month},{end_date.day})')

        if bank_account_id:
            where_clauses.append(f'BankAccount.AccountID==Guid("{bank_account_id}")')

        if where_clauses:
            params["where"] = " AND ".join(where_clauses)

        result = await self._make_request("GET", "/BankTransactions", params=params)
        return result.get("BankTransactions", [])

    async def close(self) -> None:
        """Close HTTP client (for compatibility with XeroClient)."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None


async def get_auto_refresh_client(
    db: AsyncSession,
    organization_id: UUID,
    client_id: str,
    client_secret: str,
) -> XeroClientWithAutoRefresh | None:
    """Factory function to get auto-refresh Xero client for an organization.

    Args:
        db: Database session
        organization_id: Organization UUID
        client_id: Xero OAuth2 client ID
        client_secret: Xero OAuth2 client secret

    Returns:
        XeroClientWithAutoRefresh instance or None if no active connection
    """
    # Get active connection
    stmt = select(XeroConnection).where(
        XeroConnection.organization_id == organization_id,
        XeroConnection.is_active == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    connection = result.scalar_one_or_none()

    if not connection:
        return None

    # Create token manager and load tokens
    token_manager = XeroTokenManager(client_id, client_secret)
    token_manager.load_from_connection(connection)

    # Create and return auto-refresh client
    client = XeroClientWithAutoRefresh(token_manager, db)
    return client
