# Agent Teams + agent-browser — Combined Architecture (UNI-1136)

**Version**: 1.0 | **Updated**: 2026-03-31
**Dependencies**: `AGENT-TEAMS-ARCHITECTURE.md` + `AGENT-BROWSER-INTEGRATION.md`

---

## How They Connect

Agent Teams (server-side) powers agent-browser (client-side):

```
User types: "What's my reorder situation?"
    │
    ▼
<AgentBrowserSidebar /> sends: POST /api/ai/assistant
    │
    ▼
Lead Agent (claude-sonnet-4-6, effort: high)
    │ Analyses query, dispatches 3 parallel teammates
    │
    ├─▶ Teammate A: Context Reader
    │       └─ Reads current page context (inventory page, filters)
    │           Fetches: GET /api/products?low_stock=true
    │
    ├─▶ Teammate B: PO Checker
    │       └─ Fetches: GET /api/purchase-orders?status=draft
    │           Checks: any pending reorder POs?
    │
    └─▶ Teammate C: Alert Scanner
            └─ Fetches: GET /api/inventory/alerts?unread=true
                Checks: any active reorder alerts?
                                │
                                ▼ (all teammates complete in ~1.5s)
                Lead synthesises → formatted markdown response
                    │
                    ▼ SSE stream back to sidebar
User sees: "You have 4 products below reorder threshold:
           • Karcher HDS 1000 DE — 2 in stock (reorder point: 5)
           • [... etc]
           There are 2 draft purchase orders awaiting approval."
```

---

## Latency Budget

| Step | Time | Model |
|---|---|---|
| Request receipt + auth | 50ms | — |
| Lead agent planning | 800ms | Sonnet |
| 3 teammates in parallel | 1,200ms | Haiku |
| Lead synthesis | 600ms | Sonnet |
| SSE stream first token | ~2,650ms total | — |
| Full response complete | ~4,500ms | — |

**Target**: First token in <3s, complete response in <6s.

---

## Session Isolation

Each user gets a fully isolated conversation context:

```
User A session ─── Lead A ─── Teammates A1, A2, A3 (isolated)
User B session ─── Lead B ─── Teammates B1, B2, B3 (isolated)
```

- No shared memory between users
- No cross-user context leakage
- Teammate contexts auto-cleared on user logout
- Conversation history stored client-side (localStorage) only

---

## Graceful Degradation

If Agent Teams is unavailable (flag disabled or teammate failure):

```
Lead Agent detects teammate failure
    │
    └─▶ Falls back to single-agent mode
            Lead handles all fetches sequentially
            Response time: ~6-8s instead of ~4.5s
            User sees no error — just slightly slower response
```

Error states:
- `TEAMMATE_TIMEOUT` (>10s): Lead continues with partial data
- `TEAMS_UNAVAILABLE`: Fallback to single-agent mode
- `RATE_LIMIT_EXCEEDED`: 429 with retry-after header

---

## CCW ERP Phase 1 — Concrete Implementation

The first deployment targets CCW ERP dashboard with Warehouse Assistant:

**Frontend** (`apps/web/components/layout/AgentBrowserSidebar.tsx`):
- Collapsible panel, `Cmd+Shift+A` toggle
- SSE stream handler, markdown rendering
- Page context injection (current URL, active filters, visible data)

**Backend** (`apps/backend/src/api/routes/ai/assistant.py`):
- SSE response with chunked streaming
- Lead agent dispatches 2 teammates (keeps it simple for Phase 1):
  - Teammate 1: Data fetcher (calls existing API endpoints)
  - Teammate 2: Formatter (converts data to user-friendly markdown)

**Auth**: Reuse existing JWT middleware — no new auth required.

**Rate limiting**: Add to existing rate limiter in `main.py`:
```python
@limiter.limit("20/hour")
@router.post("/api/ai/assistant")
async def ai_assistant(...):
```

---

## Future: Cross-Portal Intelligence (Phase 3)

When all 5 portals have agent-browser, the G-Pilot Hub Navigator can do cross-portal queries:

```
"How does CCW's inventory situation affect our CARSI cohort schedule?"
    │
    ▼
G-Pilot Lead Agent
    ├─▶ CCW ERP teammate: fetches inventory + backorder status
    ├─▶ CARSI teammate: fetches upcoming cohort schedules
    └─▶ Synthesis: "3 backordered items needed for next CARSI cohort..."
```

This requires the portals to share a common service account with read access across both systems — scoped by `organization_id` via RLS.
