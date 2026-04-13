"""Test fixtures for POS-related data."""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import BankAccount, BankFeed, Location, POSTerminal, POSTransaction


@pytest.fixture
def sample_location_data() -> dict[str, Any]:
    """Sample location data for creating test locations."""
    code = f"TEST-{uuid4().hex[:6].upper()}"
    return {
        "code": code,
        "name": f"Test Location {code}",
        "location_type": "physical",
        "address": "123 Test Street",
        "city": "Sydney",
        "state": "NSW",
        "postal_code": "2000",
        "country": "Australia",
        "timezone": "Australia/Sydney",
        "is_active": True,
    }


@pytest.fixture
def sample_terminal_data() -> dict[str, Any]:
    """Sample terminal data for creating test terminals."""
    return {
        "terminal_id": f"TERM-{uuid4().hex[:8].upper()}",
        "terminal_type": "eftpos",
        "merchant_id": f"MERCH-{uuid4().hex[:10].upper()}",
        "terminal_config": {},
        "is_active": True,
    }


@pytest.fixture
def sample_bank_account_data() -> dict[str, Any]:
    """Sample bank account data for creating test accounts."""
    return {
        "account_name": f"Test Account {uuid4().hex[:6]}",
        "account_number": f"{uuid4().hex[:9]}",
        "bsb": "123-456",
        "bank_name": "Test Bank",
        "account_type": "checking",
        "currency": "AUD",
        "feed_provider": "manual",
        "is_active": True,
    }


@pytest.fixture
def sample_pos_transaction_data() -> dict[str, Any]:
    """Sample POS transaction data for creating test transactions."""
    return {
        "transaction_number": f"POS-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}",
        "transaction_type": "sale",
        "payment_method": "eftpos",
        "amount": Decimal("99.99"),
        "currency": "AUD",
        "payment_status": "captured",
        "reconciliation_status": "pending",
    }


@pytest.fixture
def sample_bank_feed_data() -> dict[str, Any]:
    """Sample bank feed data for reconciliation testing."""
    return {
        "transaction_date": datetime.now().date(),
        "description": "EFTPOS SALE",
        "reference": f"REF-{uuid4().hex[:10].upper()}",
        "debit": Decimal("99.99"),
        "credit": None,
        "balance": Decimal("1000.00"),
        "match_status": "pending",
    }


@pytest.fixture
async def create_test_location(db_session: AsyncSession, sample_location_data: dict) -> Location:
    """Create a test location."""
    location = Location(**sample_location_data)
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)
    return location


@pytest.fixture
async def create_test_terminal(
    db_session: AsyncSession, create_test_location: Location, sample_terminal_data: dict
) -> POSTerminal:
    """Create a test terminal with location."""
    terminal_data = {**sample_terminal_data, "location_code": create_test_location.code}
    terminal = POSTerminal(**terminal_data)
    db_session.add(terminal)
    await db_session.commit()
    await db_session.refresh(terminal)
    return terminal


@pytest.fixture
async def create_test_bank_account(
    db_session: AsyncSession,
    create_test_location: Location,
    sample_bank_account_data: dict,
) -> BankAccount:
    """Create a test bank account."""
    account_data = {**sample_bank_account_data, "location_code": create_test_location.code}
    account = BankAccount(**account_data)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    return account


@pytest.fixture
async def create_test_pos_transaction(
    db_session: AsyncSession,
    create_test_terminal: POSTerminal,
    create_test_location: Location,
    sample_pos_transaction_data: dict,
) -> POSTransaction:
    """Create a test POS transaction."""
    transaction_data = {
        **sample_pos_transaction_data,
        "terminal_id": create_test_terminal.id,
        "location_code": create_test_location.code,
    }
    transaction = POSTransaction(**transaction_data)
    db_session.add(transaction)
    await db_session.commit()
    await db_session.refresh(transaction)
    return transaction


@pytest.fixture
async def create_test_bank_feed(
    db_session: AsyncSession,
    create_test_bank_account: BankAccount,
    sample_bank_feed_data: dict,
) -> BankFeed:
    """Create a test bank feed."""
    feed_data = {**sample_bank_feed_data, "bank_account_id": create_test_bank_account.id}
    feed = BankFeed(**feed_data)
    db_session.add(feed)
    await db_session.commit()
    await db_session.refresh(feed)
    return feed


# Helper functions for request payloads


def create_location_payload(**overrides) -> dict[str, Any]:
    """Helper to create location request payload."""
    code = f"TEST-{uuid4().hex[:6].upper()}"
    payload = {
        "code": code,
        "name": f"Test Location {code}",
        "location_type": "physical",
        "address": "123 Test Street",
        "city": "Sydney",
        "state": "NSW",
        "postal_code": "2000",
        "country": "Australia",
    }
    payload.update(overrides)
    return payload


def create_terminal_payload(location_code: str, **overrides) -> dict[str, Any]:
    """Helper to create terminal request payload."""
    payload = {
        "terminal_id": f"TERM-{uuid4().hex[:8].upper()}",
        "location_code": location_code,
        "terminal_type": "eftpos",
        "merchant_id": f"MERCH-{uuid4().hex[:10].upper()}",
    }
    payload.update(overrides)
    return payload


def create_bank_account_payload(location_code: str | None = None, **overrides) -> dict[str, Any]:
    """Helper to create bank account request payload."""
    payload = {
        "account_name": f"Test Account {uuid4().hex[:6]}",
        "account_number": f"{uuid4().hex[:9]}",
        "bsb": "123-456",
        "bank_name": "Test Bank",
        "account_type": "checking",
        "feed_provider": "manual",
    }
    if location_code:
        payload["location_code"] = location_code
    payload.update(overrides)
    return payload


def create_pos_transaction_payload(
    terminal_id: str, location_code: str, **overrides
) -> dict[str, Any]:
    """Helper to create POS transaction request payload."""
    payload = {
        "terminal_id": terminal_id,
        "location_code": location_code,
        "transaction_type": "sale",
        "payment_method": "eftpos",
        "amount": 99.99,
        "currency": "AUD",
        "payment_status": "captured",
    }
    payload.update(overrides)
    return payload


def create_bank_feed_payload(bank_account_id: str, **overrides) -> dict[str, Any]:
    """Helper to create bank feed request payload."""
    payload = {
        "bank_account_id": bank_account_id,
        "transaction_date": datetime.now().date().isoformat(),
        "description": "EFTPOS SALE",
        "reference": f"REF-{uuid4().hex[:10].upper()}",
        "debit": 99.99,
        "balance": 1000.00,
    }
    payload.update(overrides)
    return payload
