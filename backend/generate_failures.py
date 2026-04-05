"""
Standalone script to generate realistic failure scenarios.

This script connects to the running backend and injects test execution data
directly into the metrics collector via HTTP requests to the pattern extraction endpoint.

Since the metrics collector is in-memory in the backend process, we can't access it directly.
Instead, we'll generate synthetic execution data by making API calls.
"""

import asyncio
import httpx


async def generate_and_extract():
    """Generate failure data by triggering pattern extraction multiple times."""

    print("\n" + "="*70)
    print("FAILURE SCENARIO GENERATION")
    print("="*70)
    print("\nThis will use the existing execution data and extract patterns.")
    print("The learning engine will identify failure patterns from real agent health checks.")
    print("="*70 + "\n")

    async with httpx.AsyncClient() as client:
        # Step 1: Extract patterns with lower thresholds to catch more patterns
        print("Step 1: Extracting patterns with inclusive thresholds...")
        try:
            response = await client.post(
                "http://localhost:8000/api/ai/learning/extract-patterns",
                params={
                    "lookback_hours": 48,  # Look back 2 days
                    "min_observations": 2,  # Lower threshold
                },
                timeout=30.0,
            )
            response.raise_for_status()
            patterns = response.json()

            print(f"\n   [OK] Extracted {len(patterns['patterns'])} patterns:")
            for p in patterns['patterns']:
                print(f"      - {p['agent_id']}: {p['task_category']} ")
                print(f"        Success: {p['success_rate']*100:.0f}%, Observations: {p['observed_count']}")

        except Exception as e:
            print(f"\n   [ERROR] Pattern extraction failed: {e}")
            return

        # Step 2: Generate insights with lower confidence threshold
        print("\nStep 2: Generating insights...")
        try:
            response = await client.post(
                "http://localhost:8000/api/ai/learning/generate-insights",
                params={"min_confidence": 0.3},  # Lower threshold for testing
                timeout=30.0,
            )
            response.raise_for_status()
            result = response.json()

            print(f"\n   [OK] Generated {len(result['insights'])} insights")

        except Exception as e:
            print(f"\n   [ERROR] Insight generation failed: {e}")
            return

        # Step 3: Fetch and display all insights
        print("\nStep 3: Fetching all insights...")
        try:
            response = await client.get(
                "http://localhost:8000/api/ai/learning/insights",
                timeout=10.0,
            )
            response.raise_for_status()
            all_insights = response.json()

            # Count by priority
            priority_counts = {"high": 0, "medium": 0, "low": 0}
            by_type = {"prompt_improvement": 0, "process_optimization": 0, "error_prevention": 0}

            for insight in all_insights['insights']:
                priority_counts[insight['priority']] += 1
                by_type[insight['insight_type']] += 1

            print(f"\n   [OK] Total insights: {all_insights['total']}")
            print(f"\n   By Priority:")
            print(f"      - High:   {priority_counts['high']} (Critical issues requiring immediate attention)")
            print(f"      - Medium: {priority_counts['medium']} (Important optimizations)")
            print(f"      - Low:    {priority_counts['low']} (General improvements)")

            print(f"\n   By Type:")
            print(f"      - Prompt Improvement:    {by_type['prompt_improvement']}")
            print(f"      - Process Optimization:  {by_type['process_optimization']}")
            print(f"      - Error Prevention:      {by_type['error_prevention']}")

            # Show sample insights
            if all_insights['insights']:
                print(f"\n   Sample Insights:")
                for idx, insight in enumerate(all_insights['insights'][:3], 1):
                    print(f"\n   {idx}. [{insight['priority'].upper()}] {insight['title']}")
                    print(f"      Agent: {insight['agent_id']}")
                    print(f"      Type: {insight['insight_type']}")
                    print(f"      Improvement: {insight['expected_improvement']}%")
                    print(f"      Action: {insight['recommended_action'][:80]}...")

        except Exception as e:
            print(f"\n   [ERROR] Failed to fetch insights: {e}")
            return

        # Final summary
        print("\n" + "="*70)
        print("SUMMARY")
        print("="*70)
        print(f"\nInsights generated: {all_insights['total']}")
        print(f"  High priority:   {priority_counts['high']}")
        print(f"  Medium priority: {priority_counts['medium']}")
        print(f"  Low priority:    {priority_counts['low']}")

        print(f"\nView dashboard at: http://localhost:3000/agents")
        print(f"\nNote: Current insights are based on health check data (100% success).")
        print(f"To generate HIGH/MEDIUM priority insights, we need actual task failures.")
        print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(generate_and_extract())
