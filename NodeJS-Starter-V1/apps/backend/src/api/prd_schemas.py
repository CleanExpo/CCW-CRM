"""PRD API schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PRDGenerateRequest(BaseModel):
    """Request to generate a PRD."""

    requirements: str = Field(
        ...,
        description="High-level requirements in plain English",
        min_length=50,
        max_length=10000,
    )
    context: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional context (target_users, timeline, team_size, etc.)",
    )


class PRDSummary(BaseModel):
    """Summary information about a PRD."""

    id: UUID
    requirements: str
    executive_summary: Optional[str] = None
    status: str
    total_user_stories: int
    total_api_endpoints: int
    total_test_scenarios: int
    total_sprints: int
    estimated_duration_weeks: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PRDDetail(BaseModel):
    """Detailed PRD information."""

    id: UUID
    user_id: UUID
    organization_id: Optional[UUID] = None  # Optional for demo auth
    requirements: str
    context: Optional[dict[str, Any]] = None

    # Generated content
    executive_summary: Optional[str] = None
    problem_statement: Optional[str] = None
    prd_analysis: Optional[dict[str, Any]] = None
    feature_decomposition: Optional[dict[str, Any]] = None
    technical_spec: Optional[dict[str, Any]] = None
    test_plan: Optional[dict[str, Any]] = None
    roadmap: Optional[dict[str, Any]] = None

    # Documents
    documents_generated: Optional[list[str]] = None

    # Summary stats
    total_user_stories: int
    total_api_endpoints: int
    total_test_scenarios: int
    total_sprints: int
    estimated_duration_weeks: int

    # Status
    status: str
    error_message: Optional[str] = None
    model_used: str

    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PRDGenerateResponse(BaseModel):
    """Response after initiating PRD generation."""

    id: UUID
    status: str
    message: str = "PRD generation started"


class PRDListResponse(BaseModel):
    """Response containing list of PRDs."""

    prds: list[PRDSummary]
    total: int
    page: int
    page_size: int


class AgentRunDetail(BaseModel):
    """Agent run information."""

    id: UUID
    agent_name: str
    task_description: Optional[str] = None
    status: str
    progress: int
    current_step: Optional[str] = None
    outputs: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class APIUsageDetail(BaseModel):
    """API usage information."""

    id: UUID
    agent_run_id: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_per_input_token: str
    cost_per_output_token: str
    created_at: datetime

    class Config:
        from_attributes = True


class PRDCostSummary(BaseModel):
    """Cost summary for a PRD."""

    total_calls: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    by_model: dict[str, dict[str, Any]]
