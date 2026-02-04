"""
AWS Secrets Manager Integration

Provides secure secret management for production environment.
Secrets are stored in AWS Secrets Manager and retrieved at runtime.

For local development, secrets are loaded from environment variables.
"""

import json
import os
from functools import lru_cache
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class SecretsManager:
    """
    Secrets Manager for production secret retrieval.

    Supports AWS Secrets Manager (production) and environment variables (development).
    """

    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.use_aws = self.environment == "production"

        if self.use_aws:
            try:
                import boto3
                from botocore.exceptions import ClientError

                self.client = boto3.client("secretsmanager")
                self.ClientError = ClientError
                logger.info("AWS Secrets Manager client initialized")
            except ImportError:
                logger.warning(
                    "boto3 not installed - falling back to environment variables. "
                    "Install with: pip install boto3"
                )
                self.use_aws = False
        else:
            logger.info(
                "Using environment variables for secrets (development mode)",
                environment=self.environment,
            )

    def get_secret(self, secret_name: str, default: str | None = None) -> str:
        """
        Get a secret value from AWS Secrets Manager or environment variables.

        Args:
            secret_name: Name of the secret (e.g., "ccw-erp/jwt-secret")
            default: Default value if secret not found (development only)

        Returns:
            Secret value as string

        Raises:
            ValueError: If secret not found and no default provided
        """
        if self.use_aws:
            return self._get_from_aws(secret_name)
        else:
            return self._get_from_env(secret_name, default)

    def _get_from_aws(self, secret_name: str) -> str:
        """Get secret from AWS Secrets Manager."""
        try:
            response = self.client.get_secret_value(SecretId=secret_name)

            # Secrets can be stored as string or JSON
            if "SecretString" in response:
                secret_string = response["SecretString"]
                try:
                    # Try parsing as JSON (for secrets with multiple keys)
                    secret_dict = json.loads(secret_string)
                    # If secret_name has a slash, assume last part is the key
                    if "/" in secret_name:
                        key = secret_name.split("/")[-1]
                        if key in secret_dict:
                            return secret_dict[key]
                    # Otherwise return the whole secret
                    return secret_string
                except json.JSONDecodeError:
                    # Not JSON, return as-is
                    return secret_string
            else:
                raise ValueError(f"Secret {secret_name} has no SecretString")

        except self.ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "ResourceNotFoundException":
                logger.error(
                    "Secret not found in AWS Secrets Manager",
                    secret_name=secret_name,
                )
                raise ValueError(f"Secret {secret_name} not found")
            elif error_code == "InvalidRequestException":
                logger.error("Invalid request to AWS Secrets Manager", error=str(e))
                raise ValueError(f"Invalid request for secret {secret_name}")
            elif error_code == "InvalidParameterException":
                logger.error("Invalid parameter for AWS Secrets Manager", error=str(e))
                raise ValueError(f"Invalid parameter for secret {secret_name}")
            else:
                logger.error(
                    "Error retrieving secret from AWS", secret_name=secret_name, error=str(e)
                )
                raise

    def _get_from_env(self, secret_name: str, default: str | None = None) -> str:
        """Get secret from environment variable (development mode)."""
        # Convert secret name to environment variable name
        # e.g., "ccw-erp/jwt-secret" -> "JWT_SECRET"
        env_var_name = secret_name.split("/")[-1].upper().replace("-", "_")

        value = os.getenv(env_var_name, default)

        if value is None:
            raise ValueError(
                f"Secret {secret_name} not found in environment variables "
                f"(expected env var: {env_var_name})"
            )

        return value

    def get_database_url(self) -> str:
        """Get database URL (convenience method)."""
        return self.get_secret(
            "ccw-erp/database-url",
            default=os.getenv(
                "DATABASE_URL",
                "postgresql://starter_user:local_dev_password@localhost:5432/starter_db",
            ),
        )

    def get_jwt_secret(self) -> str:
        """Get JWT secret key (convenience method)."""
        return self.get_secret(
            "ccw-erp/jwt-secret",
            default=os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production"),
        )

    def get_webhook_secret(self) -> str:
        """Get webhook signature verification secret (convenience method)."""
        return self.get_secret(
            "ccw-erp/webhook-secret",
            default=os.getenv("WEBHOOK_SECRET", "change-this-webhook-secret-in-production"),
        )

    def get_encryption_key(self) -> str:
        """Get database encryption key for sensitive fields (convenience method)."""
        return self.get_secret(
            "ccw-erp/encryption-key",
            default=os.getenv("DATABASE_ENCRYPTION_KEY", ""),
        )


@lru_cache
def get_secrets_manager() -> SecretsManager:
    """Get cached SecretsManager instance."""
    return SecretsManager()


# Convenience functions for common secrets
def get_jwt_secret() -> str:
    """Get JWT secret key."""
    return get_secrets_manager().get_jwt_secret()


def get_webhook_secret() -> str:
    """Get webhook secret."""
    return get_secrets_manager().get_webhook_secret()


def get_encryption_key() -> str:
    """Get database encryption key."""
    return get_secrets_manager().get_encryption_key()


def get_database_url() -> str:
    """Get database URL."""
    return get_secrets_manager().get_database_url()
