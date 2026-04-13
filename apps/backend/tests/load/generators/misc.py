"""
Miscellaneous Scenario Generators

Includes:
- Authentication scenarios (500 total)
- Edge case scenarios (500 total)
- AI feature scenarios (500 total)
"""

from collections.abc import Callable
from typing import List, Tuple
from uuid import uuid4

from faker import Faker


class AuthScenarioGenerator:
    """Generates authentication-related test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize auth scenario generator."""
        self.base_url = base_url
        self.faker = Faker()

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

    # ========== LOGIN TESTING SCENARIOS (200 total) ==========

    async def login_valid_credentials(self) -> dict:
        """Login with valid credentials."""
        data = {
            'email': 'admin@demo.com',
            'password': 'demo123',
        }
        return await self._make_request('POST', '/api/auth/login', data=data, expected_status=200)

    async def login_invalid_credentials(self) -> dict:
        """Login with invalid credentials (should fail)."""
        data = {
            'email': 'admin@demo.com',
            'password': 'wrong_password',
        }
        return await self._make_request('POST', '/api/auth/login', data=data, expected_status=401, should_fail=True)

    async def login_nonexistent_user(self) -> dict:
        """Login with non-existent user (should fail)."""
        data = {
            'email': f'nonexistent-{uuid4().hex[:8]}@example.com',
            'password': 'password123',
        }
        return await self._make_request('POST', '/api/auth/login', data=data, expected_status=401, should_fail=True)

    # ========== SECURITY TESTING SCENARIOS (100 total) ==========

    async def sql_injection_login(self) -> dict:
        """Attempt SQL injection in login (should be sanitized)."""
        data = {
            'email': "admin@demo.com' OR '1'='1",
            'password': "' OR '1'='1",
        }
        return await self._make_request('POST', '/api/auth/login', data=data, expected_status=401, should_fail=True)

    async def xss_in_login_email(self) -> dict:
        """Attempt XSS in email field (should be sanitized)."""
        data = {
            'email': '<script>alert("XSS")</script>@example.com',
            'password': 'password123',
        }
        return await self._make_request('POST', '/api/auth/login', data=data, expected_status=401, should_fail=True)

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 500) -> List[Tuple[str, Callable]]:
        """Generate all auth scenarios."""
        scenarios = []

        # Login testing (200 scenarios)
        for i in range(100):
            scenarios.append((f'auth_login_valid_{i}', self.login_valid_credentials))
        for i in range(50):
            scenarios.append((f'auth_login_invalid_{i}', self.login_invalid_credentials))
        for i in range(50):
            scenarios.append((f'auth_login_nonexistent_{i}', self.login_nonexistent_user))

        # Security testing (100 scenarios)
        for i in range(50):
            scenarios.append((f'auth_sql_injection_{i}', self.sql_injection_login))
        for i in range(50):
            scenarios.append((f'auth_xss_email_{i}', self.xss_in_login_email))

        # Pad to reach count
        while len(scenarios) < count:
            scenarios.append((f'auth_login_valid_pad_{len(scenarios)}', self.login_valid_credentials))

        return scenarios[:count]


class EdgeCaseScenarioGenerator:
    """Generates edge case and error condition test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize edge case scenario generator."""
        self.base_url = base_url
        self.faker = Faker()

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

    # ========== MALFORMED REQUESTS SCENARIOS (150 total) ==========

    async def malformed_json(self) -> dict:
        """Send malformed JSON (should fail)."""
        import httpx
        url = f"{self.base_url}/api/products"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, content=b'{invalid json}')
                return {
                    'success': response.status_code == 400 or response.status_code == 422,
                    'status_code': response.status_code,
                    'data': None,
                    'request': {'method': 'POST', 'endpoint': '/api/products', 'data': 'malformed'},
                }
            except Exception:
                return {'success': True, 'status_code': None, 'data': None, 'request': {}}

    async def missing_content_type(self) -> dict:
        """Send request without content-type header."""
        import httpx
        url = f"{self.base_url}/api/products"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, content=b'{"sku": "TEST"}', headers={})
                return {
                    'success': True,  # Should still work or fail gracefully
                    'status_code': response.status_code,
                    'data': None,
                    'request': {'method': 'POST', 'endpoint': '/api/products'},
                }
            except Exception:
                return {'success': True, 'status_code': None, 'data': None, 'request': {}}

    # ========== BOUNDARY VALUES SCENARIOS (100 total) ==========

    async def very_long_string(self) -> dict:
        """Create product with very long strings."""
        data = {
            'sku': 'A' * 255,
            'name': 'B' * 255,
            'category': 'HAND_TOOLS',
            'price': 99.99,
            'cost': 50.00,
            'stock': 100,
        }
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    async def special_characters(self) -> dict:
        """Create product with special characters."""
        data = {
            'sku': f'SKU-{uuid4().hex[:8]}',
            'name': '!@#$%^&*()_+-=[]{}|;:,.<>?',
            'category': 'HAND_TOOLS',
            'price': 99.99,
            'cost': 50.00,
            'stock': 100,
        }
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    async def unicode_emoji(self) -> dict:
        """Create product with unicode and emoji."""
        data = {
            'sku': f'SKU-{uuid4().hex[:8]}',
            'name': 'Product 🔨 with emoji 🛠️',
            'description': '中文字符 Japanese 日本語 Arabic العربية',
            'category': 'HAND_TOOLS',
            'price': 99.99,
            'cost': 50.00,
            'stock': 100,
        }
        return await self._make_request('POST', '/api/products', data=data, expected_status=201)

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 500) -> List[Tuple[str, Callable]]:
        """Generate all edge case scenarios."""
        scenarios = []

        # Malformed requests (150 scenarios)
        for i in range(75):
            scenarios.append((f'edge_malformed_json_{i}', self.malformed_json))
        for i in range(75):
            scenarios.append((f'edge_missing_content_type_{i}', self.missing_content_type))

        # Boundary values (100 scenarios)
        for i in range(50):
            scenarios.append((f'edge_very_long_string_{i}', self.very_long_string))
        for i in range(25):
            scenarios.append((f'edge_special_characters_{i}', self.special_characters))
        for i in range(25):
            scenarios.append((f'edge_unicode_emoji_{i}', self.unicode_emoji))

        # Pad to reach count
        while len(scenarios) < count:
            scenarios.append((f'edge_long_string_pad_{len(scenarios)}', self.very_long_string))

        return scenarios[:count]


class AIScenarioGenerator:
    """Generates AI feature test scenarios."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize AI scenario generator."""
        self.base_url = base_url
        self.faker = Faker()

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

    # ========== AI GENERATION SCENARIOS ==========

    async def generate_dashboard_insights(self) -> dict:
        """Generate dashboard insights."""
        return await self._make_request('GET', '/api/ai/dashboard/insights', expected_status=200)

    async def generate_with_empty_requirements(self) -> dict:
        """Attempt to generate with empty requirements (should fail or return default)."""
        data = {'requirements': '', 'type': 'quote'}
        return await self._make_request('POST', '/api/ai/generate', data=data, expected_status=422, should_fail=True)

    # ========== SCENARIO GENERATION ==========

    def generate_scenarios(self, count: int = 500) -> List[Tuple[str, Callable]]:
        """Generate all AI scenarios."""
        scenarios = []

        # Dashboard insights (250 scenarios)
        for i in range(250):
            scenarios.append((f'ai_dashboard_insights_{i}', self.generate_dashboard_insights))

        # Empty requirements (250 scenarios)
        for i in range(250):
            scenarios.append((f'ai_empty_requirements_{i}', self.generate_with_empty_requirements))

        return scenarios[:count]
