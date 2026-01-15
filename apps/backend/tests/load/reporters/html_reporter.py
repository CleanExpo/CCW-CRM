"""
HTML Reporter for Load Testing Results

Generates a comprehensive HTML report with:
- Executive summary
- Failure details
- Performance metrics
- Security concerns
- Concurrency issues
"""

from typing import List, Dict, Any
from datetime import datetime


def generate_html_report(summary: Dict[str, Any], results: List[Any], output_path: str):
    """
    Generate HTML report from scenario results.

    Args:
        summary: Summary statistics from ScenarioRunner.get_summary()
        results: List of ScenarioResult objects
        output_path: Path to save HTML file
    """
    # Group failures by type
    failures = [r for r in results if not r.success]
    failures_by_type = {}
    for failure in failures:
        error_type = failure.error_type or "Unknown"
        if error_type not in failures_by_type:
            failures_by_type[error_type] = []
        failures_by_type[error_type].append(failure)

    # Identify critical failures (P0)
    critical_failures = [
        f for f in failures
        if any(keyword in (f.error_message or "").lower()
               for keyword in ['race', 'deadlock', 'integrity', 'corruption', 'negative stock'])
    ]

    # Identify security issues
    security_issues = [
        f for f in failures
        if any(keyword in (f.error_message or "").lower()
               for keyword in ['injection', 'xss', 'authentication', 'authorization'])
    ]

    # Identify performance issues
    slow_scenarios = [r for r in results if r.response_time_ms > 1000]

    # Generate HTML
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>10,000 Scenario Test Report - CCW ERP</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            background: #000000;
            color: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            padding: 2rem;
            line-height: 1.6;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ font-size: 2.5rem; font-weight: 600; margin-bottom: 1rem; color: #fafafa; }}
        h2 {{ font-size: 1.8rem; font-weight: 600; margin: 2rem 0 1rem; color: #fafafa; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }}
        h3 {{ font-size: 1.3rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: #fafafa; }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }}
        .metric {{
            background: #111111;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 1.5rem;
        }}
        .metric-value {{
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }}
        .metric-label {{ font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }}
        .pass {{ color: #4ade80; }}
        .fail {{ color: #f87171; }}
        .warning {{ color: #fbbf24; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
            background: #111111;
            border: 1px solid #333;
            border-radius: 8px;
            overflow: hidden;
        }}
        th {{
            background: #1a1a1a;
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid #333;
        }}
        td {{
            padding: 0.8rem 1rem;
            border-bottom: 1px solid #222;
        }}
        tr:last-child td {{ border-bottom: none; }}
        tr:hover {{ background: #0a0a0a; }}
        .badge {{
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
        }}
        .badge-critical {{ background: #7f1d1d; color: #fca5a5; }}
        .badge-high {{ background: #7c2d12; color: #fdba74; }}
        .badge-medium {{ background: #713f12; color: #fde047; }}
        .badge-low {{ background: #14532d; color: #86efac; }}
        .code {{
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
            padding: 0.2rem 0.5rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }}
        .timestamp {{ color: #666; font-size: 0.9rem; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 10,000 Scenario Test Report</h1>
        <p class="timestamp">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

        <section class="summary">
            <div class="metric">
                <div class="metric-value">{summary.get('total', 0):,}</div>
                <div class="metric-label">Total Scenarios</div>
            </div>
            <div class="metric">
                <div class="metric-value pass">{summary.get('passed', 0):,} ({summary.get('pass_rate', 0):.1f}%)</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value fail">{summary.get('failed', 0):,} ({100 - summary.get('pass_rate', 0):.1f}%)</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value warning">{summary.get('avg_response_time_ms', 0):.0f}ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric">
                <div class="metric-value">{summary.get('p95_response_time_ms', 0):.0f}ms</div>
                <div class="metric-label">P95 Response Time</div>
            </div>
            <div class="metric">
                <div class="metric-value">{summary.get('max_response_time_ms', 0):.0f}ms</div>
                <div class="metric-label">Max Response Time</div>
            </div>
        </section>

        <h2>🚨 Critical Failures ({len(critical_failures)})</h2>
        {_generate_failure_table(critical_failures, 'critical') if critical_failures else '<p>No critical failures detected.</p>'}

        <h2>❌ All Failures by Type</h2>
        {_generate_failures_by_type_section(failures_by_type) if failures_by_type else '<p>No failures detected.</p>'}

        <h2>🐌 Performance Issues</h2>
        <p>Scenarios with response time > 1000ms</p>
        {_generate_slow_scenarios_table(slow_scenarios[:20]) if slow_scenarios else '<p>No performance issues detected.</p>'}

        <h2>🔒 Security Concerns</h2>
        {_generate_failure_table(security_issues, 'security') if security_issues else '<p>No security issues detected.</p>'}

        <h2>📊 Top 10 Slowest Scenarios</h2>
        {_generate_top_slowest_table(summary.get('slowest_scenarios', [])[:10])}

        <h2>✅ Success Criteria</h2>
        <table>
            <tr>
                <th>Criteria</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Status</th>
            </tr>
            <tr>
                <td>Pass Rate</td>
                <td>≥ 90%</td>
                <td>{summary.get('pass_rate', 0):.1f}%</td>
                <td class="{'pass' if summary.get('pass_rate', 0) >= 90 else 'fail'}">
                    {'✓ PASS' if summary.get('pass_rate', 0) >= 90 else '✗ FAIL'}
                </td>
            </tr>
            <tr>
                <td>Average Response Time</td>
                <td>≤ 500ms</td>
                <td>{summary.get('avg_response_time_ms', 0):.0f}ms</td>
                <td class="{'pass' if summary.get('avg_response_time_ms', 0) <= 500 else 'warning'}">
                    {'✓ PASS' if summary.get('avg_response_time_ms', 0) <= 500 else '⚠ WARNING'}
                </td>
            </tr>
            <tr>
                <td>P95 Response Time</td>
                <td>≤ 1000ms</td>
                <td>{summary.get('p95_response_time_ms', 0):.0f}ms</td>
                <td class="{'pass' if summary.get('p95_response_time_ms', 0) <= 1000 else 'warning'}">
                    {'✓ PASS' if summary.get('p95_response_time_ms', 0) <= 1000 else '⚠ WARNING'}
                </td>
            </tr>
            <tr>
                <td>Critical Failures</td>
                <td>0</td>
                <td>{len(critical_failures)}</td>
                <td class="{'pass' if len(critical_failures) == 0 else 'fail'}">
                    {'✓ PASS' if len(critical_failures) == 0 else '✗ FAIL'}
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
"""

    # Write to file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"\n📄 HTML report generated: {output_path}")


def _generate_failure_table(failures: List[Any], table_type: str = 'general') -> str:
    """Generate HTML table for failures."""
    if not failures:
        return '<p>No failures.</p>'

    rows = []
    for failure in failures[:50]:  # Limit to 50
        severity = 'critical' if table_type == 'critical' else 'high' if table_type == 'security' else 'medium'
        rows.append(f"""
            <tr>
                <td><span class="badge badge-{severity}">{severity.upper()}</span></td>
                <td><code class="code">{failure.scenario_name}</code></td>
                <td>{failure.error_type or 'Unknown'}</td>
                <td>{(failure.error_message or '')[:200]}...</td>
                <td>{failure.response_time_ms:.0f}ms</td>
            </tr>
        """)

    return f"""
        <table>
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>Scenario</th>
                    <th>Error Type</th>
                    <th>Error Message</th>
                    <th>Response Time</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
        {f'<p><em>Showing 50 of {len(failures)} failures</em></p>' if len(failures) > 50 else ''}
    """


def _generate_failures_by_type_section(failures_by_type: Dict[str, List[Any]]) -> str:
    """Generate HTML section for failures grouped by type."""
    sections = []
    for error_type, failures in sorted(failures_by_type.items(), key=lambda x: len(x[1]), reverse=True):
        sections.append(f"""
            <h3>{error_type} ({len(failures)})</h3>
            <ul>
                {''.join([f'<li><code class="code">{f.scenario_name}</code>: {(f.error_message or "")[:100]}</li>' for f in failures[:10]])}
            </ul>
            {f'<p><em>...and {len(failures) - 10} more</em></p>' if len(failures) > 10 else ''}
        """)
    return ''.join(sections)


def _generate_slow_scenarios_table(slow_scenarios: List[Any]) -> str:
    """Generate HTML table for slow scenarios."""
    rows = []
    for scenario in slow_scenarios:
        rows.append(f"""
            <tr>
                <td><code class="code">{scenario.scenario_name}</code></td>
                <td class="warning">{scenario.response_time_ms:.0f}ms</td>
                <td>{scenario.status_code or 'N/A'}</td>
            </tr>
        """)

    return f"""
        <table>
            <thead>
                <tr>
                    <th>Scenario</th>
                    <th>Response Time</th>
                    <th>Status Code</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
    """


def _generate_top_slowest_table(slowest: List[tuple]) -> str:
    """Generate HTML table for top slowest scenarios."""
    rows = []
    for i, (name, time_ms) in enumerate(slowest, 1):
        rows.append(f"""
            <tr>
                <td>{i}</td>
                <td><code class="code">{name}</code></td>
                <td class="warning">{time_ms:.0f}ms</td>
            </tr>
        """)

    return f"""
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Scenario</th>
                    <th>Response Time</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
    """
