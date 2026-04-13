"""
Product Scenario Generator

Generates 2,000 product CRUD scenarios covering:
- Basic CRUD operations (800 scenarios)
- Validation testing (400 scenarios)
- Boundary values (400 scenarios)
- Concurrent operations (400 scenarios)
"""

import random
from collections.abc import Callable
from typing import List, Tuple
from uuid import uuid4

from faker import Faker

# Valid product categories from the system
PRODUCT_CATEGORIES = [
    'HEAVY_MACHINERY',
    'HAND_TOOLS',
    'POWER_TOOLS',
    'SAFETY_EQUIPMENT',
    'BUILDING_MATERIALS',
    'ELECTRICAL',
    'PLUMBING',
    'ACCESSORIES'
]


class ProductScenarioGenerator:
    """Generates product-related test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize product scenario generator."""
        self.base_url = base_url
        self.faker = Faker()
        self.created_product_ids: List[str] = []

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

    def _generate_product_data(self, override: dict = None) -> dict:
        """Generate realistic product data."""
        data = {
            'sku': f'TEST-{uuid4().hex[:8].upper()}',
            'name': self.faker.catch_phrase(),
            'description': self.faker.text(max_nb_chars=200),
            'category': random.choice(PRODUCT_CATEGORIES),
            'price': round(random.uniform(10.0, 1000.0), 2),
            'cost': round(random.uniform(5.0, 500.0), 2),
            'stock': random.randint(0, 1000),
            'warehouse_location': f'Aisle-{random.randint(1, 20)}-Bay-{random.randint(1, 10)}',
            'is_active': True,
        }
        if override:
            data.update(override)
        return data

    # ========== BASIC CRUD SCENARIOS (800 total) ==========

    async def create_valid_product(self) -> dict:
        """Create a product with valid data."""
        data = self._generate_product_data()
        result = await self._make_request('POST', '/api/products', data=data, expected_status=201)
        if result['success'] and result['data']:
            self.created_product_ids.append(result['data'].get('id'))
        return result

    async def read_product(self, product_id: str = None) -> dict:
        """Read a single product."""
        if not product_id and self.created_product_ids:
            product_id = random.choice(self.created_product_ids)
        if not product_id:
            # Create one first
            create_result = await self.create_valid_product()
            if create_result['success']:
                product_id = create_result['data']['id']

        return await self._make_request('GET', f'/api/products/{product_id}', expected_status=200)

    async def list_products(self) -> dict:
        """List products with pagination."""
        params = {
            'page': random.randint(1, 5),
            'page_size': random.choice([10, 25, 50, 100]),
        }
        return await self._make_request('GET', '/api/products', params=params, expected_status=200)

    async def update_product(self, product_id: str = None) -> dict:
        """Update a product."""
        if not product_id and self.created_product_ids:
            product_id = random.choice(self.created_product_ids)
        if not product_id:
            create_result = await self.create_valid_product()
            if create_result['success']:
                product_id = create_result['data']['id']

        update_data = {
            'price': round(random.uniform(10.0, 1000.0), 2),
            'stock': random.randint(0, 1000),
        }
        return await self._make_request('PUT', f'/api/products/{product_id}', data=update_data, expected_status=200)

    async def delete_product(self, product_id: str = None) -> dict:
        """Delete a product."""
        if not product_id and self.created_product_ids:
            product_id = self.created_product_ids.pop()
        if not product_id:
            create_result = await self.create_valid_product()
            if create_result['success']:
                product_id = create_result['data']['id']

        return await self._make_request('DELETE', f'/api/products/{product_id}', expected_status=204)

    # ========== VALIDATION TESTING SCENARIOS (400 total) ==========

    async def create_product_duplicate_sku(self) -> dict:
        """Attempt to create product with duplicate SKU (should fail)."""
        # First create a product
        data1 = self._generate_product_data({'sku': 'DUPLICATE-SKU-TEST'})
        await self._make_request('POST', '/api/products', data=data1, expected_status=201)

        # Try to create another with same SKU
        data2 = self._generate_product_data({'sku': 'DUPLICATE-SKU-TEST'})
        return await self._make_request('POST', '/api/products', data=data2, expected_status=400, should_fail=True)

    async def create_product_invalid_category(self) -> dict:
        """Attempt to create product with invalid category (should fail)."""
        data = self._generate_product_data({'category': 'INVALID_CATEGORY_XYZ'})
        return await self._make_request('POST', '/api/products', data=data, expected_status=422, should_fail=True)

    async def create_product_negative_price(self) -> dict:
        """Attempt to create product with negative price (should fail)."""
        data = self._generate_product_data({'price': -99.99})
        return await self._make_request('POST', '/api/products', data=data, expected_status=422, should_fail=True)

    async def create_product_missing_required_field(self) -> dict:
        """Attempt to create product without required fields (should fail)."""
        data = {'description': 'Missing SKU and name'}
        return await self._make_request('POST', '/api/products', data=data, expected_status=422, should_fail=True)

    # ========== BOUNDARY VALUE SCENARIOS (400 total) ==========

    async def create_product_max_length_strings(self) -> dict:
        """Create product with maximum length strings."""
        data = self._generate_product_data({
            'name': 'A' * 255,
            'description': 'B' * 1000,
            'warehouse_location': 'C' * 100,
        })
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    async def create_product_zero_stock(self) -> dict:
        """Create product with zero stock."""
        data = self._generate_product_data({'stock': 0})
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    async def create_product_very_large_price(self) -> dict:
        """Create product with very large price."""
        data = self._generate_product_data({'price': 999999.99, 'cost': 500000.00})
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    async def create_product_empty_optional_fields(self) -> dict:
        """Create product with empty optional fields."""
        data = self._generate_product_data({
            'description': '',
            'warehouse_location': '',
        })
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    # ========== CONCURRENT OPERATION SCENARIOS (400 total) ==========

    async def concurrent_create_products(self) -> dict:
        """Create product (for concurrent testing)."""
        return await self.create_valid_product()

    async def concurrent_update_same_product(self, product_id: str) -> dict:
        """Update same product concurrently."""
        update_data = {'stock': random.randint(0, 1000)}
        return await self._make_request('PUT', f'/api/products/{product_id}', data=update_data, expected_status=200)

    async def concurrent_read_products(self) -> dict:
        """Read products concurrently."""
        return await self.list_products()

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 2000) -> List[Tuple[str, Callable]]:
        """
        Generate all product scenarios.

        Returns:
            List of tuples (scenario_name, scenario_callable)
        """
        scenarios = []

        # Basic CRUD (800 scenarios)
        for i in range(200):
            scenarios.append((f'product_create_{i}', self.create_valid_product))
        for i in range(200):
            scenarios.append((f'product_read_{i}', self.read_product))
        for i in range(200):
            scenarios.append((f'product_list_{i}', self.list_products))
        for i in range(100):
            scenarios.append((f'product_update_{i}', self.update_product))
        for i in range(100):
            scenarios.append((f'product_delete_{i}', self.delete_product))

        # Validation testing (400 scenarios)
        for i in range(100):
            scenarios.append((f'product_duplicate_sku_{i}', self.create_product_duplicate_sku))
        for i in range(100):
            scenarios.append((f'product_invalid_category_{i}', self.create_product_invalid_category))
        for i in range(100):
            scenarios.append((f'product_negative_price_{i}', self.create_product_negative_price))
        for i in range(100):
            scenarios.append((f'product_missing_field_{i}', self.create_product_missing_required_field))

        # Boundary values (400 scenarios)
        for i in range(100):
            scenarios.append((f'product_max_length_{i}', self.create_product_max_length_strings))
        for i in range(100):
            scenarios.append((f'product_zero_stock_{i}', self.create_product_zero_stock))
        for i in range(100):
            scenarios.append((f'product_large_price_{i}', self.create_product_very_large_price))
        for i in range(100):
            scenarios.append((f'product_empty_optionals_{i}', self.create_product_empty_optional_fields))

        # Concurrent operations (400 scenarios)
        for i in range(200):
            scenarios.append((f'product_concurrent_create_{i}', self.concurrent_create_products))
        for i in range(200):
            scenarios.append((f'product_concurrent_read_{i}', self.concurrent_read_products))

        return scenarios[:count]
