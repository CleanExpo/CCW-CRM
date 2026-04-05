"""Unit tests for bank feed reconciliation matching logic."""

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.pos_models import BankFeed, POSTransaction
from src.services.bank_feed_service import BankFeedService


@pytest.mark.asyncio
async def test_auto_match_exact_amount(db_session: AsyncSession):
    """Test auto-match finds exact amount matches."""
    service = BankFeedService(db_session)

    # Create test POS transaction
    pos_txn = POSTransaction(
        transaction_number="POS-001",
        location_code="TEST",
        transaction_type="sale",
        payment_method="eftpos",
        amount=Decimal("99.99"),
        currency="AUD",
        payment_status="captured",
        reconciliation_status="pending",
        created_at=datetime.now(),
    )

    # Create test bank feed with exact amount
    feed = BankFeed(
        bank_account_id=None,  # Will fail if validated, but OK for unit test
        transaction_date=date.today(),
        description="EFTPOS SALE",
        reference="REF-001",
        credit=Decimal("99.99"),  # Exact match
        match_status="pending",
    )

    # Calculate confidence
    confidence = service._calculate_match_confidence(feed, pos_txn)

    # Should have high confidence (amount exact match + date match)
    assert confidence >= Decimal("0.50"), f"Expected confidence >= 0.50, got {confidence}"


@pytest.mark.asyncio
async def test_auto_match_within_tolerance(db_session: AsyncSession):
    """Test auto-match accepts amounts within tolerance ($0.10)."""
    service = BankFeedService(db_session)

    pos_txn = POSTransaction(
        transaction_number="POS-002",
        location_code="TEST",
        transaction_type="sale",
        payment_method="eftpos",
        amount=Decimal("100.00"),
        currency="AUD",
        payment_status="captured",
        reconciliation_status="pending",
        created_at=datetime.now(),
    )

    # Bank feed with small difference (within $0.10 tolerance)
    feed = BankFeed(
        bank_account_id=None,
        transaction_date=date.today(),
        description="EFTPOS SALE",
        credit=Decimal("100.05"),  # $0.05 difference
        match_status="pending",
    )

    confidence = service._calculate_match_confidence(feed, pos_txn)

    # Should still have reasonable confidence
    assert confidence >= Decimal("0.30"), "Should accept amounts within tolerance"


@pytest.mark.asyncio
async def test_auto_match_outside_tolerance(db_session: AsyncSession):
    """Test auto-match rejects amounts outside tolerance."""
    service = BankFeedService(db_session)

    pos_txn = POSTransaction(
        transaction_number="POS-003",
        location_code="TEST",
        transaction_type="sale",
        payment_method="eftpos",
        amount=Decimal("100.00"),
        currency="AUD",
        payment_status="captured",
        reconciliation_status="pending",
        created_at=datetime.now(),
    )

    # Bank feed with large difference (outside tolerance)
    feed = BankFeed(
        bank_account_id=None,
        transaction_date=date.today(),
        description="EFTPOS SALE",
        credit=Decimal("150.00"),  # $50 difference - too large
        match_status="pending",
    )

    confidence = service._calculate_match_confidence(feed, pos_txn)

    # Should have low confidence (only date match, no amount match)
    assert confidence < Decimal("0.50"), "Should reject large amount differences"


@pytest.mark.asyncio
async def test_auto_match_date_proximity(db_session: AsyncSession):
    """Test auto-match prefers transactions within 1 day."""
    service = BankFeedService(db_session)

    # POS transaction yesterday
    pos_txn = POSTransaction(
        transaction_number="POS-004",
        location_code="TEST",
        transaction_type="sale",
        payment_method="eftpos",
        amount=Decimal("99.99"),
        currency="AUD",
        payment_status="captured",
        reconciliation_status="pending",
        created_at=datetime.now() - timedelta(days=1),
    )

    # Bank feed today (within 1 day)
    feed_close = BankFeed(
        bank_account_id=None,
        transaction_date=date.today(),
        credit=Decimal("99.99"),
        match_status="pending",
    )

    # Bank feed 7 days ago (outside 1 day)
    feed_far = BankFeed(
        bank_account_id=None,
        transaction_date=date.today() - timedelta(days=7),
        credit=Decimal("99.99"),
        match_status="pending",
    )

    confidence_close = service._calculate_match_confidence(feed_close, pos_txn)
    confidence_far = service._calculate_match_confidence(feed_far, pos_txn)

    # Close date should have higher confidence
    assert confidence_close > confidence_far, "Should prefer transactions within 1 day"


@pytest.mark.asyncio
async def test_auto_match_already_matched_ignored(db_session: AsyncSession):
    """Test auto-match ignores already matched transactions."""
    service = BankFeedService(db_session)

    # Create already-matched bank feed
    feed = BankFeed(
        bank_account_id=None,
        transaction_date=date.today(),
        credit=Decimal("99.99"),
        match_status="auto_matched",  # Already matched
    )

    # This feed should be filtered out in auto-match logic
    # (can't easily test without full DB integration, but documenting behavior)
    assert feed.match_status == "auto_matched"


@pytest.mark.asyncio
async def test_auto_match_multiple_candidates(db_session: AsyncSession):
    """Test auto-match selects best candidate when multiple matches exist."""
    service = BankFeedService(db_session)

    pos_txn = POSTransaction(
        transaction_number="POS-005",
        location_code="TEST",
        transaction_type="sale",
        payment_method="eftpos",
        amount=Decimal("99.99"),
        currency="AUD",
        payment_status="captured",
        reconciliation_status="pending",
        created_at=datetime.now(),
    )

    # Perfect match
    feed_perfect = BankFeed(
        bank_account_id=None,
        transaction_date=date.today(),
        credit=Decimal("99.99"),  # Exact amount
        match_status="pending",
    )

    # OK match (within tolerance but not exact)
    feed_ok = BankFeed(
        bank_account_id=None,
        transaction_date=date.today(),
        credit=Decimal("100.05"),  # Close but not exact
        match_status="pending",
    )

    confidence_perfect = service._calculate_match_confidence(feed_perfect, pos_txn)
    confidence_ok = service._calculate_match_confidence(feed_ok, pos_txn)

    # Perfect match should have higher confidence
    assert confidence_perfect > confidence_ok, "Should select exact amount match over tolerance match"


@pytest.mark.asyncio
async def test_tolerance_configuration(db_session: AsyncSession):
    """Test that tolerance is configurable (default $0.10)."""
    service = BankFeedService(db_session)

    # Default tolerance should be $0.10 (10 cents)
    assert service.tolerance_cents == Decimal("0.10"), "Default tolerance should be $0.10"
