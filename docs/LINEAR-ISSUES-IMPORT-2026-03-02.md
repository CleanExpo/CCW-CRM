# Linear Issues - Import Template (2026-03-02)

Copy and paste each issue below into Linear (CCW workspace / ERP Deployment project, prefix: UNI-).

**Generated**: 2026-03-02
**Purpose**: Capture remaining/new backlog items identified in PM audit after overnight session
**Author**: Claude Code - PM Status Review

---

## ISSUE A: [HOUSEKEEPING] Add Reports, Marketing, FAQ to sidebar navigation

**Status**: To Do
**Priority**: Medium 🟡
**Labels**: frontend, housekeeping
**Team**: CCW / ERP Deployment
**Estimate**: 30 minutes

### Problem

Three pages exist and are fully functional but are not accessible from the sidebar navigation:

- `/reports` — KPI Reports page (Sales + Inventory dashboards)
- `/marketing` — Marketing page
- `/faq` — FAQ page with FAQPage JSON-LD schema

### Acceptance Criteria

- [ ] Add `{ name: "Reports", href: "/reports", icon: BarChart3 }` to sidebar nav
- [ ] Add `{ name: "Marketing", href: "/marketing", icon: Megaphone }` to sidebar nav
- [ ] Add `{ name: "FAQ", href: "/faq", icon: HelpCircle }` to sidebar nav
- [ ] Import `Megaphone` and `HelpCircle` from lucide-react (BarChart3 already imported)
- [ ] Insert after the "Insights" entry
- [ ] No TypeScript errors: `pnpm turbo run type-check --filter=web`
- [ ] All three pages are navigable via sidebar links

### Technical Details

**File to modify**: `apps/web/components/layout/sidebar.tsx`

**Imports to add**:

```typescript
import {
  // ... existing imports ...
  Megaphone,
  HelpCircle,
} from 'lucide-react';
```

**Navigation entries to add** (after "Insights"):

```typescript
{ name: "Reports", href: "/reports", icon: BarChart3 },
{ name: "Marketing", href: "/marketing", icon: Megaphone },
{ name: "FAQ", href: "/faq", icon: HelpCircle },
```

---

## ISSUE B: [DB] Add composite indexes: order_items, orders, products

**Status**: To Do
**Priority**: High 🟠
**Labels**: backend, performance, database
**Team**: CCW / ERP Deployment
**Estimate**: 2 hours

### Problem

Critical composite indexes are missing from production database. These affect:

- Line item query performance (`order_items` JOIN on `order_id` + `product_id`)
- Customer order history filtering (`orders` filtered by `customer_id` + `status`)
- Category browse performance (`products` filtered by `category` + `is_active`)

### Indexes Required

| Table         | Columns                  | Type   | Reason                           |
| ------------- | ------------------------ | ------ | -------------------------------- |
| `order_items` | `(order_id, product_id)` | B-tree | Critical for line item queries   |
| `orders`      | `(customer_id, status)`  | B-tree | Customer order history filtering |
| `products`    | `(category, is_active)`  | B-tree | Category browse performance      |

### Implementation Approach

Create a new file `apps/backend/src/db/indexes.py` using SQLAlchemy `Index()`. This avoids modifying `demo_models.py` (locked file).

**New file**: `apps/backend/src/db/indexes.py`

```python
from sqlalchemy import Index
from src.db.demo_models import OrderItem, Order, Product

# Composite index: order_items(order_id, product_id)
ix_order_items_order_product = Index(
    "ix_order_items_order_product",
    OrderItem.order_id,
    OrderItem.product_id,
)

# Composite index: orders(customer_id, status)
ix_orders_customer_status = Index(
    "ix_orders_customer_status",
    Order.customer_id,
    Order.status,
)

# Composite index: products(category, is_active)
ix_products_category_active = Index(
    "ix_products_category_active",
    Product.category,
    Product.is_active,
)
```

Then import in `apps/backend/src/api/main.py` (or via Alembic migration) to register indexes.

### Acceptance Criteria

- [ ] Create `apps/backend/src/db/indexes.py` with all 3 composite indexes
- [ ] Indexes are created in database (via migration or startup)
- [ ] `demo_models.py` is NOT modified
- [ ] Run `EXPLAIN ANALYZE` on targeted queries to confirm index usage
- [ ] Backend tests still pass: `cd apps/backend && uv run pytest`

### Notes

- DO NOT modify `apps/backend/src/db/demo_models.py` (locked file)
- Alembic migration preferred over startup-time creation for production safety
- Consider adding trigram indexes (pg_trgm) for search fields in a follow-up (see Issue #6 in LINEAR-ISSUES-IMPORT.md)

---

## ISSUE C: [FRONTEND] Product detail page /products/[id] with ProductSchema JSON-LD

**Status**: To Do
**Priority**: Medium 🟡
**Labels**: frontend, seo
**Team**: CCW / ERP Deployment
**Estimate**: 3-4 hours

### Problem

There is no product detail page at `/products/[id]`. The products list page exists but clicking a product has no destination. The `ProductSchema` SEO component (`apps/web/components/seo/JsonLd.tsx`) is ready but unused.

### Acceptance Criteria

- [ ] Create `apps/web/app/(dashboard)/products/[id]/page.tsx`
- [ ] Page fetches product data from `GET /api/products/{id}`
- [ ] Display: name, SKU, category, price, cost, stock, description
- [ ] Inject `ProductSchema` JSON-LD for SEO (component already exists)
- [ ] Add loading skeleton state
- [ ] Add "Edit" button linking to edit flow
- [ ] Add "Back to Products" navigation
- [ ] No TypeScript errors
- [ ] Responsive layout using existing Tailwind/shadcn patterns

### Technical Details

**New file**: `apps/web/app/(dashboard)/products/[id]/page.tsx`

**ProductSchema component**: `apps/web/components/seo/JsonLd.tsx` (already built, needs props: name, sku, price, description, image?)

**API call**: `GET /api/products/{id}` — verify endpoint exists in `apps/backend/src/api/routes/demo_lists.py`

**Pattern to follow**: Existing page patterns in `apps/web/app/(dashboard)/`

### Notes

- Use `params: { id: string }` for the dynamic route
- Check if `GET /api/products/{id}` endpoint exists; if not, create it first
- ProductSchema JSON-LD helps search engines index individual product pages

---

## ISSUE D: [FEATURE] PDF export for Orders, Quotes, Customers via browser print

**Status**: To Do
**Priority**: Low 🟢
**Labels**: frontend, feature
**Team**: CCW / ERP Deployment
**Estimate**: 3-4 hours

### Problem

CSV export exists on all 4 modules (Products, Customers, Orders, Quotes) via `apps/web/lib/utils/csv-export.ts`. However, PDF export is not implemented. Users need printable PDFs for Orders and Quotes especially (customer-facing documents).

### Proposed Approach

Browser print-based PDF using `window.print()` with `@media print` CSS. No additional dependencies required.

**Alternative**: Add `exportToPDF()` function to `apps/web/lib/utils/csv-export.ts` that opens a print-formatted window.

### Acceptance Criteria

- [ ] Add `exportToPDF()` function in `apps/web/lib/utils/csv-export.ts` (or new `pdf-export.ts`)
- [ ] PDF export available on: Orders list/detail, Quotes list/detail
- [ ] Print layout hides sidebar, nav, and action buttons
- [ ] Includes: company header, document number, date, line items, totals
- [ ] `@media print` CSS styles the output cleanly
- [ ] "Export PDF" button added next to existing "Export CSV" button on Orders + Quotes pages
- [ ] No new npm dependencies (use `window.print()` approach)

### Technical Details

**Function signature** (to add in csv-export.ts or new file):

```typescript
export function exportToPDF(
  data: Record<string, unknown>[],
  title: string,
  filename: string
): void {
  // Open print window with formatted HTML
  const printWindow = window.open('', '_blank');
  // ... generate HTML, trigger window.print()
}
```

**Pages to add "Export PDF" button**:

- `apps/web/app/(dashboard)/orders/page.tsx`
- `apps/web/app/(dashboard)/quotes/page.tsx`

---

## ISSUE E: [AI] AI-powered product search with pgvector semantic embeddings

**Status**: Backlog
**Priority**: Low 🟢
**Labels**: ai, backend, database
**Team**: CCW / ERP Deployment
**Estimate**: 8-12 hours

### Description

Implement semantic product search using pgvector extension in PostgreSQL. Allows users to search for products using natural language (e.g., "power tools for concrete work") rather than exact keyword matching.

### High-Level Approach

1. Enable `pgvector` extension in Supabase
2. Add `embedding vector(1536)` column to `products` table (requires migration)
3. Generate embeddings for product names + descriptions via OpenAI `text-embedding-3-small`
4. Create HNSW index for fast approximate nearest-neighbour search
5. New API endpoint: `POST /api/products/search/semantic` accepts query string, returns ranked products
6. Frontend: Add semantic search toggle to Products page search bar

### Acceptance Criteria

- [ ] pgvector enabled in Supabase
- [ ] Products table has `embedding vector(1536)` column (migration required — needs approval)
- [ ] Embedding generation script for existing products
- [ ] Embedding auto-generated on product create/update
- [ ] `POST /api/products/search/semantic` endpoint working
- [ ] Frontend search bar supports semantic mode
- [ ] Semantic search returns relevant results for natural-language queries
- [ ] Response time <2s for semantic queries

### Notes

- **Requires schema change**: Explicit approval needed before starting (modifies products table)
- Supabase has native pgvector support — no additional infrastructure
- Consider `text-embedding-3-small` (cost-efficient) over `ada-002`

---

## ISSUE F: [INTEGRATION] Enhanced Shopify: metafields + real-time inventory sync

**Status**: Backlog
**Priority**: Low 🟢
**Labels**: integration, shopify
**Team**: CCW / ERP Deployment
**Estimate**: 6-8 hours
**Blocked By**: Shopify authentication fix (see LINEAR-ISSUES-IMPORT.md Issue #8)

### Description

Extend the existing Shopify integration (basic sync in place) with:

1. **Metafields sync**: Custom product attributes (warranty, weight, dimensions, certifications) stored in Shopify metafields and synced to ERP
2. **Real-time inventory sync**: When ERP stock changes → instantly update Shopify inventory levels via API (not just webhooks)

### Acceptance Criteria

- [ ] Shopify authentication working (Issue #8 prerequisite)
- [ ] Metafields: ERP product attributes mapped to Shopify metafields namespace `ccw`
- [ ] Metafields sync on product create/update
- [ ] Real-time inventory: `POST /api/integrations/shopify/inventory/sync/{sku}` endpoint
- [ ] Inventory sync called after stock mutations in ERP
- [ ] Sync success/failure logged to `Cin7SyncLog` pattern (reuse existing log model)
- [ ] Integration tests for metafields sync and inventory push

### Technical Details

**Files to create/modify**:

- `apps/backend/src/integrations/shopify/metafields_sync.py` (new)
- `apps/backend/src/integrations/shopify/inventory_sync.py` (new)
- `apps/backend/src/api/routes/integrations/shopify_sync.py` (new endpoints)

**Shopify Metafields API**:

```
PUT /admin/api/2024-01/products/{product_id}/metafields.json
```

**Shopify Inventory API**:

```
POST /admin/api/2024-01/inventory_levels/set.json
{ "location_id": ..., "inventory_item_id": ..., "available": ... }
```

---

## Summary - Priority Order for Linear

| #   | Issue                | Priority         | Labels                         | Est.  |
| --- | -------------------- | ---------------- | ------------------------------ | ----- |
| B   | Composite DB indexes | High 🟠          | backend, performance, database | 2h    |
| A   | Sidebar nav gaps     | Medium 🟡        | frontend, housekeeping         | 30m   |
| C   | Product detail page  | Medium 🟡        | frontend, seo                  | 3-4h  |
| D   | PDF export           | Low 🟢           | frontend, feature              | 3-4h  |
| E   | AI semantic search   | Low 🟢 (Backlog) | ai, backend, database          | 8-12h |
| F   | Enhanced Shopify     | Low 🟢 (Backlog) | integration, shopify           | 6-8h  |

**Total Estimated Effort**: ~23-31 hours

---

**Document Generated**: 2026-03-02
**Purpose**: PM audit backlog — import into Linear CCW workspace / ERP Deployment project
**Author**: Claude Code - PM Status Review
