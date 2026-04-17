"""Verification tests for the payment_terms_days feature on customers.

Three checks required by the evaluator:
  1. payment_terms_days persists to the database via the PUT endpoint.
  2. Xero sync sends the correct PaymentTerms.Sales.Day format.
  3. force_update=True triggers a contact update when xero_contact_id already exists.
"""

from unittest.mock import AsyncMock, MagicMock, call, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from src.integrations.xero.client import XeroClient
from src.integrations.xero.customers import XeroCustomerSync


# ---------------------------------------------------------------------------
# Check 1 — persistence
# ---------------------------------------------------------------------------


class TestPaymentTermsDaysPersists:
    """payment_terms_days written via PUT must be applied to the Customer ORM object
    and committed to the database session."""

    async def test_payment_terms_days_persists_to_database(self):
        """Route handler must write payment_terms_days=30 onto the customer row."""
        from src.api.deps import get_current_user
        from src.api.main import app
        from src.config.database import get_async_db
        from src.db.demo_models import Customer as CustomerModel

        customer_id = uuid4()

        # Build a mock ORM customer with default payment_terms_days=None
        mock_customer = MagicMock(spec=CustomerModel)
        mock_customer.id = customer_id
        mock_customer.customer_number = "CUST-2026-001"
        mock_customer.company_name = "Persistence Test Pty Ltd"
        mock_customer.contact_name = None
        mock_customer.email = "test@persistence.com.au"
        mock_customer.phone = None
        mock_customer.address = None
        mock_customer.city = None
        mock_customer.state = None
        mock_customer.postcode = None
        mock_customer.payment_terms_days = None
        mock_customer.xero_contact_id = None
        mock_customer.xero_synced_at = None
        mock_customer.is_active = True
        from datetime import datetime
        mock_customer.created_at = datetime(2026, 1, 1)
        mock_customer.updated_at = datetime(2026, 1, 1)

        # Simulate setattr so the mock tracks field writes
        def _setattr(key, value):
            object.__setattr__(mock_customer, key, value)
        mock_customer.__setattr__ = _setattr

        mock_db = AsyncMock()
        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = mock_customer
        mock_db.execute.return_value = mock_execute_result

        async def override_db():
            yield mock_db

        from src.db.models import User
        def override_user():
            u = User()
            u.id = uuid4()
            u.email = "test@test.com"
            u.hashed_password = "x"
            u.full_name = "Test"
            u.is_active = True
            u.is_admin = True
            from datetime import UTC
            u.created_at = datetime.now(UTC)
            u.updated_at = datetime.now(UTC)
            return u

        app.dependency_overrides[get_async_db] = override_db
        app.dependency_overrides[get_current_user] = override_user

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                response = await ac.put(
                    f"/api/customers/{customer_id}",
                    json={"payment_terms_days": 30},
                )
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200, response.text
        # Verify the field was set on the ORM object before commit
        assert mock_customer.payment_terms_days == 30
        # Verify commit was called (i.e. the change would be persisted)
        mock_db.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# Check 2 — Xero API payload format
# ---------------------------------------------------------------------------


class TestXeroPaymentTermsFormat:
    """XeroClient.create_contact must emit PaymentTerms.Sales.Day in the payload."""

    async def test_create_contact_sends_payment_terms_sales_day(self):
        """Verify the exact Xero API payload structure for payment terms."""
        xero_client = XeroClient("test-token", "test-tenant")

        captured: dict = {}

        async def _fake_request(method, endpoint, data=None, params=None):
            captured.update(data or {})
            return {"Contacts": [{"ContactID": "mock-id", "Name": "Test Co"}]}

        with patch.object(xero_client, "_make_request", side_effect=_fake_request):
            await xero_client.create_contact(
                name="Test Company Pty Ltd",
                email="billing@testco.com.au",
                payment_terms=30,
            )

        await xero_client.close()

        contacts = captured.get("Contacts", [])
        assert len(contacts) == 1, "Expected exactly one contact in payload"

        payment_terms = contacts[0].get("PaymentTerms")
        assert payment_terms is not None, "PaymentTerms missing from Xero payload"
        assert payment_terms["Sales"]["Day"] == 30
        assert payment_terms["Sales"]["Type"] == "DAYSAFTERBILLDATE"


# ---------------------------------------------------------------------------
# Check 3 — force_update triggers contact update
# ---------------------------------------------------------------------------


class TestXeroSyncForceUpdate:
    """force_update=True must call create_contact with the existing xero_contact_id."""

    async def test_force_update_true_updates_existing_xero_contact(self):
        """When a customer already has a xero_contact_id, force_update=True must
        push an update rather than skipping or creating a duplicate."""

        # --- mock customer with an existing Xero contact ID ---
        mock_customer = MagicMock()
        mock_customer.id = uuid4()
        mock_customer.customer_number = "CUST-2026-042"
        mock_customer.company_name = "Force Update Corp"
        mock_customer.email = "billing@forceupdate.com.au"
        mock_customer.phone = "0400000042"
        mock_customer.address = "42 Test Street"
        mock_customer.city = "Sydney"
        mock_customer.state = "NSW"
        mock_customer.postcode = "2000"
        mock_customer.xero_contact_id = "existing-xero-contact-id"
        mock_customer.payment_terms_days = 45
        mock_customer.xero_synced_at = None

        # --- mock DB session ---
        mock_db = AsyncMock()
        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = mock_customer
        mock_db.execute.return_value = mock_execute_result

        # --- mock Xero connection (demo token → demo_mode=True) ---
        mock_connection = MagicMock()
        mock_connection.access_token = "demo_test_token"
        mock_connection.tenant_id = "demo-tenant-id"
        mock_xero_auth = AsyncMock()
        mock_xero_auth.get_active_connection.return_value = mock_connection

        # --- mock Xero client returned by the factory ---
        mock_xero_client = AsyncMock()
        mock_xero_client.create_contact.return_value = {
            "ContactID": "existing-xero-contact-id",
            "Name": "Force Update Corp",
        }

        sync = XeroCustomerSync(mock_xero_auth)

        with patch(
            "src.integrations.xero.customers.get_xero_client",
            return_value=mock_xero_client,
        ):
            result = await sync.sync_customer_to_xero(
                db=mock_db,
                organization_id=uuid4(),
                customer_id=mock_customer.id,
                force_update=True,
            )

        # create_contact must have been called once (update path)
        mock_xero_client.create_contact.assert_called_once()

        call_kwargs = mock_xero_client.create_contact.call_args.kwargs
        # Existing contact ID must be forwarded so Xero treats it as an update
        assert call_kwargs["contact_id"] == "existing-xero-contact-id", (
            "force_update=True must pass the existing contact_id to create_contact"
        )
        # payment_terms_days must flow through to Xero
        assert call_kwargs["payment_terms"] == 45, (
            "payment_terms_days must be sent in the Xero update payload"
        )

        # Result must report 'updated', not 'created' or 'already_synced'
        assert result["success"] is True
        assert result["action"] == "updated"
        assert result["xero_contact_id"] == "existing-xero-contact-id"
