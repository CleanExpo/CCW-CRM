"""
AMEX Payment Gateway Integration.

Supports:
- AMEX Direct (merchant account)
- AMEX via Stripe
- AMEX via Braintree

This is a framework implementation with mock responses for Phase 3C.
Production implementation will integrate with actual gateway SDK.
"""

import asyncio
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel


class AMEXChargeRequest(BaseModel):
    """AMEX charge request."""

    amount: Decimal
    reference: str
    card_number: Optional[str] = None  # For card-present transactions
    card_token: Optional[str] = None  # For stored cards
    cvv: Optional[str] = None
    expiry: Optional[str] = None  # MM/YY format


class AMEXChargeResponse(BaseModel):
    """AMEX charge response."""

    success: bool
    status: str  # 'authorized', 'captured', 'declined', 'error'
    transaction_id: str
    authorization_code: Optional[str] = None
    amount: Decimal
    card_last_4: Optional[str] = None
    response_text: str
    timestamp: datetime


class AMEXClient:
    """
    Client for AMEX payment processing.

    Supports:
    - Direct AMEX integration
    - AMEX via payment gateway (Stripe, Braintree)
    - Card tokenization for recurring payments

    Note: This is a mock implementation for Phase 3C.
    Production will integrate with AMEX gateway SDK.
    """

    def __init__(self, api_key: Optional[str] = None, merchant_id: Optional[str] = None):
        self.api_key = api_key
        self.merchant_id = merchant_id
        self.mock_mode = True  # Set to False when integrating real gateway

    async def charge(self, request: AMEXChargeRequest) -> AMEXChargeResponse:
        """
        Charge an AMEX card.

        Args:
            request: AMEX charge request with amount, card details, reference

        Returns:
            AMEXChargeResponse with authorization status

        In production:
        - Validates card details
        - Submits to AMEX network
        - Returns authorization code
        - Captures funds immediately or later
        """
        if self.mock_mode:
            return await self._mock_charge(request)

        # TODO: Integrate with real AMEX gateway SDK
        # Example (Stripe):
        # import stripe
        # stripe.api_key = self.api_key
        # charge = stripe.Charge.create(
        #     amount=int(request.amount * 100),  # Convert to cents
        #     currency='aud',
        #     source=request.card_token,
        #     description=request.reference,
        # )
        # return self._parse_stripe_response(charge)

        raise NotImplementedError("Production AMEX integration not yet implemented")

    async def _mock_charge(self, request: AMEXChargeRequest) -> AMEXChargeResponse:
        """
        Mock AMEX charge for development/testing.

        Simulates:
        - 1 second processing delay
        - 90% approval rate (AMEX has higher decline rate than EFTPOS)
        """
        await asyncio.sleep(1)

        import random

        success = random.random() < 0.90

        # Extract last 4 digits from card number if provided
        card_last_4 = None
        if request.card_number:
            card_last_4 = request.card_number[-4:]
        elif request.card_token:
            card_last_4 = request.card_token[-4:]

        if success:
            return AMEXChargeResponse(
                success=True,
                status="captured",
                transaction_id=f"AMEX-{uuid4().hex[:12].upper()}",
                authorization_code=f"AUTH{random.randint(100000, 999999)}",
                amount=request.amount,
                card_last_4=card_last_4,
                response_text="APPROVED",
                timestamp=datetime.now(),
            )
        else:
            return AMEXChargeResponse(
                success=False,
                status="declined",
                transaction_id=f"AMEX-{uuid4().hex[:12].upper()}",
                authorization_code=None,
                amount=request.amount,
                card_last_4=card_last_4,
                response_text=random.choice(
                    [
                        "DECLINED - CARD DECLINED",
                        "DECLINED - INSUFFICIENT FUNDS",
                        "DECLINED - INVALID CARD",
                    ]
                ),
                timestamp=datetime.now(),
            )

    async def refund(self, transaction_id: str, amount: Decimal) -> AMEXChargeResponse:
        """
        Refund an AMEX transaction.

        Args:
            transaction_id: Original transaction ID
            amount: Refund amount

        Returns:
            AMEXChargeResponse with refund status
        """
        if self.mock_mode:
            await asyncio.sleep(1)
            return AMEXChargeResponse(
                success=True,
                status="captured",
                transaction_id=f"REFUND-{uuid4().hex[:12].upper()}",
                authorization_code=f"REFUND{100000 + hash(transaction_id) % 900000}",
                amount=amount,
                card_last_4="****",
                response_text="REFUND APPROVED",
                timestamp=datetime.now(),
            )

        raise NotImplementedError("Production AMEX refund not yet implemented")

    async def tokenize_card(self, card_number: str, expiry: str, cvv: str) -> str:
        """
        Tokenize a card for future use.

        Args:
            card_number: Card number
            expiry: Expiry date (MM/YY)
            cvv: CVV

        Returns:
            Card token string
        """
        if self.mock_mode:
            await asyncio.sleep(0.5)
            return f"tok_{uuid4().hex[:24]}"

        raise NotImplementedError("Production card tokenization not yet implemented")
