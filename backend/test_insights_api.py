"""Test script to directly call insights API logic."""

import asyncio
from src.ai.learning.learning_repository import LearningRepository


async def main():
    """Test loading insights from database."""
    print("\n" + "="*70)
    print("TESTING INSIGHTS API LOGIC")
    print("="*70 + "\n")

    # Test the repository directly
    repository = LearningRepository(db_session=None)

    print("Loading ALL insights from database...")
    all_insights = await repository.load_insights()
    print(f"[OK] Total insights: {len(all_insights)}")

    print("\nLoading HIGH priority insights...")
    high_insights = await repository.load_insights(priority='high')
    print(f"[OK] HIGH priority: {len(high_insights)}")
    for insight in high_insights:
        print(f"    - {insight['title']}")

    print("\nLoading MEDIUM priority insights...")
    medium_insights = await repository.load_insights(priority='medium')
    print(f"[OK] MEDIUM priority: {len(medium_insights)}")
    for insight in medium_insights:
        print(f"    - {insight['title']}")

    print("\nLoading LOW priority insights...")
    low_insights = await repository.load_insights(priority='low')
    print(f"[OK] LOW priority: {len(low_insights)}")

    print("\n" + "="*70)
    print("RESULT: Database insights are accessible")
    print("="*70 + "\n")

    # Now test what the API would return
    print("Simulating API response for priority=high:")
    response = {"insights": high_insights, "total": len(high_insights)}
    print(f"  insights count: {response['total']}")
    print(f"  first insight: {response['insights'][0]['title'] if response['insights'] else 'None'}")


if __name__ == "__main__":
    asyncio.run(main())
