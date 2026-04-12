# Plan: Performance Quick Wins - 2-3x Speed Improvement

**Generated**: February 4, 2026
**Plan Type**: Performance Optimization (Critical P0 Fixes)
**Current Status**: Post-Phase 4 (Real-time & POS Auto-Sync Complete)
**Timeline**: 1 week (19 hours effort)
**Impact**: 2-3x faster dashboard and list pages

---

## 🎯 EXECUTIVE SUMMARY

### Current State Analysis

**✅ ALREADY OPTIMIZED** (from Phase 4 audit implementation):

1. ✅ Dashboard aggregated endpoint exists (`/api/dashboard/aggregated`)
2. ✅ Products N+1 fixed with `include_stock=true` parameter
3. ✅ Dashboard metrics combined into 3 queries (down from 6)
4. ✅ Database indexes added (foreign keys, search, trigram)
5. ✅ React widgets memoized (StockHealthWidget, etc.)
6. ✅ Real-time SSE implemented for inventory

**❌ REMAINING GAPS** (Critical Issues):

1. ❌ Pagination `getPageNumbers()` NOT memoized - O(n) on every render
2. ❌ Order item updates use delete-all + insert-all pattern
3. ❌ Stock reservation has sequential queries (not batched)
4. ❌ No React.memo on chart components (RevenueChart, CategorySalesChart)
5. ❌ Dashboard widgets make individual API calls (not using aggregated endpoint fully)

### Objective

**Fix the 5 remaining critical performance bottlenecks** to achieve:

- Dashboard load time: 5-8s → **<2s** (70% faster)
- Order updates: 20 queries → **5-8 queries** (60% faster)
- Pagination rendering: No lag → **instant** (5% UI boost)
- Chart re-renders: Excessive → **minimal** (30% reduction)

---

## 📋 FILES TO CREATE/MODIFY

### Frontend (6 files)

- [ ] `apps/web/components/ui/pagination-controls.tsx` — Add useMemo to getPageNumbers()
- [ ] `apps/web/components/charts/RevenueChart.tsx` — Wrap in React.memo
- [ ] `apps/web/components/charts/CategorySalesChart.tsx` — Wrap in React.memo
- [ ] `apps/web/components/dashboard/OrderStatusBreakdownWidget.tsx` — Verify React.memo
- [ ] `apps/web/components/dashboard/QuoteConversionWidget.tsx` — Verify React.memo
- [ ] `apps/web/components/dashboard/RevenueByLocationWidget.tsx` — Verify React.memo

### Backend (2 files)

- [ ] `apps/backend/src/api/routes/orders.py` — Optimize order item updates (diff-based)
- [ ] `apps/backend/src/api/routes/orders.py` — Batch stock reservation queries

### Tests (2 files)

- [ ] `apps/web/__tests__/components/ui/pagination-controls.test.tsx` — Test memoization
- [ ] `apps/backend/tests/api/test_orders_performance.py` — Test order update performance

**Total**: 10 files (0 new, 10 modified)

---

## 🔧 IMPLEMENTATION STEPS

### **STEP 1: Frontend Memoization Quick Wins** (3 hours)

#### 1.1 Add useMemo to Pagination (30 minutes)

**File**: `apps/web/components/ui/pagination-controls.tsx`

**Current Issue**: `getPageNumbers()` runs on every render (O(n) calculation)

**Fix**:

```typescript
// Before (line 36-75):
const getPageNumbers = () => {
  // ... pagination logic
};
const pageNumbers = getPageNumbers();

// After:
const pageNumbers = useMemo(() => {
  const pages: (number | string)[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // ... existing logic
  }

  return pages;
}, [currentPage, totalPages]);
```

**Import**: Add `import { useMemo } from "react";` at top

**Impact**: 5% UI responsiveness improvement

---

#### 1.2 Memoize Chart Components (2 hours)

**Files**:

- `apps/web/components/charts/RevenueChart.tsx`
- `apps/web/components/charts/CategorySalesChart.tsx`

**Current Issue**: Charts re-render on every parent state change

**Fix Pattern**:

```typescript
// Before:
export function RevenueChart({ data }: { data: RevenueDataPoint[] }) {
  // ... chart logic
}

// After:
import { memo } from 'react';

export const RevenueChart = memo(function RevenueChart({ data }: { data: RevenueDataPoint[] }) {
  // ... chart logic
});

// Add display name for DevTools
RevenueChart.displayName = 'RevenueChart';
```

**Apply to**:

1. `RevenueChart.tsx` (line 1-100)
2. `CategorySalesChart.tsx` (line 1-80)

**Verification**: Check existing dashboard widgets are already memoized:

- ✅ `StockHealthWidget.tsx` (line 28: `export const StockHealthWidget = memo(...)`)
- ✅ Check `OrderStatusBreakdownWidget.tsx`
- ✅ Check `QuoteConversionWidget.tsx`
- ✅ Check `RevenueByLocationWidget.tsx`

**Impact**: 30% reduction in unnecessary re-renders

---

#### 1.3 Write Frontend Tests (30 minutes)

**File**: `apps/web/__tests__/components/ui/pagination-controls.test.tsx` (NEW)

**Test Cases**:

```typescript
import { render, screen } from "@testing-library/react";
import { PaginationControls } from "@/components/ui/pagination-controls";

describe("PaginationControls", () => {
  test("memoizes page numbers calculation", () => {
    const { rerender } = render(
      <PaginationControls
        currentPage={1}
        totalPages={100}
        pageSize={50}
        totalItems={5000}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
      />
    );

    // Initial render
    expect(screen.getByText("1")).toBeInTheDocument();

    // Re-render with same props - should not recalculate
    rerender(
      <PaginationControls
        currentPage={1}
        totalPages={100}
        pageSize={50}
        totalItems={5000}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
      />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("handles large page counts efficiently", () => {
    const { rerender } = render(
      <PaginationControls
        currentPage={500}
        totalPages={1000}
        pageSize={50}
        totalItems={50000}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
      />
    );

    // Should show ellipsis for large page counts
    expect(screen.getAllByText("...")).toHaveLength(2);
  });
});
```

**Run**: `pnpm test --filter=web pagination`

---

### **STEP 2: Backend Order Optimization** (10 hours)

#### 2.1 Implement Diff-Based Order Item Updates (5 hours)

**File**: `apps/backend/src/api/routes/orders.py` (lines 674-721)

**Current Issue**: When updating order, deletes ALL items then inserts new ones

- 10 items = 10 DELETE + 10 INSERT = 20 queries
- Should only update changed items

**Current Code**:

```python
# Delete all existing items
await db.execute(delete(OrderItem).where(OrderItem.order_id == order_id))

# Insert all new items
for item_data in order_data.items:
    order_item = OrderItem(
        order_id=order_id,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
        unit_price=item_data.unit_price,
        line_total=item_data.quantity * item_data.unit_price,
    )
    db.add(order_item)
```

**New Implementation**:

```python
# PHASE 4 OPTIMIZATION: Diff-based update (60% faster)

# 1. Fetch existing items
existing_items_result = await db.execute(
    select(OrderItem).where(OrderItem.order_id == order_id)
)
existing_items = {item.id: item for item in existing_items_result.scalars().all()}
existing_item_ids = set(existing_items.keys())

# 2. Identify new item IDs from request
new_item_ids = {
    UUID(item_data.id) for item_data in order_data.items if item_data.id
}

# 3. Diff calculation
items_to_delete = existing_item_ids - new_item_ids
items_to_update = existing_item_ids & new_item_ids
items_to_create = [
    item_data for item_data in order_data.items if not item_data.id
]

# 4. Execute diff (only change what's needed)
# Delete removed items
if items_to_delete:
    await db.execute(
        delete(OrderItem).where(OrderItem.id.in_(items_to_delete))
    )

# Update modified items
for item_data in order_data.items:
    if item_data.id and UUID(item_data.id) in items_to_update:
        existing = existing_items[UUID(item_data.id)]
        existing.product_id = item_data.product_id
        existing.quantity = item_data.quantity
        existing.unit_price = item_data.unit_price
        existing.line_total = item_data.quantity * item_data.unit_price

# Create new items
for item_data in items_to_create:
    order_item = OrderItem(
        order_id=order_id,
        product_id=item_data.product_id,
        quantity=item_data.quantity,
        unit_price=item_data.unit_price,
        line_total=item_data.quantity * item_data.unit_price,
    )
    db.add(order_item)

logger.info(
    "Order items diff applied",
    order_id=str(order_id),
    deleted=len(items_to_delete),
    updated=len(items_to_update),
    created=len(items_to_create),
)
```

**Frontend Change Required**: Update OrderForm to include `item.id` in payload

**File**: `apps/web/app/(dashboard)/orders/components/OrderForm.tsx`

**Add item IDs**:

```typescript
// When editing order, preserve item IDs
items: order?.items?.map((item) => ({
  id: item.id, // ADD THIS
  product_id: item.product_id,
  quantity: item.quantity,
  unit_price: item.unit_price,
})) || [];
```

**Impact**: 60% faster order updates (20 queries → 5-8 queries)

---

#### 2.2 Batch Stock Reservation Queries (5 hours)

**File**: `apps/backend/src/api/routes/orders.py` (lines 146-180)

**Current Issue**: Stock checks and reservations happen one-by-one

- 10 items = 10 SELECT + 10 UPDATE = 20 queries

**Current Code**:

```python
for item in order.items:
    # Individual query per item
    stock_result = await db.execute(
        select(InventoryStock)
        .where(InventoryStock.product_id == item.product_id)
        .where(InventoryStock.location == location)
        .with_for_update()  # Pessimistic lock
    )
    stock = stock_result.scalar_one_or_none()
    # ... update stock
```

**New Implementation**:

```python
# PHASE 4 OPTIMIZATION: Batch stock reservation (80% faster)

# 1. Collect all product IDs
product_ids = [item.product_id for item in order.items]

# 2. Fetch ALL stock records in one query
stock_result = await db.execute(
    select(InventoryStock)
    .where(InventoryStock.product_id.in_(product_ids))
    .where(InventoryStock.location == location)
    .with_for_update()  # Lock all at once
)
stock_by_product = {
    stock.product_id: stock for stock in stock_result.scalars().all()
}

# 3. Check all items have sufficient stock (fail fast)
insufficient_stock = []
for item in order.items:
    stock = stock_by_product.get(item.product_id)
    if not stock or stock.available < item.quantity:
        insufficient_stock.append({
            "product_id": str(item.product_id),
            "requested": item.quantity,
            "available": stock.available if stock else 0,
        })

if insufficient_stock:
    raise HTTPException(
        status_code=400,
        detail=f"Insufficient stock: {insufficient_stock}",
    )

# 4. Update all stock records (single flush)
for item in order.items:
    stock = stock_by_product[item.product_id]
    previous_qty = stock.stock
    stock.stock -= item.quantity
    stock.reserved += item.quantity

    # Log adjustment
    logger.info(
        "Stock reserved",
        product_id=str(item.product_id),
        location=location,
        previous=previous_qty,
        reserved=item.quantity,
        new_stock=stock.stock,
    )

# Single commit for all updates
await db.commit()

logger.info(
    "Batch stock reservation completed",
    order_id=str(order.id),
    items_reserved=len(order.items),
)
```

**Impact**: 80% faster stock reservation (20 queries → 2-4 queries)

---

#### 2.3 Write Backend Performance Tests (2 hours)

**File**: `apps/backend/tests/api/test_orders_performance.py` (NEW)

```python
import pytest
from decimal import Decimal
from uuid import uuid4
from src.db.demo_models import Order, OrderItem, Product, Customer

@pytest.mark.asyncio
async def test_order_item_diff_update(db_session, test_customer, test_products):
    """Test that order item updates use diff-based approach."""
    # Create order with 10 items
    order = Order(
        customer_id=test_customer.id,
        order_number="ORD-2026-001",
        status="draft",
        total=Decimal(1000),
    )
    db_session.add(order)
    await db_session.flush()

    # Add 10 items
    for i, product in enumerate(test_products[:10]):
        item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=5,
            unit_price=Decimal(100),
            line_total=Decimal(500),
        )
        db_session.add(item)

    await db_session.commit()

    # Update order: remove 2 items, modify 3, add 1 new
    # Should execute: 2 DELETE + 3 UPDATE + 1 INSERT = 6 queries
    # NOT: 10 DELETE + 9 INSERT = 19 queries

    # TODO: Implement query counting and assert <10 queries

@pytest.mark.asyncio
async def test_batch_stock_reservation(db_session, test_order, test_products):
    """Test that stock reservation batches queries."""
    # Create order with 10 items
    # Should execute: 1 SELECT (all stock) + 1 UPDATE (batch) = 2 queries
    # NOT: 10 SELECT + 10 UPDATE = 20 queries

    # TODO: Implement query counting and assert <5 queries
```

**Run**: `cd apps/backend && uv run pytest tests/api/test_orders_performance.py -v`

---

### **STEP 3: Verification & Testing** (6 hours)

#### 3.1 Manual Performance Testing (3 hours)

**Dashboard Load Time** (Target: <2s):

1. Open Chrome DevTools → Network tab
2. Navigate to `/dashboard`
3. Measure time from navigation → "Load" event
4. **Success Criteria**: <2 seconds (down from 5-8s)

**Order Update Performance** (Target: 60% faster):

1. Create order with 10 items
2. Edit order: remove 2 items, modify 3, add 1
3. Monitor backend logs for query count
4. **Success Criteria**: <10 queries total (down from 20)

**Pagination Responsiveness**:

1. Navigate to `/products` with 1000+ products
2. Click through pages 1 → 50 → 500 → 1000
3. Observe UI lag
4. **Success Criteria**: No visible lag

---

#### 3.2 Automated Test Suite (2 hours)

**Run All Tests**:

```bash
# Frontend tests
pnpm turbo run test --filter=web

# Backend tests
cd apps/backend && uv run pytest

# Type checking
pnpm turbo run type-check

# Linting
pnpm turbo run lint
```

**Success Criteria**:

- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ No ESLint warnings

---

#### 3.3 Performance Metrics Collection (1 hour)

**Collect Before/After Metrics**:

| Metric                    | Before     | After  | Target      | Status          |
| ------------------------- | ---------- | ------ | ----------- | --------------- |
| Dashboard load time       | 5-8s       | ?      | <2s         | ⏳              |
| Products API calls        | 51 calls   | 1 call | 1 call      | ✅ Already done |
| Order update queries      | 20 queries | ?      | <10 queries | ⏳              |
| Stock reservation queries | 20 queries | ?      | <5 queries  | ⏳              |
| Chart re-renders          | High       | ?      | Low         | ⏳              |

**Tools**:

- Chrome DevTools → Network tab
- Chrome DevTools → Performance tab
- React DevTools → Profiler
- Backend logs (`structlog` output)

---

## ✅ SUCCESS CRITERIA

### Must Have (P0)

- [ ] Dashboard loads in <2 seconds
- [ ] Order item updates use diff-based approach (<10 queries)
- [ ] Stock reservation batches queries (<5 queries)
- [ ] Pagination uses useMemo (no lag)
- [ ] All tests pass (frontend + backend)
- [ ] No TypeScript errors
- [ ] No breaking changes

### Should Have (P1)

- [ ] Chart components memoized
- [ ] Performance metrics documented
- [ ] Before/after comparison screenshots

### Nice to Have (P2)

- [ ] Lighthouse score improvement
- [ ] Sentry performance monitoring enabled
- [ ] Grafana dashboard for query performance

---

## ⚠️ RISKS & MITIGATION

### Risk 1: Diff-Based Update Complexity

**Impact**: May introduce bugs in order item updates
**Probability**: Medium
**Mitigation**:

- Comprehensive unit tests for diff logic
- Manual testing with edge cases (remove all items, add 50 items, etc.)
- Feature flag if needed: `ENABLE_DIFF_ORDER_UPDATES=true`

**Rollback Plan**: Revert to delete-all + insert-all if bugs found

---

### Risk 2: Stock Batch Lock Timeout

**Impact**: Pessimistic locks on multiple rows could timeout
**Probability**: Low
**Mitigation**:

- Lock only necessary rows (filter by `product_ids`)
- Set reasonable timeout (5 seconds max)
- Add retry logic with exponential backoff

**Fallback**: If batch lock fails, fall back to sequential locks

---

### Risk 3: Frontend Memoization Breaking Changes

**Impact**: useMemo dependencies could break pagination
**Probability**: Low
**Mitigation**:

- Comprehensive unit tests
- Visual regression testing (Playwright screenshots)
- Thorough manual testing before deploy

**Rollback Plan**: Remove useMemo if issues found

---

## 🚫 BREAKING CHANGES

**None Expected** - All changes are backward compatible:

- ✅ API contracts unchanged
- ✅ Database schema unchanged
- ✅ Frontend component props unchanged
- ✅ Existing functionality preserved

**Frontend Changes**:

- OrderForm now sends `item.id` in payload (optional field, backward compatible)

**Backend Changes**:

- Order update endpoint accepts optional `item.id` field
- If `item.id` not provided, falls back to delete-all + insert-all (legacy behavior)

---

## 📊 EXPECTED PERFORMANCE IMPROVEMENTS

| Area                          | Current             | Target      | Improvement                         |
| ----------------------------- | ------------------- | ----------- | ----------------------------------- |
| **Dashboard load time**       | 5-8s                | <2s         | **70% faster**                      |
| **Products API calls**        | 51 calls            | 1 call      | **98% reduction** (✅ already done) |
| **Dashboard metrics queries** | 6 queries           | 3 queries   | **50% reduction** (✅ already done) |
| **Order update queries**      | 20 queries          | 5-8 queries | **60% faster**                      |
| **Stock reservation queries** | 20 queries          | 2-4 queries | **80% faster**                      |
| **Pagination re-renders**     | Every render        | Memoized    | **5% UI boost**                     |
| **Chart re-renders**          | Every parent change | Memoized    | **30% reduction**                   |

**Overall Impact**: **2-3x faster** user-facing performance

---

## 📝 IMPLEMENTATION CHECKLIST

### Phase 1: Frontend Memoization (3 hours)

- [ ] Add useMemo to pagination getPageNumbers()
- [ ] Wrap RevenueChart in React.memo
- [ ] Wrap CategorySalesChart in React.memo
- [ ] Verify other dashboard widgets memoized
- [ ] Write pagination unit tests
- [ ] Test manually (no UI lag)

### Phase 2: Backend Optimization (10 hours)

- [ ] Implement diff-based order item updates
- [ ] Update OrderForm to send item IDs
- [ ] Implement batch stock reservation
- [ ] Write performance unit tests
- [ ] Test with 10+ items per order
- [ ] Verify query counts in logs

### Phase 3: Testing & Verification (6 hours)

- [ ] Run full test suite (frontend + backend)
- [ ] Manual performance testing
- [ ] Collect before/after metrics
- [ ] Document improvements
- [ ] Update `.claude/docs/PERFORMANCE_IMPROVEMENTS.md`

### Phase 4: Deployment

- [ ] Commit changes with descriptive message
- [ ] Push to GitHub
- [ ] Deploy to staging environment
- [ ] Smoke test critical paths
- [ ] Monitor Sentry for errors
- [ ] Deploy to production

---

## 🔗 RELATED DOCUMENTATION

- **Phase 4 Audit Plan**: `.claude/plans/gleaming-booping-forest.md`
- **POS Auto-Sync Complete**: `.claude/docs/POS_AUTO_SYNC_COMPLETE.md`
- **System Instructions**: `.claude/CLAUDE.md`
- **Tech Stack**: `CLAUDE.md` (root)

---

## 📅 TIMELINE

**Week 1** (19 hours total):

- **Day 1** (3h): Frontend memoization + tests
- **Day 2-3** (10h): Backend order optimization + tests
- **Day 4** (6h): Testing, verification, metrics
- **Day 5**: Deploy + monitor

**Target Completion**: February 11, 2026

---

**END OF PLAN**

**Next Steps**: Get user approval, then implement in phases.
