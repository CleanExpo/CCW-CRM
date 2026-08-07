# Gauntlet challenge — CCW AAA (for Desktop + CLI) — 2026-08-07

Bars locked (all three, maximum):
- **A** Live `https://ccw-crm-web.vercel.app` headers + Lighthouse mobile/desktop
- **B** Named production Next App Router site that edge-caches public pages while auth stays dynamic
- **C** `lighthouserc.js` budgets + Playwright/axe + blocking CI (honest aggregation)

## Lane map (do not collide)

| Lane | Owner | Work |
|---|---|---|
| Honest gates | Cursor `cursor/aaa-honest-gates` | LHCI `aggregationMethod: median`; `/api/health` public |
| Docs remeasure | Desktop `perf/caching-findings` @ f52c74ab | Already recorded post-#269 numbers + defects |
| FCP→LCP trace | **Desktop task #3** | Real Lighthouse trace / WPT filmstrip — name the resource |
| Login / DB | Founder + credential-custody | Task #7 parked — never invent JWT/DB secrets |
| Harness runs | Claude CLI | `npm run test:lighthouse`, `npm run test:e2e` against tip; paste live output |

## Desktop — paste this slice next

```
Gauntlet piece: name the resource that owns the FCP→LCP gap on https://ccw-crm-web.vercel.app/

Bar A: post-#269 production (already edge HIT / bf-cache pass). Re-run mobile Lighthouse WITH a trace; do not reuse pre-#269 numbers as the cause.
Bar B: compare critical-request-chain shape to a named Next marketing page that hits LCP ≤2500 under the same throttling.
Bar C: after Cursor merges median aggregation, budgets must pass on MEDIAN of 3 runs, not best.

Rules: harsh critic separate from builder; no praise; no hypothesis ranked as cause; kill after 3 failed tool retries; pulse every slice; ccAutoArchiveOnPrClose must stay false.

Exit: critic picks ours blind only when (1) a named URL/resource is identified from the trace, (2) a fix lands that moves median LCP under 2500 on prod or preview, (3) LHCI median gate is green.
```

## Status snapshot

- #12 shipped (PR #269) — cache fixed; LCP did **not** move (median ~3393 vs 2500)
- #270 docs findings on main
- Desktop remeasure + **FCP→LCP trace** on `perf/caching-findings` (`1e3d1134`): LCP is 73% render delay; critical chain is three render-blocking Next CSS files (dual fonts + globals)
- #271 **merged** — median LHCI + `/api/health` public
- #272 **open** — remove Inter from root; dashboard-only Inter; preload Plus Jakarta (measured change against the trace)
- #7 still parked


## Update
- PR #271 merged (median LHCI + /api/health)
- PR #272 open: dual-font CSS chain cut (measured change vs Desktop LCP trace)
