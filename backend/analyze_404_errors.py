import json
from collections import Counter

with open('tests/load/reports/load_test_full_20260127_100548.json') as f:
    data = json.load(f)

scenarios = data.get('scenarios', [])
errors_404 = [s for s in scenarios if s.get('status_code') == 404]

print(f'Total 404 errors: {len(errors_404)}')
print('\nBreakdown by scenario type:')

# Extract scenario type (everything before the last underscore and number)
names = [s['scenario_name'].rsplit('_', 1)[0] for s in errors_404]
counter = Counter(names)

for name, count in counter.most_common(20):
    print(f'  {name}: {count}')

# Show a few examples
print(f'\nFirst 5 examples:')
for s in errors_404[:5]:
    print(f"  - {s['scenario_name']}: {s.get('status_code')}")
