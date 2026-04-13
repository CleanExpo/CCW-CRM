import json
from collections import Counter

with open('tests/load/reports/load_test_full_20260127_100548.json') as f:
    data = json.load(f)

results = data.get('results', [])
print(f"Total results: {len(results)}")

# Find 404 errors
errors_404 = [r for r in results if r.get('status_code') == 404]
print(f"404 errors: {len(errors_404)}")

if errors_404:
    # Breakdown by scenario
    names = [r['scenario_name'].rsplit('_', 1)[0] for r in errors_404]
    counter = Counter(names)

    print("\nBreakdown by scenario type:")
    for name, count in counter.most_common(20):
        print(f"  {name}: {count}")

    print("\nFirst 5 examples:")
    for r in errors_404[:5]:
        print(f"  - {r['scenario_name']}")

