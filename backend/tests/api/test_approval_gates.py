"""
Unit tests for Approval Gates API endpoints.

Tests POST /api/ai/autonomous/gates/{task_id}/approve,
      POST /api/ai/autonomous/gates/{task_id}/reject,
      GET  /api/ai/autonomous/gates/{task_id}
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)

# Execution directory
# test_approval_gates.py is at: apps/backend/tests/api/test_approval_gates.py
# parents[0] = api/, parents[1] = tests/, parents[2] = backend/, parents[3] = apps/, parents[4] = D:\\CCW-ERP-CRM
_REPO_ROOT = Path(__file__).resolve().parents[4]
_EXECUTION_DIR = _REPO_ROOT / ".claude" / ".execution"
_EXECUTION_DIR.mkdir(parents=True, exist_ok=True)


class TestApproveGateEndpoint:
    """Test POST /api/ai/autonomous/gates/{task_id}/approve endpoint."""

    @pytest.fixture
    def create_test_task(self):
        """Create a test task state file with approval gates."""

        def _create(task_id: str, gates_config: list[dict] | None = None):
            """
            Create a minimal task state file.

            Args:
                task_id: Task identifier
                gates_config: Optional custom gates config, defaults to 3 pending gates
            """
            if gates_config is None:
                gates_config = [
                    {
                        "gate_id": 1,
                        "phase": 1,
                        "name": "Discovery Review",
                        "status": "pending",
                        "approved_at": None,
                        "approved_by": None,
                        "feedback": None,
                    },
                    {
                        "gate_id": 2,
                        "phase": 2,
                        "name": "Design Approval",
                        "status": "pending",
                        "approved_at": None,
                        "approved_by": None,
                        "feedback": None,
                    },
                    {
                        "gate_id": 3,
                        "phase": 4,
                        "name": "Implementation Review",
                        "status": "pending",
                        "approved_at": None,
                        "approved_by": None,
                        "feedback": None,
                    },
                ]

            task_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "user_request": "Test feature implementation",
                "current_phase": 1,
                "current_agent": "discovery",
                "status": "in_progress",
                "approval_mode": "manual",
                "phases_completed": [],
                "phases_remaining": [1, 2, 3, 4, 5],
                "approval_gates": gates_config,
            }

            current_task_path = _EXECUTION_DIR / "current-task.json"
            current_task_path.write_text(json.dumps(task_data, indent=2), encoding="utf-8")
            return current_task_path

        return _create

    def test_approve_gate_success(self, create_test_task):
        """Test successful gate approval."""
        task_id = "task_20260323_140000"
        task_path = create_test_task(task_id)

        request_data = {
            "gate_id": 1,
            "approved_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json=request_data,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["gate_id"] == 1
        assert data["status"] == "approved"
        assert "approved" in data["message"].lower()
        assert "Phase 2" in data["next_action"]

        # Verify task state was updated
        task_data = json.loads(task_path.read_text(encoding="utf-8"))
        gate = next(g for g in task_data["approval_gates"] if g["gate_id"] == 1)
        assert gate["status"] == "approved"
        assert gate["approved_by"] == "test_user"
        assert gate["approved_at"] is not None

        # Verify execution log was written
        log_path = _EXECUTION_DIR / "execution-log.jsonl"
        assert log_path.exists()
        log_lines = log_path.read_text(encoding="utf-8").strip().split("\n")
        last_event = json.loads(log_lines[-1])
        assert last_event["event"] == "gate_approved"
        assert last_event["gate_id"] == 1
        assert last_event["user"] == "test_user"

        # Clean up
        task_path.unlink()
        log_path.unlink()

    def test_approve_nonexistent_task_fails(self):
        """Test approving gate for non-existent task returns 404."""
        request_data = {
            "gate_id": 1,
            "approved_by": "test_user",
        }

        response = client.post(
            "/api/ai/autonomous/gates/task_99999999_999999/approve",
            json=request_data,
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_approve_nonexistent_gate_fails(self, create_test_task):
        """Test approving non-existent gate (Pydantic validation catches invalid gate_id)."""
        task_id = "task_20260323_140001"
        task_path = create_test_task(task_id)

        request_data = {
            "gate_id": 99,  # Violates ge=1, le=3 constraint
            "approved_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json=request_data,
        )

        # Pydantic validation returns 422
        assert response.status_code == 422

        # Clean up
        task_path.unlink()

    def test_approve_already_approved_gate_fails(self, create_test_task):
        """Test approving already-approved gate returns 400."""
        task_id = "task_20260323_140002"
        gates = [
            {
                "gate_id": 1,
                "phase": 1,
                "name": "Discovery Review",
                "status": "approved",  # Already approved
                "approved_at": "2026-03-23T14:00:00Z",
                "approved_by": "previous_user",
                "feedback": None,
            },
        ]
        task_path = create_test_task(task_id, gates_config=gates)

        request_data = {
            "gate_id": 1,
            "approved_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json=request_data,
        )

        assert response.status_code == 400
        assert "not pending" in response.json()["detail"]

        # Clean up
        task_path.unlink()

    def test_approve_rejected_gate_fails(self, create_test_task):
        """Test approving rejected gate returns 400."""
        task_id = "task_20260323_140003"
        gates = [
            {
                "gate_id": 1,
                "phase": 1,
                "name": "Discovery Review",
                "status": "rejected",  # Already rejected
                "approved_at": "2026-03-23T14:00:00Z",
                "approved_by": "previous_user",
                "feedback": "Not ready",
            },
        ]
        task_path = create_test_task(task_id, gates_config=gates)

        request_data = {
            "gate_id": 1,
            "approved_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json=request_data,
        )

        assert response.status_code == 400
        assert "not pending" in response.json()["detail"]

        # Clean up
        task_path.unlink()


class TestRejectGateEndpoint:
    """Test POST /api/ai/autonomous/gates/{task_id}/reject endpoint."""

    @pytest.fixture
    def create_test_task(self):
        """Create a test task state file with approval gates."""

        def _create(task_id: str, gates_config: list[dict] | None = None):
            if gates_config is None:
                gates_config = [
                    {
                        "gate_id": 1,
                        "phase": 1,
                        "name": "Discovery Review",
                        "status": "pending",
                        "approved_at": None,
                        "approved_by": None,
                        "feedback": None,
                    },
                ]

            task_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "user_request": "Test feature implementation",
                "current_phase": 1,
                "current_agent": "discovery",
                "status": "in_progress",
                "approval_mode": "manual",
                "phases_completed": [],
                "phases_remaining": [1, 2, 3, 4, 5],
                "approval_gates": gates_config,
            }

            current_task_path = _EXECUTION_DIR / "current-task.json"
            current_task_path.write_text(json.dumps(task_data, indent=2), encoding="utf-8")
            return current_task_path

        return _create

    def test_reject_gate_success(self, create_test_task):
        """Test successful gate rejection."""
        task_id = "task_20260323_140004"
        task_path = create_test_task(task_id)

        request_data = {
            "gate_id": 1,
            "feedback": "Design is too complex. Simplify the architecture.",
            "rejected_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/reject",
            json=request_data,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["gate_id"] == 1
        assert data["status"] == "rejected"
        assert "rejected" in data["message"].lower()
        assert "revise" in data["next_action"].lower()

        # Verify task state was updated
        task_data = json.loads(task_path.read_text(encoding="utf-8"))
        gate = next(g for g in task_data["approval_gates"] if g["gate_id"] == 1)
        assert gate["status"] == "rejected"
        assert gate["approved_by"] == "test_user"
        assert gate["feedback"] == "Design is too complex. Simplify the architecture."
        assert gate["approved_at"] is not None
        assert task_data["status"] == "paused"

        # Verify execution log
        log_path = _EXECUTION_DIR / "execution-log.jsonl"
        assert log_path.exists()
        log_lines = log_path.read_text(encoding="utf-8").strip().split("\n")
        last_event = json.loads(log_lines[-1])
        assert last_event["event"] == "gate_rejected"
        assert last_event["feedback"] == "Design is too complex. Simplify the architecture."

        # Clean up
        task_path.unlink()
        log_path.unlink()

    def test_reject_nonexistent_task_fails(self):
        """Test rejecting gate for non-existent task returns 404."""
        request_data = {
            "gate_id": 1,
            "feedback": "Test feedback",
            "rejected_by": "test_user",
        }

        response = client.post(
            "/api/ai/autonomous/gates/task_99999999_999999/reject",
            json=request_data,
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_reject_already_approved_gate_fails(self, create_test_task):
        """Test rejecting already-approved gate returns 400."""
        task_id = "task_20260323_140005"
        gates = [
            {
                "gate_id": 1,
                "phase": 1,
                "name": "Discovery Review",
                "status": "approved",
                "approved_at": "2026-03-23T14:00:00Z",
                "approved_by": "previous_user",
                "feedback": None,
            },
        ]
        task_path = create_test_task(task_id, gates_config=gates)

        request_data = {
            "gate_id": 1,
            "feedback": "Test feedback",
            "rejected_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/reject",
            json=request_data,
        )

        assert response.status_code == 400
        assert "not pending" in response.json()["detail"]

        # Clean up
        task_path.unlink()

    def test_reject_requires_feedback(self, create_test_task):
        """Test that rejecting requires non-empty feedback (Pydantic validation)."""
        task_id = "task_20260323_140006"
        task_path = create_test_task(task_id)

        request_data = {
            "gate_id": 1,
            "feedback": "",  # Empty string - violates min_length=1
            "rejected_by": "test_user",
        }

        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/reject",
            json=request_data,
        )

        # Pydantic validation error returns 422
        assert response.status_code == 422

        # Clean up
        task_path.unlink()


class TestListGatesEndpoint:
    """Test GET /api/ai/autonomous/gates/{task_id} endpoint."""

    @pytest.fixture
    def create_test_task(self):
        """Create a test task state file with approval gates."""

        def _create(task_id: str, gates_config: list[dict] | None = None):
            if gates_config is None:
                gates_config = [
                    {
                        "gate_id": 1,
                        "phase": 1,
                        "name": "Discovery Review",
                        "status": "approved",
                        "approved_at": "2026-03-23T14:00:00Z",
                        "approved_by": "user1",
                        "feedback": None,
                    },
                    {
                        "gate_id": 2,
                        "phase": 2,
                        "name": "Design Approval",
                        "status": "pending",
                        "approved_at": None,
                        "approved_by": None,
                        "feedback": None,
                    },
                    {
                        "gate_id": 3,
                        "phase": 4,
                        "name": "Implementation Review",
                        "status": "pending",
                        "approved_at": None,
                        "approved_by": None,
                        "feedback": None,
                    },
                ]

            task_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "user_request": "Test feature implementation",
                "current_phase": 2,
                "current_agent": "architect",
                "status": "in_progress",
                "approval_mode": "manual",
                "phases_completed": [1],
                "phases_remaining": [2, 3, 4, 5],
                "approval_gates": gates_config,
            }

            current_task_path = _EXECUTION_DIR / "current-task.json"
            current_task_path.write_text(json.dumps(task_data, indent=2), encoding="utf-8")
            return current_task_path

        return _create

    def test_list_gates_success(self, create_test_task):
        """Test listing all gates."""
        task_id = "task_20260323_140007"
        task_path = create_test_task(task_id)

        response = client.get(f"/api/ai/autonomous/gates/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert len(data["gates"]) == 3
        assert data["current_gate"] == 2  # Gate 2 is pending

        # Verify gate structure
        gate1 = next(g for g in data["gates"] if g["gate_id"] == 1)
        assert gate1["status"] == "approved"
        assert gate1["approved_by"] == "user1"

        gate2 = next(g for g in data["gates"] if g["gate_id"] == 2)
        assert gate2["status"] == "pending"
        assert gate2["approved_at"] is None

        # Clean up
        task_path.unlink()

    def test_list_gates_no_pending(self, create_test_task):
        """Test listing gates when all are approved."""
        task_id = "task_20260323_140008"
        gates = [
            {
                "gate_id": 1,
                "phase": 1,
                "name": "Discovery Review",
                "status": "approved",
                "approved_at": "2026-03-23T14:00:00Z",
                "approved_by": "user1",
                "feedback": None,
            },
            {
                "gate_id": 2,
                "phase": 2,
                "name": "Design Approval",
                "status": "approved",
                "approved_at": "2026-03-23T14:01:00Z",
                "approved_by": "user1",
                "feedback": None,
            },
        ]
        task_path = create_test_task(task_id, gates_config=gates)

        response = client.get(f"/api/ai/autonomous/gates/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert len(data["gates"]) == 2
        assert data["current_gate"] is None  # No pending gates

        # Clean up
        task_path.unlink()

    def test_list_gates_nonexistent_task_fails(self):
        """Test listing gates for non-existent task returns 404."""
        response = client.get("/api/ai/autonomous/gates/task_99999999_999999")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]


class TestApprovalGatesWorkflow:
    """Test complete approval gates workflow (integration tests)."""

    @pytest.fixture
    def create_test_task(self):
        """Create a test task state file."""

        def _create(task_id: str):
            gates_config = [
                {
                    "gate_id": 1,
                    "phase": 1,
                    "name": "Discovery Review",
                    "status": "pending",
                    "approved_at": None,
                    "approved_by": None,
                    "feedback": None,
                },
                {
                    "gate_id": 2,
                    "phase": 2,
                    "name": "Design Approval",
                    "status": "pending",
                    "approved_at": None,
                    "approved_by": None,
                    "feedback": None,
                },
            ]

            task_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "user_request": "Test feature",
                "current_phase": 1,
                "current_agent": "discovery",
                "status": "in_progress",
                "approval_mode": "manual",
                "phases_completed": [],
                "phases_remaining": [1, 2, 3, 4, 5],
                "approval_gates": gates_config,
            }

            current_task_path = _EXECUTION_DIR / "current-task.json"
            current_task_path.write_text(json.dumps(task_data, indent=2), encoding="utf-8")
            return current_task_path

        return _create

    def test_complete_workflow_approve_all_gates(self, create_test_task):
        """Test complete workflow: list → approve gate 1 → list → approve gate 2."""
        task_id = "task_20260323_140009"
        task_path = create_test_task(task_id)

        # Step 1: List gates (both pending)
        response = client.get(f"/api/ai/autonomous/gates/{task_id}")
        assert response.status_code == 200
        assert response.json()["current_gate"] == 1

        # Step 2: Approve gate 1
        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json={"gate_id": 1, "approved_by": "user1"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

        # Step 3: List gates (gate 2 now current)
        response = client.get(f"/api/ai/autonomous/gates/{task_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["current_gate"] == 2
        gate1 = next(g for g in data["gates"] if g["gate_id"] == 1)
        assert gate1["status"] == "approved"

        # Step 4: Approve gate 2
        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json={"gate_id": 2, "approved_by": "user1"},
        )
        assert response.status_code == 200

        # Step 5: List gates (all approved)
        response = client.get(f"/api/ai/autonomous/gates/{task_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["current_gate"] is None
        assert all(g["status"] == "approved" for g in data["gates"])

        # Clean up
        task_path.unlink()
        log_path = _EXECUTION_DIR / "execution-log.jsonl"
        if log_path.exists():
            log_path.unlink()

    def test_complete_workflow_reject_gate(self, create_test_task):
        """Test complete workflow: approve gate 1 → reject gate 2 → verify paused."""
        task_id = "task_20260323_140010"
        task_path = create_test_task(task_id)

        # Step 1: Approve gate 1
        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/approve",
            json={"gate_id": 1, "approved_by": "user1"},
        )
        assert response.status_code == 200

        # Step 2: Reject gate 2
        response = client.post(
            f"/api/ai/autonomous/gates/{task_id}/reject",
            json={
                "gate_id": 2,
                "feedback": "Design needs revision",
                "rejected_by": "user1",
            },
        )
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

        # Step 3: Verify task is paused
        task_data = json.loads(task_path.read_text(encoding="utf-8"))
        assert task_data["status"] == "paused"

        # Step 4: List gates (gate 2 is rejected)
        response = client.get(f"/api/ai/autonomous/gates/{task_id}")
        assert response.status_code == 200
        data = response.json()
        gate2 = next(g for g in data["gates"] if g["gate_id"] == 2)
        assert gate2["status"] == "rejected"
        assert gate2["feedback"] == "Design needs revision"

        # Clean up
        task_path.unlink()
        log_path = _EXECUTION_DIR / "execution-log.jsonl"
        if log_path.exists():
            log_path.unlink()
