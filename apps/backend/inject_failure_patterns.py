"""
Inject realistic failure patterns directly into the database.

This bypasses the API and metrics collector by directly creating
failure patterns in the database.
"""

import asyncio
from datetime import UTC, datetime

async def inject_failure_patterns():
    """Inject realistic failure patterns into database."""

    from src.ai.learning.learning_repository import LearningRepository
    from src.config.database import AsyncSessionLocal

    print("\n" + "="*70)
    print("INJECTING FAILURE PATTERNS INTO DATABASE")
    print("="*70 + "\n")

    # Create session and repository
    async with AsyncSessionLocal() as session:
        repo = LearningRepository(db_session=session)

        # Define failure patterns
        failure_patterns = [
            {
                "pattern_id": "pattern-pricing_agent-price_adjustment-fail",
                "agent_id": "pricing_agent",
                "pattern_type": "failure",
                "task_category": "recommend_price_adjustment",
                "observed_count": 40,
                "success_rate": 0.25,  # 25% success = 75% failure
                "avg_duration_ms": 1200.0,
                "confidence": 0.92,
                "conditions": {
                    "error_type": "API_RATE_LIMIT",
                    "time_of_day": "peak_hours",
                    "data_complexity": "high"
                },
                "actions": ["fetch_market_data", "calculate_adjustment", "validate_price"],
                "outcomes": {
                    "common_errors": [
                        "External API rate limit exceeded",
                        "Market data unavailable",
                        "Price validation failed"
                    ],
                    "avg_failure_duration_ms": 1200,
                },
                "metadata": {
                    "failures": 30,
                    "successes": 10,
                    "critical": True
                },
                "first_observed": datetime.now(UTC).isoformat(),
                "last_observed": datetime.now(UTC).isoformat(),
            },
            {
                "pattern_id": "pattern-procurement_agent-suggest_suppliers-fail",
                "agent_id": "procurement_agent",
                "pattern_type": "failure",
                "task_category": "suggest_suppliers",
                "observed_count": 50,
                "success_rate": 0.20,  # 20% success = 80% failure
                "avg_duration_ms": 1000.0,
                "confidence": 0.95,
                "conditions": {
                    "error_type": "DATABASE_TIMEOUT",
                    "supplier_count": "large_dataset",
                    "query_complexity": "high"
                },
                "actions": ["query_suppliers", "check_inventory", "rank_options"],
                "outcomes": {
                    "common_errors": [
                        "Database connection timeout after 30s",
                        "Query too complex - missing index",
                        "Supplier API unavailable"
                    ],
                    "avg_failure_duration_ms": 1000,
                },
                "metadata": {
                    "failures": 40,
                    "successes": 10,
                    "critical": True
                },
                "first_observed": datetime.now(UTC).isoformat(),
                "last_observed": datetime.now(UTC).isoformat(),
            },
            {
                "pattern_id": "pattern-task_executor-verify_integrity-fail",
                "agent_id": "task_executor",
                "pattern_type": "failure",
                "task_category": "verify_data_integrity",
                "observed_count": 35,
                "success_rate": 0.40,  # 40% success = 60% failure
                "avg_duration_ms": 1500.0,
                "confidence": 0.88,
                "conditions": {
                    "error_type": "VALIDATION_ERROR",
                    "data_volume": "large",
                    "validation_rules": "strict"
                },
                "actions": ["load_data", "apply_rules", "generate_report"],
                "outcomes": {
                    "common_errors": [
                        "Validation failed: missing required fields",
                        "Data inconsistency detected",
                        "Schema mismatch"
                    ],
                    "avg_failure_duration_ms": 1500,
                },
                "metadata": {
                    "failures": 21,
                    "successes": 14,
                    "critical": False
                },
                "first_observed": datetime.now(UTC).isoformat(),
                "last_observed": datetime.now(UTC).isoformat(),
            },
            {
                "pattern_id": "pattern-task_executor-batch_operation-slow",
                "agent_id": "task_executor",
                "pattern_type": "optimization",
                "task_category": "execute_batch_operation",
                "observed_count": 30,
                "success_rate": 0.75,  # Succeeds but slow
                "avg_duration_ms": 5200.0,  # Very slow!
                "confidence": 0.90,
                "conditions": {
                    "performance_issue": "HIGH_DURATION",
                    "batch_size": "large",
                    "database_load": "high"
                },
                "actions": ["prepare_batch", "execute_operations", "commit_transaction"],
                "outcomes": {
                    "performance_notes": [
                        "Average duration 5.2s (expected: <1s)",
                        "Database locks detected",
                        "No batch optimization applied"
                    ],
                    "optimization_potential": "high",
                },
                "metadata": {
                    "failures": 7,
                    "successes": 23,
                    "slow_executions": 28
                },
                "first_observed": datetime.now(UTC).isoformat(),
                "last_observed": datetime.now(UTC).isoformat(),
            },
        ]

        # Save patterns
        saved_count = 0
        for pattern in failure_patterns:
            result = await repo.save_pattern(pattern)
            if result:
                saved_count += 1
                priority = "HIGH" if pattern["success_rate"] < 0.3 else "MEDIUM" if pattern["success_rate"] < 0.7 or pattern["avg_duration_ms"] > 3000 else "LOW"
                print(f"   [OK] Saved {priority} priority pattern:")
                print(f"        {pattern['agent_id']} - {pattern['task_category']}")
                print(f"        Success: {pattern['success_rate']*100:.0f}%, Duration: {pattern['avg_duration_ms']:.0f}ms")
            else:
                print(f"   [ERROR] Failed to save: {pattern['pattern_id']}")

        print(f"\n   Total patterns saved: {saved_count}/{len(failure_patterns)}")

    print("\n" + "="*70)
    print("PATTERNS INJECTED - Now loading into learning engine...")
    print("="*70 + "\n")

    # Load patterns into learning engine memory
    from src.ai.learning import get_learning_engine
    engine = get_learning_engine()
    loaded_count = await engine.load_patterns_from_db()
    print(f"   [OK] Loaded {loaded_count} patterns into learning engine memory\n")

    # Now generate insights from these patterns
    print("=" * 70)
    print("GENERATING INSIGHTS FROM FAILURE PATTERNS...")
    print("=" * 70 + "\n")

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/ai/learning/generate-insights",
                params={"min_confidence": 0.3},
                timeout=30.0,
            )
            response.raise_for_status()
            result = response.json()

            print(f"   [OK] Generated {len(result['insights'])} new insights\n")

            # Fetch all insights
            response = await client.get(
                "http://localhost:8000/api/ai/learning/insights",
                timeout=10.0,
            )
            response.raise_for_status()
            all_insights = response.json()

            # Count by priority
            priority_counts = {"high": 0, "medium": 0, "low": 0}
            for insight in all_insights['insights']:
                priority_counts[insight['priority']] += 1

            print("="*70)
            print("FINAL RESULTS")
            print("="*70)
            print(f"\nTotal insights: {all_insights['total']}")
            print(f"  HIGH priority:   {priority_counts['high']} (Critical failures)")
            print(f"  MEDIUM priority: {priority_counts['medium']} (Performance issues)")
            print(f"  LOW priority:    {priority_counts['low']} (General improvements)")

            print(f"\nDashboard: http://localhost:3000/agents")
            print("\nYou should now see:")
            print(f"  • Red cards for {priority_counts['high']} high-priority insights")
            print(f"  • Orange cards for {priority_counts['medium']} medium-priority insights")
            print(f"  • Blue cards for {priority_counts['low']} low-priority insights")
            print("="*70 + "\n")

        except Exception as e:
            print(f"   [ERROR] Failed to generate insights: {e}\n")


if __name__ == "__main__":
    asyncio.run(inject_failure_patterns())
