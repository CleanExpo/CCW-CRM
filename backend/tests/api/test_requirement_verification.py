"""
Unit tests for Requirement Verification API endpoints.

Tests POST /api/ai/autonomous/verify-requirements/{task_id},
      GET /api/ai/autonomous/verify-requirements/{task_id}
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.services.requirement_tracer import RequirementTrace, TraceabilityMatrix

client = TestClient(app)

# Execution directory
_REPO_ROOT = Path(__file__).resolve().parents[4]
_EXECUTION_DIR = _REPO_ROOT / ".claude" / ".execution"
_BUILD_SPECS_DIR = _EXECUTION_DIR / "build-specs"
_BUILD_SPECS_DIR.mkdir(parents=True, exist_ok=True)


class TestVerifyRequirementsEndpoint:
    """Test POST /api/ai/autonomous/verify-requirements/{task_id} endpoint."""

    @pytest.fixture
    def mock_tracer(self):
        """Create a mocked RequirementTracer."""
        mock = AsyncMock()
        return mock

    def test_verify_requirements_success(self, mock_tracer):
        """Test successful requirement verification."""
        task_id = "build_20260323_140000"

        # Mock tracer response
        mock_matrix = TraceabilityMatrix(
            task_id=task_id,
            created_at="2026-03-23T14:30:00Z",
            requirements=[
                RequirementTrace(
                    requirement_id="R1",
                    text="Logout button visible",
                    files=["apps/web/components/LogoutButton.tsx"],
                    verified=True,
                    confidence=0.9,
                    notes="Button component implemented",
                )
            ],
            total_requirements=1,
            verified_count=1,
            unverified_count=0,
            coverage_percentage=100.0,
        )

        mock_tracer.trace_requirements = AsyncMock(return_value=mock_matrix)

        with patch("src.api.routes.ai.requirement_verification.get_tracer", return_value=mock_tracer):
            response = client.post(f"/api/ai/autonomous/verify-requirements/{task_id}")

            assert response.status_code == 200
            data = response.json()

            assert data["task_id"] == task_id
            assert "matrix" in data
            assert data["matrix"]["total_requirements"] == 1
            assert data["matrix"]["verified_count"] == 1
            assert data["matrix"]["coverage_percentage"] == 100.0
            assert "All 1 requirements" in data["message"]

    def test_verify_requirements_not_found(self, mock_tracer):
        """Test verifying requirements for non-existent build spec returns 404."""
        task_id = "build_99999999_999999"

        mock_tracer.trace_requirements = AsyncMock(
            side_effect=FileNotFoundError("Build spec not found")
        )

        with patch("src.api.routes.ai.requirement_verification.get_tracer", return_value=mock_tracer):
            response = client.post(f"/api/ai/autonomous/verify-requirements/{task_id}")

            assert response.status_code == 404
            assert "not found" in response.json()["detail"]

    def test_verify_requirements_no_should_see_items(self, mock_tracer):
        """Test verifying requirements with no SHOULD SEE items returns 400."""
        task_id = "build_20260323_140001"

        mock_tracer.trace_requirements = AsyncMock(
            side_effect=ValueError("Build spec has no SHOULD SEE items")
        )

        with patch("src.api.routes.ai.requirement_verification.get_tracer", return_value=mock_tracer):
            response = client.post(f"/api/ai/autonomous/verify-requirements/{task_id}")

            assert response.status_code == 400
            assert "no SHOULD SEE items" in response.json()["detail"]

    def test_verify_requirements_partial_coverage(self, mock_tracer):
        """Test verification with partial coverage."""
        task_id = "build_20260323_140002"

        # Mock tracer response with partial coverage
        mock_matrix = TraceabilityMatrix(
            task_id=task_id,
            created_at="2026-03-23T14:30:00Z",
            requirements=[
                RequirementTrace(
                    requirement_id="R1",
                    text="Feature A visible",
                    files=["apps/web/components/FeatureA.tsx"],
                    verified=True,
                    confidence=0.9,
                    notes="Implemented",
                ),
                RequirementTrace(
                    requirement_id="R2",
                    text="Feature B functional",
                    files=[],
                    verified=False,
                    confidence=0.0,
                    notes="No implementation found",
                ),
            ],
            total_requirements=2,
            verified_count=1,
            unverified_count=1,
            coverage_percentage=50.0,
        )

        mock_tracer.trace_requirements = AsyncMock(return_value=mock_matrix)

        with patch("src.api.routes.ai.requirement_verification.get_tracer", return_value=mock_tracer):
            response = client.post(f"/api/ai/autonomous/verify-requirements/{task_id}")

            assert response.status_code == 200
            data = response.json()

            assert data["matrix"]["verified_count"] == 1
            assert data["matrix"]["unverified_count"] == 1
            assert data["matrix"]["coverage_percentage"] == 50.0
            assert "1/2 requirements verified" in data["message"]


class TestGetTraceabilityMatrixEndpoint:
    """Test GET /api/ai/autonomous/verify-requirements/{task_id} endpoint."""

    @pytest.fixture
    def create_matrix_file(self):
        """Create a test traceability matrix file."""

        def _create(task_id: str):
            matrix_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:30:00Z",
                "requirements": [
                    {
                        "requirement_id": "R1",
                        "text": "Test requirement",
                        "files": ["test_file.tsx"],
                        "verified": True,
                        "confidence": 0.9,
                        "notes": "Implemented",
                    }
                ],
                "total_requirements": 1,
                "verified_count": 1,
                "unverified_count": 0,
                "coverage_percentage": 100.0,
            }

            matrix_path = _BUILD_SPECS_DIR / f"{task_id}_trace_matrix.json"
            matrix_path.write_text(json.dumps(matrix_data, indent=2), encoding="utf-8")
            return matrix_path

        return _create

    def test_get_matrix_success(self, create_matrix_file):
        """Test getting existing traceability matrix."""
        task_id = "build_20260323_140003"
        matrix_path = create_matrix_file(task_id)

        response = client.get(f"/api/ai/autonomous/verify-requirements/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["exists"] is True
        assert data["matrix"] is not None
        assert data["matrix"]["total_requirements"] == 1
        assert data["matrix"]["verified_count"] == 1

        # Clean up
        matrix_path.unlink()

    def test_get_matrix_not_found(self):
        """Test getting non-existent matrix returns exists=False."""
        task_id = "build_99999999_999999"

        response = client.get(f"/api/ai/autonomous/verify-requirements/{task_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["task_id"] == task_id
        assert data["exists"] is False
        assert data["matrix"] is None


class TestRequirementVerificationWorkflow:
    """Test complete requirement verification workflow (integration tests)."""

    @pytest.fixture
    def create_build_spec(self):
        """Create a test build spec file."""

        def _create(task_id: str):
            spec_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "stage": "completed",
                "spec": {
                    "what": "Add logout button",
                    "where": "Sidebar",
                    "who": "all users",
                    "when": "logged in",
                    "should_see": ["Logout button visible", "Clicking logs out"],
                    "dont_do": [],
                    "success": [],
                },
                "confidence": 0.9,
                "warnings": [],
                "suggestions": [],
                "approved": True,
                "metadata": {
                    "files_created": ["apps/web/components/LogoutButton.tsx"],
                    "files_modified": ["apps/web/components/sidebar.tsx"],
                },
            }

            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            spec_path.write_text(json.dumps(spec_data, indent=2), encoding="utf-8")
            return spec_path

        return _create

    def test_complete_workflow_verify_then_get(self, create_build_spec):
        """Test complete workflow: verify requirements → get matrix."""
        task_id = "build_20260323_140004"
        spec_path = create_build_spec(task_id)

        # Mock tracer
        mock_tracer = AsyncMock()
        mock_matrix = TraceabilityMatrix(
            task_id=task_id,
            created_at="2026-03-23T14:30:00Z",
            requirements=[
                RequirementTrace(
                    requirement_id="R1",
                    text="Logout button visible",
                    files=["apps/web/components/LogoutButton.tsx"],
                    verified=True,
                    confidence=0.9,
                    notes="Implemented",
                ),
                RequirementTrace(
                    requirement_id="R2",
                    text="Clicking logs out",
                    files=["apps/web/components/LogoutButton.tsx"],
                    verified=True,
                    confidence=0.95,
                    notes="onClick handler implemented",
                ),
            ],
            total_requirements=2,
            verified_count=2,
            unverified_count=0,
            coverage_percentage=100.0,
        )

        mock_tracer.trace_requirements = AsyncMock(return_value=mock_matrix)

        with patch("src.api.routes.ai.requirement_verification.get_tracer", return_value=mock_tracer):
            # Step 1: Verify requirements (POST)
            response = client.post(f"/api/ai/autonomous/verify-requirements/{task_id}")
            assert response.status_code == 200
            assert response.json()["matrix"]["verified_count"] == 2

        # Save the matrix to disk (simulate what the real service does)
        matrix_path = _BUILD_SPECS_DIR / f"{task_id}_trace_matrix.json"
        matrix_path.write_text(mock_matrix.model_dump_json(indent=2), encoding="utf-8")

        # Step 2: Get matrix (GET)
        response = client.get(f"/api/ai/autonomous/verify-requirements/{task_id}")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        assert response.json()["matrix"]["verified_count"] == 2

        # Clean up
        spec_path.unlink()
        matrix_path.unlink()
