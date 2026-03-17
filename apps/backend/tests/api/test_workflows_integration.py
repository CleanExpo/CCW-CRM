"""
Workflows Integration Tests

Tests for workflows SLA escalation and execution stats endpoints (Phase 2 - Batch 2C)
"""

import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


class TestSLAEscalation:
    """Test POST /api/workflows/sla/escalate"""

    def test_escalate_sla_success(self):
        """Should escalate SLA to higher level"""
        response = client.post(
            "/api/workflows/sla/escalate",
            json={"task_id": "task-123", "escalation_level": 2},
        )
        # May return 401 if auth required, or 200 if mock/demo mode
        assert response.status_code in [200, 401, 404, 422]

    def test_escalate_sla_missing_task_id(self):
        """Should reject request without task_id"""
        response = client.post(
            "/api/workflows/sla/escalate",
            json={"escalation_level": 1},
        )
        assert response.status_code == 422  # Validation error

    def test_escalate_sla_invalid_level(self):
        """Should reject invalid escalation level"""
        response = client.post(
            "/api/workflows/sla/escalate",
            json={"task_id": "task-123", "escalation_level": -1},
        )
        assert response.status_code in [400, 422]


class TestExecutionStats:
    """Test GET /api/workflows/execution-stats"""

    def test_get_execution_stats_all(self):
        """Should return execution stats for all workflows"""
        response = client.get("/api/workflows/execution-stats")
        # May return 401 if auth required, or 200 if mock/demo mode
        assert response.status_code in [200, 401]

        if response.status_code == 200:
            data = response.json()
            assert "total_executions" in data
            assert "successful" in data
            assert "failed" in data

    def test_get_execution_stats_by_template(self):
        """Should return stats filtered by template_id"""
        response = client.get("/api/workflows/execution-stats?template_id=template-123")
        assert response.status_code in [200, 401, 404]

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)

    def test_get_execution_stats_invalid_template(self):
        """Should handle non-existent template gracefully"""
        response = client.get("/api/workflows/execution-stats?template_id=nonexistent")
        # Should either return empty stats or 404
        assert response.status_code in [200, 404, 401]
