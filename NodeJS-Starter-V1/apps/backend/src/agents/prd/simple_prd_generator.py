"""Simple PRD Generator using Claude API directly.

This implementation generates a comprehensive PRD in a single API call to Claude,
avoiding the complexity of multiple sub-agents.
"""

import json
from typing import Any

import anthropic
import structlog

from src.config import get_settings

settings = get_settings()
logger = structlog.get_logger(__name__)


async def generate_prd_with_ai(
    requirements: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate comprehensive PRD using Claude API.

    Args:
        requirements: User's requirements description
        context: Additional context (target_users, timeline, team_size, etc.)

    Returns:
        Dictionary with success status and PRD result
    """
    context = context or {}

    try:
        logger.info("Starting PRD generation with Claude API")

        # Build prompt with context
        context_text = ""
        if context:
            context_items = [f"- {k}: {v}" for k, v in context.items()]
            context_text = "\n\nAdditional Context:\n" + "\n".join(context_items)

        prompt = f"""You are an expert product manager and technical architect. Generate a comprehensive Product Requirements Document (PRD) based on the following requirements.

Requirements:
{requirements}{context_text}

Generate a complete, production-ready PRD with the following structure. Return your response as a valid JSON object with this exact structure:

{{
  "prd_analysis": {{
    "executive_summary": "Brief 2-3 sentence overview of the solution",
    "problem_statement": "Clear statement of the problem being solved",
    "goals": ["Goal 1", "Goal 2", "Goal 3"],
    "success_criteria": ["Criterion 1", "Criterion 2"],
    "target_users": ["User type 1", "User type 2"],
    "functional_requirements": ["Requirement 1", "Requirement 2"],
    "non_functional_requirements": ["Requirement 1", "Requirement 2"]
  }},
  "feature_decomposition": {{
    "epics": [
      {{
        "name": "Epic name",
        "description": "Epic description",
        "user_stories": [
          "As a [user], I want [feature] so that [benefit]"
        ]
      }}
    ],
    "user_stories": [
      {{
        "id": "US001",
        "title": "Story title",
        "description": "As a [user], I want [feature] so that [benefit]",
        "acceptance_criteria": ["Criterion 1", "Criterion 2"],
        "priority": "high|medium|low",
        "story_points": 3
      }}
    ]
  }},
  "technical_spec": {{
    "architecture": "High-level architecture description",
    "tech_stack": {{
      "frontend": ["Technology 1", "Technology 2"],
      "backend": ["Technology 1", "Technology 2"],
      "database": ["Technology 1"],
      "infrastructure": ["Service 1", "Service 2"]
    }},
    "api_endpoints": [
      {{
        "method": "POST",
        "path": "/api/endpoint",
        "description": "Endpoint description",
        "request": {{}},
        "response": {{}}
      }}
    ],
    "database_schema": [
      {{
        "table": "table_name",
        "description": "Table purpose and key fields summary"
      }}
    ]
  }},
  "test_plan": {{
    "unit_tests": [
      {{
        "component": "Component name",
        "scenarios": ["Test scenario 1", "Test scenario 2"]
      }}
    ],
    "integration_tests": [
      {{
        "feature": "Feature name",
        "scenarios": ["Test scenario 1", "Test scenario 2"]
      }}
    ],
    "e2e_tests": [
      {{
        "user_flow": "Flow name",
        "steps": ["Step 1", "Step 2", "Step 3"]
      }}
    ],
    "total_test_count": 24
  }},
  "roadmap": {{
    "sprints": [
      {{
        "sprint_number": 1,
        "duration_weeks": 2,
        "goals": ["Goal 1", "Goal 2"],
        "deliverables": ["Deliverable 1", "Deliverable 2"]
      }}
    ],
    "milestones": [
      {{
        "name": "Milestone name",
        "date": "Week 4",
        "criteria": ["Criterion 1", "Criterion 2"]
      }}
    ],
    "total_duration_weeks": 8
  }}
}}

Important guidelines:
1. Be specific and detailed in all sections
2. Include at least 8-12 user stories
3. Include at least 6-10 API endpoints
4. Include at least 20-30 test scenarios total
5. Plan realistic sprints (typically 2 weeks each)
6. Make the technical spec production-ready
7. Ensure all JSON is valid and properly formatted
8. Return ONLY the JSON, no additional text or markdown formatting
9. CRITICAL: Properly escape all quotes and special characters in string values
10. Use \\n for newlines, \\" for quotes, \\\\ for backslashes within strings"""

        # Call Claude API
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        message = client.messages.create(
            model="claude-opus-4-6",  # Using Opus for enhanced reasoning
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )

        # Parse response
        response_text = message.content[0].text

        logger.info("Received Claude response", length=len(response_text))

        # Try to extract JSON from response (in case Claude added markdown formatting)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            prd_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            # Log first 500 and last 500 chars of response for debugging
            logger.error(
                "JSON parse error",
                error=str(e),
                response_start=response_text[:500],
                response_end=response_text[-500:],
                response_length=len(response_text),
            )
            raise

        # Calculate summary statistics
        total_user_stories = len(prd_data["feature_decomposition"]["user_stories"])
        total_api_endpoints = len(prd_data["technical_spec"]["api_endpoints"])
        total_test_scenarios = prd_data["test_plan"]["total_test_count"]
        total_sprints = len(prd_data["roadmap"]["sprints"])
        estimated_duration_weeks = prd_data["roadmap"]["total_duration_weeks"]

        # Add document names
        documents_generated = [
            "PRD.md",
            "TechnicalSpec.md",
            "TestPlan.md",
            "Roadmap.md",
            "UserStories.md",
        ]

        logger.info(
            "PRD generation complete",
            user_stories=total_user_stories,
            api_endpoints=total_api_endpoints,
            test_scenarios=total_test_scenarios,
            sprints=total_sprints,
            estimated_weeks=estimated_duration_weeks,
        )

        return {
            "success": True,
            "prd_result": {
                **prd_data,
                "documents_generated": documents_generated,
                "total_user_stories": total_user_stories,
                "total_api_endpoints": total_api_endpoints,
                "total_test_scenarios": total_test_scenarios,
                "total_sprints": total_sprints,
                "estimated_duration_weeks": estimated_duration_weeks,
            },
        }

    except json.JSONDecodeError as e:
        logger.error("Failed to parse Claude response as JSON", error=str(e))
        return {"success": False, "error": f"Failed to parse AI response: {str(e)}"}
    except Exception as e:
        logger.error("PRD generation failed", error=str(e))
        return {"success": False, "error": str(e)}
