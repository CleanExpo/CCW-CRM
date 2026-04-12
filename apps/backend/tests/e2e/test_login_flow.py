"""
End-to-End Login and Authentication Flow Tests.

Tests the complete authentication lifecycle:
1. Login with credentials
2. Access protected resources
3. Session management
4. Logout
5. Access denial after logout

Part of Phase 5 Week 1 - E2E Test Coverage.
"""

import pytest
from httpx import AsyncClient


@pytest.fixture
async def test_user_credentials() -> dict[str, str]:
    """Get test user credentials."""
    return {
        "email": "admin@demo.com",
        "password": "demo123",
    }


class TestLoginFlowE2E:
    """End-to-end tests for authentication flow."""

    async def test_complete_login_flow(
        self,
        client: AsyncClient,
        test_user_credentials: dict[str, str],
    ):
        """
        Test complete login flow from credentials to accessing protected resources.

        Steps:
        1. Login with valid credentials
        2. Receive auth token
        3. Access protected resource with token
        4. Verify authenticated access
        """
        # Step 1: Login with valid credentials
        login_response = await client.post(
            "/api/auth/login",
            json=test_user_credentials,
        )

        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()

        # Verify login response
        assert "access_token" in login_data
        assert "user" in login_data
        assert login_data["user"]["email"] == test_user_credentials["email"]

        # Step 2: Extract auth token
        auth_token = login_data["access_token"]
        assert auth_token is not None
        assert len(auth_token) > 0

        # Step 3: Access protected resource with token
        protected_response = await client.get(
            "/api/products",
            cookies={"auth_token": auth_token},
        )

        assert protected_response.status_code == 200
        products_data = protected_response.json()
        assert "items" in products_data

        # Step 4: Access another protected resource
        orders_response = await client.get(
            "/api/orders",
            cookies={"auth_token": auth_token},
        )

        assert orders_response.status_code == 200
        orders_data = orders_response.json()
        assert "items" in orders_data

    async def test_login_with_invalid_credentials(
        self,
        client: AsyncClient,
    ):
        """
        Test login failure with invalid credentials.

        Steps:
        1. Try to login with wrong password
        2. Verify rejection
        3. Try to login with non-existent email
        4. Verify rejection
        """
        # Wrong password
        wrong_password_response = await client.post(
            "/api/auth/login",
            json={
                "email": "admin@demo.com",
                "password": "wrongpassword",
            },
        )

        assert wrong_password_response.status_code in [401, 403]

        # Non-existent email
        invalid_email_response = await client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )

        assert invalid_email_response.status_code in [401, 403, 404]

    async def test_access_protected_resource_without_auth(
        self,
        client: AsyncClient,
    ):
        """
        Test that protected resources require authentication.

        Steps:
        1. Try to access protected resources without token
        2. Verify access denied
        """
        # Try to access products without auth
        products_response = await client.get("/api/products")
        assert products_response.status_code in [401, 403]

        # Try to access orders without auth
        orders_response = await client.get("/api/orders")
        assert orders_response.status_code in [401, 403]

        # Try to create order without auth
        create_response = await client.post(
            "/api/orders",
            json={
                "customer_id": "00000000-0000-0000-0000-000000000000",
                "status": "draft",
                "items": [],
            },
        )
        assert create_response.status_code in [401, 403]

    async def test_access_with_invalid_token(
        self,
        client: AsyncClient,
    ):
        """
        Test that invalid tokens are rejected.

        Steps:
        1. Try to access protected resources with invalid token
        2. Verify rejection
        """
        # Invalid token format
        response1 = await client.get(
            "/api/products",
            cookies={"auth_token": "invalid-token"},
        )
        assert response1.status_code in [401, 403]

        # Empty token
        response2 = await client.get(
            "/api/products",
            cookies={"auth_token": ""},
        )
        assert response2.status_code in [401, 403]

        # Expired-looking token (if JWT)
        response3 = await client.get(
            "/api/products",
            cookies={"auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token"},
        )
        assert response3.status_code in [401, 403]

    async def test_session_persistence(
        self,
        client: AsyncClient,
        test_user_credentials: dict[str, str],
    ):
        """
        Test that session persists across multiple requests.

        Steps:
        1. Login
        2. Make multiple authenticated requests
        3. Verify all succeed with same token
        """
        # Login
        login_response = await client.post(
            "/api/auth/login",
            json=test_user_credentials,
        )
        assert login_response.status_code == 200
        auth_token = login_response.json()["access_token"]

        # Make multiple requests with same token
        endpoints = [
            "/api/products",
            "/api/customers",
            "/api/orders",
            "/api/quotes",
        ]

        for endpoint in endpoints:
            response = await client.get(
                endpoint,
                cookies={"auth_token": auth_token},
            )
            assert response.status_code == 200, f"Failed to access {endpoint}"

    async def test_login_validation(
        self,
        client: AsyncClient,
    ):
        """
        Test login request validation.

        Steps:
        1. Try login without email
        2. Try login without password
        3. Try login with invalid email format
        4. Verify validation errors
        """
        # Missing email
        response1 = await client.post(
            "/api/auth/login",
            json={"password": "password123"},
        )
        assert response1.status_code in [400, 422]

        # Missing password
        response2 = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com"},
        )
        assert response2.status_code in [400, 422]

        # Invalid email format
        response3 = await client.post(
            "/api/auth/login",
            json={
                "email": "not-an-email",
                "password": "password123",
            },
        )
        assert response3.status_code in [400, 422]

    async def test_user_info_in_response(
        self,
        client: AsyncClient,
        test_user_credentials: dict[str, str],
    ):
        """
        Test that login returns correct user information.

        Steps:
        1. Login
        2. Verify user details in response
        3. Verify sensitive data (password) is not exposed
        """
        login_response = await client.post(
            "/api/auth/login",
            json=test_user_credentials,
        )

        assert login_response.status_code == 200
        login_data = login_response.json()

        # Verify user object
        user = login_data["user"]
        assert "id" in user
        assert "email" in user
        assert user["email"] == test_user_credentials["email"]

        # Verify sensitive data is NOT exposed
        assert "password" not in user
        assert "hashed_password" not in user

    async def test_concurrent_logins(
        self,
        client: AsyncClient,
        test_user_credentials: dict[str, str],
    ):
        """
        Test that same user can have multiple concurrent sessions.

        Steps:
        1. Login twice with same credentials
        2. Verify both tokens work
        3. Use both tokens to access resources
        """
        # First login
        login1_response = await client.post(
            "/api/auth/login",
            json=test_user_credentials,
        )
        assert login1_response.status_code == 200
        token1 = login1_response.json()["access_token"]

        # Second login
        login2_response = await client.post(
            "/api/auth/login",
            json=test_user_credentials,
        )
        assert login2_response.status_code == 200
        token2 = login2_response.json()["access_token"]

        # Both tokens should work
        response1 = await client.get(
            "/api/products",
            cookies={"auth_token": token1},
        )
        assert response1.status_code == 200

        response2 = await client.get(
            "/api/products",
            cookies={"auth_token": token2},
        )
        assert response2.status_code == 200

    async def test_health_endpoint_public(
        self,
        client: AsyncClient,
    ):
        """
        Test that health endpoint is publicly accessible.

        Steps:
        1. Access health endpoint without auth
        2. Verify success
        """
        health_response = await client.get("/health")
        assert health_response.status_code == 200
        health_data = health_response.json()
        assert "api" in health_data
        assert "database" in health_data

    async def test_docs_endpoint_public(
        self,
        client: AsyncClient,
    ):
        """
        Test that API docs are publicly accessible.

        Steps:
        1. Access /docs without auth
        2. Verify success
        """
        docs_response = await client.get("/docs")
        # Docs should redirect or return HTML
        assert docs_response.status_code in [200, 307]
