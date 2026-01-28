"""
Payment Processor Service.

Unified interface for processing payments across multiple gateways:
- EFTPOS terminals (walk-in sales)
- AMEX gateway (online sales)
- Bank transfer (manual reconciliation)
- Cash (recorded in POS)
"""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import POSTerminal, POSTransaction

from .amex import AMEXChargeRequest, AMEXClient
from .eftpos import EFTPOSClient, EFTPOSRequest


class PaymentProcessingError(Exception):
    """Payment processing failed."""

    pass


class PaymentProcessor:
    """
    Unified payment processor.

    Routes payment requests to appropriate gateway based on payment method.
    Updates POS transaction with payment result.
    """

    def __init__(self):
        self.eftpos_client = EFTPOSClient()
        self.amex_client = AMEXClient()

    async def process_payment(
        self,
        db: AsyncSession,
        transaction: POSTransaction,
        terminal: POSTerminal,
    ) -> dict:
        """
        Process payment for a POS transaction.

        Args:
            db: Database session
            transaction: POS transaction to process
            terminal: Terminal to process payment on

        Returns:
            Payment result dict with status, reference, response

        Raises:
            PaymentProcessingError: If payment fails
        """
        if transaction.payment_method == "eftpos":
            return await self._process_eftpos(transaction, terminal)
        elif transaction.payment_method == "amex":
            return await self._process_amex(transaction)
        elif transaction.payment_method == "bank_transfer":
            return await self._process_bank_transfer(transaction)
        elif transaction.payment_method == "cash":
            return await self._process_cash(transaction)
        else:
            raise PaymentProcessingError(f"Unsupported payment method: {transaction.payment_method}")

    async def _process_eftpos(self, transaction: POSTransaction, terminal: POSTerminal) -> dict:
        """Process EFTPOS payment."""
        request = EFTPOSRequest(
            terminal_id=terminal.terminal_id,
            amount=transaction.amount,
            reference=transaction.transaction_number,
        )

        response = await self.eftpos_client.process_sale(request)

        if response.success:
            return {
                "status": "captured",
                "gateway_ref": response.transaction_id,
                "approval_code": response.approval_code,
                "card_type": response.card_type,
                "card_last_4": response.card_last_4,
                "response_text": response.response_text,
                "raw_response": response.dict(),
            }
        else:
            raise PaymentProcessingError(f"EFTPOS declined: {response.response_text}")

    async def _process_amex(self, transaction: POSTransaction) -> dict:
        """Process AMEX payment."""
        # In production, card details would come from secure form submission
        # For now, we use mock data
        request = AMEXChargeRequest(
            amount=transaction.amount,
            reference=transaction.transaction_number,
            card_token="tok_test_amex",  # Mock token
        )

        response = await self.amex_client.charge(request)

        if response.success:
            return {
                "status": "captured",
                "gateway_ref": response.transaction_id,
                "approval_code": response.authorization_code,
                "card_type": "amex",
                "card_last_4": response.card_last_4,
                "response_text": response.response_text,
                "raw_response": response.dict(),
            }
        else:
            raise PaymentProcessingError(f"AMEX declined: {response.response_text}")

    async def _process_bank_transfer(self, transaction: POSTransaction) -> dict:
        """Process bank transfer (manual)."""
        # Bank transfers are recorded but not processed immediately
        # They will be reconciled when bank feed data arrives
        return {
            "status": "pending",
            "gateway_ref": f"BANK-{transaction.transaction_number}",
            "response_text": "Bank transfer pending reconciliation",
            "raw_response": {},
        }

    async def _process_cash(self, transaction: POSTransaction) -> dict:
        """Process cash payment."""
        # Cash is immediately captured (physical cash received)
        return {
            "status": "captured",
            "gateway_ref": f"CASH-{transaction.transaction_number}",
            "response_text": "Cash received",
            "raw_response": {},
        }

    async def process_refund(
        self,
        db: AsyncSession,
        transaction: POSTransaction,
        amount: Decimal,
    ) -> dict:
        """
        Process refund for a POS transaction.

        Args:
            db: Database session
            transaction: Original POS transaction
            amount: Refund amount

        Returns:
            Refund result dict

        Raises:
            PaymentProcessingError: If refund fails
        """
        if transaction.payment_method == "eftpos":
            # Get terminal from transaction
            terminal_result = await db.execute(
                select(POSTerminal).where(POSTerminal.id == transaction.terminal_id)
            )
            terminal = terminal_result.scalar_one_or_none()
            if not terminal:
                raise PaymentProcessingError("Terminal not found")

            response = await self.eftpos_client.process_refund(
                terminal_id=terminal.terminal_id,
                amount=amount,
                original_reference=transaction.payment_gateway_ref or "",
            )

            if response.success:
                return {
                    "status": "refunded",
                    "gateway_ref": response.transaction_id,
                    "response_text": response.response_text,
                    "raw_response": response.dict(),
                }
            else:
                raise PaymentProcessingError(f"EFTPOS refund failed: {response.response_text}")

        elif transaction.payment_method == "amex":
            response = await self.amex_client.refund(
                transaction_id=transaction.payment_gateway_ref or "",
                amount=amount,
            )

            if response.success:
                return {
                    "status": "refunded",
                    "gateway_ref": response.transaction_id,
                    "response_text": response.response_text,
                    "raw_response": response.dict(),
                }
            else:
                raise PaymentProcessingError(f"AMEX refund failed: {response.response_text}")

        elif transaction.payment_method in ["bank_transfer", "cash"]:
            # Manual refund process
            return {
                "status": "refunded",
                "gateway_ref": f"REFUND-{transaction.transaction_number}",
                "response_text": "Manual refund processed",
                "raw_response": {},
            }

        else:
            raise PaymentProcessingError(f"Refund not supported for: {transaction.payment_method}")
