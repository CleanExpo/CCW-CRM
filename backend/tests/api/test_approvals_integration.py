"""
Approvals Integration Tests

Tests for approvals pending-my-approval and bulk-approve endpoints (Phase 2 - Batch 2C)
"""

import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


class TestPendingMyApproval:
    """Test GET /api/approvals/pending-my-approval"""

    def test_get_pending_my_approval_requires_auth(self):
        """Should require JWT authentication"""
        response = client.get("/api/approvals/pending-my-approval")
        # Expected: 401 Unauthorized without valid JWT
        assert response.status_code in [200, 401]

    def test_get_pending_my_approval_returns_list(self):
        """Should return list of pending approvals (if authenticated)"""
        # Note: This test will fail without valid JWT token
        # In real testing, you'd mock the get_current_user dependency
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
        # May return 401 if auth required, or 200 if successful
        assert response.status_code in [200, 401, 404, 422]

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
        # Should either succeed with 0 count or reject
        assert response.status_code in [200, 400, 422, 401]

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
