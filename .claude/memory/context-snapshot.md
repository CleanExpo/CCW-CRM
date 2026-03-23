# Context Snapshot — Pre-Compaction

Generated: 2026-03-24T04:36:16.366271
Session ID: aa959058-4495-4a96-b23e-5fb7a678300c

## WARNING

Context compaction occurred. On next user message, re-read:

1. .claude/memory/CONSTITUTION.md
2. .claude/memory/current-state.md
3. .claude/memory/handoff.md

## State at Time of Compaction

# Current State — 2026-03-09T00:00:00

## Active Sprint: Backlog Commit Cleanup + Remaining Features

## Wave 1 — COMPLETE (all Linear → Done):

- [x] UNI-1241: AP2 frontend dashboard — /settings/integrations/ap2 page, listMandates/listTransactions endpoints
- [x] UNI-1267: Cin7 Webhook Subscription CRUD — backend + frontend card in integrations page
- [x] UNI-1263: Cin7 Line Items Sync — Cin7OrderLineItem + Cin7PurchaseOrderLineItem models, sales_sync.py + purchase_sync.py updated
- [x] UNI-1265: Inventory Write-Back — StockAdjustment/Transfer/StockTake models, 8 endpoints, warehouse Write-Back tab
- [x] UNI-1266: Advanced Purchase Receiving (GRN) — GoodsReceipt/Line models, 6 endpoints, /purchase-orders/receiving page + sidebar

## Wave 2 — COMPLETE (all Linear → Done):

- [x] UNI-1260: Shadow Transition Phase A — cin7_shadow_models.py, cin7_shadow_sync.py (5 endpoints), Cin7ShadowSyncCard.tsx
- [x] UNI-1264: Sales Order Fulfilment Chain — cin7_fulfilment_models.py, cin7_fulfilment.py (7 endpoints), orders/fulfilment/page.tsx
- [x] UNI-1268: Manufacturing/BOM Integration — cin7_bom_models.py, cin7_bom.py (6 endpoints), inventory/bom/page.tsx
- [x] UNI-1269: Financial/GL Integration — cin7_gl_models.py, cin7_gl.py (7 endpoints), settings/integrations/gl/page.tsx

## Wave 3 — COMPLETE:

- [x] UNI-1261: Shadow Phase B — settings/integrations/shadow/page.tsx (1,046 lines), full gap dashboard
- [x] UNI-1262: Shadow Phase C — cin7_shadow_agent.py (BaseAgent), cin7_shadow_ai.py (3 endpoints), cin7-shadow-ai.ts, AI Recommendations card in shadow/page.tsx

## UNI-1242 — COMPLETE:

- [x] UNI-1242: Fix Local Test Env — 3 bugs fixed:
  1. `AgentMetadata.model_rebuild()` needed `_types_namespace={"AgentCard": _AgentCard}` (forward ref)
  2. `settings` name collision in main.py — route import aliased to `settings_routes`
  3. `supabase>=2.0.0` + `faker>=28.0.0` added to pyproject.toml
  - Result: 823 passed, 106 pre-existing failures, 388 errors (DB connection — expected without Docker)

## PLANNING COMPLETE — All 6 Phase Plans Written:

- [x] docs/plans/UNI-171-crm-plan.md — CRM is 85% done; 2 bug fixes + contact detail page
- [x] docs/plans/UNI-172-inventory-plan.md — 11 feature areas done; barcode/stock-take/reorder-automation are net-new
- [x] docs/plans/UNI-173-invoicing-plan.md — Invoicing mostly done; CRITICAL: issue_date→invoice_date mismatch + UTC import bug; order-to-invoice generation missing
- [x] docs/plans/UNI-174-workflow-plan.md — Approval backend done (UI view-only); workflow builder + SLA + notification bell net-new
- [x] docs/plans/UNI-857-phase-c-plan.md — Track 2 (AI Product Copy) 80% done; Track 1 (Marketing) UI scaffolded; Track 3 (Staff Copilot) net-new
- [x] docs/plans/UNI-664-cicd-plan.md — CI/CD skeleton exists; 6 sub-tasks to wire it up; staging server must be provisioned first

## Implementation In Progress

### UNI-173 Invoicing — Status:

- [x] SUB-1: issue_date→invoice_date rename + UTC import fix
- [x] SUB-2: partial status + date filters + payment methods
- [x] SUB-3: revenue/tax report endpoints + tax-rates endpoint
- [x] SUB-4: from-order/{order_id} backend + generateFromOrder() client + orders page "Generate Invoice" button
- [x] SUB-5: InvoicePrintView.tsx + window.print() wired in invoices/[id]/page.tsx
- [x] SUB-6: FinancialReportTab.tsx + Reports tab on invoices/page.tsx
- [ ] SUB-7: Xero sync + dead file cleanup (gated on Xero auth)

### UNI-171 CRM — Status:

- [x] SUB-1: /api/activities/stats endpoint
- [x] SUB-2: ActivityTimeline response mismatch fix
- [x] SUB-3: Company name column on contacts list
- [x] SUB-4: /contacts/[id] detail page
- [x] SUB-5: contactsApi exported from index.ts
- [ ] SUB-6: Optional company filter (low priority)

### UNI-664 CI/CD — Status: COMPLETE (all GitHub UI tasks done; SSH secrets blocked on server)

- [x] SUB-1: Fix stale test assertions (walk-in.test.tsx, service.test.tsx) — 335 tests passing
- [x] SUB-3: PR preview comment bot in ci.yml
- [x] SUB-6: Vercel deployment verification — production deployed ✓ (2026-03-09)
  - Fixed: marketing.test.ts fallback assertion (getStats() uses .catch(), never rejects)
  - Fixed: ci.yml — pgvector/pgvector:pg15 image + alembic + pytest continue-on-error
  - PR #13 merged → main; Vercel production: state=success
- [x] SUB-4: Branch protection on main ✓ — "Require PR before merging" enabled; required checks: CI Summary + Backend Tests + Frontend Tests; no force push/delete
- [x] SUB-2: GitHub Environments configured ✓ (2026-03-09)
  - staging env (ID 12796033835): Protected branches only → main only; no secrets yet (server pending)
  - Production env (ID 12075114818): Updated from "No restriction" → Protected branches only → main only
  - SSH secrets (STAGING_SSH_KEY/HOST/USER, PRODUCTION_SSH_KEY/HOST/USER) — add when servers provisioned
- [x] PR #14 merged → main (squash commit 294af9d, 2026-03-09) — 32 commits, 155 files
  - Also fixed: seed_demo_simple.sql column names (hashed_password, is_admin); ci.yml remove continue-on-error (commit 0e95d86)
- [ ] SUB-5: deploy-staging.yml → workflow_run trigger — BLOCKED (needs staging server + SSH secrets)

### UNI-857 Marketing/AI — Status:

- [x] Track 2 SUB-1: POST /api/ai/generate/product-copy endpoint
- [x] Track 1: marketing_agent.py + marketing_ai.py (3 endpoints) + marketing/page.tsx CampaignDialog wired
- [ ] Track 3: Staff Copilot

### UNI-172 Inventory — Status: PARTIAL

- [x] SUB-1: PATCH /api/inventory/reorder-settings + ReorderPointDialog.tsx + "Reorder" button per row
- [x] SUB-2: GET /api/inventory/summary + InventoryDashboardSummary type + 4 KPI cards on inventory/page.tsx
- [ ] SUB-3: Barcode scanning (ProductBarcode model + useBarcodeScanner hook)
- [ ] SUB-4: Stock Take workflow (StockTake + StockTakeItem models + StockTakeForm)
- [ ] SUB-5: Reorder Automation (ReorderRule model + auto-reorder endpoint)
- [ ] SUB-6: Reorder Alert Panel (depends on SUB-5)
- [ ] SUB-7: Product Attributes & Variants

### UNI-174 Workflow — Status: COMPLETE

- [x] ST-1: approvalsApi client + Approve/Reject dialogs + CreateApproval dialog + approvals/page.tsx interactive
- [x] ST-2: workflow_models.py (6 tables: WorkflowTemplate, WorkflowTemplateAction, WorkflowInstance, SLARule, SLAInstance, InAppNotification)
- [x] ST-3: workflow_service.py + sla_service.py (singletons, evaluate_trigger, check_sla_breaches)
- [x] ST-4: workflows.py + sla.py + notifications.py routes registered in main.py
- [x] ST-5: NotificationBell.tsx + notifications.ts client wired into sidebar/layout
- [x] ST-6: Workflow builder UI — workflows/page.tsx full CRUD with TemplateDialog (RHF+Zod)
- [x] ST-7: TaskSLAPanel.tsx wired into tasks page

### UNI-857 Marketing/AI — Status: COMPLETE

- [x] Track 1: marketing_agent.py + marketing_ai.py (3 endpoints) + marketing/page.tsx CampaignDialog
- [x] Track 2: POST /api/ai/generate/product-copy endpoint
- [x] Track 3: staff_copilot_agent.py + staff_copilot.py routes + copilot.ts frontend client

### Committed Backlog (2026-03-09):

All Cin7 Wave 1-3 + UNI-171/172/173/174/857 work committed in 19 logical commits.
Commits: 1fd25c5 → 884494a (Cin7 DB models, routes, AI agents, frontend pages, API clients, tests, E2E specs, docs/plans)

## NEXT: Remaining pending tasks

## Architecture Note (Wave 2):

- All Wave 2 agents use SEPARATE model files (cin7_shadow_models.py, cin7_fulfilment_models.py, cin7_bom_models.py, cin7_gl_models.py) — NOT appending to cin7_models.py

## Blocked:

- UNI-1235: pgvector semantic search — BLOCKED (demo_models.py schema change needed)
- UNI-1236: Enhanced Shopify — BLOCKED (Shopify auth prerequisite)

## Critical Context:

- DO NOT modify demo_models.py (schema locked)
- DO NOT modify middleware.ts or demo_auth.py (auth locked)
- Always /plan → approve → implement → test

## Tech Stack Reminder:

- Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind v4, shadcn/ui
- Backend: FastAPI Python 3.12, SQLAlchemy 2.0, Pydantic v2
- Package Manager: pnpm (frontend), uv (backend)
- Path: D:\CCW-ERP-CRM
