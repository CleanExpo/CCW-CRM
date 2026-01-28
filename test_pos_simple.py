"""Simple test of POS transaction creation."""
import asyncio
import sys
sys.path.insert(0, "apps/backend")

from decimal import Decimal
from src.integrations.payments import PaymentProcessor


async def test_payment_processor():
    """Test the payment processor directly."""
    processor = PaymentProcessor()

    # Test cash payment
    result = await processor._process_cash_simple("TEST-001")
    print("Cash payment result:", result)

    # Test EFTPOS payment
    result = await processor._process_eftpos_simple(
        terminal_id="BNE-EFTPOS-01",
        amount=Decimal("99.95"),
        reference="TEST-002"
    )
    print("EFTPOS payment result:", result)

    # Test AMEX payment
    result = await processor._process_amex_simple(
        amount=Decimal("149.95"),
        reference="TEST-003"
    )
    print("AMEX payment result:", result)


if __name__ == "__main__":
    asyncio.run(test_payment_processor())
