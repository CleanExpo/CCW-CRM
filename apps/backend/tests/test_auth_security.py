"""
Comprehensive authentication and security tests.

Tests all authentication flows, security features, and edge cases.
"""

import pytest
from httpx import AsyncClient

from src.auth.jwt import create_access_token, create_refresh_token
from src.auth.password_reset import create_password_reset_token


class TestLogin:
    """Test login endpoint and authentication flows."""

    async def test_login_success(self, client: AsyncClient):
        """Test successful login with valid credentials."""
        response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com", "password": "demo123"},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == "admin@demo.com"
        assert data["user"]["is_admin"] is True

        # Verify cookies are set
        cookies = response.cookies
        assert "auth_token" in cookies
        assert "refresh_token" in cookies

        # Verify cookie attributes
        auth_cookie = cookies["auth_token"]
        assert "httponly" in str(cookies).lower()
        assert "samesite=lax" in str(cookies).lower()

    async def test_login_invalid_email(self, client: AsyncClient):
        """Test login with non-existent email."""
        response = await client.post(
            "/api/auth/login",
            json={"email": "nonexistent@example.com", "password": "password123"},
        )

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "incorrect" in data["detail"].lower()

    async def test_login_invalid_password(self, client: AsyncClient):
        """Test login with wrong password."""
        response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com", "password": "wrongpassword"},
        )

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "incorrect" in data["detail"].lower()

    async def test_login_missing_fields(self, client: AsyncClient):
        """Test login with missing required fields."""
        # Missing password
        response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com"},
        )
        assert response.status_code == 422  # Validation error

        # Missing email
        response = await client.post(
            "/api/auth/login",
            json={"password": "demo123"},
        )
        assert response.status_code == 422

    async def test_login_invalid_email_format(self, client: AsyncClient):
        """Test login with invalid email format."""
        response = await client.post(
            "/api/auth/login",
            json={"email": "not-an-email", "password": "demo123"},
        )

        assert response.status_code == 422  # Validation error


class TestRefreshToken:
    """Test refresh token endpoint and token rotation."""

    async def test_refresh_token_success(self, client: AsyncClient):
        """Test successful token refresh."""
        # First login to get refresh token
        login_response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com", "password": "demo123"},
        )
        assert login_response.status_code == 200

        # Extract refresh token from cookies
        refresh_token = login_response.cookies.get("refresh_token")
        assert refresh_token is not None

        # Use refresh token to get new access token
        response = await client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": refresh_token},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify new access token is returned
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@demo.com"

        # Verify new auth_token cookie is set
        assert "auth_token" in response.cookies

    async def test_refresh_token_missing(self, client: AsyncClient):
        """Test refresh without providing token."""
        response = await client.post("/api/auth/refresh")

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "no refresh token" in data["detail"].lower()

    async def test_refresh_token_invalid(self, client: AsyncClient):
        """Test refresh with invalid token."""
        response = await client.post(
            "/api/auth/refresh",
            cookies={"refresh_token": "invalid.token.here"},
        )

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower()


class TestLogout:
    """Test logout endpoint."""

    async def test_logout_success(self, client: AsyncClient):
        """Test successful logout."""
        # First login
        login_response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com", "password": "demo123"},
        )
        assert login_response.status_code == 200

        # Then logout
        response = await client.post("/api/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "logged out" in data["message"].lower()

        # Verify cookies are cleared (or have empty values)
        # Note: Cookie clearing is done via delete_cookie which may not show in response


class TestPasswordReset:
    """Test password reset flow."""

    async def test_forgot_password_success(self, client: AsyncClient):
        """Test forgot password request."""
        response = await client.post(
            "/api/auth/forgot-password",
            json={"email": "admin@demo.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # Message should be generic to prevent user enumeration
        assert "if an account exists" in data["message"].lower()

    async def test_forgot_password_nonexistent_email(self, client: AsyncClient):
        """Test forgot password with non-existent email (should still return success)."""
        response = await client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )

        # Should return success to prevent user enumeration
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    async def test_reset_password_success(self, client: AsyncClient):
        """Test successful password reset."""
        # Generate a valid reset token
        reset_token = create_password_reset_token("admin@demo.com")

        response = await client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "new_password": "newpassword123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "reset successfully" in data["message"].lower()

    async def test_reset_password_invalid_token(self, client: AsyncClient):
        """Test password reset with invalid token."""
        response = await client.post(
            "/api/auth/reset-password",
            json={"token": "invalid.token", "new_password": "newpassword123"},
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower()

    async def test_reset_password_weak_password(self, client: AsyncClient):
        """Test password reset with weak password."""
        reset_token = create_password_reset_token("admin@demo.com")

        response = await client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "new_password": "weak"},  # Too short
        )

        assert response.status_code == 422  # Validation error


class TestRateLimiting:
    """Test rate limiting on authentication endpoints."""

    async def test_login_rate_limit(self, client: AsyncClient):
        """Test that login is rate limited after 5 attempts."""
        # Make 5 rapid login attempts
        for i in range(5):
            response = await client.post(
                "/api/auth/login",
                json={"email": "test@test.com", "password": "wrong"},
            )
            # First 5 should be 401 (unauthorized)
            if i < 5:
                assert response.status_code in [401, 429]

        # 6th attempt should be rate limited
        response = await client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "wrong"},
        )

        assert response.status_code == 429
        data = response.json()
        assert "error" in data
        assert "rate limit" in data["error"].lower()


class TestSecurityHeaders:
    """Test that security headers are present in responses."""

    async def test_security_headers_present(self, client: AsyncClient):
        """Test that all security headers are present."""
        response = await client.get("/health")

        headers = response.headers

        # Check for security headers
        assert "content-security-policy" in headers
        assert "x-frame-options" in headers
        assert headers["x-frame-options"] == "DENY"
        assert "x-content-type-options" in headers
        assert headers["x-content-type-options"] == "nosniff"
        assert "referrer-policy" in headers
        assert "permissions-policy" in headers

        # CSP should contain important directives
        csp = headers["content-security-policy"]
        assert "default-src" in csp
        assert "frame-ancestors 'none'" in csp

    async def test_hsts_not_in_development(self, client: AsyncClient):
        """Test that HSTS is not set in development."""
        response = await client.get("/health")

        headers = response.headers

        # HSTS should NOT be present in development
        # (it's only enabled when settings.is_production is True)
        assert "strict-transport-security" not in headers


class TestGetCurrentUser:
    """Test get current user endpoint."""

    async def test_get_current_user_authenticated(self, client: AsyncClient):
        """Test getting current user with valid auth token."""
        # First login
        login_response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com", "password": "demo123"},
        )
        assert login_response.status_code == 200

        # Extract auth token
        auth_token = login_response.cookies.get("auth_token")

        # Get current user
        response = await client.get(
            "/api/auth/me",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@demo.com"
        assert data["is_admin"] is True

    async def test_get_current_user_no_token(self, client: AsyncClient):
        """Test getting current user without token."""
        response = await client.get("/api/auth/me")

        assert response.status_code == 401
        data = response.json()
        assert "detail" in data

    async def test_get_current_user_invalid_token(self, client: AsyncClient):
        """Test getting current user with invalid token."""
        response = await client.get(
            "/api/auth/me",
            cookies={"auth_token": "invalid.token.here"},
        )

        assert response.status_code == 401
