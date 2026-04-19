# Knip Baseline — apps/web — 2026-04-19

**Ticket:** UNI-1925 (B3.1)
**Tool:** [knip](https://knip.dev/) `5.x` (installed as devDep in `apps/web`)
**Config:** `apps/web/knip.json` — Next.js + Vitest presets.
**Generator:** `pnpm --filter=web knip`

---

## Headline baseline counts

| Category                     |   Count |
| ---------------------------- | ------: |
| Unused files                 |  **46** |
| Unused dependencies          |   **2** |
| Unused devDependencies       |   **5** |
| Unused exports               | **272** |
| Unused exported types        | **485** |
| Unused exported enum members |  **18** |
| Duplicate exports            |   **1** |
| **TOTAL FINDINGS**           | **829** |

Total is too large for a single cleanup PR — removal is split into
follow-up tickets by category (see below). No removals this pass.

---

## Confirmed false positives (do NOT auto-remove)

These knip flags are misleading because knip's default entry-set
doesn't include `.eslintrc`, husky hooks, or lint-staged config:

- `eslint-config-next` — used via `.eslintrc`
- `prettier` — used via husky pre-commit + lint-staged
- `prettier-plugin-tailwindcss` — used via `prettier` config
- `@pact-foundation/pact` — contract tests (check before removing)
- `axe-core` — accessibility tests

Add explicit entries for these to `knip.json` → `ignoreDependencies`
OR add `eslint.config.*` / `lint-staged` config to `entry` in the
follow-up cleanup ticket.

---

## Genuinely unused deps (safe to remove after audit)

- `@radix-ui/react-avatar` — check `components/ui/avatar.tsx` is not
  consuming it; if truly unused, remove from `dependencies`.
- `reactflow` — a heavy package. Grep for imports: if zero, drop it
  (recovers significant bundle weight).

---

## Recommended follow-up tickets

Split by category to make each removal reviewable and reversible:

1. **UNI-1925-A: Drop `reactflow` + `@radix-ui/react-avatar`** (tiny PR,
   big bundle win if they're really unused).
2. **UNI-1925-B: Prune 46 unused files** — review each, some will be
   legitimately orphaned (old pages, experiments), some may be
   entry-points knip missed (add to `knip.json` entry-set).
3. **UNI-1925-C: Prune unused API-layer types** — most of the 485
   unused types live in `lib/api/*.ts` and `lib/types/*.ts`. Low risk,
   high count. Batch by domain (customers, orders, inventory, …).
4. **UNI-1925-D: Enum-member consolidation** — 18 unused enum
   members across inventory + marketplace. Usually a copy-from-backend
   mistake; trim to only the members the frontend uses.
5. **UNI-1925-E: Duplicate-export fix** — `lib/types/invoices.ts`
   exports both `PaymentMethod` and `PaymentMethodEnum`. Pick one.

---

## Running knip locally

```bash
pnpm --filter=web knip             # full report
pnpm --filter=web knip:report      # compact reporter
```

## Adding a CI step (deferred)

Knip is a _reporting_ tool in this pass — **not yet enforced in CI**.
Once 1925-A..E have brought the count down, add to
`.github/workflows/ci.yml`:

```yaml
- name: Knip (dead-code scan)
  working-directory: apps/web
  run: pnpm knip
```

Enforcing CI with 829 findings would block every PR. Enforce once
the count is <50.

---

_Baseline captured 2026-04-19. Re-run quarterly and log deltas here._
