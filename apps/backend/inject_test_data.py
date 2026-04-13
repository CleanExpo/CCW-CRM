"""Directly inject test data into running backend's metrics collector."""

import asyncio
import random
from datetime import UTC, datetime, timedelta

from src.ai.monitoring import get_metrics_collector


async def main():
    """Generate test data with failures."""
    collector = get_metrics_collector()

    agents = [
        ("pricing_agent", "Pricing Agent"),
        ("procurement_agent", "Procurement Agent"),
        ("task_executor", "Task Executor"),
    ]

    # (task, success_rate, typical_duration_ms)
    tasks = {
        "pricing_agent": [
            ("Calculate optimal price", 0.85, 500),
            ("Analyze pricing history", 0.90, 3000),
            ("Recommend price adjustment", 0.25, 1000),  # FAILING
            ("Calculate margin", 0.95, 400),
            ("Price optimization strategy", 0.30, 2000),  # FAILING + SLOW
        ],
        "procurement_agent": [
            ("Check inventory levels", 0.95, 600),
            ("Calculate reorder quantity", 0.80, 1500),
            ("Suggest suppliers", 0.20, 1000),  # FAILING
            ("Analyze stock trends", 0.90, 4000),  # SLOW
            ("Validate supplier data", 0.35, 800),  # FAILING
        ],
        "task_executor": [
            ("Execute database update", 0.92, 700),
            ("Validate user action", 0.88, 500),
            ("Execute batch operation", 0.75, 5000),  # VERY SLOW
            ("Verify data integrity", 0.40, 1200),  # FAILING
        ],
    }

    error_messages = [
        "Database connection timeout",
        "Invalid input parameters",
        "External API rate limit exceeded",
        "Insufficient data for analysis",
        "Validation failed: missing required fields",
        "Network timeout after 30 seconds",
        "Authorization failed: invalid token",
    ]

    now = datetime.now(UTC)
    stats = {"total": 0, "succeeded": 0, "failed": 0}

    for i in range(100):
        agent_id, agent_name = random.choice(agents)
        task, success_rate, typical_duration = random.choice(tasks[agent_id])

        minutes_ago = random.randint(0, 240)
        started_at = (now - timedelta(minutes=minutes_ago)).isoformat()

        duration_ms = int(typical_duration * random.uniform(0.7, 1.3))
        completed_at = (now - timedelta(minutes=minutes_ago) + timedelta(milliseconds=duration_ms)).isoformat()

        status = "completed" if random.random() < success_rate else "failed"

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

        stats["total"] += 1
        if status == "completed":
            stats["succeeded"] += 1
        else:
            stats["failed"] += 1

    print(f"\nGenerated {stats['total']} test executions")
    print(f"  Succeeded: {stats['succeeded']}")
    print(f"  Failed: {stats['failed']}")
    print("\nExpected patterns:")
    print("  - SUCCESS: Fast tasks with >80% success rate")
    print("  - FAILURE: Tasks with <30% success rate (will trigger HIGH priority insights)")
    print("  - OPTIMIZATION: Slow tasks (>3s) that succeed (will trigger MEDIUM priority insights)")
    print("\nNext steps:")
    print("  1. POST /api/ai/learning/extract-patterns?lookback_hours=5&min_observations=3")
    print("  2. POST /api/ai/learning/generate-insights?min_confidence=0.4")
    print("  3. Check dashboard: http://localhost:3000/agents")


if __name__ == "__main__":
    asyncio.run(main())
