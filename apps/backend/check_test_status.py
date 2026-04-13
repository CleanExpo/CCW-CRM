"""Quick diagnostic script to check test failures."""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from tests.load.conftest import ScenarioRunner
from tests.load.generators.customers import CustomerScenarioGenerator
from tests.load.generators.orders import OrderScenarioGenerator
from tests.load.generators.products import ProductScenarioGenerator
from tests.load.generators.quotes import QuoteScenarioGenerator


async def main():
    base_url = "http://127.0.0.1:8000"
    runner = ScenarioRunner(base_url=base_url, max_concurrent=10)

    scenarios = []

    # Generate 10 scenarios from each category for quick check
    product_gen = ProductScenarioGenerator(base_url=base_url)
    scenarios.extend(product_gen.generate_scenarios(count=10))

    customer_gen = CustomerScenarioGenerator(base_url=base_url)
    scenarios.extend(customer_gen.generate_scenarios(count=10))

    order_gen = OrderScenarioGenerator(base_url=base_url)
    scenarios.extend(order_gen.generate_scenarios(count=10))

    quote_gen = QuoteScenarioGenerator(base_url=base_url)
    scenarios.extend(quote_gen.generate_scenarios(count=10))

    print(f"\nRunning {len(scenarios)} scenarios...")
    results = await runner.run_scenarios(scenarios)
    summary = runner.get_summary()

    print(f"\n{'='*80}")
    print("RESULTS SUMMARY")
    print(f"{'='*80}")
    print(f"Total: {summary['total']}")
    print(f"Passed: {summary['passed']} ({summary['pass_rate']:.1f}%)")
    print(f"Failed: {summary['failed']}")
    print(f"Avg Response Time: {summary['avg_response_time_ms']:.0f}ms")
    print(f"\n{'='*80}")
    print("FAILURE TYPES")
    print(f"{'='*80}")
    for error_type, count in summary['failure_types'].items():
        print(f"  {error_type}: {count}")

    print(f"\n{'='*80}")
    print("SLOWEST SCENARIOS")
    print(f"{'='*80}")
    for name, time_ms in summary['slowest_scenarios'][:5]:
        print(f"  {name}: {time_ms:.0f}ms")

    print(f"\n{'='*80}")
    print("FAILED SCENARIOS")
    print(f"{'='*80}")
    failed = [r for r in results if not r.success]
    for result in failed[:10]:  # Show first 10 failures
        print(f"\n  {result.scenario_name}")
        print(f"    Error: {result.error_type}")
        print(f"    Details: {result.error_message[:200] if result.error_message else 'None'}")

if __name__ == "__main__":
    asyncio.run(main())
