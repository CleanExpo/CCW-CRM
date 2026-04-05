"""Generate test data for dashboard testing."""

import asyncio
from datetime import UTC, datetime, timedelta
import random

from src.ai.monitoring import get_metrics_collector


async def generate_test_data():
    """Generate realistic test execution data."""
    collector = get_metrics_collector()

    agents = [
        ("pricing_agent", "Pricing Agent"),
        ("procurement_agent", "Procurement Agent"),
        ("task_executor", "Task Executor"),
    ]

    tasks = {
        "pricing_agent": [
            "Calculate optimal price",
            "Analyze pricing history",
            "Recommend price adjustment",
            "Calculate margin",
        ],
        "procurement_agent": [
            "Check inventory levels",
            "Calculate reorder quantity",
            "Suggest suppliers",
            "Analyze stock trends",
        ],
        "task_executor": [
            "Execute database update",
            "Validate user action",
            "Execute batch operation",
        ],
    }

    # Generate 50 executions over the past 2 hours
    now = datetime.now(UTC)

    for i in range(50):
        # Random agent
        agent_id, agent_name = random.choice(agents)

        # Random task for that agent
        task = random.choice(tasks[agent_id])

        # Random time in past 2 hours
        minutes_ago = random.randint(0, 120)
        started_at = (now - timedelta(minutes=minutes_ago)).isoformat()

        # Random duration (100ms to 5s)
        duration_ms = random.randint(100, 5000)
        completed_at = (now - timedelta(minutes=minutes_ago) + timedelta(milliseconds=duration_ms)).isoformat()

        # 85% success rate
        status = "completed" if random.random() < 0.85 else "failed"

        # Generate execution
        collector.record_execution(
            execution_id=f"test-{i:03d}",
            agent_id=agent_id,
            agent_name=agent_name,
            task=task,
            status=status,
            started_at=started_at,
            completed_at=completed_at if status == "completed" else None,
            duration_ms=duration_ms if status == "completed" else None,
            error=f"Test error {i}" if status == "failed" else None,
            metadata={
                "test_data": True,
                "iteration": i,
            },
        )

    print(f"Generated 50 test executions")
    print(f"Check dashboard at: http://localhost:3008/agents")


if __name__ == "__main__":
    asyncio.run(generate_test_data())
