# CCW SEO Repair Loop

Use this runbook to move `ccwonline.com.au` from the Semrush baseline toward a clean audit without mixing CCW-CRM code changes with Shopify storefront changes.

## Trigger

- Toby needs a before/after SEO, AI-search, or Semrush repair report.
- Semrush Site Audit shows regressions for `ccwonline.com.au`.
- Google/Bing/Search Console or LLM discovery work needs current public-site evidence.

## Guardrails

- CCW-CRM is not the Shopify theme repo.
- Do not publish Shopify theme, product, collection, page, or public website copy changes without explicit approval immediately before the save/publish action.
- Use live checks before relying on stale Semrush findings. The 2026-06-18 baseline showed Semrush still reported `llms.txt` missing even though the live site returned `200`.

## First Response

1. Run the local public-site audit:

   ```bash
   npm run audit:ccw-seo -- --sample-size=24
   ```

2. Save a JSON evidence bundle when preparing a Toby-facing report:

   ```bash
   npm run audit:ccw-seo -- --sample-size=40 --json > docs/audit-reports/ccw-seo-live-$(date +%F).json
   ```

3. Open Semrush Site Audit for the `Carpet Cleaners Warehouse` project and rerun the campaign after repairs.

4. If Semrush shows the Shopify signature service message, generate the signature values in Shopify first, then save them in Semrush:
   - Signature Agent: `"https://shopify.com"`
   - Signature Input: generated in the Shopify profile
   - Signature: generated in the Shopify profile

   This was visible in Semrush on 2026-06-18. It cannot be completed from CCW-CRM alone, and the browser was not signed into the CCW Shopify admin session during the repair pass.

## Repair Order

### P0 - Crawl Weight And AI Search Health

Reduce the Shopify HTML payload on product, collection, blog, and home templates. Prioritize:

- repeated app blocks injected into every page;
- oversized product option/data JSON rendered into HTML;
- unused review, popup, tracking, chat, and merchandising snippets;
- duplicated section content rendered for desktop and mobile at the same time;
- collection pages rendering too many products or hidden filters in source HTML.

The 2026-06-18 public product-page source check showed a single product page at roughly 2.35 MB with 111 script tags. The first repair inspection should review Shopify app/theme sources including Bold upsell assets, Globo preorder/menu assets, Zooomy wishlist/collection assets, Zip widgets, Mailchimp embeds, jQuery/Bootstrap bundles, and legacy custom theme CSS/JS.

Success signal: the local audit samples fewer pages over 1 MB, then Semrush reduces the `large HTML page size` and `too much content` findings.

### P0 - Structured Data

Inspect the exact Semrush structured-data URL and validate it with Google Rich Results Test. Fix duplicate or malformed Product, Organization, BreadcrumbList, and LocalBusiness schema in the Shopify theme/app snippets.

Current Semrush target from the 2026-02-03 crawl:

- URL: `https://ccwonline.com.au/`
- Issue: `1 structured data item is invalid`
- Structured data type: `Product snippet`
- Affected fields: `2 fields`
- Semrush issue detail: check `45`

The home page should not emit Product schema unless it is describing a real primary product with valid required fields. Prefer Organization, WebSite, BreadcrumbList, and LocalBusiness schema on the home page; reserve Product schema for product pages.

Success signal: Semrush structured-data error count reaches `0`.

### P0 - Internal Linking

Strengthen internal links between:

- professional equipment;
- repairs and machine service;
- chemicals and stain removal;
- CCW/CARSI training pathways.

Use contextual links from collections, product descriptions, blog posts, and educational pages. Keep CARSI ownership separate from CCW-CRM while making the customer journey visible.

Success signal: Semrush reduces `orphaned pages in sitemaps` and `only one incoming internal link`.

### P1 - Crawlability And AI Discovery

Confirm these live discovery surfaces stay healthy:

- `https://ccwonline.com.au/robots.txt`
- `https://ccwonline.com.au/sitemap.xml`
- `https://ccwonline.com.au/llms.txt`
- `https://ccwonline.com.au/agents.md`
- `https://ccwonline.com.au/.well-known/ucp`

Only change robots rules when the blocked resource is required for rendering public crawlable content.

### P2 - Content Hygiene

Fix missing image alt attributes, overlong titles, weak/missing meta descriptions, and low text-to-HTML pages on templates first. Template fixes clear more audit debt than one-off product edits.

## Semrush Keyword Tracking Repair

Replace broad tracked keywords with Australian commercial-intent groups:

- carpet cleaning equipment;
- carpet cleaning machine;
- truckmount carpet cleaner;
- portable carpet cleaner;
- carpet cleaning chemicals;
- upholstery cleaning chemicals;
- stain removal chemicals;
- tile cleaning chemicals;
- carpet cleaning machine service;
- truckmount servicing;
- carpet extractor repair;
- carpet cleaners warehouse;
- carpet cleaning supplies Brisbane;
- carpet cleaning supplies Sydney;
- carpet cleaning supplies Melbourne;
- start a carpet cleaning business;
- carpet cleaning training Australia.

## Done When

- A fresh Semrush crawl is newer than the repair work.
- The local audit output is saved with the post-repair report.
- Toby can compare the baseline in `docs/audit-reports/ccw-semrush-seo-baseline-2026-06-18.md` against the fresh Semrush numbers.
- Any public Shopify changes have an approval trail and are listed in the report.
