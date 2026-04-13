"""
JSON Reporter for Load Testing Results

Generates a machine-readable JSON report with all scenario results.
"""

import json
from datetime import datetime
from typing import Any, Dict, List


def generate_json_report(summary: Dict[str, Any], results: List[Any], output_path: str):
    """
    Generate JSON report from scenario results.

    Args:
        summary: Summary statistics from ScenarioRunner.get_summary()
        results: List of ScenarioResult objects
        output_path: Path to save JSON file
    """
    # Convert results to dictionaries
    results_data = []
    for r in results:
        results_data.append({
            'scenario_name': r.scenario_name,
            'success': r.success,
            'response_time_ms': r.response_time_ms,
            'status_code': r.status_code,
            'error_message': r.error_message,
            'error_type': r.error_type,
            'timestamp': r.timestamp.isoformat() if r.timestamp else None,
        })

    # Build report structure
    report = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'total_scenarios': len(results),
        },
        'summary': summary,
        'results': results_data,
    }

    # Write to file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n📊 JSON report generated: {output_path}")
