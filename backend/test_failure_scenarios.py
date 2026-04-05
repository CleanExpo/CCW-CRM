"""
Generate test data with realistic failure scenarios for learning engine testing.

This script generates agent execution data with various failure patterns:
- Network timeouts
- Validation errors
- Resource conflicts
- API failures
- Data processing errors
"""

import asyncio
import random
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.ai.monitoring.metrics_collector import get_metrics_collector


async def generate_failure_scenarios():
    """Generate agent executions with realistic failure patterns."""

    metrics = get_metrics_collector()

    # Define failure scenarios with realistic patterns
    failure_scenarios = [
        {
            "agent_id": "pricing_agent",
            "task": "calculate_dynamic_pricing",
            "failure_rate": 0.3,  # 30% failure
            "error_types": [
                ("Network timeout connecting to pricing API", {"api": "pricing_service", "timeout": 30}),
                ("Invalid product data format", {"validation": "missing_cost", "field": "product_cost"}),
                ("Database connection lost", {"db": "postgresql", "error": "connection_refused"}),
            ],
            "success_duration": (100, 300),
            "failure_duration": (1000, 3000),
        },
        {
            "agent_id": "procurement_agent",
            "task": "analyze_inventory_reorder",
            "failure_rate": 0.25,  # 25% failure
            "error_types": [
                ("Supplier API rate limit exceeded", {"api": "supplier_api", "rate_limit": "100/hour"}),
                ("Inventory data sync conflict", {"conflict": "concurrent_update", "warehouse": "main"}),
                ("Missing supplier pricing data", {"validation": "missing_price", "supplier": "supplier_001"}),
            ],
            "success_duration": (200, 500),
            "failure_duration": (500, 1500),
        },
        {
            "agent_id": "task_executor",
            "task": "execute_purchase_order",
            "failure_rate": 0.4,  # 40% failure - high failure rate
            "error_types": [
                ("Insufficient stock for order", {"stock_required": 100, "stock_available": 50}),
                ("Payment gateway timeout", {"gateway": "stripe", "timeout": 10}),
                ("Order validation failed", {"validation": "invalid_quantity", "reason": "negative_value"}),
            ],
            "success_duration": (300, 600),
            "failure_duration": (800, 2000),
        },
    ]

    # Generate 100 executions per scenario
    total_executions = 0

    for scenario in failure_scenarios:
        print(f"\n{'='*60}")
        print(f"Generating executions for {scenario['agent_id']} - {scenario['task']}")
        print(f"Expected failure rate: {scenario['failure_rate']*100}%")
        print(f"{'='*60}")

        successes = 0
        failures = 0

        for i in range(100):
            execution_id = str(uuid4())
            start_time = datetime.now(UTC) - timedelta(minutes=random.randint(0, 1440))  # Last 24 hours

            # Determine if this execution should fail
            should_fail = random.random() < scenario['failure_rate']

            if should_fail:
                # Generate failure
                error_type, metadata = random.choice(scenario['error_types'])
                duration = random.randint(*scenario['failure_duration'])
                completed_time = start_time + timedelta(milliseconds=duration)

                # Record execution with correct method signature
                metrics.record_execution(
                    execution_id=execution_id,
                    agent_id=scenario['agent_id'],
                    agent_name=scenario['agent_id'].replace('_', ' ').title(),
                    task=scenario['task'],
                    status="failed",
                    started_at=start_time.isoformat(),
                    completed_at=completed_time.isoformat(),
                    duration_ms=duration,
                    error=error_type,
                    metadata=metadata,
                )
                failures += 1
            else:
                # Generate success
                duration = random.randint(*scenario['success_duration'])
                completed_time = start_time + timedelta(milliseconds=duration)

                # Record execution with correct method signature
                metrics.record_execution(
                    execution_id=execution_id,
                    agent_id=scenario['agent_id'],
                    agent_name=scenario['agent_id'].replace('_', ' ').title(),
                    task=scenario['task'],
                    status="completed",
                    started_at=start_time.isoformat(),
                    completed_at=completed_time.isoformat(),
                    duration_ms=duration,
                    metadata={"status": "completed", "items_processed": random.randint(1, 50)},
                )
                successes += 1

            total_executions += 1

        actual_failure_rate = (failures / 100) * 100
        print(f"[OK] Generated 100 executions: {successes} successes, {failures} failures ({actual_failure_rate:.1f}%)")

    print(f"\n{'='*60}")
    print(f"TOTAL: Generated {total_executions} executions with realistic failure patterns")
    print(f"{'='*60}\n")

    return total_executions


async def extract_and_generate_insights():
    """Extract patterns and generate insights from the test data."""

    print("\n" + "="*60)
    print("EXTRACTING PATTERNS FROM EXECUTION DATA")
    print("="*60)

    # Call the learning API to extract patterns
    import httpx

    async with httpx.AsyncClient() as client:
        try:
            # Extract patterns (look back 25 hours to catch all test data)
            print("\n1. Extracting patterns (lookback: 25 hours, min observations: 5)...")
            response = await client.post(
                "http://localhost:8000/api/ai/learning/extract-patterns",
                params={"lookback_hours": 25, "min_observations": 5},
                timeout=30.0,
            )
            response.raise_for_status()
            patterns_data = response.json()

            print(f"✓ Found {patterns_data['patterns_extracted']} patterns")
            print(f"  - Success patterns: {patterns_data['success_patterns']}")
            print(f"  - Failure patterns: {patterns_data['failure_patterns']}")

            # Generate insights
            print("\n2. Generating insights (min confidence: 0.5)...")
            response = await client.post(
                "http://localhost:8000/api/ai/learning/generate-insights",
                params={"min_confidence": 0.5},
                timeout=30.0,
            )
            response.raise_for_status()
            insights_data = response.json()

            print(f"✓ Generated {insights_data['insights_generated']} insights")
            print(f"  - High priority: {insights_data['high_priority']}")
            print(f"  - Medium priority: {insights_data['medium_priority']}")
            print(f"  - Low priority: {insights_data['low_priority']}")

            # Display some insights
            if insights_data.get('sample_insights'):
                print("\n" + "="*60)
                print("SAMPLE INSIGHTS GENERATED")
                print("="*60)

                for idx, insight in enumerate(insights_data['sample_insights'][:5], 1):
                    print(f"\n{idx}. [{insight['priority'].upper()}] {insight['title']}")
                    print(f"   Agent: {insight['agent_id']}")
                    print(f"   Type: {insight['insight_type']}")
                    print(f"   Description: {insight['description'][:100]}...")
                    print(f"   Action: {insight['recommended_action'][:100]}...")

            # Get full insights list
            print("\n3. Fetching all insights...")
            response = await client.get(
                "http://localhost:8000/api/ai/learning/insights",
                timeout=10.0,
            )
            response.raise_for_status()
            all_insights = response.json()

            print(f"✓ Total insights available: {all_insights['total']}")

            # Count by priority
            priority_counts = {"high": 0, "medium": 0, "low": 0}
            for insight in all_insights['insights']:
                priority_counts[insight['priority']] += 1

            print(f"  - High: {priority_counts['high']}")
            print(f"  - Medium: {priority_counts['medium']}")
            print(f"  - Low: {priority_counts['low']}")

        except Exception as e:
            print(f"✗ Error: {e}")
            raise


async def main():
    """Main execution flow."""

    print("\n" + "="*60)
    print("LEARNING ENGINE TEST - FAILURE SCENARIOS")
    print("="*60)
    print("This will generate realistic agent failures and test")
    print("the learning engine's ability to detect patterns and")
    print("generate actionable insights.")
    print("="*60)

    try:
        # Generate test data
        total = await generate_failure_scenarios()

        # Extract patterns and generate insights
        await extract_and_generate_insights()

        print("\n" + "="*60)
        print("✓ TEST COMPLETE")
        print("="*60)
        print(f"Generated {total} executions with realistic failures")
        print("\nNext steps:")
        print("1. Visit http://localhost:3000/agents to see insights")
        print("2. Check high/medium priority insights for actionable recommendations")
        print("3. Verify failure patterns are detected correctly")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
