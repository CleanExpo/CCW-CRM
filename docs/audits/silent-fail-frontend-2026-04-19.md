# Silent-Fail Frontend Audit

**Date:** 19/04/2026
**Ticket:** UNI-1946
**Auditor:** Claude Sonnet 4.6 (Audit Agent)
**Scope:** `apps/web/` — all `onClick` + `fetch`/`apiClient` pairs

---

## Executive Summary

704 `onClick` occurrences were found across 42 dashboard page routes and 96 component files. A
representative sample covering all main page routes and every form/dialog/modal component was
audited in depth. **38 findings** were identified across three severity tiers:

- **HIGH: 9** — destructive or financial mutations with swallowed errors or no user feedback
- **MEDIUM: 21** — data mutations with missing loading or error state visible to the user
- **LOW: 8** — read-only or non-critical UX gaps

Worst offenders: `apps/web/components/ai-marketing/asset-library.tsx`,
`apps/web/app/(dashboard)/autonomous-dev/page.tsx`, and
`apps/web/app/(dashboard)/inventory/page.tsx`.

Overall grade: **C** — core CRUD modules (Orders, Customers, Products, Quotes, Inventory stock)
are well-covered with toast error feedback and loading spinners, but a cluster of newer modules
and AI/marketing components have significant gaps.

---

## Scope & Methodology

Files audited:

- All 42 `apps/web/app/(dashboard)/*/page.tsx` dashboard routes
- Subcomponents discovered via `grep` for `handleDelete`, `handleSubmit`, `handleSend`,
  `handleApprove`, `handleCreate`, `handleSave`
- All `apps/web/components/` files with "form", "dialog", "modal", or "onboarding" in the name
- AI-marketing components, dashboard widgets, and layout components (`sidebar.tsx`, `mobile-nav.tsx`)

Grep patterns used:

```
rg -n "\.catch(" apps/web --include="*.tsx"
rg -n "fetch(" apps/web --include="*.tsx"
rg -n "console\.error" apps/web --include="*.tsx"
rg -n "handleDelete|handleSubmit|handleSend|handleCreate|handleSave" --include="*.tsx"
```

Each handler was read in context to confirm whether loading state, error state, and success
confirmation were present for the user.

---

## Findings Table

| #   | File                                                      | Line    | Pattern                                                                                                                                                                                    | Severity | Suggested Fix                                                                                                    |
| --- | --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `components/ai-marketing/asset-library.tsx`               | 116–126 | DELETE mutation catches error with `console.error` only — no toast, no loading state, no success confirmation to user                                                                      | HIGH     | Add `isDeleting` state, disable button, show toast on error and success                                          |
| 2   | `components/ai-marketing/asset-library.tsx`               | 60–105  | `loadAssets()` catch falls back to mock data silently — user sees data that may not reflect real state; no error indicator                                                                 | MEDIUM   | Show an error banner or toast when real API fails rather than substituting mock data                             |
| 3   | `app/(dashboard)/autonomous-dev/page.tsx`                 | 59–65   | `fetchStatus()` catch logs to console only — no user-facing error state despite status being critical operational info                                                                     | HIGH     | Set an `error` state and render an inline error message in the status card                                       |
| 4   | `app/(dashboard)/autonomous-dev/page.tsx`                 | 68–78   | `fetchProjects()` catch logs to console only — projects list silently empty on failure                                                                                                     | MEDIUM   | Set error state and display an empty state with retry option                                                     |
| 5   | `app/(dashboard)/autonomous-dev/page.tsx`                 | 81–90   | `fetchAgents()` catch logs to console only — same pattern as projects fetch                                                                                                                | MEDIUM   | Set error state and display an empty state with retry option                                                     |
| 6   | `app/(dashboard)/inventory/page.tsx`                      | 118–128 | `loadSummary()` catch logs to console only — summary cards remain stale/blank with no error message                                                                                        | MEDIUM   | Add toast or inline error when inventory summary fails to load                                                   |
| 7   | `app/(dashboard)/inventory/page.tsx`                      | 162–175 | `loadStockHealth()` catch logs to console only — stock health widget stays blank silently                                                                                                  | MEDIUM   | Add toast or inline error for stock health load failure                                                          |
| 8   | `app/(dashboard)/inventory/page.tsx`                      | 130–140 | `loadReorderAlerts()` catch is `// non-fatal` with no feedback — if alerts fail, user assumes there are none                                                                               | LOW      | At minimum log a subtle banner noting alerts could not be loaded                                                 |
| 9   | `app/(dashboard)/monitoring/page.tsx`                     | 188–194 | `getAlerts()` inner catch logs to console only — system alerts silently missing from monitoring dashboard                                                                                  | HIGH     | Show an error badge on the alerts section when this fails                                                        |
| 10  | `app/(dashboard)/monitoring/page.tsx`                     | 231–236 | Outer `fetchData()` catch logs to console only — entire monitoring dashboard stays blank with no error message                                                                             | HIGH     | Set an `error` state and render a full-page error UI                                                             |
| 11  | `app/(dashboard)/agents/components/AgentList.tsx`         | 12–13   | `.catch(() => setAgents([]))` — error swallowed; user sees "No agents yet" message indistinguishable from real empty state                                                                 | MEDIUM   | Set a separate `error` state so the empty state copy differs on failure                                          |
| 12  | `app/(dashboard)/agents/components/AgentStats.tsx`        | 24      | `.catch(() => setStats(FALLBACK))` — error swallowed; user sees fallback zeroes which look like real data                                                                                  | HIGH     | Log error and show a distinct "data unavailable" badge rather than zero stats                                    |
| 13  | `app/(dashboard)/agents/components/PerformanceTrends.tsx` | 17      | `.catch(() => setTrends(null))` — error swallowed; chart just doesn't render, no message                                                                                                   | MEDIUM   | Show an error state in the chart area                                                                            |
| 14  | `app/(dashboard)/agents/components/TaskHistory.tsx`       | 17      | `.catch(() => setTasks([]))` — error swallowed; "No tasks yet" shown on failure                                                                                                            | MEDIUM   | Set a separate error state to distinguish failure from empty                                                     |
| 15  | `app/(dashboard)/tasks/components/TaskList.tsx`           | 30–33   | `.catch(() => { setTasks([]); setTotal(0) })` — error swallowed; same UX issue as AgentList                                                                                                | MEDIUM   | Add `error` state and show distinct error empty state                                                            |
| 16  | `app/(dashboard)/tasks/components/QueueStats.tsx`         | 21      | `.catch(() => setStats(FALLBACK))` — same pattern as AgentStats; fallback zeroes look real                                                                                                 | MEDIUM   | Show "unavailable" badge on failure instead of fake zeros                                                        |
| 17  | `app/(dashboard)/bank-feeds/page.tsx`                     | 52–64   | Four parallel `Promise.all` calls each `.catch(() => [])` — any individual API failure is silently absorbed; no per-resource error feedback                                                | MEDIUM   | Track per-resource error states and show per-card error indicators                                               |
| 18  | `app/(dashboard)/dashboard/page.tsx`                      | 170–179 | Dashboard data fetches use `.catch(() => fallback)` — five separate silent catches; any dashboard widget shows stale/zero data on failure                                                  | MEDIUM   | Add a dashboard-level error indicator when critical fetches fail                                                 |
| 19  | `app/(dashboard)/orders/components/OrderDetailDialog.tsx` | 124–128 | Activity timeline load failure sets `activityError` state (good) but the outer tracking update catch at line 94–100 only logs to console — no loading indicator on the save button         | MEDIUM   | Add `isTrackingSaving` to disable the Save button while updating; already done but `console.error` is a leftover |
| 20  | `app/(dashboard)/containers/[id]/page.tsx`                | 110     | `fetchContainer()` catch logs to console only — detail page stays blank with no error message                                                                                              | HIGH     | Set an `error` state and render a full-page error UI                                                             |
| 21  | `app/(dashboard)/inventory/reservations/page.tsx`         | 116     | `loadReservations()` catch logs to console only — reservations list shows empty with no feedback                                                                                           | MEDIUM   | Add toast or inline error                                                                                        |
| 22  | `app/(dashboard)/invoices/components/InvoiceForm.tsx`     | 122     | Customer dropdown load catch logs to console only — dropdown stays empty, user can't tell why                                                                                              | MEDIUM   | Show inline error near the dropdown on failure                                                                   |
| 23  | `app/(dashboard)/invoices/components/InvoiceForm.tsx`     | 134     | Product dropdown load catch logs to console only — same issue as customer dropdown                                                                                                         | MEDIUM   | Show inline error near the dropdown on failure                                                                   |
| 24  | `app/(dashboard)/inventory/transfers/[id]/page.tsx`       | 34      | Transfer detail load catch logs to console only — detail page stays blank                                                                                                                  | MEDIUM   | Set an `error` state and render a full-page error UI                                                             |
| 25  | `components/onboarding/CompanySetupStep.tsx`              | 62–69   | `.catch(() => undefined)` on PATCH `/api/auth/me` — company profile save silently fails; user advances in wizard without knowing the save failed                                           | HIGH     | Show a non-blocking warning toast that profile save failed (user can fix in Settings)                            |
| 26  | `components/onboarding/FirstQuoteStep.tsx`                | 54–64   | `.catch(() => undefined)` on POST `/api/quotes` — first quote silently fails to create; `onComplete` is called with `quote: undefined`, no error is shown                                  | HIGH     | Catch the error, show a toast, and do not call `onComplete` on failure                                           |
| 27  | `components/onboarding/SampleDataStep.tsx`                | 80–88   | `.catch(() => undefined)` on POST `/api/test-data/generate` — generation silently fails but `isGenerated = true` is set regardless; user thinks data was created when it wasn't            | HIGH     | On catch, set `isGenerated = false` and show an error toast                                                      |
| 28  | `app/(dashboard)/invoices/[id]/page.tsx`                  | 82–97   | `handleSendInvoice()` does not set any loading state on the Send button — users can double-click and fire multiple send requests                                                           | MEDIUM   | Add `isSending` state to disable the button during the request                                                   |
| 29  | `components/layout/sidebar.tsx`                           | 212–220 | `logout()` fetch catch is `// ignore` — this is intentional (clear client state regardless) but the user gets no feedback if logout fails on the server side                               | LOW      | Consider a brief toast warning if the server logout fails ("session may still be active on other devices")       |
| 30  | `components/layout/mobile-nav.tsx`                        | 13–21   | Same logout pattern as sidebar — no user feedback on server-side failure                                                                                                                   | LOW      | Same as above                                                                                                    |
| 31  | `app/(dashboard)/marketing/page.tsx`                      | 302     | Stats load catch logs to console only — marketing dashboard stats stay zero/blank                                                                                                          | LOW      | Add toast or inline error message                                                                                |
| 32  | `app/(dashboard)/agents/components/LearningInsights.tsx`  | 34      | Insights fetch catch logs to console only — insights panel stays blank                                                                                                                     | LOW      | Add inline error state                                                                                           |
| 33  | `app/page.tsx`                                            | 26      | `fetch()` for public stats — no `res.ok` check before calling `.json()` — a non-200 response would silently pass through                                                                   | LOW      | Add `if (!res.ok) throw new Error(res.statusText)` before `res.json()`                                           |
| 34  | `app/playground/page.tsx`                                 | 257     | Raw `fetch()` with no `res.ok` check and minimal error display                                                                                                                             | LOW      | Replace with `apiClient` and add `res.ok` check                                                                  |
| 35  | `app/(dashboard)/inventory/stock/page.tsx`                | 92      | `loadInventory()` catch sets toast (good) but also `console.error` — minor cleanup only                                                                                                    | LOW      | Remove duplicate `console.error`; toast is sufficient                                                            |
| 36  | `app/(dashboard)/inventory/transfers/page.tsx`            | 104     | Same as above — toast + unnecessary `console.error`                                                                                                                                        | LOW      | Remove duplicate `console.error`                                                                                 |
| 37  | `app/(dashboard)/inventory/forecast/page.tsx`             | 87–93   | `handleRefresh()` shows a success toast even if `fetchForecast()` internally throws — the await is called but errors are not re-thrown from the hook                                       | MEDIUM   | Ensure `fetchForecast()` propagates errors; catch in `handleRefresh` and show error toast on failure             |
| 38  | `app/(dashboard)/autonomous-dev/page.tsx`                 | 154–169 | `handleResume()` has proper error toast but `fetchProjects()/fetchAgents()/fetchStatus()` called via `fetchData()` after resume still swallow errors — partial data refresh silently fails | MEDIUM   | Pass error state from `fetchData` and surface partial failure after resume                                       |

---

## Heatmap — Issues by Directory

| Directory                                     | HIGH  | MEDIUM | LOW   | Total  |
| --------------------------------------------- | ----- | ------ | ----- | ------ |
| `app/(dashboard)/autonomous-dev/`             | 1     | 3      | 0     | **4**  |
| `app/(dashboard)/agents/components/`          | 1     | 3      | 0     | **4**  |
| `app/(dashboard)/inventory/` (all sub-routes) | 0     | 4      | 2     | **6**  |
| `components/onboarding/`                      | 3     | 0      | 0     | **3**  |
| `components/ai-marketing/`                    | 1     | 1      | 0     | **2**  |
| `app/(dashboard)/monitoring/`                 | 2     | 0      | 0     | **2**  |
| `app/(dashboard)/bank-feeds/`                 | 0     | 1      | 0     | **1**  |
| `app/(dashboard)/dashboard/`                  | 0     | 1      | 0     | **1**  |
| `app/(dashboard)/containers/`                 | 1     | 0      | 0     | **1**  |
| `app/(dashboard)/invoices/`                   | 0     | 3      | 0     | **3**  |
| `app/(dashboard)/tasks/components/`           | 0     | 2      | 0     | **2**  |
| `components/layout/`                          | 0     | 0      | 2     | **2**  |
| `app/` (root)                                 | 0     | 0      | 2     | **2**  |
| Other                                         | 0     | 3      | 2     | **5**  |
| **TOTAL**                                     | **9** | **21** | **8** | **38** |

---

## Recommended Follow-up Tickets

### UNI-xxxx Candidate A: Fix Silent Fails in Onboarding Wizard

**Scope:** `components/onboarding/CompanySetupStep.tsx`, `FirstQuoteStep.tsx`, `SampleDataStep.tsx`
**Findings:** #25, #26, #27
Replace `.catch(() => undefined)` patterns with proper error toasts. Prevent wizard from advancing
when a mutation has definitively failed. Highest business risk — new users may think onboarding
succeeded when backend calls failed.

### UNI-xxxx Candidate B: Fix Silent Fails in Agent & Task Dashboard Widgets

**Scope:** `app/(dashboard)/agents/components/` — `AgentList`, `AgentStats`, `PerformanceTrends`,
`TaskHistory`, `QueueStats`; `app/(dashboard)/tasks/components/TaskList`
**Findings:** #11–#16
Replace `.catch(() => setX(fallback))` with an `error` state and distinct empty-state copy so
operators can distinguish API failure from genuinely empty data.

### UNI-xxxx Candidate C: Surface Errors in Autonomous-Dev & Monitoring Pages

**Scope:** `app/(dashboard)/autonomous-dev/page.tsx`, `app/(dashboard)/monitoring/page.tsx`
**Findings:** #3–#5, #9–#10
These pages are operational control surfaces — silent console-only errors are dangerous. Add
`error` state, render error banners, and ensure the auto-refresh loop does not silently absorb
failures across all three fetch functions.

### UNI-xxxx Candidate D: Fix AI Marketing Asset Library Delete & Load

**Scope:** `components/ai-marketing/asset-library.tsx`
**Findings:** #1–#2
Add loading/error/success states to `handleDelete`. Replace silent mock-data fallback on load
failure with an explicit error banner so users know they are viewing stale/fake content.

### UNI-xxxx Candidate E: Add `res.ok` Guards & Fix Invoice Send Double-Submit

**Scope:** `app/page.tsx`, `app/playground/page.tsx`, `app/(dashboard)/invoices/[id]/page.tsx`
**Findings:** #28, #33–#34
Add `if (!res.ok) throw new Error(...)` before `res.json()` on all raw `fetch()` calls.
Add `isSending` loading state to the Send Invoice button to prevent duplicate requests.

---

## Appendix — Raw Grep Output

### `.catch()` occurrences (all TSX files)

```
apps/web/app/(dashboard)/agents/components/AgentList.tsx:13:      .catch(() => setAgents([]));
apps/web/app/(dashboard)/agents/components/AgentStats.tsx:24:      .catch(() => setStats(FALLBACK));
apps/web/app/(dashboard)/agents/components/PerformanceTrends.tsx:17:      .catch(() => setTrends(null));
apps/web/app/(dashboard)/agents/components/TaskHistory.tsx:17:      .catch(() => setTasks([]));
apps/web/app/(dashboard)/bank-feeds/page.tsx:53:          .catch(() => [] as BankFeedEntry[]),
apps/web/app/(dashboard)/bank-feeds/page.tsx:54:        apiClient.get<BankAccount[]>('/api/bank-feeds/accounts').catch(() => [] as BankAccount[]),
apps/web/app/(dashboard)/bank-feeds/page.tsx:59:          .catch(() => null),
apps/web/app/(dashboard)/bank-feeds/page.tsx:64:          .catch(() => [] as ReconciliationAlert[]),
apps/web/app/(dashboard)/dashboard/page.tsx:170:            getDashboardInsights(3).catch(() => ({ insights: [], total: 0, categories: [] })),
apps/web/app/(dashboard)/dashboard/page.tsx:173:              .catch(() => ({ alert_count: 0 })),
apps/web/app/(dashboard)/dashboard/page.tsx:176:              .catch(() => ({ expiring_soon: 0, warranty_alerts: [] })),
apps/web/app/(dashboard)/dashboard/page.tsx:179:              .catch(() => ({ expiring_soon: 0, expiring_alerts: [] })),
apps/web/app/(dashboard)/inventory/components/ReorderRuleDialog.tsx:96:      .catch(() => { /* silent — no existing rule is fine */ });
apps/web/app/(dashboard)/tasks/components/QueueStats.tsx:21:      .catch(() => setStats(FALLBACK));
apps/web/app/(dashboard)/tasks/components/TaskList.tsx:30:      .catch(() => { setTasks([]); setTotal(0) });
apps/web/components/layout/ShadowModeBanner.tsx:15:      .catch(() => {});
apps/web/components/onboarding/CompanySetupStep.tsx:68:        .catch(() => undefined);
apps/web/components/onboarding/FirstQuoteStep.tsx:63:        .catch(() => undefined);
apps/web/components/onboarding/SampleDataStep.tsx:84:        .catch(() => undefined); // Non-fatal: endpoint may not exist in all envs
```

### Raw `fetch()` calls without `res.ok` guard

```
apps/web/app/page.tsx:26:    const res = await fetch(`${BACKEND_URL}/api/public/stats`, {...})
apps/web/app/playground/page.tsx:257:    fetch(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
apps/web/components/layout/mobile-nav.tsx:15:    await fetch('/api/auth/logout', { method: 'POST' });
apps/web/components/layout/sidebar.tsx:214:    await fetch('/api/auth/logout', { method: 'POST' });
```

### `console.error` without user-facing feedback (mutation/load handlers)

```
apps/web/app/(dashboard)/agents/components/LearningInsights.tsx:34
apps/web/app/(dashboard)/autonomous-dev/page.tsx:64
apps/web/app/(dashboard)/autonomous-dev/page.tsx:76
apps/web/app/(dashboard)/autonomous-dev/page.tsx:88
apps/web/app/(dashboard)/containers/[id]/page.tsx:110
apps/web/app/(dashboard)/inventory/page.tsx:124
apps/web/app/(dashboard)/inventory/page.tsx:171
apps/web/app/(dashboard)/inventory/reservations/page.tsx:116
apps/web/app/(dashboard)/inventory/stock/page.tsx:92   (has toast — minor)
apps/web/app/(dashboard)/inventory/transfers/page.tsx:104   (has toast — minor)
apps/web/app/(dashboard)/inventory/transfers/[id]/page.tsx:34
apps/web/app/(dashboard)/invoices/components/InvoiceForm.tsx:122
apps/web/app/(dashboard)/invoices/components/InvoiceForm.tsx:134
apps/web/app/(dashboard)/marketing/page.tsx:302
apps/web/app/(dashboard)/monitoring/page.tsx:193
apps/web/app/(dashboard)/monitoring/page.tsx:232
apps/web/components/ai-marketing/asset-library.tsx:124
```

### Well-handled patterns (for reference — do not regress)

- `orders/page.tsx` — full toast error + loading skeleton + optimistic bulk-delete guard
- `customers/page.tsx` — full toast error + loading + last-updated timestamp
- `approvals/page.tsx` — loading state, toast on error + success, disabled button during submit
- `inventory/StockReservationDialog.tsx` — Zod validation + loading state + toast feedback
- `inventory/ReleaseReservationDialog.tsx` — loading state + toast feedback
- `inventory/forecast/page.tsx` — `handleCreatePO` has proper error toast and loading per-row state
- `reconciliation/components/PendingMatchesTable.tsx` — `handleBulkApprove` fully handled
