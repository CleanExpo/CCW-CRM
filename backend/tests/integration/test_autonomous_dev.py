"""
Integration tests for Autonomous Development Framework endpoints.

Tests project creation, execution loop control, and agent activity monitoring.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_get_execution_loop_status(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting execution loop status."""

    response = await client.get("/api/autonomous/status")

    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "active_projects" in data
    assert "total_tasks_completed" in data
    assert isinstance(data["is_running"], bool)
    assert isinstance(data["active_projects"], list)


@pytest.mark.asyncio
async def test_get_detailed_status(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting detailed execution loop status."""

    response = await client.get("/api/autonomous/status/detailed")

    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "check_interval_seconds" in data
    assert "active_project_details" in data
    assert isinstance(data["active_project_details"], list)


@pytest.mark.asyncio
async def test_start_execution_loop(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test starting the execution loop."""

    response = await client.post("/api/autonomous/start")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Autonomous execution loop started"

    # Verify it's running
    status_response = await client.get("/api/autonomous/status")
    status_data = status_response.json()
    assert status_data["is_running"] is True


@pytest.mark.asyncio
async def test_stop_execution_loop(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test stopping the execution loop."""

    # Start first
    await client.post("/api/autonomous/start")

    # Then stop
    response = await client.post("/api/autonomous/stop")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Autonomous execution loop stopped"

    # Verify it's stopped
    status_response = await client.get("/api/autonomous/status")
    status_data = status_response.json()
    assert status_data["is_running"] is False


@pytest.mark.asyncio
async def test_create_simple_project(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test creating a simple autonomous development project."""

    project_data = {
        "name": "Test Project",
        "description": "A test project for autonomous development",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Foundation",
                "description": "Setup basic structure",
                "tasks": [
                    {
                        "task_id": "task1",
                        "name": "Create config file",
                        "description": "Create configuration file",
                        "agent_capability": "code_generation",
                        "priority": 10,
                    }
                ],
            }
        ],
    }

    response = await client.post(
        "/api/autonomous/projects",
        json=project_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "project_id" in data
    assert "Project created" in data["message"]


@pytest.mark.asyncio
async def test_create_multi_phase_project(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test creating a multi-phase project with dependencies."""

    project_data = {
        "name": "Multi-Phase Project",
        "description": "Project with multiple phases",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Foundation",
                "description": "Setup",
                "tasks": [
                    {
                        "task_id": "task1",
                        "name": "Setup database",
                        "description": "Create database schema",
                        "agent_capability": "code_generation",
                        "priority": 10,
                    }
                ],
            },
            {
                "phase_id": "phase2",
                "name": "Implementation",
                "description": "Build features",
                "depends_on_phases": ["phase1"],
                "tasks": [
                    {
                        "task_id": "task2",
                        "name": "Build API",
                        "description": "Create API endpoints",
                        "agent_capability": "api_endpoints",
                        "priority": 9,
                        "depends_on_tasks": ["task1"],
                    }
                ],
            },
        ],
    }

    response = await client.post(
        "/api/autonomous/projects",
        json=project_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_get_project_progress(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting project progress."""

    # Create a project first
    project_data = {
        "name": "Progress Test Project",
        "description": "Test project progress tracking",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Test Phase",
                "description": "Test phase",
                "tasks": [
                    {
                        "task_id": "task1",
                        "name": "Test Task",
                        "description": "Test task",
                        "agent_capability": "code_generation",
                        "priority": 10,
                    }
                ],
            }
        ],
    }

    create_response = await client.post(
        "/api/autonomous/projects",
        json=project_data,
    )
    project_id = create_response.json()["project_id"]

    # Get progress
    response = await client.get(
        f"/api/autonomous/projects/{project_id}/progress"
    )

    assert response.status_code == 200
    data = response.json()
    assert "project_id" in data
    assert "name" in data
    assert "current_phase" in data
    assert "progress_percentage" in data
    assert "statistics" in data
    assert isinstance(data["progress_percentage"], (int, float))
    assert isinstance(data["statistics"], dict)


@pytest.mark.asyncio
async def test_list_all_projects(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test listing all projects."""

    response = await client.get("/api/autonomous/projects")

    assert response.status_code == 200
    data = response.json()
    assert "projects" in data
    assert isinstance(data["projects"], list)


@pytest.mark.asyncio
async def test_get_agent_activity(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting agent activity dashboard."""

    response = await client.get("/api/autonomous/agents/activity")

    assert response.status_code == 200
    data = response.json()
    assert "agents" in data
    assert isinstance(data["agents"], list)

    # Check agent structure if any agents exist
    if data["agents"]:
        agent = data["agents"][0]
        assert "agent_id" in agent
        assert "name" in agent
        assert "health_status" in agent
        assert "capabilities" in agent


@pytest.mark.asyncio
async def test_resume_paused_project(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test resuming a paused project."""

    # Create a project
    project_data = {
        "name": "Resume Test Project",
        "description": "Test project resume",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Test Phase",
                "description": "Test phase",
                "tasks": [
                    {
                        "task_id": "task1",
                        "name": "Test Task",
                        "description": "Test task",
                        "agent_capability": "code_generation",
                        "priority": 10,
                    }
                ],
            }
        ],
    }

    create_response = await client.post(
        "/api/autonomous/projects",
        json=project_data,
    )
    project_id = create_response.json()["project_id"]

    # Resume the project
    response = await client.post(
        "/api/autonomous/projects/resume",
        json={"project_id": project_id},
    )

    assert response.status_code == 200
    data = response.json()
    # Project not actually paused, so response may indicate no action needed
    assert "success" in data
    # If not successful, should have error or message
    if not data.get("success"):
        assert "error" in data or "message" in data


@pytest.mark.asyncio
async def test_invalid_project_creation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that invalid project data is rejected."""

    # Missing required fields
    invalid_data = {
        "name": "Invalid Project",
        # Missing description and phases
    }

    response = await client.post(
        "/api/autonomous/projects",
        json=invalid_data,
    )

    # Should fail validation
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_nonexistent_project_progress(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting progress for non-existent project."""

    fake_project_id = "nonexistent_project_123"

    response = await client.get(
        f"/api/autonomous/projects/{fake_project_id}/progress"
    )

    # Should handle gracefully
    assert response.status_code in [404, 200]


@pytest.mark.asyncio
async def test_execution_loop_idempotent_start(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that starting an already running loop is idempotent."""

    # Start once
    response1 = await client.post("/api/autonomous/start")
    assert response1.status_code == 200

    # Start again
    response2 = await client.post("/api/autonomous/start")
    assert response2.status_code == 200
    data = response2.json()
    assert "already running" in data["message"].lower()


@pytest.mark.asyncio
async def test_execution_loop_idempotent_stop(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that stopping an already stopped loop is idempotent."""

    # Ensure stopped
    await client.post("/api/autonomous/stop")

    # Stop again
    response = await client.post("/api/autonomous/stop")
    assert response.status_code == 200
    data = response.json()
    # Should handle gracefully


@pytest.mark.asyncio
async def test_project_with_task_dependencies(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test project with complex task dependencies."""

    project_data = {
        "name": "Dependency Test Project",
        "description": "Test task dependencies",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Development",
                "description": "Build features",
                "tasks": [
                    {
                        "task_id": "task1",
                        "name": "Create models",
                        "description": "Database models",
                        "agent_capability": "database_models",
                        "priority": 10,
                    },
                    {
                        "task_id": "task2",
                        "name": "Create service",
                        "description": "Business logic",
                        "agent_capability": "services",
                        "priority": 9,
                        "depends_on_tasks": ["task1"],
                    },
                    {
                        "task_id": "task3",
                        "name": "Create API",
                        "description": "API endpoints",
                        "agent_capability": "api_endpoints",
                        "priority": 8,
                        "depends_on_tasks": ["task1", "task2"],
                    },
                ],
            }
        ],
    }

    response = await client.post(
        "/api/autonomous/projects",
        json=project_data,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_agent_health_in_activity(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that agent activity includes health status."""

    response = await client.get("/api/autonomous/agents/activity")

    assert response.status_code == 200
    data = response.json()

    if data["agents"]:
        agent = data["agents"][0]
        # Should include health metrics
        assert "health_status" in agent
        assert agent["health_status"] in ["active", "degraded", "offline", "disabled"]


@pytest.mark.asyncio
async def test_project_progress_percentage_calculation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that project progress percentage is calculated correctly."""

    # Create a simple project
    project_data = {
        "name": "Progress Calculation Test",
        "description": "Test progress calculation",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Test Phase",
                "description": "Test phase",
                "tasks": [
                    {
                        "task_id": f"task{i}",
                        "name": f"Task {i}",
                        "description": f"Test task {i}",
                        "agent_capability": "code_generation",
                        "priority": 10 - i,
                    }
                    for i in range(5)
                ],
            }
        ],
    }

    create_response = await client.post(
        "/api/autonomous/projects",
        json=project_data,
    )
    project_id = create_response.json()["project_id"]

    # Get progress
    response = await client.get(
        f"/api/autonomous/projects/{project_id}/progress"
    )

    assert response.status_code == 200
    data = response.json()

    # Progress should be between 0 and 100
    assert 0 <= data["progress_percentage"] <= 100


@pytest.mark.asyncio
async def test_concurrent_project_creation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test handling of concurrent project creation."""

    import asyncio

    project_data_template = {
        "name": "Concurrent Project {}",
        "description": "Test concurrent creation",
        "phases": [
            {
                "phase_id": "phase1",
                "name": "Test Phase",
                "description": "Test phase",
                "tasks": [
                    {
                        "task_id": "task1",
                        "name": "Test Task",
                        "description": "Test task",
                        "agent_capability": "code_generation",
                        "priority": 10,
                    }
                ],
            }
        ],
    }

    # Create multiple projects concurrently
    tasks = [
        client.post(
            "/api/autonomous/projects",
            json={
                **project_data_template,
                "name": project_data_template["name"].format(i),
            },
        )
        for i in range(5)
    ]

    responses = await asyncio.gather(*tasks)

    # All should succeed
    for response in responses:
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


@pytest.mark.asyncio
async def test_detailed_status_includes_metrics(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that detailed status includes execution metrics."""

    response = await client.get("/api/autonomous/status/detailed")

    assert response.status_code == 200
    data = response.json()

    # Should include various metrics
    assert "is_running" in data
    assert "check_interval_seconds" in data
    assert "active_project_details" in data
    assert "paused_project_details" in data
    assert isinstance(data["active_project_details"], list)
    assert isinstance(data["paused_project_details"], list)
