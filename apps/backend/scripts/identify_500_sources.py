"""
Script to identify potential sources of 500 errors in the codebase.

Searches for patterns that commonly cause unhandled exceptions:
1. scalar_one() without error handling (raises if not found)
2. Missing null checks
3. Database operations without try-except
"""
import re
from pathlib import Path

backend_path = Path(__file__).parent.parent
routes_path = backend_path / "src" / "api" / "routes"

print("=" * 80)
print("ISS-005: Identifying Sources of 500 Errors")
print("=" * 80)

# Pattern 1: scalar_one() usage
print("\n[PATTERN 1] Searching for scalar_one() usage...")
scalar_one_files = []

for py_file in routes_path.glob("*.py"):
    with open(py_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for i, line in enumerate(lines, 1):
            if '.scalar_one()' in line and 'func.count()' not in lines[max(0, i-3):i]:
                # Exclude count queries which are safe
                if 'count_query' not in ''.join(lines[max(0, i-5):i]):
                    scalar_one_files.append((py_file.name, i, line.strip()))

print(f"Found {len(scalar_one_files)} potential scalar_one() issues:")
for filename, lineno, line in scalar_one_files:
    print(f"  - {filename}:{lineno}: {line[:80]}")

# Pattern 2: Check for missing 404 handling in GET/PUT/DELETE endpoints
print("\n[PATTERN 2] Checking endpoints for proper error handling...")
missing_404_files = []

for py_file in routes_path.glob("*.py"):
    with open(py_file, 'r', encoding='utf-8') as f:
        content = f.read()

        # Find all endpoint definitions
        endpoints = re.finditer(r'@router\.(get|put|delete|patch)\("\/\{[^}]+\}', content)
        for match in endpoints:
            # Get the next 30 lines after the endpoint decorator
            start_pos = match.end()
            next_content = content[start_pos:start_pos+2000]

            # Check if there's a 404 check
            if 'HTTPException' not in next_content or 'status_code=404' not in next_content:
                if '.scalar_one_or_none()' not in next_content:
                    # Might be missing 404 handling
                    line_no = content[:match.start()].count('\n') + 1
                    missing_404_files.append((py_file.name, line_no, match.group()))

if missing_404_files:
    print(f"Found {len(missing_404_files)} endpoints possibly missing 404 handling:")
    for filename, lineno, endpoint in missing_404_files[:10]:  # Limit output
        print(f"  - {filename}:{lineno}: {endpoint[:60]}")
else:
    print("No obvious missing 404 handlers found")

# Pattern 3: Unprotected database operations
print("\n[PATTERN 3] Checking for unprotected database operations...")
unprotected_ops = []

for py_file in routes_path.glob("*.py"):
    with open(py_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        in_try_block = False
        try_depth = 0

        for i, line in enumerate(lines, 1):
            # Track try-except blocks
            if 'try:' in line:
                in_try_block = True
                try_depth += 1
            elif 'except' in line and try_depth > 0:
                in_try_block = True
            elif line.strip() and not line.strip().startswith('#'):
                # Check indentation to see if we're still in try block
                if in_try_block and line[0] not in ' \t':
                    in_try_block = False
                    try_depth = 0

            # Look for database operations outside try blocks
            if not in_try_block:
                if 'await db.execute' in line or 'await db.commit' in line:
                    # Check if it's in an async function
                    func_context = ''.join(lines[max(0, i-20):i])
                    if 'async def' in func_context and '@router.' in func_context:
                        unprotected_ops.append((py_file.name, i, line.strip()))

if unprotected_ops:
    print(f"Found {len(unprotected_ops)} potentially unprotected DB operations:")
    for filename, lineno, line in unprotected_ops[:15]:
        print(f"  - {filename}:{lineno}: {line[:80]}")
else:
    print("All DB operations appear to be protected")

# Summary
print("\n" + "=" * 80)
print("ANALYSIS SUMMARY")
print("=" * 80)
print("\nTotal issues found:")
print(f"  - scalar_one() without error handling: {len(scalar_one_files)}")
print(f"  - Endpoints missing 404 handling: {len(missing_404_files)}")
print(f"  - Unprotected DB operations: {len(unprotected_ops)}")
print("\nPriority fixes:")
print("  1. Fix scalar_one() in stock reservation (orders.py:144)")
print("  2. Add proper error handling to all scalar_one() calls")
print("  3. Add try-except blocks around DB operations")
print("  4. Validate all GET/PUT/DELETE endpoints have 404 handling")
print("=" * 80)
