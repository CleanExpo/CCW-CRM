"""
Unit tests for Command Parser API endpoints.

Tests POST /api/ai/commands/parse endpoint.
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.services.requirement_extractor import ExtractedSpec

client = TestClient(app)


class TestParseCommandEndpoint:
    """Test POST /api/ai/commands/parse endpoint."""

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
                "Clicking button logs user out and redirects to login",
            ],
            dont_do=["Don't modify authentication middleware"],
            success=["User can successfully log out from any page"],
        )

    def test_parse_simple_description(self, mock_extracted_spec):
        """Test parsing simple natural language description."""
        request_data = {
            "description": "Add a logout button to the sidebar",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=mock_extracted_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 200
            data = response.json()

            # Check response structure
            assert "spec" in data
            assert "confidence" in data
            assert "warnings" in data
            assert "suggestions" in data

            # Check spec fields
            spec = data["spec"]
            assert spec["what"] == mock_extracted_spec.what
            assert spec["where"] == mock_extracted_spec.where
            assert spec["who"] == mock_extracted_spec.who
            assert len(spec["should_see"]) == 2

            # Check confidence score
            assert 0.0 <= data["confidence"] <= 1.0

    def test_parse_with_context(self, mock_extracted_spec):
        """Test parsing with additional context."""
        request_data = {
            "description": "Add logout button",
            "context": {
                "current_page": "dashboard",
                "user_role": "admin",
            },
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=mock_extracted_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 200

            # Verify extractor was called with enhanced description
            mock_extractor.extract.assert_called_once()
            called_description = mock_extractor.extract.call_args[0][0]
            assert "current_page: dashboard" in called_description
            assert "user_role: admin" in called_description

    def test_parse_empty_description_fails(self):
        """Test that empty description returns 422 (Pydantic validation error)."""
        request_data = {
            "description": "",
        }

        response = client.post("/api/ai/commands/parse", json=request_data)

        # Pydantic min_length validation returns 422
        assert response.status_code == 422

    def test_parse_missing_description_fails(self):
        """Test that missing description field returns 422 validation error."""
        request_data = {}  # No description field

        response = client.post("/api/ai/commands/parse", json=request_data)

        assert response.status_code == 422  # Validation error

    def test_parse_description_too_short_fails(self):
        """Test that description < 10 chars returns 422 validation error."""
        request_data = {
            "description": "Add X",  # Only 5 chars
        }

        response = client.post("/api/ai/commands/parse", json=request_data)

        assert response.status_code == 422  # Pydantic validation error

    def test_parse_description_too_long_fails(self):
        """Test that description > 2000 chars returns 422 validation error."""
        request_data = {
            "description": "x" * 2001,  # Exceeds max length
        }

        response = client.post("/api/ai/commands/parse", json=request_data)

        assert response.status_code == 422  # Pydantic validation error

    def test_parse_extractor_value_error_returns_400(self, mock_extracted_spec):
        """Test that extractor ValueError returns 400."""
        request_data = {
            "description": "Add a feature that is confusing",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(
                side_effect=ValueError("Extraction failed: ambiguous description")
            )
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 400
            assert "Extraction failed" in response.json()["detail"]

    def test_parse_extractor_unexpected_error_returns_500(self, mock_extracted_spec):
        """Test that unexpected errors return 500."""
        request_data = {
            "description": "Add a feature",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(
                side_effect=Exception("Unexpected error")
            )
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 500
            assert "Failed to parse command" in response.json()["detail"]

    def test_parse_returns_warnings_for_vague_spec(self):
        """Test that warnings are generated for vague specifications."""
        vague_spec = ExtractedSpec(
            what="Add something",  # Vague
            where="somewhere in the app",  # Vague
            who="user",  # Generic
            when="when needed",
            should_see=["some result"],  # Only 1 item
        )

        request_data = {
            "description": "Add something somewhere",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=vague_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 200
            data = response.json()

            # Should have warnings due to vague spec
            assert len(data["warnings"]) > 0
            warnings_text = " ".join(data["warnings"]).lower()
            assert any(word in warnings_text for word in ["vague", "generic", "specific", "brief"])

    def test_parse_confidence_score_calculation(self):
        """Test that confidence score varies based on spec quality."""
        # Good spec should have high confidence
        good_spec = ExtractedSpec(
            what="Add a logout button to the sidebar with confirmation dialog",
            where="/dashboard sidebar",
            who="admin users",
            when="User clicks logout",
            should_see=[
                "Logout button in sidebar",
                "Confirmation dialog appears",
                "User is logged out after confirmation",
            ],
            dont_do=["Don't modify auth middleware"],
            success=["Logout completes in < 2 seconds"],
        )

        request_data = {
            "description": "Add a logout button to the sidebar with confirmation",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=good_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 200
            data = response.json()

            # Good spec should have high confidence (> 0.7)
            assert data["confidence"] > 0.7

    def test_parse_suggestions_for_improvement(self):
        """Test that suggestions are generated when spec can be improved."""
        # Spec without constraints or quantitative success criteria
        improvable_spec = ExtractedSpec(
            what="Add export button",
            where="products page",
            who="admin",
            when="Page loads",
            should_see=["Export button appears"],
            dont_do=[],  # No constraints
            success=["Export works"],  # Not quantitative
        )

        request_data = {
            "description": "Add export button to products page",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=improvable_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 200
            data = response.json()

            # Should have suggestions for adding constraints and quantitative criteria
            assert len(data["suggestions"]) > 0
            suggestions_text = " ".join(data["suggestions"]).lower()
            assert "don't do" in suggestions_text or "constraint" in suggestions_text

    def test_parse_response_structure(self, mock_extracted_spec):
        """Test that response has correct structure."""
        request_data = {
            "description": "Add a logout button",
        }

        with patch("src.api.routes.ai.command_parser.get_extractor") as mock_get_extractor:
            mock_extractor = AsyncMock()
            mock_extractor.extract = AsyncMock(return_value=mock_extracted_spec)
            mock_get_extractor.return_value = mock_extractor

            response = client.post("/api/ai/commands/parse", json=request_data)

            assert response.status_code == 200
            data = response.json()

            # Verify all required fields present
            assert "spec" in data
            assert "confidence" in data
            assert "warnings" in data
            assert "suggestions" in data

            # Verify spec has all 7 fields
            spec = data["spec"]
            assert "what" in spec
            assert "where" in spec
            assert "who" in spec
            assert "when" in spec
            assert "should_see" in spec
            assert "dont_do" in spec
            assert "success" in spec

            # Verify types
            assert isinstance(data["spec"], dict)
            assert isinstance(data["confidence"], (int, float))
            assert isinstance(data["warnings"], list)
            assert isinstance(data["suggestions"], list)
            assert isinstance(spec["should_see"], list)
            assert isinstance(spec["dont_do"], list)
            assert isinstance(spec["success"], list)
