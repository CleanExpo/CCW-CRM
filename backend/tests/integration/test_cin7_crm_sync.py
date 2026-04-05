"""Tests for Cin7 Phase 3 — customer, order, and quote sync.

Tests field mapping, status mapping, customer number generation,
and ERP-to-Cin7 payload construction.
"""

from datetime import UTC, datetime

import pytest

from src.db.demo_models import OrderStatus, QuoteStatus
from src.integrations.cin7.customer_sync import (
    extract_core_customer_fields,
    extract_omni_contact_fields,
    generate_customer_number,
    map_erp_customer_to_core,
    map_erp_customer_to_omni,
)
from src.integrations.cin7.sales_sync import (
    CIN7_CORE_ORDER_STATUS,
    CIN7_OMNI_ORDER_STATUS,
    CIN7_OMNI_QUOTE_STATUS,
    ERP_TO_CIN7_CORE_ORDER_STATUS,
    ERP_TO_CIN7_OMNI_QUOTE_STATUS,
    Cin7SalesSyncer,
    generate_order_number,
    generate_quote_number,
    map_cin7_core_order_status,
    map_cin7_omni_order_status,
    map_cin7_omni_quote_status,
    map_erp_order_to_core,
    map_erp_order_to_omni,
    map_erp_quote_to_omni,
)


class TestCoreCustomerFieldMapping:
    """Verify Cin7 Core customer dict maps to ERP Customer fields."""

    CORE_CUSTOMER = {
        "ID": "cust-001-uuid",
        "Name": "Queensland Civil Construction",
        "Status": "Active",
        "Contacts": [
            {
                "Name": "Dave Mitchell",
                "Email": "dave@qldcivil.com.au",
                "Phone": "0412 345 678",
                "Default": True,
            }
        ],
        "Addresses": [
            {
                "Line1": "42 Industrial Drive",
                "City": "Brendale",
                "State": "QLD",
                "Postcode": "4500",
                "Country": "Australia",
                "Type": "Business",
            }
        ],
    }

    def test_company_name(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["company_name"] == "Queensland Civil Construction"

    def test_contact_name(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["contact_name"] == "Dave Mitchell"

    def test_email(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["email"] == "dave@qldcivil.com.au"

    def test_phone(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["phone"] == "0412 345 678"

    def test_address(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["address"] == "42 Industrial Drive"

    def test_city(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["city"] == "Brendale"

    def test_state(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["state"] == "QLD"

    def test_postcode(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["postcode"] == "4500"

    def test_active_status(self):
        fields = extract_core_customer_fields(self.CORE_CUSTOMER)
        assert fields["is_active"] is True

    def test_inactive_status(self):
        inactive = {**self.CORE_CUSTOMER, "Status": "Inactive"}
        fields = extract_core_customer_fields(inactive)
        assert fields["is_active"] is False

    def test_empty_contacts_graceful(self):
        no_contacts = {**self.CORE_CUSTOMER, "Contacts": [], "Addresses": []}
        fields = extract_core_customer_fields(no_contacts)
        assert fields["contact_name"] == ""
        assert fields["email"] == ""
        assert fields["address"] is None


class TestOmniContactFieldMapping:
    """Verify Cin7 Omni contact dict maps to ERP Customer fields."""

    OMNI_CONTACT = {
        "id": 20001,
        "company": "Queensland Civil Construction",
        "firstName": "Dave",
        "lastName": "Mitchell",
        "email": "dave@qldcivil.com.au",
        "phone": "0412 345 678",
        "city": "Brendale",
        "state": "QLD",
        "postcode": "4500",
        "isActive": True,
        "type": "Customer",
    }

    def test_company_name(self):
        fields = extract_omni_contact_fields(self.OMNI_CONTACT)
        assert fields["company_name"] == "Queensland Civil Construction"

    def test_contact_name_combined(self):
        fields = extract_omni_contact_fields(self.OMNI_CONTACT)
        assert fields["contact_name"] == "Dave Mitchell"

    def test_email(self):
        fields = extract_omni_contact_fields(self.OMNI_CONTACT)
        assert fields["email"] == "dave@qldcivil.com.au"

    def test_is_active(self):
        fields = extract_omni_contact_fields(self.OMNI_CONTACT)
        assert fields["is_active"] is True

    def test_first_name_only(self):
        contact = {**self.OMNI_CONTACT, "lastName": ""}
        fields = extract_omni_contact_fields(contact)
        assert fields["contact_name"] == "Dave"

    def test_no_names(self):
        contact = {**self.OMNI_CONTACT, "firstName": "", "lastName": ""}
        fields = extract_omni_contact_fields(contact)
        assert fields["contact_name"] == ""


class TestCustomerNumberGeneration:
    """Verify customer number format."""

    def test_core_format(self):
        result = generate_customer_number("cust-001-uuid", "core")
        assert result == "CIN7-C-cust-001"

    def test_omni_format(self):
        result = generate_customer_number("20001", "omni")
        assert result == "CIN7-O-20001"

    def test_long_id_truncated(self):
        result = generate_customer_number("abcdefghijklmnop", "core")
        assert result == "CIN7-C-abcdefgh"

    def test_short_id(self):
        result = generate_customer_number("123", "omni")
        assert result == "CIN7-O-123"


class TestCoreOrderStatusMapping:
    """Verify Cin7 Core sale statuses map to ERP OrderStatus."""

    def test_draft(self):
        assert map_cin7_core_order_status("Draft") == OrderStatus.DRAFT

    def test_authorised(self):
        assert map_cin7_core_order_status("Authorised") == OrderStatus.CONFIRMED

    def test_ordered(self):
        assert map_cin7_core_order_status("Ordered") == OrderStatus.PROCESSING

    def test_dispatched(self):
        assert map_cin7_core_order_status("Dispatched") == OrderStatus.SHIPPED

    def test_completed(self):
        assert map_cin7_core_order_status("Completed") == OrderStatus.DELIVERED

    def test_voided(self):
        assert map_cin7_core_order_status("Voided") == OrderStatus.CANCELLED

    def test_unknown_defaults_to_pending(self):
        assert map_cin7_core_order_status("SomeNewStatus") == OrderStatus.PENDING

    def test_all_core_statuses_covered(self):
        assert len(CIN7_CORE_ORDER_STATUS) == 6


class TestOmniOrderStatusMapping:
    """Verify Cin7 Omni sale stages map to ERP OrderStatus."""

    def test_new(self):
        assert map_cin7_omni_order_status("New") == OrderStatus.PENDING

    def test_dispatched(self):
        assert map_cin7_omni_order_status("Dispatched") == OrderStatus.SHIPPED

    def test_completed(self):
        assert map_cin7_omni_order_status("Completed") == OrderStatus.DELIVERED

    def test_cancelled(self):
        assert map_cin7_omni_order_status("Cancelled") == OrderStatus.CANCELLED

    def test_unknown_defaults_to_pending(self):
        assert map_cin7_omni_order_status("Unknown") == OrderStatus.PENDING

    def test_all_omni_statuses_covered(self):
        assert len(CIN7_OMNI_ORDER_STATUS) == 4


class TestOmniQuoteStatusMapping:
    """Verify Cin7 Omni quote stages map to ERP QuoteStatus."""

    def test_pending(self):
        assert map_cin7_omni_quote_status("Pending") == QuoteStatus.SENT

    def test_accepted(self):
        assert map_cin7_omni_quote_status("Accepted") == QuoteStatus.ACCEPTED

    def test_declined(self):
        assert map_cin7_omni_quote_status("Declined") == QuoteStatus.REJECTED

    def test_expired(self):
        assert map_cin7_omni_quote_status("Expired") == QuoteStatus.EXPIRED

    def test_unknown_defaults_to_draft(self):
        assert map_cin7_omni_quote_status("Unknown") == QuoteStatus.DRAFT

    def test_all_omni_quote_statuses_covered(self):
        assert len(CIN7_OMNI_QUOTE_STATUS) == 4


class TestOrderNumberGeneration:
    """Verify order/quote number formats."""

    def test_core_order_number(self):
        assert generate_order_number("SO-2025-001", "core") == "C7C-SO-2025-001"

    def test_omni_order_number(self):
        assert generate_order_number("SO-2025-001", "omni") == "C7O-SO-2025-001"

    def test_quote_number(self):
        assert generate_quote_number("Q-2025-001") == "C7Q-Q-2025-001"


class TestERPToCoreSaleMapping:
    """Verify ERP Order maps to Cin7 Core sale payload."""

    class FakeOrder:
        order_number = "ORD-2025-001"
        status = "confirmed"
        total = 285549.00
        order_date = datetime(2025, 12, 1, tzinfo=UTC)
        notes = "Urgent delivery"

    def test_order_number(self):
        payload = map_erp_order_to_core(self.FakeOrder())
        assert payload["SaleOrderNumber"] == "ORD-2025-001"

    def test_status_maps_to_authorised(self):
        payload = map_erp_order_to_core(self.FakeOrder())
        assert payload["Status"] == "Authorised"

    def test_total(self):
        payload = map_erp_order_to_core(self.FakeOrder())
        assert payload["Total"] == 285549.00

    def test_date_format(self):
        payload = map_erp_order_to_core(self.FakeOrder())
        assert payload["OrderDate"] == "2025-12-01"


class TestERPToOmniOrderMapping:
    """Verify ERP Order maps to Cin7 Omni sales order payload."""

    class FakeOrder:
        order_number = "ORD-2025-001"
        status = "shipped"
        total = 1098.00
        order_date = datetime(2025, 12, 10, tzinfo=UTC)

    def test_reference(self):
        payload = map_erp_order_to_omni(self.FakeOrder())
        assert payload["reference"] == "ORD-2025-001"

    def test_stage_maps_to_dispatched(self):
        payload = map_erp_order_to_omni(self.FakeOrder())
        assert payload["stage"] == "Dispatched"


class TestERPToOmniQuoteMapping:
    """Verify ERP Quote maps to Cin7 Omni quote payload."""

    class FakeQuote:
        quote_number = "Q-2025-001"
        status = "sent"
        total = 1647.00
        valid_until = datetime(2026, 1, 15, tzinfo=UTC)
        quote_date = datetime(2025, 12, 12, tzinfo=UTC)

    def test_reference(self):
        payload = map_erp_quote_to_omni(self.FakeQuote())
        assert payload["reference"] == "Q-2025-001"

    def test_stage_maps_to_pending(self):
        payload = map_erp_quote_to_omni(self.FakeQuote())
        assert payload["stage"] == "Pending"

    def test_total(self):
        payload = map_erp_quote_to_omni(self.FakeQuote())
        assert payload["total"] == 1647.00


class TestERPToCorCustomerMapping:
    """Verify ERP Customer maps to Cin7 Core payload."""

    class FakeCustomer:
        company_name = "Queensland Civil Construction"
        contact_name = "Dave Mitchell"
        email = "dave@qldcivil.com.au"
        phone = "0412 345 678"
        address = "42 Industrial Drive"
        city = "Brendale"
        state = "QLD"
        postcode = "4500"
        is_active = True

    def test_name(self):
        payload = map_erp_customer_to_core(self.FakeCustomer())
        assert payload["Name"] == "Queensland Civil Construction"

    def test_contacts(self):
        payload = map_erp_customer_to_core(self.FakeCustomer())
        assert len(payload["Contacts"]) == 1
        assert payload["Contacts"][0]["Name"] == "Dave Mitchell"
        assert payload["Contacts"][0]["Email"] == "dave@qldcivil.com.au"

    def test_addresses(self):
        payload = map_erp_customer_to_core(self.FakeCustomer())
        assert len(payload["Addresses"]) == 1
        assert payload["Addresses"][0]["Line1"] == "42 Industrial Drive"
        assert payload["Addresses"][0]["Country"] == "Australia"

    def test_status_active(self):
        payload = map_erp_customer_to_core(self.FakeCustomer())
        assert payload["Status"] == "Active"

    def test_status_inactive(self):
        cust = self.FakeCustomer()
        cust.is_active = False
        payload = map_erp_customer_to_core(cust)
        assert payload["Status"] == "Inactive"


class TestERPToOmniContactMapping:
    """Verify ERP Customer maps to Cin7 Omni contact payload."""

    class FakeCustomer:
        company_name = "Queensland Civil Construction"
        contact_name = "Dave Mitchell"
        email = "dave@qldcivil.com.au"
        phone = "0412 345 678"
        city = "Brendale"
        state = "QLD"
        postcode = "4500"
        is_active = True

    def test_company(self):
        payload = map_erp_customer_to_omni(self.FakeCustomer())
        assert payload["company"] == "Queensland Civil Construction"

    def test_name_split(self):
        payload = map_erp_customer_to_omni(self.FakeCustomer())
        assert payload["firstName"] == "Dave"
        assert payload["lastName"] == "Mitchell"

    def test_country(self):
        payload = map_erp_customer_to_omni(self.FakeCustomer())
        assert payload["country"] == "Australia"

    def test_type_is_customer(self):
        payload = map_erp_customer_to_omni(self.FakeCustomer())
        assert payload["type"] == "Customer"


class TestSalesHelpers:
    """Verify sales sync static helpers."""

    def test_extract_core_order_id(self):
        order = {"SaleID": "sale-001", "SaleOrderNumber": "SO-001"}
        assert Cin7SalesSyncer._extract_order_id(order, "core") == "sale-001"

    def test_extract_omni_order_id(self):
        order = {"id": 30001, "reference": "SO-001"}
        assert Cin7SalesSyncer._extract_order_id(order, "omni") == "30001"

    def test_extract_core_order_ref(self):
        order = {"SaleOrderNumber": "SO-2025-001"}
        assert Cin7SalesSyncer._extract_order_ref(order, "core") == "SO-2025-001"

    def test_extract_omni_order_ref(self):
        order = {"reference": "SO-2025-001"}
        assert Cin7SalesSyncer._extract_order_ref(order, "omni") == "SO-2025-001"

    def test_extract_missing_id(self):
        assert Cin7SalesSyncer._extract_order_id({}, "core") is None
        assert Cin7SalesSyncer._extract_order_id({}, "omni") is None
