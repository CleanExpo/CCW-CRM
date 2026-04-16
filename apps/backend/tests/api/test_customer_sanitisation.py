"""Tests for customer input sanitisation — UNI-1783."""

from src.db.schemas import CustomerCreate, CustomerUpdate


class TestCustomerSanitisation:
    """Verify XSS payloads are escaped in customer schemas."""

    def test_xss_in_company_name_is_escaped(self):
        c = CustomerCreate(
            customer_number="CUST-001",
            company_name="<script>alert('xss')</script>",
        )
        assert "<script>" not in c.company_name
        assert "&lt;script&gt;" in c.company_name

    def test_sql_injection_in_customer_number_has_quotes_escaped(self):
        c = CustomerCreate(
            customer_number="'; DROP TABLE customers; --",
            company_name="Test Corp",
        )
        # html.escape handles XSS; SQL injection is prevented by parameterised queries
        assert "&#x27;" in c.customer_number  # apostrophe escaped
        assert c.customer_number == "&#x27;; DROP TABLE customers; --"

    def test_clean_input_unchanged(self):
        c = CustomerCreate(
            customer_number="CUST-002",
            company_name="Davis Corp General Contracting",
        )
        assert c.company_name == "Davis Corp General Contracting"
        assert c.customer_number == "CUST-002"

    def test_whitespace_stripped(self):
        c = CustomerCreate(
            customer_number="  CUST-003  ",
            company_name="  Acme  ",
        )
        assert c.customer_number == "CUST-003"
        assert c.company_name == "Acme"

    def test_optional_fields_sanitised(self):
        c = CustomerCreate(
            customer_number="CUST-004",
            company_name="Test",
            contact_name="<b>Bold</b>",
            address="<img src=x onerror=alert(1)>",
            city="<marquee>Sydney</marquee>",
        )
        assert "<b>" not in c.contact_name
        assert "<img" not in c.address
        assert "<marquee>" not in c.city

    def test_none_values_pass_through(self):
        c = CustomerCreate(
            customer_number="CUST-005",
            company_name="Test",
            contact_name=None,
        )
        assert c.contact_name is None

    def test_update_schema_sanitised(self):
        u = CustomerUpdate(company_name="<script>alert(1)</script>")
        assert "<script>" not in u.company_name
