"""Xero OAuth2 authentication handler.

This module handles the OAuth2 authorization flow for Xero integration,
including token exchange, refresh, and storage.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.xero_models import XeroConnection
from src.security.encryption import get_encryption_service

logger = structlog.get_logger(__name__)


class XeroAuth:
    """Handles Xero OAuth2 authentication flow.

    This class manages the OAuth2 authorization code flow with PKCE,
    token exchange, refresh, and secure storage.
    """

    # Xero OAuth2 endpoints
    AUTHORIZATION_ENDPOINT = "https://login.xero.com/identity/connect/authorize"
    TOKEN_ENDPOINT = "https://identity.xero.com/connect/token"
    CONNECTIONS_ENDPOINT = "https://api.xero.com/connections"
    REVOKE_ENDPOINT = "https://identity.xero.com/connect/revocation"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: list[str],
    ):
        """Initialize XeroAuth with OAuth2 credentials.

        Args:
            client_id: Xero OAuth2 client ID
            client_secret: Xero OAuth2 client secret
            redirect_uri: OAuth2 callback URL
            scopes: List of Xero scopes to request
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self._http_client = httpx.AsyncClient(timeout=30.0)

    def get_authorization_url(self, state: str | None = None) -> tuple[str, str]:
        """Generate authorization URL for OAuth2 flow.

        Args:
            state: Optional state parameter for CSRF protection

        Returns:
            Tuple of (authorization_url, state)
        """
        if state is None:
            state = secrets.token_urlsafe(32)

        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state,
        }

        auth_url = f"{self.AUTHORIZATION_ENDPOINT}?{urlencode(params)}"

        logger.info("Generated Xero authorization URL", state=state)

        return auth_url, state

    async def exchange_code_for_tokens(
        self,
        authorization_code: str,
    ) -> dict:
        """Exchange authorization code for access and refresh tokens.

        Args:
            authorization_code: Authorization code from OAuth callback

        Returns:
            Dict containing access_token, refresh_token, expires_in, token_type

        Raises:
            httpx.HTTPStatusError: If token exchange fails
        """
        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": authorization_code,
            "redirect_uri": self.redirect_uri,
        }

        try:
            response = await self._http_client.post(
                self.TOKEN_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()

            token_data = response.json()

            logger.info(
                "Successfully exchanged authorization code for tokens",
                expires_in=token_data.get("expires_in"),
            )

            return token_data

        except httpx.HTTPStatusError as e:
            logger.error(
                "Failed to exchange authorization code",
                status_code=e.response.status_code,
                error=e.response.text,
            )
            raise

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Refresh an expired access token.

        Args:
            refresh_token: Valid refresh token

        Returns:
            Dict containing new access_token, refresh_token, expires_in

        Raises:
            httpx.HTTPStatusError: If token refresh fails
        """
        data = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
        }

        try:
            response = await self._http_client.post(
                self.TOKEN_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()

            token_data = response.json()

            logger.info(
                "Successfully refreshed access token",
                expires_in=token_data.get("expires_in"),
            )

            return token_data

        except httpx.HTTPStatusError as e:
            logger.error(
                "Failed to refresh access token",
                status_code=e.response.status_code,
                error=e.response.text,
            )
            raise

    async def get_connections(self, access_token: str) -> list[dict]:
        """Get list of Xero tenants (organizations) authorized by the user.

        Args:
            access_token: Valid access token

        Returns:
            List of tenant dicts with id, tenantId, tenantType, etc.

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            response = await self._http_client.get(
                self.CONNECTIONS_ENDPOINT,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()

            connections = response.json()

            logger.info("Retrieved Xero connections", count=len(connections))

            return connections

        except httpx.HTTPStatusError as e:
            logger.error(
                "Failed to get Xero connections",
                status_code=e.response.status_code,
                error=e.response.text,
            )
            raise

    async def revoke_token(self, token: str) -> None:
        """Revoke an access or refresh token.

        Args:
            token: Token to revoke (access or refresh)

        Raises:
            httpx.HTTPStatusError: If revocation fails
        """
        data = {"token": token}

        try:
            response = await self._http_client.post(
                self.REVOKE_ENDPOINT,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                auth=(self.client_id, self.client_secret),
            )
            response.raise_for_status()

            logger.info("Successfully revoked token")

        except httpx.HTTPStatusError as e:
            logger.error(
                "Failed to revoke token",
                status_code=e.response.status_code,
                error=e.response.text,
            )
            raise

    async def store_connection(
        self,
        db: AsyncSession,
        organization_id: uuid.UUID,
        tenant_id: str,
        tenant_name: str,
        access_token: str,
        refresh_token: str,
        expires_in: int,
        scopes: list[str],
    ) -> XeroConnection:
        """Store or update Xero connection in database.

        Args:
            db: Database session
            organization_id: Organization UUID
            tenant_id: Xero tenant ID
            tenant_name: Xero tenant name
            access_token: OAuth2 access token
            refresh_token: OAuth2 refresh token
            expires_in: Token expiry in seconds
            scopes: Granted OAuth2 scopes

        Returns:
            XeroConnection instance
        """
        # Check if connection already exists for this org
        stmt = select(XeroConnection).where(
            XeroConnection.organization_id == organization_id,
            XeroConnection.is_active == True,  # noqa: E712
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)

        # Encrypt tokens before storage
        encryption_service = get_encryption_service()
        encrypted_access_token = encryption_service.encrypt(access_token)
        encrypted_refresh_token = encryption_service.encrypt(refresh_token)

        if existing:
            # Update existing connection
            existing.tenant_id = tenant_id
            existing.tenant_name = tenant_name
            existing.access_token = encrypted_access_token
            existing.refresh_token = encrypted_refresh_token
            existing.expires_at = expires_at
            existing.scopes = scopes
            existing.updated_at = datetime.now(UTC)

            logger.info(
                "Updated existing Xero connection with encrypted tokens",
                organization_id=str(organization_id),
                tenant_id=tenant_id,
            )

            return existing
        else:
            # Create new connection
            connection = XeroConnection(
                organization_id=organization_id,
                tenant_id=tenant_id,
                tenant_name=tenant_name,
                access_token=encrypted_access_token,
                refresh_token=encrypted_refresh_token,
                expires_at=expires_at,
                scopes=scopes,
                is_active=True,
            )

            db.add(connection)

            logger.info(
                "Created new Xero connection with encrypted tokens",
                organization_id=str(organization_id),
                tenant_id=tenant_id,
            )

            return connection

    @staticmethod
    def get_decrypted_access_token(connection: XeroConnection) -> str:
        """Get decrypted access token from connection.

        Args:
            connection: XeroConnection instance with encrypted token

        Returns:
            Decrypted access token

        Raises:
            ValueError: If decryption fails
        """
        encryption_service = get_encryption_service()
        return encryption_service.decrypt(connection.access_token)

    async def get_active_connection(
        self,
        db: AsyncSession,
        organization_id: uuid.UUID,
    ) -> XeroConnection | None:
        """Get active Xero connection for an organization.

        If the access token is expired, automatically refresh it.

        Args:
            db: Database session
            organization_id: Organization UUID

        Returns:
            XeroConnection instance or None (tokens remain encrypted)
        """
        stmt = select(XeroConnection).where(
            XeroConnection.organization_id == organization_id,
            XeroConnection.is_active == True,  # noqa: E712
        )
        result = await db.execute(stmt)
        connection = result.scalar_one_or_none()

        if not connection:
            return None

        # Decrypt tokens when retrieving
        encryption_service = get_encryption_service()
        try:
            decrypted_refresh_token = encryption_service.decrypt(connection.refresh_token)
        except Exception as e:
            logger.error("Failed to decrypt refresh token", error=str(e))
            connection.is_active = False
            await db.commit()
            return None

        # Check if token is expired
        if connection.is_token_expired:
            logger.info(
                "Access token expired, refreshing",
                organization_id=str(organization_id),
            )

            try:
                token_data = await self.refresh_access_token(decrypted_refresh_token)

                # Re-encrypt new tokens before storing
                connection.access_token = encryption_service.encrypt(token_data["access_token"])
                new_refresh = token_data.get("refresh_token", decrypted_refresh_token)
                connection.refresh_token = encryption_service.encrypt(new_refresh)
                connection.expires_at = datetime.now(UTC) + timedelta(
                    seconds=token_data["expires_in"]
                )
                connection.updated_at = datetime.now(UTC)

                await db.commit()

                logger.info("Successfully refreshed and re-encrypted access token")

            except Exception as e:
                logger.error("Failed to refresh token", error=str(e))
                # Mark connection as inactive if refresh fails
                connection.is_active = False
                await db.commit()
                return None

        return connection

    async def disconnect(
        self,
        db: AsyncSession,
        organization_id: uuid.UUID,
    ) -> bool:
        """Disconnect (revoke and deactivate) Xero integration.

        Args:
            db: Database session
            organization_id: Organization UUID

        Returns:
            True if disconnected successfully
        """
        connection = await self.get_active_connection(db, organization_id)

        if not connection:
            return False

        try:
            # Decrypt refresh token before revoking
            encryption_service = get_encryption_service()
            decrypted_refresh_token = encryption_service.decrypt(connection.refresh_token)

            # Revoke refresh token
            await self.revoke_token(decrypted_refresh_token)

            # Deactivate connection
            connection.is_active = False
            connection.updated_at = datetime.now(UTC)

            await db.commit()

            logger.info(
                "Successfully disconnected Xero",
                organization_id=str(organization_id),
            )

            return True

        except Exception as e:
            logger.error(
                "Failed to disconnect Xero",
                organization_id=str(organization_id),
                error=str(e),
            )
            return False

    async def close(self) -> None:
        """Close HTTP client."""
        await self._http_client.aclose()
