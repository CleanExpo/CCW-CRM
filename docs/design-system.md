# Design System — CCW Online ERP

**Updated**: 2026-08-07. Every figure here was measured, not asserted.

## There is one token source

`src/app/globals.css`. It is imported by `src/app/layout.tsx:10` and nothing else imports CSS.

Tailwind v4 — there is no `tailwind.config.*` and no `components.json`. Tokens live in CSS custom
properties in `globals.css`; `@import "tailwindcss" source(none)` plus `@source ".."` drives class
scanning. `src/components/ui/` is hand-copied shadcn/Radix rather than CLI-managed, so it does not
resync — treat those files as owned code.

### What was removed and why

`src/styles/design-system.css` (324 lines) was deleted. It declared a primary colour of `#0D9488`
teal, a glassmorphism/bento aesthetic, and "NO Lucide icons — AI-generated custom only".

None of it was ever true of this application:

- **No file imported it.** Not from TypeScript, not via `@import` in `globals.css`. Verified by
  grep across `src/`, and by checking the built CSS chunks.
- **The real primary is blue**, `--brand-primary: 221.2 83.2% 53.3%`, defined in `globals.css`.
  The `#0d9488` that does appear in the build comes from one Tailwind arbitrary value in
  `src/app/(dashboard)/demo/contractor-demo.tsx`, not from the deleted file.
- **282 files import `lucide-react`.** The no-Lucide rule was contradicted by the codebase at a
  ratio of 282 to zero and enforced by nothing.

Two token files, one of them dead, meant no one could answer "is this the right blue?" — which is
a precondition for any design review. Now there is one answer.

**Lucide is the icon set.** That is the decision, taken because 282 files already depend on it and
there is no custom icon set to migrate to.

## The contrast defect — FIXED 2026-08-07, pending deploy

**Status: repaired in the source, not yet live.** Production still serves the pre-fix build, so
measuring `ccw-crm-web.vercel.app` will still show the failures described below until this branch
deploys.

Verified locally against `http://localhost:3002` with a working positive control — reintroducing
`text-zinc-600` produced 6 violations, the repaired build produced none, and
`npx playwright test e2e/public-surface.spec.ts -g "accessibility"` passed on all three public
routes. The first measurement of this fix was taken against the wrong application entirely (another
service held port 3000), which the control caught; see the commit message on the a11y fix.

Fix applied: `text-zinc-500` and `text-zinc-600` to `text-zinc-400` on the marketing surface, and
`text-sky-500/50` to `/80`.

**The six committed visual baselines were captured from production before this change.** The first
E2E run after deploy will report a landing-page screenshot diff. That is a true positive. Resolve it
with `npx playwright test --update-snapshots` against production once it serves this build — do not
resolve it by weakening `maxDiffPixelRatio`.

## The original defect, kept for reference: greys on dark surfaces

Measured on production 2026-08-07 by two independent tools — `axe-core` via
`npm run test:e2e`, and Lighthouse via `npm run test:lighthouse`, which scores `color-contrast`
at 0 on the same page.

**23 nodes on `/` fail WCAG AA contrast.** They are not scattered; they are three colour pairs:

| Nodes | Foreground        | Background   | Ratio | Required |
| ----- | ----------------- | ------------ | ----- | -------- |
| 11    | `#71717b` zinc-500 | near-black   | 4.5   | 4.5:1    |
| 8     | `#52525c` zinc-600 | near-black   | 4.5   | 4.5:1    |
| 4     | `#01547d` dim sky  | near-black   | 3.0   | 3:1      |

Every one lands exactly at or under threshold, which is the signature of a colour chosen by eye
against a light mock and then reused on a dark surface.

### Root cause

`globals.css` already defines `--muted-foreground: 220 9% 46%`. The marketing surface does not use
it: there are **165 raw `text-zinc-400/500/600` classes** across `src/`, bypassing the token
entirely. The token system is not missing, it is being routed around.

### The rule

Do not write `text-zinc-400`, `text-zinc-500` or `text-zinc-600` for body or label text on a dark
surface. Use the semantic token (`text-muted-foreground`) so that a contrast fix is one change in
`globals.css` rather than 165.

Existing usages are not all wrong — the ones on light surfaces pass. The 23 flagged nodes are the
ones to fix first, and `npm run test:e2e` names them on every run.

## How this is checked

| What                        | Command                    | Status                                    |
| --------------------------- | -------------------------- | ----------------------------------------- |
| No orphaned CSS token file  | `node scripts/ci/validate-css-sources.js` | Blocking in boardroom-ci    |
| Accessibility, incl. contrast | `npm run test:e2e`       | 1 failing on `/` — the 23 nodes above     |
| Contrast + Core Web Vitals  | `npm run test:lighthouse`  | Failing; see the budget in `lighthouserc.js` |

`validate-css-sources.js` exists so a second dead token file cannot reappear. It fails if any CSS
file under `src/` is unreachable from `globals.css` — which is exactly the state
`design-system.css` sat in, undetected, while its rules were quoted as though they applied.
