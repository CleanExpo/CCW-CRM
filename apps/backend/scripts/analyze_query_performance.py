"""
Analyze database query performance patterns.

Identifies:
1. N+1 query patterns
2. Missing eager loading (joinedload/selectinload)
3. Queries in loops
4. Caching opportunities
5. Unoptimized relationship loading
"""
import re
from pathlib import Path
from typing import List, Dict, Tuple

backend_path = Path(__file__).parent.parent
routes_path = backend_path / "src" / "api" / "routes"

print("=" * 80)
print("ISS-017: DATABASE QUERY PERFORMANCE ANALYSIS")
print("=" * 80)

# Patterns to detect
patterns = {
    "n+1_in_loop": re.compile(r'for .+ in .+:\s+.*db\.execute|for .+ in .+:.*\n.*db\.execute', re.MULTILINE),
    "missing_joinedload": re.compile(r'select\(.+\)\.where.*(?!joinedload|selectinload)'),
    "scalar_many": re.compile(r'\.scalars\(\)\.all\(\)'),
    "relationship_access": re.compile(r'\w+\.\w+_id|\w+\.customer|\w+\.product|\w+\.order'),
    "no_eager_loading": re.compile(r'select\([A-Z]\w+\)(?!.*options\()'),
    "repeated_queries": re.compile(r'await db\.execute\('),
}

issues_found = []

def analyze_file(file_path: Path) -> List[Dict]:
    """Analyze a Python file for query performance issues."""
    issues = []

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    # Check for N+1 patterns in loops
    for i, line in enumerate(lines, 1):
        # Pattern 1: Query inside for loop
        if 'for ' in line and ' in ' in line:
            # Check next 10 lines for db.execute
            for j in range(i, min(i + 10, len(lines))):
                if 'db.execute' in lines[j] and 'await' in lines[j]:
                    issues.append({
                        'file': file_path.name,
                        'line': i,
                        'type': 'N+1_QUERY_IN_LOOP',
                        'severity': 'HIGH',
                        'description': f'Database query inside loop at line {i}',
                        'code': line.strip()
                    })
                    break

        # Pattern 2: Missing eager loading on relationships
        if 'select(' in line and 'joinedload' not in content[max(0, content.find(line)-200):content.find(line)+200]:
            if any(model in line for model in ['Order', 'Quote', 'Customer', 'Product']):
                # Check if this query accesses relationships later
                query_start = i
                for j in range(i, min(i + 50, len(lines))):
                    if any(rel in lines[j] for rel in ['.items', '.customer', '.product', '.order']):
                        issues.append({
                            'file': file_path.name,
                            'line': i,
                            'type': 'MISSING_EAGER_LOADING',
                            'severity': 'MEDIUM',
                            'description': f'Query at line {i} may need eager loading for relationships',
                            'code': line.strip()
                        })
                        break

        # Pattern 3: Multiple queries for same data
        if 'await db.execute' in line:
            query_pattern = re.search(r'select\((\w+)\)', line)
            if query_pattern:
                model = query_pattern.group(1)
                # Check for repeated queries of same model within 20 lines
                for j in range(max(0, i-10), min(i+10, len(lines))):
                    if j != i and f'select({model})' in lines[j]:
                        issues.append({
                            'file': file_path.name,
                            'line': i,
                            'type': 'REPEATED_QUERY',
                            'severity': 'LOW',
                            'description': f'Similar query to line {j+1} - consider combining',
                            'code': line.strip()
                        })
                        break

    return issues

def analyze_specific_endpoints():
    """Analyze known problematic endpoints."""
    specific_issues = []

    # Dashboard endpoint analysis
    dashboard_file = routes_path / "demo_dashboard.py"
    if dashboard_file.exists():
        with open(dashboard_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Count SELECT statements
        select_count = content.count('await db.execute')
        if select_count > 5:
            specific_issues.append({
                'file': 'demo_dashboard.py',
                'type': 'MULTIPLE_QUERIES',
                'severity': 'HIGH',
                'description': f'Dashboard has {select_count} separate queries - should be combined',
                'recommendation': 'Create aggregated endpoint with single query'
            })

    # List endpoints analysis
    for endpoint_file in ['demo_lists.py', 'orders.py', 'quotes.py']:
        file_path = routes_path / endpoint_file
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check for pagination without eager loading
            if 'limit(page_size)' in content and 'joinedload' not in content:
                specific_issues.append({
                    'file': endpoint_file,
                    'type': 'PAGINATION_WITHOUT_EAGER_LOADING',
                    'severity': 'MEDIUM',
                    'description': 'Paginated queries without eager loading can cause N+1',
                    'recommendation': 'Add joinedload/selectinload for relationships'
                })

            # Check for stock/inventory queries in loops
            if 'stock' in content.lower() and 'for ' in content:
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if 'for ' in line and 'stock' in line.lower():
                        specific_issues.append({
                            'file': endpoint_file,
                            'line': i + 1,
                            'type': 'STOCK_QUERY_IN_LOOP',
                            'severity': 'HIGH',
                            'description': 'Stock queries in loop - should batch load',
                            'recommendation': 'Use single query with IN clause'
                        })
                        break

    return specific_issues

# Analyze all route files
print("\n[STEP 1] Scanning API routes for query patterns...")
all_issues = []

if routes_path.exists():
    for py_file in routes_path.glob("*.py"):
        if py_file.name.startswith('__'):
            continue
        issues = analyze_file(py_file)
        all_issues.extend(issues)

print(f"[INFO] Analyzed {len(list(routes_path.glob('*.py')))} route files")

# Analyze specific known problematic areas
print("\n[STEP 2] Analyzing specific endpoints...")
specific_issues = analyze_specific_endpoints()
all_issues.extend(specific_issues)

# Categorize issues
high_priority = [i for i in all_issues if i.get('severity') == 'HIGH']
medium_priority = [i for i in all_issues if i.get('severity') == 'MEDIUM']
low_priority = [i for i in all_issues if i.get('severity') == 'LOW']

# Report findings
print("\n" + "=" * 80)
print("ANALYSIS RESULTS")
print("=" * 80)

print(f"\n[SUMMARY]")
print(f"  Total issues found: {len(all_issues)}")
print(f"  High priority: {len(high_priority)}")
print(f"  Medium priority: {len(medium_priority)}")
print(f"  Low priority: {len(low_priority)}")

if high_priority:
    print(f"\n[HIGH PRIORITY ISSUES] ({len(high_priority)})")
    for issue in high_priority[:10]:  # Show first 10
        print(f"\n  File: {issue['file']}")
        if 'line' in issue:
            print(f"  Line: {issue['line']}")
        print(f"  Type: {issue['type']}")
        print(f"  Description: {issue['description']}")
        if 'code' in issue:
            print(f"  Code: {issue['code']}")
        if 'recommendation' in issue:
            print(f"  Fix: {issue['recommendation']}")

if medium_priority:
    print(f"\n[MEDIUM PRIORITY ISSUES] ({len(medium_priority)})")
    for issue in medium_priority[:5]:  # Show first 5
        print(f"\n  File: {issue['file']}")
        if 'line' in issue:
            print(f"  Line: {issue['line']}")
        print(f"  Type: {issue['type']}")
        print(f"  Description: {issue['description']}")
        if 'recommendation' in issue:
            print(f"  Fix: {issue['recommendation']}")

# Recommendations
print("\n" + "=" * 80)
print("OPTIMIZATION RECOMMENDATIONS")
print("=" * 80)

print("\n[PRIORITY 1] Fix N+1 Queries")
print("  - Add eager loading with joinedload() or selectinload()")
print("  - Batch load related entities with IN queries")
print("  - Example: .options(joinedload(Order.items).joinedload(OrderItem.product))")

print("\n[PRIORITY 2] Combine Dashboard Queries")
print("  - Create single aggregated query for dashboard metrics")
print("  - Use PostgreSQL CTEs or subqueries")
print("  - Reduce 6+ queries to 1-2 queries")

print("\n[PRIORITY 3] Implement Caching")
print("  - Cache frequently accessed data (products, categories)")
print("  - Use Redis for session-level caching")
print("  - TTL: 5 minutes for dynamic data, 1 hour for static")

print("\n[PRIORITY 4] Add Query Result Pagination Optimization")
print("  - Use keyset pagination for large datasets")
print("  - Add cursor-based pagination option")
print("  - Preload total counts asynchronously")

print("\n" + "=" * 80)
print("NEXT STEPS")
print("=" * 80)
print("\n1. Review high-priority issues above")
print("2. Run EXPLAIN ANALYZE on slow endpoints")
print("3. Implement eager loading fixes")
print("4. Add Redis caching layer")
print("5. Measure performance improvements")
print("=" * 80)
