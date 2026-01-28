"""
EFTPOS Terminal Integration Client.

Supports:
- Tyro terminals
- PC-EFTPOS
- EFTPOS Australia
- Smartpay

This is a framework implementation with mock responses for Phase 3C.
Production implementation will integrate with actual terminal provider SDKs.
"""

import asyncio
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel


class EFTPOSRequest(BaseModel):
    """EFTPOS payment request."""

    terminal_id: str
    amount: Decimal
    reference: str
    merchant_receipt: bool = True
    customer_receipt: bool = True


class EFTPOSResponse(BaseModel):
    """EFTPOS payment response."""

    success: bool
    status: str  # 'approved', 'declined', 'cancelled', 'timeout', 'error'
    transaction_id: str
    approval_code: Optional[str] = None
    merchant_id: str
    terminal_id: str
    amount: Decimal
    card_type: Optional[str] = None  # 'visa', 'mastercard', 'eftpos'
    card_last_4: Optional[str] = None
    response_text: str
    timestamp: datetime


class EFTPOSClient:
    """
    Client for EFTPOS terminal communication.

    Flow:
    1. Send sale request to terminal
    2. Terminal prompts customer to insert card
    3. Customer enters PIN
    4. Terminal processes with bank
    5. Return success/failure

    Note: This is a mock implementation for Phase 3C.
    Production will integrate with Tyro/PC-EFTPOS SDKs.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.mock_mode = True  # Set to False when integrating real terminal

    async def process_sale(self, request: EFTPOSRequest) -> EFTPOSResponse:
        """
        Process a sale on EFTPOS terminal.

        Args:
            request: EFTPOS payment request with terminal_id, amount, reference

        Returns:
            EFTPOSResponse with transaction status

        In production:
        - Connects to terminal via TCP/IP or USB
        - Sends sale command
        - Waits for customer interaction (card insert, PIN entry)
        - Returns result from bank authorization
        """
        if self.mock_mode:
            return await self._mock_process_sale(request)

        # TODO: Integrate with real EFTPOS terminal SDK
        # Example (Tyro):
        # response = await tyro_api.initiate_sale(
        #     terminal_id=request.terminal_id,
        #     amount=request.amount,
        #     reference=request.reference,
        # )
        # return self._parse_tyro_response(response)

        raise NotImplementedError("Production EFTPOS integration not yet implemented")

    async def _mock_process_sale(self, request: EFTPOSRequest) -> EFTPOSResponse:
        """
        Mock EFTPOS sale for development/testing.

        Simulates:
        - Short delay (reduced from 2s to 0.1s for testing)
        - 95% approval rate
        - Random card types
        """
        # Simulate customer interaction delay (reduced for testing)
        await asyncio.sleep(0.1)

        # Mock approval (95% success rate)
        import random

        success = random.random() < 0.95

        if success:
            return EFTPOSResponse(
                success=True,
                status="approved",
                transaction_id=f"EFTPOS-{uuid4().hex[:12].upper()}",
                approval_code=f"{random.randint(100000, 999999)}",
                merchant_id=request.terminal_id.split("-")[0],
                terminal_id=request.terminal_id,
                amount=request.amount,
                card_type=random.choice(["visa", "mastercard", "eftpos"]),
                card_last_4=f"{random.randint(1000, 9999)}",
                response_text="APPROVED - THANK YOU",
                timestamp=datetime.now(),
            )
        else:
            return EFTPOSResponse(
                success=False,
                status="declined",
                transaction_id=f"EFTPOS-{uuid4().hex[:12].upper()}",
                approval_code=None,
                merchant_id=request.terminal_id.split("-")[0],
                terminal_id=request.terminal_id,
                amount=request.amount,
                card_type=None,
                card_last_4=None,
                response_text="DECLINED - INSUFFICIENT FUNDS",
                timestamp=datetime.now(),
            )

    async def process_refund(
        self, terminal_id: str, amount: Decimal, original_reference: str
    ) -> EFTPOSResponse:
        """
        Process a refund on EFTPOS terminal.

        Args:
            terminal_id: Terminal to process refund on
            amount: Refund amount
            original_reference: Original transaction reference

        Returns:
            EFTPOSResponse with refund status
        """
        if self.mock_mode:
            await asyncio.sleep(1)
            return EFTPOSResponse(
                success=True,
                status="approved",
                transaction_id=f"REFUND-{uuid4().hex[:12].upper()}",
                approval_code=f"{100000 + hash(original_reference) % 900000}",
                merchant_id=terminal_id.split("-")[0],
                terminal_id=terminal_id,
                amount=amount,
                card_type="visa",
                card_last_4="****",
                response_text="REFUND APPROVED",
                timestamp=datetime.now(),
            )

        raise NotImplementedError("Production EFTPOS refund not yet implemented")

    async def settlement(self, terminal_id: str) -> dict:
        """
        Perform end-of-day settlement on terminal.

        Returns:
            Settlement report with totals and transaction counts
        """
        if self.mock_mode:
            await asyncio.sleep(2)
            return {
                "terminal_id": terminal_id,
                "settlement_date": datetime.now().date().isoformat(),
                "total_sales": "12345.67",
                "total_refunds": "234.56",
                "net_amount": "12111.11",
                "transaction_count": 45,
                "refund_count": 2,
            }

        raise NotImplementedError("Production EFTPOS settlement not yet implemented")
