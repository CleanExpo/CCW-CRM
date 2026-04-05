"""
Unit tests for RequirementExtractor service.

Tests the LLM-based extraction of structured requirements from natural language.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.requirement_extractor import ExtractedSpec, RequirementExtractor


class TestExtractedSpec:
    """Test ExtractedSpec Pydantic model validation."""

    def test_valid_spec(self):
        """Test valid specification passes validation."""
        spec = ExtractedSpec(
            what="Add logout button to sidebar",
            where="Sidebar navigation",
            who="all authenticated users",
            when="User is logged in",
            should_see=["Logout button visible", "Clicking logs user out"],
            dont_do=["Don't modify auth middleware"],
            success=["User can log out successfully"],
        )

        assert spec.what == "Add logout button to sidebar"
        assert len(spec.should_see) == 2
        assert len(spec.dont_do) == 1

    def test_minimal_valid_spec(self):
        """Test minimal spec with only required fields."""
        spec = ExtractedSpec(
            what="Add feature X",
            where="Page Y",
            who="admin",
            when="On page load",
            should_see=["Feature appears"],
        )

        assert spec.what == "Add feature X"
        assert spec.dont_do == []  # Default empty list
        assert spec.success == []

    def test_should_see_required(self):
        """Test that should_see is required and non-empty."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="List should have at least 1 item"):
            ExtractedSpec(
                what="Add feature",
                where="Page",
                who="user",
                when="trigger",
                should_see=[],  # Empty list should fail
            )

    def test_what_too_short(self):
        """Test that WHAT field must be at least 5 chars."""
        with pytest.raises(ValueError):
            ExtractedSpec(
                what="Add",  # Too short
                where="Page",
                who="user",
                when="trigger",
                should_see=["result"],
            )

    def test_what_too_long(self):
        """Test that WHAT field cannot exceed 500 chars."""
        with pytest.raises(ValueError):
            ExtractedSpec(
                what="x" * 501,  # Too long
                where="Page",
                who="user",
                when="trigger",
                should_see=["result"],
            )

    def test_should_see_filters_empty_strings(self):
        """Test that empty strings are filtered from should_see."""
        spec = ExtractedSpec(
            what="Add feature",
            where="Page",
            who="user",
            when="trigger",
            should_see=["Item 1", "", "Item 2", "   "],  # Empty and whitespace strings
        )

        # Should filter out empty/whitespace strings
        assert len(spec.should_see) >= 2
        assert "Item 1" in spec.should_see
        assert "Item 2" in spec.should_see


class TestRequirementExtractor:
    """Test RequirementExtractor service."""

    @pytest.fixture
    def mock_openai_response(self):
        """Create a mock OpenAI API response."""

        def _create_response(spec_dict: dict) -> MagicMock:
            """Create mock response with given spec."""
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = json.dumps(spec_dict)
            return mock_response

        return _create_response

    @pytest.mark.asyncio
    async def test_extract_simple_description(self, mock_openai_response):
        """Test extraction from simple natural language description."""
        description = "Add a logout button to the sidebar"

        expected_spec = {
            "what": "Add a logout button to the sidebar navigation",
            "where": "Sidebar navigation",
            "who": "all authenticated users",
            "when": "User is logged in",
            "should_see": [
                "Logout button visible at bottom of sidebar",
                "Clicking button logs user out",
            ],
            "dont_do": ["Don't modify authentication middleware"],
            "success": ["User can successfully log out from any page"],
        }

        with patch("src.services.requirement_extractor.openai.AsyncOpenAI") as mock_openai_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=mock_openai_response(expected_spec)
            )
            mock_openai_class.return_value = mock_client

            extractor = RequirementExtractor(api_key="test-key")
            spec = await extractor.extract(description)

            assert spec.what == expected_spec["what"]
            assert spec.where == expected_spec["where"]
            assert spec.who == expected_spec["who"]
            assert len(spec.should_see) == 2
            assert len(spec.dont_do) == 1

    @pytest.mark.asyncio
    async def test_extract_with_context(self, mock_openai_response):
        """Test extraction with additional context."""
        description = "Show total product count in header"

        expected_spec = {
            "what": "Display total count of products in the page header",
            "where": "Products page (/products) header",
            "who": "admin and sales users",
            "when": "Products page loads",
            "should_see": [
                "Text showing 'Total: N products' in header",
                "Count updates when products added/removed",
            ],
            "dont_do": [],
            "success": ["Count is accurate and updates in real-time"],
        }

        with patch("src.services.requirement_extractor.openai.AsyncOpenAI") as mock_openai_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=mock_openai_response(expected_spec)
            )
            mock_openai_class.return_value = mock_client

            extractor = RequirementExtractor(api_key="test-key")
            spec = await extractor.extract(description)

            assert "products" in spec.where.lower()
            assert len(spec.should_see) == 2

    @pytest.mark.asyncio
    async def test_extract_empty_description_fails(self):
        """Test that empty description raises ValueError."""
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            extractor = RequirementExtractor()

            with pytest.raises(ValueError, match="Description too short"):
                await extractor.extract("")

    @pytest.mark.asyncio
    async def test_extract_too_short_description_fails(self):
        """Test that very short description raises ValueError."""
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            extractor = RequirementExtractor()

            with pytest.raises(ValueError, match="Description too short"):
                await extractor.extract("Add X")  # Only 5 chars

    @pytest.mark.asyncio
    async def test_extract_openai_error_raises_value_error(self):
        """Test that OpenAI API errors are converted to ValueError."""
        from openai import OpenAIError

        description = "Add a button"

        with patch("src.services.requirement_extractor.openai.AsyncOpenAI") as mock_openai_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                side_effect=OpenAIError("API error")
            )
            mock_openai_class.return_value = mock_client

            extractor = RequirementExtractor(api_key="test-key")

            with pytest.raises(ValueError, match="Failed to extract requirements"):
                await extractor.extract(description)

    @pytest.mark.asyncio
    async def test_extract_invalid_json_response_fails(self):
        """Test that invalid JSON in OpenAI response raises error."""
        description = "Add a feature"

        with patch("src.services.requirement_extractor.openai.AsyncOpenAI") as mock_openai_class:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "NOT JSON"  # Invalid JSON
            mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
            mock_openai_class.return_value = mock_client

            extractor = RequirementExtractor(api_key="test-key")

            with pytest.raises(ValueError, match="Invalid specification"):
                await extractor.extract(description)

    @pytest.mark.asyncio
    async def test_extract_missing_required_field_fails(self, mock_openai_response):
        """Test that spec missing required field raises error."""
        description = "Add a feature"

        incomplete_spec = {
            "what": "Add feature",
            "where": "Page",
            # Missing "who", "when", "should_see"
        }

        with patch("src.services.requirement_extractor.openai.AsyncOpenAI") as mock_openai_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=mock_openai_response(incomplete_spec)
            )
            mock_openai_class.return_value = mock_client

            extractor = RequirementExtractor(api_key="test-key")

            with pytest.raises(ValueError, match="Invalid specification"):
                await extractor.extract(description)

    @pytest.mark.asyncio
    async def test_extract_empty_should_see_fails(self, mock_openai_response):
        """Test that spec with empty should_see raises error."""
        description = "Add a feature"

        invalid_spec = {
            "what": "Add feature",
            "where": "Page",
            "who": "user",
            "when": "trigger",
            "should_see": [],  # Empty - should fail
        }

        with patch("src.services.requirement_extractor.openai.AsyncOpenAI") as mock_openai_class:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=mock_openai_response(invalid_spec)
            )
            mock_openai_class.return_value = mock_client

            extractor = RequirementExtractor(api_key="test-key")

            with pytest.raises(ValueError, match="Invalid specification extracted"):
                await extractor.extract(description)

    def test_extractor_requires_api_key(self):
        """Test that RequirementExtractor requires OpenAI API key."""
        with patch.dict("os.environ", {}, clear=True):  # Clear all env vars
            with pytest.raises(ValueError, match="OPENAI_API_KEY"):
                RequirementExtractor()

    def test_extractor_accepts_explicit_api_key(self):
        """Test that explicit API key can be provided."""
        extractor = RequirementExtractor(api_key="explicit-key")
        assert extractor.api_key == "explicit-key"

    def test_get_extractor_singleton(self):
        """Test that get_extractor returns singleton instance."""
        from src.services.requirement_extractor import get_extractor

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            extractor1 = get_extractor()
            extractor2 = get_extractor()

            # Same instance
            assert extractor1 is extractor2
