# Performance findings — measured 2026-08-07

Measured against `https://ccw-crm-web.vercel.app` after commit `95d61d82` deployed. Every number
below came from a run recorded here.

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
- **Render-blocking resources.** Lighthouse scores this 1.
- **Server response time.** 22ms, zero savings available.

---

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
