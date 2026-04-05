"""
Unit tests for Build Command API endpoints.

Tests POST /api/ai/build/start, POST /api/ai/build/approve, GET /api/ai/build/status/{task_id}
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.services.requirement_extractor import ExtractedSpec

client = TestClient(app)

# Build specs directory
# test_build_command.py is at: apps/backend/tests/api/test_build_command.py
# parents[0] = api/, parents[1] = tests/, parents[2] = backend/, parents[3] = apps/, parents[4] = D:\CCW-ERP-CRM
_REPO_ROOT = Path(__file__).resolve().parents[4]
_BUILD_SPECS_DIR = _REPO_ROOT / ".claude" / ".execution" / "build-specs"
_BUILD_SPECS_DIR.mkdir(parents=True, exist_ok=True)


class TestBuildStartEndpoint:
    """Test POST /api/ai/build/start endpoint."""

    @pytest.fixture
    def mock_extracted_spec(self):
        """Create a valid ExtractedSpec for mocking."""
        return ExtractedSpec(
            what="Add a logout button to the sidebar navigation",
            where="Sidebar navigation",
            who="all authenticated users",
            when="User is logged in",
            should_see=[
                "Logout button visible at bottom of sidebar",
                "Clicking button logs user out",
            ],
            dont_do=["Don't modify authentication middleware"],
            success=["User can successfully log out"],
        )

    def test_start_build_success(self, mock_extracted_spec):
        """Test successful build start."""
        request_data = {
            "description": "Add a logout button to the sidebar",
        }

        with patch("src.api.routes.ai.build_command.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=mock_extracted_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/build/start", json=request_data)

            assert response.status_code == 200
            data = response.json()

            # Check response structure
            assert "task_id" in data
            assert "spec" in data
            assert "message" in data

            # Check task_id format
            task_id = data["task_id"]
            assert task_id.startswith("build_")
            assert len(task_id) == 21  # build_YYYYMMDD_HHMMSS

            # Check spec
            spec = data["spec"]
            assert spec["task_id"] == task_id
            assert spec["stage"] == "awaiting_approval"
            assert spec["approved"] is False
            assert spec["confidence"] > 0.0
            assert "spec" in spec

            # Verify spec was saved to disk
            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            assert spec_path.exists()

            # Clean up
            spec_path.unlink()

    def test_start_build_with_context(self, mock_extracted_spec):
        """Test build start with context."""
        request_data = {
            "description": "Add export button",
            "context": {
                "current_page": "products",
                "user_role": "admin",
            },
        }

        with patch("src.api.routes.ai.build_command.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=mock_extracted_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/build/start", json=request_data)

            assert response.status_code == 200

            # Verify context was passed to extractor
            mock_extractor.extract.assert_called_once()
            called_description = mock_extractor.extract.call_args[0][0]
            assert "current_page: products" in called_description
            assert "user_role: admin" in called_description

            # Clean up
            task_id = response.json()["task_id"]
            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            if spec_path.exists():
                spec_path.unlink()

    def test_start_build_description_too_short_fails(self):
        """Test that description < 10 chars returns 422."""
        request_data = {
            "description": "Add X",  # Only 5 chars
        }

        response = client.post("/api/ai/build/start", json=request_data)

        assert response.status_code == 422  # Pydantic validation error

    def test_start_build_extraction_fails(self):
        """Test that extraction failure returns 400."""
        request_data = {
            "description": "Something confusing and ambiguous",
        }

        with patch("src.api.routes.ai.build_command.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(
                side_effect=ValueError("Extraction failed: too vague")
            )
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/build/start", json=request_data)

            assert response.status_code == 400
            assert "Extraction failed" in response.json()["detail"]


class TestBuildApproveEndpoint:
    """Test POST /api/ai/build/approve endpoint."""

    @pytest.fixture
    def create_test_spec(self):
        """Create a test build spec file."""

        def _create(task_id: str, stage: str = "awaiting_approval", approved: bool = False):
            spec_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "stage": stage,
                "spec": {
                    "what": "Test feature",
                    "where": "Test page",
                    "who": "admin",
                    "when": "On load",
                    "should_see": ["Test result"],
                    "dont_do": [],
                    "success": [],
                },
                "confidence": 0.8,
                "warnings": [],
                "suggestions": [],
                "approved": approved,
                "approved_at": None,
                "autonomous_task_id": None,
                "error": None,
            }

            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            spec_path.write_text(json.dumps(spec_data, indent=2), encoding="utf-8")
            return spec_path

        return _create

    def test_approve_build_success(self, create_test_spec):
        """Test successful build approval."""
        task_id = "build_20260323_140000"
        spec_path = create_test_spec(task_id)

        request_data = {
            "task_id": task_id,
            "approved": True,
        }

        response = client.post("/api/ai/build/approve", json=request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["approved"] is True
        assert "autonomous_task_id" in data
        assert data["autonomous_task_id"] is not None
        assert "approved" in data["message"].lower()

        # Verify spec was updated
        spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
        assert spec_data["approved"] is True
        assert spec_data["approved_at"] is not None
        assert spec_data["stage"] == "executing"
        assert spec_data["autonomous_task_id"] is not None

        # Clean up
        spec_path.unlink()

    def test_reject_build(self, create_test_spec):
        """Test build rejection."""
        task_id = "build_20260323_140001"
        spec_path = create_test_spec(task_id)

        request_data = {
            "task_id": task_id,
            "approved": False,
            "feedback": "Too vague, please specify exact page",
        }

        response = client.post("/api/ai/build/approve", json=request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["approved"] is False
        assert "rejected" in data["message"].lower()

        # Verify spec was updated
        spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
        assert spec_data["stage"] == "failed"
        assert spec_data["error"] is not None
        assert "Too vague" in spec_data["error"]

        # Clean up
        spec_path.unlink()

    def test_approve_nonexistent_task_fails(self):
        """Test that approving non-existent task returns 404."""
        request_data = {
            "task_id": "build_99999999_999999",
            "approved": True,
        }

        response = client.post("/api/ai/build/approve", json=request_data)

        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_approve_already_approved_fails(self, create_test_spec):
        """Test that approving already-approved task returns 400."""
        task_id = "build_20260323_140002"
        spec_path = create_test_spec(task_id, approved=True)

        request_data = {
            "task_id": task_id,
            "approved": True,
        }

        response = client.post("/api/ai/build/approve", json=request_data)

        assert response.status_code == 400
        assert "already approved" in response.json()["detail"]

        # Clean up
        spec_path.unlink()

    def test_approve_already_executing_fails(self, create_test_spec):
        """Test that approving already-executing task returns 400."""
        task_id = "build_20260323_140003"
        spec_path = create_test_spec(task_id, stage="executing")

        request_data = {
            "task_id": task_id,
            "approved": True,
        }

        response = client.post("/api/ai/build/approve", json=request_data)

        assert response.status_code == 400
        assert "already in stage" in response.json()["detail"]

        # Clean up
        spec_path.unlink()


class TestBuildStatusEndpoint:
    """Test GET /api/ai/build/status/{task_id} endpoint."""

    @pytest.fixture
    def create_test_spec(self):
        """Create a test build spec file."""

        def _create(task_id: str):
            spec_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "stage": "awaiting_approval",
                "spec": {
                    "what": "Test feature",
                    "where": "Test page",
                    "who": "admin",
                    "when": "On load",
                    "should_see": ["Test result"],
                    "dont_do": [],
                    "success": [],
                },
                "confidence": 0.8,
                "warnings": [],
                "suggestions": [],
                "approved": False,
                "approved_at": None,
                "autonomous_task_id": None,
                "error": None,
            }

            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            spec_path.write_text(json.dumps(spec_data, indent=2), encoding="utf-8")
            return spec_path

        return _create

    def test_get_status_success(self, create_test_spec):
        """Test getting status of existing build."""
        task_id = "build_20260323_140004"
        spec_path = create_test_spec(task_id)

        response = client.get(f"/api/ai/build/status/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["exists"] is True
        assert "spec" in data
        assert data["spec"]["stage"] == "awaiting_approval"

        # Clean up
        spec_path.unlink()

    def test_get_status_nonexistent_task(self):
        """Test getting status of non-existent task."""
        task_id = "build_99999999_999999"

        response = client.get(f"/api/ai/build/status/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["exists"] is False
        assert data["spec"]["stage"] == "failed"
        assert data["spec"]["error"] == "Task not found"


class TestBuildWorkflow:
    """Test complete /build workflow (integration tests)."""

    def test_complete_workflow_approved(self):
        """Test complete workflow: start → approve → check status."""
        # Step 1: Start build
        start_request = {
            "description": "Add a search bar to the products page header",
        }

        with patch("src.api.routes.ai.build_command.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_spec = ExtractedSpec(
                what="Add search bar to products page header",
                where="Products page (/products) header",
                who="admin and sales users",
                when="Page loads",
                should_see=["Search bar visible", "Can type and search products"],
                dont_do=[],
                success=["Search returns results in < 2 seconds"],
            )
            mock_extractor.extract = AsyncMock(return_value=mock_spec)
            mock_get_extractor.return_value = mock_extractor

            start_response = client.post("/api/ai/build/start", json=start_request)
            assert start_response.status_code == 200
            task_id = start_response.json()["task_id"]

            # Step 2: Check status (should be awaiting_approval)
            status_response = client.get(f"/api/ai/build/status/{task_id}")
            assert status_response.status_code == 200
            assert status_response.json()["spec"]["stage"] == "awaiting_approval"
            assert status_response.json()["spec"]["approved"] is False

            # Step 3: Approve
            approve_request = {
                "task_id": task_id,
                "approved": True,
            }
            approve_response = client.post("/api/ai/build/approve", json=approve_request)
            assert approve_response.status_code == 200
            assert approve_response.json()["approved"] is True
            assert approve_response.json()["autonomous_task_id"] is not None

            # Step 4: Check status again (should be executing)
            status_response2 = client.get(f"/api/ai/build/status/{task_id}")
            assert status_response2.status_code == 200
            assert status_response2.json()["spec"]["stage"] == "executing"
            assert status_response2.json()["spec"]["approved"] is True

            # Clean up
            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            if spec_path.exists():
                spec_path.unlink()

    def test_complete_workflow_rejected(self):
        """Test complete workflow: start → reject."""
        # Step 1: Start build
        start_request = {
            "description": "Add something somewhere",
        }

        with patch("src.api.routes.ai.build_command.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_spec = ExtractedSpec(
                what="Add something",
                where="somewhere",
                who="user",
                when="sometime",
                should_see=["something appears"],
                dont_do=[],
                success=[],
            )
            mock_extractor.extract = AsyncMock(return_value=mock_spec)
            mock_get_extractor.return_value = mock_extractor

            start_response = client.post("/api/ai/build/start", json=start_request)
            assert start_response.status_code == 200
            task_id = start_response.json()["task_id"]

            # Step 2: Reject with feedback
            reject_request = {
                "task_id": task_id,
                "approved": False,
                "feedback": "Too vague, please be more specific about what and where",
            }
            reject_response = client.post("/api/ai/build/approve", json=reject_request)
            assert reject_response.status_code == 200
            assert reject_response.json()["approved"] is False

            # Step 3: Check status (should be failed with error)
            status_response = client.get(f"/api/ai/build/status/{task_id}")
            assert status_response.status_code == 200
            assert status_response.json()["spec"]["stage"] == "failed"
            assert "Too vague" in status_response.json()["spec"]["error"]

            # Clean up
            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            if spec_path.exists():
                spec_path.unlink()
