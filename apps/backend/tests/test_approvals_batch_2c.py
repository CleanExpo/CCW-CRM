"""
Tests for Phase 2 Batch 2C - Approvals Endpoints.

GAP-022: GET /api/approvals/pending-my-approval-v2
GAP-023: POST /api/approvals/bulk-approve-v2
"""
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# GAP-022: GET /api/approvals/pending-my-approval-v2
# ---------------------------------------------------------------------------


class TestPendingMyApprovalV2:
    """Test pending approvals endpoint v2."""

    def test_get_pending_approvals_default(self):
        """Test getting pending approvals with default limit."""
        user_id = uuid4()

        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={"user_id": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()

        # Validate response structure
        assert "approvals" in data
        assert "total" in data
        assert "overdue" in data

        # Approvals is a list
        assert isinstance(data["approvals"], list)

        # Total and overdue are integers
        assert isinstance(data["total"], int)
        assert isinstance(data["overdue"], int)

        # Overdue should be <= total
        assert data["overdue"] <= data["total"]

    def test_get_pending_approvals_custom_limit(self):
        """Test getting pending approvals with custom limit."""
        user_id = uuid4()

        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={
                "user_id": str(user_id),
                "limit": 10,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should return at most 10 approvals
        assert len(data["approvals"]) <= 10

    def test_get_pending_approvals_validates_limit(self):
        """Test limit parameter validation."""
        user_id = uuid4()

        # Too small
        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={
                "user_id": str(user_id),
                "limit": 0,
            },
        )
        assert response.status_code == 422

        # Too large
        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={
                "user_id": str(user_id),
                "limit": 200,
            },
        )
        assert response.status_code == 422

    def test_pending_approval_structure(self):
        """Test pending approval item structure."""
        user_id = uuid4()

        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={"user_id": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()

        if data["approvals"]:
            approval = data["approvals"][0]

            # Required fields
            required_fields = [
                "id",
                "workflow_type",
                "subject",
                "requested_by",
                "requested_at",
                "priority",
            ]
            for field in required_fields:
                assert field in approval, f"Missing field: {field}"

            # Optional fields
            assert "amount" in approval  # Can be None
            assert "sla_deadline" in approval  # Can be None

            # Validate workflow_type
            assert approval["workflow_type"] in [
                "purchase_order",
                "invoice",
                "expense_report",
                "contract_review",
                "timesheet",
            ]

            # Validate priority
            assert approval["priority"] in ["low", "medium", "high", "urgent"]

    def test_pending_approvals_overdue_calculation(self):
        """Test overdue count is correct."""
        user_id = uuid4()

        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={"user_id": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()

        # Count overdue items manually
        current_time = datetime.now(UTC)
        manual_overdue = 0

        for approval in data["approvals"]:
            if approval["sla_deadline"]:
                deadline = datetime.fromisoformat(approval["sla_deadline"].replace("Z", "+00:00"))
                if deadline < current_time:
                    manual_overdue += 1

        # Should match returned overdue count
        assert data["overdue"] == manual_overdue

    def test_pending_approvals_amount_field(self):
        """Test amount field is Decimal or None."""
        user_id = uuid4()

        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={"user_id": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()

        for approval in data["approvals"]:
            amount = approval["amount"]
            if amount is not None:
                # Should be string representation of decimal
                assert isinstance(amount, str)
                # Should be parseable as Decimal
                Decimal(amount)

    def test_pending_approvals_missing_user_id(self):
        """Test missing user_id parameter."""
        response = client.get("/api/approvals/pending-my-approval-v2")

        # Should return 422 for missing required parameter
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# GAP-023: POST /api/approvals/bulk-approve-v2
# ---------------------------------------------------------------------------


class TestBulkApproveV2:
    """Test bulk approve endpoint v2."""

    def test_bulk_approve_single_approval(self):
        """Test bulk approving single approval."""
        approval_id = uuid4()
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(approval_id)],
                "approver_user_id": str(approver_user_id),
                "comments": "Approved in bulk",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Validate response structure
        assert "results" in data
        assert "total_approved" in data
        assert "total_failed" in data

        # Should have 1 result
        assert len(data["results"]) == 1

        # Check counts
        assert data["total_approved"] + data["total_failed"] == 1

    def test_bulk_approve_multiple_approvals(self):
        """Test bulk approving multiple approvals."""
        approval_ids = [uuid4() for _ in range(5)]
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(aid) for aid in approval_ids],
                "approver_user_id": str(approver_user_id),
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should have 5 results
        assert len(data["results"]) == 5

        # Counts should add up
        assert data["total_approved"] + data["total_failed"] == 5

    def test_bulk_approve_result_structure(self):
        """Test bulk approve result structure."""
        approval_id = uuid4()
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(approval_id)],
                "approver_user_id": str(approver_user_id),
            },
        )

        assert response.status_code == 200
        data = response.json()

        result = data["results"][0]

        # Required fields
        assert "approval_id" in result
        assert "success" in result
        assert "error_message" in result

        # Data types
        assert isinstance(result["success"], bool)

        # If failed, should have error message
        if not result["success"]:
            assert result["error_message"] is not None

    def test_bulk_approve_validates_request(self):
        """Test request validation."""
        # Missing approval_ids
        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approver_user_id": str(uuid4()),
            },
        )
        assert response.status_code == 422

        # Missing approver_user_id
        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(uuid4())],
            },
        )
        assert response.status_code == 422

    def test_bulk_approve_empty_list(self):
        """Test bulk approve with empty list."""
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [],
                "approver_user_id": str(approver_user_id),
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should have no results
        assert len(data["results"]) == 0
        assert data["total_approved"] == 0
        assert data["total_failed"] == 0

    def test_bulk_approve_success_failure_counts(self):
        """Test success/failure counts are correct."""
        approval_ids = [uuid4() for _ in range(10)]
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(aid) for aid in approval_ids],
                "approver_user_id": str(approver_user_id),
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Count manually
        manual_approved = sum(1 for r in data["results"] if r["success"])
        manual_failed = sum(1 for r in data["results"] if not r["success"])

        # Should match returned counts
        assert data["total_approved"] == manual_approved
        assert data["total_failed"] == manual_failed

    def test_bulk_approve_with_comments(self):
        """Test bulk approve with comments."""
        approval_id = uuid4()
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(approval_id)],
                "approver_user_id": str(approver_user_id),
                "comments": "Approved after review",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should succeed
        assert len(data["results"]) == 1

    def test_bulk_approve_without_comments(self):
        """Test bulk approve without comments (optional)."""
        approval_id = uuid4()
        approver_user_id = uuid4()

        response = client.post(
            "/api/approvals/bulk-approve-v2",
            json={
                "approval_ids": [str(approval_id)],
                "approver_user_id": str(approver_user_id),
                # No comments
            },
        )

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# Integration Tests
# ---------------------------------------------------------------------------


class TestBatch2CApprovalsIntegration:
    """Integration tests for Batch 2C approvals endpoints."""

    def test_get_pending_then_bulk_approve(self):
        """Test getting pending approvals then bulk approving them."""
        user_id = uuid4()

        # Get pending approvals
        pending_response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={"user_id": str(user_id)},
        )
        assert pending_response.status_code == 200
        pending_data = pending_response.json()

        # If there are pending approvals, try to bulk approve them
        if pending_data["approvals"]:
            approval_ids = [a["id"] for a in pending_data["approvals"][:3]]

            bulk_response = client.post(
                "/api/approvals/bulk-approve-v2",
                json={
                    "approval_ids": approval_ids,
                    "approver_user_id": str(user_id),
                },
            )
            assert bulk_response.status_code == 200

            bulk_data = bulk_response.json()
            assert len(bulk_data["results"]) == len(approval_ids)

    def test_all_endpoints_return_json(self):
        """Test all endpoints return valid JSON."""
        user_id = uuid4()
        approval_ids = [uuid4() for _ in range(2)]

        endpoints = [
            {
                "method": "GET",
                "url": "/api/approvals/pending-my-approval-v2",
                "params": {"user_id": str(user_id)},
            },
            {
                "method": "POST",
                "url": "/api/approvals/bulk-approve-v2",
                "json": {
                    "approval_ids": [str(aid) for aid in approval_ids],
                    "approver_user_id": str(user_id),
                },
            },
        ]

        for endpoint in endpoints:
            if endpoint["method"] == "POST":
                response = client.post(endpoint["url"], json=endpoint["json"])
            else:
                response = client.get(endpoint["url"], params=endpoint.get("params"))

            assert response.status_code == 200
            # Should be valid JSON
            data = response.json()
            assert isinstance(data, dict)

    def test_pending_approvals_overdue_flag(self):
        """Test overdue approvals are correctly flagged."""
        user_id = uuid4()

        response = client.get(
            "/api/approvals/pending-my-approval-v2",
            params={"user_id": str(user_id)},
        )

        assert response.status_code == 200
        data = response.json()

        # If there are overdue approvals
        if data["overdue"] > 0:
            # At least one approval should have deadline in the past
            current_time = datetime.now(UTC)
            has_overdue = False

            for approval in data["approvals"]:
                if approval["sla_deadline"]:
                    deadline = datetime.fromisoformat(approval["sla_deadline"].replace("Z", "+00:00"))
                    if deadline < current_time:
                        has_overdue = True
                        break

            assert has_overdue, "overdue count > 0 but no overdue approvals found"
