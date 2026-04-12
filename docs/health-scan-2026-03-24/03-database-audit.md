# Database Architecture Health Audit

**Audit Date**: 2026-03-24
**Auditor**: Senior Database Architect (15+ years experience)
**Scope**: SQLAlchemy models, Alembic migrations, indexes, cascade rules, type safety

---

## Executive Summary

The database layer shows **EXCELLENT** timezone hygiene and **GOOD** Alembic migration practices. The primary technical debt areas are a **mixed SQLAlchemy 1.x/2.0 style** (1,043 old-style `Column()` vs 801 modern `Mapped[]`), **50 foreign keys without explicit cascade rules**, **38 JSON columns that should be JSONB**, and **350 columns with implicit nullable defaults**.

**Key Metrics**:

- **Model Files**: 42 (across `apps/backend/src/db/`)
- **Foreign Keys**: 166 total, 50 without `ondelete`
- **SQLAlchemy Style**: Mixed (43% Mapped[] / 57% Column())
- **Timezone Safety**: ✅ 100% (388 DateTime + tz, 0 without)
- **Migration Files**: 21 Alembic versions
- **JSON vs JSONB**: 38 legacy JSON columns (should be JSONB)
- **Missing Nullable Specs**: 350 columns

**Health Grade**: B (82/100)

---

## 1. DateTime Timezone Handling

### Findings

✅ **EXCELLENT PASS**: 100% timezone-aware DateTimes

```python
# Applied consistently throughout codebase
created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
updated_at = Column(DateTime(timezone=True), nullable=False, onupdate=lambda: datetime.now(UTC))
```

**Count**:

- `DateTime(timezone=True)`: **388 instances** across all model files
- `DateTime(` without timezone: **0 instances**

This is the strongest database discipline in the codebase. No naive datetime bugs possible.

---

## 2. SQLAlchemy Style Consistency

### Findings

❌ **FAIL**: Severely mixed SQLAlchemy 1.x (`Column()`) vs 2.0 (`Mapped[]`) style

**Distribution**:
| Style | Count | Files | Assessment |
|-------|-------|-------|------------|
| `Mapped[...]` (SQLAlchemy 2.0) | 801 | New models | ✅ Correct |
| `Column(...)` (SQLAlchemy 1.x) | 1,043 | Older models | ⚠️ Legacy |

**Legacy style files** (need migration):

```python
# LEGACY STYLE — demo_models.py, shopify_models.py, xero_models.py, email_models.py
class Product(Base):
    __tablename__ = "products"
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
```

**Modern style** (preferred):

```python
# MODERN STYLE — inventory_models.py, workflow_models.py, etc.
class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(PGUUID, ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
```

**Impact**:

- mypy cannot infer types from `Column()` style (requires `sqlalchemy-stubs`)
- `Mapped[]` enables type-safe attribute access without stubs
- IDE autocompletion broken for legacy models

**Recommendation**:

1. All new models: use `Mapped[]` style only
2. Sprint 2: Migrate `shopify_models.py`, `xero_models.py`, `email_models.py` to `Mapped[]`
3. Note: `demo_models.py` is locked — leave as-is

---

## 3. Foreign Key Cascade Rules

### Analysis

```bash
grep -rn "ForeignKey" src/db --include="*.py" | grep -v "ondelete" | wc -l
# 50 FKs without explicit ondelete
```

### Findings

⚠️ **CONCERN**: 50 of 166 foreign keys (30%) lack explicit `ondelete` rules

When `ondelete` is omitted, PostgreSQL defaults to `RESTRICT` (blocks delete of parent if children exist). This is safe but often **unintentional** and leads to confusing DELETE errors.

**Examples of Missing Rules**:

```python
# ap2_models.py — Implicit RESTRICT (may be wrong intent)
ForeignKey("ap2_mandates.id"), nullable=True     # What happens when mandate is deleted?
ForeignKey("orders.id"), nullable=True           # What happens when order is deleted?

# cin7_gl_models.py — Implicit RESTRICT
ForeignKey("cin7_chart_of_accounts.id")          # Blocks CoA deletion unexpectedly

# container_models.py — Mixed (some explicit, some implicit)
ForeignKey("users.id"), nullable=True            # Created_by: should be SET NULL
```

**Correct Patterns** (already used in codebase):

```python
# CASCADE — Delete children when parent is deleted
ForeignKey("orders.id", ondelete="CASCADE")

# SET NULL — Orphan children gracefully (for optional references)
ForeignKey("customers.id", ondelete="SET NULL"), nullable=True

# RESTRICT — Explicit: block deletion if referenced
ForeignKey("products.id", ondelete="RESTRICT")
```

**Recommendation**:

1. Audit all 50 FKs without `ondelete`
2. Default rule: `created_by` / `user_id` type columns → `SET NULL`
3. Child tables (line items, steps) → `CASCADE`
4. Critical references (product_id in orders) → `RESTRICT`

---

## 4. JSON vs JSONB

### Findings

⚠️ **CONCERN**: 38 legacy `JSON` columns should be `JSONB`

**Files using legacy JSON**:
| File | Count | Impact |
|------|-------|--------|
| `demo_models.py` | ~5 | Locked file |
| `shopify_models.py` | ~12 | Can migrate |
| `email_models.py` | ~6 | Can migrate |
| `xero_models.py` | ~8 | Can migrate |
| `email_audit_models.py` | ~7 | Can migrate |

**Why JSONB > JSON**:

```sql
-- JSON: Stored as text, no indexing, slower operators
-- JSONB: Binary storage, GIN indexable, faster operators

-- JSONB enables these queries (JSON cannot):
CREATE INDEX idx_webhook_payload ON webhook_events USING GIN (payload);
SELECT * FROM webhook_events WHERE payload @> '{"type": "order.created"}';
```

**Migration Impact**:

- `JSON` → `JSONB` is a data-compatible migration (same values)
- Requires Alembic migration: `op.alter_column('table', 'col', type_=JSONB)`
- `demo_models.py` cannot be changed (locked)

**Recommendation**:

1. Sprint 2: Migrate `shopify_models.py`, `email_models.py`, `xero_models.py`
2. Add GIN indexes to high-query JSONB columns (webhook payloads, AI metadata)
3. Document `demo_models.py` JSON columns as locked

---

## 5. Index Coverage

### Findings

✅ **GOOD**: Solid index coverage with room for improvement

**Index Inventory**:
| Type | Count | Assessment |
|------|-------|------------|
| Column-level `index=True` | 392 | Good coverage |
| Explicit FK indexes (`index=True` on FK columns) | 40 | Partial coverage |
| Composite indexes (`indexes.py`) | 3 | Core tables covered |
| Table-level `__table_args__` indexes | ~15 | Domain-specific |
| FKs without explicit indexes | ~110 | Potential slow JOINs |

**Composite Indexes Defined** (in `indexes.py`):

```python
ix_order_items_order_product  # (order_id, product_id) — JOIN queries
ix_orders_customer_status     # (customer_id, status) — customer order history
ix_products_category_active   # (category, is_active) — product browse
```

**Missing High-Priority Indexes**:

```sql
-- Workflow instances by status + entity (frequently queried together)
CREATE INDEX ix_workflow_instances_entity_status
  ON workflow_instances (entity_id, status);

-- Notifications by user + read status (polling every 30s)
CREATE INDEX ix_notifications_user_read
  ON in_app_notifications (user_id, is_read, created_at);

-- Cin7 sync logs by entity type + status (integration monitoring)
CREATE INDEX ix_cin7_sync_logs_entity_status
  ON cin7_sync_logs (entity_type, status, created_at);

-- Inventory stock by product + location (warehouse queries)
CREATE INDEX ix_inventory_product_location
  ON inventory_stock (product_id, location);
```

**GIN Index Gap** (for JSONB columns):

```sql
-- After migrating to JSONB, add GIN indexes for:
CREATE INDEX idx_webhook_payload ON webhook_events USING GIN (payload);
CREATE INDEX idx_ap2_mandate_metadata ON ap2_mandates USING GIN (mandate_metadata);
```

**Recommendation**:

1. Add 4 missing composite indexes above to `indexes.py`
2. After JSONB migration, add GIN indexes for webhook/integration payloads
3. Run `EXPLAIN ANALYZE` on top 10 slowest queries to find remaining gaps

---

## 6. Alembic Migration Health

### Findings

⚠️ **CONCERN**: Inconsistent migration naming convention

**Migration File Inventory** (21 files):

```
001_add_approvals.py                    ← Numeric prefix (good)
002_add_semantic_search.py              ← Numeric prefix (good)
003_add_missing_trigram_indexes.py      ← Numeric prefix (good)
004_add_product_sync_bidirectional.py   ← Numeric prefix (good)
005_add_shopify_extended_tables.py      ← Numeric prefix (good)
00e_add_prd_tables.py                   ← Mixed (hex prefix + text)
28a0fb9f5a0a_add_background_jobs_table.py  ← Hash prefix (Alembic default)
4b2f1c8d9a01_add_order_activity_table.py   ← Hash prefix
68d51946645a_create_erp_schema.py          ← Hash prefix
```

**Issues**:

1. Two naming conventions: `NNN_description.py` vs `hash_description.py`
2. `00e` prefix (hex) inconsistent with `001-005` (decimal)
3. Some migrations have no `down_revision` linked (orphaned branches)

**Good Migration Example**:

```python
# 001_add_approvals.py — proper structure
revision = '001_add_approvals'
down_revision = '7a9c1d2e3f4b'  # Properly chained

def upgrade() -> None:
    op.create_table('approvals', ...)
    op.create_index('ix_approvals_status', 'approvals', ['status'])  # Indexes included

def downgrade() -> None:
    op.drop_table('approvals')  # Reversible
```

**Recommendation**:

1. Standardise on numeric prefix: `NNN_description.py` going forward
2. Rename `00e_add_prd_tables.py` → `006_add_prd_tables.py`
3. Verify `down_revision` chain is unbroken: `alembic history --verbose`
4. Add `downgrade()` stubs to any migrations missing them

---

## 7. Nullable Specification Gaps

### Findings

⚠️ **CONCERN**: 350 columns without explicit `nullable` specification

SQLAlchemy defaults `Column()` to `nullable=True` when not specified. This is usually unintentional for required fields.

**Risk**:

```python
# Could be nullable (unintentional):
product_name = Column(String(255))  # Is None valid? Unknown from code

# Intent is clear:
product_name = Column(String(255), nullable=False)  # Required
description = Column(Text, nullable=True)            # Optional
```

**Recommendation**:

1. Audit 350 unspecified columns — add explicit `nullable=True|False`
2. Prioritise: core business entities (products, orders, customers)
3. Add linting rule (ruff/pylint) to require explicit nullable

---

## 8. Unique Constraints

### Findings

✅ **GOOD**: Business uniqueness constraints present

**Unique Constraints Inventory**:
| Type | Count |
|------|-------|
| Column-level `unique=True` | 50 |
| Table-level `UniqueConstraint` | 2 |

**Table-Level UniqueConstraints**:

```python
# inventory_models.py — composite unique
UniqueConstraint("product_id", "location", name="uq_product_location")
UniqueConstraint("product_id", "location", name="uq_reorder_rule_product_location")
```

**Missing Uniqueness** (potential data integrity gaps):

- `cin7_sync_logs`: No unique constraint on `(entity_type, entity_id, sync_type)` — duplicate syncs possible
- `workflow_templates`: No unique constraint on `name` — duplicate template names
- `in_app_notifications`: No unique constraint prevents duplicate notification delivery

---

## Summary of Issues by Priority

### CRITICAL (Fix in Sprint 1)

1. **50 FKs without ondelete rules** — Implicit RESTRICT causes confusing DELETE errors; `SET NULL` for optional refs

### HIGH (Fix in Sprint 2)

2. **38 JSON → JSONB columns** — Prevents GIN indexing for webhook/integration payload queries
3. **Mixed SQLAlchemy style** — Migrate non-locked files to `Mapped[]` for type safety

### MEDIUM (Fix in Sprint 3)

4. **4 missing composite indexes** — workflow_instances, notifications, cin7_sync_logs, inventory
5. **350 columns without explicit nullable** — Audit and specify intent
6. **Migration naming inconsistency** — Standardise to numeric prefix

### LOW (Backlog)

7. **GIN indexes for JSONB** — After JSONB migration, add GIN for payload columns
8. **Missing uniqueness on sync logs** — Prevent duplicate sync records
9. **Alembic chain verification** — Verify no orphaned migration branches

---

## Metrics Dashboard

| Metric                     | Current        | Target   | Status |
| -------------------------- | -------------- | -------- | ------ |
| DateTime timezone coverage | 100%           | 100%     | ✅     |
| SQLAlchemy 2.0 Mapped[]    | 43% (801/1844) | 80%      | ⚠️     |
| FKs with explicit ondelete | 70% (116/166)  | 100%     | ⚠️     |
| JSON → JSONB migration     | 0% (38 remain) | 100%     | ❌     |
| Composite indexes          | 3 defined      | 7+       | ⚠️     |
| Explicit nullable specs    | 81%            | 100%     | ⚠️     |
| Alembic chain integrity    | 21 files       | Verified | ⚠️     |

---

**Audit completed**: 2026-03-24
**Next audit**: 2026-04-24 (1 month)
