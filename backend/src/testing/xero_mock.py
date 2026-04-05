"""
Xero API Mock Framework for Testing.

Provides configurable mock responses for Xero API calls with failure simulation.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""

import asyncio
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class XeroMockMode(str, Enum):
    """Mock behavior modes."""

    SUCCESS = "success"  # Always return successful responses
    RATE_LIMIT = "rate_limit"  # Simulate rate limiting (429)
    TIMEOUT = "timeout"  # Simulate request timeouts
    SERVER_ERROR = "server_error"  # Simulate server errors (500)
    UNAUTHORIZED = "unauthorized"  # Simulate auth errors (401)
    VALIDATION_ERROR = "validation_error"  # Simulate validation errors (400)
    INTERMITTENT = "intermittent"  # Randomly fail/succeed


@dataclass
class XeroMockConfig:
    """Configuration for Xero mock behavior."""

    mode: XeroMockMode = XeroMockMode.SUCCESS
    failure_rate: float = 0.3  # For INTERMITTENT mode (0.0-1.0)
    response_delay_ms: int = 0  # Simulated network latency
    rate_limit_delay_ms: int = 1000  # Delay for rate limit responses
    call_tracking: bool = True  # Track API calls for verification


@dataclass
class XeroMockCall:
    """Record of a mocked API call."""

    timestamp: datetime
    method: str  # create_contact, create_invoice, etc.
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    response: Any = None
    error: Exception | None = None


class XeroMockClient:
    """
    Mock Xero API client for testing.

    Features:
    - Configurable success/failure modes
    - Realistic demo data generation
    - API call tracking and verification
    - Failure scenario simulation
    - Response customization for specific tests
    """

    def __init__(self, config: XeroMockConfig | None = None):
        """
        Initialize mock client.

        Args:
            config: Mock configuration (defaults to SUCCESS mode)
        """
        self.config = config or XeroMockConfig()
        self.call_history: list[XeroMockCall] = []
        self._call_count = 0
        self._custom_responses: dict[str, Callable] = {}

        logger.info(
            "Xero mock client initialized",
            mode=self.config.mode.value,
            tracking=self.config.call_tracking,
        )

    async def _simulate_network(self) -> None:
        """Simulate network latency."""
        if self.config.response_delay_ms > 0:
            await asyncio.sleep(self.config.response_delay_ms / 1000.0)

    async def _check_mode(self, method_name: str) -> None:
        """
        Check mock mode and raise appropriate exceptions.

        Args:
            method_name: Name of the API method being called

        Raises:
            Exception: Based on configured mode
        """
        self._call_count += 1

        # Store original mode for intermittent
        original_mode = self.config.mode

        # Intermittent failures
        if self.config.mode == XeroMockMode.INTERMITTENT:
            import random

            if random.random() < self.config.failure_rate:
                # Randomly choose an error type
                error_mode = random.choice(
                    [
                        XeroMockMode.RATE_LIMIT,
                        XeroMockMode.TIMEOUT,
                        XeroMockMode.SERVER_ERROR,
                    ]
                )
                current_mode = error_mode
            else:
                current_mode = XeroMockMode.SUCCESS
        else:
            current_mode = self.config.mode

        # Specific failure modes
        if current_mode == XeroMockMode.RATE_LIMIT:
            await asyncio.sleep(self.config.rate_limit_delay_ms / 1000.0)
            error = Exception("Xero API rate limit exceeded (429)")
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == XeroMockMode.TIMEOUT:
            await asyncio.sleep(0.1)  # Reduced timeout for testing
            error = TimeoutError("Xero API request timed out")
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == XeroMockMode.SERVER_ERROR:
            error = Exception("Xero API server error (500)")
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == XeroMockMode.UNAUTHORIZED:
            error = Exception("Xero API authentication failed (401)")
            await self._track_call(method_name, (), {}, error=error)
            raise error

        elif current_mode == XeroMockMode.VALIDATION_ERROR:
            error = Exception("Xero API validation error (400)")
            await self._track_call(method_name, (), {}, error=error)
            raise error

    async def _track_call(
        self,
        method: str,
        args: tuple,
        kwargs: dict,
        response: Any = None,
        error: Exception | None = None,
    ) -> None:
        """Track API call for verification."""
        if self.config.call_tracking:
            call = XeroMockCall(
                timestamp=datetime.now(),
                method=method,
                args=args,
                kwargs=kwargs,
                response=response,
                error=error,
            )
            self.call_history.append(call)

    def set_custom_response(self, method: str, response_func: Callable) -> None:
        """
        Set custom response for a specific method.

        Args:
            method: Method name (e.g., "create_contact")
            response_func: Function that returns custom response
        """
        self._custom_responses[method] = response_func
        logger.debug("Custom response set", method=method)

    def clear_call_history(self) -> None:
        """Clear call history."""
        self.call_history.clear()
        self._call_count = 0
        logger.debug("Call history cleared")

    def get_call_count(self, method: str | None = None) -> int:
        """
        Get number of calls made.

        Args:
            method: Filter by method name (optional)

        Returns:
            Number of calls
        """
        if method is None:
            return len(self.call_history)
        return sum(1 for call in self.call_history if call.method == method)

    # ============================================================
    # XERO API METHODS
    # ============================================================

    async def create_contact(
        self,
        name: str,
        email: str | None = None,
        phone: str | None = None,
        address: dict | None = None,
    ) -> dict[str, Any]:
        """Create a contact in Xero."""
        await self._simulate_network()
        await self._check_mode("create_contact")

        kwargs = {"name": name, "email": email, "phone": phone, "address": address}

        # Check for custom response
        if "create_contact" in self._custom_responses:
            response = self._custom_responses["create_contact"](**kwargs)
            await self._track_call("create_contact", (), kwargs, response)
            return response

        # Generate mock contact
        contact_id = str(uuid.uuid4())

        response = {
            "ContactID": contact_id,
            "Name": name,
            "EmailAddress": email or "demo@example.com",
            "ContactStatus": "ACTIVE",
            "Phones": [{"PhoneType": "DEFAULT", "PhoneNumber": phone or "0400000000"}]
            if phone
            else [],
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

        await self._track_call("create_contact", (), kwargs, response)
        return response

    async def get_contact_by_email(self, email: str) -> dict[str, Any] | None:
        """Get contact by email address."""
        await self._simulate_network()
        await self._check_mode("get_contact_by_email")

        kwargs = {"email": email}

        # Check for custom response
        if "get_contact_by_email" in self._custom_responses:
            response = self._custom_responses["get_contact_by_email"](email)
            await self._track_call("get_contact_by_email", (email,), {}, response)
            return response

        # Default: return None (not found)
        await self._track_call("get_contact_by_email", (email,), {}, None)
        return None

    async def create_invoice(
        self,
        contact_id: str,
        invoice_number: str,
        line_items: list[dict],
        due_date: date | None = None,
        reference: str | None = None,
    ) -> dict[str, Any]:
        """Create an invoice in Xero."""
        await self._simulate_network()
        await self._check_mode("create_invoice")

        kwargs = {
            "contact_id": contact_id,
            "invoice_number": invoice_number,
            "line_items": line_items,
            "due_date": due_date,
            "reference": reference,
        }

        # Check for custom response
        if "create_invoice" in self._custom_responses:
            response = self._custom_responses["create_invoice"](**kwargs)
            await self._track_call("create_invoice", (), kwargs, response)
            return response

        # Calculate totals
        subtotal = sum(item.get("quantity", 1) * item.get("unit_amount", 0) for item in line_items)
        tax = subtotal * 0.1  # 10% GST
        total = subtotal + tax

        invoice_id = str(uuid.uuid4())

        response = {
            "InvoiceID": invoice_id,
            "InvoiceNumber": invoice_number,
            "Type": "ACCREC",
            "Contact": {"ContactID": contact_id},
            "LineItems": line_items,
            "SubTotal": subtotal,
            "TotalTax": tax,
            "Total": total,
            "Status": "DRAFT",
            "Reference": reference,
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

        await self._track_call("create_invoice", (), kwargs, response)
        return response

    async def get_invoices(
        self,
        status: str | None = None,
        modified_since: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Get invoices from Xero."""
        await self._simulate_network()
        await self._check_mode("get_invoices")

        kwargs = {"status": status, "modified_since": modified_since}

        # Check for custom response
        if "get_invoices" in self._custom_responses:
            response = self._custom_responses["get_invoices"](**kwargs)
            await self._track_call("get_invoices", (), kwargs, response)
            return response

        # Generate mock invoices
        invoices = []
        for i in range(3):  # Return 3 mock invoices
            invoice_id = str(uuid.uuid4())
            invoices.append(
                {
                    "InvoiceID": invoice_id,
                    "InvoiceNumber": f"INV-{1000 + i}",
                    "Type": "ACCREC",
                    "Status": status or "DRAFT",
                    "Total": 1000.00 + (i * 100),
                    "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
                }
            )

        await self._track_call("get_invoices", (), kwargs, invoices)
        return invoices

    async def create_payment(
        self,
        invoice_id: str,
        account_id: str,
        amount: float,
        payment_date: date | None = None,
    ) -> dict[str, Any]:
        """Create a payment in Xero."""
        await self._simulate_network()
        await self._check_mode("create_payment")

        kwargs = {
            "invoice_id": invoice_id,
            "account_id": account_id,
            "amount": amount,
            "payment_date": payment_date,
        }

        # Check for custom response
        if "create_payment" in self._custom_responses:
            response = self._custom_responses["create_payment"](**kwargs)
            await self._track_call("create_payment", (), kwargs, response)
            return response

        payment_id = str(uuid.uuid4())

        response = {
            "PaymentID": payment_id,
            "Invoice": {"InvoiceID": invoice_id},
            "Account": {"AccountID": account_id},
            "Amount": amount,
            "Date": (payment_date or date.today()).isoformat(),
            "Status": "AUTHORISED",
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

        await self._track_call("create_payment", (), kwargs, response)
        return response

    async def get_bank_transactions(
        self,
        status: str | None = None,
        modified_since: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """Get bank transactions from Xero."""
        await self._simulate_network()
        await self._check_mode("get_bank_transactions")

        kwargs = {"status": status, "modified_since": modified_since}

        # Check for custom response
        if "get_bank_transactions" in self._custom_responses:
            response = self._custom_responses["get_bank_transactions"](**kwargs)
            await self._track_call("get_bank_transactions", (), kwargs, response)
            return response

        # Generate mock transactions
        transactions = []
        for i in range(5):
            transaction_id = str(uuid.uuid4())
            transactions.append(
                {
                    "BankTransactionID": transaction_id,
                    "Type": "SPEND" if i % 2 == 0 else "RECEIVE",
                    "Status": status or "AUTHORISED",
                    "Total": 500.00 + (i * 50),
                    "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
                }
            )

        await self._track_call("get_bank_transactions", (), kwargs, transactions)
        return transactions

    async def create_bank_transaction(
        self,
        transaction_type: str,
        contact_id: str,
        account_id: str,
        amount: float,
        line_items: list[dict],
    ) -> dict[str, Any]:
        """Create a bank transaction in Xero."""
        await self._simulate_network()
        await self._check_mode("create_bank_transaction")

        kwargs = {
            "transaction_type": transaction_type,
            "contact_id": contact_id,
            "account_id": account_id,
            "amount": amount,
            "line_items": line_items,
        }

        # Check for custom response
        if "create_bank_transaction" in self._custom_responses:
            response = self._custom_responses["create_bank_transaction"](**kwargs)
            await self._track_call("create_bank_transaction", (), kwargs, response)
            return response

        transaction_id = str(uuid.uuid4())

        response = {
            "BankTransactionID": transaction_id,
            "Type": transaction_type,
            "Contact": {"ContactID": contact_id},
            "BankAccount": {"AccountID": account_id},
            "LineItems": line_items,
            "Total": amount,
            "Status": "AUTHORISED",
            "UpdatedDateUTC": datetime.utcnow().isoformat() + "Z",
        }

        await self._track_call("create_bank_transaction", (), kwargs, response)
        return response


# Factory function for creating mock clients
def create_xero_mock(
    mode: XeroMockMode = XeroMockMode.SUCCESS,
    **config_kwargs: Any,
) -> XeroMockClient:
    """
    Create a configured Xero mock client.

    Args:
        mode: Mock behavior mode
        **config_kwargs: Additional config parameters

    Returns:
        Configured XeroMockClient
    """
    config = XeroMockConfig(mode=mode, **config_kwargs)
    return XeroMockClient(config)
