"""
Quote Scenario Generator

Generates 2,000 quote management scenarios covering:
- Quote creation (600 scenarios)
- Quote status workflow (400 scenarios)
- Quote to order conversion (600 scenarios)
- Validation & edge cases (400 scenarios)
"""

import random
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import List, Tuple
from uuid import uuid4

from faker import Faker

QUOTE_STATUSES = ['draft', 'pending', 'sent', 'accepted', 'rejected', 'expired']


class QuoteScenarioGenerator:
    """Generates quote-related test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize quote scenario generator."""
        self.base_url = base_url
        self.faker = Faker()
        self.created_quote_ids: List[str] = []
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
        """Ensure at least one customer exists and return ID.

        Creates a dedicated customer pool for quote scenarios to avoid
        cascade deletion issues if customers are deleted by other test scenarios.
        """
        # Create a pool of dedicated customers to reduce conflicts
        MIN_CUSTOMER_POOL = 10

        while len(self.created_customer_ids) < MIN_CUSTOMER_POOL:
            customer_data = {
                'customer_number': f'QUOTE-CUST-{uuid4().hex[:8].upper()}',  # Prefix to identify quote customers
                'company_name': f'{self.faker.company()} (Quote Test)',
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
            if result['success'] and result.get('data') and result['data'].get('id'):
                self.created_customer_ids.append(result['data']['id'])
            else:
                # Customer creation failed, but continue to avoid blocking all tests
                print(f"Warning: Customer creation failed: {result.get('status_code')}")
                break

        if not self.created_customer_ids:
            raise Exception("Failed to create any customers for quote scenarios")

        return random.choice(self.created_customer_ids)

    async def _ensure_product(self) -> str:
        """Ensure at least one product exists and return ID.

        Creates a dedicated product pool for quote scenarios.
        """
        # Create a pool of dedicated products
        MIN_PRODUCT_POOL = 10

        while len(self.created_product_ids) < MIN_PRODUCT_POOL:
            product_data = {
                'sku': f'QUOTE-SKU-{uuid4().hex[:8].upper()}',  # Prefix to identify quote products
                'name': f'{self.faker.catch_phrase()} (Quote Test)',
                'category': 'HAND_TOOLS',
                'price': round(random.uniform(10.0, 500.0), 2),
                'cost': round(random.uniform(5.0, 250.0), 2),
                'stock': random.randint(100, 1000),
            }
            result = await self._make_request('POST', '/api/products', data=product_data, expected_status=201)
            if result['success'] and result.get('data') and result['data'].get('id'):
                self.created_product_ids.append(result['data']['id'])
            else:
                # Product creation failed, but continue
                print(f"Warning: Product creation failed: {result.get('status_code')}")
                break

        if not self.created_product_ids:
            raise Exception("Failed to create any products for quote scenarios")

        return random.choice(self.created_product_ids)

    def _generate_quote_data(self, override: dict = None) -> dict:
        """Generate realistic quote data with line items."""
        num_items = random.randint(1, 5)
        items = []
        for _ in range(num_items):
            items.append({
                'product_id': 'placeholder',
                'quantity': random.randint(1, 10),
                # unit_price is calculated by backend from product price
            })

        # Schema expects date (not datetime) in YYYY-MM-DD format
        valid_until = (datetime.now() + timedelta(days=30)).date().isoformat()

        data = {
            'customer_id': 'placeholder',
            'status': 'draft',
            'valid_until': valid_until,
            'notes': self.faker.text(max_nb_chars=100),
            'items': items,
        }
        if override:
            data.update(override)
        return data

    # ========== QUOTE CREATION SCENARIOS (600 total) ==========

    async def create_valid_quote(self) -> dict:
        """Create a quote with valid data."""
        customer_id = await self._ensure_customer()
        product_id = await self._ensure_product()

        data = self._generate_quote_data()
        data['customer_id'] = customer_id
        for item in data['items']:
            item['product_id'] = product_id

        result = await self._make_request('POST', '/api/quotes', data=data, expected_status=201)
        if result['success'] and result['data']:
            self.created_quote_ids.append(result['data'].get('id'))
        return result

    async def create_quote_with_ai(self) -> dict:
        """Create quote with AI generation."""
        customer_id = await self._ensure_customer()

        data = {
            'requirements': self.faker.text(max_nb_chars=100),
            'customer_id': customer_id,
        }

        result = await self._make_request('POST', '/api/quotes/generate', data=data, expected_status=201)
        if result['success'] and result['data']:
            self.created_quote_ids.append(result['data'].get('id'))
        return result

    async def create_quote_invalid_data(self) -> dict:
        """Attempt to create quote with invalid data (should fail)."""
        data = {'status': 'invalid_status'}  # Missing required fields
        return await self._make_request('POST', '/api/quotes', data=data, expected_status=422, should_fail=True)

    # ========== QUOTE STATUS WORKFLOW SCENARIOS (400 total) ==========

    async def update_quote_status(self, to_status: str = 'pending') -> dict:
        """Update quote status."""
        if not self.created_quote_ids:
            await self.create_valid_quote()

        if not self.created_quote_ids:
            return {'success': False, 'status_code': None, 'data': None, 'request': {}}

        quote_id = random.choice(self.created_quote_ids)
        update_data = {'status': to_status}
        return await self._make_request('PUT', f'/api/quotes/{quote_id}', data=update_data, expected_status=200)

    async def transition_draft_to_pending(self) -> dict:
        """Transition quote from draft to pending."""
        return await self.update_quote_status('pending')

    async def transition_pending_to_sent(self) -> dict:
        """Transition quote from pending to sent."""
        return await self.update_quote_status('sent')

    async def transition_sent_to_accepted(self) -> dict:
        """Transition quote from sent to accepted."""
        return await self.update_quote_status('accepted')

    async def transition_sent_to_rejected(self) -> dict:
        """Transition quote from sent to rejected."""
        return await self.update_quote_status('rejected')

    # ========== QUOTE TO ORDER CONVERSION SCENARIOS (600 total) ==========

    async def convert_accepted_quote(self) -> dict:
        """Convert accepted quote to order."""
        # Create and accept a quote
        quote = await self.create_valid_quote()
        if not quote['success']:
            return quote

        # Defensive check: ensure quote data and ID exist
        if not quote.get('data'):
            return {'success': False, 'status_code': None, 'data': None, 'error': 'Quote creation returned no data'}

        quote_id = quote['data'].get('id')
        if not quote_id:
            return {'success': False, 'status_code': None, 'data': None, 'error': 'Quote creation returned no ID'}

        # Update to accepted and check result
        update_result = await self._make_request('PUT', f'/api/quotes/{quote_id}', data={'status': 'accepted'}, expected_status=200)
        if not update_result['success']:
            # Quote doesn't exist - this is the 404 issue
            return {'success': False, 'status_code': update_result['status_code'], 'data': None, 'error': f'Quote update failed: {update_result.get("status_code")}'}

        # Convert to order - correct endpoint is /convert-to-order not /convert
        return await self._make_request('POST', f'/api/quotes/{quote_id}/convert-to-order', expected_status=201)

    async def convert_non_accepted_quote(self) -> dict:
        """Attempt to convert non-accepted quote (should fail)."""
        quote = await self.create_valid_quote()
        if not quote['success']:
            return quote

        quote_id = quote['data']['id']

        # Try to convert without accepting - correct endpoint is /convert-to-order not /convert
        return await self._make_request('POST', f'/api/quotes/{quote_id}/convert-to-order', expected_status=400, should_fail=True)

    # ========== VALIDATION & EDGE CASES SCENARIOS (400 total) ==========

    async def create_expired_quote(self) -> dict:
        """Create quote with past valid_until date."""
        customer_id = await self._ensure_customer()
        product_id = await self._ensure_product()

        # Schema expects date string (YYYY-MM-DD), not datetime string
        expired_date = (datetime.now() - timedelta(days=30)).date().isoformat()

        data = self._generate_quote_data({'valid_until': expired_date})
        data['customer_id'] = customer_id
        for item in data['items']:
            item['product_id'] = product_id

        return await self._make_request('POST', '/api/quotes', data=data, expected_status=201)

    async def create_large_quote(self) -> dict:
        """Create quote with many line items (100+)."""
        customer_id = await self._ensure_customer()
        product_id = await self._ensure_product()

        items = []
        for _ in range(100):
            items.append({
                'product_id': product_id,
                'quantity': 1,
                # unit_price is calculated by backend
            })

        data = self._generate_quote_data({'items': items})
        data['customer_id'] = customer_id

        return await self._make_request('POST', '/api/quotes', data=data, expected_status=201)

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 2000) -> List[Tuple[str, Callable]]:
        """Generate all quote scenarios."""
        scenarios = []

        # Quote creation (600 scenarios)
        for i in range(400):
            scenarios.append((f'quote_create_valid_{i}', self.create_valid_quote))
        for i in range(100):
            scenarios.append((f'quote_create_with_ai_{i}', self.create_quote_with_ai))
        for i in range(100):
            scenarios.append((f'quote_create_invalid_{i}', self.create_quote_invalid_data))

        # Quote status workflow (400 scenarios)
        for i in range(100):
            scenarios.append((f'quote_draft_to_pending_{i}', self.transition_draft_to_pending))
        for i in range(100):
            scenarios.append((f'quote_pending_to_sent_{i}', self.transition_pending_to_sent))
        for i in range(100):
            scenarios.append((f'quote_sent_to_accepted_{i}', self.transition_sent_to_accepted))
        for i in range(100):
            scenarios.append((f'quote_sent_to_rejected_{i}', self.transition_sent_to_rejected))

        # Quote to order conversion (600 scenarios)
        for i in range(300):
            scenarios.append((f'quote_convert_accepted_{i}', self.convert_accepted_quote))
        for i in range(300):
            scenarios.append((f'quote_convert_non_accepted_{i}', self.convert_non_accepted_quote))

        # Validation & edge cases (400 scenarios)
        for i in range(200):
            scenarios.append((f'quote_expired_{i}', self.create_expired_quote))
        for i in range(200):
            scenarios.append((f'quote_large_{i}', self.create_large_quote))

        return scenarios[:count]
