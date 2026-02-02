"""
Xero webhook signature verification and security.

Implements HMAC-SHA256 signature verification for Xero webhooks as per:
https://developer.xero.com/documentation/webhooks/overview
"""

import base64
import hashlib
import hmac
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class XeroWebhookVerifier:
    """Verifies Xero webhook signatures.

    Xero uses HMAC-SHA256 for webhook signature verification.
    The signature is sent in the X-Xero-Signature header as base64.
    """

    def __init__(self, webhook_key: str):
        """Initialize verifier with Xero webhook key.

        Args:
            webhook_key: Webhook key from Xero app configuration
        """
        self.webhook_key = webhook_key.encode() if isinstance(webhook_key, str) else webhook_key

    def compute_signature(self, payload: bytes) -> str:
        """Compute HMAC-SHA256 signature for payload.

        Args:
            payload: Raw request body bytes

        Returns:
            Base64-encoded signature
        """
        signature = hmac.new(self.webhook_key, payload, hashlib.sha256)
        return base64.b64encode(signature.digest()).decode()

    def verify_signature(self, payload: bytes, received_signature: str) -> bool:
        """Verify Xero webhook signature.

        Args:
            payload: Raw request body bytes
            received_signature: Signature from X-Xero-Signature header

        Returns:
            True if signature valid
        """
        # Compute expected signature
        expected_signature = self.compute_signature(payload)

        # Constant-time comparison to prevent timing attacks
        is_valid = hmac.compare_digest(expected_signature, received_signature)

        if not is_valid:
            logger.warning(
                "Invalid Xero webhook signature",
                expected=expected_signature[:10] + "...",
                received=received_signature[:10] + "...",
            )
        else:
            logger.debug("Xero webhook signature verified successfully")

        return is_valid

    def verify_intent(self, payload: bytes, intent_to_receive: str) -> bool:
        """Verify Xero webhook intent-to-receive challenge.

        When setting up webhooks, Xero sends an intent-to-receive challenge
        that must be echoed back with proper signature.

        Args:
            payload: Raw request body bytes
            intent_to_receive: Intent UUID from webhook payload

        Returns:
            True if intent matches payload
        """
        try:
            payload_str = payload.decode("utf-8")
            return intent_to_receive in payload_str
        except Exception as e:
            logger.error("Failed to verify intent", error=str(e))
            return False


# Replay attack protection - simple in-memory cache
# In production, use Redis or database
_processed_webhook_ids: set[str] = set()
_max_cache_size = 10000


def is_webhook_duplicate(event_id: str) -> bool:
    """Check if webhook has already been processed.

    Args:
        event_id: Unique event ID from Xero webhook

    Returns:
        True if webhook already processed (duplicate/replay)
    """
    global _processed_webhook_ids

    if event_id in _processed_webhook_ids:
        logger.warning("Duplicate webhook detected", event_id=event_id)
        return True

    # Add to cache (with size limit to prevent memory issues)
    _processed_webhook_ids.add(event_id)

    if len(_processed_webhook_ids) > _max_cache_size:
        # Remove oldest entries (simple FIFO)
        to_remove = len(_processed_webhook_ids) - _max_cache_size // 2
        for _ in range(to_remove):
            _processed_webhook_ids.pop()

    return False


def clear_webhook_cache():
    """Clear webhook duplicate detection cache.

    Useful for testing or manual cache management.
    """
    global _processed_webhook_ids
    _processed_webhook_ids.clear()
    logger.info("Webhook cache cleared")


# Global verifier instance
_xero_verifier: XeroWebhookVerifier | None = None


def get_xero_webhook_verifier() -> XeroWebhookVerifier:
    """Get Xero webhook verifier instance.

    Returns:
        XeroWebhookVerifier instance

    Raises:
        ValueError: If XERO_WEBHOOK_KEY not set
    """
    global _xero_verifier

    if _xero_verifier is None:
        import os

        webhook_key = os.getenv("XERO_WEBHOOK_KEY")
        if not webhook_key:
            raise ValueError("XERO_WEBHOOK_KEY environment variable not set")

        _xero_verifier = XeroWebhookVerifier(webhook_key)

    return _xero_verifier
