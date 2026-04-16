# SQL Schema Audit - Remaining Fixes (Week 3-4)

**Related Documents**:

- [SQL Schema Audit Report](../SQL-SCHEMA-AUDIT-2026-02-11.md)
- [Base Class Fixes (Week 1)](../BASE-CLASS-FIXES-2026-02-11.md)

## Status Summary

✅ **Week 1 Complete** - Base Class Fixes

- Eliminated duplicate Base classes
- Removed 8 duplicate table definitions
- Fixed 11 inconsistent imports
- **Impact**: Schema health 85/100 → 92/100 (+7 points)

✅ **Week 2 Complete** - Timestamps + FK Indexes

- Added `updated_at` columns to 3 tables
- Added 23 missing foreign key indexes
- **Impact**: +7-8 points, 20-50% faster queries
- **Migration**: `alembic/versions/week2_add_timestamps_and_fk_indexes.py`

---

## 🔄 Week 3: Standardize Timezone Handling (HIGH PRIORITY)

**Issue**: Some models still use deprecated `datetime.utcnow` instead of `datetime.now(UTC)`

**Files to Update**:

1. `apps/backend/src/db/inventory_models.py`
2. `apps/backend/src/db/pos_models.py`
3. Any other files found during implementation

**Changes Required**:

```python
# BEFORE (deprecated):
created_at = Column(DateTime, default=datetime.utcnow)

# AFTER (correct):
created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
```

**Impact**: Consistency, prevents future timezone bugs

**Estimated Time**: 2-3 hours

---

## 🔄 Week 3: Standardize Enum Definitions (MEDIUM PRIORITY)

**Issue**: Inconsistent enum definitions across models (native vs string enums)

**Files Affected**: 8+ model files with enum definitions

**Action Required**:

1. Audit all enum definitions in model files
2. Decide on standard: native enums vs string enums
3. Document the decision in coding standards
4. Update all enums to match standard

**Examples**:

```python
# Option 1: String-based (current in demo_models.py)
class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"

# Option 2: Native enums
class OrderStatus(enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
```

**Impact**: Consistency, easier maintenance

**Estimated Time**: 3-4 hours

---

## 🚀 Week 4: Performance Optimizations (NICE TO HAVE)

### 1. Add Composite Indexes (7 indexes)

**Purpose**: Optimize common multi-column query patterns

**Recommended Indexes**:

- `orders(customer_id, status, order_date)`
- `order_items(order_id, product_id)`
- `quote_items(quote_id, product_id)`
- `products(category, is_active)`
- `customers(organization_id, is_active)`
- `orders(organization_id, status)`
- `quotes(organization_id, status)`

**Expected Impact**: 20-50% improvement on filtered queries

**Estimated Time**: 2-3 hours

---

### 2. Add Vector Indexes (2 indexes)

**Purpose**: Faster semantic search with pgvector

**Tables**:

- `products.embedding` - HNSW index for product search
- `product_embeddings.embedding` - HNSW index

**SQL**:

```sql
CREATE INDEX idx_products_embedding_hnsw
  ON products USING hnsw (embedding vector_cosine_ops);
```

**Impact**: 10-100x faster vector similarity searches

**Estimated Time**: 1-2 hours

---

### 3. Add Partial Indexes (4 indexes)

**Purpose**: Reduced index size, faster queries on filtered data

**Recommended**:

```sql
-- Only index active products
CREATE INDEX idx_products_active
  ON products(id) WHERE is_active = TRUE;

-- Only index non-cancelled orders
CREATE INDEX idx_orders_active
  ON orders(order_date, total) WHERE status != 'cancelled';

-- Only index pending approvals
CREATE INDEX idx_approvals_pending
  ON approvals(created_at) WHERE status = 'pending';

-- Only index recent background jobs
CREATE INDEX idx_background_jobs_recent
  ON background_jobs(created_at)
  WHERE status IN ('pending', 'processing');
```

**Impact**: Smaller indexes, faster writes, faster queries

**Estimated Time**: 2-3 hours

---

## 📊 Overall Progress

| Phase                                   | Status           | Health Impact     | Performance Impact | Time            |
| --------------------------------------- | ---------------- | ----------------- | ------------------ | --------------- |
| Week 1: Base Class Fixes                | ✅ Complete      | +7 points         | N/A                | 30 min          |
| Week 2: Timestamps + FK Indexes         | ✅ Complete      | +7-8 points       | +20-50%            | 2 hours         |
| Week 3: Timezone + Enum Standardization | 🔄 Pending       | +3-4 points       | N/A                | 5-7 hours       |
| Week 4: Performance Indexes             | 🔄 Pending       | +2-3 points       | +30-100%           | 6-8 hours       |
| **TOTAL**                               | **50% Complete** | **+19-22 points** | **+50-150%**       | **13-17 hours** |

**Target**: Schema health 92/100 → 111/100+ (exceeds target)

---

## 🎯 Success Criteria

- [ ] Week 3: All timezone handling standardized (`datetime.now(UTC)`)
- [ ] Week 3: All enums follow project-wide standard
- [ ] Week 4: 7 composite indexes added
- [ ] Week 4: 2 vector indexes added (HNSW)
- [ ] Week 4: 4 partial indexes added
- [ ] Documentation: Migration files created for all changes
- [ ] Testing: Performance benchmarks show expected improvements
- [ ] Schema health score: 110/100+ achieved

---

## 📝 Next Steps

1. **Immediate**: Review and approve this plan
2. **Week 3**: Begin timezone standardization
3. **Week 3**: Decide on enum standard and implement
4. **Week 4**: Add composite indexes with performance testing
5. **Week 4**: Add vector and partial indexes
6. **Final**: Update audit report with final health score

---

## 📚 Related Issues

- Audit Report: `SQL-SCHEMA-AUDIT-2026-02-11.md`
- Week 1 Report: `BASE-CLASS-FIXES-2026-02-11.md`
- Migration: `apps/backend/alembic/versions/week2_add_timestamps_and_fk_indexes.py`

---

**Labels**: `database`, `performance`, `technical-debt`, `schema-health`
**Milestone**: Database Schema Improvements
**Priority**: P2 - High
**Estimated Total Time**: 13-17 hours
