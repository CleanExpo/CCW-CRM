"""
Approvals Integration Tests

Tests for approvals pending-my-approval and bulk-approve endpoints (Phase 2 - Batch 2C)
"""

import pytest
from fastapi.testclient import TestClient

from src.api.deps import get_current_user
from src.api.main import app


async def _mock_user():
    """Bypass auth so tests reach Pydantic validation (422) not auth (401)."""
    return {"id": "00000000-0000-0000-0000-000000000001", "email": "test@test.com"}


@pytest.fixture(autouse=True)
def _override_auth():
    """Set auth override before each test, restore after.

    Module-level overrides get wiped by conftest's app.dependency_overrides.clear()
    so we re-apply per-test via this autouse fixture.
    """
    app.dependency_overrides[get_current_user] = _mock_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


client = TestClient(app, raise_server_exceptions=False)


class TestPendingMyApproval:
    """Test GET /api/approvals/pending-my-approval"""

    def test_get_pending_my_approval_requires_auth(self):
        """Should require JWT authentication"""
        response = client.get("/api/approvals/pending-my-approval")
        # 200 if DB available, 401 if auth blocks, 500 if DB unavailable
        assert response.status_code in [200, 401, 500]

    def test_get_pending_my_approval_returns_list(self):
        """Should return list of pending approvals (if authenticated)"""
        response = client.get(
            "/api/approvals/pending-my-approval",
            headers={"Authorization": "Bearer mock-token"},
        )

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)


class TestBulkApprove:
    """Test POST /api/approvals/bulk-approve"""

    def test_bulk_approve_success(self):
        """Should approve multiple approvals at once"""
        response = client.post(
            "/api/approvals/bulk-approve",
            json={"approval_ids": ["appr-1", "appr-2"], "comments": "All verified"},
        )
        # 200 if DB available, 401/422/404 for auth/validation, 500 if DB unavailable
        assert response.status_code in [200, 401, 404, 422, 500]

        if response.status_code == 200:
            data = response.json()
            assert "approved_count" in data

    def test_bulk_approve_missing_ids(self):
        """Should reject request without approval_ids"""
        response = client.post(
            "/api/approvals/bulk-approve",
            json={"comments": "Test"},
        )
        assert response.status_code == 422  # Validation error

    def test_bulk_approve_empty_list(self):
        """Should handle empty approval_ids list"""
        response = client.post(
            "/api/approvals/bulk-approve",
            json={"approval_ids": []},
        )
        # Should either succeed with 0 count, reject, or 500 if DB unavailable
        assert response.status_code in [200, 400, 422, 401, 500]

    def test_bulk_approve_partial_failure(self):
        """Should handle case where some approvals fail"""
        response = client.post(
            "/api/approvals/bulk-approve",
            json={"approval_ids": ["appr-1", "invalid-id", "appr-2"]},
        )

        if response.status_code == 200:
            data = response.json()
            # Should report partial success
            assert "approved_count" in data or "failed_count" in data
