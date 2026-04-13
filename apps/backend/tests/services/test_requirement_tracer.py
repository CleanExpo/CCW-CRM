"""
Unit tests for RequirementTracer service.

Tests requirement tracing logic and traceability matrix generation.
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.services.requirement_tracer import (
    RequirementTracer,
    get_tracer,
)

# Execution directory
_REPO_ROOT = Path(__file__).resolve().parents[4]
_EXECUTION_DIR = _REPO_ROOT / ".claude" / ".execution"
_BUILD_SPECS_DIR = _EXECUTION_DIR / "build-specs"
_BUILD_SPECS_DIR.mkdir(parents=True, exist_ok=True)


class TestRequirementTracerService:
    """Test RequirementTracer service methods."""

    @pytest.fixture
    def tracer(self):
        """Create a RequirementTracer instance with mocked OpenAI client."""
        with patch.object(RequirementTracer, "__init__", lambda self: None):
            tracer = RequirementTracer()
            tracer.client = AsyncMock()
            tracer.logger = AsyncMock()
            return tracer

    @pytest.fixture
    def create_build_spec(self):
        """Create a test build spec file."""

        def _create(task_id: str, should_see: list[str]):
            spec_data = {
                "task_id": task_id,
                "created_at": "2026-03-23T14:00:00Z",
                "stage": "completed",
                "spec": {
                    "what": "Add logout button",
                    "where": "Sidebar",
                    "who": "all users",
                    "when": "logged in",
                    "should_see": should_see,
                    "dont_do": [],
                    "success": [],
                },
                "confidence": 0.9,
                "warnings": [],
                "suggestions": [],
                "approved": True,
                "metadata": {
                    "files_created": ["apps/web/components/sidebar/LogoutButton.tsx"],
                    "files_modified": ["apps/web/components/layout/sidebar.tsx"],
                },
            }

            spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
            spec_path.write_text(json.dumps(spec_data, indent=2), encoding="utf-8")
            return spec_path

        return _create

    @pytest.mark.asyncio
    async def test_load_build_spec(self, tracer, create_build_spec):
        """Test loading build spec and extracting requirements."""
        task_id = "build_20260323_140000"
        should_see = [
            "Logout button visible at bottom of sidebar",
            "Clicking button logs user out",
        ]
        spec_path = create_build_spec(task_id, should_see)

        result = await tracer._load_build_spec(task_id)

        assert "requirements" in result
        assert len(result["requirements"]) == 2
        assert result["requirements"][0]["id"] == "R1"
        assert result["requirements"][0]["text"] == should_see[0]
        assert result["requirements"][1]["id"] == "R2"
        assert result["requirements"][1]["text"] == should_see[1]

        # Clean up
        spec_path.unlink()

    @pytest.mark.asyncio
    async def test_load_build_spec_not_found(self, tracer):
        """Test loading non-existent build spec raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            await tracer._load_build_spec("build_99999999_999999")

    @pytest.mark.asyncio
    async def test_load_build_spec_no_should_see(self, tracer, create_build_spec):
        """Test loading spec with no SHOULD SEE items raises ValueError."""
        task_id = "build_20260323_140001"
        spec_path = create_build_spec(task_id, [])

        with pytest.raises(ValueError, match="no SHOULD SEE items"):
            await tracer._load_build_spec(task_id)

        # Clean up
        spec_path.unlink()

    @pytest.mark.asyncio
    async def test_load_implementation(self, tracer, create_build_spec):
        """Test loading implementation files from build spec metadata."""
        task_id = "build_20260323_140002"
        spec_path = create_build_spec(
            task_id,
            ["Requirement 1"],
        )

        result = await tracer._load_implementation(task_id)

        assert "files" in result
        assert len(result["files"]) == 2
        assert "apps/web/components/sidebar/LogoutButton.tsx" in result["files"]
        assert "apps/web/components/layout/sidebar.tsx" in result["files"]

        # Clean up
        spec_path.unlink()

    @pytest.mark.asyncio
    async def test_match_requirements_no_files(self, tracer):
        """Test matching requirements when no implementation files exist."""
        requirements = [
            {"id": "R1", "text": "User should see X"},
            {"id": "R2", "text": "User should see Y"},
        ]
        files = []

        traces = await tracer._match_requirements_to_files(requirements, files)

        assert len(traces) == 2
        assert traces[0].requirement_id == "R1"
        assert traces[0].files == []
        assert traces[0].verified is False
        assert traces[0].confidence == 0.0
        assert "No implementation files found" in traces[0].notes

    @pytest.mark.asyncio
    async def test_match_requirements_with_mock_llm(self, create_build_spec):
        """Test matching requirements with mocked LLM response."""
        task_id = "build_20260323_140003"
        spec_path = create_build_spec(
            task_id,
            ["Logout button visible", "Clicking logs out"],
        )

        # Mock LLM response
        mock_response = AsyncMock()
        mock_response.choices = [
            AsyncMock(
                message=AsyncMock(
                    content=json.dumps(
                        [
                            {
                                "requirement_id": "R1",
                                "files": ["apps/web/components/sidebar/LogoutButton.tsx"],
                                "verified": True,
                                "confidence": 0.9,
                                "notes": "Button component implements visibility",
                            },
                            {
                                "requirement_id": "R2",
                                "files": [
                                    "apps/web/components/sidebar/LogoutButton.tsx",
                                    "apps/web/lib/api/auth.ts",
                                ],
                                "verified": True,
                                "confidence": 0.95,
                                "notes": "onClick handler calls logout API",
                            },
                        ]
                    )
                )
            )
        ]

        with patch.object(RequirementTracer, "__init__", lambda self: None):
            tracer = RequirementTracer()
            tracer.client = AsyncMock()
            tracer.client.chat.completions.create = AsyncMock(return_value=mock_response)
            tracer.logger = AsyncMock()

            requirements = [
                {"id": "R1", "text": "Logout button visible"},
                {"id": "R2", "text": "Clicking logs out"},
            ]
            files = [
                "apps/web/components/sidebar/LogoutButton.tsx",
                "apps/web/lib/api/auth.ts",
            ]

            traces = await tracer._match_requirements_to_files(requirements, files)

            assert len(traces) == 2
            assert traces[0].requirement_id == "R1"
            assert traces[0].verified is True
            assert traces[0].confidence == 0.9
            assert len(traces[1].files) == 2

        # Clean up
        spec_path.unlink()

    @pytest.mark.asyncio
    async def test_trace_requirements_end_to_end(self, create_build_spec):
        """Test complete requirement tracing workflow with mocked LLM."""
        task_id = "build_20260323_140004"
        spec_path = create_build_spec(
            task_id,
            ["Feature A visible", "Feature B functional"],
        )

        # Mock LLM response
        mock_response = AsyncMock()
        mock_response.choices = [
            AsyncMock(
                message=AsyncMock(
                    content=json.dumps(
                        [
                            {
                                "requirement_id": "R1",
                                "files": ["apps/web/components/FeatureA.tsx"],
                                "verified": True,
                                "confidence": 0.85,
                                "notes": "Component renders feature A",
                            },
                            {
                                "requirement_id": "R2",
                                "files": ["apps/web/components/FeatureB.tsx"],
                                "verified": True,
                                "confidence": 0.90,
                                "notes": "Component implements feature B functionality",
                            },
                        ]
                    )
                )
            )
        ]

        with patch.object(RequirementTracer, "__init__", lambda self: None):
            tracer = RequirementTracer()
            tracer.client = AsyncMock()
            tracer.client.chat.completions.create = AsyncMock(return_value=mock_response)
            tracer.logger = AsyncMock()

            # Patch _load_build_spec and _load_implementation to use test data
            async def mock_load_spec(tid):
                return {
                    "requirements": [
                        {"id": "R1", "text": "Feature A visible"},
                        {"id": "R2", "text": "Feature B functional"},
                    ],
                    "spec": {},
                }

            async def mock_load_impl(tid):
                return {
                    "files": [
                        "apps/web/components/FeatureA.tsx",
                        "apps/web/components/FeatureB.tsx",
                    ]
                }

            tracer._load_build_spec = mock_load_spec
            tracer._load_implementation = mock_load_impl

            # Mock _save_matrix to avoid file I/O
            async def mock_save(tid, matrix):
                pass

            tracer._save_matrix = mock_save

            matrix = await tracer.trace_requirements(task_id)

            assert matrix.task_id == task_id
            assert matrix.total_requirements == 2
            assert matrix.verified_count == 2
            assert matrix.unverified_count == 0
            assert matrix.coverage_percentage == 100.0

        # Clean up
        spec_path.unlink()


class TestGetTracerSingleton:
    """Test get_tracer singleton function."""

    def test_get_tracer_returns_singleton(self):
        """Test that get_tracer returns the same instance."""
        # Mock the __init__ to avoid OpenAI API key requirement
        with patch.object(RequirementTracer, "__init__", lambda self: None):
            tracer1 = get_tracer()
            tracer2 = get_tracer()

            assert tracer1 is tracer2
