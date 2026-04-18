"""Tests for UNI-1821 (per-customer payment terms) and UNI-1831 (B2B/B2C type).

Covers:
- CustomerProfile SQLAlchemy model
- CustomerBase / CustomerUpdate schema fields
- Xero client create_contact() PaymentTerms injection
- tax_calculator.calculate_invoice_tax() customer_type → is_b2b wiring
- Route helper _merge_profile() / _upsert_profile()
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.db.crm_models import CustomerProfile, CustomerType
from src.db.schemas import Customer, CustomerBase, CustomerUpdate


# ---------------------------------------------------------------------------
# CustomerType enum
# ---------------------------------------------------------------------------


class TestCustomerTypeEnum:
    def test_b2b_value(self):
        assert CustomerType.B2B.value == "B2B"

    def test_b2c_value(self):
        assert CustomerType.B2C.value == "B2C"

    def test_is_str_enum(self):
        assert isinstance(CustomerType.B2B, str)


# ---------------------------------------------------------------------------
# Schema fields — CustomerBase
# ---------------------------------------------------------------------------


class TestCustomerBaseProfileFields:
    def test_default_customer_type(self):
        base = CustomerBase(customer_number="C001", company_name="Acme")
        assert base.customer_type == "B2B"

    def test_default_payment_terms_days(self):
        base = CustomerBase(customer_number="C001", company_name="Acme")
        assert base.payment_terms_days == 30

    def test_b2c_customer_type(self):
        base = CustomerBase(
            customer_number="C002",
            company_name="Consumer Co",
            customer_type="B2C",
            payment_terms_days=7,
        )
        assert base.customer_type == "B2C"
        assert base.payment_terms_days == 7

    def test_custom_payment_terms_60_days(self):
        base = CustomerBase(
            customer_number="C003",
            company_name="Trade Co",
            payment_terms_days=60,
        )
        assert base.payment_terms_days == 60


class TestCustomerUpdateProfileFields:
    def test_customer_type_optional(self):
        update = CustomerUpdate(customer_type="B2C")
        assert update.customer_type == "B2C"

    def test_payment_terms_optional(self):
        update = CustomerUpdate(payment_terms_days=14)
        assert update.payment_terms_days == 14

    def test_both_none_by_default(self):
        update = CustomerUpdate()
        assert update.customer_type is None
        assert update.payment_terms_days is None


# ---------------------------------------------------------------------------
# CustomerProfile SQLAlchemy model
# ---------------------------------------------------------------------------


class TestCustomerProfileModel:
    def test_tablename(self):
        assert CustomerProfile.__tablename__ == "customer_profile"

    def test_default_customer_type(self):
        cid = uuid4()
        profile = CustomerProfile(customer_id=cid)
        assert profile.customer_type == "B2B"

    def test_default_payment_terms_days(self):
        cid = uuid4()
        profile = CustomerProfile(customer_id=cid)
        assert profile.payment_terms_days == 30

    def test_repr(self):
        cid = uuid4()
        profile = CustomerProfile(customer_id=cid, customer_type="B2C", payment_terms_days=14)
        r = repr(profile)
        assert "B2C" in r
        assert "14" in r

    def test_b2b_b2c_custom_values(self):
        cid = uuid4()
        profile = CustomerProfile(customer_id=cid, customer_type="B2C", payment_terms_days=60)
        assert profile.customer_type == "B2C"
        assert profile.payment_terms_days == 60


# ---------------------------------------------------------------------------
# Xero client — create_contact PaymentTerms injection
# ---------------------------------------------------------------------------


class TestXeroClientPaymentTerms:
    @pytest.mark.asyncio
    async def test_payment_terms_injected_in_payload(self):
        """create_contact() includes PaymentTerms when payment_terms_days provided."""
        from src.integrations.xero.client import XeroClient

        client = XeroClient.__new__(XeroClient)
        captured: list[dict] = []

        async def fake_request(method, path, data=None, **kwargs):
            captured.append(data)
            return {"Contacts": [{"ContactID": "xero-123"}]}

        client._make_request = fake_request

        await client.create_contact(
            name="Trade Co",
            email="trade@example.com",
            payment_terms_days=30,
        )

        assert len(captured) == 1
        contact_payload = captured[0]["Contacts"][0]
        assert "PaymentTerms" in contact_payload
        pt = contact_payload["PaymentTerms"]
        assert pt["Sales"]["Day"] == 30
        assert pt["Sales"]["Type"] == "DAYSAFTERBILLDATE"

    @pytest.mark.asyncio
    async def test_no_payment_terms_when_none(self):
        """create_contact() omits PaymentTerms when payment_terms_days is None."""
        from src.integrations.xero.client import XeroClient

        client = XeroClient.__new__(XeroClient)
        captured: list[dict] = []

        async def fake_request(method, path, data=None, **kwargs):
            captured.append(data)
            return {"Contacts": [{"ContactID": "xero-456"}]}

        client._make_request = fake_request

        await client.create_contact(name="Anon Co")

        contact_payload = captured[0]["Contacts"][0]
        assert "PaymentTerms" not in contact_payload

    @pytest.mark.asyncio
    async def test_custom_terms_days_passed_through(self):
        """60-day terms are forwarded correctly."""
        from src.integrations.xero.client import XeroClient

        client = XeroClient.__new__(XeroClient)
        captured: list[dict] = []

        async def fake_request(method, path, data=None, **kwargs):
            captured.append(data)
            return {"Contacts": [{"ContactID": "xero-789"}]}

        client._make_request = fake_request

        await client.create_contact(name="Key Account", payment_terms_days=60)
        pt = captured[0]["Contacts"][0]["PaymentTerms"]["Sales"]
        assert pt["Day"] == 60


# ---------------------------------------------------------------------------
# tax_calculator — customer_type → is_b2b wiring (UNI-1831)
# ---------------------------------------------------------------------------


class TestTaxCalculatorB2BCustomerType:
    """Tests that calculate_invoice_tax() correctly wires customer_type to is_b2b."""

    def _make_mock_invoice(self, subtotal: Decimal = Decimal("100.00")):
        invoice = MagicMock()
        invoice.id = uuid4()
        invoice.subtotal = subtotal
        return invoice

    @pytest.mark.asyncio
    async def test_b2b_customer_type_sets_is_b2b_true(self):
        """customer_type='B2B' results in is_b2b=True in calculate_tax call."""
        from src.services.tax_calculator import calculate_invoice_tax

        invoice = self._make_mock_invoice()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = invoice
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.tax_calculator.calculate_tax") as mock_calc:
            mock_calc.return_value = MagicMock(
                gst=Decimal("0"), pst=Decimal("0"), hst=Decimal("0"),
                total_tax=Decimal("0"), breakdown=[],
            )
            await calculate_invoice_tax(mock_db, invoice.id, customer_type="B2B")
            _, kwargs = mock_calc.call_args
            assert kwargs.get("is_b2b") is True

    @pytest.mark.asyncio
    async def test_b2c_customer_type_sets_is_b2b_false(self):
        """customer_type='B2C' results in is_b2b=False in calculate_tax call."""
        from src.services.tax_calculator import calculate_invoice_tax

        invoice = self._make_mock_invoice()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = invoice
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.tax_calculator.calculate_tax") as mock_calc:
            mock_calc.return_value = MagicMock(
                gst=Decimal("0"), pst=Decimal("0"), hst=Decimal("0"),
                total_tax=Decimal("0"), breakdown=[],
            )
            await calculate_invoice_tax(mock_db, invoice.id, customer_type="B2C")
            _, kwargs = mock_calc.call_args
            assert kwargs.get("is_b2b") is False

    @pytest.mark.asyncio
    async def test_none_customer_type_defaults_to_false(self):
        """Omitting customer_type keeps is_b2b=False (backward compatible)."""
        from src.services.tax_calculator import calculate_invoice_tax

        invoice = self._make_mock_invoice()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = invoice
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("src.services.tax_calculator.calculate_tax") as mock_calc:
            mock_calc.return_value = MagicMock(
                gst=Decimal("0"), pst=Decimal("0"), hst=Decimal("0"),
                total_tax=Decimal("0"), breakdown=[],
            )
            await calculate_invoice_tax(mock_db, invoice.id)
            _, kwargs = mock_calc.call_args
            assert kwargs.get("is_b2b") is False


# ---------------------------------------------------------------------------
# Route helpers — _merge_profile / _upsert_profile
# ---------------------------------------------------------------------------


class TestMergeProfile:
    def _make_customer_model(self) -> MagicMock:
        c = MagicMock()
        c.id = uuid4()
        c.customer_number = "C001"
        c.company_name = "Acme Ltd"
        c.contact_name = "Jane"
        c.email = "jane@acme.com"
        c.phone = None
        c.address = None
        c.city = None
        c.state = None
        c.postcode = None
        c.xero_contact_id = None
        c.xero_synced_at = None
        c.is_active = True
        c.organization_id = None
        from datetime import UTC, datetime
        c.created_at = datetime.now(UTC)
        c.updated_at = datetime.now(UTC)
        return c

    def test_merge_uses_profile_customer_type(self):
        from src.api.routes.customers import _merge_profile

        customer = self._make_customer_model()
        profile = MagicMock(spec=CustomerProfile)
        profile.customer_type = "B2C"
        profile.payment_terms_days = 14

        result = _merge_profile(customer, profile)
        assert result.customer_type == "B2C"
        assert result.payment_terms_days == 14

    def test_merge_no_profile_uses_defaults(self):
        from src.api.routes.customers import _merge_profile

        customer = self._make_customer_model()
        result = _merge_profile(customer, None)
        assert result.customer_type == "B2B"
        assert result.payment_terms_days == 30
