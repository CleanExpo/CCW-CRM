# Performance findings — measured 2026-08-07

Measured against `https://ccw-crm-web.vercel.app` after commit `95d61d82` deployed. Every number
below came from a run recorded here.

> **Re-measured 2026-08-07, later the same day, after `f4fc4779` (PR #269) deployed.** The caching
> fix this document called for has since landed and is live. The "Current state" table and the
> uncacheable section below describe the **pre-#269** production, and are kept for the before/after
> comparison rather than corrected in place. The post-fix numbers, and what did and did not change,
> are in "After the fix" near the end. Two new defects were found while verifying it, both recorded
> there.
>
> **Six further PRs (#271, #272, #273, #274, #276, #277) merged later the same day.** Every figure
> in the sections *above* predates them and describes a production that no longer exists — including
> the LCP element itself, which #274 changed. **For the current state, read "Measured against #277"
> near the end.** That section is a run executed from this branch against a production deployment
> verified as `ff36f165`, and it is the only measurement in this document that describes production
> as it stands. "What has landed since these measurements" records what each PR staled.

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

Recommended fix: set `assert.aggregationMethod: 'median'` in `lighthouserc.js`. Expect it to turn
`speed-index` red on `/` immediately. That is the point — it is red today and the gate is not saying
so.

#### Review of PR #271, `cursor/aaa-honest-gates` — reviewed in flight, since merged

> **#271 merged as `41ab85ae` at 11:27 as-written, and the gap this review identifies was then
> closed by #277 (`ff36f165`) at 12:32.** The review is kept as written, but read it as history:
> between those two merges it described `main`, and it no longer does. The one-line amendment it
> proposes below is the change #277 actually made. Nothing in this section is outstanding.

That branch fixes this (`316575a3`, "Judge Lighthouse budgets on the median run, not the luckiest
one"). Reviewed here rather than re-implemented. **The fix is correct but incomplete.**

It sets `aggregationMethod: 'median'` on nine explicitly-listed assertions. It does not set it at
the `assert:` level, so every assertion inherited from `preset: 'lighthouse:recommended'` still runs
on the `optimistic` default. Confirmed from lhci's own source: `assertions.js:426` builds each
audit's options as `{aggregationMethod, ...assertionOptions}`, so a top-level value propagates to
all assertions and a per-assertion value overrides it. One line at the `assert:` level covers
everything; nine per-assertion lines cover nine.

This is a live gap, not a theoretical one. Preset audits whose score genuinely varies run-to-run in
the 2026-08-07 collection, and which the branch therefore still grades on their best run:

| Audit | URL | Scores across 3 runs | Optimistic reports |
| --- | --- | --- | --- |
| `document-latency-insight` | `/` | 0.00, 1.00, 1.00 | 1.00 |
| `mainthread-work-breakdown` | `/` | 0.50, 1.00, 1.00 | 1.00 |
| `legacy-javascript-insight` | `/`, `/login`, `/register` | 0.00–0.50 | 0.50 |
| `interactive` | `/`, `/login` | 0.89–0.96 | best |

`document-latency-insight` is the one to look at: one run in three scores it **zero**, and the gate
reports 1.00. A branch whose stated purpose is "never grade budgets on the best of N runs" still
does exactly that for every audit it did not enumerate.

Suggested amendment, one line:

```js
assert: {
  preset: 'lighthouse:recommended',
  aggregationMethod: 'median',   // applies to preset assertions too
  assertions: { /* per-assertion overrides as written */ },
}
```

Neither defect is fixed here — but see "What has landed since these measurements" at the end of this
document, which records what #271 and #272 subsequently did to both.

The companion commit `bd684e30` (`/api/health` exact-match public path) is **correct as written**,
and deliberately exact-match so `/api/health/deep` is not exposed by prefix. One consequence worth
stating before it lands: `src/app/api/health/route.ts` returns **503 `unhealthy`** when
`hasDatabaseConfig()` is false, which is production's current state. Once this ships, monitors will
correctly start reporting the ERP as unhealthy. That is the fix working, not a regression — the
endpoint's whole problem was that it could not report ill health. The payload carries only status,
timestamp, version, uptime, environment and three booleans, so making it public discloses nothing
sensitive.

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

---

## The FCP-to-LCP gap, traced

Earlier revisions of this document said the gap needed "a trace, not another hypothesis". The trace
was run. It is in the post-#269 lhci artifacts under `.lighthouseci/`, and it answers the question.

### What the trace says

Lighthouse's own LCP phase breakdown for `/`, from the run measuring LCP at 3393ms:

| Phase | Timing | % of LCP |
| --- | --- | --- |
| TTFB | 918ms | 27% |
| Load Delay | 0ms | 0% |
| Load Time | **0ms** | 0% |
| Render Delay | **2475ms** | **73%** |

**Load Time is zero.** The LCP element is fetching nothing — it is a text node, and the trace
confirms no resource load stands between the document arriving and that text being able to paint.
Nearly three-quarters of LCP is the browser waiting to render something it already has.

### What that eliminates

- **Hydration / client rendering.** Ruled out directly: the LCP string is present in the served
  HTML. `curl -s https://ccw-crm-web.vercel.app/ | grep -c "Equipment supplier operations"` returns
  1, in a server-rendered `<span>` inside the header anchor. The element is not waiting on React.
- **Origin latency**, already ruled out and still ruled out.
- **Main-thread work.** TBT is 0–13ms post-#269.

### Where the render delay actually sits

The critical request chain, from `network-dependency-tree-insight` (score 0):

| Resource | Size | Chain ends at |
| --- | --- | --- |
| the document | 20,994 B | 1133ms |
| `3m509vc5837_1.css` | **990 B** | **2030ms — longest chain** |
| `0diq_ubmueqi4.css` | 41,267 B | 1965ms |
| `1moyu3-vsicou.css` | 935 B | 1644ms |

All three are `<link rel="stylesheet" data-precedence="next">` in `<head>`, confirmed by reading the
served HTML. All three are render-blocking, and text cannot paint before the stylesheets that might
restyle it have arrived.

The detail worth noticing: **the longest chain ends on a 990-byte file.** This is not a payload
problem. Three stylesheets are discovered only after the document parses and then contend under
Lighthouse's throttling (150ms RTT, 4× CPU), so the cost is serialization and round-trips, not
bytes. Shrinking the 41KB file would not address it.

The chain completes at 2030ms and the render-delay window runs to 3393ms, so the blocking CSS sits
squarely inside the phase that dominates LCP.

### What this does NOT establish

Stated explicitly, because this document has twice had to retract a cause it had not proved:

**It is not established that unblocking the CSS brings LCP under 2500ms.** TTFB alone is 918ms
under throttling, so render delay would have to fall from 2475ms to roughly 1580ms for the page to
pass. The trace localises the gap to the render phase and identifies the only render-blocking
resources present; it does not quantify the recovery. The next piece of work is a **change measured
against this baseline**, not a further diagnosis.

A note on the two TTFB figures, since they look contradictory: `server-response-time` is 22ms, while
the LCP phase table reports TTFB at 918ms. Both are correct. The first is server processing; the
second is the full throttled navigation including connection setup at 150ms RTT. Neither is a
server-side defect.

### Correction this forces

"Render-blocking resources" appears under "Checked and ruled out" above, on the strength of
Lighthouse scoring it 1 before #269. It scores **0.5** after, and it is now the leading candidate
for the render delay. That entry is annotated in place rather than deleted, and this section
supersedes it.

**Since acted on.** PR #272 (`c367cb0c`) cut the dual-font CSS chain on the strength of this trace.
The candidate was pursued; whether it paid off is unmeasured. See the end of this document.

---

## A second, independent trace — run concurrently, kept alongside

The section that follows was written on `main` (PR #273) by a separate session working the same
question at the same time, and is reproduced here unaltered. It reaches its conclusion by a
different route: Chrome DevTools protocol under **applied** throttling, where the section above
uses Lighthouse's **simulated** (Lantern) throttling.

The two are complementary, not contradictory, and that section says so itself. Read together:

- The section above localises the gap to the **render phase** and names the render-blocking
  stylesheets that sit inside it. That holds under simulated throttling.
- The section below establishes **which element LCP is credited to**, and shows that under applied
  throttling FCP and LCP are the same event, because an `opacity: 0` reveal makes the hero
  ineligible and a 2,226px² logo tagline wins by default.

Both can be true, and the second sharpens the first: the render-delay window is real, but the
element being measured inside it is a header caption rather than the hero. Neither section is
deleted in favour of the other.

## The trace decided: LCP is credited to the wrong element

Measured 2026-08-07 against `https://ccw-crm-web.vercel.app` **after** PR #269 (`f4fc4779`) and
PR #270 (`9317f54f`) — a newer build than the runs recorded above. Method: Chrome DevTools
protocol, **applied** throttling (4× CPU, Slow 4G, 412×823 mobile viewport), CDN warm
(`x-vercel-cache: HIT`). Five navigations.

### What was observed

The LCP element is the **logo tagline** — `src/components/brand/ccw-logo.tsx:144`, rendered
`block truncate font-medium text-[11px] sm:text-xs text-zinc-400`, area **2,226px²**. This is the
same element the earlier runs named, now traced to its source.

In the same viewport, painted and opaque, sit far larger candidates:

| Element | Area | In SSR HTML? |
| --- | --- | --- |
| Hero `<p>` "Replace fragmented spreadsheets…" | 46,185px² | yes |
| Hero `<h1>` "Run quotes, stock, and fulfilment…" | 40,667px² | yes |
| Logo tagline `<span>` (**credited as LCP**) | 2,226px² | yes |

A `PerformanceObserver` on `largest-contentful-paint` emitted **exactly one entry** across the
load — the 2,226px² span. The hero paragraph, twenty-one times larger and present in the
server-rendered HTML, never became a candidate at all.

### Why — established by controlled experiment, not inference

`src/components/landing/marketing-landing.tsx:154` wraps the entire hero in
`animate-marketing-reveal`. That keyframe (`src/app/globals.css:592`) begins at **`opacity: 0`**
and runs 0.75s. Chrome does not treat an element painted at `opacity: 0` as an LCP candidate.

The experiment: same URL, same throttling, injecting
`.animate-marketing-reveal{animation:none;opacity:1;transform:none}` before first paint and
changing nothing else.

- Animation **on** (production today): one LCP entry — the 2,226px² span.
- Animation **off**: two entries — the span, then the hero paragraph at **44,500px²**.

Disabling the reveal is what makes the hero eligible. That is the cause.

### The two-second FCP-to-LCP gap did not reproduce

Under applied throttling, across two clean runs:

| Run | FCP | LCP | LCP element |
| --- | --- | --- | --- |
| 4 | 836ms | 836ms | logo tagline, 2,226px² |
| 5 | 800ms | 800ms | logo tagline, 2,226px² |

FCP and LCP are **the same event**, which follows directly from the section above: the credited
element paints at first paint, and the hero — which paints later, behind the fade — is never
counted. There is no gap to explain in these runs.

This does **not** refute the 3293ms figure. That number came from Lighthouse's default *simulated*
(Lantern) throttling, which models metrics rather than measuring them under applied throttling.
The two methodologies are not comparable and neither supersedes the other.

### What is NOT established here

- **`npm run test:lighthouse` was not re-run.** No claim is made that any Lighthouse score or
  budget assertion has changed. The re-baseline against `lighthouserc.js` remains outstanding, and
  until it runs, the pass/fail table earlier in this document stands as the last real LHCI result.
- **No claim that this makes the page faster.** Making the hero LCP-eligible will most likely make
  the *reported* LCP worse, because a larger, later element becomes the candidate. The defect is
  that the metric currently describes a header caption rather than the hero, so any LCP tuning
  aimed at today's number is aimed at the wrong element.
- Runs hit a warm CDN. A cold-cache profile was not measured.

### The actual decision this surfaces

The 0.75s `opacity: 0` reveal delays when a real user sees the hero while simultaneously hiding
that delay from LCP. Whether to keep it is a design call, not a performance one — but the budget
in `lighthouserc.js` should not be read as describing hero render time while it stands.

---

## Fix shipped: transform-only marketing reveal (no `opacity: 0`)

**Change:** `marketing-reveal` in `src/app/globals.css` no longer starts at `opacity: 0`. The
animation is transform-only (`translateY`), so the hero stays an LCP candidate from first paint
while the entrance motion remains. Reduced-motion collapses to a no-op.

**Why this shape:** the controlled experiment above proved opacity was the disqualifier. Removing
opacity from the keyframes is the minimal honest fix — not “disable animation entirely,” and not
another round of CSS-chain guessing aimed at the logo-tagline metric.

**Still outstanding after this lands on production:**

1. Re-run `npm run test:lighthouse` (median aggregation) and record LCP/SI against the prior
   ~3393ms median baseline. Do **not** claim the budget is green without that number.
2. Expect reported LCP may move (likely up) once the hero is credited — that is honesty, not
   regression theater. Further LCP work then targets the real element.

---

## What has landed since these measurements — and what it costs them

Every measurement above was taken against `f4fc4779` (PR #269) or `9317f54f` (PR #270). Four
further PRs merged to `main` on 2026-08-07 **after** those runs. This section exists so nobody
reads a number above as describing production today.

| PR | Merged | What it changed | Effect on this document |
| --- | --- | --- | --- |
| #271 `41ab85ae` | 11:27 | `lighthouserc.js` median aggregation, `/api/health` on the public allowlist | Both defects recorded below are now **fixed on main** — one of them only partly |
| #272 `c367cb0c` | 11:34 | Stopped loading Inter from the root layout; preloads Plus Jakarta on marketing | Acts directly on the render-blocking CSS chain traced above |
| #273 `62fb5248` | 11:45 | Appended the applied-throttling trace reproduced above | Complementary; already reconciled |
| #274 `e5e2140d` | 11:57 | Made `marketing-reveal` transform-only, so the hero is LCP-eligible | Changes **which element LCP measures**; every LCP figure above describes the old element |

**The two defects this document found are no longer open, but one is only half-closed.**

`/api/health` is fixed. #271 added it to the public allowlist as an exact match, exactly as
reviewed above.

The optimistic-gate defect is **fully fixed as of PR #277** (`ff36f165`). It closed in two steps,
and the intermediate state is recorded because the review below was written during it.

#271 merged `316575a3` as-written: `aggregationMethod: 'median'` on nine enumerated assertions and
**not** at the `assert:` level, so every assertion inherited from `preset: 'lighthouse:recommended'`
kept running on the `optimistic` default. The review below identified exactly that gap and proposed
a one-line amendment. #277 applied it — `lighthouserc.js` now sets `aggregationMethod: 'median'` at
the `assert:` level, with a comment naming #271 as the gap it closes.

So the review's finding was correct and is now **resolved**, not outstanding. Any sentence in this
document describing it as a live defect describes the window between #271 and #277 and no longer
describes `main`.

**The CSS-chain finding was consumed, and its measurements are now stale.** #272 cut the dual-font
chain this document traced — its comment in `src/app/layout.tsx` cites "traced 2026-08-07", which is
this work. The diagnosis was acted on. The consequence is that the three-stylesheet table above, the
2030ms longest chain, and the 2475ms render-delay figure all describe the **pre-#272** build. They
are kept as the baseline the change should be measured against, and they are **not** current.

**Re-measured 2026-08-07 after #274 was live on production** (Cursor, `npm run test:lighthouse`,
median of 3 simulated-throttle runs against `https://ccw-crm-web.vercel.app`):

> **Provenance.** This table was recorded by a different session as commit `4a178fa9`, which changed
> only this file and committed no run artifacts. An independent reviewer flagged that nothing in the
> repository corroborated it, and was right to. **It has since been corroborated** by an independent
> re-run recorded in "Measured against #277" below, which reproduces its figures closely on a later
> build. Read it as an accurate post-#274 record whose original evidence was external.

| Route | median LCP | LCP element | median FCP | median SI |
| --- | --- | --- | --- | --- |
| `/` | **2882ms** (2876 / 2882 / 2949) | hero `<h1>` — "Run quotes…" | 1299ms | 1704ms |
| `/login` | 2657ms | (login surface) | 1082ms | 1425ms |
| `/register` | 2681ms | (register surface) | 1397ms | 2799ms |

The rest of this subsection restates what `4a178fa9` reported. As reported: pre-#274 median LCP on
`/` in the same harness was 2883ms with the logo SPAN as LCP, so after #274 the number was
essentially unchanged while the element became the H1; phase split on the median `/` run TTFB ~632ms
(22%), render delay ~2250ms (78%); and live CSS on `/` was still two stylesheets (~335KB utilities +
~1.6KB font) until the follow-up public-source split.

The next measured slice was cutting public-route render-blocking CSS bytes, and PR #276
(`05945597`) landed it at 12:17. So the table above is the **post-#274, pre-#276** state.

An earlier revision of this section said no re-measurement had been run at all. That was true when
written and is now wrong; the correction is left visible rather than silently swapped, per this
document's convention.

---

## Measured against #277 — the current state, and the first figure in this document I ran myself

Everything above was measured by another session or against an earlier build. This run was executed
from this branch on 2026-08-07 at 12:45.

**Where the evidence is, since `.lighthouseci/` is gitignored (`.gitignore:220`) and therefore
invisible to anyone reviewing a fresh checkout.** The run uploaded its median reports to LHCI's
public storage, and those URLs are checkable by anyone without access to this machine:

| Route | Median report |
| --- | --- |
| `/` | `https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1786070836604-84848.report.html` |
| `/login` | `https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1786070839099-92199.report.html` |
| `/register` | `https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1786070840714-71163.report.html` |

The local artifacts are `.lighthouseci/lhr-1786070729167.json`, `-1786070746483`, `-1786070764771`
for `/`, and the corresponding files for the other two routes. This is stated precisely because the
previous measurement in this document was failed twice by a reviewer for exactly this gap: a number
whose evidence lives only on the machine that produced it is not corroborated.

**Build identity, checked rather than assumed.** The Vercel deployments API reports the current
`target: "production"` deployment as `dpl_2UvsXLkatBQB24mWcxjG3gbfcCmS`, commit
`ff36f16542c3cbb8da94bc6372d1ca9755cbb9c8` — PR #277. Production `/` served
`x-nextjs-prerender: 1` with `x-vercel-cache: HIT`. So these numbers describe #277, including #276's
CSS split and #277's server-component landing.

`npm run test:lighthouse`, three runs per route, Lighthouse default simulated throttling:

| Route | median LCP | runs | median FCP | median SI | TBT | Budget |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | **2877ms** | 2805 / 2877 / 2884 | 1230ms | 1442ms | 0–8ms | 2500ms |
| `/login` | **2605ms** | 2575 / 2605 / 2654 | 1105ms | 2809ms | 0–1ms | 2500ms |
| `/register` | **2580ms** | 2579 / 2580 / 2655 | 1080ms | 1080ms | 0ms | 2500ms |

**LCP element on `/` is the hero**, confirmed from the artifact rather than inferred:
`h1.mx-auto`, "Run quotes, stock, and fulfilment from one calm spine". #274 held.

Phase split on the median `/` run: TTFB **627ms (22%)**, Load Delay 0, Load Time 0, Render Delay
**2250ms (78%)**.

### What this establishes

- **LCP still fails on all three routes**, by 377ms, 105ms and 80ms. The gate is now honest about
  it: #277 set `aggregationMethod: 'median'` at the `assert:` level, so this run's failure is a
  median failure, not a lucky-run artifact. `lhci autorun` exited 1.
- **It corroborates `4a178fa9`.** That table reported 2882ms median with the H1 credited and a
  627–632ms / 2250ms phase split. This independent run on a later build reproduces it within 5ms.
  The reviewer was right that it was uncorroborated; it is now corroborated, and it was accurate.
- **The trajectory is real.** `/` has gone 3293ms (pre-#269) → 3393ms → 2877ms across #272, #276 and
  #277, while the credited element changed from a 2,226px² logo tagline to the actual hero. The
  measurement got both faster and more honest, which is the harder combination.
- **Render delay is still 78% of LCP**, essentially unchanged in proportion. TTFB is 627ms and TBT
  is near zero, so the remaining 2250ms is neither origin latency nor main-thread work.

### What this does NOT establish

- **Not that any further CSS cut closes the remaining 377ms.** Three PRs have now attacked
  render-blocking CSS, and render delay's *share* of LCP has not moved. That pattern is worth
  noticing before a fourth.
- **Nothing about the authenticated surface.** These are the three public routes; login is still
  blocked on the production database.
- PR #278 (`fix: restore public route CSS source coverage`) was open at the time of this run and is
  not in it — it suggests #276/#277 may have cut CSS the public routes actually needed. If it
  merges, this table is superseded in turn.

**A note on comparability, because it will be tempting to ignore.** This note was written *before*
the post-#274 table above existed, and it is scoped to the figures that precede that table — the
pre-#274 Lighthouse runs, every one of which measured a 2,226px² logo tagline as the credited
element. It does **not** describe the post-#274 table, which explicitly credits the hero `<h1>`.

The reasoning: after #274 the hero — an order of magnitude larger and painting later — becomes
eligible, so a post-#274 LCP reading *worse* than the pre-#274 3393ms is not evidence that #272 or
#274 regressed anything; it is a different element being measured. The honest comparison is against
a post-#274 baseline, not against the pre-#274 numbers in this document.

**What the measurements did to this prediction.** It expected the element change to make the raw
comparison meaningless. The result is that the two elements score within 1ms of each other (2883ms
span, 2882ms H1), and the #277 run reproduces that H1 figure independently at 2877ms. So the
prediction was over-cautious rather than wrong: the element did change, but the number it produced
did not, which means the pre- and post-#274 figures happen to be comparable after all. Worth
recording as a case where the careful position was correct in principle and unnecessary in fact.
