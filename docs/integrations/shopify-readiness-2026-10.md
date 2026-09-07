# Optix × Shopify — connection audit and 2026-10 readiness

**UNI-2672 · written 2026-09-07 · measured against `origin/main` at `c0c27487`**

Everything in the "measured" column below came from reading this repository at that commit.
Everything in the "external" column is dated and sourced, because Shopify's platform state is
the half of this that changes without us.

---

## 1. What the connection actually is today

**Measured.** Optix authenticates to the Shopify Admin API with a **static access token sent as
`X-Shopify-Access-Token`** (`src/lib/integrations/shopify.ts:102-119`). There is no token
refresh anywhere in the codebase.

Two paths put a token there, and both end at the same header:

| Path | Entry point | Where the token ends up |
|---|---|---|
| Manual paste | `POST /api/integrations/shopify/configure` | a browser cookie, `shopify_access_token` |
| OAuth authorisation-code | `/authorize` → `/callback`, exchanging at `/admin/oauth/access_token` | the same browser cookie |
| Server-side default | — | `SHOPIFY_ACCESS_TOKEN` env var, read at `status/route.ts:32` and `shopify.ts:89` |

### 1.1 Finding — Admin credentials are stored in browser cookies

`src/app/api/integrations/shopify/configure/route.ts:53-58` writes **four** secrets to cookies
on the `/` path with a 30-day lifetime:

```
shopify_access_token
shopify_api_key
shopify_api_secret
shopify_webhook_secret
```

They are `httpOnly`, `sameSite: 'lax'`, and `secure` only when `NODE_ENV === 'production'`, so
page JavaScript cannot read them. That is the mitigation, and it is real. It is not the whole
problem:

- The Admin token and the **app's client secret** are transmitted on every request the browser
  makes to the app, to any path. A single request-header log, error reporter or proxy dump
  discloses them.
- The credential is scoped to one person's browser. Clearing cookies disconnects the store; a
  second admin has to paste the token again.
- Because of that, background work cannot use it. `/api/cron/nightly-full-sync` has no cookie
  jar and must fall back to `SHOPIFY_ACCESS_TOKEN`, so the store is reachable through **two
  different credentials with two different lifecycles**, and neither one's rotation invalidates
  the other.

**This is the finding that makes the client-credentials migration worth doing.** Short-lived
tokens are the smaller half of the win; getting the credential out of the browser and into
server-side storage is the larger one.

### 1.2 Finding — `SHOPIFY_MODE` defaults to `demo`

`shopify.ts:8` — `getShopifyMode()` returns `live` only for the exact string `live`, and `demo`
for everything else including unset. Fail-safe direction, and worth stating plainly in the
readiness check so nobody reads a quiet demo mode as a working connection. (Same class of
mistake as the email incident in UNI-2671: settings present, provider never asked.)

---

## 2. API version — measured

**`src/lib/integrations/shopify.ts:6`:**

```ts
const API_VERSION_FALLBACK = '2025-01';
```

`getShopifyApiVersion()` reads `SHOPIFY_API_VERSION`, requires it to match `^\d{4}-\d{2}$`, and
otherwise falls back to `2025-01`.

**That is not a pin.** A pin cannot silently be something else. Here, an unset or malformed env
var yields `2025-01` — a version approaching two years old — and the only signal is a
diagnostics warning (`src/lib/integrations/diagnostics.ts:67`) that fires *only* when the env var
is set and invalid. Unset produces no warning at all.

**Recommendation (default; take this one):** replace the fallback with an explicit constant
pinned to a version we have tested against, keep the env var as an override, and make an
unparseable override a startup-visible fault rather than a silent downgrade. The version
belongs in the code, not in the deployment environment, because it is a compatibility contract
with tested queries — not an environment setting.

---

## 3. 2026-10 breaking changes vs. what this repo calls

**External, dated 2026-09-07.** Shopify no longer publishes a per-version release-notes page —
`https://shopify.dev/docs/api/release-notes/2026-10` returns **404** — and directs readers to
[the developer changelog](https://shopify.dev/changelog) instead. The items below were confirmed
by search against `shopify.dev` on 2026-09-07; the ones marked UNVERIFIED could not be confirmed
to that standard and must be checked with the Dev MCP before the bump.

| 2026-10 change | Confirmed? | Does Optix call it? |
|---|---|---|
| `DraftOrderDiscountNotAppliedWarning.priceRule` removed; use `discountTitle` / `discountCode` | Confirmed | **No.** Zero matches for `PriceRule`, `priceRule`, `price_rule`, `draftOrder`, `draft_order` anywhere in `src/`. |
| Updating an order's shipping address recalculates taxes | Confirmed | **No.** No order-address mutation exists. `shipping_address` appears in 5 files, all read-side. |
| `Customer.lastIncompleteCheckout` and `Checkout` removed (Customer Account API) | Confirmed | **No.** Optix does not use the Customer Account API. |
| Carrier services no longer auto-added to the default shipping profile | UNVERIFIED | **No.** `carrier_service` appears in 2 files, neither of which creates one. |
| Invalid metafield queries return errors instead of null | UNVERIFIED | **No.** Zero matches for `metafield` in `src/`. |

### The whole Shopify API surface Optix uses

This is short enough to list in full, which is why the table above can be answered
exhaustively rather than sampled:

**GraphQL — one operation, used twice** (`shopify-ops.ts:222`, `:250`):

```graphql
query VariantBySku($q: String!) {
  productVariants(first: 1, query: $q) { edges { node { id product { id } } } }
}
```

**REST — three endpoints:**

| Endpoint | Where |
|---|---|
| `GET /shop.json` | connection verification |
| `GET /products/{id}.json` | `sync-product/[productId]/route.ts:65` |
| `POST /inventory_levels/set.json` | `shopify-ops.ts:280` |

**Conclusion: the 2026-10 bump is not blocked by any known breaking change.** No fix PRs are
needed for the four confirmed items. What is needed is the pin, and a schema diff run through
the Dev MCP against the *actual* 2026-10 schema rather than against a changelog summary — the
two UNVERIFIED rows are exactly the kind of gap a changelog search leaves behind.

---

## 4. Migration plan — static token → client credentials

**External, dated 2026-09-07 (from UNI-2672's own brief):** since 1 January 2026 new apps are
created in the Dev Dashboard and authenticate with OAuth **client credentials**, auto-exchanged
for roughly 24-hour access tokens with refresh. Existing custom apps on static `shpat_` tokens
keep working, so this is a deliberate migration and not an outage.

**Founder-gated: the credential swap itself, and any rotation. Nothing below is executed by an
agent.**

### Sequence

1. **Server-side credential store first, auth unchanged.** Move the four cookie-stored secrets
   into a workspace-scoped table, following the pattern `WorkspaceSendGridConfig` already sets.
   This is the security win and it is independent of the auth model — do it first, and the
   cookie path can be deleted before anything about tokens changes.
2. **One credential, not two.** Once the store exists, the cron and the UI read the same record.
   `SHOPIFY_ACCESS_TOKEN` becomes a bootstrap-only fallback with a deprecation note.
3. **Add the token-exchange client.** Client credentials grant against
   `/admin/oauth/access_token`, storing `expires_in` alongside the token, refreshing on a margin
   (refresh at 80% of lifetime, never on a 401 alone — a 401 can also mean revoked scope, and
   retrying a revoked credential is a loop).
4. **Fail closed on an expired token.** The existing code cannot express "expired": every
   failure is a generic non-`ok`. Introduce the same discrimination the email transport now uses
   — permanent vs transient — so an expired token refreshes and a revoked one surfaces.
5. **Cut over one workspace, verify against `/shop.json`, then the rest.**
6. **Delete the cookie path.** Not before; a half-migrated system with both paths live is worse
   than either.

### What must be true before step 3

- The app exists in the Dev Dashboard with a client ID and secret issued to the password
  manager.
- `SHOPIFY_API_VERSION` is pinned (section 2) so the exchange and the calls agree.
- The Governor from UNI-2668 covers store writes, so an agent-initiated write is receipted.

---

## 5. Dev MCP — wired

```
claude mcp add --transport stdio shopify-dev-mcp -- npx -y @shopify/dev-mcp@latest
```

**Verified 2026-09-07:** registered to the local config and `claude mcp list` reports
`✔ Connected`, server version **1.15.0**. The first connect timed out at 30 s on a cold `npx`
download; pre-warming the package once fixed it, and it connects immediately thereafter. Worth
knowing before someone concludes the server is broken.

Use it for the schema diff in section 3 — it validates queries against the live schema, which is
the instrument this document is missing for its two UNVERIFIED rows.

---

## 6. New 2026-07 / 2026-10 capabilities mapped to UNI-2108 lanes

Report only. Nothing here is built by this change.

| Capability | UNI-2108 lane | Why it matters to CCW |
|---|---|---|
| POS UI extensions printing to hardware receipt printers | POS | Removes the manual paper step at the counter |
| POS cash-management / drawer fields | POS | Makes till reconciliation an ERP record rather than a note |
| Inventory-transfer metafields; transfer webhooks with origin/destination | Inventory | Warehouse-to-van transfers become trackable without a bespoke table |
| Metafield triggers on webhooks/events | Products, Inventory | Event-driven sync in place of `nightly-full-sync` polling |
| App-owned delivery profiles | Orders | Per-app shipping rules without touching the store default |

**Storefront MCP cart tools are deprecated in favour of UCP Cart MCP.** Measured: Optix touches
no storefront cart tooling, so nothing to migrate.

---

## 7. What this document does not prove

- The four confirmed 2026-10 items came from a changelog search, not from a schema diff. Two
  further items are **UNVERIFIED**.
- No call was made against a live store. Every claim about Optix is from reading the code;
  every claim about Shopify is dated and sourced.
- The client-credentials plan has not been executed against a real app, because issuing the
  credential is founder-gated.
