# Decisions Log — Append-Only

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

## Agent Dispatch — 2026-04-19T17:57:14.616051

- Type: unknown
- Description:
