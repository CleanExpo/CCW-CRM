"""Test POS transaction creation with database."""
import asyncio
import sys
sys.path.insert(0, "apps/backend")

from decimal import Decimal
from uuid import UUID
from sqlalchemy import select
from src.config.database import get_db_session
from src.db.pos_models import POSTransaction, POSTerminal, SalesStaff
from src.integrations.payments import PaymentProcessor


async def test_pos_transaction():
    """Test creating a POS transaction."""
    async with get_db_session() as db:
        # Get terminal
        result = await db.execute(
            select(POSTerminal).where(POSTerminal.terminal_id == "BNE-EFTPOS-01")
        )
        terminal = result.scalar_one()
        print(f"Terminal: {terminal.terminal_id} at {terminal.location_code}")

        # Get sales staff
        result = await db.execute(
            select(SalesStaff).where(SalesStaff.staff_code == "QLD-JOHN")
        )
        staff = result.scalar_one()
        print(f"Staff: {staff.staff_code} - {staff.full_name}")

        # Create transaction
        from sqlalchemy import text
        result = await db.execute(text("SELECT generate_pos_transaction_number()"))
        transaction_number = result.scalar()
        print(f"Transaction number: {transaction_number}")

        pos_transaction = POSTransaction(
            transaction_number=transaction_number,
            terminal_id=terminal.id,
            sales_staff_id=staff.id,
            location_code=terminal.location_code,
            resolved_location_code=staff.primary_location_code,
            transaction_type="sale",
            payment_method="cash",
            amount=Decimal("99.50"),
            currency="AUD",
            payment_status="pending",
            reconciliation_status="pending",
        )

        db.add(pos_transaction)
        await db.flush()
        print(f"Transaction created with ID: {pos_transaction.id}")

        # Process payment
        processor = PaymentProcessor()
        payment_result = await processor.process_payment(
            db=db,
            transaction=pos_transaction,
            terminal=terminal,
        )
        print(f"Payment result: {payment_result}")

        # Update transaction
        pos_transaction.payment_status = payment_result["status"]
        pos_transaction.payment_gateway_ref = payment_result.get("gateway_ref")
        pos_transaction.payment_gateway_response = payment_result.get("raw_response")

        await db.commit()
        print(f"Transaction committed: {pos_transaction.transaction_number}")
        print(f"Status: {pos_transaction.payment_status}")
        print(f"Gateway ref: {pos_transaction.payment_gateway_ref}")


if __name__ == "__main__":
    asyncio.run(test_pos_transaction())
