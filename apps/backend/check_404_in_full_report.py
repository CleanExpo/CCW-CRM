import json

with open('tests/load/reports/load_test_full_20260127_100548.json') as f:
    data = json.load(f)

# Check what fields exist
print("Top-level keys:", list(data.keys())[:10])

# Look for error breakdown
if 'error_breakdown' in data:
    print("\nError breakdown:")
    print(json.dumps(data['error_breakdown'], indent=2))

# Check if there's a scenarios field
if 'scenarios' in data:
    scenarios = data['scenarios']
    print(f"\nTotal scenarios: {len(scenarios)}")
    errors_404 = [s for s in scenarios if s.get('status_code') == 404]
    print(f"404 errors: {len(errors_404)}")
    if errors_404:
        print("First 3 examples:")
        for s in errors_404[:3]:
            print(f"  {s}")
else:
    print("\nNo 'scenarios' field in data")

