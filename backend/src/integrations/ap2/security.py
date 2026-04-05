"""
Google Agent Payments Protocol (AP2) webhook security.

Implements signature verification for Google AP2 webhooks using
Google's public key verification method.
"""

import base64
import hashlib
import hmac
import json
import time
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class AP2SignatureVerifier:
    """Verifies Google AP2 webhook signatures.

    Google AP2 uses HMAC-SHA256 for webhook signature verification.
    The signature is sent in the X-Google-Signature header.
    """

    def __init__(self, webhook_secret: str):
        """Initialize verifier with webhook secret.

        Args:
            webhook_secret: Shared secret from Google AP2 configuration
        """
        self.webhook_secret = webhook_secret.encode() if isinstance(webhook_secret, str) else webhook_secret

    def compute_signature(self, payload: bytes, timestamp: str) -> str:
        """Compute HMAC-SHA256 signature for payload.

        Args:
            payload: Raw request body bytes
            timestamp: Timestamp string from X-Google-Timestamp header

        Returns:
            Base64-encoded signature
        """
        # Construct signed payload: timestamp + . + payload
        signed_content = f"{timestamp}.".encode() + payload

        signature = hmac.new(self.webhook_secret, signed_content, hashlib.sha256)

        return base64.b64encode(signature.digest()).decode()

    def verify_signature(
        self,
        payload: bytes,
        received_signature: str,
        timestamp: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Verify Google AP2 webhook signature.

        Args:
            payload: Raw request body bytes
            received_signature: Signature from X-Google-Signature header
            timestamp: Timestamp from X-Google-Timestamp header
            tolerance_seconds: Maximum webhook age (default: 5 minutes)

        Returns:
            True if signature valid and not expired
        """
        # Verify timestamp (replay attack protection)
        try:
            webhook_time = int(timestamp)
        except (ValueError, TypeError):
            logger.warning("Invalid timestamp format", timestamp=timestamp)
            return False

        current_time = int(time.time())
        age = current_time - webhook_time

        if age > tolerance_seconds:
            logger.warning(
                "AP2 webhook timestamp expired",
                age_seconds=age,
                tolerance=tolerance_seconds,
            )
            return False

        if age < -tolerance_seconds:
            logger.warning(
                "AP2 webhook timestamp in future",
                age_seconds=age,
            )
            return False

        # Compute expected signature
        expected_signature = self.compute_signature(payload, timestamp)

        # Constant-time comparison to prevent timing attacks
        is_valid = hmac.compare_digest(expected_signature, received_signature)

        if not is_valid:
            logger.warning(
                "Invalid AP2 webhook signature",
                expected=expected_signature[:10] + "...",
                received=received_signature[:10] + "...",
            )
        else:
            logger.debug("AP2 webhook signature verified successfully")

        return is_valid

    def verify_mandate_signature(
        self,
        mandate_id: str,
        signature: str,
        public_key: str,
        mandate_data: dict[str, Any],
    ) -> bool:
        """Verify AP2 mandate signature using public key.

        Args:
            mandate_id: Mandate UUID
            signature: Mandate signature to verify
            public_key: Public key from mandate
            mandate_data: Mandate payload data

        Returns:
            True if signature valid

        Note:
            This is a simplified implementation. In production, use
            cryptography library for proper RSA signature verification.
        """
        # Serialize mandate data for verification
        mandate_json = json.dumps(mandate_data, sort_keys=True)

        # Compute HMAC signature (simplified - real AP2 uses RSA)
        expected_signature = hmac.new(
            public_key.encode(),
            mandate_json.encode(),
            hashlib.sha256,
        ).hexdigest()

        is_valid = hmac.compare_digest(expected_signature, signature)

        if not is_valid:
            logger.warning(
                "Invalid mandate signature",
                mandate_id=mandate_id,
            )

        return is_valid


# Global verifier instance
_ap2_verifier: AP2SignatureVerifier | None = None


def get_ap2_signature_verifier() -> AP2SignatureVerifier:
    """Get AP2 signature verifier instance.

    Returns:
        AP2SignatureVerifier instance

    Raises:
        ValueError: If AP2_WEBHOOK_SECRET not set
    """
    global _ap2_verifier

    if _ap2_verifier is None:
        import os

        secret = os.getenv("AP2_WEBHOOK_SECRET")
        if not secret:
            raise ValueError("AP2_WEBHOOK_SECRET environment variable not set")

        _ap2_verifier = AP2SignatureVerifier(secret)

    return _ap2_verifier
