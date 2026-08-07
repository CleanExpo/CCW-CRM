# Performance findings — measured 2026-08-07

Measured against `https://ccw-crm-web.vercel.app` after commit `95d61d82` deployed. Every number
below came from a run recorded here.

> **Re-measured 2026-08-07, later the same day, after `f4fc4779` (PR #269) deployed.** The caching
> fix this document called for has since landed and is live. The "Current state" table and the
> uncacheable section below describe the **pre-#269** production, and are kept for the before/after
> comparison rather than corrected in place. The post-fix numbers, and what did and did not change,
> are in "After the fix" near the end. Two new defects were found while verifying it, both recorded
> there.

**Read the causation section carefully.** An earlier revision of this document asserted a root
cause it had not established. That is corrected below and the correction is left visible, because
this repository has spent an entire branch paying down documentation that outran its evidence.

---

## Current state

`npm run test:lighthouse`, mobile emulation with Lighthouse's default throttling
(150ms RTT, 1638kbps, 4× CPU slowdown):

| Page | FCP | LCP | Speed Index | TBT | Performance |
| --- | --- | --- | --- | --- | --- |
| `/` | 1268ms | **3293ms** | 4395ms | 19ms | 0.90 |
| `/login` | — | 2967ms | 2892ms | 14ms | 0.94 |
| `/register` | — | 3071ms | 3277ms | 0ms | 0.93 |

Budget in `lighthouserc.js`: LCP ≤ 2500ms, Speed Index ≤ 3000ms, TBT ≤ 300ms, every category ≥ 0.90.

Five assertions fail: `largest-contentful-paint`, `speed-index`, `bf-cache`,
`legacy-javascript-insight`, `network-dependency-tree-insight`.

`color-contrast` **passed** for the first time — the 2026-08-07 fix is confirmed live by both
Lighthouse and an independent axe run.

---

## The LCP cause is NOT established

The honest position, stated plainly so nobody acts on a guess.

**What is measured:**

- `server-response-time` is **22ms**, with `overallSavingsMs: 0` — Lighthouse reports no savings
  available. The document arrives fast.
- FCP is **1268ms**; LCP is **3293ms**. Roughly **two seconds elapse between first paint and
  largest paint**.
- TBT is 19ms, so main-thread blocking is not it.
- The LCP element is a text node: `<span class="block truncate font-medium text-[11px] …">`.

**What that rules out:** the LCP gap is not origin response time. A 22ms server response cannot
explain a 3293ms LCP.

**What remains unexplained:** why the largest text element paints two seconds after the first one.
`network-dependency-tree-insight` fails, establishing that a critical request chain exists, and
Speed Index of 4395ms says the page fills in progressively rather than at once. Neither has been
traced to a specific resource, and neither has been shown to CAUSE the gap. **That tracing is the
next piece of work**, and it should start from a Lighthouse trace or a WebPageTest filmstrip and
let the trace name the resource — not from this document's hypotheses.

### The correction

An earlier revision of this file claimed the uncacheable document explained the LCP, reasoning that
"an uncacheable document arrives after a full origin render every time". The 22ms
`server-response-time` measurement refutes that. An independent reviewer caught it. The caching
problem below is real and worth fixing on its own merits — its contribution to LCP is unquantified
and, on this evidence, small.

---

## Separate real defect: the application is uncacheable

```
$ curl -sI https://ccw-crm-web.vercel.app/
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-vercel-cache: MISS
```

The **public marketing page** is served `no-store` and is never edge-cached.

The cause is `src/app/layout.tsx:18` — the ROOT layout awaits `cookies()` to resolve locale.
Reading cookies opts a route into dynamic rendering, and at the root every page in the application
inherits it, including pages with no personalised content. Confirmed against the installed Next
16.2.11 rather than from memory.

**What this actually costs, stated without inflation:**

- `bf-cache` fails. Lighthouse names it: *"Pages whose main resource has cache-control:no-store
  cannot enter back/forward cache."* Both listed reasons carry `failureType: "Not actionable"`,
  meaning they are consequences of the header rather than separate defects. Back/forward
  navigation is slower than it needs to be.
- Every request runs the origin. At 22ms each that is not a latency problem today, but it is
  compute paid on every crawler hit and every marketing visit, and it scales with traffic.
- No CDN caching for a page whose content does not vary by user.

**What it does not demonstrably cost:** the LCP number. See above.

### Fixing it

Resolve locale **below** the root layout so marketing routes can be static and edge-cached, while
authenticated routes stay dynamic where they need to be.

That changes the rendering mode of every route in a 193-page application — its own branch, its own
review, and a before/after measurement on a preview deployment. Acceptance:

1. `curl -sI https://<preview>/` returns a cacheable `cache-control`, and `x-vercel-cache: HIT` on
   a repeat request to a marketing route.
2. Locale switching still works on the authenticated surface.
3. No route that reads user data becomes static.
4. LCP re-measured — recorded whether or not it moves, since this document's prediction is that it
   largely will not.

---

## The other failures

**`legacy-javascript-insight`** (score 0.5) — one chunk ships polyfills modern browsers do not
need, ~150ms. `unused-javascript` reports ~450ms available. Bundle work.

**`network-dependency-tree-insight`** (score 0) — the audit establishes that a critical request
chain exists. It does NOT establish that the chain caused the two-second FCP-to-LCP gap, nor that
shortening it is the highest-leverage fix. Calling it "the most likely lever" was a ranking this
evidence does not support, and an earlier revision of this file did exactly that. It is a
reasonable place to point a trace; the trace decides, not this document.

**`render-blocking-resources` passes** (score 1), despite being the usual suspect.

---

## Checked and ruled out

Recorded so nobody spends the time again:

- **Font loading.** Both `Inter` and `Plus Jakarta Sans` ship `font-display: swap`, verified by
  reading the **served** CSS rather than the source. The source was a plausible wrong answer: it
  sets `display: 'swap'` explicitly for one family and passes no `display` option for the other.
  (An earlier revision quoted an exact count of declarations. Different counting methods gave
  different numbers, so no count is asserted — only that every `@font-face` for both families
  carries `swap`.)
- **JavaScript execution.** TBT is 0–19ms across all three pages.
- **Render-blocking resources.** Lighthouse scored this 1 pre-#269. **This no longer holds** — see
  "After the fix". It scores 0.5 post-#269, with `overallSavingsMs: 0`. Back on the table, though
  the audit itself reports nothing to save.
- **Server response time.** 22ms, zero savings available.

---

## After the fix — re-measured 2026-08-07 against `f4fc4779` (PR #269)

The fix called for above landed as PR #269 and is live. `1dafaf64` on `cursor/static-public-routes`
was squash-merged into `f4fc4779`, which is why the branch commit is not an ancestor of `main`.

### Acceptance criteria from "Fixing it"

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Cacheable `cache-control`, `x-vercel-cache: HIT` on repeat | **MET** |
| 2 | Locale switching still works on the authenticated surface | **NOT VERIFIED — blocked.** Needs a login; production has no database and the operator surface 503s. Credentials are founder-gated |
| 3 | No route that reads user data became static | **MET** |
| 4 | LCP re-measured, recorded whether or not it moves | **DONE — it did not move.** See below |

**Criterion 1, measured.** `curl -sI https://ccw-crm-web.vercel.app/` now returns
`cache-control: public, max-age=0, must-revalidate` with `x-nextjs-prerender: 1` and
`x-vercel-cache: HIT`, stable `age` across three consecutive requests. `/login` returns HIT,
`/register` PRERENDER. The `no-store` header quoted earlier in this document is gone.

**Criterion 3, measured two-sided.** The `cookies()` read moved from `src/app/layout.tsx` to
`src/app/(dashboard)/layout.tsx:23`; the root layout now carries a comment forbidding dynamic APIs.
Live, `/dashboard` 307-redirects to `/login` and carries **no** `x-nextjs-prerender` header, so it
did not become static. Only `/`, `/login` and `/register` prerender.

### Criterion 4: the prediction held

This document predicted the caching fix "largely will not" move LCP. It did not.

| Page | LCP before (#268) | LCP after (#269) | Budget |
| --- | --- | --- | --- |
| `/` | 3293ms | 3105ms best / 3393ms median | 2500ms |
| `/login` | 2967ms | 2879ms best / 2952ms median | 2500ms |
| `/register` | 3071ms | 2880ms best / 2883ms median | 2500ms |

Three runs per page. The shift on `/` is ~190ms against a run-to-run spread of 3105–3853ms on that
same page, so it is within noise. **LCP still fails on every page.** The FCP-to-LCP gap is
unexplained and remains the open question.

Blocking assertion failures went from five to three:

- `bf-cache` — **now passes**, score 1 on all nine runs. This is the one improvement causally
  attributable to #269: the audit failed specifically because `cache-control: no-store` bars a page
  from the back/forward cache, and that header is gone.
- `speed-index` — no longer reported as failing, but see the gate defect below before believing it.
- `largest-contentful-paint`, `legacy-javascript-insight`, `network-dependency-tree-insight` — still
  failing, unchanged.

### New defect: the performance gate is optimistic, so `speed-index` passes on its best run only

`lighthouserc.js` sets no `aggregationMethod`. The lhci default is `optimistic`
(`node_modules/@lhci/utils/src/assertions.js:139`), and for a `max*` assertion optimistic takes the
**lowest** of the runs (same file, line 65). The gate therefore judges a three-run collection by its
best run.

Proved rather than inferred: lhci reported `largest-contentful-paint actual=3104.61` for `/`, and
the three observed runs were 3105ms, 3393ms and 3853ms — the reported figure is the minimum, not the
median.

The consequence is not academic:

| Page | Speed Index best | Speed Index median | Budget | Gate says |
| --- | --- | --- | --- | --- |
| `/` | 2868ms | **4451ms** | 3000ms | passes |

`/` exceeds the Speed Index budget by 48% on a typical run and the gate reports it green, because
one run in three came in under. `largest-contentful-paint` fails anyway — it is over budget even at
its best — which is why this went unnoticed.

Recommended fix, unshipped and belonging to whoever owns the gate: set
`assert.aggregationMethod: 'median'` in `lighthouserc.js`. Expect it to turn `speed-index` red on
`/` immediately. That is the point — it is red today and the gate is not saying so.

### New defect: `/api/health` redirects to an HTML login page, and naive monitors read it as healthy

Found while checking criterion 3. Not caused by #269 — that PR touched three files
(`src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`,
`src/components/landing/marketing-landing.tsx`) and none of them is the middleware.

`src/middleware.ts` matches every path except static assets, and `updateSession` carries a public
allowlist containing `/api/cron`, `/api/auth`, `/api/public` and four OAuth callback routes.
`/api/health` is **not** on it, so an unauthenticated request is answered with
`NextResponse.redirect` to `/login` rather than a 401.

Measured, with the check a monitor would actually run:

```
$ curl -sfL -o /dev/null -w "%{http_code} %{url_effective}\n" https://ccw-crm-web.vercel.app/api/health
200 https://ccw-crm-web.vercel.app/login?redirect=%2Fapi%2Fhealth
$ echo $?
0
```

`curl -f -L` exits 0. Any uptime check that follows redirects and treats a non-error status as
healthy reports this application healthy by fetching its login page. The endpoint that exists to
report health cannot currently report ill health from outside.

The broader shape of it: every API route under the matcher answers an unauthenticated caller with a
307 to HTML instead of a JSON 401, so API clients receive a login page where they expect JSON.

Neither defect is fixed here. Both need their own branch and review — this document is a record of
what was measured, not a change.
