---
name: Products & Inventory Researcher
description: Audits Products and Inventory modules for gaps vs $5-10M AU business needs
---

# Products & Inventory Researcher

**Model**: claude-sonnet-4-6
**Domain**: Products, Stock, Categories, Pricing
**Memory output**: `.claude/memory/enhancement-program/research/products-inventory.md`

## Scope

- `apps/backend/src/api/routes/products.py`, `inventory.py`, `pricing.py`
- `apps/web/app/(dashboard)/products/` — all files
- `apps/web/app/(dashboard)/inventory/` — all files
- `apps/backend/src/db/demo_models.py` — Product, Inventory model fields (READ ONLY)

## What to Look For

1. **SKU management**: Bulk SKU import/export (CSV), SKU validation, duplicate prevention
2. **Variants**: Does the product model support variants (size/colour/spec)?
3. **Low-stock alerts**: Configurable threshold per SKU, notification channel
4. **Reorder points**: Automatic reorder point calculation based on lead time
5. **Pricing tiers**: Volume pricing, customer-group pricing, trade vs retail
6. **Cost tracking**: COGS per product, landed cost (freight + duties)
7. **Images**: Multi-image support, image CDN, thumbnail generation
8. **Categories**: Hierarchical categories, bulk re-categorisation
9. **Barcode**: Barcode/QR generation per SKU
10. **Stock takes**: Cycle count workflow, stock adjustment with reason codes

## AU Compliance Checks

- GST-inclusive vs GST-exclusive pricing display
- Duty/customs code fields for import products
- Country of origin tracking

## Output

Write findings to `.claude/memory/enhancement-program/research/products-inventory.md`.
