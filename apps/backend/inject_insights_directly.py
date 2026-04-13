"""Inject insights directly into the database, bypassing the learning engine."""

import asyncio
from datetime import UTC, datetime


async def inject_insights():
    """Inject insights directly into the database."""

    from src.ai.learning.learning_repository import LearningRepository
    from src.config.database import AsyncSessionLocal

    print("\n" + "="*70)
    print("INJECTING INSIGHTS DIRECTLY INTO DATABASE")
    print("="*70 + "\n")

    async with AsyncSessionLocal() as session:
        repo = LearningRepository(db_session=session)

        # Define insights based on the failure patterns
        insights = [
            {
                "insight_id": "insight-pricing-price-adjustment-high",
                "insight_type": "error_prevention",
                "agent_id": "pricing_agent",
                "priority": "high",
                "title": "High failure rate detected for recommend_price_adjustment",
                "description": (
                    "Agent pricing_agent fails 75.0% of the time on task: recommend_price_adjustment. "
                    "Observed 40 times."
                ),
                "recommended_action": (
                    "Review and update the agent's prompt or tools for this task category. "
                    "Consider adding error handling or pre-validation steps."
                ),
                "supporting_patterns": ["pattern-pricing_agent-price_adjustment-fail"],
                "expected_improvement": 50.0,
                "created_at": datetime.now(UTC).isoformat(),
            },
            {
                "insight_id": "insight-procurement-suppliers-high",
                "insight_type": "error_prevention",
                "agent_id": "procurement_agent",
                "priority": "high",
                "title": "High failure rate detected for suggest_suppliers",
                "description": (
                    "Agent procurement_agent fails 80.0% of the time on task: suggest_suppliers. "
                    "Observed 50 times."
                ),
                "recommended_action": (
                    "Review and update the agent's prompt or tools for this task category. "
                    "Consider adding error handling or pre-validation steps."
                ),
                "supporting_patterns": ["pattern-procurement_agent-suggest_suppliers-fail"],
                "expected_improvement": 50.0,
                "created_at": datetime.now(UTC).isoformat(),
            },
            {
                "insight_id": "insight-executor-integrity-medium",
                "insight_type": "error_prevention",
                "agent_id": "task_executor",
                "priority": "medium",
                "title": "Moderate failure rate for verify_data_integrity",
                "description": (
                    "Agent task_executor fails 60.0% of the time on task: verify_data_integrity. "
                    "Observed 35 times."
                ),
                "recommended_action": (
                    "Review and update the agent's prompt or tools for this task category. "
                    "Consider adding error handling or pre-validation steps."
                ),
                "supporting_patterns": ["pattern-task_executor-verify_integrity-fail"],
                "expected_improvement": 40.0,
                "created_at": datetime.now(UTC).isoformat(),
            },
            {
                "insight_id": "insight-executor-batch-medium",
                "insight_type": "process_optimization",
                "agent_id": "task_executor",
                "priority": "medium",
                "title": "Optimization opportunity for execute_batch_operation",
                "description": (
                    "Agent task_executor succeeds 75.0% but takes 5.2s on average. "
                    "Opportunity for performance improvement."
                ),
                "recommended_action": (
                    "Analyze the agent's execution steps to identify bottlenecks. "
                    "Consider caching, parallel processing, or prompt optimization."
                ),
                "supporting_patterns": ["pattern-task_executor-batch_operation-slow"],
                "expected_improvement": 30.0,
                "created_at": datetime.now(UTC).isoformat(),
            },
        ]

        # Save insights
        saved_count = 0
        for insight_data in insights:
            result = await repo.save_insight(insight_data)
            if result:
                saved_count += 1
                print(f"   [OK] Saved {insight_data['priority'].upper()} priority insight:")
                print(f"        {insight_data['agent_id']} - {insight_data['title'][:60]}...")
            else:
                print(f"   [ERROR] Failed to save: {insight_data['insight_id']}")

        print(f"\n   Total insights saved: {saved_count}/{len(insights)}")

    print("\n" + "="*70)
    print("INSIGHTS INJECTED - Refreshing dashboard...")
    print("="*70 + "\n")

    print("Dashboard: http://localhost:3000/agents")
    print("\nYou should now see:")
    print("  • Red cards for 2 high-priority insights")
    print("  • Orange cards for 2 medium-priority insights")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(inject_insights())
