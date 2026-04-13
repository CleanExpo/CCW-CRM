"""
Simple script to inject test data with failures via HTTP requests.

Since we can't access the metrics collector directly from outside the process,
this script makes HTTP requests to record test executions.
"""

import asyncio

import httpx


async def inject_test_failures():
    """Inject test data with realistic failure scenarios."""

    # Since the metrics collector is in-memory in the backend process,
    # we'll use the pattern extraction and insight generation on real data
    # that already exists (health checks), but let's first check what endpoints
    # are available

    async with httpx.AsyncClient() as client:
        print("\n" + "="*60)
        print("EXTRACTING PATTERNS FROM EXISTING DATA")
        print("="*60)

        # Extract patterns
        print("\n1. Extracting patterns...")
        response = await client.post(
            "http://localhost:8000/api/ai/learning/extract-patterns",
            params={"lookback_hours": 25, "min_observations": 2},
            timeout=30.0,
        )
        response.raise_for_status()
        patterns = response.json()

        print(f"   Found {len(patterns['patterns'])} patterns")
        for p in patterns['patterns']:
            print(f"   - {p['agent_id']}: {p['task_category']} ({p['pattern_type']}, {p['success_rate']*100:.0f}% success)")

        # Generate insights
        print("\n2. Generating insights...")
        response = await client.post(
            "http://localhost:8000/api/ai/learning/generate-insights",
            params={"min_confidence": 0.5},
            timeout=30.0,
        )
        response.raise_for_status()
        result = response.json()

        print(f"   Generated {len(result['insights'])} insights")

        # Get all insights
        print("\n3. Fetching all insights...")
        response = await client.get(
            "http://localhost:8000/api/ai/learning/insights",
            timeout=10.0,
        )
        response.raise_for_status()
        all_insights = response.json()

        print(f"   Total insights: {all_insights['total']}")

        # Count by priority
        priority_counts = {"high": 0, "medium": 0, "low": 0}
        for insight in all_insights['insights']:
            priority_counts[insight['priority']] += 1

        print(f"   - High: {priority_counts['high']}")
        print(f"   - Medium: {priority_counts['medium']}")
        print(f"   - Low: {priority_counts['low']}")

        print("\n" + "="*60)
        print("RESULTS")
        print("="*60)
        print(f"\nDashboard should now show {all_insights['total']} insights")
        print("\nVisit: http://localhost:3000/agents")
        print("\nNote: To test with actual failures, we would need to:")
        print("  1. Create real agent task executions that fail")
        print("  2. Or inject data directly into the metrics collector")
        print("  3. Current insights are based on health check data")
        print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(inject_test_failures())
