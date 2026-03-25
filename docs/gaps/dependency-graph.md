# Gap Remediation - Dependency Graph

**Date:** 2026-03-17
**Purpose:** Visual representation of gap dependencies and blocking relationships

---

## Critical Path Visualization

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PHASE 0: SETUP ✅                            │
│                                                                      │
│  GAP-001: Gap Catalog Creation                                      │
│  GAP-002: Linear Issue Structure                                    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: TYPE CONTRACTS (7)                       │
│                         CRITICAL - BLOCKS ALL                        │
│                                                                      │
│  GAP-003: LocationStockResponse   ────┐                             │
│  GAP-004: WarehouseOpsPayload     ────┼─► Blocks GAP-019           │
│  GAP-005: MarketplaceOrder        ────┼─► Blocks GAP-025           │
│  GAP-006: Cin7Fulfilment          ────┼─► Blocks GAP-023           │
│  GAP-007: PaymentMethodEnum       ────┼─► Blocks GAP-011           │
│  GAP-008: SLAEscalationPayload    ────┼─► Blocks GAP-027           │
│  GAP-009: ReconciliationMatch     ────┘─► Blocks GAP-033           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  PHASE 2: API ENDPOINTS     │  │  PHASE 3: BUSINESS SERVICES │
│  (18 gaps)                  │  │  (6 gaps)                   │
│  Can run in parallel        │◄─┤  Services enable endpoints  │
└─────────────────────────────┘  └─────────────────────────────┘
                │                             │
                └──────────────┬──────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: UI/UX POLISH (55)                        │
│                                                                      │
│  Batch 4A: ErrorBoundary (35 pages)                                 │
│  Batch 4B: EmptyState (20 pages)                                    │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PHASE 5: TEST COVERAGE (224)                       │
│                                                                      │
│  Batch 5A: Frontend Unit Tests (51)                                 │
│  Batch 5B: Backend Unit Tests (157)                                 │
│  Batch 5C: E2E Tests (16)                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 → Phase 2 Dependencies (Type Contracts → API Endpoints)

```
Type Contracts                API Endpoints
─────────────────────────────────────────────

GAP-003: LocationStockResponse
    │
    ├─► GAP-019: GET /inventory/stock-takes/active
    │
    └─► GAP-092: Warehouse page tests (Phase 5)

GAP-004: WarehouseOpsPayload
    │
    └─► GAP-019: (same endpoint)

GAP-005: MarketplaceOrder
    │
    └─► GAP-025: Marketplace sync endpoints

GAP-006: Cin7Fulfilment
    │
    └─► GAP-023: Fulfilment endpoints

GAP-007: PaymentMethodEnum
    │
    ├─► GAP-010: POST /billing/payment-methods
    │
    └─► GAP-011: GET /billing/payment-methods/enum

GAP-008: SLAEscalationPayload
    │
    └─► GAP-021: POST /workflows/sla/escalate

GAP-009: ReconciliationMatch
    │
    ├─► GAP-026: GET /reconciliation/match-suggestions
    │
    └─► GAP-027: POST /reconciliation/auto-match
```

---

## Phase 3 → Phase 2 Dependencies (Services → API Endpoints)

```
Business Services             API Endpoints
─────────────────────────────────────────────

GAP-028: ProcurementMatchingService (three-way match)
    │
    ├─► GAP-016: POST /procurement/three-way-match
    │
    └─► GAP-017: GET /procurement/unmatched-po-items

GAP-029: OrderStateMachine
    │
    └─► All order CRUD operations (existing)

GAP-030: TaxCalculator
    │
    └─► GAP-025: POST /invoices/tax/calculate

GAP-031: DunningService
    │
    ├─► GAP-012: POST /billing/dunning/send-letter
    │
    └─► GAP-013: GET /billing/subscription-health

GAP-032: AutoReorderService
    │
    └─► GAP-015: POST /inventory/auto-reorder

GAP-033: SLAEscalationService
    │
    └─► GAP-021: POST /workflows/sla/escalate
```

---

## Phase 2 → Phase 4 Dependencies (API Endpoints → UI Polish)

```
API Endpoints                 UI Pages
─────────────────────────────────────────────

Billing Endpoints (GAP-010-014)
    │
    ├─► GAP-043: settings/billing/page.tsx (ErrorBoundary)
    │
    └─► GAP-090: Billing page tests (Phase 5)

Inventory Endpoints (GAP-015, GAP-018-020)
    │
    ├─► GAP-061: inventory/page.tsx (ErrorBoundary)
    │
    ├─► GAP-087: inventory/page.tsx (EmptyState)
    │
    └─► GAP-089: Inventory page tests (Phase 5)

Procurement Endpoints (GAP-016-017)
    │
    ├─► GAP-036: procurement/page.tsx (ErrorBoundary)
    │
    ├─► GAP-071: procurement/page.tsx (EmptyState)
    │
    └─► GAP-093: Procurement page tests (Phase 5)

Workflow Endpoints (GAP-021-024)
    │
    ├─► GAP-039: workflows/page.tsx (ErrorBoundary)
    │
    └─► GAP-074: workflows/page.tsx (EmptyState)

Approval Endpoints (GAP-022-023)
    │
    ├─► GAP-040: approvals/page.tsx (ErrorBoundary)
    │
    ├─► GAP-075: approvals/page.tsx (EmptyState)
    │
    └─► GAP-093: Approvals page tests (Phase 5)
```

---

## Batch 2A: Payment & Billing Endpoints - Internal Dependencies

```
GAP-007: PaymentMethodEnum (Type)
    │
    ├─► GAP-010: POST /billing/payment-methods
    │       │
    │       ├─► GAP-011: GET /billing/payment-methods/enum
    │       │
    │       └─► GAP-014: POST /billing/retry-failed-payment
    │
    └─► GAP-031: DunningService (Service)
            │
            ├─► GAP-012: POST /billing/dunning/send-letter
            │
            └─► GAP-013: GET /billing/subscription-health
```

**Recommended Implementation Order:**

1. GAP-007 (type)
2. GAP-031 (service)
3. GAP-010, GAP-011 (payment methods)
4. GAP-012, GAP-013 (dunning)
5. GAP-014 (retry payment)

---

## Batch 2B: Inventory & Procurement Endpoints - Internal Dependencies

```
GAP-003: LocationStockResponse (Type)
    │
    ├─► GAP-019: GET /inventory/stock-takes/active
    │       │
    │       └─► GAP-018: POST /inventory/bulk-adjust
    │
    └─► GAP-020: POST /inventory/cycle-count/generate

GAP-032: AutoReorderService (Service)
    │
    └─► GAP-015: POST /inventory/auto-reorder

GAP-028: ProcurementMatchingService (Service)
    │
    └─► GAP-016: POST /procurement/three-way-match
            │
            └─► GAP-017: GET /procurement/unmatched-po-items
```

**Recommended Implementation Order:**

1. GAP-003 (type)
2. GAP-032 (auto-reorder service)
3. GAP-028 (matching service)
4. GAP-015 (auto-reorder endpoint)
5. GAP-016, GAP-017 (procurement matching)
6. GAP-018, GAP-019, GAP-020 (stock management)

---

## Batch 2C: Workflow & Approvals Endpoints - Internal Dependencies

```
GAP-008: SLAEscalationPayload (Type)
    │
    └─► GAP-033: SLAEscalationService (Service)
            │
            └─► GAP-021: POST /workflows/sla/escalate
                    │
                    └─► GAP-024: GET /workflows/execution-stats

GAP-022: GET /approvals/pending-my-approval
    │
    └─► GAP-023: POST /approvals/bulk-approve
```

**Recommended Implementation Order:**

1. GAP-008 (type)
2. GAP-033 (SLA service)
3. GAP-021 (SLA escalate)
4. GAP-022 (pending approvals)
5. GAP-023 (bulk approve)
6. GAP-024 (workflow stats)

---

## Batch 2D: Financial & Tax Endpoints - Internal Dependencies

```
GAP-030: TaxCalculator (Service)
    │
    └─► GAP-025: POST /invoices/tax/calculate

GAP-009: ReconciliationMatch (Type)
    │
    └─► GAP-026: GET /reconciliation/match-suggestions
            │
            └─► GAP-027: POST /reconciliation/auto-match
```

**Recommended Implementation Order:**

1. GAP-030 (tax service)
2. GAP-009 (reconciliation type)
3. GAP-025 (tax calculate)
4. GAP-026 (match suggestions)
5. GAP-027 (auto-match)

---

## Phase 4: UI Polish - No Internal Dependencies

**Batch 4A: ErrorBoundary (35 pages)**

- All can be implemented in parallel
- No dependencies on each other
- Simple pattern: wrap page in `<ErrorBoundary>`

**Batch 4B: EmptyState (20 pages)**

- All can be implemented in parallel
- No dependencies on each other
- Simple pattern: conditional render with `<EmptyState>`

**Recommendation:** Distribute across team, complete in 1 week

---

## Phase 5: Test Coverage - Depends on All Previous Phases

```
Phase 1-4 Complete
    │
    ├─► Batch 5A: Frontend Unit Tests (51)
    │       │
    │       └─► Tests validate UI components work
    │
    ├─► Batch 5B: Backend Unit Tests (157)
    │       │
    │       └─► Tests validate services + endpoints work
    │
    └─► Batch 5C: E2E Tests (16)
            │
            └─► Tests validate full user workflows
```

**Recommendation:** Start writing tests in parallel with Phase 2-3 implementation (TDD approach)

---

## Parallel Work Opportunities

### Sprint 1 Week 1 (Parallel Tracks)

**Track A: Type Contracts (1 dev, 20 hours)**

- GAP-003, GAP-004, GAP-005, GAP-006, GAP-007, GAP-008, GAP-009
- **Sequential work** - must complete all before Phase 2

**Track B: Business Services Setup (1 dev, 20 hours)**

- Start writing service skeletons
- Set up test structure
- Design service interfaces
- **Can start before types are done**

### Sprint 1 Week 2 (Parallel Tracks)

**Track A: Tax + Three-Way Match Services (1 dev, 25 hours)**

- GAP-030 (TaxCalculator)
- GAP-028 (ProcurementMatchingService)
- Unit tests for both

**Track B: Auto-Reorder + SLA Services (1 dev, 25 hours)**

- GAP-032 (AutoReorderService)
- GAP-033 (SLAEscalationService)
- Unit tests for both

**Track C: Order + Dunning Services (1 dev, 25 hours)**

- GAP-029 (OrderStateMachine)
- GAP-031 (DunningService)
- Unit tests for both

### Sprint 2 Week 1 (Parallel Tracks)

**Track A: Billing Endpoints (1 dev, 20 hours)**

- Batch 2A: GAP-010, GAP-011, GAP-012, GAP-013, GAP-014

**Track B: Inventory Endpoints (1 dev, 20 hours)**

- Batch 2B (Part 1): GAP-015, GAP-018, GAP-019, GAP-020

**Track C: Procurement Endpoints (1 dev, 20 hours)**

- Batch 2B (Part 2): GAP-016, GAP-017

### Sprint 2 Week 2 (Parallel Tracks)

**Track A: Workflow Endpoints (1 dev, 20 hours)**

- Batch 2C: GAP-021, GAP-022, GAP-023, GAP-024

**Track B: Financial Endpoints (1 dev, 20 hours)**

- Batch 2D: GAP-025, GAP-026, GAP-027

**Track C: API Documentation (1 dev, 20 hours)**

- Postman collection
- OpenAPI schema
- Integration tests

---

## Blocking Chain Summary

### Must Complete in Order

1. **Phase 0** → Phase 1
2. **Phase 1** → Phase 2, Phase 3
3. **Phase 2 + Phase 3** → Phase 4
4. **Phase 4** → Phase 5

### Can Run in Parallel

- **Phase 2** ↔ **Phase 3** (with coordination)
- **All items within Batch 2A** (after dependencies met)
- **All items within Batch 2B** (after dependencies met)
- **All items within Batch 2C** (after dependencies met)
- **All items within Batch 2D** (after dependencies met)
- **All items within Batch 4A** (no dependencies)
- **All items within Batch 4B** (no dependencies)

---

## Critical Bottlenecks

### Bottleneck 1: Phase 1 Completion

**Impact:** Blocks all of Phase 2 and Phase 3
**Solution:** Prioritize Phase 1, complete in Week 1
**Team Size:** 1-2 developers max (avoid merge conflicts)

### Bottleneck 2: Business Services

**Impact:** Specific endpoints blocked until services exist
**Solution:** Build services in Sprint 1, before endpoints in Sprint 2
**Team Size:** 3 developers (6 services ÷ 3 = 2 services each)

### Bottleneck 3: API Integration Testing

**Impact:** Can't validate endpoints work end-to-end
**Solution:** Create Postman collection in parallel with endpoint development
**Team Size:** 1 developer dedicated to testing/documentation

---

## Resource Allocation Recommendation

### Team Size: 3-4 Developers

**Sprint 1 (2 weeks):**

- Dev 1: Type contracts (Week 1) → Tax + Matching services (Week 2)
- Dev 2: Service skeletons (Week 1) → Auto-reorder + SLA services (Week 2)
- Dev 3: Testing setup (Week 1) → Order + Dunning services (Week 2)

**Sprint 2 (2 weeks):**

- Dev 1: Billing endpoints (Week 1) → Workflow endpoints (Week 2)
- Dev 2: Inventory endpoints (Week 1) → Financial endpoints (Week 2)
- Dev 3: Procurement endpoints (Week 1) → API docs + tests (Week 2)

**Sprint 3 (1 week):**

- Dev 1, 2, 3: ErrorBoundary (12 pages each)
- Dev 4 (optional): EmptyState (20 pages)

**Sprint 4 (2 weeks):**

- Dev 1, 2: Frontend + Backend unit tests
- Dev 3: E2E specs
- Dev 4 (optional): Additional test coverage

---

## Dependency Graph by Gap ID

```
GAP-001 (Setup)
    └─► GAP-002 (Setup)

GAP-003 (Type) ─┬─► GAP-019 (Endpoint)
                └─► GAP-092 (Test)

GAP-004 (Type) ───► GAP-019 (Endpoint)

GAP-005 (Type) ───► GAP-025 (Endpoint)

GAP-006 (Type) ───► GAP-023 (Endpoint)

GAP-007 (Type) ─┬─► GAP-010 (Endpoint) ─┬─► GAP-011 (Endpoint)
                │                         └─► GAP-014 (Endpoint)
                └─► GAP-031 (Service) ─┬─► GAP-012 (Endpoint)
                                        └─► GAP-013 (Endpoint)

GAP-008 (Type) ───► GAP-033 (Service) ───► GAP-021 (Endpoint)

GAP-009 (Type) ─┬─► GAP-026 (Endpoint) ───► GAP-027 (Endpoint)
                └─► GAP-033 (Service)

GAP-028 (Service) ───► GAP-016 (Endpoint) ───► GAP-017 (Endpoint)

GAP-029 (Service) ───► Order CRUD (existing)

GAP-030 (Service) ───► GAP-025 (Endpoint)

GAP-032 (Service) ───► GAP-015 (Endpoint)

GAP-010-027 (Endpoints) ───► GAP-034-088 (UI Polish) ───► GAP-089-312 (Tests)
```

---

**END OF DEPENDENCY GRAPH**
