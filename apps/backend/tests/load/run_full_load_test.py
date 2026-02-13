#!/usr/bin/env python
"""
Full Load Test Suite - Phase 9

Executes 10,000+ scenarios across all endpoints to establish performance baselines.

Configuration:
- 2,000 product scenarios
- 2,000 customer scenarios
- 2,000 order scenarios
- 2,000 quote scenarios
- Edge cases and stress tests

Expected runtime: 2-3 hours
"""
import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.load.conftest import ScenarioRunner
from tests.load.generators.products import ProductScenarioGenerator
from tests.load.generators.customers import CustomerScenarioGenerator
from tests.load.generators.orders import OrderScenarioGenerator
from tests.load.generators.quotes import QuoteScenarioGenerator
from tests.load.reporters.html_reporter import generate_html_report


class LoadTestOrchestrator:
    """Orchestrates full load test execution with progress tracking."""

    def __init__(self, base_url: str, max_concurrent: int = 2):
        self.base_url = base_url
        self.max_concurrent = max_concurrent
        self.runner = ScenarioRunner(base_url, max_concurrent)
        self.start_time = None
        self.results_by_phase = {}

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
        print(f"\nPhase Complete:")
        print(f"  Duration: {phase_duration:.1f}s ({count/phase_duration:.1f} scenarios/sec)")
        print(f"  Pass Rate: {summary['pass_rate']:.1f}%")
        print(f"  Avg Response Time: {summary['avg_response_time_ms']:.0f}ms")
        print(f"  P95 Response Time: {summary['p95_response_time_ms']:.0f}ms")

        return {
            'summary': summary,
            'results': results
        }

    async def run_full_suite(self):
        """Execute complete load test suite."""
        self.start_time = datetime.now()
        print("\n" + "="*80)
        print("FULL LOAD TEST SUITE - PHASE 9")
        print("="*80)
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Configuration:")
        print(f"  Base URL: {self.base_url}")
        print(f"  Max Concurrent: {self.max_concurrent}")
        print(f"  Total Scenarios: 8,000+")
        print(f"  Estimated Runtime: 2-3 hours")
        print("="*80)

        all_results = []
        all_summaries = []

        # Phase 1: Products (2000 scenarios)
        print("\n\n[1/4] PRODUCT SCENARIOS")
        product_gen = ProductScenarioGenerator(base_url=self.base_url)
        phase1 = await self.run_phase("Products", product_gen, 2000)
        self.results_by_phase['products'] = phase1
        all_results.extend(phase1['results'])
        all_summaries.append(phase1['summary'])

        # Phase 2: Customers (2000 scenarios)
        print("\n\n[2/4] CUSTOMER SCENARIOS")
        customer_gen = CustomerScenarioGenerator(base_url=self.base_url)
        phase2 = await self.run_phase("Customers", customer_gen, 2000)
        self.results_by_phase['customers'] = phase2
        all_results.extend(phase2['results'])
        all_summaries.append(phase2['summary'])

        # Phase 3: Orders (2000 scenarios)
        print("\n\n[3/4] ORDER SCENARIOS")
        order_gen = OrderScenarioGenerator(base_url=self.base_url)
        phase3 = await self.run_phase("Orders", order_gen, 2000)
        self.results_by_phase['orders'] = phase3
        all_results.extend(phase3['results'])
        all_summaries.append(phase3['summary'])

        # Phase 4: Quotes (2000 scenarios)
        print("\n\n[4/4] QUOTE SCENARIOS")
        quote_gen = QuoteScenarioGenerator(base_url=self.base_url)
        phase4 = await self.run_phase("Quotes", quote_gen, 2000)
        self.results_by_phase['quotes'] = phase4
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

        # Group failures by type
        failures_by_status = defaultdict(int)
        failures_by_scenario_type = defaultdict(int)

        for r in all_results:
            if not r.success:
                if r.status_code:
                    failures_by_status[r.status_code] += 1
                scenario_type = r.scenario_name.split('_')[0]
                failures_by_scenario_type[scenario_type] += 1

        return {
            'test_suite': 'Full Load Test - Phase 9',
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

        # Create reports directory
        reports_dir = Path(__file__).parent / 'reports'
        reports_dir.mkdir(exist_ok=True)

        # Generate timestamp for filenames
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Generate JSON report
        json_path = reports_dir / f'load_test_full_{timestamp}.json'
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
        html_path = reports_dir / f'load_test_full_{timestamp}.html'
        generate_html_report(summary, results, str(html_path))
        print(f"HTML Report: {html_path}")

        # Also save latest version
        latest_json = reports_dir / 'load_test_latest.json'
        latest_html = reports_dir / 'load_test_latest.html'

        with open(latest_json, 'w') as f:
            json.dump({'summary': summary}, f, indent=2)

        generate_html_report(summary, results, str(latest_html))

        print(f"Latest JSON: {latest_json}")
        print(f"Latest HTML: {latest_html}")

    def _print_final_summary(self, summary):
        """Print final summary statistics."""
        print("\n" + "="*80)
        print("FINAL SUMMARY - FULL LOAD TEST SUITE")
        print("="*80)
        print(f"Start Time: {summary['start_time']}")
        print(f"End Time: {summary['end_time']}")
        print(f"Total Duration: {summary['total_duration_seconds']:.1f}s ({summary['total_duration_seconds']/3600:.2f} hours)")
        print(f"\nScenarios:")
        print(f"  Total: {summary['total_scenarios']}")
        print(f"  Passed: {summary['passed']} ({summary['pass_rate']:.1f}%)")
        print(f"  Failed: {summary['failed']}")
        print(f"  Throughput: {summary['scenarios_per_second']:.2f} scenarios/sec")
        print(f"\nResponse Times:")
        print(f"  Average: {summary['avg_response_time_ms']:.0f}ms")
        print(f"  P50: {summary['p50_response_time_ms']:.0f}ms")
        print(f"  P95: {summary['p95_response_time_ms']:.0f}ms")
        print(f"  P99: {summary['p99_response_time_ms']:.0f}ms")
        print(f"  Min: {summary['min_response_time_ms']:.0f}ms")
        print(f"  Max: {summary['max_response_time_ms']:.0f}ms")

        if summary['failures_by_status']:
            print(f"\nFailures by Status Code:")
            for status, count in sorted(summary['failures_by_status'].items()):
                print(f"  {status}: {count}")

        if summary['failures_by_scenario_type']:
            print(f"\nFailures by Scenario Type:")
            for stype, count in sorted(summary['failures_by_scenario_type'].items()):
                print(f"  {stype}: {count}")

        print(f"\nPhase Breakdown:")
        for phase_summary in summary['phase_summaries']:
            print(f"  {phase_summary['phase_name']}:")
            print(f"    Pass Rate: {phase_summary['pass_rate']:.1f}%")
            print(f"    Avg Response: {phase_summary['avg_response_time_ms']:.0f}ms")
            print(f"    Duration: {phase_summary['phase_duration_seconds']:.1f}s")

        print("="*80)

        # Success criteria check
        target_pass_rate = 80.0
        if summary['pass_rate'] >= target_pass_rate:
            print(f"\n[SUCCESS] Pass rate {summary['pass_rate']:.1f}% meets target {target_pass_rate}%")
        else:
            print(f"\n[WARNING] Pass rate {summary['pass_rate']:.1f}% below target {target_pass_rate}%")


async def main():
    """Main entry point for full load test."""
    base_url = "http://localhost:8000"  # Local backend
    max_concurrent = 2  # Conservative concurrency for stability

    orchestrator = LoadTestOrchestrator(base_url, max_concurrent)

    try:
        summary = await orchestrator.run_full_suite()

        # Save summary to docs
        docs_dir = Path(__file__).parent.parent.parent.parent.parent / 'docs'
        summary_path = docs_dir / 'PHASE-9-LOAD-TEST-RESULTS.json'
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)

        print(f"\nSummary saved to: {summary_path}")

        return summary

    except KeyboardInterrupt:
        print("\n\n[INTERRUPTED] Load test interrupted by user")
        print("Partial results may be available in reports directory")
        return None
    except Exception as e:
        print(f"\n\n[ERROR] Load test failed: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result and result['pass_rate'] >= 80.0 else 1)
