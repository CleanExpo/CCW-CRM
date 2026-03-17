# Linear Issues Template - Gap Remediation

**Project:** CCW-ERP-CRM
**Created:** 2026-03-17
**Total Issues:** 95

This document provides the structure for batch-creating Linear issues for all 95 gaps. Each section can be copied into Linear's bulk import or created via API.

---

## Import Instructions

### Option 1: Linear API (Recommended)

Use the Linear GraphQL API to batch-create issues:

```graphql
mutation CreateIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    issue {
      id
      identifier
      title
    }
  }
}
```

### Option 2: Linear Bulk Import

1. Go to Linear → Your Team → Issues
2. Click "Import" → "CSV Import"
3. Use the CSV format below

### Option 3: Manual Creation

Copy each issue block below and paste into Linear's issue creation dialog.

---

## CSV Format for Bulk Import

```csv
Title,Description,Priority,Labels,Status,Estimate,Blocked By
"[GAP-001] Create Gap Remediation Catalog","Create structured catalog of all 95 gaps with priorities, dependencies, and implementation plan.\n\nDeliverable: docs/gaps/gap-catalog-2026-03-17.md",0,"gap-remediation,phase-0-setup,domain-documentation",Backlog,2,
"[GAP-002] Document Linear Issue Structure","Document Linear issue templates for batch creation with proper labels, descriptions, and dependency relationships.\n\nDeliverable: docs/gaps/linear-issues-template.md",0,"gap-remediation,phase-0-setup,domain-documentation",Backlog,2,GAP-001
...
```

---

## Phase 0: Setup & Cataloging (2 issues)

### GAP-001: Create Gap Remediation Catalog

```
Title: [GAP-001] Create Gap Remediation Catalog
Priority: 0 (No priority)
Labels: gap-remediation, phase-0-setup, domain-documentation
Status: Backlog
Estimate: 2 (2 hours)

Description:
Create structured catalog of all 95 gaps with priorities, dependencies, and implementation plan.

## Deliverable
- docs/gaps/gap-catalog-2026-03-17.md

## Success Criteria
- All 95 gaps documented with unique IDs
- Dependency graph clearly shows blocking relationships
- Impact × Effort matrix completed
```

### GAP-002: Document Linear Issue Structure

```
Title: [GAP-002] Document Linear Issue Structure
Priority: 0 (No priority)
Labels: gap-remediation, phase-0-setup, domain-documentation
Status: Backlog
Estimate: 2 (2 hours)
Blocked By: GAP-001

Description:
Document Linear issue templates for batch creation with proper labels, descriptions, and dependency relationships.

## Deliverable
- docs/gaps/linear-issues-template.md

## Success Criteria
- Templates ready for batch creation
- All labels documented
- Dependency relationships mapped
```

---

## Phase 1: Type Contracts (7 Critical)

### GAP-003: Fix LocationStockResponse Type Mismatch

```
Title: [GAP-003] Fix LocationStockResponse Type Mismatch
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 2 (2 hours)

Description:
warehouse.tsx expects items: LocationStockItem[] but inventory.ts returns items: InventoryItem[]

## Affected Files
- apps/web/app/(dashboard)/warehouse/page.tsx (line 156)
- apps/web/lib/api/inventory.ts (getStockByLocation method)
- apps/web/lib/types/inventory.ts (LocationStockResponse interface)

## Fix
Update LocationStockResponse to match backend schema:
- product_id, product_name, sku
- location_id, location_name
- quantity, reserved_quantity, available_quantity

## Blocks
- GAP-019 (warehouse ops endpoint)
- GAP-053 (warehouse tests)

## Success Criteria
- TypeScript compiles with 0 errors
- warehouse.tsx uses correct type
- API client returns correct shape
```

### GAP-004: Add WarehouseOpsPayload Type

```
Title: [GAP-004] Add WarehouseOpsPayload Type Definition
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 1 (1 hour)

Description:
warehouse.tsx uses WarehouseOpsPayload but type is not defined in inventory.ts

## Affected Files
- apps/web/app/(dashboard)/warehouse/page.tsx (line 103)
- apps/web/lib/api/inventory.ts (missing type definition)

## Fix
Add type definition:
- operation_type: 'pick' | 'pack' | 'ship' | 'receive'
- order_id?: string
- items: Array<{product_id, quantity, location_id?}>
- notes?: string

## Blocks
- GAP-019 (warehouse ops endpoint)

## Success Criteria
- Type defined in inventory.ts
- warehouse.tsx imports and uses type
- 0 TypeScript errors
```

### GAP-005: Add MarketplaceOrder Type

```
Title: [GAP-005] Add MarketplaceOrder Type Definition
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 2 (2 hours)

Description:
marketplace.tsx uses MarketplaceOrder type but it's not defined in marketplace.ts

## Affected Files
- apps/web/app/(dashboard)/orders/marketplace/page.tsx (line 89)
- apps/web/lib/api/marketplace.ts (missing type definition)

## Fix
Add comprehensive type:
- id, marketplace_order_id, marketplace, order_number
- customer_name, customer_email
- total_amount, status
- items array (product_id, product_name, sku, quantity, unit_price)
- shipping_address object
- synced_at, created_at

## Blocks
- GAP-025 (marketplace sync endpoint)

## Success Criteria
- Type defined in marketplace.ts
- Covers all marketplace platforms (Shopify, eBay, Facebook)
- marketplace.tsx compiles without errors
```

### GAP-006: Fix Cin7Fulfilment Schema Mismatch

```
Title: [GAP-006] Fix Cin7Fulfilment Schema Mismatch
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 2 (2 hours)

Description:
fulfilment/page.tsx expects different schema than backend provides (missing shipment_tracking and packed_items)

## Affected Files
- apps/web/app/(dashboard)/orders/fulfilment/page.tsx (line 134)
- apps/backend/src/api/routes/integrations/cin7_fulfilment.py
- apps/web/lib/api/cin7.ts (Cin7Fulfilment type)

## Fix
Update frontend type to match backend:
- Add shipment_tracking?: {carrier, tracking_number, tracking_url?}
- Add packed_items: Array<{product_id, product_name, quantity_ordered, quantity_picked, quantity_packed}>

## Blocks
- GAP-023 (fulfilment endpoints)

## Success Criteria
- Frontend type matches backend schema exactly
- fulfilment/page.tsx compiles without errors
- No runtime type errors
```

### GAP-007: Add PaymentMethodEnum

```
Title: [GAP-007] Add PaymentMethodEnum Definition
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 1 (1 hour)

Description:
billing/page.tsx uses PaymentMethodEnum but it's not defined

## Affected Files
- apps/web/app/(dashboard)/settings/billing/page.tsx (line 67)
- apps/web/lib/api/billing.ts (missing enum)

## Fix
Add enum:
- CREDIT_CARD = 'credit_card'
- DIRECT_DEBIT = 'direct_debit'
- BANK_TRANSFER = 'bank_transfer'
- PAYPAL = 'paypal'
- STRIPE = 'stripe'

## Blocks
- GAP-011 (payment methods endpoint)

## Success Criteria
- Enum defined in billing.ts
- Used in PaymentMethod type
- billing/page.tsx compiles without errors
```

### GAP-008: Add SLAEscalationPayload Type

```
Title: [GAP-008] Add SLAEscalationPayload Type Definition
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 1 (1 hour)

Description:
workflows/page.tsx uses SLAEscalationPayload but type not defined

## Affected Files
- apps/web/app/(dashboard)/workflows/page.tsx (line 201)
- apps/web/lib/api/workflows.ts (missing type)

## Fix
Add type:
- workflow_instance_id: string
- escalation_level: number
- reason: string
- escalate_to_user_id?: string
- notify_users: string[]

## Blocks
- GAP-027 (SLA escalation endpoint)

## Success Criteria
- Type defined in workflows.ts
- workflows/page.tsx compiles without errors
```

### GAP-009: Add ReconciliationMatch Type

```
Title: [GAP-009] Add ReconciliationMatch Type Definition
Priority: 1 (Urgent)
Labels: gap-remediation, phase-1-types, domain-frontend, priority-critical, domain-type-contract
Status: Backlog
Estimate: 2 (2 hours)

Description:
reconciliation/page.tsx uses ReconciliationMatch type not defined in API client

## Affected Files
- apps/web/app/(dashboard)/finance/reconciliation/page.tsx (line 178)
- Backend: needs new type in financial routes

## Fix
Add type:
- id, invoice_id, payment_id
- match_confidence: number
- match_type: 'exact' | 'partial' | 'suggested'
- amount_matched, amount_remaining
- matched_at?: string

## Blocks
- GAP-033 (reconciliation endpoints)

## Success Criteria
- Type defined in financial API client
- reconciliation/page.tsx compiles without errors
```

---

## Phase 2: API Endpoints (18 Critical)

### Batch 2A: Payment & Billing Endpoints

### GAP-010: POST /api/billing/payment-methods

```
Title: [GAP-010] Implement POST /api/billing/payment-methods
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2a-billing, domain-backend, priority-critical
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-007

Description:
Create payment method for customer billing

## Affected Files
- CREATE: apps/backend/src/api/routes/billing.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/settings/billing/page.tsx (line 156)

## Implementation
- Validate with Stripe API
- Store in payment_methods table
- Return payment method with masked details

## Related
- GAP-036 (business logic - payment validation)

## Success Criteria
- Endpoint returns 201 on success
- Payment method stored in DB
- Stripe integration validated
- Error handling for invalid cards
```

### GAP-011: GET /api/billing/payment-methods/enum

```
Title: [GAP-011] Implement GET /api/billing/payment-methods/enum
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2a-billing, domain-backend, priority-critical
Status: Backlog
Estimate: 1 (1 hour)
Blocked By: GAP-007

Description:
Return available payment method types as enum

## Affected Files
- CREATE: apps/backend/src/api/routes/billing.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/settings/billing/page.tsx (line 67)

## Implementation
Return array: ["credit_card", "direct_debit", "bank_transfer", "paypal", "stripe"]

## Related
- GAP-010

## Success Criteria
- Endpoint returns 200
- Array matches PaymentMethodEnum
```

### GAP-012: POST /api/billing/dunning/send-letter

```
Title: [GAP-012] Implement POST /api/billing/dunning/send-letter
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2a-billing, domain-backend, priority-critical
Status: Backlog
Estimate: 4 (4 hours)
Blocked By: GAP-037

Description:
Send dunning letter for overdue invoice

## Affected Files
- CREATE: apps/backend/src/api/routes/billing.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/settings/billing/page.tsx (line 234)

## Implementation
- Use dunning service (GAP-037)
- Log dunning action
- Schedule follow-up if configured

## Dependencies
- GAP-037 (dunning service)

## Related
- GAP-013 (subscription health)

## Success Criteria
- Letter sent via email
- Dunning action logged
- Follow-up scheduled
```

### GAP-013: GET /api/billing/subscription-health

```
Title: [GAP-013] Implement GET /api/billing/subscription-health
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2a-billing, domain-backend, priority-medium
Status: Backlog
Estimate: 3 (3 hours)

Description:
Dashboard widget showing subscription health metrics

## Affected Files
- CREATE: apps/backend/src/api/routes/billing.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/settings/billing/page.tsx (line 189)

## Implementation
- Active subscriptions count
- Churn risk score
- Overdue invoices count
- Revenue metrics

## Related
- GAP-012 (dunning)

## Success Criteria
- Returns comprehensive health metrics
- Calculated efficiently (use DB aggregations)
```

### GAP-014: POST /api/billing/retry-failed-payment

```
Title: [GAP-014] Implement POST /api/billing/retry-failed-payment
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2a-billing, domain-backend, priority-critical
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-010

Description:
Retry failed payment with optional new payment method

## Affected Files
- CREATE: apps/backend/src/api/routes/billing.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/settings/billing/page.tsx (line 278)

## Implementation
- Validate invoice + payment method
- Process via Stripe
- Update invoice status
- Send notification

## Dependencies
- GAP-010 (payment methods)

## Related
- GAP-012 (dunning)

## Success Criteria
- Payment retried successfully
- Invoice status updated
- Customer notified
```

### Batch 2B: Inventory & Procurement Endpoints

### GAP-015: POST /api/inventory/auto-reorder

```
Title: [GAP-015] Implement POST /api/inventory/auto-reorder
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2b-inventory, domain-backend, priority-critical
Status: Backlog
Estimate: 4 (4 hours)
Blocked By: GAP-038

Description:
Trigger auto-reorder for products below reorder point

## Affected Files
- CREATE: apps/backend/src/api/routes/inventory.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/inventory/page.tsx (line 298)

## Implementation
- Use auto_reorder service (GAP-038)
- Create purchase orders
- Update reorder logs

## Dependencies
- GAP-038 (auto-reorder service)

## Related
- GAP-016 (three-way match)

## Success Criteria
- POs created for products below reorder point
- Reorder logs updated
- Notifications sent
```

### GAP-016: POST /api/procurement/three-way-match

```
Title: [GAP-016] Implement POST /api/procurement/three-way-match
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2b-inventory, domain-backend, priority-critical
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-034

Description:
Perform three-way match: PO + GRN + Invoice

## Affected Files
- CREATE: apps/backend/src/api/routes/procurement.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/procurement/page.tsx (line 267)

## Implementation
- Use procurement_matching service (GAP-034)
- Return match status + discrepancies

## Dependencies
- GAP-034 (procurement matching service)

## Related
- GAP-017 (unmatched PO items)

## Success Criteria
- Matches PO, GRN, Invoice
- Returns discrepancies clearly
- Handles partial matches
```

### GAP-017: GET /api/procurement/unmatched-po-items

```
Title: [GAP-017] Implement GET /api/procurement/unmatched-po-items
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2b-inventory, domain-backend, priority-medium
Status: Backlog
Estimate: 2 (2 hours)
Blocked By: GAP-016

Description:
List purchase order items not yet matched to GRN/invoice

## Affected Files
- CREATE: apps/backend/src/api/routes/procurement.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/procurement/page.tsx (line 189)

## Implementation
- Query PO items without GRN match
- Support pagination
- Filter by status

## Dependencies
- GAP-016 (three-way match)

## Related
- GAP-034 (procurement matching service)

## Success Criteria
- Returns paginated results
- Includes PO details
- Filter by status works
```

### GAP-018: POST /api/inventory/bulk-adjust

```
Title: [GAP-018] Implement POST /api/inventory/bulk-adjust
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2b-inventory, domain-backend, priority-medium
Status: Backlog
Estimate: 3 (3 hours)

Description:
Bulk adjust inventory quantities (stock take results)

## Affected Files
- CREATE: apps/backend/src/api/routes/inventory.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/inventory/stock-take/page.tsx (line 234)

## Implementation
- Validate adjustments
- Update stock levels
- Create audit trail
- Return summary

## Related
- GAP-019 (stock takes)

## Success Criteria
- Bulk update successful
- Audit trail created
- Validation prevents negative stock
```

### GAP-019: GET /api/inventory/stock-takes/active

```
Title: [GAP-019] Implement GET /api/inventory/stock-takes/active
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2b-inventory, domain-backend, priority-medium
Status: Backlog
Estimate: 2 (2 hours)
Blocked By: GAP-003

Description:
Get active stock take sessions

## Affected Files
- CREATE: apps/backend/src/api/routes/inventory.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/inventory/stock-take/page.tsx (line 98)

## Implementation
- Query stock_takes where status = 'in_progress'
- Include item counts

## Dependencies
- GAP-003 (LocationStockResponse type)

## Related
- GAP-018 (bulk adjust)

## Success Criteria
- Returns active stock takes only
- Includes progress metrics
```

### GAP-020: POST /api/inventory/cycle-count/generate

```
Title: [GAP-020] Implement POST /api/inventory/cycle-count/generate
Priority: 3 (Normal)
Labels: gap-remediation, phase-2-api, batch-2b-inventory, domain-backend, priority-low
Status: Backlog
Estimate: 3 (3 hours)

Description:
Generate cycle count schedule for ABC classification

## Affected Files
- CREATE: apps/backend/src/api/routes/inventory.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/inventory/cycle-count/page.tsx (line 156)

## Implementation
- ABC classification
- Schedule based on frequency
- Return count tasks

## Related
- GAP-019 (stock takes)

## Success Criteria
- ABC classification correct
- Schedule generated
- Tasks created
```

### Batch 2C: Workflow & Approvals Endpoints

### GAP-021: POST /api/workflows/sla/escalate

```
Title: [GAP-021] Implement POST /api/workflows/sla/escalate
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2c-workflow, domain-backend, priority-critical
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-008, GAP-039

Description:
Manually escalate workflow instance for SLA breach

## Affected Files
- CREATE: apps/backend/src/api/routes/workflows.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/workflows/page.tsx (line 201)

## Implementation
- Use sla_escalation service (GAP-039)
- Create escalation record
- Send notifications

## Dependencies
- GAP-008 (SLAEscalationPayload type)
- GAP-039 (SLA escalation service)

## Related
- GAP-022 (pending approvals)

## Success Criteria
- Escalation created
- Notifications sent
- SLA record updated
```

### GAP-022: GET /api/approvals/pending-my-approval

```
Title: [GAP-022] Implement GET /api/approvals/pending-my-approval
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2c-workflow, domain-backend, priority-medium
Status: Backlog
Estimate: 2 (2 hours)

Description:
Get approvals pending for current user

## Affected Files
- CREATE: apps/backend/src/api/routes/approvals.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/approvals/page.tsx (line 134)

## Implementation
- Query approvals where approver_id = current_user.id
- Status = 'pending'
- Include workflow context

## Related
- GAP-023 (bulk approve)

## Success Criteria
- Returns current user's pending approvals
- Includes workflow details
- Paginated
```

### GAP-023: POST /api/approvals/bulk-approve

```
Title: [GAP-023] Implement POST /api/approvals/bulk-approve
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2c-workflow, domain-backend, priority-medium
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-022

Description:
Approve multiple workflow approvals in one request

## Affected Files
- CREATE: apps/backend/src/api/routes/approvals.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/approvals/page.tsx (line 189)

## Implementation
- Validate all approval_ids
- Update status for each
- Trigger workflow progression
- Return success/failure per item

## Dependencies
- GAP-022 (pending approvals)

## Related
- GAP-021 (SLA escalation)

## Success Criteria
- Bulk approve successful
- Workflows progress
- Per-item status returned
```

### GAP-024: GET /api/workflows/execution-stats

```
Title: [GAP-024] Implement GET /api/workflows/execution-stats
Priority: 3 (Normal)
Labels: gap-remediation, phase-2-api, batch-2c-workflow, domain-backend, priority-low
Status: Backlog
Estimate: 2 (2 hours)

Description:
Workflow execution statistics for dashboard

## Affected Files
- CREATE: apps/backend/src/api/routes/workflows.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/workflows/page.tsx (line 67)

## Implementation
- Count by status
- Average execution time
- SLA compliance rate
- Top bottlenecks

## Related
- GAP-021 (SLA escalation)

## Success Criteria
- Returns comprehensive stats
- Efficient queries (use aggregations)
```

### Batch 2D: Financial & Tax Endpoints

### GAP-025: POST /api/invoices/tax/calculate

```
Title: [GAP-025] Implement POST /api/invoices/tax/calculate
Priority: 1 (Urgent)
Labels: gap-remediation, phase-2-api, batch-2d-financial, domain-backend, priority-critical
Status: Backlog
Estimate: 4 (4 hours)
Blocked By: GAP-036

Description:
Calculate tax for invoice line items (GST, state taxes)

## Affected Files
- CREATE: apps/backend/src/api/routes/invoices.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/invoices/page.tsx (line 312)

## Implementation
- Use tax_calculator service (GAP-036)
- Apply GST rules (10% in Australia)
- Handle state-specific taxes
- Return breakdown

## Dependencies
- GAP-036 (tax calculator service)

## Related
- GAP-026 (reconciliation)

## Success Criteria
- GST calculated correctly
- Tax-exempt items handled
- Detailed breakdown returned
```

### GAP-026: GET /api/reconciliation/match-suggestions

```
Title: [GAP-026] Implement GET /api/reconciliation/match-suggestions
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2d-financial, domain-backend, priority-medium
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-009

Description:
AI-suggested invoice-payment matches for reconciliation

## Affected Files
- CREATE: apps/backend/src/api/routes/reconciliation.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/finance/reconciliation/page.tsx (line 178)

## Implementation
- Find unmatched invoices + payments
- Match by amount, date proximity, reference
- Return with confidence scores

## Dependencies
- GAP-009 (ReconciliationMatch type)

## Related
- GAP-027 (auto-match)

## Success Criteria
- Returns suggested matches
- Confidence scores accurate
- High-confidence matches prioritized
```

### GAP-027: POST /api/reconciliation/auto-match

```
Title: [GAP-027] Implement POST /api/reconciliation/auto-match
Priority: 2 (High)
Labels: gap-remediation, phase-2-api, batch-2d-financial, domain-backend, priority-medium
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: GAP-026, GAP-009

Description:
Auto-match high-confidence invoice-payment pairs

## Affected Files
- CREATE: apps/backend/src/api/routes/reconciliation.py (add endpoint)
- USED BY: apps/web/app/(dashboard)/finance/reconciliation/page.tsx (line 234)

## Implementation
- Get suggestions from GAP-026
- Filter by confidence >= threshold
- Create matches
- Return summary

## Dependencies
- GAP-026 (match suggestions)
- GAP-009 (ReconciliationMatch type)

## Related
- GAP-025 (tax calculation)

## Success Criteria
- Auto-matches created successfully
- Only high-confidence matches
- Summary includes match count
```

---

## Phase 3: Business Logic Services (6 Critical)

### GAP-028: Three-Way PO Matching Service

```
Title: [GAP-028] Implement Three-Way PO Matching Service
Priority: 1 (Urgent)
Labels: gap-remediation, phase-3-services, domain-backend, priority-critical
Status: Backlog
Estimate: 5 (5 hours)

Description:
Service for matching Purchase Order + GRN + Invoice

## Affected Files
- CREATE: apps/backend/src/services/procurement_matching.py
- USED BY: GAP-016 (procurement endpoint)

## Implementation
Class: ProcurementMatchingService
Method: async three_way_match(po_id, grn_id, invoice_id, db)

Logic:
1. Load PO, GRN, Invoice from DB
2. Match line items by product_id
3. Check: quantity_ordered == quantity_received == quantity_invoiced
4. Check: unit_price matches within tolerance (2%)
5. Flag discrepancies
6. Return match result

## Blocks
- GAP-016 (API endpoint)

## Success Criteria
- 100% test coverage
- Handles exact, partial, mismatch scenarios
- Handles over-delivery, under-delivery
- Price variance detection works
```

### GAP-029: Order State Machine Service

```
Title: [GAP-029] Implement Order State Machine Service
Priority: 1 (Urgent)
Labels: gap-remediation, phase-3-services, domain-backend, priority-critical
Status: Backlog
Estimate: 4 (4 hours)

Description:
Enforce order status transitions and business rules

## Affected Files
- CREATE: apps/backend/src/services/order_state.py
- USED BY: Order update endpoints

## Implementation
Class: OrderStateMachine

Valid transitions:
- draft → [pending, cancelled]
- pending → [confirmed, cancelled]
- confirmed → [processing, cancelled]
- processing → [shipped, cancelled]
- shipped → [delivered]
- delivered → []
- cancelled → []

Method: async transition(order_id, from_status, to_status, db)

Logic:
1. Validate transition is allowed
2. Check business rules (e.g., can't ship without stock)
3. Execute side effects (inventory reservation, notifications)
4. Update order status
5. Create audit log

## Blocks
- Order CRUD operations

## Success Criteria
- All valid transitions work
- Invalid transitions raise errors
- Business rules enforced
- Audit trail created
```

### GAP-030: Tax Calculation Engine

```
Title: [GAP-030] Implement Tax Calculation Engine
Priority: 1 (Urgent)
Labels: gap-remediation, phase-3-services, domain-backend, priority-critical
Status: Backlog
Estimate: 5 (5 hours)

Description:
Calculate GST and state-specific taxes for Australian invoices

## Affected Files
- CREATE: apps/backend/src/services/tax_calculator.py
- USED BY: GAP-025 (invoice tax endpoint)

## Implementation
Class: TaxCalculator
Constant: GST_RATE = Decimal("0.10")  # 10% GST

Method: async calculate_tax(line_items, customer_address, invoice_date)

Logic:
1. Determine tax jurisdiction from customer address
2. Apply GST (10%) to taxable items
3. Handle tax-exempt items (exports, etc.)
4. Calculate per-line and total tax
5. Return detailed breakdown

## Blocks
- GAP-025 (invoice tax endpoint)

## Success Criteria
- GST calculation accurate
- Tax-exempt items handled
- Rounding edge cases tested
- Decimal precision maintained
```

### GAP-031: Dunning Letter Automation Service

```
Title: [GAP-031] Implement Dunning Letter Automation Service
Priority: 1 (Urgent)
Labels: gap-remediation, phase-3-services, domain-backend, priority-critical
Status: Backlog
Estimate: 4 (4 hours)

Description:
Automated dunning letter workflow for overdue invoices

## Affected Files
- CREATE: apps/backend/src/services/dunning.py
- USED BY: GAP-012 (dunning endpoint)

## Implementation
Class: DunningService

Stages:
- 7 days overdue: reminder
- 14 days: warning
- 30 days: final_notice
- 45 days: collections

Method: async send_dunning_letter(invoice_id, letter_type, db)

Logic:
1. Load invoice + customer
2. Check dunning history (don't duplicate)
3. Generate letter from template
4. Send via email
5. Log dunning action
6. Schedule next reminder if needed

## Dependencies
- Email service

## Blocks
- GAP-012 (dunning endpoint)

## Success Criteria
- Letters generated correctly
- Email sent successfully
- Duplicates prevented
- Next reminder scheduled
```

### GAP-032: Auto-Reorder Service

```
Title: [GAP-032] Implement Auto-Reorder Service
Priority: 1 (Urgent)
Labels: gap-remediation, phase-3-services, domain-backend, priority-critical
Status: Backlog
Estimate: 4 (4 hours)

Description:
Automatically create purchase orders when stock falls below reorder point

## Affected Files
- CREATE: apps/backend/src/services/auto_reorder.py
- USED BY: GAP-015 (auto-reorder endpoint)

## Implementation
Class: AutoReorderService

Method: async trigger_reorder(product_id | None, db)

Logic:
1. Query products with stock < reorder_point
2. For each product, load ReorderRule
3. Calculate order quantity (reorder_quantity or economic_order_qty)
4. Find preferred supplier
5. Create draft purchase order
6. Log reorder action

## Dependencies
- ReorderRule model (already exists)

## Blocks
- GAP-015 (auto-reorder endpoint)

## Success Criteria
- Reorder point detection works
- Economic order quantity calculated
- Multi-product batch supported
- POs created successfully
```

### GAP-033: SLA Escalation Logic Service

```
Title: [GAP-033] Implement SLA Escalation Logic Service
Priority: 1 (Urgent)
Labels: gap-remediation, phase-3-services, domain-backend, priority-critical
Status: Backlog
Estimate: 3 (3 hours)

Description:
SLA breach detection and escalation workflow

## Affected Files
- CREATE: apps/backend/src/services/sla_escalation.py
- USED BY: GAP-021 (SLA escalation endpoint)

## Implementation
Class: SLAEscalationService

Method: async escalate_breach(workflow_instance_id, escalation_level, db)

Logic:
1. Load workflow instance + SLA definition
2. Validate SLA breach (time exceeded)
3. Determine escalation recipient (manager hierarchy)
4. Create escalation record
5. Send notification
6. Schedule next escalation if multi-tier

## Dependencies
- WorkflowInstance, SLA models (already exist)

## Blocks
- GAP-021 (SLA escalation endpoint)

## Success Criteria
- Escalation hierarchy works
- Notifications routed correctly
- Time calculations accurate
- Multi-tier escalation supported
```

---

## Phase 4: UI/UX Polish (55 Medium/Low)

### Batch 4A: ErrorBoundary Components (35 pages)

**Note:** All 35 issues follow same pattern - wrap page in `<ErrorBoundary>` component

### GAP-034 through GAP-068: Add ErrorBoundary (35 issues)

**Template for all ErrorBoundary issues:**

```
Title: [GAP-XXX] Add ErrorBoundary to [page-name]
Priority: 2 (High)
Labels: gap-remediation, phase-4-ui, batch-4a-error-boundary, domain-frontend, priority-medium
Status: Backlog
Estimate: 1 (1 hour)

Description:
Wrap page content in ErrorBoundary component for graceful error handling

## Affected Files
- apps/web/app/(dashboard)/[path]/page.tsx

## Implementation
Import ErrorBoundary and wrap page content:
<ErrorBoundary>
  {/* existing page content */}
</ErrorBoundary>

## Success Criteria
- Page wrapped in ErrorBoundary
- Errors caught and displayed gracefully
- No console errors
```

**Pages requiring ErrorBoundary (34-68):**

- GAP-034: warehouse/page.tsx
- GAP-035: orders/marketplace/page.tsx
- GAP-036: procurement/page.tsx
- GAP-037: inventory/stock-take/page.tsx
- GAP-038: inventory/cycle-count/page.tsx
- GAP-039: workflows/page.tsx
- GAP-040: approvals/page.tsx
- GAP-041: invoices/page.tsx
- GAP-042: finance/reconciliation/page.tsx
- GAP-043: settings/billing/page.tsx
- GAP-044: workshop/equipment/page.tsx
- GAP-045: workshop/schedule/page.tsx
- GAP-046: workshop/templates/page.tsx
- GAP-047: workshop/reminders/page.tsx
- GAP-048: customers/health/page.tsx
- GAP-049: customers/onboarding/page.tsx
- GAP-050: customers/personas/page.tsx
- GAP-051: contractors/page.tsx
- GAP-052: service-requests/page.tsx
- GAP-053: bank-feeds/page.tsx
- GAP-054: alerts/page.tsx
- GAP-055: reports/page.tsx
- GAP-056: marketing/page.tsx
- GAP-057: faq/page.tsx
- GAP-058: pos/page.tsx
- GAP-059: settings/integrations/page.tsx
- GAP-060: orders/fulfilment/page.tsx
- GAP-061: inventory/page.tsx
- GAP-062: products/[id]/page.tsx
- GAP-063: customers/[id]/page.tsx
- GAP-064: contacts/[id]/page.tsx
- GAP-065: products/page.tsx
- GAP-066: customers/page.tsx
- GAP-067: orders/page.tsx
- GAP-068: quotes/page.tsx

### Batch 4B: Empty State Components (20 pages)

**Template for all EmptyState issues:**

```
Title: [GAP-XXX] Add EmptyState to [page-name]
Priority: 2 (High)
Labels: gap-remediation, phase-4-ui, batch-4b-empty-state, domain-frontend, priority-medium
Status: Backlog
Estimate: 2 (2 hours)

Description:
Display friendly empty state instead of blank table

## Affected Files
- apps/web/app/(dashboard)/[path]/page.tsx

## Implementation
Add conditional render:
{items.length === 0 ? (
  <EmptyState
    icon={IconName}
    title="No items found"
    description="Get started by creating your first item"
    action={<Button onClick={handleCreate}>Create Item</Button>}
  />
) : (
  <Table>...</Table>
)}

## Success Criteria
- Empty state shows when no data
- Icon, title, description appropriate
- Call-to-action button works
```

**Pages requiring EmptyState (69-88):**

- GAP-069: warehouse/page.tsx (no operations)
- GAP-070: orders/marketplace/page.tsx (no marketplace orders)
- GAP-071: procurement/page.tsx (no purchase orders)
- GAP-072: inventory/stock-take/page.tsx (no stock takes)
- GAP-073: inventory/cycle-count/page.tsx (no cycle counts)
- GAP-074: workflows/page.tsx (no workflows)
- GAP-075: approvals/page.tsx (no approvals)
- GAP-076: invoices/page.tsx (no invoices)
- GAP-077: finance/reconciliation/page.tsx (no reconciliations)
- GAP-078: workshop/equipment/page.tsx (no equipment)
- GAP-079: workshop/schedule/page.tsx (no bookings)
- GAP-080: workshop/templates/page.tsx (no templates)
- GAP-081: workshop/reminders/page.tsx (no reminders)
- GAP-082: contractors/page.tsx (no contractors)
- GAP-083: service-requests/page.tsx (no requests)
- GAP-084: bank-feeds/page.tsx (no transactions)
- GAP-085: alerts/page.tsx (no alerts)
- GAP-086: orders/fulfilment/page.tsx (no fulfilments)
- GAP-087: inventory/page.tsx (no inventory items)
- GAP-088: pos/page.tsx (no transactions)

---

## Phase 5: Test Coverage (224 gaps)

**Note:** Due to volume, showing representative templates. Full list in gap-catalog.md

### Batch 5A: Frontend Unit Tests (51 tests)

**Template for frontend unit test issues:**

```
Title: [GAP-XXX] Unit tests for [page-name]
Priority: 3 (Normal)
Labels: gap-remediation, phase-5-tests, batch-5a-frontend-tests, domain-test, priority-low
Status: Backlog
Estimate: 3 (3 hours)
Blocked By: [related API endpoints]

Description:
Vitest unit tests for [page description]

## Affected Files
- CREATE: apps/web/__tests__/app/[path]/page.test.tsx

## Coverage
- Renders component correctly
- User interactions work
- API calls triggered
- Loading states
- Error states

## Dependencies
- [List related API endpoints that must exist]

## Success Criteria
- 80%+ code coverage
- All user flows tested
- No flaky tests
```

**High Priority Frontend Tests (89-93):**

- GAP-089: Inventory page tests
- GAP-090: Billing page tests
- GAP-091: Workshop pages tests (4 pages)
- GAP-092: Warehouse page tests
- GAP-093: Procurement & Approvals tests

### Batch 5B: Backend Unit Tests (157 tests)

**Template for backend unit test issues:**

```
Title: [GAP-XXX] Unit tests for [route/service name]
Priority: 3 (Normal)
Labels: gap-remediation, phase-5-tests, batch-5b-backend-tests, domain-test, priority-low
Status: Backlog
Estimate: 4 (4 hours)
Blocked By: [related service/endpoint]

Description:
Pytest tests for [route/service description]

## Affected Files
- CREATE: apps/backend/tests/api/test_[name].py
  OR
- CREATE: apps/backend/tests/services/test_[name].py

## Coverage
- Happy path scenarios
- Error handling
- Validation
- Edge cases
- Database operations

## Dependencies
- [List services/models that must exist]

## Success Criteria
- 100% code coverage for services
- 90%+ for routes
- All edge cases tested
```

**High Priority Backend Tests (140-145):**

- GAP-140: Billing routes tests
- GAP-141: Inventory routes tests
- GAP-142: Procurement routes tests
- GAP-143: Workflow & Approval routes tests
- GAP-144: Financial routes tests
- GAP-145: Business logic service tests (6 services)

### Batch 5C: E2E Tests (16 specs)

**Template for E2E test issues:**

```
Title: [GAP-XXX] E2E tests for [feature name]
Priority: 3 (Normal)
Labels: gap-remediation, phase-5-tests, batch-5c-e2e-tests, domain-test, priority-low
Status: Backlog
Estimate: 5 (5 hours)
Blocked By: [related UI + API work]

Description:
Playwright E2E tests for [feature description]

## Affected Files
- CREATE: apps/web/__tests__/e2e/[name].spec.ts

## Scenarios
- [List 3-5 key user workflows]

## Dependencies
- [List required endpoints + UI components]

## Success Criteria
- All scenarios pass in CI
- No flaky tests
- Runs in < 2 minutes
```

**E2E Specs (297-312):**

- GAP-297: Warehouse E2E spec
- GAP-298: Workshop E2E spec
- GAP-299: Billing E2E spec
- GAP-300: CRM Health E2E spec
- GAP-301: Procurement E2E spec
- GAP-302-312: Remaining 11 specs

---

## Bulk Import Summary

**Total Issues:** 95
**Total Estimate:** ~280 hours (7 weeks at 40 hours/week)

### By Priority

- **Critical:** 38 issues (40%)
- **Medium:** 32 issues (34%)
- **Low:** 25 issues (26%)

### By Phase

- **Phase 0:** 2 issues (setup)
- **Phase 1:** 7 issues (type contracts)
- **Phase 2:** 18 issues (API endpoints)
- **Phase 3:** 6 issues (business services)
- **Phase 4:** 55 issues (UI polish)
- **Phase 5:** 224 issues (tests) → collapsed to ~10 meta-issues

### By Domain

- **Frontend:** 62 issues
- **Backend:** 30 issues
- **Test:** 224 issues → ~10 meta-issues

---

## Label Reference

```
gap-remediation          # All issues
priority-critical        # 38 issues
priority-medium          # 32 issues
priority-low             # 25 issues
domain-frontend          # TypeScript, React, UI
domain-backend           # Python, FastAPI, services
domain-test              # Vitest, Pytest, Playwright
domain-type-contract     # Phase 1 issues
phase-0-setup
phase-1-types
phase-2-api
phase-3-services
phase-4-ui
phase-5-tests
batch-2a-billing
batch-2b-inventory
batch-2c-workflow
batch-2d-financial
batch-4a-error-boundary
batch-4b-empty-state
batch-5a-frontend-tests
batch-5b-backend-tests
batch-5c-e2e-tests
```

---

## Next Steps

1. **Import Phase 0-3** (Critical work) first - 33 issues
2. **Review dependency graph** - ensure "Blocks" relationships are set
3. **Import Phase 4** (UI polish) - 55 issues
4. **Collapse Phase 5 tests** - create 10 meta-issues instead of 224 individual issues
5. **Assign to sprints** - follow 7-week roadmap from catalog

---

**END OF LINEAR ISSUES TEMPLATE**
