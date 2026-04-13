import json
from collections import Counter

with open('tests/load/reports/load_test_full_20260127_100548.json') as f:
    data = json.load(f)

results = data.get('results', [])
errors_422 = [r for r in results if r.get('status_code') == 422]

print(f"Total 422 errors: {len(errors_422)}")

if errors_422:
    # Breakdown by scenario
    names = [r['scenario_name'].rsplit('_', 1)[0] for r in errors_422]
    counter = Counter(names)

    print("\nBreakdown by scenario type:")
    for name, count in counter.most_common(20):
        print(f"  {name}: {count}")

    print("\nFirst 10 examples:")
    for r in errors_422[:10]:
        print(f"  - {r['scenario_name']}: {r.get('status_code')}")
        if 'data' in r and r['data']:
            print(f"    Response: {r['data']}")

