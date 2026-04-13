"""Tests for encryption utilities."""


import pytest

from src.security.encryption import EncryptionService


class TestEncryptionService:
    """Test encryption service functionality."""

    def test_generate_key(self):
        """Test key generation."""
        key = EncryptionService.generate_key()

        assert isinstance(key, str)
        assert len(key) > 0

        # Key should be valid for creating service
        service = EncryptionService(key)
        assert service is not None

    def test_encrypt_decrypt_string(self):
        """Test basic string encryption and decryption."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        plaintext = "secret_token_12345"

        # Encrypt
        encrypted = service.encrypt(plaintext)
        assert encrypted != plaintext
        assert len(encrypted) > 0

        # Decrypt
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_empty_string_raises_error(self):
        """Test that encrypting empty string raises ValueError."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        with pytest.raises(ValueError, match="Cannot encrypt empty string"):
            service.encrypt("")

    def test_decrypt_with_wrong_key_raises_error(self):
        """Test that decrypting with wrong key raises ValueError."""
        key1 = EncryptionService.generate_key()
        key2 = EncryptionService.generate_key()

        service1 = EncryptionService(key1)
        service2 = EncryptionService(key2)

        plaintext = "secret_token"
        encrypted = service1.encrypt(plaintext)

        with pytest.raises(ValueError, match="Decryption failed"):
            service2.decrypt(encrypted)

    def test_decrypt_invalid_token_raises_error(self):
        """Test that decrypting invalid token raises ValueError."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        with pytest.raises(ValueError, match="Decryption failed"):
            service.decrypt("not_a_valid_encrypted_string")

    def test_encrypt_decrypt_dict(self):
        """Test encrypting specific fields in dictionary."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        data = {
            "name": "Test User",
            "access_token": "secret_access_123",
            "refresh_token": "secret_refresh_456",
        }

        # Encrypt specific fields
        encrypted_data = service.encrypt_dict(data, ["access_token", "refresh_token"])

        assert encrypted_data["name"] == "Test User"  # Not encrypted
        assert encrypted_data["access_token"] != "secret_access_123"  # Encrypted
        assert encrypted_data["refresh_token"] != "secret_refresh_456"  # Encrypted

        # Decrypt
        decrypted_data = service.decrypt_dict(encrypted_data, ["access_token", "refresh_token"])

        assert decrypted_data["name"] == "Test User"
        assert decrypted_data["access_token"] == "secret_access_123"
        assert decrypted_data["refresh_token"] == "secret_refresh_456"

    def test_encrypt_dict_with_none_values(self):
        """Test encrypting dict with None values (should skip them)."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        data = {
            "name": "Test User",
            "access_token": "secret_123",
            "refresh_token": None,
        }

        encrypted_data = service.encrypt_dict(data, ["access_token", "refresh_token"])

        assert encrypted_data["access_token"] != "secret_123"
        assert encrypted_data["refresh_token"] is None  # Should remain None

    def test_service_uses_environment_variable(self, monkeypatch):
        """Test that service reads ENCRYPTION_KEY from environment."""
        key = EncryptionService.generate_key()
        monkeypatch.setenv("ENCRYPTION_KEY", key)

        service = EncryptionService()  # No key parameter
        plaintext = "test_secret"

        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)

        assert decrypted == plaintext

    def test_service_raises_error_without_key(self, monkeypatch):
        """Test that service raises error if no key provided."""
        monkeypatch.delenv("ENCRYPTION_KEY", raising=False)

        with pytest.raises(ValueError, match="Encryption key not provided"):
            EncryptionService()

    def test_long_string_encryption(self):
        """Test encrypting long strings."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        # Long token (simulate real OAuth tokens)
        plaintext = "a" * 1000

        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)

        assert decrypted == plaintext

    def test_special_characters_encryption(self):
        """Test encrypting strings with special characters."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        plaintext = "token_with_special_chars!@#$%^&*()[]{}|\\:;\"'<>,.?/~`"

        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)

        assert decrypted == plaintext

    def test_unicode_encryption(self):
        """Test encrypting Unicode strings."""
        key = EncryptionService.generate_key()
        service = EncryptionService(key)

        plaintext = "token_with_unicode_字符_🔐"

        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)

        assert decrypted == plaintext
