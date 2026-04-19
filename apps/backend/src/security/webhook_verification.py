"""
Webhook signature verification utilities.

Implements HMAC-SHA256 signature verification for incoming webhooks from:
- FedEx (AU)
- AusPost
- StarTrack
- TNT
- Other AU/NZ carriers

This prevents webhook spoofing and replay attacks.
"""

import hashlib
import hmac
import time

import structlog

logger = structlog.get_logger(__name__)


class WebhookVerifier:
    """Verify webhook signatures using HMAC-SHA256."""

    def __init__(self, secret: str):
        """Initialize verifier with webhook secret.

        Args:
            secret: Webhook secret key (shared with webhook provider)
        """
        self.secret = secret.encode() if isinstance(secret, str) else secret

    def compute_signature(self, payload: bytes) -> str:
        """Compute HMAC-SHA256 signature for payload.

        Args:
            payload: Raw request body bytes

        Returns:
            Hex-encoded signature
        """
        signature = hmac.new(self.secret, payload, hashlib.sha256)
        return signature.hexdigest()

    def verify_signature(
        self,
        payload: bytes,
        received_signature: str,
        timestamp: int | None = None,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Verify webhook signature.

        Args:
            payload: Raw request body bytes
            received_signature: Signature from webhook header
            timestamp: Unix timestamp from webhook (for replay protection)
            tolerance_seconds: Maximum age of webhook (default: 5 minutes)

        Returns:
            True if signature valid and not expired
        """
        # Verify timestamp (replay attack protection)
        if timestamp is not None:
            current_time = int(time.time())
            age = current_time - timestamp

            if age > tolerance_seconds:
                logger.warning(
                    "Webhook timestamp expired",
                    age_seconds=age,
                    tolerance=tolerance_seconds,
                )
                return False

            if age < -tolerance_seconds:
                logger.warning(
                    "Webhook timestamp in future",
                    age_seconds=age,
                )
                return False

        # Compute expected signature
        expected_signature = self.compute_signature(payload)

        # Constant-time comparison to prevent timing attacks
        is_valid = hmac.compare_digest(expected_signature, received_signature.lower())

        if not is_valid:
            logger.warning(
                "Invalid webhook signature",
                expected=expected_signature[:10] + "...",
                received=received_signature[:10] + "...",
            )

        return is_valid


class FedExWebhookVerifier(WebhookVerifier):
    """FedEx-specific webhook verifier.

    FedEx sends signature in 'X-FedEx-Signature' header.
    Format: HMAC-SHA256 hex string
    """

    def verify_request(
        self,
        payload: bytes,
        signature_header: str | None,
        timestamp_header: str | None = None,
    ) -> bool:
        """Verify FedEx webhook request.

        Args:
            payload: Raw request body
            signature_header: Value of 'X-FedEx-Signature' header
            timestamp_header: Value of 'X-FedEx-Timestamp' header (optional)

        Returns:
            True if signature valid
        """
        if not signature_header:
            logger.error("Missing FedEx signature header")
            return False

        timestamp = int(timestamp_header) if timestamp_header else None

        return self.verify_signature(payload, signature_header, timestamp)


# Global verifier instances (initialized from environment)
_fedex_verifier: FedExWebhookVerifier | None = None


def get_fedex_verifier() -> FedExWebhookVerifier:
    """Get FedEx webhook verifier instance.

    Returns:
        FedExWebhookVerifier instance

    Raises:
        ValueError: If FEDEX_WEBHOOK_SECRET not set
    """
    global _fedex_verifier

    if _fedex_verifier is None:
        import os

        secret = os.getenv("FEDEX_WEBHOOK_SECRET")
        if not secret:
            raise ValueError("FEDEX_WEBHOOK_SECRET environment variable not set")

        _fedex_verifier = FedExWebhookVerifier(secret)

    return _fedex_verifier


