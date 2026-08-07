# Performance findings — measured 2026-08-07

Measured against `https://ccw-crm-web.vercel.app` after commit `95d61d82` deployed. Every number
below came from a run recorded here, not from an estimate.

---

## Current state

`npm run test:lighthouse`, mobile emulation with Lighthouse's default throttling
(150ms RTT, 1638kbps, 4× CPU slowdown):

| Page | LCP | Speed Index | TBT | Performance |
| --- | --- | --- | --- | --- |
| `/` | **3293ms** | 4395ms | 19ms | 0.90 |
| `/login` | 2967ms | 2892ms | 14ms | 0.94 |
| `/register` | 3071ms | 3277ms | 0ms | 0.93 |

Budget in `lighthouserc.js`: LCP ≤ 2500ms, Speed Index ≤ 3000ms, TBT ≤ 300ms, every category ≥ 0.90.

Five assertions fail: `largest-contentful-paint`, `speed-index`, `bf-cache`,
`legacy-javascript-insight`, `network-dependency-tree-insight`.

`color-contrast` **passed** for the first time — the 2026-08-07 fix is confirmed live by both
Lighthouse and an independent axe run that found 23 violations on this same URL before the deploy
and zero after.

---

## Root cause: the whole application is uncacheable

```
$ curl -sI https://ccw-crm-web.vercel.app/
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-vercel-cache: MISS
age: 0
```

The **public marketing page** is served `no-store` and is never edge-cached. Every visitor and
every crawler pays a full origin render before any text can paint.

The cause is one line:

```ts
// src/app/layout.tsx:18
const cookieStore = await cookies();
```

The ROOT layout reads a cookie to resolve locale. Reading cookies opts a route into dynamic
rendering, and because this is the root layout, **every page in the application inherits it** —
including pages with no personalised content at all.

This is not inference. Lighthouse names it directly in the `bf-cache` audit:

> Pages whose main resource has cache-control:no-store cannot enter back/forward cache.

### Why it explains the LCP number

Every failing LCP element is a **text node**, and TBT is 0–19ms, so JavaScript execution is not the
bottleneck:

- `/` → `<span class="block truncate font-medium text-[11px] …">`
- `/register` → `<p class="text-center text-sm …">`

Both webfonts already ship `font-display: swap` — verified in the served CSS
(`Inter` and `Plus Jakarta Sans`, two `font-display:swap` declarations each) — so font blocking is
ruled out. With no blocking script and no blocking font, text LCP is gated on how long the document
takes to arrive, and an uncacheable document arrives after a full origin render every time.

---

## The fix, and why it is not in this commit

Resolve locale **below** the root layout so the marketing routes can render statically and be edge
cached, while authenticated routes stay dynamic where they genuinely need to be.

That changes the rendering mode of every route in a 193-page application. It is a real
architectural change with real blast radius, it deserves its own branch, its own review, and a
before/after measurement on a preview deployment. Making it as a drive-by alongside a performance
write-up would be exactly the kind of unreviewed sweeping change this repository has been paying
down.

Acceptance for that work:

1. `curl -sI https://<preview>/` returns a cacheable `cache-control` and eventually
   `x-vercel-cache: HIT` on the marketing routes.
2. LCP on `/` under 2500ms and Speed Index under 3000ms in `npm run test:lighthouse`.
3. Locale switching still works on the authenticated surface — the cookie must still be honoured
   where it matters.
4. No route that reads user data becomes static.

---

## The other three failures

**`bf-cache`** — Lighthouse classifies both reasons as `failureType: "Not actionable"`, because
they are consequences of `no-store`. Fixing the caching above fixes this; there is nothing separate
to do.

**`legacy-javascript-insight`** (score 0.5) — one chunk ships polyfills modern browsers do not
need, worth ~150ms. `unused-javascript` reports ~450ms available. Both are bundle work, and both
are smaller levers than the caching fix.

**`network-dependency-tree-insight`** — a critical request chain. Largely a symptom of the same
uncached document; re-measure after the caching change before treating it as separate work.

**`render-blocking-resources` passes** (score 1). It is not a problem here despite being the
usual suspect.

---

## What was checked and found NOT to be the problem

Recorded so the next person does not spend the time again:

- **Font loading.** Both families already use `display: 'swap'`, confirmed in the served CSS rather
  than in the source.
- **JavaScript execution.** TBT is 0–19ms across all three pages.
- **Render-blocking resources.** Lighthouse scores this 1.
- **Server response time.** `server-response-time` reports 4ms of available savings.
