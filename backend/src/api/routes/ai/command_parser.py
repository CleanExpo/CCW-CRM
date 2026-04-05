"""
Command Parser API

Parses natural language commands into structured specifications.
Entry point for the /build command workflow.

Endpoints:
  POST /api/ai/commands/parse - Parse natural language into structured spec
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.services.requirement_extractor import ExtractedSpec, get_extractor

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/commands",
    tags=["Command Parser"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ParseRequest(BaseModel):
    """Request to parse natural language into structured spec."""

    description: str = Field(
        description="Natural language description of what to build",
        min_length=10,
        max_length=2000,
    )
    context: dict[str, str] = Field(
        default_factory=dict,
        description="Optional context (current page, user role, etc.)",
    )


class ParseResponse(BaseModel):
    """Response containing structured specification."""

    spec: ExtractedSpec = Field(description="Extracted structured specification")
    confidence: float = Field(
        description="Confidence score (0.0-1.0) in the extraction quality",
        ge=0.0,
        le=1.0,
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Any warnings about the extracted spec",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Suggested improvements to the description",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/parse")
async def parse_command(request: ParseRequest) -> ParseResponse:
    """
    Parse natural language description into structured specification.

    This is the entry point for the /build command. It uses LLM-based extraction
    to convert user descriptions into the 7-field format defined in build.md:
      - WHAT: What is being built or changed
      - WHERE: Which page, URL, or area
      - WHO: Which user role
      - WHEN: What triggers this
      - SHOULD SEE: Observable outcomes (list)
      - DON'T DO: Things to avoid (list, optional)
      - SUCCESS: Success criteria (list, optional)

    Example:
        Input: "Add a logout button to the sidebar"
        Output: Structured spec with all 7 fields filled

    Returns:
        ParseResponse with structured spec, confidence score, and any warnings

    Raises:
        HTTPException 400: If description is invalid or extraction fails
        HTTPException 500: If OpenAI API error occurs
    """
    description = request.description.strip()

    if not description:
        raise HTTPException(status_code=400, detail="Description cannot be empty")

    logger.info(
        "Parsing command",
        description_length=len(description),
        has_context=bool(request.context),
    )

    # Optionally enhance description with context
    enhanced_description = description
    if request.context:
        context_str = " ".join([f"{k}: {v}" for k, v in request.context.items()])
        enhanced_description = f"{description}\n\nContext: {context_str}"

    try:
        # Extract structured spec using LLM
        extractor = get_extractor()
        spec = await extractor.extract(enhanced_description)

        # Calculate confidence score (simple heuristic for now)
        confidence = _calculate_confidence(spec, description)

        # Generate warnings if needed
        warnings = _generate_warnings(spec)

        # Generate suggestions for improvement
        suggestions = _generate_suggestions(spec, description)

        logger.info(
            "Command parsed successfully",
            what=spec.what[:50],
            confidence=confidence,
            warning_count=len(warnings),
        )

        return ParseResponse(
            spec=spec,
            confidence=confidence,
            warnings=warnings,
            suggestions=suggestions,
        )

    except ValueError as e:
        logger.warning("Parse failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Unexpected parse error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to parse command") from e


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _calculate_confidence(spec: ExtractedSpec, original_description: str) -> float:
    """
    Calculate confidence score for the extracted spec.

    Heuristics:
    - Length of WHAT field (longer = more specific = higher confidence)
    - Number of SHOULD SEE items (2-4 is good, 1 is low, >5 is suspicious)
    - Presence of DON'T DO and SUCCESS items (shows detail = higher confidence)
    - WHERE field specificity (exact URL > page name > vague area)
    - Description length (too short = low confidence)

    Returns:
        Float 0.0-1.0 representing confidence
    """
    score = 0.5  # Base score

    # Factor 1: WHAT field length (10-100 chars ideal)
    what_len = len(spec.what)
    if 30 <= what_len <= 150:
        score += 0.15
    elif what_len < 15:
        score -= 0.1

    # Factor 2: SHOULD SEE count (2-4 ideal)
    should_see_count = len(spec.should_see)
    if 2 <= should_see_count <= 4:
        score += 0.15
    elif should_see_count == 1:
        score -= 0.05
    elif should_see_count > 6:
        score -= 0.1  # Too many might indicate confusion

    # Factor 3: Presence of optional fields (shows detail)
    if spec.dont_do and len(spec.dont_do) > 0:
        score += 0.1
    if spec.success and len(spec.success) > 0:
        score += 0.1

    # Factor 4: WHERE specificity
    where_lower = spec.where.lower()
    if "/" in spec.where or "page" in where_lower:
        score += 0.1
    elif "sidebar" in where_lower or "dashboard" in where_lower:
        score += 0.05

    # Factor 5: Original description length
    desc_len = len(original_description)
    if desc_len < 20:
        score -= 0.15  # Too vague
    elif desc_len > 100:
        score += 0.05  # Detailed

    # Clamp to [0.0, 1.0]
    return max(0.0, min(1.0, score))


def _generate_warnings(spec: ExtractedSpec) -> list[str]:
    """Generate warnings about potential issues in the spec."""
    warnings = []

    # Warning: Only 1 SHOULD SEE item (might be incomplete)
    if len(spec.should_see) == 1:
        warnings.append(
            "Only 1 observable outcome specified. Consider adding more specific behaviors the user should see."
        )

    # Warning: WHERE is vague
    where_lower = spec.where.lower()
    if "somewhere" in where_lower or "the app" in where_lower:
        warnings.append("WHERE field is vague. Specify the exact page or component.")

    # Warning: WHAT is too short
    if len(spec.what) < 20:
        warnings.append("WHAT field is very brief. Consider adding more detail about the change.")

    # Warning: WHO is vague
    if spec.who.lower() in ["user", "users", "someone"]:
        warnings.append("WHO field is generic. Specify the exact user role (admin, sales, warehouse).")

    # Warning: No success criteria
    if not spec.success or len(spec.success) == 0:
        warnings.append(
            "No success criteria specified. Consider adding measurable outcomes (e.g., 'Response time < 2s')."
        )

    return warnings


def _generate_suggestions(spec: ExtractedSpec, original_description: str) -> list[str]:
    """Generate suggestions for improving the specification."""
    suggestions = []

    # Suggestion: Add constraints if missing
    if not spec.dont_do or len(spec.dont_do) == 0:
        suggestions.append(
            "Consider adding constraints (DON'T DO) to avoid common pitfalls, e.g., 'Don't modify database schema'."
        )

    # Suggestion: Be more specific about WHERE
    if "/" not in spec.where:
        suggestions.append(
            f"Specify exact URL path in WHERE field (e.g., '/products' instead of '{spec.where}')."
        )

    # Suggestion: Add quantitative success criteria
    if spec.success and not any(
        char in " ".join(spec.success) for char in ["<", ">", "=", "%", "ms", "sec"]
    ):
        suggestions.append(
            "Add quantitative success criteria (e.g., 'Page loads in < 2 seconds', 'Error rate < 1%')."
        )

    # Suggestion: Original description was very short
    if len(original_description) < 30:
        suggestions.append(
            "Provide more detail in your description. Include context about why this change is needed."
        )

    return suggestions
