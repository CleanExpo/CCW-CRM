"""Generate test data with failures and performance issues for insights."""

import asyncio
from datetime import UTC, datetime, timedelta
import random

from src.ai.monitoring import get_metrics_collector


async def generate_realistic_test_data():
    """Generate realistic test execution data with failures and performance issues."""
    collector = get_metrics_collector()

    agents = [
        ("pricing_agent", "Pricing Agent"),
        ("procurement_agent", "Procurement Agent"),
        ("task_executor", "Task Executor"),
    ]

    tasks = {
        "pricing_agent": [
            ("Calculate optimal price", 0.85, 500),      # 85% success, fast
            ("Analyze pricing history", 0.90, 3000),    # 90% success, slow
            ("Recommend price adjustment", 0.25, 1000),  # 25% success, FAILING
            ("Calculate margin", 0.95, 400),            # 95% success, fast
            ("Price optimization strategy", 0.30, 2000), # 30% success, FAILING + slow
        ],
        "procurement_agent": [
            ("Check inventory levels", 0.95, 600),      # 95% success, fast
            ("Calculate reorder quantity", 0.80, 1500),  # 80% success, medium
            ("Suggest suppliers", 0.20, 1000),          # 20% success, FAILING
            ("Analyze stock trends", 0.90, 4000),       # 90% success, SLOW
            ("Validate supplier data", 0.35, 800),      # 35% success, FAILING
        ],
        "task_executor": [
            ("Execute database update", 0.92, 700),     # 92% success, fast
            ("Validate user action", 0.88, 500),        # 88% success, fast
            ("Execute batch operation", 0.75, 5000),    # 75% success, VERY SLOW
            ("Verify data integrity", 0.40, 1200),      # 40% success, FAILING
        ],
    }

    # Generate 100 executions over the past 4 hours
    now = datetime.now(UTC)

    execution_count = 0
    for i in range(100):
        # Random agent
        agent_id, agent_name = random.choice(agents)

        # Random task for that agent with its success rate and typical duration
        task, success_rate, typical_duration = random.choice(tasks[agent_id])

        # Random time in past 4 hours
        minutes_ago = random.randint(0, 240)
        started_at = (now - timedelta(minutes=minutes_ago)).isoformat()

        # Duration varies ±30% from typical
        duration_ms = int(typical_duration * random.uniform(0.7, 1.3))
        completed_at = (now - timedelta(minutes=minutes_ago) + timedelta(milliseconds=duration_ms)).isoformat()

        # Success based on task's success rate
        status = "completed" if random.random() < success_rate else "failed"

        # Error messages for failures
        error_messages = [
            "Database connection timeout",
            "Invalid input parameters",
            "External API rate limit exceeded",
            "Insufficient data for analysis",
            "Validation failed: missing required fields",
            "Network timeout after 30 seconds",
            "Authorization failed: invalid token",
        ]

        # Generate execution
        collector.record_execution(
            execution_id=f"test-realistic-{i:03d}",
            agent_id=agent_id,
            agent_name=agent_name,
            task=task,
            status=status,
            started_at=started_at,
            completed_at=completed_at if status == "completed" else None,
            duration_ms=duration_ms if status == "completed" else None,
            error=random.choice(error_messages) if status == "failed" else None,
            metadata={
                "test_data": True,
                "iteration": i,
                "task_complexity": "high" if duration_ms > 3000 else "medium" if duration_ms > 1500 else "low",
            },
        )
        execution_count += 1

    print(f"Generated {execution_count} test executions with varied performance")
    print(f"")
    print(f"Expected patterns:")
    print(f"  - SUCCESS patterns: Fast tasks with >80% success rate")
    print(f"  - FAILURE patterns: Tasks with <30% success rate (will trigger insights)")
    print(f"  - OPTIMIZATION patterns: Slow tasks (>3s) that succeed (will trigger insights)")
    print(f"")
    print(f"Dashboard: http://localhost:3000/agents")


if __name__ == "__main__":
    asyncio.run(generate_realistic_test_data())
