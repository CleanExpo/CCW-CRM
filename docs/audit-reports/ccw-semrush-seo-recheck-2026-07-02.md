# CCW SEO Repair — Live Recheck 02/07/2026 (pre-implementation "before" numbers)

Companion to `ccw-semrush-seo-baseline-2026-06-18.md`. Gathered 02/07/2026 ~22:30 AEST
during the UNI-2156 implementation session, before any Shopify-side change. Static-HTML
numbers via direct HTTP fetch (curl, audit user-agent); rendered-DOM numbers via a
browser session on the live site.

## Sitemap (unchanged since baseline)

- Child sitemaps: 5
- Total entries: 2,905
- Unique entries: 1,656
- Duplicate entries: 1,249

## Sampled page weight (static HTML, 8 pages)

| Page | Bytes | Script tags (static) |
|---|---:|---:|
| `/` (home) | 2,367,026 | 120 |
| `/products/1-4-inch-brass-strainer-body` | 2,304,207 | 112 |
| `/products/1-5ltr-volkenex-viton-hand-sprayer` | 2,319,660 | 113 |
| `/products/120ml-4oz-measuring-cup` | 2,303,274 | 112 |
| `/collections/3m` | 2,404,027 | 103 |
| `/collections/accessories` | 2,498,457 | 110 |
| `/pages/about-us` | 2,307,190 | 97 |
| `/blogs/home` | 2,301,648 | 97 |

All sampled pages remain 2.30–2.50 MB — the baseline's 196-page "too large HTML"
population is un-remediated. Rendered DOM is heavier still: 152 script tags on the
homepage (68 external / 84 inline), 145 on a product page.

## Payload attribution (homepage)

External hosts by reference count: `cdn.shopify.com` ×12–15, `googletagmanager.com` ×6,
`zooomyapps.com` ×4, `gravity-software.com` ×4, `connect.facebook.net` ×3,
`maxcdn.bootstrapcdn.com` ×3 (Bootstrap 3.3.7), `cp.boldapps.net` ×2 (Bold),
Mailchimp, Hextom, POWr, Hotjar ×2, Quantcast, `ajax.googleapis.com` (jQuery 3.2.1),
`ajax.aspnetcdn.com`; product pages additionally load Zip (`bpi.zip.co`,
`static.zipmoney.com.au`). Inline Globo pre-order/menus config blocks dominate inline
script volume (globopreorderparams / globomenus markers ×30+).

No single dominant file: the driver is ~68–70 external requests per page plus 75–84
inline blocks from app embeds layered on a legacy theme that ships jQuery 3.2.1 and
Bootstrap 3.3.7 from the product-template section.

## Invalid homepage structured data — root cause (pinned)

The homepage emits **no JSON-LD**. The invalid item is **microdata**: exactly one
`itemscope itemtype="http://schema.org/Product"` element (static HTML line ~3841):

```html
<div itemscope itemtype="http://schema.org/Product" id="ProductSection"
  data-section-id="1500036668254" data-section-type="product-template" ...>
```

It is the theme's **product-template section rendered on the homepage without a product
context** (wrapped in `<div id="shopify-section-1500036668254" class="shopify-section">`),
so the Product wrapper renders with **no `name` and no `offers`** — the two invalid
fields Semrush reports. On real product pages the identical section renders valid
schema. The same section also injects the jQuery 3.2.1 / Bootstrap 3.3.7 loads.

## Proposed fix (approval-gated — no theme change made)

1. Remove the stale product-template section `1500036668254` from the homepage template
   (preferred), or gate its `itemscope`/`itemtype` attributes in Liquid so Product
   schema emits only when a product object is present.
2. Homepage schema should be Organization / WebSite / BreadcrumbList / LocalBusiness
   only; Product schema reserved for product templates.
3. Bloat reduction order of attack: audit/remove unused app embeds (Bold, Zooomy,
   Hextom, POWr, Quantcast candidates), consolidate Globo inline config, retire the
   jQuery 3.2.1 + Bootstrap 3.3.7 loads with the same section removal.

## Session status

- Semrush Site Audit re-crawl of project "Carpet Cleaners Warehouse" triggered
  02/07/2026 ~22:30 AEST (previous crawl 03/02/2026); JS rendering currently Disabled.
- Shopify crawler signature NOT yet saved — blocked at Shopify admin login
  (`accounts.shopify.com/lookup`); requires the store owner's session.
- No Shopify theme, app, or content change was made.
