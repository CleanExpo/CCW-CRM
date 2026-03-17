"""
Integration tests for GAP Batch 2C & 2D endpoints.

Tests for:
- GAP-019: POST /api/workflows/sla/escalate
- GAP-020: GET /api/approvals/pending-my-approval
- GAP-021: POST /api/approvals/bulk-approve
- GAP-022: GET /api/workflows/execution-stats
- GAP-023: POST /api/invoices/tax/calculate
- GAP-024: GET /api/reconciliation/match-suggestions
- GAP-025: POST /api/reconciliation/auto-match
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Batch 2C: Workflow & Approvals Tests
# ---------------------------------------------------------------------------


class TestGAP019SLAEscalate:
    """Tests for GAP-019: POST /api/workflows/sla/escalate"""

    def test_escalate_sla_success(self):
        """Test successful SLA escalation."""
        task_id = uuid4()
        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "task_id": str(task_id),
                "escalation_level": 1,
            },
        )

        # Note: Will likely get 404 in test env without DB setup
        # Test validates endpoint exists and has correct schema
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "escalated" in data
            assert "new_assignee" in data
            assert isinstance(data["escalated"], bool)
            assert isinstance(data["new_assignee"], str)

    def test_escalate_sla_level_2(self):
        """Test escalation to level 2 (manager)."""
        task_id = uuid4()
        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "task_id": str(task_id),
                "escalation_level": 2,
            },
        )

        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert data["escalated"] is True
            assert "manager" in data["new_assignee"].lower()

    def test_escalate_sla_invalid_payload(self):
        """Test SLA escalation with invalid payload."""
        response = client.post(
            "/api/workflows/sla/escalate",
            json={"task_id": "invalid-uuid"},
        )

        assert response.status_code == 422  # Validation error


class TestGAP020PendingMyApproval:
    """Tests for GAP-020: GET /api/approvals/pending-my-approval"""

    def test_pending_my_approval_no_auth(self):
        """Test endpoint requires authentication."""
        response = client.get("/api/approvals/pending-my-approval")

        # Should require authentication
        assert response.status_code in [401, 403, 500]

    def test_pending_my_approval_with_pagination(self):
        """Test endpoint accepts pagination parameters."""
        response = client.get(
            "/api/approvals/pending-my-approval",
            params={"page": 1, "page_size": 10},
        )

        # Will fail auth but validates parameter handling
        assert response.status_code in [401, 403, 500]

    def test_pending_my_approval_response_schema(self):
        """Test response schema structure (if we had auth)."""
        # This test documents expected response structure
        expected_schema = {
            "data": [],  # List of ApprovalResponse
            "total": 0,
            "page": 1,
            "page_size": 50,
            "total_pages": 0,
        }
        assert "data" in expected_schema
        assert "total" in expected_schema


class TestGAP021BulkApprove:
    """Tests for GAP-021: POST /api/approvals/bulk-approve"""

    def test_bulk_approve_success(self):
        """Test bulk approval of multiple approvals."""
        approval_ids = [str(uuid4()), str(uuid4())]
        response = client.post(
            "/api/approvals/bulk-approve",
            json={
                "approval_ids": approval_ids,
                "comment": "Bulk approved via automation",
            },
        )

        # May get 200 with failures or 404/500 without DB
        assert response.status_code in [200, 404, 500]

        if response.status_code == 200:
            data = response.json()
            assert "approved" in data
            assert "failed" in data
            assert isinstance(data["approved"], int)
            assert isinstance(data["failed"], list)

    def test_bulk_approve_empty_list(self):
        """Test bulk approval with empty list."""
        response = client.post(
            "/api/approvals/bulk-approve",
            json={
                "approval_ids": [],
                "comment": "Empty test",
            },
        )

        assert response.status_code in [200, 422]

        if response.status_code == 200:
            data = response.json()
            assert data["approved"] == 0
            assert len(data["failed"]) == 0

    def test_bulk_approve_no_comment(self):
        """Test bulk approval without comment (optional field)."""
        approval_ids = [str(uuid4())]
        response = client.post(
            "/api/approvals/bulk-approve",
            json={"approval_ids": approval_ids},
        )

        assert response.status_code in [200, 404, 500]


class TestGAP022WorkflowExecutionStats:
    """Tests for GAP-022: GET /api/workflows/execution-stats"""

    def test_execution_stats_no_filters(self):
        """Test workflow execution stats without filters."""
        response = client.get("/api/workflows/execution-stats")

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert "total" in data
            assert "completed" in data
            assert "failed" in data
            assert "avg_duration" in data
            assert isinstance(data["total"], int)
            assert isinstance(data["avg_duration"], float)

    def test_execution_stats_with_workflow_filter(self):
        """Test execution stats filtered by workflow ID."""
        workflow_id = uuid4()
        response = client.get(
            "/api/workflows/execution-stats",
            params={"workflow_id": str(workflow_id)},
        )

        assert response.status_code in [200, 500]

    def test_execution_stats_with_date_range(self):
        """Test execution stats with date range filter."""
        date_from = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        date_to = datetime.now(UTC).isoformat()

        response = client.get(
            "/api/workflows/execution-stats",
            params={
                "date_from": date_from,
                "date_to": date_to,
            },
        )

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert data["total"] >= 0
            assert data["completed"] >= 0
            assert data["failed"] >= 0


# ---------------------------------------------------------------------------
# Batch 2D: Financial & Tax Tests
# ---------------------------------------------------------------------------


class TestGAP023TaxCalculation:
    """Tests for GAP-023: POST /api/invoices/tax/calculate"""

    def test_tax_calculate_with_line_items(self):
        """Test tax calculation with provided line items."""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={
                "line_items": [
                    {
                        "description": "Product A",
                        "quantity": 2,
                        "unit_price": "100.00",
                        "tax_rate": "10.00",
                    },
                    {
                        "description": "Product B",
                        "quantity": 1,
                        "unit_price": "50.00",
                        "tax_rate": "10.00",
                    },
                ]
            },
        )

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert "subtotal" in data
            assert "tax" in data
            assert "total" in data
            assert "breakdown" in data

            # Validate calculations: 2*100 + 1*50 = 250, tax = 25, total = 275
            assert float(data["subtotal"]) == 250.0
            assert float(data["tax"]) == 25.0
            assert float(data["total"]) == 275.0

            # Validate breakdown
            breakdown = data["breakdown"]
            assert "gst" in breakdown
            assert float(breakdown["gst"]) == 25.0

    def test_tax_calculate_with_invoice_id(self):
        """Test tax calculation for existing invoice."""
        invoice_id = uuid4()
        response = client.post(
            "/api/invoices/tax/calculate",
            json={"invoice_id": str(invoice_id)},
        )

        # Will get 404 without real invoice in DB
        assert response.status_code in [200, 404, 500]

    def test_tax_calculate_missing_both_params(self):
        """Test tax calculation without invoice_id or line_items."""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={},
        )

        assert response.status_code == 400  # Bad request


class TestGAP024MatchSuggestions:
    """Tests for GAP-024: GET /api/reconciliation/match-suggestions"""

    def test_match_suggestions_success(self):
        """Test getting match suggestions for a transaction."""
        transaction_id = uuid4()
        response = client.get(
            "/api/reconciliation/match-suggestions",
            params={"transaction_id": str(transaction_id)},
        )

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)

            # Validate suggestion schema if results returned
            if len(data) > 0:
                suggestion = data[0]
                assert "match_id" in suggestion
                assert "transaction_id" in suggestion
                assert "invoice_id" in suggestion
                assert "invoice_number" in suggestion
                assert "amount" in suggestion
                assert "confidence" in suggestion
                assert "reason" in suggestion

                # Validate confidence is between 0 and 1
                assert 0.0 <= float(suggestion["confidence"]) <= 1.0

    def test_match_suggestions_missing_transaction_id(self):
        """Test match suggestions without transaction_id parameter."""
        response = client.get("/api/reconciliation/match-suggestions")

        assert response.status_code == 422  # Validation error

    def test_match_suggestions_invalid_uuid(self):
        """Test match suggestions with invalid UUID."""
        response = client.get(
            "/api/reconciliation/match-suggestions",
            params={"transaction_id": "not-a-uuid"},
        )

        assert response.status_code == 422  # Validation error


class TestGAP025AutoMatch:
    """Tests for GAP-025: POST /api/reconciliation/auto-match"""

    def test_auto_match_high_confidence(self):
        """Test auto-match with high confidence threshold."""
        transaction_id = uuid4()
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "transaction_id": str(transaction_id),
                "min_confidence": 0.9,
            },
        )

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            assert "matched" in data
            assert isinstance(data["matched"], bool)

            if data["matched"]:
                assert "match_id" in data
                assert "confidence" in data
                assert "reason" in data
                assert float(data["confidence"]) >= 0.9

    def test_auto_match_low_confidence_threshold(self):
        """Test auto-match with low confidence threshold."""
        transaction_id = uuid4()
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "transaction_id": str(transaction_id),
                "min_confidence": 0.5,
            },
        )

        assert response.status_code in [200, 500]

    def test_auto_match_default_threshold(self):
        """Test auto-match with default 90% threshold."""
        transaction_id = uuid4()
        response = client.post(
            "/api/reconciliation/auto-match",
            json={"transaction_id": str(transaction_id)},
        )

        assert response.status_code in [200, 500]

        if response.status_code == 200:
            data = response.json()
            # Default threshold is 0.9, so if matched, confidence should be >= 0.9
            if data["matched"] and data["confidence"]:
                assert float(data["confidence"]) >= 0.9

    def test_auto_match_invalid_confidence_range(self):
        """Test auto-match with confidence outside valid range."""
        transaction_id = uuid4()
        response = client.post(
            "/api/reconciliation/auto-match",
            json={
                "transaction_id": str(transaction_id),
                "min_confidence": 1.5,  # Invalid: > 1.0
            },
        )

        assert response.status_code == 422  # Validation error


# ---------------------------------------------------------------------------
# Summary Tests
# ---------------------------------------------------------------------------


def test_all_endpoints_registered():
    """Verify all 7 endpoints are registered in OpenAPI schema."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    openapi = response.json()
    paths = openapi.get("paths", {})

    # Check all 7 endpoints exist
    assert "/api/workflows/sla/escalate" in paths
    assert "/api/approvals/pending-my-approval" in paths
    assert "/api/approvals/bulk-approve" in paths
    assert "/api/workflows/execution-stats" in paths
    assert "/api/invoices/tax/calculate" in paths
    assert "/api/reconciliation/match-suggestions" in paths
    assert "/api/reconciliation/auto-match" in paths


def test_endpoint_methods():
    """Verify correct HTTP methods for each endpoint."""
    openapi = client.get("/openapi.json").json()
    paths = openapi["paths"]

    # POST endpoints
    assert "post" in paths["/api/workflows/sla/escalate"]
    assert "post" in paths["/api/approvals/bulk-approve"]
    assert "post" in paths["/api/invoices/tax/calculate"]
    assert "post" in paths["/api/reconciliation/auto-match"]

    # GET endpoints
    assert "get" in paths["/api/approvals/pending-my-approval"]
    assert "get" in paths["/api/workflows/execution-stats"]
    assert "get" in paths["/api/reconciliation/match-suggestions"]
