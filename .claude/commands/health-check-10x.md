# Health Check 10x — Full System Integrity Verification

Run all 10 checks sequentially. Any failure = STOP + fix before continuing.
Document results in docs/HEALTH-CHECK-[sprint]-[date].md

## Check 1: Route Registration

Verify all .py files in apps/backend/src/api/routes/ are registered in main.py.

```bash
# Read main.py and cross-reference all route files
python -c "
import os, re
route_files = []
for root, dirs, files in os.walk('apps/backend/src/api/routes'):
    for f in files:
        if f.endswith('.py') and f != '__init__.py':
            route_files.append(f.replace('.py',''))
print('Route files:', len(route_files), route_files[:5])
"
```

**Pass**: 0 unregistered route files

## Check 2: Page Routing

Verify all dashboard pages are reachable (have page.tsx).

```bash
find apps/web/app/\(dashboard\) -name "page.tsx" | wc -l
```

**Pass**: All pages have page.tsx, no broken routes

## Check 3: Nav Coverage

Cross-reference sidebar.tsx nav items vs actual page files.
Read apps/web/components/layout/sidebar.tsx and compare nav links to pages.
**Pass**: 0 nav links pointing to non-existent pages

## Check 4: API Client Map

Cross-reference apps/web/lib/api/\*.ts files vs backend routes.
**Pass**: Every major backend domain has a corresponding API client file

## Check 5: TypeScript

```bash
cd apps/web && pnpm type-check 2>&1 | tail -5
```

**Pass**: 0 TypeScript errors

## Check 6: DB Model Coverage

Verify route files reference proper model classes (not raw SQL).
Read demo_models.py + cin7_models.py and spot-check routes.
**Pass**: No routes using raw SQL without model reference

## Check 7: Package Declaration

Spot-check key imports in route files vs apps/backend/pyproject.toml.
**Pass**: No obviously undeclared package imports

## Check 8: Agent Registry

Check apps/backend/src/ai/agents/specialized/ files vs any registry.
**Pass**: All agent files are importable (no missing dependencies)

## Check 9: Test Suite

```bash
cd apps/backend && python -m pytest tests/ -x -q 2>&1 | tail -10
```

**Pass**: 0 test failures

## Check 10: Catalog Freshness

Read each catalog in docs/catalogs/ and check "Last Verified" date.
**Pass**: No catalogs older than 7 days

## Results Template

After running, document as:

```
# Health Check Results — [Sprint] — [Date]
| Check | Status | Notes |
|-------|--------|-------|
| 1. Route Registration | ✅/❌ | [notes] |
| 2. Page Routing | ✅/❌ | [notes] |
...
```
