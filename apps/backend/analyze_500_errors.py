import json
from collections import Counter

with open('tests/load/reports/load_test_full_20260127_100548.json') as f:
    data = json.load(f)

results = data.get('results', [])
errors_500 = [r for r in results if r.get('status_code') == 500]

print(f"Total 500 errors: {len(errors_500)}")

if errors_500:
    # Breakdown by scenario
    names = [r['scenario_name'].rsplit('_', 1)[0] for r in errors_500]
    counter = Counter(names)

    print("\nBreakdown by scenario type:")
    for name, count in counter.most_common(20):
        print(f"  {name}: {count}")

    print("\nFirst 10 examples with error details:")
    for r in errors_500[:10]:
        print(f"\n  Scenario: {r['scenario_name']}")
        print(f"  Status: {r.get('status_code')}")
        if 'data' in r and r['data']:
            print(f"  Response: {r['data']}")
        if 'request' in r and r['request']:
            print(f"  Request: {r['request']}")
