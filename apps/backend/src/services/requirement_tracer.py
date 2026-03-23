"""
Requirement Tracer Service

Maps implementation artifacts (code changes) back to original requirements (SHOULD SEE items).
Uses LLM-based matching to establish traceability between user requirements and code.

Usage:
    tracer = RequirementTracer()
    matrix = await tracer.trace_requirements(task_id="build_20260323_143000")
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import structlog
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

# Execution directory
_EXECUTION_DIR = Path(__file__).resolve().parents[4] / ".claude" / ".execution"


class RequirementTrace(BaseModel):
    """Single requirement with mapped files."""

    requirement_id: str = Field(description="Unique requirement ID (R1, R2, etc.)")
    text: str = Field(description="Original SHOULD SEE item text")
    files: list[str] = Field(description="Files that implement this requirement")
    verified: bool = Field(description="Whether requirement is satisfied by implementation")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score (0.0-1.0)")
    notes: str | None = Field(default=None, description="Additional notes about implementation")


class TraceabilityMatrix(BaseModel):
    """Complete traceability matrix for a build task."""

    task_id: str = Field(description="Build task ID")
    created_at: str = Field(description="ISO 8601 timestamp")
    requirements: list[RequirementTrace] = Field(description="All requirements with traces")
    total_requirements: int = Field(description="Total number of requirements")
    verified_count: int = Field(description="Number of verified requirements")
    unverified_count: int = Field(description="Number of unverified requirements")
    coverage_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage of requirements with file mappings",
    )


class RequirementTracer:
    """
    Service for tracing requirements to implementation artifacts.

    Uses LLM-based analysis to match SHOULD SEE items from build specs
    to actual code changes in git diffs.
    """

    def __init__(self):
        """Initialize tracer with OpenAI client."""
        self.client = AsyncOpenAI()
        self.logger = logger.bind(service="requirement_tracer")

    async def trace_requirements(self, task_id: str) -> TraceabilityMatrix:
        """
        Trace requirements to implementation for a build task.

        Args:
            task_id: Build task ID (build_YYYYMMDD_HHMMSS)

        Returns:
            TraceabilityMatrix with requirement mappings

        Raises:
            FileNotFoundError: If build spec or phase handoff not found
            ValueError: If spec or handoff data is invalid
        """
        self.logger.info("Starting requirement tracing", task_id=task_id)

        # Step 1: Load build spec
        build_spec = await self._load_build_spec(task_id)

        # Step 2: Load implementation artifacts (git diff from phase 4)
        implementation = await self._load_implementation(task_id)

        # Step 3: Match requirements to files
        traces = await self._match_requirements_to_files(
            requirements=build_spec["requirements"],
            files=implementation["files"],
        )

        # Step 4: Calculate statistics
        verified_count = sum(1 for t in traces if t.verified)
        unverified_count = len(traces) - verified_count
        coverage = (len([t for t in traces if t.files]) / len(traces) * 100) if traces else 0.0

        # Step 5: Create traceability matrix
        matrix = TraceabilityMatrix(
            task_id=task_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            requirements=traces,
            total_requirements=len(traces),
            verified_count=verified_count,
            unverified_count=unverified_count,
            coverage_percentage=coverage,
        )

        # Step 6: Save matrix to disk
        await self._save_matrix(task_id, matrix)

        self.logger.info(
            "Requirement tracing complete",
            task_id=task_id,
            total=len(traces),
            verified=verified_count,
            coverage=f"{coverage:.1f}%",
        )

        return matrix

    async def _load_build_spec(self, task_id: str) -> dict[str, Any]:
        """
        Load build spec and extract SHOULD SEE items.

        Args:
            task_id: Build task ID

        Returns:
            Dict with requirements list

        Raises:
            FileNotFoundError: If build spec not found
        """
        spec_path = _EXECUTION_DIR / "build-specs" / f"{task_id}.json"

        if not spec_path.exists():
            raise FileNotFoundError(f"Build spec not found: {spec_path}")

        spec_data = json.loads(spec_path.read_text(encoding="utf-8"))

        # Extract SHOULD SEE items as requirements
        should_see = spec_data.get("spec", {}).get("should_see", [])

        if not should_see:
            raise ValueError(f"Build spec has no SHOULD SEE items: {task_id}")

        requirements = [{"id": f"R{i+1}", "text": text} for i, text in enumerate(should_see)]

        self.logger.info(
            "Loaded build spec",
            task_id=task_id,
            requirements_count=len(requirements),
        )

        return {"requirements": requirements, "spec": spec_data}

    async def _load_implementation(self, task_id: str) -> dict[str, Any]:
        """
        Load implementation artifacts (git diff from phase 4).

        Args:
            task_id: Build task ID

        Returns:
            Dict with files changed

        Raises:
            FileNotFoundError: If phase handoff not found
        """
        # For now, we'll use a simplified approach:
        # Look for autonomous task handoff or build spec metadata
        # In a real implementation, this would read from phase-4-build-final.json

        # Try to find phase handoff from autonomous execution
        autonomous_task_id = f"auto_{task_id}"
        handoff_path = _EXECUTION_DIR / "phase-handoffs" / f"{autonomous_task_id}_phase-4-build-final.json"

        if handoff_path.exists():
            handoff_data = json.loads(handoff_path.read_text(encoding="utf-8"))
            files = handoff_data.get("files_changed", [])
        else:
            # Fallback: Use build spec metadata if available
            spec_path = _EXECUTION_DIR / "build-specs" / f"{task_id}.json"
            if spec_path.exists():
                spec_data = json.loads(spec_path.read_text(encoding="utf-8"))
                # Extract files from metadata (if autonomous execution updated it)
                files_created = spec_data.get("metadata", {}).get("files_created", [])
                files_modified = spec_data.get("metadata", {}).get("files_modified", [])
                files = files_created + files_modified
            else:
                files = []

        self.logger.info(
            "Loaded implementation artifacts",
            task_id=task_id,
            files_count=len(files),
        )

        return {"files": files}

    async def _match_requirements_to_files(
        self,
        requirements: list[dict[str, str]],
        files: list[str],
    ) -> list[RequirementTrace]:
        """
        Match requirements to files using LLM.

        Args:
            requirements: List of {id, text} dicts
            files: List of file paths

        Returns:
            List of RequirementTrace objects
        """
        if not files:
            # No implementation files - return unverified traces
            return [
                RequirementTrace(
                    requirement_id=req["id"],
                    text=req["text"],
                    files=[],
                    verified=False,
                    confidence=0.0,
                    notes="No implementation files found",
                )
                for req in requirements
            ]

        self.logger.info(
            "Matching requirements to files",
            requirements_count=len(requirements),
            files_count=len(files),
        )

        # Prepare prompt for LLM
        requirements_text = "\n".join([f"{r['id']}: {r['text']}" for r in requirements])
        files_text = "\n".join([f"- {f}" for f in files])

        prompt = f"""You are a requirement tracing expert. Match each requirement to the files that implement it.

**Requirements (SHOULD SEE items):**
{requirements_text}

**Implementation Files:**
{files_text}

For each requirement, identify which files implement it. A requirement can map to multiple files.

Output JSON array of matches:
[
  {{
    "requirement_id": "R1",
    "files": ["path/to/file1.tsx", "path/to/file2.ts"],
    "verified": true,
    "confidence": 0.9,
    "notes": "Button component in file1, API call in file2"
  }},
  ...
]

Rules:
- If a requirement has no matching files, set "files": [], "verified": false
- confidence: 0.0-1.0 (how confident you are about the match)
- verified: true if files clearly implement the requirement, false otherwise
- notes: Brief explanation of the implementation
"""

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-2024-08-06",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a requirement tracing expert. Output valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            result_text = response.choices[0].message.content
            if not result_text:
                raise ValueError("Empty response from LLM")

            # Parse JSON response
            result_data = json.loads(result_text)

            # Handle both array and object responses
            if isinstance(result_data, dict):
                matches = result_data.get("matches", [])
            else:
                matches = result_data

            # Create RequirementTrace objects
            traces = []
            for match in matches:
                traces.append(
                    RequirementTrace(
                        requirement_id=match["requirement_id"],
                        text=next(
                            (r["text"] for r in requirements if r["id"] == match["requirement_id"]),
                            "Unknown requirement",
                        ),
                        files=match.get("files", []),
                        verified=match.get("verified", False),
                        confidence=match.get("confidence", 0.0),
                        notes=match.get("notes"),
                    )
                )

            self.logger.info(
                "Requirements matched to files",
                traces_count=len(traces),
                verified_count=sum(1 for t in traces if t.verified),
            )

            return traces

        except Exception as e:
            self.logger.error("Failed to match requirements", error=str(e))
            # Fallback: Return unverified traces
            return [
                RequirementTrace(
                    requirement_id=req["id"],
                    text=req["text"],
                    files=[],
                    verified=False,
                    confidence=0.0,
                    notes=f"Matching failed: {str(e)}",
                )
                for req in requirements
            ]

    async def _save_matrix(self, task_id: str, matrix: TraceabilityMatrix) -> None:
        """
        Save traceability matrix to disk.

        Args:
            task_id: Build task ID
            matrix: Traceability matrix to save
        """
        matrix_path = _EXECUTION_DIR / "build-specs" / f"{task_id}_trace_matrix.json"

        matrix_path.write_text(
            matrix.model_dump_json(indent=2),
            encoding="utf-8",
        )

        self.logger.info(
            "Traceability matrix saved",
            task_id=task_id,
            path=str(matrix_path),
        )


# Singleton instance
_tracer_instance: RequirementTracer | None = None


def get_tracer() -> RequirementTracer:
    """Get singleton RequirementTracer instance."""
    global _tracer_instance
    if _tracer_instance is None:
        _tracer_instance = RequirementTracer()
    return _tracer_instance
