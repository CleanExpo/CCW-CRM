"""Quick script to verify Phase 1 fixes - check if JSONDecodeError is eliminated."""

import asyncio
import sys

sys.path.insert(0, 'C:\\CCW-Online ERP\\apps\\backend')

from tests.load.conftest import ScenarioRunner
from tests.load.generators.customers import CustomerScenarioGenerator
from tests.load.generators.products import ProductScenarioGenerator


async def main():
    """Run quick test to verify Phase 1 fixes."""
    print("\n" + "=" * 80)
    print("PHASE 1 VERIFICATION - Checking if JSONDecodeError is eliminated")
    print("=" * 80)

    runner = ScenarioRunner(base_url="http://localhost:8000")
    scenarios = []

    # Generate small set of scenarios
    product_gen = ProductScenarioGenerator(base_url="http://localhost:8000")
    scenarios.extend(product_gen.generate_scenarios(count=20))

    customer_gen = CustomerScenarioGenerator(base_url="http://localhost:8000")
    scenarios.extend(customer_gen.generate_scenarios(count=20))

    print(f"\nRunning {len(scenarios)} scenarios...\n")

    results = await runner.run_scenarios(scenarios)
    summary = runner.get_summary()

    # Print results
    print("\nRESULTS:")
    print(f"   Total: {summary['total']}")
    print(f"   Passed: {summary['passed']} ({summary['pass_rate']:.1f}%)")
    print(f"   Failed: {summary['failed']}")
    print(f"   Avg Response Time: {summary['avg_response_time_ms']:.0f}ms")

    # Print failure types
    print("\nFAILURE BREAKDOWN:")
    if summary['failure_types']:
        for error_type, count in sorted(summary['failure_types'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {error_type}: {count}")
    else:
        print("   No failures!")

    # Check if JSONDecodeError exists
    json_decode_errors = summary['failure_types'].get('JSONDecodeError', 0)

    print("\n" + "=" * 80)
    if json_decode_errors == 0:
        print("SUCCESS: JSONDecodeError has been ELIMINATED!")
        print("   Phase 1 exception handlers are working correctly.")
    else:
        print(f"ISSUE: Still seeing {json_decode_errors} JSONDecodeError failures")
        print("   Phase 1 fixes may not be fully effective.")
    print("=" * 80)

    return json_decode_errors == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
