"""
Autonomous Execution Loop for continuous project execution.

Monitors project queue and executes tasks autonomously with failure handling.
"""

import asyncio
from datetime import UTC, datetime
from typing import Any

import structlog

from src.ai.orchestration.project_orchestrator import (
    PhaseStatus,
    Project,
    TaskStatus,
    get_project_orchestrator,
)

logger = structlog.get_logger(__name__)


class AutonomousExecutionLoop:
    """
    Autonomous execution loop for continuous project development.

    Features:
    - Continuous monitoring of project queue
    - Automatic task execution with retry logic
    - Failure handling and escalation
    - Human approval for critical operations
    - Progress tracking and reporting
    """

    def __init__(
        self,
        check_interval_seconds: int = 5,
        max_concurrent_projects: int = 1,
        require_approval_for_schema_changes: bool = True,
    ):
        """
        Initialize autonomous execution loop.

        Args:
            check_interval_seconds: How often to check for new work (default: 5s)
            max_concurrent_projects: Maximum projects to run simultaneously (default: 1)
            require_approval_for_schema_changes: Whether schema changes need approval (default: True)
        """
        self.check_interval_seconds = check_interval_seconds
        self.max_concurrent_projects = max_concurrent_projects
        self.require_approval_for_schema_changes = require_approval_for_schema_changes

        self.orchestrator = get_project_orchestrator()

        # Execution state
        self.is_running = False
        self.active_projects: set[str] = set()
        self.paused_projects: set[str] = set()  # Projects waiting for approval
        self.execution_loop_task: asyncio.Task | None = None

        # Statistics
        self.total_projects_completed = 0
        self.total_tasks_completed = 0
        self.total_tasks_failed = 0
        self.start_time: datetime | None = None

        logger.info(
            "AutonomousExecutionLoop initialized",
            check_interval=check_interval_seconds,
            max_concurrent=max_concurrent_projects,
        )

    async def start(self):
        """Start the autonomous execution loop."""
        if self.is_running:
            logger.warning("Execution loop already running")
            return

        self.is_running = True
        self.start_time = datetime.now(UTC)

        logger.info("Starting autonomous execution loop")

        # Start the main execution loop as a background task
        self.execution_loop_task = asyncio.create_task(self._execution_loop())

    async def stop(self):
        """Stop the autonomous execution loop."""
        if not self.is_running:
            logger.warning("Execution loop not running")
            return

        self.is_running = False

        logger.info("Stopping autonomous execution loop")

        # Cancel the execution loop task
        if self.execution_loop_task:
            self.execution_loop_task.cancel()
            try:
                await self.execution_loop_task
            except asyncio.CancelledError:
                pass

        logger.info("Autonomous execution loop stopped")

    async def _execution_loop(self):
        """Main execution loop that runs continuously."""
        while self.is_running:
            try:
                # Check for projects that need execution
                await self._process_project_queue()

                # Wait before next check
                await asyncio.sleep(self.check_interval_seconds)

            except asyncio.CancelledError:
                logger.info("Execution loop cancelled")
                break
            except Exception as e:
                logger.error("Error in execution loop", error=str(e))
                # Continue running despite errors
                await asyncio.sleep(self.check_interval_seconds)

    async def _process_project_queue(self):
        """Process projects in the queue."""
        # Get all projects
        for project_id, project in self.orchestrator.projects.items():
            # Skip if already active
            if project_id in self.active_projects:
                continue

            # Skip if paused (waiting for approval)
            if project_id in self.paused_projects:
                continue

            # Skip if already completed
            if project.end_time is not None:
                continue

            # Check if we can start a new project
            if len(self.active_projects) >= self.max_concurrent_projects:
                logger.debug(
                    "Max concurrent projects reached",
                    active=len(self.active_projects),
                    max=self.max_concurrent_projects,
                )
                break

            # Start executing the project
            logger.info("Starting project execution", project_id=project_id)
            self.active_projects.add(project_id)

            # Execute project in background
            asyncio.create_task(self._execute_project_with_monitoring(project_id))

    async def _execute_project_with_monitoring(self, project_id: str):
        """
        Execute a project with monitoring and error handling.

        Args:
            project_id: Project ID to execute
        """
        try:
            project = self.orchestrator.projects[project_id]

            # Execute all phases
            for phase_id in self.orchestrator._get_phase_execution_order(project):
                phase = project.phases[phase_id]

                # Check if phase needs approval
                if await self._requires_approval(project, phase):
                    logger.info(
                        "Phase requires approval, pausing project",
                        project_id=project_id,
                        phase_id=phase_id,
                    )
                    self.paused_projects.add(project_id)
                    self.active_projects.remove(project_id)
                    return

                # Execute phase
                logger.info(
                    "Executing phase",
                    project_id=project_id,
                    phase_id=phase_id,
                    phase_name=phase.name,
                )

                phase_result = await self.orchestrator._execute_phase(
                    project=project,
                    phase=phase,
                )

                # Handle phase failure
                if phase_result["status"] == PhaseStatus.FAILED:
                    await self._handle_phase_failure(
                        project_id=project_id,
                        phase_id=phase_id,
                        phase_result=phase_result,
                    )
                    break

            # Project completed
            self.total_projects_completed += 1
            self.active_projects.remove(project_id)

            # Update statistics
            stats = self.orchestrator._calculate_project_statistics(project)
            self.total_tasks_completed += stats["completed_tasks"]
            self.total_tasks_failed += stats["failed_tasks"]

            logger.info(
                "Project completed",
                project_id=project_id,
                statistics=stats,
            )

        except Exception as e:
            logger.error(
                "Project execution failed with exception",
                project_id=project_id,
                error=str(e),
            )
            if project_id in self.active_projects:
                self.active_projects.remove(project_id)

    async def _requires_approval(self, project: Project, phase) -> bool:
        """
        Check if a phase requires human approval.

        Args:
            project: Project being executed
            phase: Phase to check

        Returns:
            True if approval required
        """
        # Check if any task in phase requires approval
        for task in phase.tasks.values():
            # Schema changes always require approval
            if self.require_approval_for_schema_changes:
                if "migration" in task.description.lower() or "schema" in task.description.lower():
                    return True

            # Database changes require approval
            if "database" in task.description.lower() and "model" in task.description.lower():
                return True

            # Deployment tasks require approval
            if "deploy" in task.description.lower():
                return True

        return False

    async def _handle_phase_failure(
        self,
        project_id: str,
        phase_id: str,
        phase_result: dict[str, Any],
    ):
        """
        Handle phase failure with intelligent recovery.

        Args:
            project_id: Project ID
            phase_id: Failed phase ID
            phase_result: Phase execution result
        """
        logger.error(
            "Phase failed",
            project_id=project_id,
            phase_id=phase_id,
            result=phase_result,
        )

        # Analyze failures
        project = self.orchestrator.projects[project_id]
        phase = project.phases[phase_id]

        failed_tasks = [t for t in phase.tasks.values() if t.status == TaskStatus.FAILED]

        # Log failed tasks
        for task in failed_tasks:
            logger.error(
                "Task failed",
                project_id=project_id,
                phase_id=phase_id,
                task_id=task.task_id,
                task_name=task.name,
                error=task.error,
                retry_count=task.retry_count,
            )

        # Check if failures are recoverable
        recoverable_failures = [
            t for t in failed_tasks if t.retry_count < t.max_retries
        ]

        if recoverable_failures:
            logger.info(
                "Some failures are recoverable, will retry",
                project_id=project_id,
                phase_id=phase_id,
                recoverable_count=len(recoverable_failures),
            )
        else:
            logger.error(
                "All failures exhausted retries, escalating to human",
                project_id=project_id,
                phase_id=phase_id,
            )
            # Pause project for human intervention
            self.paused_projects.add(project_id)

        # Remove from active projects
        if project_id in self.active_projects:
            self.active_projects.remove(project_id)

    def resume_project(self, project_id: str) -> dict[str, Any]:
        """
        Resume a paused project after human approval.

        Args:
            project_id: Project ID to resume

        Returns:
            Resume result
        """
        if project_id not in self.paused_projects:
            return {"error": f"Project not paused: {project_id}"}

        self.paused_projects.remove(project_id)

        logger.info(
            "Project resumed by human approval",
            project_id=project_id,
        )

        return {
            "success": True,
            "message": f"Project {project_id} resumed",
        }

    def get_status(self) -> dict[str, Any]:
        """
        Get execution loop status.

        Returns:
            Status information
        """
        uptime_seconds = 0
        if self.start_time:
            uptime_seconds = int((datetime.now(UTC) - self.start_time).total_seconds())

        return {
            "is_running": self.is_running,
            "active_projects": list(self.active_projects),
            "paused_projects": list(self.paused_projects),
            "total_projects_completed": self.total_projects_completed,
            "total_tasks_completed": self.total_tasks_completed,
            "total_tasks_failed": self.total_tasks_failed,
            "uptime_seconds": uptime_seconds,
            "check_interval_seconds": self.check_interval_seconds,
            "max_concurrent_projects": self.max_concurrent_projects,
        }

    def get_detailed_status(self) -> dict[str, Any]:
        """
        Get detailed execution loop status with project details.

        Returns:
            Detailed status information
        """
        status = self.get_status()

        # Add project details
        active_project_details = []
        for project_id in self.active_projects:
            progress = self.orchestrator.get_project_progress(project_id)
            active_project_details.append(progress)

        paused_project_details = []
        for project_id in self.paused_projects:
            progress = self.orchestrator.get_project_progress(project_id)
            paused_project_details.append(progress)

        status["active_project_details"] = active_project_details
        status["paused_project_details"] = paused_project_details

        return status


# Singleton instance
_autonomous_loop: AutonomousExecutionLoop | None = None


def get_autonomous_loop() -> AutonomousExecutionLoop:
    """Get AutonomousExecutionLoop singleton."""
    global _autonomous_loop
    if _autonomous_loop is None:
        _autonomous_loop = AutonomousExecutionLoop()
    return _autonomous_loop
