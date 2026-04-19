"""
Encryption utilities for sensitive data.

Uses Fernet (symmetric encryption) with AES-256 for encrypting tokens,
API keys, and other sensitive data at rest.
"""

from typing import Any

import structlog
from cryptography.fernet import Fernet, InvalidToken
from src.config.settings import get_settings

logger = structlog.get_logger(__name__)


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self, encryption_key: str | None = None):
        """
        Initialize encryption service.

        Args:
            encryption_key: Base64-encoded Fernet key. If None, reads from environment.

        Raises:
            ValueError: If no encryption key provided and ENCRYPTION_KEY env var not set.
        """
        key = encryption_key or get_settings().encryption_key or None

        if not key:
            raise ValueError(
                "Encryption key not provided. Set ENCRYPTION_KEY environment variable "
                "or pass encryption_key parameter."
            )

        try:
            # Validate key format
            self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception as e:
            raise ValueError(f"Invalid encryption key format: {e}") from e

    @staticmethod
    def generate_key() -> str:
        """
        Generate a new Fernet encryption key.

        Returns:
            Base64-encoded encryption key as string.

        Example:
            >>> key = EncryptionService.generate_key()
            >>> print(key)
            'aBcD1234eFgH5678...'
        """
        return Fernet.generate_key().decode()

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.

        Args:
            plaintext: String to encrypt.

        Returns:
            Base64-encoded encrypted string.

        Raises:
            ValueError: If plaintext is empty or invalid.
        """
        if not plaintext:
            raise ValueError("Cannot encrypt empty string")

        try:
            encrypted_bytes = self._fernet.encrypt(plaintext.encode())
            return encrypted_bytes.decode()
        except Exception as e:
            logger.error("Encryption failed", error=str(e))
            raise ValueError(f"Encryption failed: {e}") from e

    def decrypt(self, encrypted_text: str) -> str:
        """
        Decrypt encrypted string.

        Args:
            encrypted_text: Base64-encoded encrypted string.

        Returns:
            Decrypted plaintext string.

        Raises:
            ValueError: If decryption fails (invalid token, wrong key, etc.).
        """
        if not encrypted_text:
            raise ValueError("Cannot decrypt empty string")

        try:
            decrypted_bytes = self._fernet.decrypt(encrypted_text.encode())
            return decrypted_bytes.decode()
        except InvalidToken:
            logger.error("Decryption failed: invalid token or wrong key")
            raise ValueError("Decryption failed: invalid token or wrong key")
        except Exception as e:
            logger.error("Decryption failed", error=str(e))
            raise ValueError(f"Decryption failed: {e}") from e

    def encrypt_dict(self, data: dict[str, Any], fields: list[str]) -> dict[str, Any]:
        """
        Encrypt specific fields in a dictionary.

        Args:
            data: Dictionary containing data.
            fields: List of field names to encrypt.

        Returns:
            Dictionary with specified fields encrypted.

        Example:
            >>> service = EncryptionService(key)
            >>> data = {"name": "John", "token": "secret123"}
            >>> encrypted = service.encrypt_dict(data, ["token"])
            >>> print(encrypted)
            {'name': 'John', 'token': 'gAAAAA...'}
        """
        result = data.copy()

        for field in fields:
            if field in result and result[field] is not None:
                try:
                    result[field] = self.encrypt(str(result[field]))
                except Exception as e:
                    logger.error(f"Failed to encrypt field {field}", error=str(e))
                    raise

        return result

    def decrypt_dict(self, data: dict[str, Any], fields: list[str]) -> dict[str, Any]:
        """
        Decrypt specific fields in a dictionary.

        Args:
            data: Dictionary containing encrypted data.
            fields: List of field names to decrypt.

        Returns:
            Dictionary with specified fields decrypted.

        Example:
            >>> service = EncryptionService(key)
            >>> encrypted = {"name": "John", "token": "gAAAAA..."}
            >>> decrypted = service.decrypt_dict(encrypted, ["token"])
            >>> print(decrypted)
            {'name': 'John', 'token': 'secret123'}
        """
        result = data.copy()

        for field in fields:
            if field in result and result[field] is not None:
                try:
                    result[field] = self.decrypt(str(result[field]))
                except Exception as e:
                    logger.error(f"Failed to decrypt field {field}", error=str(e))
                    raise

        return result


# Global encryption service instance (initialized on first import)
_encryption_service: EncryptionService | None = None


def get_encryption_service() -> EncryptionService:
    """
    Get or create global encryption service instance.

    Returns:
        EncryptionService instance.

    Raises:
        ValueError: If ENCRYPTION_KEY environment variable not set.
    """
    global _encryption_service

    if _encryption_service is None:
        _encryption_service = EncryptionService()

    return _encryption_service


def encrypt_string(plaintext: str) -> str:
    """
    Convenience function to encrypt a string.

    Args:
        plaintext: String to encrypt.

    Returns:
        Encrypted string.
    """
    service = get_encryption_service()
    return service.encrypt(plaintext)


def decrypt_string(encrypted_text: str) -> str:
    """
    Convenience function to decrypt a string.

    Args:
        encrypted_text: Encrypted string.

    Returns:
        Decrypted string.
    """
    service = get_encryption_service()
    return service.decrypt(encrypted_text)
