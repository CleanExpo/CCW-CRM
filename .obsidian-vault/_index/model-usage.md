# Model Usage Analysis

Find all routes using a specific model (example: Product model).

## Query by Model

Replace `MODEL-015-product` with any model ID to find usage.

```dataview
TABLE file.link AS "Route", endpoints, domain
FROM "routes"
WHERE contains(file.outlinks, "[[MODEL-015-product]]")
SORT domain ASC
```

## Common Models to Check

**Product** (`MODEL-015-product`):

- Used by: Inventory, Orders, Quotes, POS

**Customer** (`MODEL-004-customer`):

- Used by: CRM, Orders, Quotes, Invoices

**Order** (`MODEL-005-order`):

- Used by: Orders, POS, Invoices, Workflow

**Invoice** (`MODEL-XXX-invoice`):

- Used by: Invoicing, Financial, Xero Integration

## Why This Matters

Before modifying a model:

1. Run this query to see all routes using it
2. Check impact on each route
3. Update tests for affected routes
4. Consider migration plan if schema change needed

**Schema Locked Models** (demo_models.py):

- Require explicit approval + migration
- Check `schema_locked: true` in frontmatter
- DO NOT MODIFY without approval
