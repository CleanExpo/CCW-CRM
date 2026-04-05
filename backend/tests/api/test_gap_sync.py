"""
Unit tests for Gap Sync API endpoints.

Tests GET /api/ai/gap-sync/status/{sync_id},
      GET /api/ai/gap-sync/list,
      POST /api/ai/gap-sync/{sync_id}/cancel
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)

# Gap sync directory
# test_gap_sync.py is at: apps/backend/tests/api/test_gap_sync.py
# parents[0] = api/, parents[1] = tests/, parents[2] = backend/, parents[3] = apps/, parents[4] = D:\\CCW-ERP-CRM
_REPO_ROOT = Path(__file__).resolve().parents[4]
_GAP_SYNC_DIR = _REPO_ROOT / ".claude" / ".execution" / "gap-sync"
_GAP_SYNC_DIR.mkdir(parents=True, exist_ok=True)


class TestGetSyncStatus:
    """Test GET /api/ai/gap-sync/status/{sync_id} endpoint."""

    @pytest.fixture
    def create_test_sync(self):
        """Create a test sync state file."""

        def _create(sync_id: str, status: str = "in_progress", current_step: int = 1):
            """Create a minimal sync state file."""
            sync_dir = _GAP_SYNC_DIR / sync_id
            sync_dir.mkdir(parents=True, exist_ok=True)

            state_data = {
                "sync_id": sync_id,
                "created_at": "2026-03-23T14:30:00Z",
                "status": status,
                "current_step": current_step,
                "steps": [
                    {
                        "step_id": 1,
                        "name": "pi-cross-ref",
                        "status": "completed" if current_step > 1 else "in_progress",
                        "started_at": "2026-03-23T14:30:00Z",
                        "completed_at": "2026-03-23T14:35:00Z" if current_step > 1 else None,
                        "output_path": f".claude/.execution/gap-sync/{sync_id}/step-1-cross-ref.md",
                        "error": None,
                    },
                    {
                        "step_id": 2,
                        "name": "pi-prioritize",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "output_path": f".claude/.execution/gap-sync/{sync_id}/step-2-prioritize.md",
                        "error": None,
                    },
                    {
                        "step_id": 3,
                        "name": "pi-prd",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "output_path": "docs/PRD-CCW-GAPS-2026-03-23.md",
                        "error": None,
                    },
                    {
                        "step_id": 4,
                        "name": "pi-issues",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "output_path": "docs/gaps/linear-import.csv",
                        "error": None,
                        "issues_created": 0,
                    },
                ],
                "total_issues_created": 0,
                "rollback_performed": False,
            }

            state_path = sync_dir / "state.json"
            state_path.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
            return sync_dir

        return _create

    def test_get_status_success(self, create_test_sync):
        """Test getting status of existing sync."""
        sync_id = "sync_20260323_143000"
        sync_dir = create_test_sync(sync_id)

        response = client.get(f"/api/ai/gap-sync/status/{sync_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["sync_id"] == sync_id
        assert data["exists"] is True
        assert data["state"] is not None
        assert data["state"]["status"] == "in_progress"
        assert data["state"]["current_step"] == 1
        assert len(data["state"]["steps"]) == 4

        # Verify step structure
        step1 = data["state"]["steps"][0]
        assert step1["step_id"] == 1
        assert step1["name"] == "pi-cross-ref"
        assert step1["status"] == "in_progress"

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)

    def test_get_status_nonexistent_sync(self):
        """Test getting status of non-existent sync returns exists=False."""
        sync_id = "sync_99999999_999999"

        response = client.get(f"/api/ai/gap-sync/status/{sync_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["sync_id"] == sync_id
        assert data["exists"] is False
        assert data["state"] is None

    def test_get_status_completed_sync(self, create_test_sync):
        """Test getting status of completed sync."""
        sync_id = "sync_20260323_143001"
        sync_dir = create_test_sync(sync_id, status="completed", current_step=4)

        response = client.get(f"/api/ai/gap-sync/status/{sync_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["state"]["status"] == "completed"
        assert data["state"]["current_step"] == 4

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)


class TestListSyncs:
    """Test GET /api/ai/gap-sync/list endpoint."""

    @pytest.fixture
    def create_multiple_syncs(self):
        """Create multiple test sync state files."""

        def _create():
            syncs = []
            for i in range(3):
                sync_id = f"sync_2026032{i}_140000"
                sync_dir = _GAP_SYNC_DIR / sync_id
                sync_dir.mkdir(parents=True, exist_ok=True)

                state_data = {
                    "sync_id": sync_id,
                    "created_at": f"2026-03-2{i}T14:00:00Z",
                    "status": "completed" if i == 0 else "in_progress",
                    "current_step": 4 if i == 0 else i + 1,
                    "steps": [],
                    "total_issues_created": 5 if i == 0 else 0,
                    "rollback_performed": False,
                }

                state_path = sync_dir / "state.json"
                state_path.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
                syncs.append(sync_dir)

            return syncs

        return _create

    def test_list_syncs_success(self, create_multiple_syncs):
        """Test listing all syncs."""
        sync_dirs = create_multiple_syncs()

        response = client.get("/api/ai/gap-sync/list")

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 3
        assert len(data["syncs"]) == 3

        # Verify syncs are sorted by created_at descending (most recent first)
        assert data["syncs"][0]["sync_id"] == "sync_20260322_140000"
        assert data["syncs"][1]["sync_id"] == "sync_20260321_140000"
        assert data["syncs"][2]["sync_id"] == "sync_20260320_140000"

        # Verify completed sync has issues_created
        completed_sync = data["syncs"][2]
        assert completed_sync["status"] == "completed"
        assert completed_sync["total_issues_created"] == 5

        # Clean up
        import shutil
        for sync_dir in sync_dirs:
            shutil.rmtree(sync_dir)

    def test_list_syncs_empty(self):
        """Test listing when no syncs exist."""
        # Ensure gap-sync directory is empty
        import shutil
        if _GAP_SYNC_DIR.exists():
            for item in _GAP_SYNC_DIR.iterdir():
                if item.is_dir() and item.name.startswith("sync_"):
                    shutil.rmtree(item)

        response = client.get("/api/ai/gap-sync/list")

        assert response.status_code == 200
        data = response.json()

        assert data["total"] == 0
        assert data["syncs"] == []


class TestCancelSync:
    """Test POST /api/ai/gap-sync/{sync_id}/cancel endpoint."""

    @pytest.fixture
    def create_test_sync(self):
        """Create a test sync state file."""

        def _create(sync_id: str, status: str = "in_progress"):
            sync_dir = _GAP_SYNC_DIR / sync_id
            sync_dir.mkdir(parents=True, exist_ok=True)

            state_data = {
                "sync_id": sync_id,
                "created_at": "2026-03-23T14:30:00Z",
                "status": status,
                "current_step": 2,
                "steps": [],
                "total_issues_created": 0,
                "rollback_performed": False,
            }

            state_path = sync_dir / "state.json"
            state_path.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
            return sync_dir

        return _create

    def test_cancel_sync_success(self, create_test_sync):
        """Test cancelling a running sync."""
        sync_id = "sync_20260323_143002"
        sync_dir = create_test_sync(sync_id)

        response = client.post(f"/api/ai/gap-sync/{sync_id}/cancel")

        assert response.status_code == 200
        data = response.json()

        assert data["sync_id"] == sync_id
        assert data["previous_status"] == "in_progress"
        assert data["new_status"] == "cancelled"
        assert "cancelled" in data["message"].lower()

        # Verify state was updated
        state_path = sync_dir / "state.json"
        state_data = json.loads(state_path.read_text(encoding="utf-8"))
        assert state_data["status"] == "cancelled"

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)

    def test_cancel_nonexistent_sync_fails(self):
        """Test cancelling non-existent sync returns 404."""
        sync_id = "sync_99999999_999999"

        response = client.post(f"/api/ai/gap-sync/{sync_id}/cancel")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_cancel_completed_sync_fails(self, create_test_sync):
        """Test cancelling completed sync returns 400."""
        sync_id = "sync_20260323_143003"
        sync_dir = create_test_sync(sync_id, status="completed")

        response = client.post(f"/api/ai/gap-sync/{sync_id}/cancel")

        assert response.status_code == 400
        assert "Cannot cancel" in response.json()["detail"]

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)

    def test_cancel_failed_sync_fails(self, create_test_sync):
        """Test cancelling failed sync returns 400."""
        sync_id = "sync_20260323_143004"
        sync_dir = create_test_sync(sync_id, status="failed")

        response = client.post(f"/api/ai/gap-sync/{sync_id}/cancel")

        assert response.status_code == 400
        assert "Cannot cancel" in response.json()["detail"]

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)

    def test_cancel_already_cancelled_fails(self, create_test_sync):
        """Test cancelling already-cancelled sync returns 400."""
        sync_id = "sync_20260323_143005"
        sync_dir = create_test_sync(sync_id, status="cancelled")

        response = client.post(f"/api/ai/gap-sync/{sync_id}/cancel")

        assert response.status_code == 400
        assert "Cannot cancel" in response.json()["detail"]

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)


class TestGapSyncWorkflow:
    """Test complete gap sync workflow (integration tests)."""

    @pytest.fixture
    def create_test_sync(self):
        """Create a test sync state file."""

        def _create(sync_id: str):
            sync_dir = _GAP_SYNC_DIR / sync_id
            sync_dir.mkdir(parents=True, exist_ok=True)

            state_data = {
                "sync_id": sync_id,
                "created_at": "2026-03-23T14:30:00Z",
                "status": "in_progress",
                "current_step": 1,
                "steps": [
                    {
                        "step_id": 1,
                        "name": "pi-cross-ref",
                        "status": "in_progress",
                        "started_at": "2026-03-23T14:30:00Z",
                        "completed_at": None,
                        "output_path": f".claude/.execution/gap-sync/{sync_id}/step-1-cross-ref.md",
                        "error": None,
                    },
                    {
                        "step_id": 2,
                        "name": "pi-prioritize",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "output_path": f".claude/.execution/gap-sync/{sync_id}/step-2-prioritize.md",
                        "error": None,
                    },
                    {
                        "step_id": 3,
                        "name": "pi-prd",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "output_path": "docs/PRD-CCW-GAPS-2026-03-23.md",
                        "error": None,
                    },
                    {
                        "step_id": 4,
                        "name": "pi-issues",
                        "status": "pending",
                        "started_at": None,
                        "completed_at": None,
                        "output_path": "docs/gaps/linear-import.csv",
                        "error": None,
                        "issues_created": 0,
                    },
                ],
                "total_issues_created": 0,
                "rollback_performed": False,
            }

            state_path = sync_dir / "state.json"
            state_path.write_text(json.dumps(state_data, indent=2), encoding="utf-8")
            return sync_dir

        return _create

    def test_complete_workflow_list_status_cancel(self, create_test_sync):
        """Test complete workflow: list → get status → cancel."""
        sync_id = "sync_20260323_143006"
        sync_dir = create_test_sync(sync_id)

        # Step 1: List syncs (should include our new sync)
        response = client.get("/api/ai/gap-sync/list")
        assert response.status_code == 200
        syncs = [s for s in response.json()["syncs"] if s["sync_id"] == sync_id]
        assert len(syncs) == 1
        assert syncs[0]["status"] == "in_progress"

        # Step 2: Get status (should show in_progress)
        response = client.get(f"/api/ai/gap-sync/status/{sync_id}")
        assert response.status_code == 200
        assert response.json()["state"]["status"] == "in_progress"
        assert response.json()["state"]["current_step"] == 1

        # Step 3: Cancel sync
        response = client.post(f"/api/ai/gap-sync/{sync_id}/cancel")
        assert response.status_code == 200
        assert response.json()["new_status"] == "cancelled"

        # Step 4: Verify status shows cancelled
        response = client.get(f"/api/ai/gap-sync/status/{sync_id}")
        assert response.status_code == 200
        assert response.json()["state"]["status"] == "cancelled"

        # Step 5: Verify list shows cancelled
        response = client.get("/api/ai/gap-sync/list")
        assert response.status_code == 200
        syncs = [s for s in response.json()["syncs"] if s["sync_id"] == sync_id]
        assert len(syncs) == 1
        assert syncs[0]["status"] == "cancelled"

        # Clean up
        import shutil
        shutil.rmtree(sync_dir)
