# Plan: UNI-171 — Core CRM Enhancements

**Created:** 2026-03-03
**Status:** Ready for implementation

---

## What Already Exists

### Backend (fully complete, all routes registered in main.py)

**Models** (`apps/backend/src/db/crm_models.py`):

- `Contact` model — FK to `customers.id`, fields: first/last name, email, phone, mobile, job_title, department, is_primary, is_active, notes
- `Activity` model — FK to customers, contacts, orders, quotes; activity_type enum (call/email/meeting/note/task), subject, description, due_date, completed_at
- `ActivityType` enum (call, email, meeting, note, task)

**Routes registered in main.py**:

- `contacts.router` at `/api/contacts` — GET list (paginated, search, filter), GET by id, POST create, PUT update, DELETE (soft), GET `/customer/{id}`, POST `/{id}/set-primary`
- `activities.router` at `/api/activities` — GET list (paginated, multi-filter), GET by id (with joins), POST create, PUT update, DELETE, POST `/{id}/complete`, GET `/customer/{id}`, GET `/contact/{id}`, GET `/pending-tasks`

**Backend gaps**:

- `GET /api/activities/stats` — referenced in `activitiesApi.getStats()` but **does NOT exist** → activities page stats cards all show "0"
- `GET /api/contacts/stats` — schema defined but no route exists

### Frontend (approximately 85% complete)

**API clients** (both exist with full method sets):

- `apps/web/lib/api/activities.ts` — full activitiesApi
- `apps/web/lib/api/contacts.ts` — full contactsApi

**Pages** (complete):

- `apps/web/app/(dashboard)/contacts/page.tsx` — list page with search, pagination, CRUD dialogs
- `apps/web/app/(dashboard)/activities/page.tsx` — list page with stats cards, filters, pagination
- `apps/web/app/(dashboard)/customers/[id]/page.tsx` — customer detail with Contacts + Activities tabs

**NOT yet done**:

- `contactsApi` not exported from `lib/api/index.ts`
- `ActivityTimeline.tsx` has response shape mismatch (expects `{ data: [] }`, gets `[]`)
- Contacts list shows `customer_id` UUID but not resolved company name
- No `/contacts/[id]` detail page

---

## What Needs Building

The CRM module is ~85% complete. No new "companies" model needed — `Customer` IS the B2B company entity. Remaining gaps are 2 backend bug fixes + 2 frontend enhancements + 1 new page.

---

## Sub-Tasks

### SUB-1: Fix Missing `/api/activities/stats` Backend Endpoint (S)

**Files:**

- `apps/backend/src/api/routes/activities.py`

**Steps:**

1. Add `GET /api/activities/stats` returning `ActivityStats` schema
2. Query: count by `activity_type` (group_by), count incomplete tasks (`pending_tasks`), count overdue (`due_date < now()`), count completed in last 7 days (`completed_this_week`)
3. Return `ActivityStats` with `by_type` dict + 3 scalar counts

---

### SUB-2: Fix `ActivityTimeline.tsx` Response Shape Mismatch (S)

**Files:**

- `apps/web/app/(dashboard)/customers/[id]/components/ActivityTimeline.tsx`

**Steps:**

1. Backend `GET /api/activities/customer/{id}` returns `Activity[]` (plain array, not `{ data: [] }`)
2. Fix `apiClient.get<>` type to `Activity[]` and update state setter from `response.data` to `response`

---

### SUB-3: Add Resolved Company Name to Contacts List Page (S)

**Files:**

- `apps/web/app/(dashboard)/contacts/page.tsx`

**Steps:**

1. After loading contacts, batch-load customer names from `/api/customers?page_size=100` and build a name map
2. Add "Company" column to the table rendering the resolved name
3. Add "View" button/link navigating to `/customers/{customer_id}`

---

### SUB-4: Add Contact Detail Page at `/contacts/[id]` (M)

**Files:**

- `apps/web/app/(dashboard)/contacts/[id]/page.tsx` — new file

**Steps:**

1. Load contact via `contactsApi.get(id)` and activity timeline via `activitiesApi.getContactTimeline(id)`
2. Display: contact info card (name, title, dept, phone/mobile/email, notes, primary badge)
3. Linked company card with link to `/customers/{customer_id}`
4. Activity timeline (reuse `ActivityTimeline` component pattern)
5. "Log Activity" button opening `ActivityForm` pre-filled with `contact_id`
6. Follow structure from `customers/[id]/page.tsx` (Breadcrumb, tabs, stats cards)

---

### SUB-5: Export `contactsApi` and Contact Types from `index.ts` (S)

**Files:**

- `apps/web/lib/api/index.ts`

**Steps:**

1. Add `export { contactsApi } from './contacts';`
2. Add `export type { ContactListParams } from './contacts';`
3. Re-export Contact types from `@/lib/types/contacts`

---

### SUB-6: (Optional) Company Filter Dropdown on Contacts Page (S)

**Files:**

- `apps/web/app/(dashboard)/contacts/page.tsx`

**Steps:**

1. Load customers list on mount for the dropdown options
2. Pass `customer_id` to `contactsApi.list()` when filter changes

---

## Implementation Order

1. SUB-2 — Bug fix: ActivityTimeline response mismatch (customer detail activities tab broken)
2. SUB-1 — Bug fix: missing /api/activities/stats (stats cards show 0)
3. SUB-5 — Cleanup: export contactsApi from index.ts (5 min)
4. SUB-3 — UX: company name column on contacts list
5. SUB-4 — Feature: contact detail page
6. SUB-6 — Optional: company filter dropdown

## Risks

1. ActivityTimeline mismatch is already live — activities tab on customer detail shows empty
2. Stats 404 is silent (try/catch) — page doesn't crash but shows misleading "0" data
3. No companies model needed — Customer IS the B2B company entity

## Breaking Changes

None — all changes are additive bug fixes, new pages, or non-breaking exports.
