#!/usr/bin/env python
"""
Quick Load Test - Phase 9 Verification

Runs a faster version of the load test with higher concurrency:
- 500 scenarios per module (2,000 total)
- Higher concurrency (20 concurrent requests)
- Expected runtime: ~15-20 minutes

This tests the same failure patterns as the full test but completes much faster.
"""
import asyncio
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.load.conftest import ScenarioRunner
from tests.load.generators.customers import CustomerScenarioGenerator
from tests.load.generators.orders import OrderScenarioGenerator
from tests.load.generators.products import ProductScenarioGenerator
from tests.load.generators.quotes import QuoteScenarioGenerator
from tests.load.reporters.html_reporter import generate_html_report


class QuickLoadTest:
    """Quick load test for Phase 9 verification."""

    def __init__(self, base_url: str, max_concurrent: int = 20):
        self.base_url = base_url
        self.max_concurrent = max_concurrent
        self.runner = ScenarioRunner(base_url, max_concurrent)
        self.start_time = None

    async def run_phase(self, phase_name: str, generator, count: int) -> dict:
        """Run a single phase of testing."""
        print(f"\n{'='*80}")
        print(f"PHASE: {phase_name}")
        print(f"{'='*80}")
        print(f"Generating {count} scenarios...")

        scenarios = generator.generate_scenarios(count=count)
        print(f"Generated {len(scenarios)} scenarios")
        print(f"Running with max_concurrent={self.max_concurrent}...")

        phase_start = datetime.now()
        results = await self.runner.run_scenarios(scenarios)
        phase_end = datetime.now()
        phase_duration = (phase_end - phase_start).total_seconds()

        summary = self.runner.get_summary()
        summary['phase_name'] = phase_name
        summary['phase_duration_seconds'] = phase_duration
        summary['scenarios_per_second'] = count / phase_duration if phase_duration > 0 else 0

        # Print phase summary
        print("\nPhase Complete:")
        print(f"  Duration: {phase_duration:.1f}s ({count/phase_duration:.1f} scenarios/sec)")
        print(f"  Passed: {summary['passed']}/{summary['total']}")
        print(f"  Pass Rate: {summary['pass_rate']:.1f}%")
        print(f"  Avg Response Time: {summary['avg_response_time_ms']:.0f}ms")
        print(f"  P95 Response Time: {summary['p95_response_time_ms']:.0f}ms")

        if summary['failed'] > 0:
            print(f"  Failures: {summary['failed']}")
            if summary.get('failure_types'):
                for ftype, count in summary['failure_types'].items():
                    print(f"    {ftype}: {count}")

        return {
            'summary': summary,
            'results': results
        }

    async def run_quick_suite(self):
        """Execute quick load test suite."""
        self.start_time = datetime.now()
        print("\n" + "="*80)
        print("QUICK LOAD TEST - PHASE 9 VERIFICATION")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("Configuration:")
        print(f"  Base URL: {self.base_url}")
        print(f"  Max Concurrent: {self.max_concurrent}")
        print("  Total Scenarios: 2,000 (500 per module)")
        print("  Estimated Runtime: 15-20 minutes")
        print("="*80)

        all_results = []
        all_summaries = []

        # Phase 1: Products (500 scenarios)
        print("\n\n[1/4] PRODUCT SCENARIOS")
        product_gen = ProductScenarioGenerator(base_url=self.base_url)
        phase1 = await self.run_phase("Products", product_gen, 500)
        all_results.extend(phase1['results'])
        all_summaries.append(phase1['summary'])

        # Phase 2: Customers (500 scenarios)
        print("\n\n[2/4] CUSTOMER SCENARIOS")
        customer_gen = CustomerScenarioGenerator(base_url=self.base_url)
        phase2 = await self.run_phase("Customers", customer_gen, 500)
        all_results.extend(phase2['results'])
        all_summaries.append(phase2['summary'])

        # Phase 3: Orders (500 scenarios)
        print("\n\n[3/4] ORDER SCENARIOS")
        order_gen = OrderScenarioGenerator(base_url=self.base_url)
        phase3 = await self.run_phase("Orders", order_gen, 500)
        all_results.extend(phase3['results'])
        all_summaries.append(phase3['summary'])

        # Phase 4: Quotes (500 scenarios)
        print("\n\n[4/4] QUOTE SCENARIOS")
        quote_gen = QuoteScenarioGenerator(base_url=self.base_url)
        phase4 = await self.run_phase("Quotes", quote_gen, 500)
        all_results.extend(phase4['results'])
        all_summaries.append(phase4['summary'])

        # Calculate overall statistics
        end_time = datetime.now()
        total_duration = (end_time - self.start_time).total_seconds()

        overall_summary = self._calculate_overall_summary(
            all_results, all_summaries, total_duration
        )

        # Generate reports
        await self._generate_reports(overall_summary, all_results)

        # Print final summary
        self._print_final_summary(overall_summary)

        return overall_summary

    def _calculate_overall_summary(self, all_results, phase_summaries, duration):
        """Calculate overall statistics across all phases."""
        total_scenarios = len(all_results)
        passed = sum(1 for r in all_results if r.success)
        failed = total_scenarios - passed

        response_times = [r.response_time_ms for r in all_results]
        response_times.sort()

        n = len(response_times)
        p50 = response_times[n // 2] if n > 0 else 0
        p95 = response_times[int(n * 0.95)] if n > 0 else 0
        p99 = response_times[int(n * 0.99)] if n > 0 else 0

        # Group failures by status code
        failures_by_status = defaultdict(int)
        failures_by_scenario_type = defaultdict(int)

        for r in all_results:
            if not r.success:
                if r.status_code:
                    failures_by_status[r.status_code] += 1
                scenario_type = r.scenario_name.split('_')[0]
                failures_by_scenario_type[scenario_type] += 1

        return {
            'test_suite': 'Quick Load Test - Phase 9',
            'start_time': self.start_time.isoformat(),
            'end_time': datetime.now().isoformat(),
            'total_duration_seconds': duration,
            'total_scenarios': total_scenarios,
            'passed': passed,
            'failed': failed,
            'pass_rate': (passed / total_scenarios * 100) if total_scenarios > 0 else 0,
            'scenarios_per_second': total_scenarios / duration if duration > 0 else 0,
            'avg_response_time_ms': sum(response_times) / n if n > 0 else 0,
            'p50_response_time_ms': p50,
            'p95_response_time_ms': p95,
            'p99_response_time_ms': p99,
            'min_response_time_ms': min(response_times) if response_times else 0,
            'max_response_time_ms': max(response_times) if response_times else 0,
            'failures_by_status': dict(failures_by_status),
            'failures_by_scenario_type': dict(failures_by_scenario_type),
            'phase_summaries': phase_summaries,
        }

    async def _generate_reports(self, summary, results):
        """Generate HTML and JSON reports."""
        print("\n" + "="*80)
        print("GENERATING REPORTS")
        print("="*80)

        reports_dir = Path(__file__).parent / 'reports'
        reports_dir.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Generate JSON report
        json_path = reports_dir / f'load_test_quick_{timestamp}.json'
        with open(json_path, 'w') as f:
            json.dump({
                'summary': summary,
                'results': [
                    {
                        'scenario_name': r.scenario_name,
                        'success': r.success,
                        'response_time_ms': r.response_time_ms,
                        'status_code': r.status_code,
                        'error_message': r.error_message,
                        'error_type': r.error_type,
                    }
                    for r in results
                ]
            }, f, indent=2)
        print(f"JSON Report: {json_path}")

        # Generate HTML report
        html_path = reports_dir / f'load_test_quick_{timestamp}.html'
        generate_html_report(summary, results, str(html_path))
        print(f"HTML Report: {html_path}")

        # Also save as latest
        latest_json = reports_dir / 'load_test_quick_latest.json'
        latest_html = reports_dir / 'load_test_quick_latest.html'

        with open(latest_json, 'w') as f:
            json.dump({'summary': summary}, f, indent=2)

        generate_html_report(summary, results, str(latest_html))

        print(f"Latest JSON: {latest_json}")
        print(f"Latest HTML: {latest_html}")

    def _print_final_summary(self, summary):
        """Print final summary statistics."""
        print("\n" + "="*80)
        print("FINAL SUMMARY - QUICK LOAD TEST")
        print("="*80)
        print(f"Start Time: {summary['start_time']}")
        print(f"End Time: {summary['end_time']}")
        print(f"Total Duration: {summary['total_duration_seconds']:.1f}s ({summary['total_duration_seconds']/60:.1f} minutes)")
        print("\nScenarios:")
        print(f"  Total: {summary['total_scenarios']}")
        print(f"  Passed: {summary['passed']} ({summary['pass_rate']:.1f}%)")
        print(f"  Failed: {summary['failed']}")
        print(f"  Throughput: {summary['scenarios_per_second']:.2f} scenarios/sec")
        print("\nResponse Times:")
        print(f"  Average: {summary['avg_response_time_ms']:.0f}ms")
        print(f"  P50: {summary['p50_response_time_ms']:.0f}ms")
        print(f"  P95: {summary['p95_response_time_ms']:.0f}ms")
        print(f"  P99: {summary['p99_response_time_ms']:.0f}ms")
        print(f"  Min: {summary['min_response_time_ms']:.0f}ms")
        print(f"  Max: {summary['max_response_time_ms']:.0f}ms")

        if summary['failures_by_status']:
            print("\nFailures by Status Code:")
            for status, count in sorted(summary['failures_by_status'].items()):
                print(f"  {status}: {count}")

        if summary['failures_by_scenario_type']:
            print("\nFailures by Scenario Type:")
            for stype, count in sorted(summary['failures_by_scenario_type'].items()):
                print(f"  {stype}: {count}")

        print("\nPhase Breakdown:")
        for phase_summary in summary['phase_summaries']:
            print(f"  {phase_summary['phase_name']}:")
            print(f"    Pass Rate: {phase_summary['pass_rate']:.1f}%")
            print(f"    Passed/Total: {phase_summary['passed']}/{phase_summary['total']}")
            print(f"    Avg Response: {phase_summary['avg_response_time_ms']:.0f}ms")
            print(f"    Duration: {phase_summary['phase_duration_seconds']:.1f}s")

        print("="*80)

        # Success criteria
        if summary['pass_rate'] >= 95.0:
            print(f"\n[SUCCESS] Pass rate {summary['pass_rate']:.1f}% meets target 95%+")
        elif summary['pass_rate'] >= 90.0:
            print(f"\n[GOOD] Pass rate {summary['pass_rate']:.1f}% is good (90%+)")
        else:
            print(f"\n[WARNING] Pass rate {summary['pass_rate']:.1f}% below 90%")


async def main():
    """Main entry point for quick load test."""
    base_url = "http://localhost:8001"
    max_concurrent = 20  # Higher concurrency for faster test

    test = QuickLoadTest(base_url, max_concurrent)

    try:
        summary = await test.run_quick_suite()

        # Save to docs
        docs_dir = Path(__file__).parent.parent.parent.parent.parent / 'docs'
        summary_path = docs_dir / 'PHASE-9-QUICK-TEST-RESULTS.json'
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)

        print(f"\nSummary saved to: {summary_path}")

        return summary

    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Test interrupted by user")
        return None
    except Exception as e:
        print(f"\n\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result and result['pass_rate'] >= 90.0 else 1)
