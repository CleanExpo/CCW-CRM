# Decisions Log — Append-Only

## 2026-03-17 — Gap Remediation Phase 5 Complete (Test Coverage Expansion)

- Decision: Implemented strategic test coverage for Phases 2-4 features (30 new tests)
- Batches: 5A (Frontend - 10 files), 5B (Backend - 7 files), 5C (E2E - 5 specs)
- Frontend Unit Tests (10 files, 45 test cases):
  - reconciliation.test.ts: match suggestions + auto-match (6 tests)
  - workflows-extended.test.ts: SLA escalation + execution stats (6 tests)
  - approvals-extended.test.ts: pending-my-approval + bulk approve (7 tests)
  - invoices-extended.test.ts: tax calculation (5 tests)
  - 6 page integration tests: orders, quotes, reconciliation, approvals, workflows, billing (21 tests)
- Backend Integration Tests (7 files, 31 test cases):
  - 4 API endpoint tests: workflows, approvals, reconciliation, invoices (22 tests)
  - 3 service tests: procurement matching, tax calculator, auto-reorder (9 tests)
- E2E Playwright Specs (5 files, 19 test cases):
  - reconciliation.spec.ts: bank transaction matching flow (3 tests)
  - approvals.spec.ts: approval workflow + bulk approve (4 tests)
  - workflows.spec.ts: workflow creation + SLA escalation (4 tests)
  - invoices.spec.ts: invoice creation + tax calculation (4 tests)
  - error-handling.spec.ts: ErrorBoundary + EmptyState integration (4 tests)
- Impact: Strategic sampling approach (30 tests vs 224 gap items) — high-value coverage
- Test Counts: Frontend 63→73, Backend 82→89, E2E 0→5
- Commits: 28361f8 (Batch 5A), fb8bb09 (Batch 5B), 1c4854d (Batch 5C)

## 2026-03-17 — Gap Remediation Phase 2 Complete (Batches 2C & 2D)

- Decision: Implemented 7 remaining endpoints for workflows, approvals, invoicing, and reconciliation
- Batches: 2C (Workflow & Approvals - 4 endpoints), 2D (Financial & Tax - 3 endpoints)
- Endpoints:
  - GAP-019: POST /api/workflows/sla/escalate
  - GAP-020: GET /api/approvals/pending-my-approval (requires JWT auth)
  - GAP-021: POST /api/approvals/bulk-approve
  - GAP-022: GET /api/workflows/execution-stats
  - GAP-023: POST /api/invoices/tax/calculate
  - GAP-024: GET /api/reconciliation/match-suggestions
  - GAP-025: POST /api/reconciliation/auto-match
- Impact: Created new reconciliation.py router, registered in main.py, added 21 integration tests
- Files modified: workflows.py, approvals.py, invoices.py, reconciliation.py (new), main.py
- Tests: test_gap_batch_2c_2d.py (7 test classes, 21 tests + 2 summary tests)
- Commits: 6629ef5 (Batch 2C), 2a96874 (Batch 2D)

## 2026-03-03 — Framework Overhaul Initiated

- Decision: Implement anti-drift infrastructure using Claude Code hooks
- Rationale: Context drift documented in GitHub issues #9796, #13919, #14258, #3537. Hooks re-inject critical state before every message.
- Alternatives considered: PostCompact hook (not yet available in Claude Code)
- Impact: All future sessions have CONSTITUTION.md injected before every user message

## 2026-03-03 — 1:10 Agent:Skill Architecture Adopted

- Decision: Every specialized agent must have exactly 10 documented skills
- Rationale: Prevents agent sprawl, makes capabilities explicit and testable
- Impact: New agents require removal of one skill if 11th skill needed

## 2026-03-03 — Catalog System Established

- Decision: 6 catalogs in docs/catalogs/ are the source of truth for all system components
- Rationale: Prevents re-scanning codebase every session; agents read catalogs
- Catalogs: ROUTES.md, PAGES.md, AGENTS.md, PACKAGES.md, MODELS.md, INTEGRATIONS.md

## 2026-03-03 — Project Intelligence Agent Created

- Decision: New AI agent specifically for meta-audit, gap analysis, PRD generation
- Skills: scan-routes, scan-pages, scan-agents, scan-packages, cross-ref, dep-graph, prioritize, prd-generate, issue-sync, health
- Files: apps/backend/src/ai/agents/specialized/project_intelligence_agent.py

## 2026-03-03 — Gap Fixes: Contractors, Service Requests, Bank Feeds

- Decision: Create frontend pages for 3 backend routes that had no frontend
- Routes: contractors.py, service_requests.py, bank_feeds.py all have backend APIs
- Frontend pages created with full CRUD (where applicable)

## Agent Dispatch — 2026-03-03T09:31:50.568585

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T09:33:00.826975

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T09:33:18.892669

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T09:46:09.425808

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T09:46:16.686324

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T10:10:18.488888

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T10:15:23.414702

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T12:36:38.223597

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T12:36:43.341331

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T13:27:07.667965

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T13:27:13.058349

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T13:27:18.368890

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T13:34:48.175989

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T13:35:04.751011

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T17:25:16.379088

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T19:20:13.097391

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T19:49:56.181251

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T19:50:01.655783

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:28:27.566002

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:28:42.891426

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:29:02.844837

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:29:25.418357

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:29:34.524777

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:45:11.945127

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:45:37.054457

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:45:56.485475

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T20:46:20.437442

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T21:54:24.027603

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T21:54:47.262657

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T21:56:21.779971

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T21:56:57.241989

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T21:58:56.029028

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T21:59:19.894506

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T22:01:57.287148

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-03T22:02:14.261950

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-09T07:30:00.743461

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T17:19:08.379502

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T17:19:10.962082

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T17:23:52.281788

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T17:38:18.357270

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T18:34:26.456670

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T18:41:39.137167

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T18:46:26.822033

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T18:56:10.860110

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T19:08:07.988103

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T19:08:12.154725

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T19:21:08.287444

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-16T19:28:08.233882

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T05:34:17.019419

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T05:55:17.315739

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T05:59:11.978744

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T06:40:47.530451

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:11:48.828893

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:40:30.689038

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:40:35.893013

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:40:40.898724

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:43:00.024813

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:43:12.884103

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T08:43:35.746671

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T12:18:08.252019

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T12:30:56.972926

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T12:38:30.347831

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T12:39:07.481589

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T12:47:12.742038

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T12:54:53.369216

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T13:05:08.352949

- Type: unknown
- Description:

## Agent Dispatch — 2026-03-17T13:14:10.933741

- Type: unknown
- Description:
