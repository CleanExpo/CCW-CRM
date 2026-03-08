# Plan: UNI-174 — Workflow Automation

**Created:** 2026-03-03
**Status:** Ready for implementation

---

## What Already Exists

### Approval Chains (backend complete, UI view-only)

**Backend models** (`apps/backend/src/db/approvals_models.py`):

- `Approval`: approval_type (order/quote/purchase_order/discount/credit_note), entity_id, status (pending/approved/rejected/cancelled), total_steps, current_step, requested_by, notes
- `ApprovalStep`: step_number, approver_id, approver_role, status, comments, reviewed_at

**Backend routes** (`apps/backend/src/api/routes/approvals.py`, registered at `/api/approvals`):

- `POST /api/approvals`, `GET /api/approvals`, `GET /api/approvals/pending`
- `GET /api/approvals/{id}`, `POST /api/approvals/{id}/steps`
- `PUT /api/approvals/{id}/steps/{step_id}` (approve/reject, auto-closes on final step)
- `DELETE /api/approvals/{id}` (cancel)

**Frontend** (`apps/web/app/(dashboard)/approvals/page.tsx`): Read-only list page — no Approve/Reject buttons, no typed `approvalsApi` client, view-only.

### Notification Infrastructure (partially complete)

- `apps/backend/src/services/notification_service.py` — SendGrid email for order/quote events (singleton pattern)
- `apps/backend/src/services/email_notifications.py` — contact/backorder notifications
- `apps/backend/src/api/routes/integrations/sendgrid.py` — `POST /api/integrations/sendgrid/send`
- `apps/backend/src/services/sse_service.py` — SSE push (used by POS + Cin7 stream)

**Gaps:** No in-app notification model, no notification bell UI, approval events don't trigger emails.

### Task Management (CRM-only)

- `Activity` model in `crm_models.py` has `activity_type=task`, `due_date`, `completed_at`, `is_overdue`
- **Missing:** `assigned_to` user field, dedicated task management UI separate from CRM activities

### What Does NOT Exist

- Custom workflow builder (trigger → conditions → actions) — net-new
- SLA rules and tracking — net-new
- In-app notification center — net-new
- `WorkflowTemplate`, `WorkflowInstance`, `SLARule`, `SLAInstance`, `InAppNotification` models — net-new

---

## What Needs Building

| Feature                              | Status                                   |
| ------------------------------------ | ---------------------------------------- |
| Approval UI — approve/reject buttons | Enhancement (backend done, UI view-only) |
| Workflow template builder            | Net-new                                  |
| SLA rules + deadline tracking        | Net-new                                  |
| SLA escalation cron job              | Net-new                                  |
| In-app notification model + bell UI  | Net-new                                  |
| Typed `approvalsApi` client          | Net-new                                  |
| Workflow builder frontend UI         | Net-new                                  |
| Task SLA view / "My Tasks" filter    | Enhancement                              |

---

## Sub-Tasks

### ST-1: Make Approval UI Interactive (S)

**Files:**

- `apps/web/lib/api/approvals.ts` — new typed API client
- `apps/web/lib/api/index.ts` — export `approvalsApi`
- `apps/web/app/(dashboard)/approvals/page.tsx` — add Approve/Reject buttons + Create dialog

**Steps:**

1. Create `approvals.ts` typed client: `Approval`, `ApprovalStep` interfaces, methods for all 6 existing endpoints
2. Add "Approve / Reject" button group to each pending step (visible when `step.status === 'pending' && step.step_number === approval.current_step`)
3. Add comment `Dialog` (shadcn Dialog + Textarea) that fires `PUT /api/approvals/{id}/steps/{step_id}`
4. Add "Create Approval" button + form dialog
5. Export `approvalsApi` from `index.ts`

---

### ST-2: Workflow Models — DB Layer (M)

**Files:**

- `apps/backend/src/db/workflow_models.py` — new file (6 new models)
- `apps/backend/src/api/main.py` — import module to register tables

**New models (all in `workflow_models.py`, Base from `models_base.py`, UUID PKs):**

```
WorkflowTemplate     — name, description, trigger_event (str), trigger_conditions (JSON), is_active
WorkflowTemplateAction — template_id (FK), action_type (str), action_config (JSON), order (int)
WorkflowInstance     — template_id (FK, nullable), trigger_entity_type/id, status, started_at, completed_at, error_message
SLARule              — name, entity_type, sla_hours (int), escalation_action (str), escalation_config (JSON), is_active
SLAInstance          — sla_rule_id (FK), entity_id (UUID), entity_type (str), deadline (DateTime), breached (bool), breach_notified (bool)
InAppNotification    — user_id (UUID, no FK — same pattern as approvals_models.py), title, message, notification_type (str), entity_type, entity_id, is_read
```

**Note:** `user_id` stored as bare UUID (no FK to `demo_models.py` users table — established convention in this codebase).

---

### ST-3: Workflow Service + SLA Service (M)

**Files:**

- `apps/backend/src/services/workflow_service.py` — new (follows `notification_service.py` singleton pattern)
- `apps/backend/src/services/sla_service.py` — new

**`workflow_service.py`:**

- `evaluate_trigger(event, entity_type, entity_id, entity_data, db)` — query active templates, evaluate JSON conditions, create WorkflowInstance, run actions
- `execute_action(action, context, db)` — dispatch: `send_email` → NotificationService, `create_task` → CRM Activity, `create_in_app_notification` → insert InAppNotification

**`sla_service.py`:**

- `create_sla_instance(rule_id, entity_type, entity_id, db)` — creates SLAInstance with `deadline = now + rule.sla_hours`
- `check_sla_breaches(db)` — mark breached + fire escalation action via workflow_service
- `get_active_slas(entity_id, db)` — for UI display

---

### ST-4: Workflow + SLA + Notification API Routes (M)

**Files:**

- `apps/backend/src/api/routes/workflows.py` — new (7 endpoints)
- `apps/backend/src/api/routes/sla.py` — new (5 endpoints)
- `apps/backend/src/api/routes/notifications.py` — new (4 endpoints)
- `apps/backend/src/api/routes/cron_jobs.py` — add SLA breach check cron endpoint
- `apps/backend/src/api/main.py` — register all 3 new routers via try/except ImportError

**workflows.py:** `GET/POST /api/workflows/templates`, `GET/PUT/DELETE /api/workflows/templates/{id}`, `GET /api/workflows/instances`, `GET /api/workflows/instances/{id}`

**sla.py:** `GET/POST /api/sla/rules`, `PUT /api/sla/rules/{id}`, `GET /api/sla/instances`, `GET /api/sla/instances/{entity_id}`

**notifications.py:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`

**cron_jobs.py addition:** `POST /api/cron/check-sla-breaches` → calls `sla_service.check_sla_breaches(db)`

---

### ST-5: In-App Notification Bell (M)

**Files:**

- `apps/web/lib/api/notifications.ts` — new typed client
- `apps/web/components/layout/NotificationBell.tsx` — new component
- `apps/web/app/(dashboard)/layout.tsx` — add `<NotificationBell />` to header (wrapped in `ClientOnly`)

**`NotificationBell.tsx`:**

- shadcn/ui Popover + Bell icon from lucide-react
- Red badge with unread count (polls `/api/notifications/unread-count` every 60 seconds)
- Popover shows recent notification list; clicking marks read + navigates to entity
- Follows dark/light mode pattern from sidebar

**layout.tsx note:** Server Component — wrap NotificationBell in existing `ClientOnly` pattern.

---

### ST-6: Workflow Builder UI (L)

**Files:**

- `apps/web/app/(dashboard)/workflows/page.tsx` — list page (Templates + Instances tabs)
- `apps/web/app/(dashboard)/workflows/components/WorkflowBuilderDialog.tsx` — 3-step builder
- `apps/web/lib/api/workflows.ts` — typed client
- `apps/web/lib/api/index.ts` — export `workflowsApi`
- `apps/web/components/layout/sidebar.tsx` — add "Workflows" nav item

**WorkflowBuilderDialog.tsx — 3-step wizard:**

1. Trigger: `Select` for `trigger_event` (order_confirmed/quote_accepted/approval_approved/etc.)
2. Conditions (optional): dynamic list of `[field] [operator] [value]` rows → stored as JSON array
3. Actions: dynamic list with `Select` for `action_type` + conditional config fields (email → to/subject/body; task → title/assigned_to/due_hours; notification → title/message/user_id)

**Workflows page:** Tabs (Templates / Instances), template cards with is_active toggle.

---

### ST-7: Task SLA View + Assignment (S)

**Files:**

- `apps/web/app/(dashboard)/activities/page.tsx` — add "My Tasks" filter tab + SLA breach badge
- `apps/web/app/(dashboard)/approvals/page.tsx` — add SLA deadline column + breach warning
- `apps/web/lib/api/sla.ts` — typed SLA client
- `apps/web/lib/api/index.ts` — export `slaApi`

**Steps:**

1. Activities page: add "Tasks" tab (filter `activity_type=task`) + "Overdue" tab; add SLA badge from `GET /api/sla/instances` per entity
2. Approvals page: add SLA deadline column + amber/red badge (within 2h / already breached)

---

## Implementation Order

1. ST-2 — DB models (foundation for everything else)
2. ST-1 — Approval UI interactive (highest value, no new models needed)
3. ST-3 — Services (must come before routes)
4. ST-4 — API routes (depends on ST-3)
5. ST-5 — Notification bell (depends on ST-2 InAppNotification + ST-4 routes)
6. ST-7 — Task/SLA view (depends on ST-4 SLA routes)
7. ST-6 — Workflow builder UI (largest frontend task, depends on ST-4 workflow routes)

## Risks

1. **`ApprovalStep.approver_id` has no FK to users** — cannot resolve approver name from ID; use `approver_role` (string) for display in v1
2. **Activity model lacks `assigned_to`** — adding nullable column to `crm_models.py` activities table requires migration (safe — not demo_models.py)
3. **Workflow condition evaluator** — start with fixed set of well-defined trigger events + condition fields; no arbitrary field names in v1 to prevent silent misfires
4. **No Redis/job queue** — workflow triggers + SLA checks run synchronously or via cron; use FastAPI `BackgroundTasks` for off-critical-path execution (already used in other routes)
5. **`demo_models.py` must not be modified** — `InAppNotification.user_id` stored as bare UUID (no FK) — same convention as `approvals_models.py`

## Breaking Changes

None. All changes additive:

- New DB tables only (optional nullable `assigned_to` on activities via safe migration)
- New API routes only
- New frontend pages/components only
- Existing `approvals/page.tsx` enhanced with new buttons — no existing UI removed
- Cron endpoint addition is additive
