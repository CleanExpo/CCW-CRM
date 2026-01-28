"""
Project Orchestrator for multi-phase autonomous development.

Coordinates complex development projects across multiple phases and tasks.
"""

import asyncio
import enum
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import structlog

from src.ai.orchestration.agent_registry import get_agent_registry

logger = structlog.get_logger(__name__)


class TaskStatus(str, enum.Enum):
    """Task execution status."""

    PENDING = "pending"
    BLOCKED = "blocked"  # Dependencies not satisfied
    READY = "ready"  # Dependencies satisfied, ready to execute
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class PhaseStatus(str, enum.Enum):
    """Phase execution status."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Task:
    """
    Project task definition.

    A task is an atomic unit of work that can be executed by an agent.
    """

    def __init__(
        self,
        task_id: str,
        name: str,
        description: str,
        agent_capability: str,
        priority: int = 5,
        dependencies: list[str] | None = None,
        estimated_time_seconds: int = 60,
        required_context: dict[str, Any] | None = None,
    ):
        """
        Initialize task.

        Args:
            task_id: Unique task identifier
            name: Task name
            description: Task description
            agent_capability: Required agent capability
            priority: Task priority (1-10, 1 = highest)
            dependencies: List of task IDs that must complete first
            estimated_time_seconds: Estimated execution time
            required_context: Required context for execution
        """
        self.task_id = task_id
        self.name = name
        self.description = description
        self.agent_capability = agent_capability
        self.priority = priority
        self.dependencies = dependencies or []
        self.estimated_time_seconds = estimated_time_seconds
        self.required_context = required_context or {}

        # Execution tracking
        self.status = TaskStatus.PENDING
        self.assigned_agent_id: str | None = None
        self.start_time: datetime | None = None
        self.end_time: datetime | None = None
        self.result: dict[str, Any] | None = None
        self.error: str | None = None
        self.retry_count = 0
        self.max_retries = 3


class Phase:
    """
    Project phase definition.

    A phase groups related tasks that should be completed together.
    """

    def __init__(
        self,
        phase_id: str,
        name: str,
        description: str,
        tasks: list[Task],
        depends_on_phases: list[str] | None = None,
    ):
        """
        Initialize phase.

        Args:
            phase_id: Unique phase identifier
            name: Phase name
            description: Phase description
            tasks: List of tasks in this phase
            depends_on_phases: List of phase IDs that must complete first
        """
        self.phase_id = phase_id
        self.name = name
        self.description = description
        self.tasks = {task.task_id: task for task in tasks}
        self.depends_on_phases = depends_on_phases or []

        # Execution tracking
        self.status = PhaseStatus.PENDING
        self.start_time: datetime | None = None
        self.end_time: datetime | None = None


class Project:
    """
    Multi-phase project definition.

    A project contains multiple phases, each with their own tasks.
    """

    def __init__(
        self,
        project_id: str | None = None,
        name: str = "",
        description: str = "",
        phases: list[Phase] | None = None,
    ):
        """
        Initialize project.

        Args:
            project_id: Unique project identifier
            name: Project name
            description: Project description
            phases: List of project phases
        """
        self.project_id = project_id or str(uuid4())
        self.name = name
        self.description = description
        self.phases = {phase.phase_id: phase for phase in (phases or [])}

        # Execution tracking
        self.start_time: datetime | None = None
        self.end_time: datetime | None = None
        self.current_phase_id: str | None = None


class ProjectOrchestrator:
    """
    Orchestrates multi-phase autonomous development projects.

    Features:
    - Phase and task management
    - Dependency resolution (DAG)
    - Task prioritization
    - Agent assignment
    - Progress tracking
    - Failure handling
    """

    def __init__(self):
        """Initialize Project Orchestrator."""
        self.agent_registry = get_agent_registry()

        # Active projects
        self.projects: dict[str, Project] = {}

        logger.info("ProjectOrchestrator initialized")

    def create_project(
        self,
        name: str,
        description: str,
        phases: list[Phase],
    ) -> str:
        """
        Create a new project.

        Args:
            name: Project name
            description: Project description
            phases: List of project phases

        Returns:
            Project ID
        """
        project = Project(
            name=name,
            description=description,
            phases=phases,
        )

        self.projects[project.project_id] = project

        logger.info(
            "Project created",
            project_id=project.project_id,
            name=name,
            phases=len(phases),
            total_tasks=sum(len(phase.tasks) for phase in phases),
        )

        return project.project_id

    async def execute_project(
        self,
        project_id: str,
    ) -> dict[str, Any]:
        """
        Execute a project through all phases.

        Args:
            project_id: Project ID

        Returns:
            Execution results
        """
        project = self.projects.get(project_id)
        if not project:
            return {"error": f"Project not found: {project_id}"}

        project.start_time = datetime.now(UTC)

        logger.info(
            "Project execution started",
            project_id=project_id,
            name=project.name,
        )

        try:
            # Execute phases in order (respecting dependencies)
            for phase_id in self._get_phase_execution_order(project):
                phase = project.phases[phase_id]
                project.current_phase_id = phase_id

                logger.info(
                    "Starting phase",
                    project_id=project_id,
                    phase_id=phase_id,
                    phase_name=phase.name,
                )

                phase_result = await self._execute_phase(
                    project=project,
                    phase=phase,
                )

                if phase_result["status"] == PhaseStatus.FAILED:
                    logger.error(
                        "Phase failed, stopping project",
                        project_id=project_id,
                        phase_id=phase_id,
                    )
                    break

            project.end_time = datetime.now(UTC)

            # Calculate statistics
            stats = self._calculate_project_statistics(project)

            logger.info(
                "Project execution completed",
                project_id=project_id,
                **stats,
            )

            return {
                "success": True,
                "project_id": project_id,
                "statistics": stats,
            }

        except Exception as e:
            logger.error(
                "Project execution failed",
                project_id=project_id,
                error=str(e),
            )
            project.end_time = datetime.now(UTC)

            return {
                "error": f"Project execution failed: {str(e)}",
                "project_id": project_id,
            }

    async def _execute_phase(
        self,
        project: Project,
        phase: Phase,
    ) -> dict[str, Any]:
        """
        Execute a single phase.

        Args:
            project: Project being executed
            phase: Phase to execute

        Returns:
            Phase execution result
        """
        phase.status = PhaseStatus.IN_PROGRESS
        phase.start_time = datetime.now(UTC)

        try:
            # Get tasks in execution order (respecting dependencies)
            task_order = self._get_task_execution_order(phase)

            # Execute tasks
            for task_id in task_order:
                task = phase.tasks[task_id]

                # Check if dependencies are satisfied
                if not self._are_dependencies_satisfied(task, phase):
                    task.status = TaskStatus.BLOCKED
                    logger.warning(
                        "Task blocked by dependencies",
                        task_id=task_id,
                        dependencies=task.dependencies,
                    )
                    continue

                task.status = TaskStatus.READY

                # Execute task
                task_result = await self._execute_task(task)

                if task.status == TaskStatus.FAILED:
                    logger.error(
                        "Task failed",
                        task_id=task_id,
                        error=task.error,
                    )
                    # Continue with other tasks (don't fail phase immediately)

            # Check phase completion
            phase.end_time = datetime.now(UTC)

            completed_tasks = sum(
                1 for t in phase.tasks.values() if t.status == TaskStatus.COMPLETED
            )
            failed_tasks = sum(
                1 for t in phase.tasks.values() if t.status == TaskStatus.FAILED
            )
            total_tasks = len(phase.tasks)

            # Phase succeeds if most tasks completed
            if completed_tasks > failed_tasks:
                phase.status = PhaseStatus.COMPLETED
            else:
                phase.status = PhaseStatus.FAILED

            logger.info(
                "Phase execution completed",
                phase_id=phase.phase_id,
                status=phase.status,
                completed=completed_tasks,
                failed=failed_tasks,
                total=total_tasks,
            )

            return {
                "status": phase.status,
                "completed_tasks": completed_tasks,
                "failed_tasks": failed_tasks,
                "total_tasks": total_tasks,
            }

        except Exception as e:
            logger.error(
                "Phase execution failed",
                phase_id=phase.phase_id,
                error=str(e),
            )
            phase.status = PhaseStatus.FAILED
            phase.end_time = datetime.now(UTC)

            return {
                "status": PhaseStatus.FAILED,
                "error": str(e),
            }

    async def _execute_task(
        self,
        task: Task,
    ) -> dict[str, Any]:
        """
        Execute a single task.

        Args:
            task: Task to execute

        Returns:
            Task execution result
        """
        task.status = TaskStatus.IN_PROGRESS
        task.start_time = datetime.now(UTC)

        try:
            # Find agent with required capability
            capable_agents = self.agent_registry.find_agents_by_capability(
                task.agent_capability
            )

            if not capable_agents:
                task.status = TaskStatus.FAILED
                task.error = f"No agent with capability: {task.agent_capability}"
                task.end_time = datetime.now(UTC)
                return {"error": task.error}

            # Select best agent (for now, just use first one)
            selected_agent = capable_agents[0]
            task.assigned_agent_id = selected_agent.agent_id

            logger.info(
                "Executing task",
                task_id=task.task_id,
                task_name=task.name,
                agent_id=selected_agent.agent_id,
            )

            # Execute task
            result = await selected_agent.execute_with_metrics(
                task=task.description,
                context=task.required_context,
            )

            task.result = result
            task.end_time = datetime.now(UTC)

            # Check for errors
            if result.get("error"):
                task.status = TaskStatus.FAILED
                task.error = result["error"]

                # Retry if retries available
                if task.retry_count < task.max_retries:
                    task.retry_count += 1
                    logger.info(
                        "Retrying task",
                        task_id=task.task_id,
                        retry_count=task.retry_count,
                    )
                    return await self._execute_task(task)
            else:
                task.status = TaskStatus.COMPLETED

            return result

        except Exception as e:
            logger.error(
                "Task execution failed",
                task_id=task.task_id,
                error=str(e),
            )
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.end_time = datetime.now(UTC)

            return {"error": str(e)}

    def _get_phase_execution_order(self, project: Project) -> list[str]:
        """
        Get phase execution order respecting dependencies (topological sort).

        Args:
            project: Project with phases

        Returns:
            List of phase IDs in execution order
        """
        # Build dependency graph
        graph: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = defaultdict(int)

        for phase_id, phase in project.phases.items():
            in_degree[phase_id] = len(phase.depends_on_phases)
            for dep_phase_id in phase.depends_on_phases:
                graph[dep_phase_id].append(phase_id)

        # Topological sort (Kahn's algorithm)
        queue = [pid for pid, degree in in_degree.items() if degree == 0]
        result = []

        while queue:
            current = queue.pop(0)
            result.append(current)

            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        return result

    def _get_task_execution_order(self, phase: Phase) -> list[str]:
        """
        Get task execution order respecting dependencies and priorities.

        Args:
            phase: Phase with tasks

        Returns:
            List of task IDs in execution order
        """
        # Build dependency graph
        graph: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = defaultdict(int)

        for task_id, task in phase.tasks.items():
            in_degree[task_id] = len(task.dependencies)
            for dep_task_id in task.dependencies:
                graph[dep_task_id].append(task_id)

        # Topological sort with priority queue
        queue = [
            (phase.tasks[tid].priority, tid)
            for tid, degree in in_degree.items()
            if degree == 0
        ]
        queue.sort()  # Sort by priority
        result = []

        while queue:
            _, current = queue.pop(0)
            result.append(current)

            neighbors_with_priority = []
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    neighbors_with_priority.append(
                        (phase.tasks[neighbor].priority, neighbor)
                    )

            neighbors_with_priority.sort()
            queue.extend(neighbors_with_priority)

        return result

    def _are_dependencies_satisfied(self, task: Task, phase: Phase) -> bool:
        """
        Check if all task dependencies are satisfied.

        Args:
            task: Task to check
            phase: Phase containing the task

        Returns:
            True if dependencies satisfied
        """
        for dep_task_id in task.dependencies:
            dep_task = phase.tasks.get(dep_task_id)
            if not dep_task or dep_task.status != TaskStatus.COMPLETED:
                return False
        return True

    def _calculate_project_statistics(self, project: Project) -> dict[str, Any]:
        """
        Calculate project execution statistics.

        Args:
            project: Completed or failed project

        Returns:
            Statistics dictionary
        """
        total_phases = len(project.phases)
        completed_phases = sum(
            1 for p in project.phases.values() if p.status == PhaseStatus.COMPLETED
        )
        failed_phases = sum(
            1 for p in project.phases.values() if p.status == PhaseStatus.FAILED
        )

        total_tasks = sum(len(phase.tasks) for phase in project.phases.values())
        completed_tasks = sum(
            sum(1 for t in phase.tasks.values() if t.status == TaskStatus.COMPLETED)
            for phase in project.phases.values()
        )
        failed_tasks = sum(
            sum(1 for t in phase.tasks.values() if t.status == TaskStatus.FAILED)
            for phase in project.phases.values()
        )

        duration_seconds = 0
        if project.start_time and project.end_time:
            duration_seconds = int(
                (project.end_time - project.start_time).total_seconds()
            )

        return {
            "total_phases": total_phases,
            "completed_phases": completed_phases,
            "failed_phases": failed_phases,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "success_rate": (
                round(completed_tasks / total_tasks * 100, 2) if total_tasks > 0 else 0
            ),
            "duration_seconds": duration_seconds,
        }

    def get_project_progress(self, project_id: str) -> dict[str, Any]:
        """
        Get current project progress.

        Args:
            project_id: Project ID

        Returns:
            Progress information
        """
        project = self.projects.get(project_id)
        if not project:
            return {"error": f"Project not found: {project_id}"}

        stats = self._calculate_project_statistics(project)

        return {
            "project_id": project_id,
            "name": project.name,
            "current_phase": project.current_phase_id,
            "progress_percentage": stats["success_rate"],
            "statistics": stats,
        }


# Singleton instance
_project_orchestrator: ProjectOrchestrator | None = None


def get_project_orchestrator() -> ProjectOrchestrator:
    """Get ProjectOrchestrator singleton."""
    global _project_orchestrator
    if _project_orchestrator is None:
        _project_orchestrator = ProjectOrchestrator()
    return _project_orchestrator
