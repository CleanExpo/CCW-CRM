"""AWS Secrets Manager integration.

Provides optional integration with AWS Secrets Manager for secure secret storage.
Falls back to environment variables if not configured.
"""

import json
import os
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# Lazy import boto3 (only if AWS Secrets Manager is used)
try:
    import boto3
    from botocore.exceptions import ClientError

    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.warning(
        "boto3 not installed - AWS Secrets Manager integration disabled. "
        "Install with: pip install boto3"
    )


class SecretsManager:
    """AWS Secrets Manager client."""

    def __init__(self, region: str = "us-east-1"):
        """Initialize Secrets Manager client.

        Args:
            region: AWS region (default: us-east-1)

        Raises:
            ImportError: If boto3 not installed
        """
        if not BOTO3_AVAILABLE:
            raise ImportError(
                "boto3 is required for AWS Secrets Manager integration. "
                "Install with: pip install boto3"
            )

        self.region = region
        self.client = boto3.client("secretsmanager", region_name=region)
        self._cache: dict[str, Any] = {}

    def get_secret(self, secret_name: str, use_cache: bool = True) -> dict[str, Any]:
        """Get secret from AWS Secrets Manager.

        Args:
            secret_name: Name of the secret
            use_cache: Whether to use cached value (default: True)

        Returns:
            Dictionary of secret key-value pairs

        Raises:
            ValueError: If secret retrieval fails
        """
        if use_cache and secret_name in self._cache:
            logger.debug("Using cached secret", secret_name=secret_name)
            return self._cache[secret_name]

        try:
            response = self.client.get_secret_value(SecretId=secret_name)

            if "SecretString" in response:
                secret_data = json.loads(response["SecretString"])
            else:
                # Binary secret (not typically used)
                raise ValueError("Binary secrets not supported")

            self._cache[secret_name] = secret_data

            logger.info("Secret retrieved from AWS Secrets Manager", secret_name=secret_name)

            return secret_data

        except ClientError as e:
            error_code = e.response["Error"]["Code"]

            if error_code == "ResourceNotFoundException":
                logger.error("Secret not found", secret_name=secret_name)
                raise ValueError(f"Secret {secret_name} not found in AWS Secrets Manager")

            elif error_code == "InvalidRequestException":
                logger.error("Invalid request", secret_name=secret_name)
                raise ValueError(f"Invalid request for secret {secret_name}")

            elif error_code == "InvalidParameterException":
                logger.error("Invalid parameter", secret_name=secret_name)
                raise ValueError(f"Invalid parameter for secret {secret_name}")

            elif error_code == "DecryptionFailure":
                logger.error("Decryption failed", secret_name=secret_name)
                raise ValueError(f"Failed to decrypt secret {secret_name}")

            elif error_code == "InternalServiceError":
                logger.error("AWS internal error", secret_name=secret_name)
                raise ValueError(f"AWS internal error retrieving secret {secret_name}")

            else:
                logger.error("Unexpected AWS error", error_code=error_code, secret_name=secret_name)
                raise

    def update_secret(self, secret_name: str, secret_data: dict[str, Any]) -> None:
        """Update secret in AWS Secrets Manager.

        Args:
            secret_name: Name of the secret
            secret_data: Dictionary of secret key-value pairs

        Raises:
            ValueError: If update fails
        """
        try:
            self.client.put_secret_value(
                SecretId=secret_name,
                SecretString=json.dumps(secret_data),
            )

            # Invalidate cache
            if secret_name in self._cache:
                del self._cache[secret_name]

            logger.info("Secret updated in AWS Secrets Manager", secret_name=secret_name)

        except ClientError as e:
            logger.error("Failed to update secret", secret_name=secret_name, error=str(e))
            raise ValueError(f"Failed to update secret {secret_name}: {e}")


# Global instance
_secrets_manager: SecretsManager | None = None


def get_secrets_manager(region: str | None = None) -> SecretsManager:
    """Get or create Secrets Manager instance.

    Args:
        region: AWS region (default: from environment or us-east-1)

    Returns:
        SecretsManager instance

    Raises:
        ImportError: If boto3 not installed
    """
    global _secrets_manager

    if _secrets_manager is None:
        region = region or os.getenv("AWS_REGION", "us-east-1")
        _secrets_manager = SecretsManager(region=region)

    return _secrets_manager


def load_secrets_from_aws(secret_name: str) -> dict[str, Any]:
    """Load secrets from AWS Secrets Manager and set as environment variables.

    Args:
        secret_name: Name of the secret in AWS Secrets Manager

    Returns:
        Dictionary of secrets

    Raises:
        ImportError: If boto3 not installed
        ValueError: If secret retrieval fails
    """
    if not BOTO3_AVAILABLE:
        raise ImportError(
            "boto3 is required for AWS Secrets Manager integration. "
            "Install with: pip install boto3"
        )

    manager = get_secrets_manager()
    secrets = manager.get_secret(secret_name)

    # Set as environment variables (for compatibility with existing code)
    for key, value in secrets.items():
        os.environ[key] = str(value)

    logger.info(
        "Secrets loaded from AWS Secrets Manager and set as environment variables",
        count=len(secrets),
    )

    return secrets
