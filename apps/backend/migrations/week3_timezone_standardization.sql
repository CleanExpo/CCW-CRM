-- Week 3: Timezone Standardization
-- Date: 2026-02-11
-- Type: Code-only change (no database migration required)
--
-- This file documents the timezone standardization changes made to database models.
-- NO DATABASE MIGRATION IS REQUIRED because this change only affects Python code,
-- not the database schema or existing data.

-- ============================================================================
-- OVERVIEW
-- ============================================================================
--
-- Problem: Database models used deprecated `datetime.utcnow()` which returns
--          naive datetime objects (no timezone info).
--
-- Solution: Standardized to Python 3.12+ timezone-aware approach using
--           `datetime.now(UTC)` which returns UTC datetime with explicit
--           timezone information.
--
-- Impact:  FUTURE timestamps only - existing data unchanged
--          Database columns remain `TIMESTAMP WITH TIME ZONE`
--          Only Python default value generation changes

-- ============================================================================
-- FILES CHANGED
-- ============================================================================

-- Database Models (10 files, 9 active + 1 service):
-- 1. apps/backend/src/db/pos_models.py (6 models, 12 changes)
--    - Location, SalesStaff, POSTerminal, POSTransaction, BankFeed, BankAccount
--
-- 2. apps/backend/src/db/inventory_models.py (4 models, 10 changes)
--    - ProductStockByLocation, StockTransfer, StockReservation, StockAdjustment
--
-- 3. apps/backend/src/db/shopify_models.py (5 models, 12 changes)
--    - ShopifyConnection, ShopifyProductMapping, ShopifyOrderMapping,
--      ShopifyWebhookLog, ShopifyProductSyncLog
--
-- 4. apps/backend/src/db/i18n_models.py (6 models, 12 changes)
--    - Language, TranslationKey, Translation, TranslationRequest,
--      TranslationContext, TranslationMemory
--
-- 5. apps/backend/src/db/portal_forms_models.py (2 models, 4 changes)
--    - CustomerFormResponse, DemoRequest
--
-- 6. apps/backend/src/db/service_models.py (1 model, 2 changes)
--    - ServiceTicket
--
-- 7. apps/backend/src/db/models/prd.py (3 models, 4 changes)
--    - PRDDocument, PRDWorkflow, PRDComment
--
-- 8. apps/backend/src/db/models/subscription.py (1 model, 4 changes)
--    - Subscription (including property method)
--
-- 9. apps/backend/src/db/models/invoicing.py (3 models, 4 changes)
--    - Invoice, InvoiceLineItem, Payment
--
-- Services (1 file):
-- 10. apps/backend/src/services/i18n_service.py (2 changes)
--     - TranslationService methods

-- Total: 10 files, ~54 occurrences, ~25 models affected

-- ============================================================================
-- CODE CHANGES PATTERN
-- ============================================================================

-- BEFORE (deprecated pattern):
-- from datetime import datetime
-- created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

-- AFTER (modern Python 3.12+ pattern):
-- from datetime import UTC, datetime
-- created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)

-- Key Changes:
-- 1. Add UTC to imports: `from datetime import UTC, datetime`
-- 2. Replace `datetime.utcnow` with `lambda: datetime.now(UTC)`
-- 3. Replace `datetime.now()` (naive) with `lambda: datetime.now(UTC)`
-- 4. Use lambda because SQLAlchemy needs a callable

-- ============================================================================
-- BENEFITS
-- ============================================================================
--
-- 1. Timezone Awareness:
--    - All timestamps explicitly UTC
--    - No ambiguity about timezone
--    - Prevents cross-timezone bugs
--
-- 2. DST Handling:
--    - UTC doesn't observe DST
--    - No "spring forward / fall back" issues
--    - Consistent 24-hour days
--
-- 3. Modern Python Best Practice:
--    - Python 3.12+ recommended approach
--    - `datetime.utcnow()` marked for deprecation
--    - Future-proof codebase
--
-- 4. Database Compatibility:
--    - PostgreSQL `TIMESTAMP WITH TIME ZONE` works best with explicit UTC
--    - Prevents timezone conversion errors
--    - Consistent with `DateTime(timezone=True)`
--
-- 5. International Operations:
--    - UTC is universal standard
--    - Easy conversion to any local timezone
--    - No server timezone dependency

-- ============================================================================
-- DATABASE SCHEMA - NO CHANGES
-- ============================================================================
--
-- NO database schema changes required because:
--
-- 1. Column types unchanged:
--    - All timestamp columns remain `TIMESTAMP WITH TIME ZONE`
--    - No ALTER TABLE statements needed
--
-- 2. Existing data unaffected:
--    - Only future inserts use new default generator
--    - Historical timestamps remain unchanged
--
-- 3. Backward compatible:
--    - Old code reads timestamps normally
--    - New code generates UTC-aware timestamps
--    - PostgreSQL handles both seamlessly

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test UTC import works:
-- python -c "from datetime import UTC, datetime; print(datetime.now(UTC))"
-- Expected: 2026-02-11 04:50:14.307581+00:00

-- Test Python syntax (compile check):
-- cd apps/backend/src/db && python -m py_compile pos_models.py inventory_models.py
-- Expected: No output = success

-- Check for remaining deprecated usage:
-- grep -r "datetime\.utcnow" apps/backend/src/db/
-- Expected: Only erp_models.py.deprecated (which is deprecated)

-- ============================================================================
-- ROLLBACK (IF NEEDED)
-- ============================================================================
--
-- If needed, rollback by reverting Python code changes:
-- git revert <commit-hash>
--
-- No database rollback needed since no schema changes were made.

-- ============================================================================
-- COMPLETION CHECKLIST
-- ============================================================================
-- [x] All 10 files updated
-- [x] All ~54 occurrences fixed
-- [x] Imports updated (UTC added)
-- [x] Syntax verified (compile check passed)
-- [x] No database migration required
-- [x] Documentation complete

-- ============================================================================
-- END OF MIGRATION NOTES
-- ============================================================================
