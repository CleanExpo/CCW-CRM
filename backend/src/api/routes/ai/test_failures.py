"""Test failure data generation endpoint."""

import random
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Query

from src.ai.monitoring import get_metrics_collector

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/test-failures", tags=["Test Failures"])


@router.post("/generate")
async def generate_failure_scenarios(count: int = Query(200, ge=10, le=500)) -> dict[str, Any]:
    """
    Generate realistic test data with failures for learning engine.

    Creates agent executions with various failure patterns:
    - High failure rate tasks (20-40% failure)
    - Slow tasks (>3s duration)
    - Different error types

    Args:
        count: Number of test executions to generate

    Returns:
        Summary and next steps for pattern extraction
    """
    collector = get_metrics_collector()

    agents = [
        ("pricing_agent", "Pricing Agent"),
        ("procurement_agent", "Procurement Agent"),
        ("task_executor", "Task Executor"),
    ]

    # Task configurations: (task_name, success_rate, avg_duration_ms)
    # Lower success rate = more failures = higher priority insights
    tasks = {
        "pricing_agent": [
            ("calculate_optimal_price", 0.85, 500),  # Good
            ("analyze_pricing_history", 0.90, 3000),  # Slow but reliable
            ("recommend_price_adjustment", 0.25, 1000),  # FAILING - HIGH PRIORITY
            ("calculate_margin", 0.95, 400),  # Excellent
            ("price_optimization_strategy", 0.30, 2000),  # FAILING + SLOW
        ],
        "procurement_agent": [
            ("check_inventory_levels", 0.95, 600),  # Excellent
            ("calculate_reorder_quantity", 0.80, 1500),  # Good
            ("suggest_suppliers", 0.20, 1000),  # FAILING - HIGH PRIORITY
            ("analyze_stock_trends", 0.90, 4000),  # Slow but reliable
            ("validate_supplier_data", 0.35, 800),  # FAILING
        ],
        "task_executor": [
            ("execute_database_update", 0.92, 700),  # Excellent
            ("validate_user_action", 0.88, 500),  # Good
            ("execute_batch_operation", 0.75, 5000),  # VERY SLOW - MEDIUM PRIORITY
            ("verify_data_integrity", 0.40, 1200),  # FAILING
        ],
    }

    error_messages = {
        "database": "Database connection timeout after 30s",
        "validation": "Validation failed: missing required fields",
        "api": "External API rate limit exceeded (100 req/hour)",
        "data": "Insufficient data for analysis - need at least 10 records",
        "network": "Network timeout connecting to service",
        "auth": "Authorization failed: invalid or expired token",
        "resource": "Resource unavailable: max connections reached",
    }

    now = datetime.now(UTC)
    stats = {
        "total": 0,
        "succeeded": 0,
        "failed": 0,
        "by_agent": {agent_id: {"total": 0, "succeeded": 0, "failed": 0} for agent_id, _ in agents},
    }

    logger.info("Generating test failure scenarios", count=count)

    for i in range(count):
        # Pick random agent and task
        agent_id, agent_name = random.choice(agents)
        task, success_rate, typical_duration = random.choice(tasks[agent_id])

        # Random time in past 4 hours (for pattern extraction)
        minutes_ago = random.randint(0, 240)
        started_at = (now - timedelta(minutes=minutes_ago)).isoformat()

        # Duration varies ±30%
        duration_ms = int(typical_duration * random.uniform(0.7, 1.3))
        completed_at = (now - timedelta(minutes=minutes_ago) + timedelta(milliseconds=duration_ms)).isoformat()  # noqa: E501

        # Determine success/failure based on task's configured rate
        succeeded = random.random() < success_rate
        status = "completed" if succeeded else "failed"

        # Pick relevant error for failures
        error_msg = None
        if not succeeded:
            if "database" in task:
                error_msg = error_messages["database"]
            elif "validate" in task or "verify" in task:
                error_msg = error_messages["validation"]
            elif "suggest" in task or "recommend" in task:
                error_msg = error_messages["api"]
            else:
                error_msg = random.choice(list(error_messages.values()))

        # Record execution
        collector.record_execution(
            execution_id=f"test-failure-{i:04d}",
            agent_id=agent_id,
            agent_name=agent_name,
            task=task,
            status=status,
            started_at=started_at,
            completed_at=completed_at if succeeded else None,
            duration_ms=duration_ms if succeeded else None,
            error=error_msg,
            metadata={
                "test_data": True,
                "scenario": "failure_testing",
                "expected_success_rate": success_rate,
                "task_complexity": "high" if duration_ms > 3000 else "medium" if duration_ms > 1500 else "low",  # noqa: E501
            },
        )

        # Update stats
        stats["total"] += 1
        stats["by_agent"][agent_id]["total"] += 1
        if succeeded:
            stats["succeeded"] += 1
            stats["by_agent"][agent_id]["succeeded"] += 1
        else:
            stats["failed"] += 1
            stats["by_agent"][agent_id]["failed"] += 1

    # Calculate overall rates
    overall_success_rate = (stats["succeeded"] / stats["total"]) * 100 if stats["total"] > 0 else 0

    logger.info(
        "Test failure scenarios generated",
        total=stats["total"],
        succeeded=stats["succeeded"],
        failed=stats["failed"],
        success_rate=f"{overall_success_rate:.1f}%",
    )

    return {
        "message": f"Successfully generated {count} test executions with realistic failures",
        "statistics": {
            "total": stats["total"],
            "succeeded": stats["succeeded"],
            "failed": stats["failed"],
            "overall_success_rate": f"{overall_success_rate:.1f}%",
            "by_agent": stats["by_agent"],
        },
        "expected_insights": {
            "high_priority": [
                "recommend_price_adjustment (25% success - pricing_agent)",
                "suggest_suppliers (20% success - procurement_agent)",
            ],
            "medium_priority": [
                "execute_batch_operation (75% success but VERY SLOW - task_executor)",
                "price_optimization_strategy (30% success + slow - pricing_agent)",
            ],
            "low_priority": [
                "Tasks with >85% success rate will generate optimization suggestions",
            ],
        },
        "next_steps": [
            "1. Extract patterns: POST /api/ai/learning/extract-patterns?lookback_hours=5&min_observations=5",  # noqa: E501
            "2. Generate insights: POST /api/ai/learning/generate-insights?min_confidence=0.3",
            "3. View insights: GET /api/ai/learning/insights",
            "4. Check dashboard: http://localhost:3000/agents",
        ],
    }
