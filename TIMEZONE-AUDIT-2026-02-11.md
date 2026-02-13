# Database Timezone Audit - 2026-02-11

**Status**: 🔍 **AUDIT COMPLETE** - Ready to fix
**Priority**: HIGH (Database Week 3 Task)
**Effort**: 2-3 hours

---

## 🎯 Objective

Standardize timezone handling across all database models to use the modern Python 3.12+ timezone-aware approach: `datetime.now(UTC)` instead of the deprecated `datetime.utcnow()` or naive `datetime.now()`.

---

## ❌ Current Issues

### Issue 1: Using Deprecated `datetime.utcnow()`

**Problem**: `datetime.utcnow()` returns a **naive datetime** (no timezone info) which can cause:
- Timezone conversion errors
- Ambiguous timestamps
- DST (Daylight Saving Time) bugs
- Cross-timezone comparison issues

**Modern Replacement**: `datetime.now(UTC)` returns **timezone-aware datetime**

### Issue 2: Using Naive `datetime.now()`

**Problem**: `datetime.now()` without timezone argument returns **naive local time**:
- Depends on server's local timezone
- Not portable across servers
- Can't reliably compare with UTC times

**Modern Replacement**: `datetime.now(UTC)` for consistent UTC times

---

## 📊 Files Requiring Changes

### HIGH PRIORITY (Specifically Mentioned in Week 3 Tasks)

#### 1. `pos_models.py` - 6 instances ✅ Priority
**Location**: `apps/backend/src/db/pos_models.py`

**Changes Required**:
```python
# Line 72-74: Location model
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
)

# Line 129-131: SalesStaff model
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
)

# Line 178-180: POSTerminal model
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
)

# Line 237-239: POSTransaction model
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
)

# Line 335-338: BankFeed model
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, index=True
)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
)

# Line 413-415: BankAccount model
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
)
```

**Total**: 6 models, 12 occurrences

#### 2. `inventory_models.py` - 10 instances ✅ Priority
**Location**: `apps/backend/src/db/inventory_models.py`

**Changes Required**:
```python
# Line 82-89: ProductStockByLocation model
created_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
updated_at: datetime = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(),
    onupdate=lambda: datetime.now(),
    nullable=False,
)

# Line 138-149: StockTransfer model
initiated_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
created_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
updated_at: datetime = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(),
    onupdate=lambda: datetime.now(),
    nullable=False,
)

# Line 193-207: StockReservation model
reserved_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
created_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
updated_at: datetime = Column(
    DateTime(timezone=True),
    default=lambda: datetime.now(),
    onupdate=lambda: datetime.now(),
    nullable=False,
)

# Line 250-254: StockAdjustment model
adjusted_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
created_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
```

**Note**: All use `lambda: datetime.now()` which is **naive** (no timezone)

**Total**: 4 models, 10 occurrences

---

### MEDIUM PRIORITY (Also Using Deprecated Pattern)

#### 3. `shopify_models.py` - 12 instances
**Location**: `apps/backend/src/db/shopify_models.py`

Models affected: ShopifyProduct, ShopifyCollection, ShopifyCustomer, ShopifyOrder, ShopifyWebhook

#### 4. `i18n_models.py` - 12 instances
**Location**: `apps/backend/src/db/i18n_models.py`

Models affected: Language, TranslationKey, Translation, TranslationRequest, TranslationContext, TranslationMemory

#### 5. `portal_forms_models.py` - 4 instances
**Location**: `apps/backend/src/db/portal_forms_models.py`

Models affected: CustomerFormResponse, CustomerProductRequest

#### 6. `service_models.py` - 2 instances
**Location**: `apps/backend/src/db/service_models.py`

Models affected: ServiceTicket

#### 7. `models/prd.py` - 4 instances
**Location**: `apps/backend/src/db/models/prd.py`

Models affected: PRDDocument, PRDWorkflow, PRDComment

#### 8. `models/subscription.py` - 4 instances
**Location**: `apps/backend/src/db/models/subscription.py`

Models affected: Subscription (including 1 property method)

#### 9. `models/invoicing.py` - 4 instances
**Location**: `apps/backend/src/db/models/invoicing.py`

Models affected: Invoice, InvoiceLineItem, Payment

---

### SERVICES USING `datetime.utcnow()`

#### 10. `i18n_service.py` - 2 instances
**Location**: `apps/backend/src/services/i18n_service.py`

**Lines**:
- Line 316: `existing.translated_at = datetime.utcnow()`
- Line 330: `translated_at=datetime.utcnow()`

---

## 📝 Total Impact

| Category | Count |
|----------|-------|
| **Model Files** | 9 files |
| **Service Files** | 1 file |
| **Total Files** | 10 files |
| **Total Occurrences** | ~54 occurrences |
| **Models Affected** | ~25 models |

---

## 🔧 Fix Pattern

### Pattern 1: Replace `datetime.utcnow` with `lambda: datetime.now(UTC)`

**Before**:
```python
from datetime import datetime
created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

**After**:
```python
from datetime import UTC, datetime
created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False)
```

**Key Changes**:
1. Add `UTC` to imports: `from datetime import UTC, datetime`
2. Replace `datetime.utcnow` with `lambda: datetime.now(UTC)`
3. Use lambda because SQLAlchemy needs a callable

### Pattern 2: Update Naive `datetime.now()` to Timezone-Aware

**Before**:
```python
from datetime import datetime
created_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(), nullable=False
)
```

**After**:
```python
from datetime import UTC, datetime
created_at: datetime = Column(
    DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
)
```

**Key Changes**:
1. Add `UTC` to imports: `from datetime import UTC, datetime`
2. Replace `datetime.now()` with `datetime.now(UTC)`

### Pattern 3: Service Methods (Direct Calls)

**Before**:
```python
from datetime import datetime
existing.translated_at = datetime.utcnow()
```

**After**:
```python
from datetime import UTC, datetime
existing.translated_at = datetime.now(UTC)
```

**Key Changes**:
1. Add `UTC` to imports
2. Replace `datetime.utcnow()` with `datetime.now(UTC)`
3. NO lambda needed in service code (not SQLAlchemy context)

---

## ✅ Benefits of This Change

### 1. Timezone Awareness
- All timestamps explicitly UTC
- No ambiguity about timezone
- Prevents cross-timezone bugs

### 2. DST Handling
- UTC doesn't observe DST
- No "spring forward / fall back" issues
- Consistent 24-hour days

### 3. Modern Python Best Practice
- Python 3.12+ recommended approach
- `datetime.utcnow()` marked for deprecation
- Future-proof codebase

### 4. Database Compatibility
- PostgreSQL `TIMESTAMP WITH TIME ZONE` works best with explicit UTC
- Prevents timezone conversion errors
- Consistent with `DateTime(timezone=True)`

### 5. International Operations
- UTC is universal standard
- Easy conversion to any local timezone
- No server timezone dependency

---

## 🚨 CRITICAL NOTES

### DO NOT Modify These Files
- ❌ `demo_models.py` - Production-locked, requires approval
- ❌ `erp_models.py.deprecated` - Deprecated file, ignore
- ❌ Test files - Mock data, not production code

### Database Migration Required?
**NO** - This change only affects **future timestamps**:
- Existing data unchanged
- Column types unchanged (`TIMESTAMP WITH TIME ZONE`)
- Only default value generation changes
- Backward compatible

### Why Lambda?
SQLAlchemy requires a **callable** for `default` and `onupdate`:
- `datetime.utcnow` → Works (function reference)
- `datetime.now(UTC)` → ❌ Fails (immediate call)
- `lambda: datetime.now(UTC)` → ✅ Works (callable)

---

## 🎯 Implementation Plan

### Phase 1: High Priority Models (Week 3 Task)
1. ✅ Fix `pos_models.py` (6 models)
2. ✅ Fix `inventory_models.py` (4 models)

### Phase 2: Medium Priority Models
3. Fix `shopify_models.py` (5 models)
4. Fix `i18n_models.py` (6 models)
5. Fix `portal_forms_models.py` (2 models)
6. Fix `service_models.py` (1 model)
7. Fix `models/prd.py` (3 models)
8. Fix `models/subscription.py` (1 model)
9. Fix `models/invoicing.py` (3 models)

### Phase 3: Services
10. Fix `i18n_service.py` (2 occurrences)

### Phase 4: Verification
11. Run type-check: `cd apps/backend && uv run mypy src/`
12. Run lint: `cd apps/backend && uv run ruff check src/`
13. Test imports: `python -c "from datetime import UTC, datetime; print(datetime.now(UTC))"`
14. Create migration notes

---

## 🔍 Verification Commands

```bash
# Check for remaining datetime.utcnow
grep -r "datetime\.utcnow" apps/backend/src/db/ apps/backend/src/services/

# Check for naive datetime.now() (without UTC)
grep -r "datetime\.now()" apps/backend/src/db/ | grep -v "datetime.now(UTC)"

# Verify imports
grep -r "from datetime import" apps/backend/src/db/ | grep -v UTC

# Type check
cd apps/backend && uv run mypy src/db/

# Lint check
cd apps/backend && uv run ruff check src/db/
```

---

## 📊 Success Criteria

- [x] Audit complete
- [ ] All 10 files updated
- [ ] All ~54 occurrences fixed
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Documentation complete
- [ ] Changes committed

---

*Audit completed: 2026-02-11*
*Ready for implementation: Week 3 Task*
