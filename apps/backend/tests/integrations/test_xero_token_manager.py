"""Tests for Xero OAuth token auto-refresh functionality.

These tests verify that:
1. Tokens are automatically refreshed before expiry
2. 401 errors trigger automatic token refresh and retry
3. Invalid refresh tokens are handled properly
4. Metrics are recorded correctly
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.integrations.xero.token_manager import (
    MAX_REFRESH_RETRIES,
    TOKEN_REFRESH_BUFFER_MINUTES,
    TokenRefreshError,
    XeroClientWithAutoRefresh,
    XeroTokenManager,
)


class TestXeroTokenManager:
    """Tests for XeroTokenManager class."""

    @pytest.fixture
    def token_manager(self):
        """Create a token manager instance."""
        return XeroTokenManager(
            client_id="test_client_id",
            client_secret="test_client_secret",
            connection_id=uuid.uuid4(),
        )

    @pytest.fixture
    def mock_connection(self):
        """Create a mock XeroConnection."""
        connection = MagicMock()
        connection.id = uuid.uuid4()
        connection.tenant_id = "test-tenant-123"
        connection.access_token = "encrypted_access_token"
        connection.refresh_token = "encrypted_refresh_token"
        connection.expires_at = datetime.now(UTC) + timedelta(hours=1)
        connection.is_active = True
        return connection

    def test_is_token_expired_with_no_expiry(self, token_manager):
        """Test that token is considered expired when no expiry is set."""
        assert token_manager.is_token_expired() is True

    def test_is_token_expired_within_buffer(self, token_manager):
        """Test that token is considered expired within buffer period."""
        # Token expires in 3 minutes (less than 5-minute buffer)
        token_manager._expires_at = datetime.now(UTC) + timedelta(minutes=3)
        assert token_manager.is_token_expired() is True

    def test_is_token_not_expired_outside_buffer(self, token_manager):
        """Test that token is not expired when outside buffer period."""
        # Token expires in 10 minutes (more than 5-minute buffer)
        token_manager._expires_at = datetime.now(UTC) + timedelta(minutes=10)
        assert token_manager.is_token_expired() is False

    def test_is_token_expired_custom_buffer(self, token_manager):
        """Test token expiry with custom buffer."""
        token_manager._expires_at = datetime.now(UTC) + timedelta(minutes=8)

        # With default 5-minute buffer, should not be expired
        assert token_manager.is_token_expired(buffer_minutes=5) is False

        # With 10-minute buffer, should be expired
        assert token_manager.is_token_expired(buffer_minutes=10) is True

    @patch("src.integrations.xero.token_manager.get_encryption_service")
    def test_load_from_connection(self, mock_encryption, token_manager, mock_connection):
        """Test loading tokens from connection."""
        mock_service = MagicMock()
        mock_service.decrypt.side_effect = ["decrypted_access", "decrypted_refresh"]
        mock_encryption.return_value = mock_service

        token_manager.load_from_connection(mock_connection)

        assert token_manager._access_token == "decrypted_access"
        assert token_manager._refresh_token == "decrypted_refresh"
        assert token_manager._tenant_id == "test-tenant-123"
        assert token_manager.connection_id == mock_connection.id

    @patch("src.integrations.xero.token_manager.get_encryption_service")
    def test_load_from_connection_decrypt_failure(
        self, mock_encryption, token_manager, mock_connection
    ):
        """Test that decryption failure raises TokenRefreshError."""
        mock_service = MagicMock()
        mock_service.decrypt.side_effect = ValueError("Decryption failed")
        mock_encryption.return_value = mock_service

        with pytest.raises(TokenRefreshError) as exc_info:
            token_manager.load_from_connection(mock_connection)

        assert "Failed to decrypt tokens" in str(exc_info.value)
        assert exc_info.value.is_recoverable is False

    @pytest.mark.asyncio
    async def test_ensure_valid_token_raises_when_no_tokens(self, token_manager):
        """Test that ensure_valid_token raises when no tokens loaded."""
        db = AsyncMock()

        with pytest.raises(TokenRefreshError) as exc_info:
            await token_manager.ensure_valid_token(db)

        assert "No tokens loaded" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_ensure_valid_token_returns_when_valid(self, token_manager):
        """Test that ensure_valid_token returns token when not expired."""
        db = AsyncMock()
        token_manager._access_token = "valid_token"
        token_manager._refresh_token = "valid_refresh"
        token_manager._expires_at = datetime.now(UTC) + timedelta(hours=1)

        result = await token_manager.ensure_valid_token(db)

        assert result == "valid_token"

    @pytest.mark.asyncio
    @patch("src.integrations.xero.token_manager.get_encryption_service")
    async def test_refresh_access_token_success(self, mock_encryption, token_manager):
        """Test successful token refresh."""
        mock_service = MagicMock()
        mock_service.encrypt.side_effect = ["new_encrypted_access", "new_encrypted_refresh"]
        mock_encryption.return_value = mock_service

        token_manager._refresh_token = "valid_refresh_token"
        token_manager._tenant_id = "test-tenant"

        # Mock HTTP response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "expires_in": 1800,  # 30 minutes
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        token_manager._http_client = mock_client

        # Mock database
        db = AsyncMock()
        mock_connection = MagicMock()
        db.execute.return_value.scalar_one_or_none.return_value = mock_connection

        await token_manager._refresh_access_token(db)

        assert token_manager._access_token == "new_access_token"
        assert token_manager._refresh_token == "new_refresh_token"
        assert token_manager._expires_at is not None

    @pytest.mark.asyncio
    async def test_refresh_access_token_invalid_refresh_token(self, token_manager):
        """Test that invalid refresh token marks connection inactive."""
        token_manager._refresh_token = "invalid_refresh_token"
        token_manager._tenant_id = "test-tenant"
        token_manager.connection_id = uuid.uuid4()

        # Mock 400 response (invalid refresh token)
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.content = b'{"error": "invalid_grant"}'
        mock_response.json.return_value = {
            "error": "invalid_grant",
            "error_description": "The refresh token is invalid",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        token_manager._http_client = mock_client

        # Mock database with proper async mock chain
        db = AsyncMock()
        mock_connection = MagicMock()
        mock_connection.is_active = True  # Initial state

        # Create a mock result that returns our connection
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_connection
        db.execute.return_value = mock_result

        with pytest.raises(TokenRefreshError) as exc_info:
            await token_manager._refresh_access_token(db)

        assert "Refresh token invalid" in str(exc_info.value)
        assert exc_info.value.is_recoverable is False

        # Verify connection was marked inactive
        assert mock_connection.is_active is False

    @pytest.mark.asyncio
    async def test_refresh_access_token_retries_on_server_error(self, token_manager):
        """Test that server errors trigger retries."""
        token_manager._refresh_token = "valid_refresh_token"
        token_manager._tenant_id = "test-tenant"

        # Mock 500 response followed by success
        mock_response_500 = MagicMock()
        mock_response_500.status_code = 500
        mock_response_500.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server error", request=MagicMock(), response=mock_response_500
        )

        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {
            "access_token": "new_access_token",
            "expires_in": 1800,
        }

        mock_client = AsyncMock()
        mock_client.post.side_effect = [mock_response_500, mock_response_200]
        token_manager._http_client = mock_client

        # Mock database
        db = AsyncMock()
        mock_connection = MagicMock()
        db.execute.return_value.scalar_one_or_none.return_value = mock_connection

        # Should succeed after retry
        with patch("src.integrations.xero.token_manager.get_encryption_service"):
            await token_manager._refresh_access_token(db, retries=2)

        assert token_manager._access_token == "new_access_token"
        assert mock_client.post.call_count == 2


class TestXeroClientWithAutoRefresh:
    """Tests for XeroClientWithAutoRefresh class."""

    @pytest.fixture
    def mock_token_manager(self):
        """Create a mock token manager."""
        manager = MagicMock(spec=XeroTokenManager)
        manager.tenant_id = "test-tenant-123"
        manager.ensure_valid_token = AsyncMock(return_value="valid_access_token")
        manager._refresh_access_token = AsyncMock()
        return manager

    @pytest.mark.asyncio
    async def test_context_manager(self, mock_token_manager):
        """Test async context manager creates and closes client."""
        db = AsyncMock()

        async with XeroClientWithAutoRefresh(mock_token_manager, db) as client:
            assert client._http_client is not None

        assert client._http_client is None

    @pytest.mark.asyncio
    async def test_get_headers_calls_ensure_valid_token(self, mock_token_manager):
        """Test that _get_headers ensures token is valid."""
        db = AsyncMock()
        client = XeroClientWithAutoRefresh(mock_token_manager, db)

        headers = await client._get_headers()

        mock_token_manager.ensure_valid_token.assert_called_once_with(db)
        assert headers["Authorization"] == "Bearer valid_access_token"
        assert headers["Xero-tenant-id"] == "test-tenant-123"

    @pytest.mark.asyncio
    async def test_make_request_retries_on_401(self, mock_token_manager):
        """Test that 401 response triggers token refresh and retry."""
        db = AsyncMock()

        async with XeroClientWithAutoRefresh(mock_token_manager, db) as client:
            # Mock HTTP responses: first 401, then success
            mock_response_401 = MagicMock()
            mock_response_401.status_code = 401

            mock_response_200 = MagicMock()
            mock_response_200.status_code = 200
            mock_response_200.json.return_value = {"Organisations": [{"Name": "Test Org"}]}
            mock_response_200.raise_for_status = MagicMock()

            client._http_client.request = AsyncMock(
                side_effect=[mock_response_401, mock_response_200]
            )

            result = await client._make_request("GET", "/Organisation")

            # Verify token refresh was called
            mock_token_manager._refresh_access_token.assert_called_once_with(db)

            # Verify request was retried
            assert client._http_client.request.call_count == 2
            assert result == {"Organisations": [{"Name": "Test Org"}]}

    @pytest.mark.asyncio
    async def test_get_organisation(self, mock_token_manager):
        """Test get_organisation method."""
        db = AsyncMock()

        async with XeroClientWithAutoRefresh(mock_token_manager, db) as client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "Organisations": [{"Name": "Test Company", "OrganisationID": "123"}]
            }
            mock_response.raise_for_status = MagicMock()

            client._http_client.request = AsyncMock(return_value=mock_response)

            result = await client.get_organisation()

            assert result["Name"] == "Test Company"
            assert result["OrganisationID"] == "123"

    @pytest.mark.asyncio
    async def test_create_contact(self, mock_token_manager):
        """Test create_contact method."""
        db = AsyncMock()

        async with XeroClientWithAutoRefresh(mock_token_manager, db) as client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "Contacts": [{"ContactID": "contact-123", "Name": "Test Contact"}]
            }
            mock_response.raise_for_status = MagicMock()

            client._http_client.request = AsyncMock(return_value=mock_response)

            result = await client.create_contact(
                name="Test Contact",
                email="test@example.com",
                phone="1234567890",
            )

            assert result["ContactID"] == "contact-123"
            assert result["Name"] == "Test Contact"

    @pytest.mark.asyncio
    async def test_create_invoice(self, mock_token_manager):
        """Test create_invoice method."""
        db = AsyncMock()

        async with XeroClientWithAutoRefresh(mock_token_manager, db) as client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "Invoices": [{"InvoiceID": "inv-123", "InvoiceNumber": "INV-001", "Total": 100.00}]
            }
            mock_response.raise_for_status = MagicMock()

            client._http_client.request = AsyncMock(return_value=mock_response)

            result = await client.create_invoice(
                contact_id="contact-123",
                invoice_number="INV-001",
                line_items=[{"description": "Test Item", "quantity": 1, "unit_amount": 100.00}],
            )

            assert result["InvoiceID"] == "inv-123"
            assert result["Total"] == 100.00


class TestTokenRefreshError:
    """Tests for TokenRefreshError exception."""

    def test_recoverable_error(self):
        """Test recoverable error."""
        error = TokenRefreshError("Network timeout", is_recoverable=True)

        assert error.message == "Network timeout"
        assert error.is_recoverable is True
        assert str(error) == "Network timeout"

    def test_non_recoverable_error(self):
        """Test non-recoverable error."""
        error = TokenRefreshError("Invalid refresh token", is_recoverable=False)

        assert error.message == "Invalid refresh token"
        assert error.is_recoverable is False


class TestConstants:
    """Tests for module constants."""

    def test_token_refresh_buffer(self):
        """Test that token refresh buffer is set correctly."""
        assert TOKEN_REFRESH_BUFFER_MINUTES == 5

    def test_max_refresh_retries(self):
        """Test that max retries is set correctly."""
        assert MAX_REFRESH_RETRIES == 2
