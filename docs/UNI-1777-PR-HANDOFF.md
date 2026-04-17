# UNI-1777 — POS location/terminal/staff 500s → Ready for PR

**Status**: Sandbox edits complete, smoke tests passed. Pushed via GitHub MCP in Day-1 PR batch.

---

## What was wrong

Three distinct contract mismatches made the POS Locations / Staff / Terminal pages look broken:

1. **404 on `/api/pos/staff`** — backend only had `/sales-staff`. Frontend called `/staff`.
2. **`.data` unwrap bug** — frontend did `apiClient.get<{ data: T[] }>('...').data || []`. Backend returned a bare array (no wrapper). Result: `undefined` → `[]` → "No data found" even when rows existed.
3. **Missing CRUD endpoints** — frontend called POST/PUT/DELETE for `/locations` and `/staff`; backend only had those for `/terminals`.
4. **Thin GET responses** — `id`, `is_active`, `merchant_id`, timestamps, address fields were not returned, so tables/cards rendered undefined.
5. **TerminalDialog edit-mode bug** — `form.reset({ provider: '' })` wiped `merchant_id` on every edit, even if user didn't change it.

## What was changed

### Backend — `apps/backend/src/api/routes/pos_transactions.py`

- GET `/locations` — expanded response (all 13 Location fields)
- GET `/sales-staff` — expanded response (all 10 SalesStaff fields)
- **NEW** GET `/staff` — alias for `/sales-staff` via shared `_list_sales_staff_impl` helper
- GET `/terminals` — added `is_active`, `last_ping_at`
- **NEW** POST `/locations` + Pydantic `LocationCreate`
- **NEW** PUT `/locations/{id}` + Pydantic `LocationUpdate`
- **NEW** DELETE `/locations/{id}` (soft delete → `is_active=False`)
- **NEW** POST `/staff` + Pydantic `SalesStaffCreate`
- **NEW** PUT `/staff/{id}` + Pydantic `SalesStaffUpdate`
- **NEW** DELETE `/staff/{id}` (soft delete)
- **NEW** helper `_ensure_location_exists(db, code)` — validates FK before create/update

### Frontend

- `apps/web/app/(dashboard)/pos/locations/page.tsx` — `.data` unwrap fixed on `loadLocations` + `loadTerminals`
- `apps/web/app/(dashboard)/pos/staff/page.tsx` — `.data` unwrap fixed on `loadStaff` + `loadLocations`
- `apps/web/app/(dashboard)/pos/terminal/page.tsx` — `.data` unwrap fixed on `loadSalesStaff` + `loadTerminals` (transactions unchanged — that endpoint IS paginated with `.data`)
- `apps/web/app/(dashboard)/pos/types.ts` — added `merchant_id`, `last_ping_at`, `address`, `postal_code`, `country`, `timezone`, `phone`, `can_sell_at_locations`, `created_at`, `updated_at`
- `apps/web/app/(dashboard)/pos/locations/components/TerminalDialog.tsx` — edit-mode `provider: terminal.merchant_id ?? ''` (was `''`)

## Smoke tests run (sandbox)

| Check                                        | Result |
| -------------------------------------------- | ------ |
| `python3 -m py_compile pos_transactions.py`  | ✓ OK   |
| AST parse — all 15 classes, 26 async funcs   | ✓ OK   |
| Byte-check: 47868 bytes, 1342 CRLF, 0 nulls  | ✓ OK   |
| `tsc --noEmit` on web (filtered to POS)      | ✓ 0 errors |

> **Pre-existing errors on main (NOT in scope for UNI-1777):**
> - `app/layout.tsx:176` — null bytes (CRLF corruption remnant)
> - `app/api/*/stream/route.ts` — `'}' expected` (4 files)
> These predate this session and should be filed as a separate cleanup ticket.

> **Could not run backend pytest in sandbox** — the checked-in `.venv` is Windows-format (Scripts/Lib), and `uv` cannot modify `.gitignore` in the sandbox. Phill must run `cd apps/backend && uv run pytest tests/api/test_pos_terminals.py -x` locally before merging.

## Verification checklist (post-merge + deploy)

1. **Where**: `/pos/locations` page on ccw-crm-web.vercel.app
2. **How**: log in as demo user → side nav → POS → Locations
3. **What to see**:
   - Table/cards render at least the seed locations (Brisbane, Sydney, Melbourne, Online, Phone)
   - "Create Location" button opens dialog — submit works, new row appears
   - Edit row — pre-fills existing data, saves successfully
4. **What NOT to see**:
   - "No locations found" when DB has seeded rows
   - 404 or 500 in browser DevTools → Network tab
   - Console errors about `undefined.map` or `.data of undefined`
5. **Repeat on** `/pos/staff` and `/pos/terminal` with the same checks
6. **Edit a terminal** — confirm merchant_id field stays populated when you hit Save without changing it

**Confirmation prompt to Phill**: Can you confirm all three pages now show data, and a full create→edit→delete round-trip works on at least one location?

---

## Files changed (sandbox diff summary)

| File | Type | Added LOC | Notes |
| ---- | ---- | --------- | ----- |
| `apps/backend/src/api/routes/pos_transactions.py` | backend | +~220 | GET expansion + 6 new CRUD handlers + 4 Pydantic models + 2 helpers |
| `apps/web/app/(dashboard)/pos/locations/page.tsx` | frontend | ~4 | `.data` unwrap fix |
| `apps/web/app/(dashboard)/pos/staff/page.tsx` | frontend | ~4 | `.data` unwrap fix |
| `apps/web/app/(dashboard)/pos/terminal/page.tsx` | frontend | ~4 | `.data` unwrap fix (not transactions — those stay paginated) |
| `apps/web/app/(dashboard)/pos/types.ts` | frontend | +~15 | Added optional fields matching new backend responses |
| `apps/web/app/(dashboard)/pos/locations/components/TerminalDialog.tsx` | frontend | 1 line | `provider: terminal.merchant_id ?? ''` |

**Total**: 6 files, 0 locked files touched, 0 schema changes (no migration needed).
