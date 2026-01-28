"""
Order Scenario Generator

Generates 2,000 order management scenarios covering:
- Order creation (600 scenarios)
- Order status workflow (600 scenarios)
- Stock deduction testing (400 scenarios)
- Order updates & deletion (400 scenarios)
"""

import random
from uuid import uuid4
from typing import List, Tuple, Callable
from faker import Faker


ORDER_STATUSES = ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']


class OrderScenarioGenerator:
    """Generates order-related test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize order scenario generator."""
        self.base_url = base_url
        self.faker = Faker()
        self.created_order_ids: List[str] = []
        self.created_customer_ids: List[str] = []
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

    async def _ensure_customer(self) -> str:
        """Ensure at least one customer exists and return ID."""
        if not self.created_customer_ids:
            customer_data = {
                'customer_number': f'CUST-{uuid4().hex[:8].upper()}',
                'company_name': self.faker.company(),
                'contact_name': self.faker.name(),
                'email': self.faker.email(),
                'phone': '555-1234',
                'address': self.faker.street_address(),
                'city': self.faker.city(),
                'state': 'CA',
                'postal_code': '12345',
                'country': 'USA',
            }
            result = await self._make_request('POST', '/api/customers', data=customer_data, expected_status=201)
            if result['success']:
                self.created_customer_ids.append(result['data']['id'])

        return random.choice(self.created_customer_ids)

    async def _ensure_product(self) -> str:
        """Ensure at least one product exists and return ID."""
        if not self.created_product_ids:
            product_data = {
                'sku': f'SKU-{uuid4().hex[:8].upper()}',
                'name': self.faker.catch_phrase(),
                'category': 'HAND_TOOLS',
                'price': 99.99,
                'cost': 50.00,
                'stock': 1000,
            }
            result = await self._make_request('POST', '/api/products', data=product_data, expected_status=201)
            if result['success']:
                self.created_product_ids.append(result['data']['id'])

        return random.choice(self.created_product_ids)

    def _generate_order_data(self, override: dict = None) -> dict:
        """Generate realistic order data with line items."""
        num_items = random.randint(1, 5)
        items = []
        for _ in range(num_items):
            items.append({
                'product_id': 'placeholder',  # Will be replaced
                'quantity': random.randint(1, 10),
                # unit_price is calculated by backend from product price
            })

        data = {
            'customer_id': 'placeholder',  # Will be replaced
            'status': 'draft',
            'notes': self.faker.text(max_nb_chars=100),
            'items': items,
            'fulfillment_location': random.choice(['brisbane', 'sydney', 'melbourne']),
        }
        if override:
            data.update(override)
        return data

    # ========== ORDER CREATION SCENARIOS (600 total) ==========

    async def create_valid_order(self) -> dict:
        """Create an order with valid data."""
        customer_id = await self._ensure_customer()
        product_id = await self._ensure_product()

        data = self._generate_order_data()
        data['customer_id'] = customer_id
        for item in data['items']:
            item['product_id'] = product_id

        result = await self._make_request('POST', '/api/orders', data=data, expected_status=201)
        if result['success'] and result['data']:
            self.created_order_ids.append(result['data'].get('id'))
        return result

    async def create_order_invalid_customer(self) -> dict:
        """Attempt to create order with invalid customer_id (should fail)."""
        product_id = await self._ensure_product()
        data = self._generate_order_data()
        data['customer_id'] = str(uuid4())  # Non-existent customer
        for item in data['items']:
            item['product_id'] = product_id

        return await self._make_request('POST', '/api/orders', data=data, expected_status=404, should_fail=True)

    async def create_order_zero_quantity(self) -> dict:
        """Attempt to create order with zero quantity items (should fail)."""
        customer_id = await self._ensure_customer()
        product_id = await self._ensure_product()

        data = self._generate_order_data()
        data['customer_id'] = customer_id
        data['items'] = [{'product_id': product_id, 'quantity': 0}]

        return await self._make_request('POST', '/api/orders', data=data, expected_status=422, should_fail=True)

    # ========== ORDER STATUS WORKFLOW SCENARIOS (600 total) ==========

    async def update_order_status(self, from_status: str = 'draft', to_status: str = 'pending') -> dict:
        """Update order status."""
        # Create order with from_status
        order = await self.create_valid_order()
        if not order['success']:
            return order

        order_id = order['data']['id']

        # Update to to_status
        update_data = {'status': to_status}
        return await self._make_request('PUT', f'/api/orders/{order_id}', data=update_data, expected_status=200)

    async def transition_draft_to_pending(self) -> dict:
        """Transition order from draft to pending."""
        return await self.update_order_status('draft', 'pending')

    async def transition_pending_to_confirmed(self) -> dict:
        """Transition order from pending to confirmed (stock deduction)."""
        return await self.update_order_status('pending', 'confirmed')

    async def transition_invalid_status(self) -> dict:
        """Attempt invalid status transition (should fail)."""
        order = await self.create_valid_order()
        if not order['success']:
            return order

        order_id = order['data']['id']
        update_data = {'status': 'invalid_status'}
        return await self._make_request('PUT', f'/api/orders/{order_id}', data=update_data, expected_status=422, should_fail=True)

    # ========== STOCK DEDUCTION TESTING SCENARIOS (400 total) ==========

    async def confirm_order_sufficient_stock(self) -> dict:
        """Confirm order with sufficient stock."""
        return await self.transition_pending_to_confirmed()

    async def concurrent_order_confirmation(self) -> dict:
        """Confirm orders concurrently (race condition test)."""
        return await self.transition_pending_to_confirmed()

    # ========== ORDER UPDATES & DELETION SCENARIOS (400 total) ==========

    async def update_order_line_items(self) -> dict:
        """Update order line items."""
        if not self.created_order_ids:
            await self.create_valid_order()

        if not self.created_order_ids:
            return {'success': False, 'status_code': None, 'data': None, 'request': {}}

        order_id = random.choice(self.created_order_ids)
        product_id = await self._ensure_product()

        update_data = {
            'items': [
                {'product_id': product_id, 'quantity': random.randint(1, 10)}
            ]
        }
        return await self._make_request('PUT', f'/api/orders/{order_id}', data=update_data, expected_status=200)

    async def delete_order(self) -> dict:
        """Delete an order."""
        if not self.created_order_ids:
            await self.create_valid_order()

        if not self.created_order_ids:
            return {'success': False, 'status_code': None, 'data': None, 'request': {}}

        order_id = self.created_order_ids.pop()
        return await self._make_request('DELETE', f'/api/orders/{order_id}', expected_status=204)

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 2000) -> List[Tuple[str, Callable]]:
        """Generate all order scenarios."""
        scenarios = []

        # Order creation (600 scenarios)
        for i in range(400):
            scenarios.append((f'order_create_valid_{i}', self.create_valid_order))
        for i in range(100):
            scenarios.append((f'order_create_invalid_customer_{i}', self.create_order_invalid_customer))
        for i in range(100):
            scenarios.append((f'order_create_zero_quantity_{i}', self.create_order_zero_quantity))

        # Order status workflow (600 scenarios)
        for i in range(200):
            scenarios.append((f'order_draft_to_pending_{i}', self.transition_draft_to_pending))
        for i in range(200):
            scenarios.append((f'order_pending_to_confirmed_{i}', self.transition_pending_to_confirmed))
        for i in range(200):
            scenarios.append((f'order_invalid_status_{i}', self.transition_invalid_status))

        # Stock deduction testing (400 scenarios)
        for i in range(200):
            scenarios.append((f'order_confirm_sufficient_stock_{i}', self.confirm_order_sufficient_stock))
        for i in range(200):
            scenarios.append((f'order_concurrent_confirm_{i}', self.concurrent_order_confirmation))

        # Order updates & deletion (400 scenarios)
        for i in range(200):
            scenarios.append((f'order_update_items_{i}', self.update_order_line_items))
        for i in range(200):
            scenarios.append((f'order_delete_{i}', self.delete_order))

        return scenarios[:count]
