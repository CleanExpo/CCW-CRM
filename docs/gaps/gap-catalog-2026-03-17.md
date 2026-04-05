# Gap Remediation Catalog - March 2026

**Date Created:** 2026-03-17
**Project:** CCW-ERP-CRM
**Worktree:** gap-remediation
**Total Gaps:** 95

## Executive Summary

This catalog documents 95 identified gaps across the CCW-ERP-CRM application discovered through comprehensive E2E health checks and code audits. Gaps are categorized into 5 implementation phases with clear priorities and dependencies.

### Gap Distribution

| Priority     | Count | Percentage | Description                                                               |
| ------------ | ----- | ---------- | ------------------------------------------------------------------------- |
| **Critical** | 38    | 40%        | Breaks functionality - missing endpoints, type mismatches, business logic |
| **Medium**   | 32    | 34%        | Missing features/polish - workflow improvements, integrations             |
| **Low**      | 25    | 26%        | Nice-to-haves - UI polish, advanced features                              |

### Phase Distribution

| Phase       | Description                    | Gaps | Avg Priority |
| ----------- | ------------------------------ | ---- | ------------ |
| **Phase 0** | Gap Cataloging & Linear Issues | 2    | Setup        |
| **Phase 1** | Type Contracts                 | 7    | Critical     |
| **Phase 2** | API Endpoints                  | 18   | Critical     |
| **Phase 3** | Business Logic Services        | 6    | Critical     |
| **Phase 4** | UI/UX Polish                   | 55   | Medium       |
| **Phase 5** | Test Coverage                  | 224  | Low          |

### Critical Path

```
Phase 0 (Setup)
    ↓
Phase 1 (Type Contracts) ← BLOCKS everything else
    ↓
Phase 2 (API Endpoints) ←→ Phase 3 (Business Logic) [Can run in parallel]
    ↓
Phase 4 (UI/UX Polish)
    ↓
Phase 5 (Test Coverage)
```

### Impact × Effort Matrix Summary

**High Impact, Low Effort (Quick Wins):** 12 gaps

- Type contract fixes (Phase 1)
- Empty state components (Phase 4B)

**High Impact, High Effort (Strategic):** 26 gaps

- API endpoints (Phase 2)
- Business logic services (Phase 3)
- E2E test coverage (Phase 5C)

**Low Impact, Low Effort (Fill-ins):** 35 gaps

- Confirmation dialogs (Phase 4C)
- Frontend unit tests (Phase 5A)

**Low Impact, High Effort (Backlog):** 22 gaps

- Backend unit tests (Phase 5B)
- Advanced UI polish

---

## Phase 0: Setup & Cataloging

### GAP-001: Gap Catalog Creation

- **Priority:** Setup
- **Type:** Documentation
- **Impact:** 5 | **Effort:** 2
- **Description:** Create structured catalog of all 95 gaps with priorities, dependencies, and implementation plan
- **Deliverable:** `docs/gaps/gap-catalog-2026-03-17.md`
- **Dependencies:** None
- **Blocks:** GAP-002, all implementation phases

### GAP-002: Linear Issue Structure

- **Priority:** Setup
- **Type:** Documentation
- **Impact:** 4 | **Effort:** 2
- **Description:** Document Linear issue templates for batch creation with proper labels, descriptions, and dependency relationships
- **Deliverable:** `docs/gaps/linear-issues-template.md`
- **Dependencies:** GAP-001
- **Blocks:** All implementation work tracking

---

## Phase 1: Type Contracts (7 Critical)

**Phase Goal:** Fix all TypeScript/Python type mismatches that break frontend-backend contracts

**Dependencies:** Phase 0
**Blocks:** Phase 2, Phase 3, Phase 4

### GAP-003: LocationStockResponse Type Mismatch

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 5 | **Effort:** 2
- **Description:** `warehouse.tsx` expects `items: LocationStockItem[]` but `inventory.ts` returns `items: InventoryItem[]`
- **Affected Files:**
  - `apps/web/app/(dashboard)/warehouse/page.tsx` (line 156)
  - `apps/web/lib/api/inventory.ts` (getStockByLocation method)
  - `apps/web/lib/types/inventory.ts` (LocationStockResponse interface)
- **Fix:** Update `LocationStockResponse` to match backend schema:
  ```typescript
  interface LocationStockResponse {
    items: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      location_id: string;
      location_name: string;
      quantity: number;
      reserved_quantity?: number;
      available_quantity: number;
    }>;
    total: number;
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-019 (warehouse ops endpoint), GAP-053 (warehouse tests)

### GAP-004: WarehouseOpsPayload Type Missing

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 5 | **Effort:** 1
- **Description:** `warehouse.tsx` uses `WarehouseOpsPayload` but type is not defined in `inventory.ts`
- **Affected Files:**
  - `apps/web/app/(dashboard)/warehouse/page.tsx` (line 103)
  - `apps/web/lib/api/inventory.ts` (missing type definition)
- **Fix:** Add type definition:
  ```typescript
  interface WarehouseOpsPayload {
    operation_type: 'pick' | 'pack' | 'ship' | 'receive';
    order_id?: string;
    items: Array<{
      product_id: string;
      quantity: number;
      location_id?: string;
    }>;
    notes?: string;
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-019 (warehouse ops endpoint)

### GAP-005: MarketplaceOrder Type Missing

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 5 | **Effort:** 2
- **Description:** `marketplace.tsx` uses `MarketplaceOrder` type but it's not defined in `marketplace.ts`
- **Affected Files:**
  - `apps/web/app/(dashboard)/orders/marketplace/page.tsx` (line 89)
  - `apps/web/lib/api/marketplace.ts` (missing type definition)
- **Fix:** Add comprehensive type:
  ```typescript
  interface MarketplaceOrder {
    id: string;
    marketplace_order_id: string;
    marketplace: 'shopify' | 'ebay' | 'facebook';
    order_number: string;
    customer_name: string;
    customer_email: string;
    total_amount: number;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    items: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      quantity: number;
      unit_price: number;
    }>;
    shipping_address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
    synced_at: string;
    created_at: string;
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-025 (marketplace sync endpoint)

### GAP-006: Cin7Fulfilment Schema Mismatch

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 4 | **Effort:** 2
- **Description:** `fulfilment/page.tsx` expects different schema than backend provides (missing `shipment_tracking` and `packed_items`)
- **Affected Files:**
  - `apps/web/app/(dashboard)/orders/fulfilment/page.tsx` (line 134)
  - `apps/backend/src/api/routes/integrations/cin7_fulfilment.py`
  - `apps/web/lib/api/cin7.ts` (Cin7Fulfilment type)
- **Fix:** Update frontend type to match backend:
  ```typescript
  interface Cin7Fulfilment {
    id: string;
    order_id: string;
    order_number: string;
    status: 'pending' | 'picking' | 'packing' | 'shipped' | 'delivered';
    shipment_tracking?: {
      carrier: string;
      tracking_number: string;
      tracking_url?: string;
    };
    packed_items: Array<{
      product_id: string;
      product_name: string;
      quantity_ordered: number;
      quantity_picked: number;
      quantity_packed: number;
    }>;
    created_at: string;
    updated_at: string;
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-023 (fulfilment endpoints)

### GAP-007: PaymentMethodEnum Missing

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 5 | **Effort:** 1
- **Description:** `billing/page.tsx` uses `PaymentMethodEnum` but it's not defined
- **Affected Files:**
  - `apps/web/app/(dashboard)/settings/billing/page.tsx` (line 67)
  - `apps/web/lib/api/billing.ts` (missing enum)
- **Fix:** Add enum:
  ```typescript
  enum PaymentMethodEnum {
    CREDIT_CARD = 'credit_card',
    DIRECT_DEBIT = 'direct_debit',
    BANK_TRANSFER = 'bank_transfer',
    PAYPAL = 'paypal',
    STRIPE = 'stripe',
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-011 (payment methods endpoint)

### GAP-008: SLAEscalationPayload Type Missing

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 4 | **Effort:** 1
- **Description:** `workflows/page.tsx` uses `SLAEscalationPayload` but type not defined
- **Affected Files:**
  - `apps/web/app/(dashboard)/workflows/page.tsx` (line 201)
  - `apps/web/lib/api/workflows.ts` (missing type)
- **Fix:** Add type:
  ```typescript
  interface SLAEscalationPayload {
    workflow_instance_id: string;
    escalation_level: number;
    reason: string;
    escalate_to_user_id?: string;
    notify_users: string[];
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-027 (SLA escalation endpoint)

### GAP-009: ReconciliationMatch Type Missing

- **Priority:** Critical
- **Type:** Type Contract
- **Impact:** 4 | **Effort:** 2
- **Description:** `reconciliation/page.tsx` uses `ReconciliationMatch` type not defined in API client
- **Affected Files:**
  - `apps/web/app/(dashboard)/finance/reconciliation/page.tsx` (line 178)
  - Backend: needs new type in financial routes
- **Fix:** Add type:
  ```typescript
  interface ReconciliationMatch {
    id: string;
    invoice_id: string;
    payment_id: string;
    match_confidence: number;
    match_type: 'exact' | 'partial' | 'suggested';
    amount_matched: number;
    amount_remaining: number;
    matched_at?: string;
  }
  ```
- **Dependencies:** None
- **Blocks:** GAP-033 (reconciliation endpoints)

---

## Phase 2: API Endpoints (18 Critical)

**Phase Goal:** Implement all missing backend API endpoints that frontend code expects

**Dependencies:** Phase 1 (type contracts must be fixed first)
**Blocks:** Phase 4 (UI polish needs working endpoints)

### Batch 2A: Payment & Billing (5 endpoints)

### GAP-010: POST /api/billing/payment-methods

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 5 | **Effort:** 3
- **Description:** Create payment method for customer billing
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/billing.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/settings/billing/page.tsx` (line 156)
- **Implementation:**
  ```python
  @router.post("/billing/payment-methods")
  async def create_payment_method(
      payload: PaymentMethodCreate,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> PaymentMethod:
      """Create new payment method for organization"""
      # Validate with Stripe API
      # Store in payment_methods table
      # Return payment method with masked details
  ```
- **Dependencies:** GAP-007 (PaymentMethodEnum type)
- **Related:** GAP-036 (business logic - payment validation)

### GAP-011: GET /api/billing/payment-methods/enum

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 1
- **Description:** Return available payment method types as enum
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/billing.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/settings/billing/page.tsx` (line 67)
- **Implementation:**
  ```python
  @router.get("/billing/payment-methods/enum")
  async def get_payment_method_enum() -> list[str]:
      """Get available payment method types"""
      return [
          "credit_card",
          "direct_debit",
          "bank_transfer",
          "paypal",
          "stripe"
      ]
  ```
- **Dependencies:** GAP-007 (PaymentMethodEnum type)
- **Related:** GAP-010

### GAP-012: POST /api/billing/dunning/send-letter

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 4
- **Description:** Send dunning letter for overdue invoice
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/billing.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/settings/billing/page.tsx` (line 234)
- **Implementation:**
  ```python
  @router.post("/billing/dunning/send-letter")
  async def send_dunning_letter(
      payload: DunningLetterPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> DunningLetterResponse:
      """Send dunning letter for overdue payment"""
      # Use dunning service (GAP-037)
      # Log dunning action
      # Schedule follow-up if configured
  ```
- **Dependencies:** GAP-037 (dunning service)
- **Related:** GAP-013 (subscription health)

### GAP-013: GET /api/billing/subscription-health

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 3 | **Effort:** 3
- **Description:** Dashboard widget showing subscription health metrics
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/billing.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/settings/billing/page.tsx` (line 189)
- **Implementation:**
  ```python
  @router.get("/billing/subscription-health")
  async def get_subscription_health(
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> SubscriptionHealthMetrics:
      """Get subscription health metrics"""
      # Active subscriptions
      # Churn risk score
      # Overdue invoices count
      # Revenue metrics
  ```
- **Dependencies:** None
- **Related:** GAP-012 (dunning)

### GAP-014: POST /api/billing/retry-failed-payment

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 5 | **Effort:** 3
- **Description:** Retry failed payment with optional new payment method
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/billing.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/settings/billing/page.tsx` (line 278)
- **Implementation:**
  ```python
  @router.post("/billing/retry-failed-payment")
  async def retry_failed_payment(
      payload: RetryPaymentPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> PaymentResult:
      """Retry a failed payment"""
      # Validate invoice + payment method
      # Process via Stripe
      # Update invoice status
      # Send notification
  ```
- **Dependencies:** GAP-010 (payment methods)
- **Related:** GAP-012 (dunning)

### Batch 2B: Inventory & Procurement (6 endpoints)

### GAP-015: POST /api/inventory/auto-reorder

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 5 | **Effort:** 4
- **Description:** Trigger auto-reorder for products below reorder point
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/inventory.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/inventory/page.tsx` (line 298)
- **Implementation:**
  ```python
  @router.post("/inventory/auto-reorder")
  async def trigger_auto_reorder(
      payload: AutoReorderPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> AutoReorderResult:
      """Trigger auto-reorder from ReorderRule"""
      # Use auto_reorder service (GAP-038)
      # Create purchase orders
      # Update reorder logs
  ```
- **Dependencies:** GAP-038 (auto-reorder service)
- **Related:** GAP-016 (three-way match)

### GAP-016: POST /api/procurement/three-way-match

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 5 | **Effort:** 3
- **Description:** Perform three-way match: PO + GRN + Invoice
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/procurement.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/procurement/page.tsx` (line 267)
- **Implementation:**
  ```python
  @router.post("/procurement/three-way-match")
  async def perform_three_way_match(
      payload: ThreeWayMatchPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> ThreeWayMatchResult:
      """Match PO, GRN, and Invoice"""
      # Use procurement_matching service (GAP-034)
      # Return match status + discrepancies
  ```
- **Dependencies:** GAP-034 (procurement matching service)
- **Related:** GAP-017 (unmatched PO items)

### GAP-017: GET /api/procurement/unmatched-po-items

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 2
- **Description:** List purchase order items not yet matched to GRN/invoice
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/procurement.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/procurement/page.tsx` (line 189)
- **Implementation:**
  ```python
  @router.get("/procurement/unmatched-po-items")
  async def get_unmatched_po_items(
      db: AsyncSession = Depends(get_async_db),
      status: str = Query(None),
      page: int = Query(1, ge=1),
      page_size: int = Query(50, ge=1, le=100)
  ) -> PaginatedResponse[PurchaseOrderItem]:
      """Get unmatched PO items"""
      # Query PO items without GRN match
      # Return with PO details
  ```
- **Dependencies:** GAP-016 (three-way match)
- **Related:** GAP-034 (procurement matching service)

### GAP-018: POST /api/inventory/bulk-adjust

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 3
- **Description:** Bulk adjust inventory quantities (stock take results)
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/inventory.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/inventory/stock-take/page.tsx` (line 234)
- **Implementation:**
  ```python
  @router.post("/inventory/bulk-adjust")
  async def bulk_adjust_inventory(
      payload: BulkAdjustPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> BulkAdjustResult:
      """Bulk adjust inventory from stock take"""
      # Validate adjustments
      # Update stock levels
      # Create audit trail
      # Return summary
  ```
- **Dependencies:** None
- **Related:** GAP-019 (stock takes)

### GAP-019: GET /api/inventory/stock-takes/active

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 3 | **Effort:** 2
- **Description:** Get active stock take sessions
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/inventory.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/inventory/stock-take/page.tsx` (line 98)
- **Implementation:**
  ```python
  @router.get("/inventory/stock-takes/active")
  async def get_active_stock_takes(
      db: AsyncSession = Depends(get_async_db)
  ) -> list[StockTake]:
      """Get active stock take sessions"""
      # Query stock_takes where status = 'in_progress'
      # Include item counts
  ```
- **Dependencies:** GAP-003 (LocationStockResponse type)
- **Related:** GAP-018 (bulk adjust)

### GAP-020: POST /api/inventory/cycle-count/generate

- **Priority:** Low
- **Type:** API Endpoint (Backend)
- **Impact:** 3 | **Effort:** 3
- **Description:** Generate cycle count schedule for ABC classification
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/inventory.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/inventory/cycle-count/page.tsx` (line 156)
- **Implementation:**
  ```python
  @router.post("/inventory/cycle-count/generate")
  async def generate_cycle_count_schedule(
      payload: CycleCountConfig,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> CycleCountSchedule:
      """Generate cycle count schedule"""
      # ABC classification
      # Schedule based on frequency
      # Return count tasks
  ```
- **Dependencies:** None
- **Related:** GAP-019 (stock takes)

### Batch 2C: Workflow & Approvals (4 endpoints)

### GAP-021: POST /api/workflows/sla/escalate

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 3
- **Description:** Manually escalate workflow instance for SLA breach
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/workflows.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/workflows/page.tsx` (line 201)
- **Implementation:**
  ```python
  @router.post("/workflows/sla/escalate")
  async def escalate_sla_breach(
      payload: SLAEscalationPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> SLAEscalation:
      """Escalate workflow for SLA breach"""
      # Use sla_escalation service (GAP-039)
      # Create escalation record
      # Send notifications
  ```
- **Dependencies:** GAP-008 (SLAEscalationPayload type), GAP-039 (SLA escalation service)
- **Related:** GAP-022 (pending approvals)

### GAP-022: GET /api/approvals/pending-my-approval

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 2
- **Description:** Get approvals pending for current user
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/approvals.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/approvals/page.tsx` (line 134)
- **Implementation:**
  ```python
  @router.get("/approvals/pending-my-approval")
  async def get_my_pending_approvals(
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> list[Approval]:
      """Get approvals assigned to current user"""
      # Query approvals where approver_id = current_user.id
      # Status = 'pending'
      # Include workflow context
  ```
- **Dependencies:** None
- **Related:** GAP-023 (bulk approve)

### GAP-023: POST /api/approvals/bulk-approve

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 3 | **Effort:** 3
- **Description:** Approve multiple workflow approvals in one request
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/approvals.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/approvals/page.tsx` (line 189)
- **Implementation:**
  ```python
  @router.post("/approvals/bulk-approve")
  async def bulk_approve(
      payload: BulkApprovalPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> BulkApprovalResult:
      """Bulk approve workflow approvals"""
      # Validate all approval_ids
      # Update status for each
      # Trigger workflow progression
      # Return success/failure per item
  ```
- **Dependencies:** GAP-022 (pending approvals)
- **Related:** GAP-021 (SLA escalation)

### GAP-024: GET /api/workflows/execution-stats

- **Priority:** Low
- **Type:** API Endpoint (Backend)
- **Impact:** 3 | **Effort:** 2
- **Description:** Workflow execution statistics for dashboard
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/workflows.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/workflows/page.tsx` (line 67)
- **Implementation:**
  ```python
  @router.get("/workflows/execution-stats")
  async def get_workflow_execution_stats(
      db: AsyncSession = Depends(get_async_db),
      days: int = Query(30, ge=1, le=365)
  ) -> WorkflowExecutionStats:
      """Get workflow execution statistics"""
      # Count by status
      # Average execution time
      # SLA compliance rate
      # Top bottlenecks
  ```
- **Dependencies:** None
- **Related:** GAP-021 (SLA escalation)

### Batch 2D: Financial & Tax (3 endpoints)

### GAP-025: POST /api/invoices/tax/calculate

- **Priority:** Critical
- **Type:** API Endpoint (Backend)
- **Impact:** 5 | **Effort:** 4
- **Description:** Calculate tax for invoice line items (GST, state taxes)
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/invoices.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/invoices/page.tsx` (line 312)
- **Implementation:**
  ```python
  @router.post("/invoices/tax/calculate")
  async def calculate_invoice_tax(
      payload: TaxCalculationPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> TaxCalculationResult:
      """Calculate tax for invoice"""
      # Use tax_calculator service (GAP-036)
      # Apply GST rules
      # Handle state-specific taxes
      # Return breakdown
  ```
- **Dependencies:** GAP-036 (tax calculator service)
- **Related:** GAP-026 (reconciliation)

### GAP-026: GET /api/reconciliation/match-suggestions

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 3
- **Description:** AI-suggested invoice-payment matches for reconciliation
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/reconciliation.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/finance/reconciliation/page.tsx` (line 178)
- **Implementation:**
  ```python
  @router.get("/reconciliation/match-suggestions")
  async def get_match_suggestions(
      db: AsyncSession = Depends(get_async_db),
      unmatched_only: bool = Query(True)
  ) -> list[ReconciliationMatch]:
      """Get AI-suggested reconciliation matches"""
      # Find unmatched invoices + payments
      # Match by amount, date proximity, reference
      # Return with confidence scores
  ```
- **Dependencies:** GAP-009 (ReconciliationMatch type)
- **Related:** GAP-027 (auto-match)

### GAP-027: POST /api/reconciliation/auto-match

- **Priority:** Medium
- **Type:** API Endpoint (Backend)
- **Impact:** 4 | **Effort:** 3
- **Description:** Auto-match high-confidence invoice-payment pairs
- **Affected Files:**
  - **Create:** `apps/backend/src/api/routes/reconciliation.py` (add endpoint)
  - **Used by:** `apps/web/app/(dashboard)/finance/reconciliation/page.tsx` (line 234)
- **Implementation:**
  ```python
  @router.post("/reconciliation/auto-match")
  async def auto_match_reconciliations(
      payload: AutoMatchPayload,
      db: AsyncSession = Depends(get_async_db),
      current_user: User = Depends(get_current_user)
  ) -> AutoMatchResult:
      """Auto-match reconciliations above confidence threshold"""
      # Get suggestions from GAP-026
      # Filter by confidence >= threshold
      # Create matches
      # Return summary
  ```
- **Dependencies:** GAP-026 (match suggestions), GAP-009 (ReconciliationMatch type)
- **Related:** GAP-025 (tax calculation)

---

## Phase 3: Business Logic Services (6 Critical)

**Phase Goal:** Implement core business logic services that API endpoints depend on

**Dependencies:** Phase 1 (type contracts)
**Can run in parallel with:** Phase 2 (API endpoints will consume these services)

### GAP-028: Three-Way PO Matching Service

- **Priority:** Critical
- **Type:** Business Logic (Backend)
- **Impact:** 5 | **Effort:** 5
- **Description:** Service for matching Purchase Order + GRN + Invoice
- **Affected Files:**
  - **Create:** `apps/backend/src/services/procurement_matching.py`
  - **Used by:** GAP-016 (procurement endpoint)
- **Implementation:**

  ```python
  class ProcurementMatchingService:
      async def three_way_match(
          self,
          po_id: str,
          grn_id: str,
          invoice_id: str,
          db: AsyncSession
      ) -> ThreeWayMatchResult:
          """
          Match PO, GRN, and Invoice

          Returns:
            - match_status: 'matched' | 'partial' | 'mismatch'
            - discrepancies: list of differences
            - matched_items: line items that match
            - variance_amount: total $ variance
          """
  ```

- **Logic:**
  1. Load PO, GRN, Invoice from DB
  2. Match line items by product_id
  3. Check: quantity_ordered == quantity_received == quantity_invoiced
  4. Check: unit_price matches within tolerance (e.g., 2%)
  5. Flag discrepancies
  6. Return match result
- **Dependencies:** None
- **Blocks:** GAP-016 (API endpoint)
- **Tests:** Unit tests for match scenarios (exact, partial, mismatch, over-delivery, under-delivery)

### GAP-029: Order State Machine Service

- **Priority:** Critical
- **Type:** Business Logic (Backend)
- **Impact:** 5 | **Effort:** 4
- **Description:** Enforce order status transitions and business rules
- **Affected Files:**
  - **Create:** `apps/backend/src/services/order_state.py`
  - **Used by:** Order update endpoints
- **Implementation:**

  ```python
  class OrderStateMachine:
      VALID_TRANSITIONS = {
          'draft': ['pending', 'cancelled'],
          'pending': ['confirmed', 'cancelled'],
          'confirmed': ['processing', 'cancelled'],
          'processing': ['shipped', 'cancelled'],
          'shipped': ['delivered'],
          'delivered': [],
          'cancelled': []
      }

      async def transition(
          self,
          order_id: str,
          from_status: OrderStatus,
          to_status: OrderStatus,
          db: AsyncSession
      ) -> OrderTransitionResult:
          """Validate and execute order status transition"""
  ```

- **Logic:**
  1. Validate transition is allowed
  2. Check business rules (e.g., can't ship without stock)
  3. Execute side effects (inventory reservation, notifications)
  4. Update order status
  5. Create audit log
- **Dependencies:** None
- **Blocks:** Order CRUD operations
- **Tests:** Test all valid/invalid transitions, business rule enforcement

### GAP-030: Tax Calculation Engine

- **Priority:** Critical
- **Type:** Business Logic (Backend)
- **Impact:** 5 | **Effort:** 5
- **Description:** Calculate GST and state-specific taxes for Australian invoices
- **Affected Files:**
  - **Create:** `apps/backend/src/services/tax_calculator.py`
  - **Used by:** GAP-025 (invoice tax endpoint)
- **Implementation:**

  ```python
  class TaxCalculator:
      GST_RATE = Decimal("0.10")  # 10% GST in Australia

      async def calculate_tax(
          self,
          line_items: list[InvoiceLineItem],
          customer_address: Address,
          invoice_date: date
      ) -> TaxCalculationResult:
          """
          Calculate tax breakdown for invoice

          Returns:
            - subtotal: pre-tax amount
            - gst_amount: GST (10%)
            - total: final amount including tax
            - tax_breakdown: per line item
          """
  ```

- **Logic:**
  1. Determine tax jurisdiction from customer address
  2. Apply GST (10%) to taxable items
  3. Handle tax-exempt items (exports, etc.)
  4. Calculate per-line and total tax
  5. Return detailed breakdown
- **Dependencies:** None
- **Blocks:** GAP-025 (invoice tax endpoint)
- **Tests:** GST calculation, tax-exempt items, rounding edge cases

### GAP-031: Dunning Letter Automation Service

- **Priority:** Critical
- **Type:** Business Logic (Backend)
- **Impact:** 4 | **Effort:** 4
- **Description:** Automated dunning letter workflow for overdue invoices
- **Affected Files:**
  - **Create:** `apps/backend/src/services/dunning.py`
  - **Used by:** GAP-012 (dunning endpoint)
- **Implementation:**

  ```python
  class DunningService:
      STAGES = [
          {'days_overdue': 7, 'letter_type': 'reminder'},
          {'days_overdue': 14, 'letter_type': 'warning'},
          {'days_overdue': 30, 'letter_type': 'final_notice'},
          {'days_overdue': 45, 'letter_type': 'collections'}
      ]

      async def send_dunning_letter(
          self,
          invoice_id: str,
          letter_type: str,
          db: AsyncSession
      ) -> DunningLetterResult:
          """Send dunning letter and schedule follow-up"""
  ```

- **Logic:**
  1. Load invoice + customer
  2. Check dunning history (don't duplicate)
  3. Generate letter from template
  4. Send via email
  5. Log dunning action
  6. Schedule next reminder if needed
- **Dependencies:** Email service
- **Blocks:** GAP-012 (dunning endpoint)
- **Tests:** Letter generation, scheduling logic, duplicate prevention

### GAP-032: Auto-Reorder Service

- **Priority:** Critical
- **Type:** Business Logic (Backend)
- **Impact:** 5 | **Effort:** 4
- **Description:** Automatically create purchase orders when stock falls below reorder point
- **Affected Files:**
  - **Create:** `apps/backend/src/services/auto_reorder.py`
  - **Used by:** GAP-015 (auto-reorder endpoint)
- **Implementation:**

  ```python
  class AutoReorderService:
      async def trigger_reorder(
          self,
          product_id: str | None,
          db: AsyncSession
      ) -> AutoReorderResult:
          """
          Create POs for products below reorder point

          If product_id is None, check all products.
          Otherwise, check specific product.

          Returns:
            - purchase_orders_created: list[PurchaseOrder]
            - products_checked: count
            - total_order_value: Decimal
          """
  ```

- **Logic:**
  1. Query products with stock < reorder_point
  2. For each product, load ReorderRule
  3. Calculate order quantity (reorder_quantity or economic_order_qty)
  4. Find preferred supplier
  5. Create draft purchase order
  6. Log reorder action
- **Dependencies:** ReorderRule model (already exists)
- **Blocks:** GAP-015 (auto-reorder endpoint)
- **Tests:** Reorder point detection, quantity calculation, multi-product batch

### GAP-033: SLA Escalation Logic Service

- **Priority:** Critical
- **Type:** Business Logic (Backend)
- **Impact:** 4 | **Effort:** 3
- **Description:** SLA breach detection and escalation workflow
- **Affected Files:**
  - **Create:** `apps/backend/src/services/sla_escalation.py`
  - **Used by:** GAP-021 (SLA escalation endpoint)
- **Implementation:**

  ```python
  class SLAEscalationService:
      async def escalate_breach(
          self,
          workflow_instance_id: str,
          escalation_level: int,
          db: AsyncSession
      ) -> SLAEscalation:
          """
          Escalate workflow instance for SLA breach

          Returns:
            - escalation_id: created escalation record
            - notified_users: list of users notified
            - next_escalation_at: datetime | None
          """
  ```

- **Logic:**
  1. Load workflow instance + SLA definition
  2. Validate SLA breach (time exceeded)
  3. Determine escalation recipient (manager hierarchy)
  4. Create escalation record
  5. Send notification
  6. Schedule next escalation if multi-tier
- **Dependencies:** WorkflowInstance, SLA models (already exist)
- **Blocks:** GAP-021 (SLA escalation endpoint)
- **Tests:** Escalation hierarchy, notification routing, time calculations

---

## Phase 4: UI/UX Polish (55 Medium/Low)

**Phase Goal:** Add error boundaries, empty states, and confirmation dialogs to all pages

**Dependencies:** Phase 2 (needs working endpoints for meaningful error handling)
**Blocks:** Phase 5 (tests validate UI polish)

### Batch 4A: ErrorBoundary Components (35 pages)

**Impact:** 3 | **Effort:** 1 each (low effort, high volume)

All pages below are missing `<ErrorBoundary>` wrapper. Add to each page:

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function Page() {
  return (
    <ErrorBoundary>
      {/* existing page content */}
    </ErrorBoundary>
  );
}
```

### GAP-034 through GAP-068: Add ErrorBoundary to 35 pages

- **Priority:** Medium
- **Type:** UI Polish (Frontend)
- **Impact:** 3 | **Effort:** 1 per page
- **Description:** Wrap each page in ErrorBoundary component for graceful error handling

**Pages requiring ErrorBoundary:**

1. **GAP-034:** `apps/web/app/(dashboard)/warehouse/page.tsx`
2. **GAP-035:** `apps/web/app/(dashboard)/orders/marketplace/page.tsx`
3. **GAP-036:** `apps/web/app/(dashboard)/procurement/page.tsx`
4. **GAP-037:** `apps/web/app/(dashboard)/inventory/stock-take/page.tsx`
5. **GAP-038:** `apps/web/app/(dashboard)/inventory/cycle-count/page.tsx`
6. **GAP-039:** `apps/web/app/(dashboard)/workflows/page.tsx`
7. **GAP-040:** `apps/web/app/(dashboard)/approvals/page.tsx`
8. **GAP-041:** `apps/web/app/(dashboard)/invoices/page.tsx`
9. **GAP-042:** `apps/web/app/(dashboard)/finance/reconciliation/page.tsx`
10. **GAP-043:** `apps/web/app/(dashboard)/settings/billing/page.tsx`
11. **GAP-044:** `apps/web/app/(dashboard)/workshop/equipment/page.tsx`
12. **GAP-045:** `apps/web/app/(dashboard)/workshop/schedule/page.tsx`
13. **GAP-046:** `apps/web/app/(dashboard)/workshop/templates/page.tsx`
14. **GAP-047:** `apps/web/app/(dashboard)/workshop/reminders/page.tsx`
15. **GAP-048:** `apps/web/app/(dashboard)/customers/health/page.tsx`
16. **GAP-049:** `apps/web/app/(dashboard)/customers/onboarding/page.tsx`
17. **GAP-050:** `apps/web/app/(dashboard)/customers/personas/page.tsx`
18. **GAP-051:** `apps/web/app/(dashboard)/contractors/page.tsx`
19. **GAP-052:** `apps/web/app/(dashboard)/service-requests/page.tsx`
20. **GAP-053:** `apps/web/app/(dashboard)/bank-feeds/page.tsx`
21. **GAP-054:** `apps/web/app/(dashboard)/alerts/page.tsx`
22. **GAP-055:** `apps/web/app/(dashboard)/reports/page.tsx`
23. **GAP-056:** `apps/web/app/(dashboard)/marketing/page.tsx`
24. **GAP-057:** `apps/web/app/(dashboard)/faq/page.tsx`
25. **GAP-058:** `apps/web/app/(dashboard)/pos/page.tsx`
26. **GAP-059:** `apps/web/app/(dashboard)/settings/integrations/page.tsx`
27. **GAP-060:** `apps/web/app/(dashboard)/orders/fulfilment/page.tsx`
28. **GAP-061:** `apps/web/app/(dashboard)/inventory/page.tsx`
29. **GAP-062:** `apps/web/app/(dashboard)/products/[id]/page.tsx`
30. **GAP-063:** `apps/web/app/(dashboard)/customers/[id]/page.tsx`
31. **GAP-064:** `apps/web/app/(dashboard)/contacts/[id]/page.tsx`
32. **GAP-065:** `apps/web/app/(dashboard)/products/page.tsx`
33. **GAP-066:** `apps/web/app/(dashboard)/customers/page.tsx`
34. **GAP-067:** `apps/web/app/(dashboard)/orders/page.tsx`
35. **GAP-068:** `apps/web/app/(dashboard)/quotes/page.tsx`

**Implementation:** Same for all - wrap page content in `<ErrorBoundary>` component

**Dependencies:** None (ErrorBoundary component already exists)

### Batch 4B: Empty State Components (20 pages)

**Impact:** 3 | **Effort:** 2 each

Add empty state when data arrays are empty:

```typescript
{items.length === 0 ? (
  <EmptyState
    icon={PackageIcon}
    title="No items found"
    description="Get started by creating your first item"
    action={<Button onClick={handleCreate}>Create Item</Button>}
  />
) : (
  <Table>...</Table>
)}
```

### GAP-069 through GAP-088: Add Empty States to 20 pages

- **Priority:** Medium
- **Type:** UI Polish (Frontend)
- **Impact:** 3 | **Effort:** 2 per page
- **Description:** Display friendly empty state instead of blank table

**Pages requiring EmptyState:**

1. **GAP-069:** `warehouse/page.tsx` (no operations)
2. **GAP-070:** `orders/marketplace/page.tsx` (no marketplace orders)
3. **GAP-071:** `procurement/page.tsx` (no purchase orders)
4. **GAP-072:** `inventory/stock-take/page.tsx` (no stock takes)
5. **GAP-073:** `inventory/cycle-count/page.tsx` (no cycle counts)
6. **GAP-074:** `workflows/page.tsx` (no workflows)
7. **GAP-075:** `approvals/page.tsx` (no approvals)
8. **GAP-076:** `invoices/page.tsx` (no invoices)
9. **GAP-077:** `finance/reconciliation/page.tsx` (no reconciliations)
10. **GAP-078:** `workshop/equipment/page.tsx` (no equipment)
11. **GAP-079:** `workshop/schedule/page.tsx` (no bookings)
12. **GAP-080:** `workshop/templates/page.tsx` (no templates)
13. **GAP-081:** `workshop/reminders/page.tsx` (no reminders)
14. **GAP-082:** `contractors/page.tsx` (no contractors)
15. **GAP-083:** `service-requests/page.tsx` (no requests)
16. **GAP-084:** `bank-feeds/page.tsx` (no transactions)
17. **GAP-085:** `alerts/page.tsx` (no alerts)
18. **GAP-086:** `orders/fulfilment/page.tsx` (no fulfilments)
19. **GAP-087:** `inventory/page.tsx` (no inventory items)
20. **GAP-088:** `pos/page.tsx` (no transactions)

**Dependencies:** None (EmptyState component pattern exists)

---

## Phase 5: Test Coverage (224 gaps)

**Phase Goal:** Comprehensive test coverage across frontend, backend, and E2E

**Dependencies:** Phase 4 (tests validate completed features)
**Blocks:** None (final validation phase)

### Batch 5A: Frontend Unit Tests (51 new tests)

**Impact:** 2 | **Effort:** 2-3 per test file

From UNI-1252, expand to cover all pages:

### GAP-089: Inventory Page Tests

- **Priority:** Low
- **Type:** Test (Frontend)
- **Impact:** 2 | **Effort:** 3
- **Description:** Vitest unit tests for `inventory/page.tsx`
- **File:** `apps/web/__tests__/app/inventory/page.test.tsx`
- **Coverage:**
  - Renders inventory table
  - Stock level filters work
  - Barcode scanner integration
  - Auto-reorder button triggers API
  - Bulk adjust modal
- **Dependencies:** GAP-015 (auto-reorder endpoint)

### GAP-090: Billing Page Tests

- **Priority:** Low
- **Type:** Test (Frontend)
- **Impact:** 2 | **Effort:** 3
- **Description:** Vitest unit tests for `settings/billing/page.tsx`
- **File:** `apps/web/__tests__/app/settings/billing/page.test.tsx`
- **Coverage:**
  - Payment methods CRUD
  - Dunning letter triggers
  - Subscription health widget
  - Retry failed payment
- **Dependencies:** GAP-010-014 (billing endpoints)

### GAP-091: Workshop Pages Tests

- **Priority:** Low
- **Type:** Test (Frontend)
- **Impact:** 2 | **Effort:** 4
- **Description:** Vitest tests for 4 workshop pages
- **Files:**
  - `apps/web/__tests__/app/workshop/equipment/page.test.tsx`
  - `apps/web/__tests__/app/workshop/schedule/page.test.tsx`
  - `apps/web/__tests__/app/workshop/templates/page.test.tsx`
  - `apps/web/__tests__/app/workshop/reminders/page.test.tsx`
- **Coverage:**
  - Equipment CRUD
  - Booking calendar
  - Service templates
  - Reminder notifications

### GAP-092: Warehouse Page Tests

- **Priority:** Low
- **Type:** Test (Frontend)
- **Impact:** 2 | **Effort:** 3
- **Description:** Vitest tests for `warehouse/page.tsx`
- **File:** `apps/web/__tests__/app/warehouse/page.test.tsx`
- **Coverage:**
  - Warehouse operations tabs
  - Stock by location
  - Transfer requests
  - Pick/pack/ship workflows
- **Dependencies:** GAP-003 (LocationStockResponse type)

### GAP-093: Procurement & Approvals Tests

- **Priority:** Low
- **Type:** Test (Frontend)
- **Impact:** 2 | **Effort:** 4
- **Description:** Vitest tests for procurement + approvals
- **Files:**
  - `apps/web/__tests__/app/procurement/page.test.tsx`
  - `apps/web/__tests__/app/approvals/page.test.tsx`
- **Coverage:**
  - Three-way match UI
  - Unmatched PO items
  - Pending approvals list
  - Bulk approve
- **Dependencies:** GAP-016, GAP-022, GAP-023

### GAP-094 through GAP-139: Remaining Frontend Unit Tests (46 more)

**Repeat pattern for all 55 pages** (10 highest priority already scoped above):

- CRM health/onboarding/personas pages (3 tests)
- Marketplace orders page (1 test)
- Invoices + reconciliation pages (2 tests)
- Workflow pages (1 test)
- Contractors + service requests (2 tests)
- Bank feeds + alerts (2 tests)
- All remaining dashboard pages (35 tests)

**Total:** 51 new test files

### Batch 5B: Backend Unit Tests (157 new tests)

**Impact:** 2 | **Effort:** 2-4 per route file

From E2E health check, expand pytest coverage:

### GAP-140: Billing Routes Tests

- **Priority:** Low
- **Type:** Test (Backend)
- **Impact:** 2 | **Effort:** 4
- **Description:** Pytest tests for `billing.py` routes
- **File:** `apps/backend/tests/api/test_billing.py`
- **Coverage:**
  - POST /payment-methods (create, validation)
  - GET /payment-methods/enum
  - POST /dunning/send-letter
  - GET /subscription-health
  - POST /retry-failed-payment
- **Dependencies:** GAP-010-014 (endpoints must exist)

### GAP-141: Inventory Routes Tests

- **Priority:** Low
- **Type:** Test (Backend)
- **Impact:** 2 | **Effort:** 4
- **Description:** Pytest tests for `inventory.py` routes
- **File:** `apps/backend/tests/api/test_inventory.py`
- **Coverage:**
  - POST /auto-reorder
  - POST /bulk-adjust
  - GET /stock-takes/active
  - POST /cycle-count/generate
- **Dependencies:** GAP-015, GAP-018-020

### GAP-142: Procurement Routes Tests

- **Priority:** Low
- **Type:** Test (Backend)
- **Impact:** 2 | **Effort:** 3
- **Description:** Pytest tests for `procurement.py` routes
- **File:** `apps/backend/tests/api/test_procurement.py`
- **Coverage:**
  - POST /three-way-match
  - GET /unmatched-po-items
- **Dependencies:** GAP-016, GAP-017

### GAP-143: Workflow & Approval Routes Tests

- **Priority:** Low
- **Type:** Test (Backend)
- **Impact:** 2 | **Effort:** 4
- **Description:** Pytest tests for workflow routes
- **Files:**
  - `apps/backend/tests/api/test_workflows.py`
  - `apps/backend/tests/api/test_approvals.py`
- **Coverage:**
  - POST /workflows/sla/escalate
  - GET /workflows/execution-stats
  - GET /approvals/pending-my-approval
  - POST /approvals/bulk-approve
- **Dependencies:** GAP-021-024

### GAP-144: Financial Routes Tests

- **Priority:** Low
- **Type:** Test (Backend)
- **Impact:** 2 | **Effort:** 3
- **Description:** Pytest tests for invoice + reconciliation routes
- **Files:**
  - `apps/backend/tests/api/test_invoices.py`
  - `apps/backend/tests/api/test_reconciliation.py`
- **Coverage:**
  - POST /invoices/tax/calculate
  - GET /reconciliation/match-suggestions
  - POST /reconciliation/auto-match
- **Dependencies:** GAP-025-027

### GAP-145: Business Logic Service Tests

- **Priority:** Low
- **Type:** Test (Backend)
- **Impact:** 3 | **Effort:** 5
- **Description:** Pytest tests for all 6 business services
- **Files:**
  - `apps/backend/tests/services/test_procurement_matching.py`
  - `apps/backend/tests/services/test_order_state.py`
  - `apps/backend/tests/services/test_tax_calculator.py`
  - `apps/backend/tests/services/test_dunning.py`
  - `apps/backend/tests/services/test_auto_reorder.py`
  - `apps/backend/tests/services/test_sla_escalation.py`
- **Coverage:** All business logic edge cases, error handling, state transitions
- **Dependencies:** GAP-028-033 (services must exist)

### GAP-146 through GAP-296: Remaining Backend Tests (151 more)

**Scope:**

- All existing routes without tests (warehouse, workshop, CRM, marketplace)
- Integration tests for Cin7/Xero/Shopify new endpoints
- Model validation tests
- Database query optimization tests

**Total:** 157 new backend test files

### Batch 5C: E2E Tests (16 new Playwright specs)

**Impact:** 3 | **Effort:** 4-5 per spec

From UNI-1253, expand E2E coverage:

### GAP-297: Warehouse E2E Spec

- **Priority:** Low
- **Type:** Test (E2E)
- **Impact:** 3 | **Effort:** 4
- **Description:** Playwright E2E tests for warehouse workflows
- **File:** `apps/web/__tests__/e2e/warehouse.spec.ts`
- **Scenarios:**
  - View stock by location
  - Create transfer request
  - Pick/pack/ship order
  - Adjust stock levels
- **Dependencies:** GAP-003, GAP-019

### GAP-298: Workshop E2E Spec

- **Priority:** Low
- **Type:** Test (E2E)
- **Impact:** 3 | **Effort:** 5
- **Description:** Playwright E2E tests for workshop management
- **File:** `apps/web/__tests__/e2e/workshop.spec.ts`
- **Scenarios:**
  - Add equipment
  - Create service template
  - Book service appointment
  - Generate reminders
- **Dependencies:** Workshop endpoints (already exist)

### GAP-299: Billing E2E Spec

- **Priority:** Low
- **Type:** Test (E2E)
- **Impact:** 3 | **Effort:** 5
- **Description:** Playwright E2E tests for billing workflows
- **File:** `apps/web/__tests__/e2e/billing.spec.ts`
- **Scenarios:**
  - Add payment method
  - Retry failed payment
  - Send dunning letter
  - View subscription health
- **Dependencies:** GAP-010-014

### GAP-300: CRM Health E2E Spec

- **Priority:** Low
- **Type:** Test (E2E)
- **Impact:** 3 | **Effort:** 4
- **Description:** Playwright E2E for CRM features
- **File:** `apps/web/__tests__/e2e/crm-health.spec.ts`
- **Scenarios:**
  - View customer health scores
  - Assign personas
  - Track onboarding sequence
- **Dependencies:** CRM endpoints (already exist)

### GAP-301: Procurement E2E Spec

- **Priority:** Low
- **Type:** Test (E2E)
- **Impact:** 3 | **Effort:** 5
- **Description:** Playwright E2E for procurement workflows
- **File:** `apps/web/__tests__/e2e/procurement.spec.ts`
- **Scenarios:**
  - Create purchase order
  - Receive GRN
  - Perform three-way match
  - View unmatched items
- **Dependencies:** GAP-016, GAP-017

### GAP-302 through GAP-312: Remaining E2E Specs (11 more)

**Scope:**

- Inventory (stock take, cycle count, auto-reorder)
- Workflows (SLA escalation, approvals)
- Invoices (tax calculation, reconciliation)
- Marketplace orders
- Contractors
- Service requests
- Bank feeds
- Alerts

**Total:** 16 new E2E specs

---

## Dependency Graph

### Critical Path (Must follow this order)

```
Phase 0: Setup
    ↓
Phase 1: Type Contracts (7 gaps)
    ↓
    ├─→ Phase 2: API Endpoints (18 gaps) ←─┐
    │                                       │
    └─→ Phase 3: Business Services (6)  ───┘
                    ↓
          Phase 4: UI/UX Polish (55 gaps)
                    ↓
          Phase 5: Test Coverage (224 gaps)
```

### Blocking Relationships

**Phase 1 blocks everything:**

- GAP-003 → GAP-019, GAP-053, GAP-092, GAP-297
- GAP-004 → GAP-019
- GAP-005 → GAP-025
- GAP-006 → GAP-023
- GAP-007 → GAP-011
- GAP-008 → GAP-027
- GAP-009 → GAP-033, GAP-027

**Phase 3 services block Phase 2 endpoints:**

- GAP-028 (matching service) → GAP-016 (three-way match endpoint)
- GAP-029 (order state) → Order CRUD
- GAP-030 (tax calc) → GAP-025 (tax endpoint)
- GAP-031 (dunning) → GAP-012 (dunning endpoint)
- GAP-032 (auto-reorder) → GAP-015 (auto-reorder endpoint)
- GAP-033 (SLA escalation) → GAP-021 (escalation endpoint)

**Phase 2 endpoints block Phase 4 UI:**

- All billing endpoints (GAP-010-014) → GAP-043, GAP-090
- All inventory endpoints (GAP-015, GAP-018-020) → GAP-061, GAP-089
- All procurement endpoints (GAP-016-017) → GAP-036, GAP-093
- All workflow endpoints (GAP-021-024) → GAP-039, GAP-075

**Phase 4 blocks Phase 5 tests:**

- All UI polish (GAP-034-088) → E2E specs (GAP-297-312)

---

## Impact × Effort Matrix

### Scoring Methodology

**Impact (1-5):**

- 5: Breaks core functionality (payment, orders, inventory)
- 4: Missing important features (workflows, procurement)
- 3: UX improvements (empty states, error boundaries)
- 2: Nice-to-haves (advanced features)
- 1: Optional polish

**Effort (1-5):**

- 1: < 1 hour (add ErrorBoundary, simple types)
- 2: 1-2 hours (empty states, simple endpoints)
- 3: 2-4 hours (moderate endpoints, basic services)
- 4: 4-8 hours (complex services, E2E tests)
- 5: 8+ hours (tax engine, three-way matching)

### Quadrant Distribution

**Q1: High Impact, Low Effort (Quick Wins) - 12 gaps**

- Phase 1: All 7 type contracts (Impact: 4-5, Effort: 1-2)
- GAP-011: GET payment-methods/enum (Impact: 4, Effort: 1)
- GAP-019: GET active stock-takes (Impact: 3, Effort: 2)
- GAP-022: GET pending approvals (Impact: 4, Effort: 2)
- GAP-024: GET workflow stats (Impact: 3, Effort: 2)
- GAP-026: GET match suggestions (Impact: 4, Effort: 3)

**Q2: High Impact, High Effort (Strategic) - 26 gaps**

- Phase 3: All 6 business services (Impact: 4-5, Effort: 3-5)
- GAP-010: POST payment-methods (Impact: 5, Effort: 3)
- GAP-012: POST dunning letter (Impact: 4, Effort: 4)
- GAP-014: POST retry payment (Impact: 5, Effort: 3)
- GAP-015: POST auto-reorder (Impact: 5, Effort: 4)
- GAP-016: POST three-way match (Impact: 5, Effort: 3)
- GAP-018: POST bulk-adjust (Impact: 4, Effort: 3)
- GAP-021: POST SLA escalate (Impact: 4, Effort: 3)
- GAP-023: POST bulk-approve (Impact: 3, Effort: 3)
- GAP-025: POST tax calculate (Impact: 5, Effort: 4)
- GAP-027: POST auto-match (Impact: 4, Effort: 3)
- E2E tests (GAP-297-312): All Impact: 3, Effort: 4-5

**Q3: Low Impact, Low Effort (Fill-ins) - 35 gaps**

- ErrorBoundary (GAP-034-068): 35 gaps (Impact: 3, Effort: 1)

**Q4: Low Impact, High Effort (Backlog) - 22 gaps**

- EmptyState (GAP-069-088): 20 gaps (Impact: 3, Effort: 2)
- Backend unit tests (GAP-140-296): Most (Impact: 2, Effort: 2-4)

---

## Implementation Roadmap

### Sprint 1: Foundation (2 weeks)

- **Week 1:** Phase 0 + Phase 1 (Gap catalog + all type contracts)
- **Week 2:** Phase 3 Batch A (3 highest priority services: tax calc, three-way match, auto-reorder)

**Deliverables:**

- All type contracts fixed
- 3 core business services
- 0 TypeScript errors

### Sprint 2: Critical APIs (2 weeks)

- **Week 1:** Phase 2 Batch 2A + 2B (Billing + Inventory endpoints)
- **Week 2:** Phase 2 Batch 2C + 2D (Workflow + Financial endpoints)

**Deliverables:**

- All 18 API endpoints
- All backend services complete
- Postman/Insomnia collection for testing

### Sprint 3: UI Polish (1 week)

- **Week 1:** Phase 4 Batch 4A + 4B (ErrorBoundary + EmptyState)

**Deliverables:**

- All 55 UI polish gaps closed
- Better error UX

### Sprint 4: Test Coverage (2 weeks)

- **Week 1:** Phase 5 Batch 5A + 5B (Frontend + Backend unit tests)
- **Week 2:** Phase 5 Batch 5C (E2E specs)

**Deliverables:**

- 51 frontend unit tests
- 157 backend unit tests
- 16 E2E specs
- 90%+ code coverage

**Total Timeline:** 7 weeks

---

## Linear Issue Labels

### Standard Labels

- `gap-remediation` (all issues)
- `priority-critical` (38 issues)
- `priority-medium` (32 issues)
- `priority-low` (25 issues)

### Domain Labels

- `domain-frontend` (TypeScript, React, UI)
- `domain-backend` (Python, FastAPI, services)
- `domain-test` (Vitest, Pytest, Playwright)
- `domain-type-contract` (Phase 1 issues)

### Phase Labels

- `phase-0-setup`
- `phase-1-types`
- `phase-2-api`
- `phase-3-services`
- `phase-4-ui`
- `phase-5-tests`

### Batch Labels

- `batch-2a-billing`
- `batch-2b-inventory`
- `batch-2c-workflow`
- `batch-2d-financial`
- `batch-4a-error-boundary`
- `batch-4b-empty-state`
- `batch-5a-frontend-tests`
- `batch-5b-backend-tests`
- `batch-5c-e2e-tests`

---

## Risk Assessment

### High Risk Areas

**1. Type Contract Mismatches (Phase 1)**

- **Risk:** Breaking changes to existing working pages
- **Mitigation:** Test each type fix in isolation, verify frontend still compiles
- **Validation:** Run `pnpm run type-check` after each fix

**2. Business Logic Services (Phase 3)**

- **Risk:** Complex logic with edge cases (tax calc, three-way match)
- **Mitigation:** Write comprehensive unit tests first (TDD approach)
- **Validation:** 100% code coverage on services before integration

**3. API Endpoint Integration (Phase 2)**

- **Risk:** Frontend expectations don't match backend implementation
- **Mitigation:** Follow type contracts from Phase 1 exactly
- **Validation:** Integration tests + Postman collection

**4. Test Suite Maintenance (Phase 5)**

- **Risk:** 224 new tests = high maintenance burden
- **Mitigation:** Use test helpers, fixtures, and shared utilities
- **Validation:** All tests must be deterministic (no flaky tests)

### Medium Risk Areas

**1. Database Performance**

- **Risk:** New endpoints may have N+1 queries
- **Mitigation:** Use `.joinedload()` for relationships, add indexes
- **Validation:** Monitor query counts in tests

**2. Error Boundary Cascades**

- **Risk:** ErrorBoundary might catch too much, hiding real issues
- **Mitigation:** Log all errors to Sentry, clear error boundaries
- **Validation:** Manual testing of error scenarios

---

## Success Metrics

### Phase 1 Success Criteria

- ✅ 0 TypeScript errors in `pnpm run type-check`
- ✅ All 7 type contracts documented in code comments
- ✅ Frontend builds without warnings

### Phase 2 Success Criteria

- ✅ All 18 endpoints return 200/201 for happy path
- ✅ Postman collection with example requests
- ✅ OpenAPI schema updated

### Phase 3 Success Criteria

- ✅ 100% unit test coverage on all 6 services
- ✅ All edge cases documented + tested
- ✅ Services used by at least one endpoint

### Phase 4 Success Criteria

- ✅ All 55 pages have ErrorBoundary + EmptyState
- ✅ Manual QA pass on 10 representative pages
- ✅ No console errors in browser

### Phase 5 Success Criteria

- ✅ 90%+ code coverage (frontend + backend)
- ✅ All E2E specs pass in CI
- ✅ 0 flaky tests
- ✅ Test suite runs in < 5 minutes

---

## Appendix A: File Path Reference

### Frontend Pages

```
apps/web/app/(dashboard)/
├── warehouse/page.tsx
├── orders/
│   ├── marketplace/page.tsx
│   └── fulfilment/page.tsx
├── procurement/page.tsx
├── inventory/
│   ├── page.tsx
│   ├── stock-take/page.tsx
│   └── cycle-count/page.tsx
├── workflows/page.tsx
├── approvals/page.tsx
├── invoices/page.tsx
├── finance/reconciliation/page.tsx
├── settings/billing/page.tsx
├── workshop/
│   ├── equipment/page.tsx
│   ├── schedule/page.tsx
│   ├── templates/page.tsx
│   └── reminders/page.tsx
└── customers/
    ├── health/page.tsx
    ├── onboarding/page.tsx
    └── personas/page.tsx
```

### Backend Routes

```
apps/backend/src/api/routes/
├── billing.py
├── inventory.py
├── procurement.py
├── workflows.py
├── approvals.py
├── invoices.py
├── reconciliation.py
└── integrations/
    └── cin7_fulfilment.py
```

### Backend Services

```
apps/backend/src/services/
├── procurement_matching.py
├── order_state.py
├── tax_calculator.py
├── dunning.py
├── auto_reorder.py
└── sla_escalation.py
```

### Test Files

```
apps/web/__tests__/
├── app/
│   ├── inventory/page.test.tsx
│   ├── settings/billing/page.test.tsx
│   └── ...
└── e2e/
    ├── warehouse.spec.ts
    ├── workshop.spec.ts
    └── ...

apps/backend/tests/
├── api/
│   ├── test_billing.py
│   ├── test_inventory.py
│   └── ...
└── services/
    ├── test_procurement_matching.py
    └── ...
```

---

## Document History

| Date       | Version | Changes                                       |
| ---------- | ------- | --------------------------------------------- |
| 2026-03-17 | 1.0     | Initial catalog creation - 95 gaps documented |

---

**END OF GAP CATALOG**
