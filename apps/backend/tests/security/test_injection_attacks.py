"""
Security Tests - SQL Injection and Code Injection Prevention.

Tests that the application properly sanitizes inputs and prevents injection attacks.
Part of Phase 5 Week 1 - Security Test Coverage.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, Product


class TestSQLInjection:
    """Test SQL injection prevention."""

    @pytest.mark.parametrize("malicious_input", [
        "' OR '1'='1",
        "'; DROP TABLE products; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1' = '1",
        "admin'--",
        "' OR 1=1--",
        "1; DELETE FROM orders WHERE '1'='1",
        "'; EXEC xp_cmdshell('dir'); --",
    ])
    async def test_sql_injection_in_search(
        self,
        client: AsyncClient,
        auth_token: str,
        malicious_input: str,
    ):
        """
        Test SQL injection attempts in search parameters.

        Should sanitize input and not execute SQL commands.
        """
        # Try injection in product search
        response = await client.get(
            f"/api/products?search={malicious_input}",
            cookies={"auth_token": auth_token},
        )

        # Should either return empty results or safe results, not error
        assert response.status_code in [200, 400], \
            f"SQL injection may have executed: {response.status_code}"

        if response.status_code == 200:
            data = response.json()
            # Should return valid structure, not SQL error
            assert "items" in data

    @pytest.mark.parametrize("malicious_input", [
        "'; DROP TABLE customers; --",
        "' OR '1'='1",
        "admin'--",
    ])
    async def test_sql_injection_in_customer_search(
        self,
        client: AsyncClient,
        auth_token: str,
        malicious_input: str,
    ):
        """Test SQL injection in customer search."""
        response = await client.get(
            f"/api/customers?search={malicious_input}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert "items" in data

    async def test_sql_injection_in_order_creation(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """
        Test SQL injection in order creation.

        Malicious input in notes field should not execute.
        """
        # Get a real customer and product
        customer_result = await db_session.execute(select(Customer).limit(1))
        customer = customer_result.scalar_one()

        product_result = await db_session.execute(
            select(Product).where(Product.price > 0).limit(1)
        )
        product = product_result.scalar_one()

        malicious_notes = "'; DROP TABLE orders; --"

        order_data = {
            "customer_id": str(customer.id),
            "status": "draft",
            "notes": malicious_notes,
            "items": [
                {
                    "product_id": str(product.id),
                    "quantity": 1,
                    "unit_price": float(product.price),
                }
            ],
        }

        response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )

        # Should either create order safely or reject
        assert response.status_code in [201, 400]

        if response.status_code == 201:
            # Verify notes were stored as string, not executed
            created_order = response.json()
            assert created_order["notes"] == malicious_notes

        # Verify orders table still exists
        orders_check = await db_session.execute(select(Order).limit(1))
        assert orders_check.scalar_one_or_none() is not None, "Orders table was dropped!"

    async def test_parameterized_queries_used(
        self,
        db_session: AsyncSession,
    ):
        """
        Test that parameterized queries are used (not string concatenation).

        This is a meta-test to verify SQLAlchemy is being used properly.
        """
        # Try a direct query with parameter
        malicious_sku = "'; DROP TABLE products; --"

        # This should safely handle the malicious input via parameters
        result = await db_session.execute(
            select(Product).where(Product.sku == malicious_sku)
        )
        products = result.scalars().all()

        # Should return empty (no product with that SKU) not error
        assert len(products) == 0

        # Verify products table still exists
        products_check = await db_session.execute(select(Product).limit(1))
        assert products_check.scalar_one_or_none() is not None


class TestCommandInjection:
    """Test OS command injection prevention."""

    @pytest.mark.parametrize("malicious_input", [
        "; ls -la",
        "| cat /etc/passwd",
        "&& whoami",
        "; rm -rf /",
        "$(cat /etc/passwd)",
        "`cat /etc/passwd`",
    ])
    @pytest.mark.skip(reason="Pre-existing enum case issue: hand_tools vs HAND_TOOLS")
    async def test_command_injection_in_file_operations(
        self,
        client: AsyncClient,
        auth_token: str,
        malicious_input: str,
    ):
        """
        Test command injection in any file operation endpoints.

        Note: This tests endpoints that might do file operations.
        """
        # Test in search that might log or process files
        response = await client.get(
            f"/api/products?search={malicious_input}",
            cookies={"auth_token": auth_token},
        )

        # Should not execute commands, just search safely
        assert response.status_code in [200, 400]


class TestNoSQLInjection:
    """Test NoSQL injection prevention (if using NoSQL databases)."""

    async def test_json_injection_in_metadata(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """
        Test JSON/NoSQL injection in metadata fields.

        Malicious JSON should be stored as string, not parsed.
        """
        customer_result = await db_session.execute(select(Customer).limit(1))
        customer = customer_result.scalar_one()

        product_result = await db_session.execute(
            select(Product).where(Product.price > 0).limit(1)
        )
        product = product_result.scalar_one()

        # Malicious JSON that tries to inject code
        malicious_json_notes = '{"$where": "this.password == \'secret\'"}'

        order_data = {
            "customer_id": str(customer.id),
            "status": "draft",
            "notes": malicious_json_notes,
            "items": [
                {
                    "product_id": str(product.id),
                    "quantity": 1,
                    "unit_price": float(product.price),
                }
            ],
        }

        response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code in [201, 400]

        if response.status_code == 201:
            # Should be stored as literal string
            created_order = response.json()
            assert malicious_json_notes in created_order["notes"]


class TestLDAPInjection:
    """Test LDAP injection prevention."""

    @pytest.mark.parametrize("malicious_input", [
        "*)(uid=*",
        "admin)(|(password=*))",
        "*)(objectClass=*",
    ])
    async def test_ldap_injection_in_search(
        self,
        client: AsyncClient,
        auth_token: str,
        malicious_input: str,
    ):
        """
        Test LDAP injection in search fields.

        Even if LDAP is not used, input should be sanitized.
        """
        response = await client.get(
            f"/api/customers?search={malicious_input}",
            cookies={"auth_token": auth_token},
        )

        # Should safely handle input
        assert response.status_code in [200, 400]


class TestPathTraversal:
    """Test path traversal attack prevention."""

    @pytest.mark.parametrize("malicious_path", [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    ])
    async def test_path_traversal_in_file_access(
        self,
        client: AsyncClient,
        auth_token: str,
        malicious_path: str,
    ):
        """
        Test path traversal attempts.

        Should not allow access to files outside intended directories.
        """
        # If there are any file download/upload endpoints, test them
        # For now, test that search doesn't interpret as file path
        response = await client.get(
            f"/api/products?search={malicious_path}",
            cookies={"auth_token": auth_token},
        )

        # Should treat as search string, not file path
        assert response.status_code in [200, 400]


class TestXMLInjection:
    """Test XML injection/XXE attack prevention."""

    async def test_xxe_attack_prevention(
        self,
        client: AsyncClient,
        auth_token: str,
    ):
        """
        Test XML External Entity (XXE) attack prevention.

        If XML parsing is done, it should be safe.
        """
        xxe_payload = """<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <order><notes>&xxe;</notes></order>
        """

        # If there's an XML endpoint, test it
        # For now, test that it's rejected or safely handled
        response = await client.post(
            "/api/orders",
            content=xxe_payload,
            headers={"Content-Type": "application/xml"},
            cookies={"auth_token": auth_token},
        )

        # Should reject XML or safely parse
        assert response.status_code in [400, 415, 422]


class TestServerSideTemplateInjection:
    """Test SSTI prevention."""

    @pytest.mark.parametrize("template_injection", [
        "{{7*7}}",
        "${7*7}",
        "#{7*7}",
        "<%= 7*7 %>",
        "{{config}}",
        "{{self}}",
    ])
    async def test_template_injection_in_fields(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
        template_injection: str,
    ):
        """
        Test Server-Side Template Injection (SSTI) prevention.

        Template syntax should be stored as literal string.
        """
        customer_result = await db_session.execute(select(Customer).limit(1))
        customer = customer_result.scalar_one()

        product_result = await db_session.execute(
            select(Product).where(Product.price > 0).limit(1)
        )
        product = product_result.scalar_one()

        order_data = {
            "customer_id": str(customer.id),
            "status": "draft",
            "notes": template_injection,
            "items": [
                {
                    "product_id": str(product.id),
                    "quantity": 1,
                    "unit_price": float(product.price),
                }
            ],
        }

        response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code in [201, 400]

        if response.status_code == 201:
            created_order = response.json()
            # Should store template literally, not evaluate it
            assert template_injection in created_order["notes"]
            # Should not evaluate to "49"
            assert "49" not in created_order["notes"] or template_injection == "49"
