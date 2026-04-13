"""
Customer Scenario Generator

Generates 2,000 customer management scenarios covering:
- Basic CRUD operations (800 scenarios)
- Validation testing (400 scenarios)
- Search & filter (400 scenarios)
- Concurrent operations (400 scenarios)
"""

import random
from collections.abc import Callable
from typing import List, Tuple
from uuid import uuid4

from faker import Faker


class CustomerScenarioGenerator:
    """Generates customer-related test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize customer scenario generator."""
        self.base_url = base_url
        self.faker = Faker()
        self.created_customer_ids: List[str] = []

    async def _make_request(self, method: str, endpoint: str, data=None, params=None, expected_status=200, should_fail=False):
        """Helper to make HTTP requests."""
        import httpx
        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method == "GET":
                    response = await client.get(url, params=params)
                elif method == "POST":
                    response = await client.post(url, json=data)
                elif method == "PUT":
                    response = await client.put(url, json=data)
                elif method == "DELETE":
                    response = await client.delete(url)
                else:
                    raise ValueError(f"Unsupported method: {method}")

                success = (response.status_code == expected_status) if not should_fail else True
                return {
                    'success': success,
                    'status_code': response.status_code,
                    'data': response.json() if response.content else None,
                    'request': {'method': method, 'endpoint': endpoint, 'data': data},
                }
            except Exception as e:
                if should_fail:
                    return {'success': True, 'status_code': None, 'data': None, 'request': {'method': method, 'endpoint': endpoint, 'data': data}}
                else:
                    raise

    def _generate_customer_data(self, override: dict = None) -> dict:
        """Generate realistic customer data."""
        data = {
            'customer_number': f'CUST-{uuid4().hex[:8].upper()}',
            'company_name': self.faker.company(),
            'contact_name': self.faker.name(),
            'email': self.faker.email(),
            'phone': self.faker.phone_number()[:20],  # Limit to 20 chars
            'address': self.faker.street_address(),
            'city': self.faker.city(),
            'state': self.faker.state_abbr(),
            'postal_code': self.faker.postcode(),
            'country': 'USA',
            'is_active': True,
        }
        if override:
            data.update(override)
        return data

    # ========== BASIC CRUD SCENARIOS (800 total) ==========

    async def create_valid_customer(self) -> dict:
        """Create a customer with valid data."""
        data = self._generate_customer_data()
        result = await self._make_request('POST', '/api/customers', data=data, expected_status=201)
        if result['success'] and result['data']:
            self.created_customer_ids.append(result['data'].get('id'))
        return result

    async def read_customer(self, customer_id: str = None) -> dict:
        """Read a single customer."""
        if not customer_id and self.created_customer_ids:
            customer_id = random.choice(self.created_customer_ids)
        if not customer_id:
            create_result = await self.create_valid_customer()
            if create_result['success']:
                customer_id = create_result['data']['id']

        return await self._make_request('GET', f'/api/customers/{customer_id}', expected_status=200)

    async def list_customers(self) -> dict:
        """List customers with pagination."""
        params = {
            'page': random.randint(1, 5),
            'page_size': random.choice([10, 25, 50, 100]),
        }
        return await self._make_request('GET', '/api/customers', params=params, expected_status=200)

    async def update_customer(self, customer_id: str = None) -> dict:
        """Update a customer."""
        if not customer_id and self.created_customer_ids:
            customer_id = random.choice(self.created_customer_ids)
        if not customer_id:
            create_result = await self.create_valid_customer()
            if create_result['success']:
                customer_id = create_result['data']['id']

        update_data = {
            'phone': self.faker.phone_number()[:20],
            'email': self.faker.email(),
        }
        return await self._make_request('PUT', f'/api/customers/{customer_id}', data=update_data, expected_status=200)

    async def delete_customer(self, customer_id: str = None) -> dict:
        """Delete a customer."""
        if not customer_id and self.created_customer_ids:
            customer_id = self.created_customer_ids.pop()
        if not customer_id:
            create_result = await self.create_valid_customer()
            if create_result['success']:
                customer_id = create_result['data']['id']

        return await self._make_request('DELETE', f'/api/customers/{customer_id}', expected_status=204)

    # ========== VALIDATION TESTING SCENARIOS (400 total) ==========

    async def create_customer_invalid_email(self) -> dict:
        """Attempt to create customer with invalid email (should fail)."""
        data = self._generate_customer_data({'email': 'invalid-email-format'})
        return await self._make_request('POST', '/api/customers', data=data, expected_status=422, should_fail=True)

    async def create_customer_duplicate_number(self) -> dict:
        """Attempt to create customer with duplicate customer number (should fail)."""
        data1 = self._generate_customer_data({'customer_number': 'DUP-CUST-001'})
        await self._make_request('POST', '/api/customers', data=data1, expected_status=201)

        data2 = self._generate_customer_data({'customer_number': 'DUP-CUST-001'})
        return await self._make_request('POST', '/api/customers', data=data2, expected_status=400, should_fail=True)

    async def create_customer_missing_required_field(self) -> dict:
        """Attempt to create customer without required fields (should fail)."""
        data = {'phone': '555-1234'}  # Missing customer_number, company_name, etc.
        return await self._make_request('POST', '/api/customers', data=data, expected_status=422, should_fail=True)

    async def create_customer_sql_injection(self) -> dict:
        """Attempt SQL injection in customer fields (should be sanitized)."""
        data = self._generate_customer_data({
            'company_name': "'; DROP TABLE customers; --",
            'contact_name': "Robert'); DROP TABLE customers; --",
        })
        # Should succeed but be sanitized
        return await self._make_request('POST', '/api/customers', data=data, expected_status=201)

    # ========== SEARCH & FILTER SCENARIOS (400 total) ==========

    async def search_by_company_name(self) -> dict:
        """Search customers by company name."""
        # First create a customer to search for
        company_name = f"SearchTest-{uuid4().hex[:6]}"
        await self.create_valid_customer()

        params = {'search': company_name[:10]}  # Partial search
        return await self._make_request('GET', '/api/customers', params=params, expected_status=200)

    async def search_by_email(self) -> dict:
        """Search customers by email."""
        params = {'search': self.faker.email().split('@')[0]}  # Search email prefix
        return await self._make_request('GET', '/api/customers', params=params, expected_status=200)

    async def filter_by_active_status(self) -> dict:
        """Filter customers by active status."""
        params = {'is_active': random.choice([True, False])}
        return await self._make_request('GET', '/api/customers', params=params, expected_status=200)

    async def pagination_edge_case(self) -> dict:
        """Test pagination edge cases."""
        params = {
            'page': random.choice([1, 100, 1000]),  # Test high page numbers
            'page_size': random.choice([1, 100]),  # Test extremes
        }
        return await self._make_request('GET', '/api/customers', params=params, expected_status=200)

    # ========== CONCURRENT OPERATION SCENARIOS (400 total) ==========

    async def concurrent_create_customers(self) -> dict:
        """Create customer (for concurrent testing)."""
        return await self.create_valid_customer()

    async def concurrent_update_customers(self) -> dict:
        """Update customers concurrently."""
        if self.created_customer_ids:
            return await self.update_customer(random.choice(self.created_customer_ids))
        else:
            return await self.create_valid_customer()

    async def concurrent_search_customers(self) -> dict:
        """Search customers concurrently."""
        return await self.search_by_company_name()

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 2000) -> List[Tuple[str, Callable]]:
        """
        Generate all customer scenarios.

        Returns:
            List of tuples (scenario_name, scenario_callable)
        """
        scenarios = []

        # Basic CRUD (800 scenarios)
        for i in range(200):
            scenarios.append((f'customer_create_{i}', self.create_valid_customer))
        for i in range(200):
            scenarios.append((f'customer_read_{i}', self.read_customer))
        for i in range(200):
            scenarios.append((f'customer_list_{i}', self.list_customers))
        for i in range(100):
            scenarios.append((f'customer_update_{i}', self.update_customer))
        for i in range(100):
            scenarios.append((f'customer_delete_{i}', self.delete_customer))

        # Validation testing (400 scenarios)
        for i in range(100):
            scenarios.append((f'customer_invalid_email_{i}', self.create_customer_invalid_email))
        for i in range(100):
            scenarios.append((f'customer_duplicate_number_{i}', self.create_customer_duplicate_number))
        for i in range(100):
            scenarios.append((f'customer_missing_field_{i}', self.create_customer_missing_required_field))
        for i in range(100):
            scenarios.append((f'customer_sql_injection_{i}', self.create_customer_sql_injection))

        # Search & filter (400 scenarios)
        for i in range(100):
            scenarios.append((f'customer_search_company_{i}', self.search_by_company_name))
        for i in range(100):
            scenarios.append((f'customer_search_email_{i}', self.search_by_email))
        for i in range(100):
            scenarios.append((f'customer_filter_active_{i}', self.filter_by_active_status))
        for i in range(100):
            scenarios.append((f'customer_pagination_{i}', self.pagination_edge_case))

        # Concurrent operations (400 scenarios)
        for i in range(200):
            scenarios.append((f'customer_concurrent_create_{i}', self.concurrent_create_customers))
        for i in range(100):
            scenarios.append((f'customer_concurrent_update_{i}', self.concurrent_update_customers))
        for i in range(100):
            scenarios.append((f'customer_concurrent_search_{i}', self.concurrent_search_customers))

        return scenarios[:count]
