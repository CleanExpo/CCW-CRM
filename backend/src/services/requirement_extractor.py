"""
Requirement Extractor Service

Extracts structured requirements from natural language using LLM-based parsing.
Converts user descriptions into the 7-field format defined in .claude/commands/build.md:
  - WHAT: What is being built or changed
  - WHERE: Which page, URL, or area of the app
  - WHO: Which user role
  - WHEN: What triggers this
  - SHOULD SEE: What the user sees when it works
  - DON'T DO: What to avoid
  - SUCCESS: Observable outcomes
"""
from __future__ import annotations

import os
from typing import Any

import openai
import structlog
from pydantic import BaseModel, Field, field_validator

logger = structlog.get_logger(__name__)


class ExtractedSpec(BaseModel):
    """Structured specification extracted from natural language."""

    what: str = Field(description="One sentence — what is being built or changed", min_length=5, max_length=500)
    where: str = Field(description="Which page, URL, or area of the app", min_length=3, max_length=300)
    who: str = Field(description="Which user role (admin, sales, warehouse, etc.)", min_length=3, max_length=200)
    when: str = Field(description="What triggers this feature or change", min_length=3, max_length=300)
    should_see: list[str] = Field(
        description="List of observable outcomes the user should see",
        min_length=1,
        max_length=10,
    )
    dont_do: list[str] = Field(
        description="List of things to avoid (optional)",
        default_factory=list,
        max_length=5,
    )
    success: list[str] = Field(
        description="List of success criteria (optional)",
        default_factory=list,
        max_length=5,
    )

    @field_validator("should_see")
    @classmethod
    def validate_should_see_not_empty(cls, v: list[str]) -> list[str]:
        if not v or len(v) == 0:
            raise ValueError("At least one SHOULD SEE item is required")
        # Remove empty strings
        return [item for item in v if item.strip()]


class RequirementExtractor:
    """Extracts structured requirements from natural language using OpenAI function calling."""

    def __init__(self, api_key: str | None = None):
        """Initialize with OpenAI API key (defaults to env var OPENAI_API_KEY)."""
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")

        self.client = openai.AsyncOpenAI(api_key=self.api_key)
        self.model = "gpt-4o-2024-08-06"  # Latest model with structured outputs

    async def extract(self, natural_language: str) -> ExtractedSpec:
        """
        Extract structured requirements from natural language description.

        Args:
            natural_language: User's description of what they want to build

        Returns:
            ExtractedSpec: Structured specification with 7 fields

        Raises:
            ValueError: If extraction fails or produces invalid spec
        """
        if not natural_language or len(natural_language.strip()) < 10:
            raise ValueError("Description too short (min 10 characters)")

        logger.info("Extracting requirements", description_length=len(natural_language))

        # System prompt with examples (few-shot learning)
        system_prompt = """You are a requirements analyst for a construction equipment supplier ERP/CRM system.
Your job is to extract structured requirements from natural language descriptions.

The system has these main areas:
- Dashboard (main overview)
- Products (equipment catalog)
- Customers (CRM)
- Orders (sales orders)
- Quotes (price quotes)
- POS (point of sale)
- Inventory (stock management)
- Warehouse (locations, transfers)
- Settings (integrations, billing)

User roles: admin, sales, warehouse, owner

Extract requirements into 7 fields:
1. WHAT: One clear sentence describing what to build/change
2. WHERE: Specific page/URL/area (e.g., "products page", "/dashboard", "sidebar")
3. WHO: Which user role needs this (admin, sales, warehouse, owner, all)
4. WHEN: What triggers this feature (e.g., "user clicks button", "page loads", "order is created")
5. SHOULD SEE: Observable outcomes (2-5 specific items user will see)
6. DON'T DO: Things to avoid (0-3 items, optional)
7. SUCCESS: Success criteria (0-3 items, optional)

Be specific. If the user says "add a widget", ask WHERE (which page?) and WHAT should it show.
If details are missing from the description, infer reasonable defaults based on context."""

        # Few-shot examples
        examples = [
            {
                "description": "Add a logout button to the sidebar",
                "spec": {
                    "what": "Add a logout button to the sidebar navigation",
                    "where": "Sidebar navigation (all pages)",
                    "who": "all authenticated users",
                    "when": "User is logged in and viewing any dashboard page",
                    "should_see": [
                        "Logout button visible at bottom of sidebar",
                        "Button shows logout icon and text",
                        "Clicking button logs user out and redirects to login page"
                    ],
                    "dont_do": [
                        "Don't modify authentication middleware",
                        "Don't change login page behavior"
                    ],
                    "success": [
                        "User can successfully log out from any page",
                        "Session is cleared after logout"
                    ]
                }
            },
            {
                "description": "Show total product count in the products page header",
                "spec": {
                    "what": "Display total count of products in the page header",
                    "where": "Products page (/products) header",
                    "who": "admin and sales users",
                    "when": "Products page loads or product list changes",
                    "should_see": [
                        "Text showing 'Total: N products' in page header",
                        "Count updates when products are added/removed",
                        "Count reflects current filter/search results"
                    ],
                    "dont_do": [],
                    "success": [
                        "Count is accurate and updates in real-time",
                        "Performance impact < 100ms"
                    ]
                }
            }
        ]

        # Build messages with examples
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]

        # Add few-shot examples
        for ex in examples:
            messages.append({"role": "user", "content": ex["description"]})
            messages.append({"role": "assistant", "content": str(ex["spec"])})

        # Add actual user request
        messages.append({"role": "user", "content": natural_language})

        try:
            # Use structured output (function calling) to ensure valid JSON
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,  # Lower temperature for more consistent extraction
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "requirement_spec",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "what": {"type": "string"},
                                "where": {"type": "string"},
                                "who": {"type": "string"},
                                "when": {"type": "string"},
                                "should_see": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "minItems": 1,
                                },
                                "dont_do": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "success": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": ["what", "where", "who", "when", "should_see"],
                            "additionalProperties": False,
                        },
                    },
                },
            )

            # Extract JSON from response
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from OpenAI")

            # Parse into Pydantic model (validates constraints)
            import json
            spec_dict = json.loads(content)
            spec = ExtractedSpec(**spec_dict)

            logger.info(
                "Requirements extracted successfully",
                what=spec.what[:50],
                where=spec.where[:30],
                should_see_count=len(spec.should_see),
            )

            return spec

        except openai.OpenAIError as e:
            logger.error("OpenAI API error", error=str(e))
            raise ValueError(f"Failed to extract requirements: {e}") from e
        except Exception as e:
            logger.error("Extraction failed", error=str(e))
            raise ValueError(f"Invalid specification extracted: {e}") from e


# Singleton instance (lazy initialization)
_extractor: RequirementExtractor | None = None


def get_extractor() -> RequirementExtractor:
    """Get or create singleton RequirementExtractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = RequirementExtractor()
    return _extractor
