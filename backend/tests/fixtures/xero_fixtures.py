"""
Pytest fixtures for Xero API testing.

Provides reusable mock clients and test data.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""

import pytest

from src.testing.xero_mock import (
    XeroMockClient,
    XeroMockConfig,
    XeroMockMode,
    create_xero_mock,
)


@pytest.fixture
def xero_mock():
    """Basic Xero mock client in SUCCESS mode."""
    return create_xero_mock(mode=XeroMockMode.SUCCESS)


@pytest.fixture
def xero_mock_rate_limit():
    """Xero mock client that simulates rate limiting."""
    return create_xero_mock(mode=XeroMockMode.RATE_LIMIT)


@pytest.fixture
def xero_mock_timeout():
    """Xero mock client that simulates timeouts."""
    return create_xero_mock(mode=XeroMockMode.TIMEOUT)


@pytest.fixture
def xero_mock_server_error():
    """Xero mock client that simulates server errors."""
    return create_xero_mock(mode=XeroMockMode.SERVER_ERROR)


@pytest.fixture
def xero_mock_unauthorized():
    """Xero mock client that simulates unauthorized errors."""
    return create_xero_mock(mode=XeroMockMode.UNAUTHORIZED)


@pytest.fixture
def xero_mock_validation_error():
    """Xero mock client that simulates validation errors."""
    return create_xero_mock(mode=XeroMockMode.VALIDATION_ERROR)


@pytest.fixture
def xero_mock_intermittent():
    """Xero mock client with intermittent failures."""
    return create_xero_mock(
        mode=XeroMockMode.INTERMITTENT,
        failure_rate=0.5,  # 50% failure rate
    )


@pytest.fixture
def xero_mock_with_tracking():
    """Xero mock client with call tracking enabled."""
    return create_xero_mock(
        mode=XeroMockMode.SUCCESS,
        call_tracking=True,
    )


# Sample test data
@pytest.fixture
def sample_contact_data():
    """Sample Xero contact data."""
    return {
        "ContactID": "test-contact-id",
        "Name": "Test Customer",
        "EmailAddress": "test@example.com",
        "ContactStatus": "ACTIVE",
    }


@pytest.fixture
def sample_invoice_data():
    """Sample Xero invoice data."""
    return {
        "InvoiceID": "test-invoice-id",
        "InvoiceNumber": "INV-1001",
        "Type": "ACCREC",
        "Status": "DRAFT",
        "Total": 1100.00,
    }


@pytest.fixture
def sample_payment_data():
    """Sample Xero payment data."""
    return {
        "PaymentID": "test-payment-id",
        "Amount": 1100.00,
        "Status": "AUTHORISED",
    }
