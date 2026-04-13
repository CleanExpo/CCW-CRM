"""
Tests for Phase 2 Batch 2C - Workflow & Approvals Endpoints.

GAP-021: POST /api/workflows/sla/escalate
GAP-024: GET /api/workflows/execution-stats
"""
from uuid import uuid4

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# GAP-021: POST /api/workflows/sla/escalate
# ---------------------------------------------------------------------------


class TestSLAEscalate:
    """Test SLA escalation endpoint."""

    def test_escalate_sla_manual_override(self):
        """Test manual SLA escalation with override."""
        workflow_instance_id = uuid4()
        escalate_to_user_id = uuid4()

        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "workflow_instance_id": str(workflow_instance_id),
                "reason": "manual_override",
                "escalate_to_user_id": str(escalate_to_user_id),
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Validate response structure
        assert "workflow_instance_id" in data
        assert "previous_assignee" in data
        assert "new_assignee" in data
        assert "escalation_level" in data
        assert "notification_sent" in data
        assert "message" in data

        # Validate data types
        assert data["workflow_instance_id"] == str(workflow_instance_id)
        assert data["escalation_level"] in [1, 2, 3]
        assert data["notification_sent"] is True
        assert "manual_override" in data["message"]

    def test_escalate_sla_auto_assignment(self):
        """Test SLA escalation with auto-assignment."""
        workflow_instance_id = uuid4()

        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "workflow_instance_id": str(workflow_instance_id),
                "reason": "sla_breach",
                "escalate_to_user_id": None,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Should auto-assign based on escalation level
        assert data["new_assignee"] is not None
        assert "@" in data["new_assignee"]  # Should be email
        assert "sla_breach" in data["message"]

    def test_escalate_sla_customer_request(self):
        """Test SLA escalation for customer request."""
        workflow_instance_id = uuid4()

        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "workflow_instance_id": str(workflow_instance_id),
                "reason": "customer_request",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["escalation_level"] >= 1
        assert "customer_request" in data["message"]

    def test_escalate_sla_validates_request(self):
        """Test request validation."""
        # Missing required field
        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "workflow_instance_id": str(uuid4()),
                # Missing reason
            },
        )

        assert response.status_code == 422  # Validation error

    def test_escalate_sla_response_fields(self):
        """Test all response fields are present and valid."""
        workflow_instance_id = uuid4()

        response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "workflow_instance_id": str(workflow_instance_id),
                "reason": "sla_breach",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # All required fields present
        required_fields = [
            "workflow_instance_id",
            "previous_assignee",
            "new_assignee",
            "escalation_level",
            "notification_sent",
            "message",
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

        # Escalation level is valid (1, 2, or 3)
        assert data["escalation_level"] in [1, 2, 3]

        # Assignees are different (escalation occurred)
        assert data["previous_assignee"] != data["new_assignee"]


# ---------------------------------------------------------------------------
# GAP-024: GET /api/workflows/execution-stats
# ---------------------------------------------------------------------------


class TestWorkflowExecutionStats:
    """Test workflow execution stats endpoint."""

    def test_get_execution_stats_default(self):
        """Test getting execution stats with default time period."""
        organization_id = uuid4()

        response = client.get(
            "/api/workflows/execution-stats",
            params={"organization_id": str(organization_id)},
        )

        assert response.status_code == 200
        data = response.json()

        # Validate response structure
        assert "stats" in data
        assert "time_period_days" in data

        stats = data["stats"]
        assert "total_workflows" in stats
        assert "completed" in stats
        assert "in_progress" in stats
        assert "failed" in stats
        assert "average_completion_hours" in stats
        assert "sla_compliance_rate" in stats
        assert "top_workflow_types" in stats

        # Default time period is 30 days
        assert data["time_period_days"] == 30

    def test_get_execution_stats_custom_period(self):
        """Test getting stats for custom time period."""
        organization_id = uuid4()

        response = client.get(
            "/api/workflows/execution-stats",
            params={
                "organization_id": str(organization_id),
                "days": 90,
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["time_period_days"] == 90

    def test_get_execution_stats_validates_days(self):
        """Test days parameter validation."""
        organization_id = uuid4()

        # Too small
        response = client.get(
            "/api/workflows/execution-stats",
            params={
                "organization_id": str(organization_id),
                "days": 0,
            },
        )
        assert response.status_code == 422

        # Too large
        response = client.get(
            "/api/workflows/execution-stats",
            params={
                "organization_id": str(organization_id),
                "days": 400,
            },
        )
        assert response.status_code == 422

    def test_get_execution_stats_data_types(self):
        """Test data types in response."""
        organization_id = uuid4()

        response = client.get(
            "/api/workflows/execution-stats",
            params={"organization_id": str(organization_id)},
        )

        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]

        # Integers
        assert isinstance(stats["total_workflows"], int)
        assert isinstance(stats["completed"], int)
        assert isinstance(stats["in_progress"], int)
        assert isinstance(stats["failed"], int)

        # Float
        assert isinstance(stats["average_completion_hours"], (int, float))
        assert isinstance(stats["sla_compliance_rate"], (int, float))

        # List of dicts
        assert isinstance(stats["top_workflow_types"], list)
        if stats["top_workflow_types"]:
            first_type = stats["top_workflow_types"][0]
            assert "type" in first_type
            assert "count" in first_type
            assert isinstance(first_type["count"], int)

    def test_get_execution_stats_sla_compliance_percentage(self):
        """Test SLA compliance is a valid percentage."""
        organization_id = uuid4()

        response = client.get(
            "/api/workflows/execution-stats",
            params={"organization_id": str(organization_id)},
        )

        assert response.status_code == 200
        data = response.json()

        sla_compliance = data["stats"]["sla_compliance_rate"]
        assert 0 <= sla_compliance <= 100

    def test_get_execution_stats_workflow_counts_consistent(self):
        """Test workflow counts add up correctly."""
        organization_id = uuid4()

        response = client.get(
            "/api/workflows/execution-stats",
            params={"organization_id": str(organization_id)},
        )

        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]

        # Total should be sum of status counts
        total = stats["total_workflows"]
        completed = stats["completed"]
        in_progress = stats["in_progress"]
        failed = stats["failed"]

        # Total should be >= sum of completed + in_progress + failed
        # (there may be other statuses)
        assert total >= (completed + in_progress + failed)

    def test_get_execution_stats_top_workflow_types(self):
        """Test top workflow types structure."""
        organization_id = uuid4()

        response = client.get(
            "/api/workflows/execution-stats",
            params={"organization_id": str(organization_id)},
        )

        assert response.status_code == 200
        data = response.json()

        top_types = data["stats"]["top_workflow_types"]
        assert isinstance(top_types, list)

        # Should have at most 5 entries
        assert len(top_types) <= 5

        # Each entry should have type and count
        for entry in top_types:
            assert "type" in entry
            assert "count" in entry
            assert isinstance(entry["type"], str)
            assert isinstance(entry["count"], int)
            assert entry["count"] > 0

    def test_get_execution_stats_missing_organization_id(self):
        """Test missing organization_id parameter."""
        response = client.get("/api/workflows/execution-stats")

        # Should return 422 for missing required parameter
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Integration Tests
# ---------------------------------------------------------------------------


class TestBatch2CIntegration:
    """Integration tests for Batch 2C endpoints."""

    def test_escalate_then_check_stats(self):
        """Test escalating workflow then checking execution stats."""
        organization_id = uuid4()
        workflow_instance_id = uuid4()

        # Escalate a workflow
        escalate_response = client.post(
            "/api/workflows/sla/escalate",
            json={
                "workflow_instance_id": str(workflow_instance_id),
                "reason": "sla_breach",
            },
        )
        assert escalate_response.status_code == 200

        # Check execution stats
        stats_response = client.get(
            "/api/workflows/execution-stats",
            params={"organization_id": str(organization_id)},
        )
        assert stats_response.status_code == 200

        stats = stats_response.json()["stats"]
        assert stats["total_workflows"] > 0

    def test_all_endpoints_return_json(self):
        """Test all endpoints return valid JSON."""
        organization_id = uuid4()
        workflow_instance_id = uuid4()

        endpoints = [
            {
                "method": "POST",
                "url": "/api/workflows/sla/escalate",
                "json": {
                    "workflow_instance_id": str(workflow_instance_id),
                    "reason": "sla_breach",
                },
            },
            {
                "method": "GET",
                "url": "/api/workflows/execution-stats",
                "params": {"organization_id": str(organization_id)},
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
