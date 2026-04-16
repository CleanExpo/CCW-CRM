"""
Autonomous Development API Endpoints.

Endpoints for managing and monitoring autonomous development projects.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.orchestration.autonomous_loop import get_autonomous_loop
from src.ai.orchestration.project_orchestrator import (
    Phase,
    Task,
    get_project_orchestrator,
)
from src.api.deps import get_async_db, get_current_user

router = APIRouter(prefix="/api/autonomous", tags=["Autonomous Development"], dependencies=[Depends(get_current_user)])

# Get singletons
orchestrator = get_project_orchestrator()
autonomous_loop = get_autonomous_loop()


class TaskDefinition(BaseModel):
    """Task definition for API."""

    task_id: str
    name: str
    description: str
    agent_capability: str
    priority: int = Field(5, ge=1, le=10)
    dependencies: list[str] = Field(default_factory=list)
    estimated_time_seconds: int = 60
    required_context: dict = Field(default_factory=dict)


class PhaseDefinition(BaseModel):
    """Phase definition for API."""

    phase_id: str
    name: str
    description: str
    tasks: list[TaskDefinition]
    depends_on_phases: list[str] = Field(default_factory=list)


class CreateProjectRequest(BaseModel):
    """Create project request model."""

    name: str = Field(..., min_length=1, description="Project name")
    description: str = Field(..., description="Project description")
    phases: list[PhaseDefinition] = Field(..., description="Project phases")


class CreateProjectResponse(BaseModel):
    """Create project response model."""

    success: bool
    project_id: str | None = None
    message: str | None = None
    error: str | None = None


@router.post("/projects", response_model=CreateProjectResponse)
async def create_project(
    request: CreateProjectRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> CreateProjectResponse:
    """
    Create a new autonomous development project.

    The project will be automatically picked up by the autonomous execution loop.

    Example:
    ```json
    {
      "name": "Add User Profile Feature",
      "description": "Implement user profile with avatar upload",
      "phases": [
        {
          "phase_id": "phase_1",
          "name": "Database Schema",
          "description": "Create user profile database tables",
          "tasks": [
            {
              "task_id": "task_1",
              "name": "Create migration",
              "description": "Generate database migration for user_profiles table",
              "agent_capability": "code_generation",
              "priority": 1
            }
          ]
        }
      ]
    }
    ```
    """
    try:
        # Convert API models to internal models
        phases = []
        for phase_def in request.phases:
            tasks = [
                Task(
                    task_id=t.task_id,
                    name=t.name,
                    description=t.description,
                    agent_capability=t.agent_capability,
                    priority=t.priority,
                    dependencies=t.dependencies,
                    estimated_time_seconds=t.estimated_time_seconds,
                    required_context=t.required_context,
                )
                for t in phase_def.tasks
            ]

            phase = Phase(
                phase_id=phase_def.phase_id,
                name=phase_def.name,
                description=phase_def.description,
                tasks=tasks,
                depends_on_phases=phase_def.depends_on_phases,
            )
            phases.append(phase)

        # Create project
        project_id = orchestrator.create_project(
            name=request.name,
            description=request.description,
            phases=phases,
        )

        return CreateProjectResponse(
            success=True,
            project_id=project_id,
            message=f"Project created: {project_id}",
        )

    except Exception as e:
        return CreateProjectResponse(
            success=False,
            error=str(e),
        )


class ProjectProgressResponse(BaseModel):
    """Project progress response model."""

    project_id: str
    name: str
    current_phase: str | None
    progress_percentage: float
    statistics: dict


@router.get("/projects/{project_id}/progress", response_model=ProjectProgressResponse)
async def get_project_progress(
    project_id: str,
) -> ProjectProgressResponse:
    """
    Get real-time project progress.

    Returns:
    - Current phase
    - Progress percentage
    - Task completion statistics
    - Execution times
    """
    progress = orchestrator.get_project_progress(project_id)

    if "error" in progress:
        return ProjectProgressResponse(
            project_id=project_id,
            name="Unknown",
            current_phase=None,
            progress_percentage=0.0,
            statistics={"error": progress["error"]},
        )

    return ProjectProgressResponse(**progress)


class ExecutionLoopStatusResponse(BaseModel):
    """Execution loop status response model."""

    is_running: bool
    active_projects: list[str]
    paused_projects: list[str]
    total_projects_completed: int
    total_tasks_completed: int
    total_tasks_failed: int
    uptime_seconds: int
    check_interval_seconds: int
    max_concurrent_projects: int


@router.get("/status", response_model=ExecutionLoopStatusResponse)
async def get_execution_loop_status():
    """
    Get autonomous execution loop status.

    Returns:
    - Running status
    - Active projects
    - Paused projects (waiting for approval)
    - Completion statistics
    - Uptime
    """
    status = autonomous_loop.get_status()
    return ExecutionLoopStatusResponse(**status)


class DetailedStatusResponse(BaseModel):
    """Detailed status response model."""

    is_running: bool
    active_projects: list[str]
    paused_projects: list[str]
    total_projects_completed: int
    total_tasks_completed: int
    total_tasks_failed: int
    uptime_seconds: int
    check_interval_seconds: int
    max_concurrent_projects: int
    active_project_details: list[dict]
    paused_project_details: list[dict]


@router.get("/status/detailed", response_model=DetailedStatusResponse)
async def get_detailed_status():
    """
    Get detailed execution loop status with project details.

    Includes full progress information for all active and paused projects.
    """
    status = autonomous_loop.get_detailed_status()
    return DetailedStatusResponse(**status)


class StartLoopResponse(BaseModel):
    """Start loop response model."""

    success: bool
    message: str


@router.post("/start", response_model=StartLoopResponse)
async def start_execution_loop():
    """
    Start the autonomous execution loop.

    The loop will continuously monitor and execute projects.
    """
    try:
        if autonomous_loop.is_running:
            return StartLoopResponse(
                success=True,
                message="Autonomous execution loop already running",
            )
        await autonomous_loop.start()
        return StartLoopResponse(
            success=True,
            message="Autonomous execution loop started",
        )
    except Exception as e:
        return StartLoopResponse(
            success=False,
            message=f"Failed to start: {str(e)}",
        )


class StopLoopResponse(BaseModel):
    """Stop loop response model."""

    success: bool
    message: str


@router.post("/stop", response_model=StopLoopResponse)
async def stop_execution_loop():
    """
    Stop the autonomous execution loop.

    Active projects will complete their current tasks before stopping.
    """
    try:
        if not autonomous_loop.is_running:
            return StopLoopResponse(
                success=True,
                message="Autonomous execution loop already stopped",
            )
        await autonomous_loop.stop()
        return StopLoopResponse(
            success=True,
            message="Autonomous execution loop stopped",
        )
    except Exception as e:
        return StopLoopResponse(
            success=False,
            message=f"Failed to stop: {str(e)}",
        )


class ResumeProjectRequest(BaseModel):
    """Resume project request model."""

    project_id: str = Field(..., description="Project ID to resume")


class ResumeProjectResponse(BaseModel):
    """Resume project response model."""

    success: bool
    message: str | None = None
    error: str | None = None


@router.post("/projects/resume", response_model=ResumeProjectResponse)
async def resume_project(request: ResumeProjectRequest) -> ResumeProjectResponse:
    """
    Resume a paused project after human approval.

    Projects are paused when they require approval for:
    - Schema changes
    - Database modifications
    - Deployments
    - Critical operations
    """
    result = autonomous_loop.resume_project(request.project_id)

    if "error" in result:
        return ResumeProjectResponse(
            success=False,
            error=result["error"],
        )

    return ResumeProjectResponse(
        success=result.get("success", False),
        message=result.get("message"),
    )


class ListProjectsResponse(BaseModel):
    """List projects response model."""

    projects: list[dict]
    total: int


@router.get("/projects", response_model=ListProjectsResponse)
async def list_projects():
    """
    List all projects in the system.

    Returns both active and completed projects with their current status.
    """
    projects_list = []

    for project_id, project in orchestrator.projects.items():
        progress = orchestrator.get_project_progress(project_id)
        projects_list.append(progress)

    return ListProjectsResponse(
        projects=projects_list,
        total=len(projects_list),
    )


class AgentActivityResponse(BaseModel):
    """Agent activity response model."""

    agents: list[dict]


@router.get("/agents/activity", response_model=AgentActivityResponse)
async def get_agent_activity():
    """
    Get current agent activity.

    Shows which agents are currently executing tasks and their health status.
    """
    from src.ai.orchestration import get_agent_registry

    registry = get_agent_registry()

    agents_list = []
    for agent_id, agent in registry.agents.items():
        metadata = registry.get_metadata(agent_id)
        if metadata:
            agents_list.append(
                {
                    "agent_id": agent_id,
                    "name": metadata.name,
                    "capabilities": metadata.capabilities,
                    "active_executions": metadata.active_executions,
                    "total_executions": metadata.total_executions,
                    "successful_executions": metadata.total_executions - metadata.failed_executions,
                    "failed_executions": metadata.failed_executions,
                    "health_status": metadata.status.value,
                }
            )

    return AgentActivityResponse(agents=agents_list)
