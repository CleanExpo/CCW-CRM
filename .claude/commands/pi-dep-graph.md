# /pi-dep-graph — Build Text Dependency Graph

Generates a text-based dependency graph from catalogs showing how components relate.

## Steps

1. Read all 6 catalog files in docs/catalogs/
2. Build relationships: Route → Model → Agent → Page → API Client
3. Output ASCII dependency graph
4. Identify circular dependencies or deep chains

## Output Format

```
## Route Dependencies
ROUTE-001 (GET /api/products)
  └─ MODEL-003 (Product)
  └─ AGENT-001 (Inventory Agent: forecast skill)
  └─ PAGE-012 (Products list page)
      └─ PKG-005 (apps/web/lib/api/products.ts)

## Cross-Domain Dependencies
[INT-001] Cin7 Integration
  └─ ROUTE-020..035 (Cin7 sync routes)
  └─ MODEL-045..055 (Cin7 mapping models)
```

## Usage

/pi-dep-graph
(Reads from catalogs — no codebase scan needed)
