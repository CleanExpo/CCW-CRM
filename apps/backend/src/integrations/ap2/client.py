"""
AP2 Client Architecture.

Dual-mode client supporting demo (mock) and live (Google Cloud API) modes.
"""

import asyncio
import random
from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import httpx
import structlog

from src.config.ap2_settings import get_ap2_settings

logger = structlog.get_logger(__name__)


class BaseAP2Client(ABC):
    """Abstract base class for AP2 clients."""

    def __init__(self):
        self.settings = get_ap2_settings()
        logger.info("AP2 client initialized", mode=self.settings.mode)

    @abstractmethod
    async def create_intent_mandate(
        self,
        intent_description: str,
        language: str = "en",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create an intent mandate (first step in payment flow).

        Args:
            intent_description: Natural language description of purchase intent
            language: Language code
            metadata: Additional metadata

        Returns:
            Mandate data including mandate_id and signature
        """
        pass

    @abstractmethod
    async def create_cart_mandate(
        self,
        parent_mandate_id: str,
        cart_items: list[dict[str, Any]],
        total_amount: float,
        currency: str = "AUD",
    ) -> dict[str, Any]:
        """
        Create a cart mandate (second step - items selected).

        Args:
            parent_mandate_id: Intent mandate ID
            cart_items: List of cart items
            total_amount: Total cart amount
            currency: Currency code

        Returns:
            Cart mandate data
        """
        pass

    @abstractmethod
    async def create_payment_mandate(
        self,
        parent_mandate_id: str,
        payment_amount: float,
        payment_method: str,
        currency: str = "AUD",
    ) -> dict[str, Any]:
        """
        Create a payment mandate (final step - ready to pay).

        Args:
            parent_mandate_id: Cart mandate ID
            payment_amount: Payment amount
            payment_method: Payment method identifier
            currency: Currency code

        Returns:
            Payment mandate data
        """
        pass

    @abstractmethod
    async def verify_mandate_signature(
        self,
        mandate_id: str,
        signature: str,
        public_key: str,
    ) -> bool:
        """
        Verify mandate cryptographic signature.

        Args:
            mandate_id: Mandate ID
            signature: Signature to verify
            public_key: Public key for verification

        Returns:
            True if signature valid, False otherwise
        """
        pass

    @abstractmethod
    async def execute_payment(
        self,
        mandate_id: str,
        order_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Execute payment using payment mandate.

        Args:
            mandate_id: Payment mandate ID
            order_id: Optional order ID reference

        Returns:
            Transaction data
        """
        pass

    @abstractmethod
    async def get_transaction_status(
        self,
        transaction_id: str,
    ) -> dict[str, Any]:
        """
        Get transaction status.

        Args:
            transaction_id: Transaction ID

        Returns:
            Transaction status data
        """
        pass

    @abstractmethod
    async def process_voice_input(
        self,
        session_id: str,
        voice_text: str,
        language: str = "en",
    ) -> dict[str, Any]:
        """
        Process voice input for voice commerce.

        Args:
            session_id: Voice session ID
            voice_text: Transcribed voice text
            language: Language code

        Returns:
            Response with intent, entities, next action
        """
        pass


class AP2DemoClient(BaseAP2Client):
    """Demo/mock AP2 client for development and testing."""

    async def create_intent_mandate(
        self,
        intent_description: str,
        language: str = "en",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create mock intent mandate."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        mandate_id = str(uuid4())
        expires_at = datetime.now(UTC) + timedelta(seconds=self.settings.mandate_ttl_seconds)

        logger.info(
            "Demo: Intent mandate created",
            mandate_id=mandate_id,
            intent=intent_description,
            language=language,
        )

        return {
            "mandate_id": mandate_id,
            "mandate_type": "intent",
            "status": "verified",
            "intent_description": intent_description,
            "language": language,
            "signature": f"demo_signature_{mandate_id}",
            "public_key": "demo_public_key",
            "expires_at": expires_at.isoformat(),
            "metadata": metadata or {},
        }

    async def create_cart_mandate(
        self,
        parent_mandate_id: str,
        cart_items: list[dict[str, Any]],
        total_amount: float,
        currency: str = "AUD",
    ) -> dict[str, Any]:
        """Create mock cart mandate."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        mandate_id = str(uuid4())
        expires_at = datetime.now(UTC) + timedelta(seconds=self.settings.mandate_ttl_seconds)

        logger.info(
            "Demo: Cart mandate created",
            mandate_id=mandate_id,
            parent_mandate_id=parent_mandate_id,
            items_count=len(cart_items),
            total=total_amount,
        )

        return {
            "mandate_id": mandate_id,
            "mandate_type": "cart",
            "status": "verified",
            "parent_mandate_id": parent_mandate_id,
            "cart_items": cart_items,
            "total_amount": total_amount,
            "currency": currency,
            "signature": f"demo_signature_{mandate_id}",
            "public_key": "demo_public_key",
            "expires_at": expires_at.isoformat(),
        }

    async def create_payment_mandate(
        self,
        parent_mandate_id: str,
        payment_amount: float,
        payment_method: str,
        currency: str = "AUD",
    ) -> dict[str, Any]:
        """Create mock payment mandate."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        mandate_id = str(uuid4())
        expires_at = datetime.now(UTC) + timedelta(seconds=self.settings.mandate_ttl_seconds)

        logger.info(
            "Demo: Payment mandate created",
            mandate_id=mandate_id,
            parent_mandate_id=parent_mandate_id,
            amount=payment_amount,
            method=payment_method,
        )

        return {
            "mandate_id": mandate_id,
            "mandate_type": "payment",
            "status": "verified",
            "parent_mandate_id": parent_mandate_id,
            "payment_amount": payment_amount,
            "payment_method": payment_method,
            "currency": currency,
            "signature": f"demo_signature_{mandate_id}",
            "public_key": "demo_public_key",
            "expires_at": expires_at.isoformat(),
        }

    async def verify_mandate_signature(
        self,
        mandate_id: str,
        signature: str,
        public_key: str,
    ) -> bool:
        """Mock signature verification (always returns True in demo)."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        # Simulate occasional failures based on demo_failure_rate
        if random.random() < self.settings.demo_failure_rate:
            logger.warning("Demo: Signature verification failed", mandate_id=mandate_id)
            return False

        logger.info("Demo: Signature verified", mandate_id=mandate_id)
        return True

    async def execute_payment(
        self,
        mandate_id: str,
        order_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute mock payment."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        transaction_id = str(uuid4())

        # Simulate occasional payment failures
        if random.random() < self.settings.demo_failure_rate:
            logger.warning("Demo: Payment failed", transaction_id=transaction_id)
            return {
                "transaction_id": transaction_id,
                "status": "failed",
                "error_message": "Demo: Simulated payment failure",
            }

        logger.info(
            "Demo: Payment executed",
            transaction_id=transaction_id,
            mandate_id=mandate_id,
            order_id=order_id,
        )

        return {
            "transaction_id": transaction_id,
            "mandate_id": mandate_id,
            "order_id": order_id,
            "status": "completed",
            "amount": 100.00,  # Mock amount
            "currency": "AUD",
            "payment_method": "google_pay",
            "google_transaction_id": f"GOOGLE_TXN_{transaction_id}",
            "completed_at": datetime.now(UTC).isoformat(),
        }

    async def get_transaction_status(
        self,
        transaction_id: str,
    ) -> dict[str, Any]:
        """Get mock transaction status."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        logger.info("Demo: Transaction status retrieved", transaction_id=transaction_id)

        return {
            "transaction_id": transaction_id,
            "status": "completed",
            "amount": 100.00,
            "currency": "AUD",
            "completed_at": datetime.now(UTC).isoformat(),
        }

    async def process_voice_input(
        self,
        session_id: str,
        voice_text: str,
        language: str = "en",
    ) -> dict[str, Any]:
        """Process mock voice input."""
        if self.settings.demo_simulate_delays:
            await asyncio.sleep(self.settings.demo_delay_ms / 1000)

        # Simple intent detection for demo
        intent = "unknown"
        entities = {}

        voice_lower = voice_text.lower()
        if "order" in voice_lower or "buy" in voice_lower:
            intent = "place_order"
            # Extract product if mentioned
            if "drill" in voice_lower:
                entities["product"] = "drill"
        elif "status" in voice_lower or "track" in voice_lower:
            intent = "check_status"
        elif "cancel" in voice_lower:
            intent = "cancel_order"

        logger.info(
            "Demo: Voice input processed",
            session_id=session_id,
            voice_text=voice_text,
            intent=intent,
        )

        return {
            "session_id": session_id,
            "intent": intent,
            "confidence": 0.85,
            "entities": entities,
            "language": language,
            "next_action": "create_intent_mandate" if intent == "place_order" else "provide_information",
            "response_text": f"Demo: I understood your intent as '{intent}'",
        }


class AP2LiveClient(BaseAP2Client):
    """Live AP2 client for production use with Google Cloud API."""

    def __init__(self):
        super().__init__()
        self.http_client = httpx.AsyncClient(
            base_url=self.settings.api_endpoint,
            timeout=self.settings.api_timeout,
            headers={
                "X-Goog-Api-Key": self.settings.api_key or "",
                "Content-Type": "application/json",
            },
        )

    async def create_intent_mandate(
        self,
        intent_description: str,
        language: str = "en",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create intent mandate via Google AP2 API."""
        logger.info(
            "AP2: Creating intent mandate",
            intent=intent_description,
            language=language,
        )

        payload = {
            "type": "intent",
            "intent_description": intent_description,
            "language": language,
            "ttl_seconds": self.settings.mandate_ttl_seconds,
            "metadata": metadata or {},
        }

        response = await self.http_client.post("/mandates", json=payload)
        response.raise_for_status()

        data = response.json()
        logger.info("AP2: Intent mandate created", mandate_id=data.get("mandate_id"))

        return data

    async def create_cart_mandate(
        self,
        parent_mandate_id: str,
        cart_items: list[dict[str, Any]],
        total_amount: float,
        currency: str = "AUD",
    ) -> dict[str, Any]:
        """Create cart mandate via Google AP2 API."""
        logger.info(
            "AP2: Creating cart mandate",
            parent_mandate_id=parent_mandate_id,
            items_count=len(cart_items),
        )

        payload = {
            "type": "cart",
            "parent_mandate_id": parent_mandate_id,
            "cart_items": cart_items,
            "total_amount": total_amount,
            "currency": currency,
            "ttl_seconds": self.settings.mandate_ttl_seconds,
        }

        response = await self.http_client.post("/mandates", json=payload)
        response.raise_for_status()

        data = response.json()
        logger.info("AP2: Cart mandate created", mandate_id=data.get("mandate_id"))

        return data

    async def create_payment_mandate(
        self,
        parent_mandate_id: str,
        payment_amount: float,
        payment_method: str,
        currency: str = "AUD",
    ) -> dict[str, Any]:
        """Create payment mandate via Google AP2 API."""
        logger.info(
            "AP2: Creating payment mandate",
            parent_mandate_id=parent_mandate_id,
            amount=payment_amount,
        )

        payload = {
            "type": "payment",
            "parent_mandate_id": parent_mandate_id,
            "payment_amount": payment_amount,
            "payment_method": payment_method,
            "currency": currency,
            "ttl_seconds": self.settings.mandate_ttl_seconds,
        }

        response = await self.http_client.post("/mandates", json=payload)
        response.raise_for_status()

        data = response.json()
        logger.info("AP2: Payment mandate created", mandate_id=data.get("mandate_id"))

        return data

    async def verify_mandate_signature(
        self,
        mandate_id: str,
        signature: str,
        public_key: str,
    ) -> bool:
        """Verify mandate signature via Google AP2 API."""
        logger.info("AP2: Verifying mandate signature", mandate_id=mandate_id)

        payload = {
            "mandate_id": mandate_id,
            "signature": signature,
            "public_key": public_key,
        }

        try:
            response = await self.http_client.post("/mandates/verify", json=payload)
            response.raise_for_status()
            data = response.json()

            verified = data.get("verified", False)
            logger.info("AP2: Signature verification result", verified=verified)

            return verified

        except httpx.HTTPError as e:
            logger.error("AP2: Signature verification failed", error=str(e))
            return False

    async def execute_payment(
        self,
        mandate_id: str,
        order_id: str | None = None,
    ) -> dict[str, Any]:
        """Execute payment via Google AP2 API."""
        logger.info("AP2: Executing payment", mandate_id=mandate_id, order_id=order_id)

        payload = {
            "mandate_id": mandate_id,
            "order_id": order_id,
        }

        response = await self.http_client.post("/transactions/execute", json=payload)
        response.raise_for_status()

        data = response.json()
        logger.info("AP2: Payment executed", transaction_id=data.get("transaction_id"))

        return data

    async def get_transaction_status(
        self,
        transaction_id: str,
    ) -> dict[str, Any]:
        """Get transaction status via Google AP2 API."""
        logger.info("AP2: Getting transaction status", transaction_id=transaction_id)

        response = await self.http_client.get(f"/transactions/{transaction_id}")
        response.raise_for_status()

        data = response.json()
        logger.info("AP2: Transaction status retrieved", status=data.get("status"))

        return data

    async def process_voice_input(
        self,
        session_id: str,
        voice_text: str,
        language: str = "en",
    ) -> dict[str, Any]:
        """Process voice input via Google AP2 API."""
        logger.info(
            "AP2: Processing voice input",
            session_id=session_id,
            language=language,
        )

        payload = {
            "session_id": session_id,
            "voice_text": voice_text,
            "language": language,
        }

        response = await self.http_client.post("/voice/process", json=payload)
        response.raise_for_status()

        data = response.json()
        logger.info("AP2: Voice input processed", intent=data.get("intent"))

        return data

    async def close(self):
        """Close HTTP client."""
        await self.http_client.aclose()


# Client factory
_ap2_client: BaseAP2Client | None = None


def get_ap2_client() -> BaseAP2Client:
    """
    Get AP2 client singleton (demo or live based on settings).

    Returns:
        AP2 client instance (demo or live)
    """
    global _ap2_client

    if _ap2_client is None:
        settings = get_ap2_settings()

        if settings.mode == "demo":
            logger.info("Initializing AP2 Demo Client")
            _ap2_client = AP2DemoClient()
        else:
            logger.info("Initializing AP2 Live Client")
            _ap2_client = AP2LiveClient()

    return _ap2_client
