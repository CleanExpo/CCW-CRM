# agent-browser — AI Assistant Integration Plan (UNI-1135)

**Version**: 1.0 | **Updated**: 2026-03-31
**Approach**: Collapsible sidebar (320px) embedded in each portal's dashboard layout

---

## What agent-browser Is

An embedded AI assistant panel inside each Unite-Group portal — not a separate tab, not a popup, but a **persistent 320px collapsible sidebar** that is aware of the current page context and user session.

Users interact via chat. The assistant has read access to the current page's data and can answer questions, run queries, and explain actions without leaving the app.

---

## Architecture

```
Browser (Portal UI)
    ├── Main content area (flex: 1)
    └── <AgentBrowserSidebar /> (320px, collapsible)
            │
            │ WebSocket / SSE stream
            ▼
    POST /api/ai/assistant
            │
            ├── Auth: inherit portal JWT
            ├── Rate limit: 20 req/user/hour
            └── Agent Teams backend (Lead → Specialist teammates)
                    │
                    ├── Context teammate: reads current page data
                    ├── Query teammate: fetches relevant backend data
                    └── Response teammate: formats user-friendly answer
```

---

## Per-Portal Assistants

| Portal | Assistant Name | Personality | Capabilities |
|---|---|---|---|
| CCW ERP Dashboard | Warehouse Assistant | Practical, metric-focused | Stock queries, order status, invoice lookup, reorder alerts |
| CARSI LMS | Study Buddy | Encouraging, educational | Course questions, progress tracking, IICRC compliance lookup |
| RestoreAssist | Field Guide | Technical, safety-first | IICRC S500 procedures, moisture readings, job documentation |
| G-Pilot Hub | Navigator | Cross-business, strategic | Cross-business queries, project status, unified search |
| Bron Clone | Bron | Conversational, autonomous | Workflow decisions, task management, agent status |

---

## Frontend Component

```tsx
// apps/web/components/layout/AgentBrowserSidebar.tsx
interface AgentBrowserProps {
  portal: 'ccw-erp' | 'carsi' | 'restoreassist' | 'gpilot' | 'bron';
  pageContext?: Record<string, unknown>; // Current page data for context injection
  initiallyOpen?: boolean;
}
```

Features:
- Collapsible with keyboard shortcut: `Cmd/Ctrl + Shift + A`
- Chat history persisted in localStorage (per session)
- "Clear conversation" button
- Streaming responses via SSE
- Mobile: full-screen overlay on small viewports

---

## Backend API Endpoint

```python
# apps/backend/src/api/routes/ai/assistant.py
POST /api/ai/assistant

Request:
{
  "portal": "ccw-erp",
  "message": "What products are low on stock?",
  "context": {
    "currentPage": "/inventory",
    "filters": {"category": "heavy_machinery"}
  },
  "conversationId": "uuid"  # For conversation continuity
}

Response (SSE stream):
data: {"type": "thinking", "content": "Checking inventory..."}
data: {"type": "token", "content": "You have "}
data: {"type": "token", "content": "3 products"}
data: {"type": "done", "usage": {"tokens": 450}}
```

---

## Auth + Security

- Inherits user JWT from portal session (`Authorization: Bearer {token}`)
- No cross-user context: each conversation is isolated by user ID
- Rate limiting: 20 requests/user/hour (returns 429 with retry-after header)
- Context injection: only data the user already has access to (RLS enforced)
- No PII in conversation logs (user messages are ephemeral, not stored)

---

## Implementation Phases

### Phase 1 — CCW ERP Only (April 2026)
- [ ] `AgentBrowserSidebar` component (CCW ERP only)
- [ ] `POST /api/ai/assistant` endpoint
- [ ] Warehouse Assistant persona (stock + orders context)
- [ ] Integration with existing `/api/products?low_stock=true` endpoint

### Phase 2 — CARSI + RestoreAssist (May 2026)
- [ ] CARSI Study Buddy persona (course + progress context)
- [ ] RestoreAssist Field Guide persona (IICRC S500 lookup)
- [ ] SSE streaming responses

### Phase 3 — All Portals (June 2026)
- [ ] G-Pilot Hub Navigator
- [ ] Bron Clone integration
- [ ] Agent Teams backend (parallel context + query + response)
- [ ] Mobile overlay mode
